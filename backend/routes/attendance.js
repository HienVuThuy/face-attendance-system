// ============================================================
// routes/attendance.js — API Lịch sử điểm danh & check-in (Có Real-Time SSE)
// ============================================================

import { Router } from 'express';
import db from '../database.js';

const router = Router();

// Quản lý danh sách kết nối SSE clients
const sseClients = new Set();

/**
 * Phát tín hiệu sự kiện thời gian thực (Server-Sent Events) tới toàn bộ client
 */
export function broadcastAttendanceEvent(eventType, data = {}) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── GET /api/attendance/events (SSE Stream) ───────────────
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Hỗ trợ Nginx / proxy
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Đăng ký client vào pool
  sseClients.add(res);

  // Gửi thông báo handshake thành công
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`);

  // Heartbeat định kỳ 20s giữ kết nối sống
  const keepAliveTimer = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAliveTimer);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAliveTimer);
    sseClients.delete(res);
  });
});

// ── GET /api/attendance ──────────────────────────────────
// Query params: ?search=&status=&from=&to=&limit=&offset=
router.get('/', (req, res) => {
  const { search, status, from, to, limit = 500, offset = 0 } = req.query;

  let sql = `
    SELECT 
      l.id,
      l.student_id AS studentId,
      s.name,
      s.lop,
      l.timestamp,
      l.status,
      l.confidence
    FROM attendance_logs l
    LEFT JOIN students s ON l.student_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND (s.name LIKE ? OR l.student_id LIKE ? OR s.lop LIKE ?)';
    const kw = `%${search}%`;
    params.push(kw, kw, kw);
  }

  if (status && status !== 'all') {
    sql += ' AND l.status = ?';
    params.push(status);
  }

  if (from) {
    const fromTs = new Date(from).getTime();
    if (!isNaN(fromTs)) {
      sql += ' AND l.timestamp >= ?';
      params.push(fromTs);
    }
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const toTs = toDate.getTime();
    if (!isNaN(toTs)) {
      sql += ' AND l.timestamp <= ?';
      params.push(toTs);
    }
  }

  sql += ' ORDER BY l.timestamp DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

// ── POST /api/attendance ─────────────────────────────────
// Ghi nhận điểm danh (từ AI quét mặt hoặc thủ công)
// ★ Session-Based: Tự động tra ca học theo thứ + giờ hiện tại
// Chống ghi trùng: nếu SV vừa điểm danh trong vòng 60 giây thì bỏ qua/trả log gần nhất
router.post('/', (req, res) => {
  const { studentId, status, timestamp, confidence, allowDuplicate = false, skipSessionCheck = false } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'Thiếu studentId' });
  }

  // Kiểm tra sinh viên có tồn tại không
  const student = db.prepare('SELECT id, name, lop FROM students WHERE id = ?').get(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Sinh viên không tồn tại trong hệ thống' });
  }

  const logTime = timestamp ? Number(timestamp) : Date.now();

  // Kiểm tra chống spam điểm danh liên tục (trong vòng 60s)
  if (!allowDuplicate) {
    const recentLog = db.prepare(`
      SELECT id, timestamp FROM attendance_logs 
      WHERE student_id = ? AND (? - timestamp) < 60000 AND (? - timestamp) >= 0
      ORDER BY timestamp DESC LIMIT 1
    `).get(studentId, logTime, logTime);

    if (recentLog) {
      return res.status(200).json({
        message: 'Sinh viên đã check-in gần đây (< 60s), bỏ qua ghi trùng',
        skipped: true,
        logId: recentLog.id,
      });
    }
  }

  // ★ SESSION MATCHING — Tra ca học theo thứ + giờ hiện tại
  let matchedSession = null;

  if (!skipSessionCheck) {
    const logDate = new Date(logTime);
    const jsDay = logDate.getDay(); // 0=CN, 1=T2, ..., 6=T7
    const sessionDay = jsDay === 0 ? 7 : jsDay; // Chuyển sang 1=T2, ..., 7=CN
    const hh = String(logDate.getHours()).padStart(2, '0');
    const mm = String(logDate.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    const DAY_NAMES = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

    const matchingSessions = db.prepare(
      'SELECT * FROM sessions WHERE day_of_week = ? AND start_time <= ? AND end_time >= ? AND is_active = 1'
    ).all(sessionDay, currentTime, currentTime);

    if (matchingSessions.length === 0) {
      return res.status(400).json({
        error: `Ngoài giờ học — Không có ca học nào đang diễn ra (${DAY_NAMES[sessionDay]}, ${currentTime})`,
        code: 'NO_ACTIVE_SESSION',
        currentDay: sessionDay,
        currentDayName: DAY_NAMES[sessionDay],
        currentTime,
      });
    }

    matchedSession = matchingSessions[0];
  }

  // Phân loại tự động on-time / late dựa trên ngưỡng trễ của ca học
  let finalStatus = status;
  if (!finalStatus) {
    const logDate = new Date(logTime);
    const curH = logDate.getHours();
    const curM = logDate.getMinutes();

    let lateH, lateM;

    if (matchedSession && matchedSession.late_after) {
      // Dùng ngưỡng trễ riêng của ca
      [lateH, lateM] = matchedSession.late_after.split(':').map(Number);
    } else if (matchedSession) {
      // Mặc định: start_time + 15 phút
      const [startH, startM] = matchedSession.start_time.split(':').map(Number);
      const totalMin = startH * 60 + startM + 15;
      lateH = Math.floor(totalMin / 60);
      lateM = totalMin % 60;
    } else {
      // Fallback: dùng setting toàn cục
      const shiftSetting = db.prepare("SELECT value FROM settings WHERE key = 'lateThreshold'").get();
      const lateThreshold = shiftSetting ? shiftSetting.value : '07:15';
      [lateH, lateM] = lateThreshold.split(':').map(Number);
    }

    if (curH > lateH || (curH === lateH && curM > lateM)) {
      finalStatus = 'late';
    } else {
      finalStatus = 'on-time';
    }
  }

  const sessionId = matchedSession ? matchedSession.id : null;

  const stmt = db.prepare(`
    INSERT INTO attendance_logs (student_id, timestamp, status, confidence, session_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(studentId, logTime, finalStatus, confidence || null, sessionId);

  const createdLog = {
    id: info.lastInsertRowid,
    studentId: student.id,
    name: student.name,
    lop: student.lop,
    timestamp: logTime,
    status: finalStatus,
    confidence: confidence || null,
    session_id: sessionId,
    sessionName: matchedSession ? matchedSession.name : null,
    subject: matchedSession ? matchedSession.subject : null,
    room: matchedSession ? matchedSession.room : null,
  };

  // 🚀 Broadcast SSE Event thông báo toàn bộ client cập nhật tức thì
  broadcastAttendanceEvent('attendance_created', createdLog);

  res.status(201).json({
    message: 'Ghi nhận điểm danh thành công',
    log: createdLog,
  });
});

// ── PUT /api/attendance/:id ──────────────────────────────
router.put('/:id', (req, res) => {
  const { status, timestamp } = req.body;
  const existing = db.prepare('SELECT id FROM attendance_logs WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Bản ghi không tồn tại' });
  }

  const updates = [];
  const params = [];

  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (timestamp !== undefined) { updates.push('timestamp = ?'); params.push(Number(timestamp)); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Không có dữ liệu cập nhật' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE attendance_logs SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // 🚀 Broadcast SSE Event
  broadcastAttendanceEvent('attendance_updated', { id: Number(req.params.id), status, timestamp });

  res.json({ message: 'Đã cập nhật bản ghi điểm danh' });
});

// ── DELETE /api/attendance/:id ───────────────────────────
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM attendance_logs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Bản ghi không tồn tại' });
  }

  // 🚀 Broadcast SSE Event
  broadcastAttendanceEvent('attendance_deleted', { id: Number(req.params.id) });

  res.json({ message: 'Đã xóa bản ghi' });
});

// ── DELETE /api/attendance (Clear all) ────────────────────
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM attendance_logs').run();

  // 🚀 Broadcast SSE Event
  broadcastAttendanceEvent('attendance_cleared', {});

  res.json({ message: 'Đã xóa toàn bộ lịch sử điểm danh' });
});

// ── GET /api/attendance/export ───────────────────────────
// Xuất file CSV
router.get('/export', (req, res) => {
  const logs = db.prepare(`
    SELECT 
      l.id,
      l.student_id AS studentId,
      s.name,
      s.lop,
      l.timestamp,
      l.status
    FROM attendance_logs l
    LEFT JOIN students s ON l.student_id = s.id
    ORDER BY l.timestamp DESC
  `).all();

  let csv = '\uFEFFThời gian,Ngày,Mã SV,Họ Tên,Lớp,Ca học,Môn học,Trạng thái\n';
  logs.forEach(row => {
    const d = new Date(row.timestamp);
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const statusStr = row.status === 'on-time' ? 'Đúng giờ' : 'Đi muộn';
    csv += `"${timeStr}","${dateStr}","${row.studentId}","${row.name || ''}","${row.lop || ''}","${row.sessionName || ''}","${row.subject || ''}","${statusStr}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=Lich_Su_Diem_Danh_${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

export default router;

