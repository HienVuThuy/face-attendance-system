// ============================================================
// seed.js — Khởi tạo dữ liệu mẫu cho Database SQLite
// ============================================================

import db from './database.js';

console.log('🌱 Đang nạp dữ liệu mẫu vào SQLite Database...');

// 1. Danh sách sinh viên mẫu
const initialStudents = [
  { id: 'B21DCCN001', name: 'Nguyễn Văn An', lop: 'D21CQCN01-B' },
  { id: 'B21DCCN002', name: 'Trần Thị Bích', lop: 'D21CQCN01-B' },
  { id: 'B21DCCN003', name: 'Lê Hoàng Cường', lop: 'D21CQCN02-B' },
  { id: 'B21DCCN004', name: 'Phạm Minh Đức', lop: 'D21CQCN01-B' },
  { id: 'B21DCCN005', name: 'Vũ Thùy Hiền', lop: 'D21CQCN02-B' },
  { id: 'B21DCCN006', name: 'Hoàng Gia Khiêm', lop: 'D21CQCN01-B' },
  { id: 'B21DCCN007', name: 'Đỗ Thanh Lam', lop: 'D21CQCN03-B' },
  { id: 'B21DCCN008', name: 'Bùi Xuân Mai', lop: 'D21CQCN02-B' },
  { id: 'B21DCCN009', name: 'Ngô Quốc Nam', lop: 'D21CQCN03-B' },
  { id: 'B21DCCN010', name: 'Trịnh Hải Phong', lop: 'D21CQCN01-B' },
  { id: 'B21DCCN011', name: 'Dương Minh Quân', lop: 'D21CQCN02-B' },
  { id: 'B21DCCN012', name: 'Lý Thị Rạng', lop: 'D21CQCN03-B' },
  { id: 'B21DCCN013', name: 'Phan Đức Sơn', lop: 'D21CQCN01-B' },
  { id: 'B21DCCN014', name: 'Hồ Bảo Trâm', lop: 'D21CQCN02-B' },
  { id: 'B21DCCN015', name: 'Mai Anh Uyên', lop: 'D21CQCN03-B' },
  { id: 'B21DCCN016', name: 'Cao Thành Vinh', lop: 'D21CQCN01-B' },
  { id: 'B21DCCN017', name: 'Đinh Hồng Xuân', lop: 'D21CQCN02-B' },
  { id: 'B21DCCN018', name: 'Tô Khánh Yến', lop: 'D21CQCN03-B' },
];

const insertStudent = db.prepare(`
  INSERT OR REPLACE INTO students (id, name, lop, face_descriptors, avatar_path, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const studentTx = db.transaction((students) => {
  for (const s of students) {
    insertStudent.run(s.id, s.name, s.lop, '[]', null, Date.now() - Math.floor(Math.random() * 10000000));
  }
});
studentTx(initialStudents);
console.log(`✅ Đã nạp ${initialStudents.length} sinh viên.`);

// 1b. Thời khoá biểu (Ca học mẫu)
const initialSessions = [
  { name: 'Ca Sáng',  subject: 'Lập trình di động',    room: 'A2-301', day_of_week: 1, start_time: '07:00', end_time: '09:30', late_after: '07:15' },
  { name: 'Ca Chiều', subject: 'Mạng máy tính',        room: 'A2-302', day_of_week: 1, start_time: '13:00', end_time: '15:30', late_after: '13:15' },
  { name: 'Ca Sáng',  subject: 'Cơ sở dữ liệu',       room: 'B3-201', day_of_week: 2, start_time: '07:00', end_time: '09:30', late_after: '07:15' },
  { name: 'Ca Chiều', subject: 'Trí tuệ nhân tạo',     room: 'B3-202', day_of_week: 2, start_time: '13:00', end_time: '15:30', late_after: '13:15' },
  { name: 'Ca Sáng',  subject: 'Lập trình di động',    room: 'A2-301', day_of_week: 3, start_time: '07:00', end_time: '09:30', late_after: '07:15' },
  { name: 'Ca Sáng',  subject: 'Hệ điều hành',         room: 'C1-101', day_of_week: 4, start_time: '07:00', end_time: '09:30', late_after: '07:15' },
  { name: 'Ca Chiều', subject: 'Mạng máy tính',        room: 'A2-302', day_of_week: 4, start_time: '13:00', end_time: '15:30', late_after: '13:15' },
  { name: 'Ca Sáng',  subject: 'IoT & Hệ thống nhúng', room: 'D4-401', day_of_week: 5, start_time: '07:00', end_time: '09:30', late_after: '07:15' },
];

const insertSession = db.prepare(`
  INSERT INTO sessions (name, subject, room, day_of_week, start_time, end_time, late_after, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const sessionTx = db.transaction((sessions) => {
  for (const s of sessions) {
    insertSession.run(s.name, s.subject, s.room, s.day_of_week, s.start_time, s.end_time, s.late_after, 1);
  }
});
sessionTx(initialSessions);
console.log(`✅ Đã nạp ${initialSessions.length} ca học (thời khoá biểu).`);

// 2. Lịch sử điểm danh 7 ngày
function daysAgo(n, h, m) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, Math.floor(Math.random() * 60), 0);
  return d.getTime();
}

const sampleLogs = [
  // Today (Day 0)
  { studentId: 'B21DCCN001', timestamp: daysAgo(0, 6, 55), status: 'on-time', confidence: 98.5 },
  { studentId: 'B21DCCN002', timestamp: daysAgo(0, 6, 58), status: 'on-time', confidence: 99.1 },
  { studentId: 'B21DCCN003', timestamp: daysAgo(0, 7, 2), status: 'on-time', confidence: 97.5 },
  { studentId: 'B21DCCN005', timestamp: daysAgo(0, 7, 22), status: 'late', confidence: 94.2 },
  { studentId: 'B21DCCN006', timestamp: daysAgo(0, 7, 5), status: 'on-time', confidence: 96.8 },
  { studentId: 'B21DCCN007', timestamp: daysAgo(0, 7, 35), status: 'late', confidence: 92.1 },
  { studentId: 'B21DCCN009', timestamp: daysAgo(0, 7, 0), status: 'on-time', confidence: 98.0 },
  { studentId: 'B21DCCN010', timestamp: daysAgo(0, 6, 50), status: 'on-time', confidence: 97.2 },
  { studentId: 'B21DCCN011', timestamp: daysAgo(0, 7, 10), status: 'on-time', confidence: 98.7 },
  { studentId: 'B21DCCN013', timestamp: daysAgo(0, 7, 8), status: 'on-time', confidence: 95.3 },
  { studentId: 'B21DCCN014', timestamp: daysAgo(0, 7, 3), status: 'on-time', confidence: 96.5 },
  { studentId: 'B21DCCN015', timestamp: daysAgo(0, 7, 28), status: 'late', confidence: 93.4 },
  { studentId: 'B21DCCN016', timestamp: daysAgo(0, 7, 1), status: 'on-time', confidence: 97.9 },

  // Yesterday (Day 1)
  { studentId: 'B21DCCN001', timestamp: daysAgo(1, 6, 52), status: 'on-time', confidence: 98.2 },
  { studentId: 'B21DCCN002', timestamp: daysAgo(1, 7, 0), status: 'on-time', confidence: 99.0 },
  { studentId: 'B21DCCN003', timestamp: daysAgo(1, 7, 20), status: 'late', confidence: 95.1 },
  { studentId: 'B21DCCN005', timestamp: daysAgo(1, 7, 5), status: 'on-time', confidence: 96.3 },
  { studentId: 'B21DCCN006', timestamp: daysAgo(1, 7, 12), status: 'on-time', confidence: 97.4 },
  { studentId: 'B21DCCN009', timestamp: daysAgo(1, 6, 58), status: 'on-time', confidence: 98.1 },
  { studentId: 'B21DCCN010', timestamp: daysAgo(1, 7, 25), status: 'late', confidence: 94.0 },
  { studentId: 'B21DCCN011', timestamp: daysAgo(1, 7, 3), status: 'on-time', confidence: 98.6 },
  { studentId: 'B21DCCN013', timestamp: daysAgo(1, 7, 8), status: 'on-time', confidence: 95.8 },
  { studentId: 'B21DCCN014', timestamp: daysAgo(1, 7, 1), status: 'on-time', confidence: 97.0 },
  { studentId: 'B21DCCN016', timestamp: daysAgo(1, 7, 32), status: 'late', confidence: 92.5 },

  // 2 days ago
  { studentId: 'B21DCCN001', timestamp: daysAgo(2, 6, 55), status: 'on-time', confidence: 98.4 },
  { studentId: 'B21DCCN002', timestamp: daysAgo(2, 7, 14), status: 'on-time', confidence: 98.9 },
  { studentId: 'B21DCCN003', timestamp: daysAgo(2, 7, 0), status: 'on-time', confidence: 97.1 },
  { studentId: 'B21DCCN006', timestamp: daysAgo(2, 7, 10), status: 'on-time', confidence: 96.5 },
  { studentId: 'B21DCCN007', timestamp: daysAgo(2, 7, 28), status: 'late', confidence: 93.0 },
  { studentId: 'B21DCCN009', timestamp: daysAgo(2, 6, 50), status: 'on-time', confidence: 98.3 },
  { studentId: 'B21DCCN011', timestamp: daysAgo(2, 7, 5), status: 'on-time', confidence: 98.5 },
  { studentId: 'B21DCCN013', timestamp: daysAgo(2, 7, 2), status: 'on-time', confidence: 95.0 },
  { studentId: 'B21DCCN015', timestamp: daysAgo(2, 7, 18), status: 'late', confidence: 94.5 },

  // 3 days ago
  { studentId: 'B21DCCN001', timestamp: daysAgo(3, 7, 2), status: 'on-time', confidence: 97.9 },
  { studentId: 'B21DCCN002', timestamp: daysAgo(3, 7, 0), status: 'on-time', confidence: 99.2 },
  { studentId: 'B21DCCN005', timestamp: daysAgo(3, 7, 22), status: 'late', confidence: 93.8 },
  { studentId: 'B21DCCN006', timestamp: daysAgo(3, 7, 8), status: 'on-time', confidence: 97.0 },
  { studentId: 'B21DCCN009', timestamp: daysAgo(3, 6, 55), status: 'on-time', confidence: 98.0 },
  { studentId: 'B21DCCN010', timestamp: daysAgo(3, 7, 15), status: 'on-time', confidence: 96.2 },
  { studentId: 'B21DCCN014', timestamp: daysAgo(3, 7, 30), status: 'late', confidence: 92.7 },
  { studentId: 'B21DCCN016', timestamp: daysAgo(3, 7, 1), status: 'on-time', confidence: 97.5 },

  // 4 days ago
  { studentId: 'B21DCCN001', timestamp: daysAgo(4, 6, 58), status: 'on-time', confidence: 98.6 },
  { studentId: 'B21DCCN003', timestamp: daysAgo(4, 7, 5), status: 'on-time', confidence: 97.3 },
  { studentId: 'B21DCCN005', timestamp: daysAgo(4, 7, 18), status: 'late', confidence: 94.1 },
  { studentId: 'B21DCCN007', timestamp: daysAgo(4, 7, 0), status: 'on-time', confidence: 96.8 },
  { studentId: 'B21DCCN010', timestamp: daysAgo(4, 6, 52), status: 'on-time', confidence: 97.5 },
  { studentId: 'B21DCCN011', timestamp: daysAgo(4, 7, 12), status: 'on-time', confidence: 98.4 },
  { studentId: 'B21DCCN013', timestamp: daysAgo(4, 7, 25), status: 'late', confidence: 93.2 },

  // 5 days ago
  { studentId: 'B21DCCN001', timestamp: daysAgo(5, 7, 0), status: 'on-time', confidence: 98.1 },
  { studentId: 'B21DCCN002', timestamp: daysAgo(5, 7, 3), status: 'on-time', confidence: 98.8 },
  { studentId: 'B21DCCN006', timestamp: daysAgo(5, 7, 20), status: 'late', confidence: 94.7 },
  { studentId: 'B21DCCN009', timestamp: daysAgo(5, 7, 8), status: 'on-time', confidence: 97.8 },
  { studentId: 'B21DCCN014', timestamp: daysAgo(5, 7, 15), status: 'on-time', confidence: 96.9 },
  { studentId: 'B21DCCN015', timestamp: daysAgo(5, 6, 55), status: 'on-time', confidence: 98.5 },
  { studentId: 'B21DCCN016', timestamp: daysAgo(5, 7, 30), status: 'late', confidence: 92.9 },

  // 6 days ago
  { studentId: 'B21DCCN001', timestamp: daysAgo(6, 6, 50), status: 'on-time', confidence: 98.7 },
  { studentId: 'B21DCCN003', timestamp: daysAgo(6, 7, 10), status: 'on-time', confidence: 97.6 },
  { studentId: 'B21DCCN005', timestamp: daysAgo(6, 7, 5), status: 'on-time', confidence: 96.5 },
  { studentId: 'B21DCCN007', timestamp: daysAgo(6, 7, 28), status: 'late', confidence: 93.5 },
  { studentId: 'B21DCCN010', timestamp: daysAgo(6, 7, 0), status: 'on-time', confidence: 98.0 },
  { studentId: 'B21DCCN011', timestamp: daysAgo(6, 7, 3), status: 'on-time', confidence: 98.2 },
  { studentId: 'B21DCCN013', timestamp: daysAgo(6, 7, 22), status: 'late', confidence: 94.0 },
];

db.prepare('DELETE FROM attendance_logs').run();

const insertLog = db.prepare(`
  INSERT INTO attendance_logs (student_id, timestamp, status, confidence)
  VALUES (?, ?, ?, ?)
`);

const logTx = db.transaction((logs) => {
  for (const l of logs) {
    insertLog.run(l.studentId, l.timestamp, l.status, l.confidence);
  }
});
logTx(sampleLogs);
console.log(`✅ Đã nạp ${sampleLogs.length} bản ghi điểm danh 7 ngày.`);

console.log('✨ Seed dữ liệu hoàn tất!');
