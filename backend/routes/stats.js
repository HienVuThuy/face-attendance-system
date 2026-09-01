// ============================================================
// routes/stats.js — API Thống kê cho Dashboard & Báo cáo
// ============================================================
// ★ FIX: Đếm theo DISTINCT student_id (mỗi SV chỉ tính 1 lần/ngày)
//    thay vì COUNT(*) (đếm số dòng log, gây trùng lặp)
// ============================================================

import { Router } from 'express';
import db from '../database.js';

const router = Router();

const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Helper: Đếm số sinh viên duy nhất có mặt hôm nay theo trạng thái.
 * Mỗi SV chỉ tính 1 lần dù điểm danh nhiều ca.
 * Trạng thái ưu tiên: nếu có ít nhất 1 lần on-time → tính on-time, ngược lại tính late.
 */
function countUniqueStudentsByDay(startTs, endTs) {
  // Lấy tất cả log trong ngày
  const allLogs = db.prepare(`
    SELECT student_id, status
    FROM attendance_logs
    WHERE timestamp >= ? AND timestamp <= ?
  `).all(startTs, endTs);

  // Gom theo student_id, ưu tiên on-time
  const studentMap = {};
  allLogs.forEach(log => {
    if (!studentMap[log.student_id]) {
      studentMap[log.student_id] = log.status;
    } else if (log.status === 'on-time') {
      // Nếu có ít nhất 1 lần đúng giờ → tính là đúng giờ
      studentMap[log.student_id] = 'on-time';
    }
  });

  let onTime = 0;
  let late = 0;
  Object.values(studentMap).forEach(status => {
    if (status === 'on-time') onTime++;
    else if (status === 'late') late++;
  });

  const uniqueCheckins = Object.keys(studentMap).length;
  return { onTime, late, uniqueCheckins };
}

// ── GET /api/stats/dashboard ─────────────────────────────
// Trả về số liệu tổng quan hôm nay và so sánh với hôm qua (tính trend %)
// ★ Đếm theo số SV duy nhất, không phải số dòng log
router.get('/dashboard', (req, res) => {
  const totalStudents = db.prepare('SELECT COUNT(*) AS count FROM students').get().count;

  // Thời gian bắt đầu và kết thúc của hôm nay (local time)
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 86400000 - 1;

  // Thời gian bắt đầu và kết thúc của hôm qua
  const startYesterday = startToday - 86400000;
  const endYesterday = startToday - 1;

  // Điểm danh hôm nay — đếm theo SV duy nhất
  const today = countUniqueStudentsByDay(startToday, endToday);
  const checkinsToday = today.uniqueCheckins;
  const onTimeToday = today.onTime;
  const lateToday = today.late;
  const absentToday = Math.max(totalStudents - checkinsToday, 0);

  // Điểm danh hôm qua — đếm theo SV duy nhất
  const yesterday = countUniqueStudentsByDay(startYesterday, endYesterday);
  const checkinsYesterday = yesterday.uniqueCheckins;
  const absentYesterday = Math.max(totalStudents - checkinsYesterday, 0);

  // Tính trend % (tăng/giảm so với hôm qua)
  const calcTrend = (todayVal, yesterdayVal) => {
    if (yesterdayVal === 0) return todayVal > 0 ? 100 : 0;
    return Math.round(((todayVal - yesterdayVal) / yesterdayVal) * 100);
  };

  const trendCheckin = calcTrend(checkinsToday, checkinsYesterday);
  const trendAbsent = calcTrend(absentToday, absentYesterday);
  const trendLate = calcTrend(lateToday, yesterday.late);

  res.json({
    totalStudents,
    todayCheckins: checkinsToday,
    onTimeToday,
    lateToday,
    absentToday,
    trends: {
      totalStudents: 5,
      todayCheckins: trendCheckin,
      absentToday: trendAbsent,
      lateToday: trendLate,
    }
  });
});

// ── GET /api/stats/weekly ────────────────────────────────
// Trả về dữ liệu 7 ngày gần nhất cho BarChart
// ★ Đếm theo số SV duy nhất mỗi ngày
router.get('/weekly', (req, res) => {
  const totalStudents = db.prepare('SELECT COUNT(*) AS count FROM students').get().count;
  const data = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const startDay = d.getTime();
    const endDay = startDay + 86400000 - 1;

    const dayLabel = dayNames[d.getDay()];
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;

    const dayStats = countUniqueStudentsByDay(startDay, endDay);
    const absent = Math.max(totalStudents - dayStats.uniqueCheckins, 0);

    data.push({
      day: `${dayLabel} ${dateStr}`,
      'Đúng giờ': dayStats.onTime,
      'Đi muộn': dayStats.late,
      'Vắng mặt': absent,
    });
  }

  res.json(data);
});

// ── GET /api/stats/distribution ──────────────────────────
// Phân bố tỷ lệ đúng giờ / đi muộn / vắng mặt cho PieChart
// ★ Đếm theo SV duy nhất trong 7 ngày gần nhất
router.get('/distribution', (req, res) => {
  const totalStudents = db.prepare('SELECT COUNT(*) AS count FROM students').get().count;

  const now = new Date();
  const start7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + 86400000 - 1;

  // Gom theo student_id trên toàn bộ 7 ngày
  const allLogs = db.prepare(`
    SELECT student_id, status
    FROM attendance_logs
    WHERE timestamp >= ? AND timestamp <= ?
  `).all(start7Days, endToday);

  const studentMap = {};
  allLogs.forEach(log => {
    if (!studentMap[log.student_id]) {
      studentMap[log.student_id] = log.status;
    } else if (log.status === 'on-time') {
      studentMap[log.student_id] = 'on-time';
    }
  });

  let onTime = 0;
  let late = 0;
  Object.values(studentMap).forEach(status => {
    if (status === 'on-time') onTime++;
    else if (status === 'late') late++;
  });

  const totalChecked = onTime + late;
  const absent = Math.max(totalStudents - totalChecked, 0);

  res.json([
    { name: 'Đúng giờ', value: onTime || 0, color: '#10b981' },
    { name: 'Đi muộn', value: late || 0, color: '#f59e0b' },
    { name: 'Vắng mặt', value: absent || 0, color: '#ef4444' },
  ]);
});

// ── GET /api/stats/timesheet ─────────────────────────────
// Query: ?month=0..11&year=2026
// ★ Đếm số NGÀY duy nhất SV có mặt (không phải số dòng log)
router.get('/timesheet', (req, res) => {
  const now = new Date();
  const month = req.query.month !== undefined ? Number(req.query.month) : now.getMonth();
  const year = req.query.year !== undefined ? Number(req.query.year) : now.getFullYear();

  const startMonth = new Date(year, month, 1).getTime();
  const endMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

  const students = db.prepare('SELECT id, name, lop, avatar_path FROM students ORDER BY id ASC').all();
  const totalDays = 22; // Số ngày công chuẩn của tháng

  const result = students.map(s => {
    // Lấy tất cả log của SV trong tháng
    const logs = db.prepare(`
      SELECT timestamp, status
      FROM attendance_logs
      WHERE student_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `).all(s.id, startMonth, endMonth);

    // Gom theo NGÀY (mỗi ngày chỉ tính 1 lần, ưu tiên on-time)
    const dayMap = {};
    logs.forEach(log => {
      const logDate = new Date(Number(log.timestamp));
      const dayKey = `${logDate.getFullYear()}-${logDate.getMonth()}-${logDate.getDate()}`;
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = log.status;
      } else if (log.status === 'on-time') {
        dayMap[dayKey] = 'on-time';
      }
    });

    let present = 0;
    let late = 0;
    Object.values(dayMap).forEach(status => {
      if (status === 'on-time') present++;
      else if (status === 'late') late++;
    });

    const absent = Math.max(totalDays - present - late, 0);
    const rate = Math.min(Math.round(((present + late) / totalDays) * 100), 100);

    return {
      id: s.id,
      name: s.name,
      lop: s.lop,
      present,
      late,
      absent,
      rate,
      totalDays,
    };
  });

  res.json(result);
});

export default router;
