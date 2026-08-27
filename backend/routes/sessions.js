// ============================================================
// routes/sessions.js — API Quản lý Ca học (Thời khoá biểu)
// ============================================================

import { Router } from 'express';
import db from '../database.js';

const router = Router();

const DAY_NAMES = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

/**
 * Chuyển đổi JS Date.getDay() (0=CN, 1=T2, ..., 6=T7)
 * sang quy ước bảng sessions (1=T2, 2=T3, ..., 7=CN)
 */
function jsDayToSessionDay(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Lấy giờ:phút hiện tại dạng "HH:MM"
 */
function getCurrentHHMM(dateObj) {
  const h = String(dateObj.getHours()).padStart(2, '0');
  const m = String(dateObj.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ── GET /api/sessions ────────────────────────────────────────
// Lấy danh sách tất cả ca học. Filter: ?day=1 (Thứ 2), ?active=1
router.get('/', (req, res) => {
  const { day, active } = req.query;

  let sql = 'SELECT * FROM sessions WHERE 1=1';
  const params = [];

  if (day) {
    sql += ' AND day_of_week = ?';
    params.push(Number(day));
  }

  if (active !== undefined) {
    sql += ' AND is_active = 1';
  }

  const sessions = db.prepare(sql).all(...params);

  // Bổ sung tên thứ tiếng Việt
  const enriched = sessions.map(s => ({
    ...s,
    dayName: DAY_NAMES[s.day_of_week] || '',
  }));

  res.json(enriched);
});

// ── GET /api/sessions/current ────────────────────────────────
// Trả về ca học đang diễn ra tại thời điểm hiện tại
router.get('/current', (req, res) => {
  const now = new Date();
  const currentDay = jsDayToSessionDay(now.getDay());
  const currentTime = getCurrentHHMM(now);

  const sessions = db.prepare(
    'SELECT * FROM sessions WHERE day_of_week = ? AND start_time <= ? AND end_time >= ? AND is_active = 1'
  ).all(currentDay, currentTime, currentTime);

  if (sessions.length === 0) {
    return res.json({
      active: false,
      message: 'Ngoài giờ học — không có ca học nào đang diễn ra',
      currentDay,
      currentDayName: DAY_NAMES[currentDay],
      currentTime,
    });
  }

  const session = sessions[0];
  res.json({
    active: true,
    session: {
      ...session,
      dayName: DAY_NAMES[session.day_of_week] || '',
    },
    currentDay,
    currentDayName: DAY_NAMES[currentDay],
    currentTime,
  });
});

// ── POST /api/sessions ───────────────────────────────────────
// Tạo ca học mới
router.post('/', (req, res) => {
  const { name, subject, room, day_of_week, start_time, end_time, late_after, is_active } = req.body;

  if (!name || !subject || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({
      error: 'Thiếu thông tin bắt buộc: name, subject, day_of_week, start_time, end_time',
    });
  }

  if (day_of_week < 1 || day_of_week > 7) {
    return res.status(400).json({ error: 'day_of_week phải từ 1 (Thứ 2) đến 7 (Chủ nhật)' });
  }

  if (start_time >= end_time) {
    return res.status(400).json({ error: 'start_time phải nhỏ hơn end_time' });
  }

  // Kiểm tra trùng giờ cùng thứ
  const existing = db.prepare(
    'SELECT * FROM sessions WHERE day_of_week = ? AND is_active = 1'
  ).all(Number(day_of_week));

  const overlapping = existing.find(s =>
    (start_time < s.end_time && end_time > s.start_time)
  );

  if (overlapping) {
    return res.status(409).json({
      error: `Ca học bị trùng giờ với "${overlapping.name} - ${overlapping.subject}" (${overlapping.start_time}–${overlapping.end_time}) vào ${DAY_NAMES[day_of_week]}`,
      conflictWith: overlapping,
    });
  }

  const stmt = db.prepare(
    'INSERT INTO sessions (name, subject, room, day_of_week, start_time, end_time, late_after, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(name, subject, room || '', Number(day_of_week), start_time, end_time, late_after || null, is_active !== undefined ? Number(is_active) : 1);

  res.status(201).json({
    message: 'Đã tạo ca học mới thành công',
    session: {
      id: info.lastInsertRowid,
      name,
      subject,
      room: room || '',
      day_of_week: Number(day_of_week),
      dayName: DAY_NAMES[Number(day_of_week)],
      start_time,
      end_time,
      late_after: late_after || null,
      is_active: is_active !== undefined ? Number(is_active) : 1,
    },
  });
});

// ── PUT /api/sessions/:id ────────────────────────────────────
// Cập nhật ca học
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(Number(req.params.id));
  if (!existing) {
    return res.status(404).json({ error: 'Ca học không tồn tại' });
  }

  const { name, subject, room, day_of_week, start_time, end_time, late_after, is_active } = req.body;

  const targetDay = day_of_week !== undefined ? Number(day_of_week) : existing.day_of_week;
  const targetStart = start_time !== undefined ? start_time : existing.start_time;
  const targetEnd = end_time !== undefined ? end_time : existing.end_time;

  if (targetStart >= targetEnd) {
    return res.status(400).json({ error: 'start_time phải nhỏ hơn end_time' });
  }

  // Kiểm tra trùng giờ cùng thứ (loại trừ chính ca này)
  const otherSessions = db.prepare(
    'SELECT * FROM sessions WHERE day_of_week = ? AND is_active = 1'
  ).all(targetDay).filter(s => s.id !== Number(req.params.id));

  const overlapping = otherSessions.find(s =>
    (targetStart < s.end_time && targetEnd > s.start_time)
  );

  if (overlapping) {
    return res.status(409).json({
      error: `Ca học bị trùng giờ với "${overlapping.name} - ${overlapping.subject}" (${overlapping.start_time}–${overlapping.end_time}) vào ${DAY_NAMES[targetDay]}`,
      conflictWith: overlapping,
    });
  }

  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (subject !== undefined) { updates.push('subject = ?'); params.push(subject); }
  if (room !== undefined) { updates.push('room = ?'); params.push(room); }
  if (day_of_week !== undefined) { updates.push('day_of_week = ?'); params.push(Number(day_of_week)); }
  if (start_time !== undefined) { updates.push('start_time = ?'); params.push(start_time); }
  if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time); }
  if (late_after !== undefined) { updates.push('late_after = ?'); params.push(late_after); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(Number(is_active)); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Không có dữ liệu cập nhật' });
  }

  params.push(Number(req.params.id));
  db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  res.json({ message: 'Đã cập nhật ca học thành công' });
});

// ── DELETE /api/sessions/:id ─────────────────────────────────
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Ca học không tồn tại' });
  }
  res.json({ message: 'Đã xóa ca học' });
});

export default router;
export { DAY_NAMES, jsDayToSessionDay, getCurrentHHMM };
