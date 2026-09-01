// ============================================================
// routes/students.js — API quản lý sinh viên + face descriptors
// ============================================================
// Endpoints:
//   GET    /api/students          — Lấy danh sách (có filter)
//   GET    /api/students/:id      — Chi tiết 1 SV
//   POST   /api/students          — Tạo mới
//   PUT    /api/students/:id      — Cập nhật
//   DELETE /api/students/:id      — Xóa
//   POST   /api/students/:id/descriptors — Thêm face descriptor
//   POST   /api/students/:id/avatar      — Upload ảnh chân dung
// ============================================================

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../database.js';
import { broadcastAttendanceEvent } from './attendance.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Hàm hỗ trợ lưu chuỗi base64 DataURL thành file ảnh trên ổ cứng
function saveBase64Avatar(id, avatarDataUrl) {
  if (!avatarDataUrl || typeof avatarDataUrl !== 'string') return null;
  if (avatarDataUrl.startsWith('/uploads/')) return avatarDataUrl;

  if (avatarDataUrl.startsWith('data:image/')) {
    try {
      const matches = avatarDataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches) {
        const rawExt = matches[1].toLowerCase();
        const ext = rawExt.includes('jpeg') ? 'jpg' : (rawExt.includes('png') ? 'png' : 'jpg');
        const buffer = Buffer.from(matches[2], 'base64');
        const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeId}_${Date.now()}.${ext}`;
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, buffer);
        return `/uploads/${filename}`;
      }
    } catch (e) {
      console.error('Lỗi lưu base64 avatar:', e.message);
    }
  }
  return null;
}

// Cấu hình multer để lưu ảnh upload
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    // Đặt tên file: maSV_timestamp.ext
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận ảnh JPEG, PNG, WebP'));
    }
  },
});

// Safe helper to parse face_descriptors
function parseDescriptors(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (typeof raw === 'object') return Object.values(raw);
  return [];
}

// ── GET /api/students ────────────────────────────────────
// Query params: ?search=keyword&status=registered|not_registered
router.get('/', (req, res) => {
  const { search, status } = req.query;

  let sql = 'SELECT id, name, lop, avatar_path, created_at, face_descriptors FROM students WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR id LIKE ? OR lop LIKE ?)';
    const kw = `%${search}%`;
    params.push(kw, kw, kw);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params);

  // Thêm faceStatus và faceDescriptors dựa vào face_descriptors
  const result = rows.map(r => {
    const descriptors = parseDescriptors(r.face_descriptors);
    const faceStatus = descriptors.length > 0 ? 'registered' : 'not_registered';

    // Nếu filter theo status, bỏ qua những SV không khớp
    if (status && faceStatus !== status) return null;

    return {
      id: r.id,
      name: r.name,
      lop: r.lop,
      faceStatus,
      faceDescriptors: descriptors,
      avatar: r.avatar_path ? `/uploads/${path.basename(r.avatar_path)}` : null,
      createdAt: r.created_at,
      descriptorCount: descriptors.length,
    };
  }).filter(Boolean);

  res.json(result);
});

// ── GET /api/students/:id ────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare(
    'SELECT id, name, lop, face_descriptors, avatar_path, created_at FROM students WHERE id = ?'
  ).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Sinh viên không tồn tại' });

  const descriptors = parseDescriptors(row.face_descriptors);
  res.json({
    id: row.id,
    name: row.name,
    lop: row.lop,
    faceStatus: descriptors.length > 0 ? 'registered' : 'not_registered',
    faceDescriptors: descriptors,
    avatar: row.avatar_path ? `/uploads/${path.basename(row.avatar_path)}` : null,
    createdAt: row.created_at,
  });
});

// ── POST /api/students ───────────────────────────────────
router.post('/', (req, res) => {
  const { id, name, lop, faceDescriptors, avatar } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'Thiếu Mã SV hoặc Họ tên' });
  }

  const cleanId = id.trim().toUpperCase();

  // Kiểm tra trùng
  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(cleanId);
  if (existing) {
    return res.status(409).json({ error: `Mã SV ${cleanId} đã tồn tại trong hệ thống` });
  }

  const descriptorsJson = JSON.stringify(faceDescriptors || []);
  const savedAvatarPath = saveBase64Avatar(cleanId, avatar);

  db.prepare(
    'INSERT INTO students (id, name, lop, face_descriptors, avatar_path, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(cleanId, name.trim(), (lop || '').trim(), descriptorsJson, savedAvatarPath, Date.now());

  broadcastAttendanceEvent('students_updated', { action: 'create', id: cleanId });

  res.status(201).json({
    message: 'Đã thêm sinh viên thành công',
    id: cleanId,
    avatar: savedAvatarPath,
  });
});

// ── PUT /api/students/:id ────────────────────────────────
router.put('/:id', (req, res) => {
  const { name, lop, avatar } = req.body;
  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Sinh viên không tồn tại' });

  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
  if (lop !== undefined) { updates.push('lop = ?'); params.push(lop.trim()); }
  if (avatar !== undefined) {
    const savedAvatarPath = saveBase64Avatar(req.params.id, avatar);
    updates.push('avatar_path = ?');
    params.push(savedAvatarPath);
  }
  if (req.body.faceDescriptors !== undefined) {
    const descriptorsJson = JSON.stringify(req.body.faceDescriptors || []);
    updates.push('face_descriptors = ?');
    params.push(descriptorsJson);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Không có trường nào được cập nhật' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Cập nhật tên/lớp trong attendance_logs (denormalized)
  if (name !== undefined) {
    db.prepare('UPDATE attendance_logs SET student_id = student_id WHERE student_id = ?')
      .run(req.params.id);
  }

  broadcastAttendanceEvent('students_updated', { action: 'update', id: req.params.id });

  res.json({ message: 'Đã cập nhật sinh viên' });
});

// ── DELETE /api/students/:id ─────────────────────────────
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Sinh viên không tồn tại' });
  }

  broadcastAttendanceEvent('students_updated', { action: 'delete', id: req.params.id });

  res.json({ message: 'Đã xóa sinh viên' });
});

// ── POST /api/students/:id/descriptors ───────────────────
// Body: { descriptor: [128 numbers] } HOẶC { descriptors: [[128 numbers], ...] }
// Thêm 1 hoặc nhiều face descriptor vào danh sách descriptors của SV
router.post('/:id/descriptors', (req, res) => {
  const { descriptor, descriptors: newDescriptors } = req.body;

  const row = db.prepare('SELECT face_descriptors FROM students WHERE id = ?')
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sinh viên không tồn tại' });

  const currentDescriptors = JSON.parse(row.face_descriptors || '[]');

  if (Array.isArray(newDescriptors) && newDescriptors.length > 0) {
    const valid = newDescriptors.filter(d => (Array.isArray(d) && d.length === 128) || (typeof d === 'object' && Object.keys(d).length === 128));
    if (valid.length === 0) {
      return res.status(400).json({ error: 'Không có descriptor 128-d hợp lệ trong danh sách' });
    }
    currentDescriptors.push(...valid);
  } else if (descriptor && ((Array.isArray(descriptor) && descriptor.length === 128) || (typeof descriptor === 'object' && Object.keys(descriptor).length === 128))) {
    currentDescriptors.push(Array.isArray(descriptor) ? descriptor : Object.values(descriptor));
  } else {
    return res.status(400).json({
      error: 'descriptor phải là mảng 128 số (Float32Array từ face-api.js) hoặc mảng descriptors',
    });
  }

  db.prepare('UPDATE students SET face_descriptors = ? WHERE id = ?')
    .run(JSON.stringify(currentDescriptors), req.params.id);

  broadcastAttendanceEvent('students_updated', { action: 'descriptors', id: req.params.id });

  res.json({
    message: `Đã nạp thành công dữ liệu khuôn mặt (tổng: ${currentDescriptors.length} mẫu)`,
    count: currentDescriptors.length,
  });
});

// ── DELETE /api/students/:id/descriptors ─────────────────
// Xóa tất cả face descriptors của 1 SV để đăng ký lại từ đầu
router.delete('/:id/descriptors', (req, res) => {
  const row = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sinh viên không tồn tại' });

  db.prepare('UPDATE students SET face_descriptors = ? WHERE id = ?')
    .run('[]', req.params.id);

  broadcastAttendanceEvent('students_updated', { action: 'descriptors', id: req.params.id });

  res.json({
    message: 'Đã xóa toàn bộ dữ liệu khuôn mặt của sinh viên',
    count: 0,
  });
});

// ── POST /api/students/:id/avatar ────────────────────────
// Multipart form upload ảnh chân dung
router.post('/:id/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file ảnh được gửi' });
  }

  const avatarPath = req.file.path;
  db.prepare('UPDATE students SET avatar_path = ? WHERE id = ?')
    .run(avatarPath, req.params.id);

  broadcastAttendanceEvent('students_updated', { action: 'avatar', id: req.params.id });

  res.json({
    message: 'Đã upload ảnh chân dung',
    avatar: `/uploads/${req.file.filename}`,
  });
});

export default router;
