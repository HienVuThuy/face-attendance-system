// ============================================================
// database.js — Kết nối Cơ sở dữ liệu XAMPP MySQL (MariaDB)
// ============================================================
// Cấu hình chuẩn XAMPP:
//   Host: 127.0.0.1
//   Port: 3306
//   User: root
//   Password: (rỗng theo mặc định XAMPP)
//   Database: iot_attendance
// ============================================================

import mysql from 'mysql2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'attendance_db.json');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'iot_attendance',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const DEFAULT_SETTINGS = {
  espCamIp: '192.168.100.178',
  faceThreshold: '0.5',
  language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
};

const DEFAULT_SESSIONS = [
  { id: 1, name: 'Ca Sáng', subject: 'Lập trình di động', room: 'A2-301', day_of_week: 1, start_time: '07:00', end_time: '09:30', late_after: '07:15', is_active: 1 },
  { id: 2, name: 'Ca Chiều', subject: 'Mạng máy tính', room: 'A2-302', day_of_week: 1, start_time: '13:00', end_time: '15:30', late_after: '13:15', is_active: 1 },
  { id: 3, name: 'Ca Sáng', subject: 'Cơ sở dữ liệu', room: 'B3-201', day_of_week: 2, start_time: '07:00', end_time: '09:30', late_after: '07:15', is_active: 1 },
  { id: 4, name: 'Ca Chiều', subject: 'Trí tuệ nhân tạo', room: 'B3-202', day_of_week: 2, start_time: '13:00', end_time: '15:30', late_after: '13:15', is_active: 1 },
  { id: 5, name: 'Ca Sáng', subject: 'Lập trình di động', room: 'A2-301', day_of_week: 3, start_time: '07:00', end_time: '09:30', late_after: '07:15', is_active: 1 },
  { id: 6, name: 'Ca Sáng', subject: 'Hệ điều hành', room: 'C1-101', day_of_week: 4, start_time: '07:00', end_time: '09:30', late_after: '07:15', is_active: 1 },
  { id: 7, name: 'Ca Chiều', subject: 'Mạng máy tính', room: 'A2-302', day_of_week: 4, start_time: '13:00', end_time: '15:30', late_after: '13:15', is_active: 1 },
  { id: 8, name: 'Ca Sáng', subject: 'IoT & Hệ thống nhúng', room: 'D4-401', day_of_week: 5, start_time: '07:00', end_time: '09:30', late_after: '07:15', is_active: 1 },
];

// Bộ nhớ đệm file dự phòng nếu MySQL chưa khởi động
let memoryData = {
  students: [],
  attendance_logs: [],
  sessions: [...DEFAULT_SESSIONS],
  settings: { ...DEFAULT_SETTINGS },
  nextLogId: 1,
  nextSessionId: 9,
};

function loadMemoryData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const parsedSessions = parsed.sessions && parsed.sessions.length > 0 ? parsed.sessions : DEFAULT_SESSIONS;
      memoryData = {
        students: parsed.students || [],
        attendance_logs: parsed.attendance_logs || [],
        sessions: parsedSessions,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        nextLogId: parsed.nextLogId || (parsed.attendance_logs ? parsed.attendance_logs.length + 1 : 1),
        nextSessionId: parsed.nextSessionId || (parsedSessions.length + 1),
      };
    }
  } catch (err) {
    console.error('File cache fallback error:', err.message);
  }
}
function saveMemoryData() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryData, null, 2), 'utf-8');
  } catch { }
}
loadMemoryData();

let isMysqlConnected = false;
let pool = null;

// Thử tạo database & bảng trên XAMPP MySQL
try {
  const rootConn = mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
  });

  rootConn.connect((err) => {
    if (err) {
      console.log('⚠️ [XAMPP MySQL] Chưa thể kết nối MySQL (Port 3306). Đang dùng chế độ bộ nhớ đệm JSON. Hãy bật "Start MySQL" trên XAMPP Control Panel.');
      isMysqlConnected = false;
    } else {
      console.log('✅ [XAMPP MySQL] Đã kết nối thành công tới MySQL Server (Port 3306)!');
      rootConn.query('CREATE DATABASE IF NOT EXISTS `iot_attendance` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', (err2) => {
        if (!err2) {
          initMysqlTables();
        }
        rootConn.end();
      });
    }
  });
} catch (e) {
  console.log('⚠️ [XAMPP MySQL] ' + e.message);
}

function initMysqlTables() {
  pool = mysql.createPool(DB_CONFIG);
  isMysqlConnected = true;

  const createStudents = `
    CREATE TABLE IF NOT EXISTS \`students\` (
      \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL,
      \`lop\` VARCHAR(50) NOT NULL DEFAULT '',
      \`face_descriptors\` LONGTEXT DEFAULT NULL,
      \`avatar_path\` VARCHAR(255) DEFAULT NULL,
      \`created_at\` BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const createSessions = `
    CREATE TABLE IF NOT EXISTS \`sessions\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(100) NOT NULL,
      \`subject\` VARCHAR(150) NOT NULL,
      \`room\` VARCHAR(50) DEFAULT '',
      \`day_of_week\` TINYINT NOT NULL,
      \`start_time\` VARCHAR(5) NOT NULL,
      \`end_time\` VARCHAR(5) NOT NULL,
      \`late_after\` VARCHAR(5) DEFAULT NULL,
      \`is_active\` TINYINT NOT NULL DEFAULT 1,
      INDEX \`idx_day\` (\`day_of_week\`),
      INDEX \`idx_active\` (\`is_active\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const createLogs = `
    CREATE TABLE IF NOT EXISTS \`attendance_logs\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`timestamp\` BIGINT NOT NULL,
      \`status\` ENUM('on-time', 'late') NOT NULL DEFAULT 'on-time',
      \`confidence\` FLOAT DEFAULT NULL,
      \`session_id\` INT DEFAULT NULL,
      INDEX \`idx_timestamp\` (\`timestamp\`),
      INDEX \`idx_student_id\` (\`student_id\`),
      INDEX \`idx_session_id\` (\`session_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Thêm cột session_id vào bảng attendance_logs cũ (nếu đã tồn tại nhưng chưa có cột này)
  const addSessionIdCol = `
    ALTER TABLE \`attendance_logs\` ADD COLUMN \`session_id\` INT DEFAULT NULL;
  `;

  const createSettings = `
    CREATE TABLE IF NOT EXISTS \`settings\` (
      \`key\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`value\` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  pool.query(createStudents);
  pool.query(createSessions);
  pool.query(createLogs);
  pool.query(addSessionIdCol, () => { }); // Bỏ qua lỗi nếu cột đã tồn tại
  pool.query(createSettings);

  // Sync default settings
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    pool.query('INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)', [k, String(v)]);
  }

  // Đồng bộ 2 chiều: Nạp từ MySQL vào memoryData nếu MySQL đã có dữ liệu, ngược lại đẩy từ memoryData lên MySQL
  pool.query('SELECT COUNT(*) as count FROM students', (err, results) => {
    if (err) return;

    const mysqlStudentCount = results && results[0] ? results[0].count : 0;

    if (mysqlStudentCount > 0) {
      // 1. MySQL đã có dữ liệu -> Nạp từ MySQL vào memoryData & lưu file JSON dự phòng
      pool.query('SELECT * FROM students', (errS, students) => {
        if (!errS && students) {
          memoryData.students = students.map(s => ({
            ...s,
            created_at: Number(s.created_at) || Date.now(),
          }));
        }

        pool.query('SELECT * FROM attendance_logs ORDER BY timestamp ASC', (errL, logs) => {
          if (!errL && logs) {
            memoryData.attendance_logs = logs.map(l => ({
              ...l,
              timestamp: Number(l.timestamp),
              session_id: l.session_id || null,
            }));
            const maxId = logs.reduce((max, l) => Math.max(max, l.id || 0), 0);
            memoryData.nextLogId = maxId + 1;
          }

          pool.query('SELECT * FROM sessions', (errSess, sessions) => {
            if (!errSess && sessions && sessions.length > 0) {
              memoryData.sessions = sessions.map(s => ({ ...s }));
              const maxSessId = sessions.reduce((max, s) => Math.max(max, s.id || 0), 0);
              memoryData.nextSessionId = maxSessId + 1;
            } else {
              // Bảng sessions trên MySQL đang trống -> Đồng bộ DEFAULT_SESSIONS lên MySQL
              console.log(`📥 [XAMPP MySQL] Đang nạp ${DEFAULT_SESSIONS.length} ca học mặc định vào MySQL...`);
              for (const sess of DEFAULT_SESSIONS) {
                pool.query(
                  'INSERT INTO sessions (id, name, subject, room, day_of_week, start_time, end_time, late_after, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [sess.id, sess.name, sess.subject, sess.room, sess.day_of_week, sess.start_time, sess.end_time, sess.late_after, sess.is_active]
                );
              }
              memoryData.sessions = [...DEFAULT_SESSIONS];
              memoryData.nextSessionId = 9;
            }

            pool.query('SELECT * FROM settings', (errSet, settings) => {
              if (!errSet && settings) {
                settings.forEach(row => {
                  memoryData.settings[row.key] = row.value;
                });
              }
              saveMemoryData();
              console.log(`✅ [XAMPP MySQL] Đã nạp ${memoryData.students.length} sinh viên, ${memoryData.sessions.length} ca học & ${memoryData.attendance_logs.length} lượt điểm danh từ MySQL!`);
            });
          });
        });
      });
    } else if (memoryData.students.length > 0) {
      // 2. MySQL vừa tạo mới và đang trống -> Đồng bộ từ file JSON dự phòng lên MySQL
      console.log(`📥 [XAMPP MySQL] Đang đồng bộ ${memoryData.students.length} sinh viên từ file JSON vào MySQL database 'iot_attendance'...`);
      for (const s of memoryData.students) {
        pool.query(
          'INSERT INTO students (id, name, lop, face_descriptors, avatar_path, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [s.id, s.name, s.lop, s.face_descriptors, s.avatar_path, s.created_at]
        );
      }
      for (const l of memoryData.attendance_logs) {
        pool.query(
          'INSERT INTO attendance_logs (id, student_id, timestamp, status, confidence, session_id) VALUES (?, ?, ?, ?, ?, ?)',
          [l.id, l.student_id, l.timestamp, l.status, l.confidence, l.session_id || null]
        );
      }
      for (const sess of memoryData.sessions) {
        pool.query(
          'INSERT INTO sessions (id, name, subject, room, day_of_week, start_time, end_time, late_after, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [sess.id, sess.name, sess.subject, sess.room, sess.day_of_week, sess.start_time, sess.end_time, sess.late_after, sess.is_active]
        );
      }
      console.log('✅ [XAMPP MySQL] Đồng bộ hoàn tất!');
    }
  });
}

// ============================================================
// Adapter Database API
// ============================================================

class UnifiedDatabase {
  prepare(sql) {
    const cleanSql = sql.trim().replace(/\s+/g, ' ');

    return {
      all: (...params) => this._executeAll(cleanSql, params),
      get: (...params) => {
        const rows = this._executeAll(cleanSql, params);
        return rows.length > 0 ? rows[0] : undefined;
      },
      run: (...params) => this._executeRun(cleanSql, params),
    };
  }

  transaction(fn) {
    return (...args) => {
      const res = fn(...args);
      saveMemoryData();
      return res;
    };
  }

  _executeAll(sql, params) {
    // 1. SELECT students
    if (sql.includes('FROM students')) {
      if (sql.includes('COUNT(*)')) {
        return [{ count: memoryData.students.length }];
      }

      if (sql.includes('WHERE id = ?')) {
        const id = params[0];
        const s = memoryData.students.find(x => x.id === id);
        return s ? [s] : [];
      }

      let res = [...memoryData.students];
      if (sql.includes('name LIKE ?')) {
        const kw = (params[0] || '').replace(/%/g, '').toLowerCase();
        res = res.filter(s =>
          s.name.toLowerCase().includes(kw) ||
          s.id.toLowerCase().includes(kw) ||
          (s.lop && s.lop.toLowerCase().includes(kw))
        );
      }
      return res.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    }

    // 2. SELECT settings
    if (sql.includes('FROM settings')) {
      if (sql.includes('WHERE key = ?')) {
        const key = params[0];
        const val = memoryData.settings[key];
        return val !== undefined ? [{ key, value: String(val) }] : [];
      }
      return Object.entries(memoryData.settings).map(([k, v]) => ({ key: k, value: String(v) }));
    }

    // 3. SELECT sessions
    if (sql.includes('FROM sessions')) {
      if (sql.includes('WHERE id = ?')) {
        const id = Number(params[0]);
        const sess = memoryData.sessions.find(s => s.id === id);
        return sess ? [sess] : [];
      }

      let result = [...memoryData.sessions];

      if (sql.includes('day_of_week = ?')) {
        const day = Number(params[0]);
        result = result.filter(s => s.day_of_week === day);
      }

      if (sql.includes('is_active = 1')) {
        result = result.filter(s => s.is_active === 1 || s.is_active === true);
      }

      if (sql.includes('start_time <= ?') && sql.includes('end_time >= ?')) {
        const timeIdx = sql.includes('day_of_week = ?') ? 1 : 0;
        const currentTime = params[timeIdx];
        result = result.filter(s => s.start_time <= currentTime && s.end_time >= currentTime);
      }

      return result;
    }

    // 4. SELECT attendance_logs
    if (sql.includes('FROM attendance_logs')) {
      if (sql.includes('GROUP BY status')) {
        let logs = memoryData.attendance_logs;

        if (sql.includes('student_id = ?') && sql.includes('timestamp >= ?')) {
          const studentId = params[0];
          const startTs = params[1];
          const endTs = params[2];
          logs = logs.filter(l => l.student_id === studentId && l.timestamp >= startTs && l.timestamp <= endTs);
        } else if (sql.includes('timestamp >= ?') && sql.includes('timestamp <= ?')) {
          const startTs = params[0];
          const endTs = params[1];
          logs = logs.filter(l => l.timestamp >= startTs && l.timestamp <= endTs);
        }

        const counts = {};
        logs.forEach(l => {
          counts[l.status] = (counts[l.status] || 0) + 1;
        });
        return Object.entries(counts).map(([status, count]) => ({ status, count }));
      }

      if (sql.includes('60000')) {
        const studentId = params[0];
        const logTime = params[1];
        const recent = memoryData.attendance_logs
          .filter(l => l.student_id === studentId && (logTime - l.timestamp) < 60000 && (logTime - l.timestamp) >= 0)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        return recent ? [recent] : [];
      }

      if (sql.includes('WHERE id = ?')) {
        const id = Number(params[0]);
        const log = memoryData.attendance_logs.find(l => l.id === id);
        return log ? [log] : [];
      }

      let result = memoryData.attendance_logs.map(l => {
        const student = memoryData.students.find(s => s.id === l.student_id) || {};
        const session = l.session_id ? memoryData.sessions.find(s => s.id === l.session_id) : null;
        return {
          id: l.id,
          studentId: l.student_id,
          name: student.name || 'Không xác định',
          lop: student.lop || '',
          timestamp: l.timestamp,
          status: l.status,
          confidence: l.confidence,
          session_id: l.session_id || null,
          sessionName: session ? session.name : null,
          subject: session ? session.subject : null,
          room: session ? session.room : null,
        };
      });

      if (sql.includes('s.name LIKE ?')) {
        const kw = (params[0] || '').replace(/%/g, '').toLowerCase();
        result = result.filter(l =>
          l.name.toLowerCase().includes(kw) ||
          l.studentId.toLowerCase().includes(kw) ||
          l.lop.toLowerCase().includes(kw)
        );
      }

      if (sql.includes('l.status = ?')) {
        const statusIdx = sql.indexOf('s.name LIKE ?') !== -1 ? 3 : 0;
        const targetStatus = params[statusIdx];
        if (targetStatus && targetStatus !== 'all') {
          result = result.filter(l => l.status === targetStatus);
        }
      }

      if (sql.includes('l.timestamp >= ?')) {
        const fromTs = params.find(p => typeof p === 'number' && p > 1000000000000);
        if (fromTs) {
          result = result.filter(l => l.timestamp >= fromTs);
        }
      }

      if (sql.includes('l.timestamp <= ?')) {
        const toTs = params.filter(p => typeof p === 'number' && p > 1000000000000).slice(-1)[0];
        if (toTs) {
          result = result.filter(l => l.timestamp <= toTs);
        }
      }

      result.sort((a, b) => b.timestamp - a.timestamp);

      if (sql.includes('LIMIT ? OFFSET ?')) {
        const limit = params[params.length - 2] || 500;
        const offset = params[params.length - 1] || 0;
        result = result.slice(offset, offset + limit);
      }

      return result;
    }

    return [];
  }

  _executeRun(sql, params) {
    if (sql.startsWith('INSERT INTO students') || sql.startsWith('INSERT OR REPLACE INTO students')) {
      const [id, name, lop, face_descriptors, avatar_path, created_at] = params;
      const existingIdx = memoryData.students.findIndex(s => s.id === id);
      const studentObj = {
        id,
        name,
        lop: lop || '',
        face_descriptors: face_descriptors || '[]',
        avatar_path: avatar_path || null,
        created_at: created_at || Date.now(),
      };

      if (existingIdx >= 0) {
        memoryData.students[existingIdx] = studentObj;
      } else {
        memoryData.students.push(studentObj);
      }
      saveMemoryData();

      if (isMysqlConnected && pool) {
        pool.query(
          'INSERT INTO students (id, name, lop, face_descriptors, avatar_path, created_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), lop=VALUES(lop), face_descriptors=VALUES(face_descriptors), avatar_path=VALUES(avatar_path)',
          [id, name, lop, face_descriptors, avatar_path, created_at || Date.now()]
        );
      }
      return { changes: 1 };
    }

    if (sql.startsWith('UPDATE students')) {
      const id = params[params.length - 1];
      const student = memoryData.students.find(s => s.id === id);
      if (!student) return { changes: 0 };

      const setMatch = sql.match(/SET (.+?) WHERE/i);
      if (setMatch) {
        const parts = setMatch[1].split(',').map(p => p.trim());
        parts.forEach((part, index) => {
          if (part.includes('name = ?')) student.name = params[index];
          if (part.includes('lop = ?')) student.lop = params[index];
          if (part.includes('avatar_path = ?')) student.avatar_path = params[index];
          if (part.includes('face_descriptors = ?')) student.face_descriptors = params[index];
        });
      }
      saveMemoryData();

      if (isMysqlConnected && pool) {
        pool.query('UPDATE students SET name = ?, lop = ?, avatar_path = ?, face_descriptors = ? WHERE id = ?',
          [student.name, student.lop, student.avatar_path, student.face_descriptors, id]);
      }
      return { changes: 1 };
    }

    if (sql.startsWith('DELETE FROM students')) {
      const id = params[0];
      const initLen = memoryData.students.length;
      memoryData.students = memoryData.students.filter(s => s.id !== id);
      memoryData.attendance_logs = memoryData.attendance_logs.filter(l => l.student_id !== id);
      saveMemoryData();

      if (isMysqlConnected && pool) {
        pool.query('DELETE FROM students WHERE id = ?', [id]);
      }
      return { changes: initLen - memoryData.students.length };
    }

    if (sql.startsWith('INSERT INTO attendance_logs')) {
      const [student_id, timestamp, status, confidence, session_id] = params;
      const logId = memoryData.nextLogId++;
      const newLog = {
        id: logId,
        student_id,
        timestamp: Number(timestamp) || Date.now(),
        status: status || 'on-time',
        confidence: confidence !== undefined ? Number(confidence) : null,
        session_id: session_id || null,
      };
      memoryData.attendance_logs.unshift(newLog);
      saveMemoryData();

      if (isMysqlConnected && pool) {
        pool.query(
          'INSERT INTO attendance_logs (student_id, timestamp, status, confidence, session_id) VALUES (?, ?, ?, ?, ?)',
          [student_id, Number(timestamp) || Date.now(), status || 'on-time', confidence || null, session_id || null]
        );
      }
      return { changes: 1, lastInsertRowid: logId };
    }

    if (sql.startsWith('UPDATE attendance_logs')) {
      const id = Number(params[params.length - 1]);
      const log = memoryData.attendance_logs.find(l => l.id === id);
      if (!log) return { changes: 0 };

      if (sql.includes('status = ?') && sql.includes('timestamp = ?')) {
        log.status = params[0];
        log.timestamp = Number(params[1]);
      } else if (sql.includes('status = ?')) {
        log.status = params[0];
      } else if (sql.includes('timestamp = ?')) {
        log.timestamp = Number(params[0]);
      }
      saveMemoryData();

      if (isMysqlConnected && pool) {
        pool.query('UPDATE attendance_logs SET status = ?, timestamp = ? WHERE id = ?', [log.status, log.timestamp, id]);
      }
      return { changes: 1 };
    }

    if (sql.startsWith('DELETE FROM attendance_logs')) {
      if (sql.includes('WHERE id = ?')) {
        const id = Number(params[0]);
        const initLen = memoryData.attendance_logs.length;
        memoryData.attendance_logs = memoryData.attendance_logs.filter(l => l.id !== id);
        saveMemoryData();
        if (isMysqlConnected && pool) {
          pool.query('DELETE FROM attendance_logs WHERE id = ?', [id]);
        }
        return { changes: initLen - memoryData.attendance_logs.length };
      } else {
        const count = memoryData.attendance_logs.length;
        memoryData.attendance_logs = [];
        saveMemoryData();
        if (isMysqlConnected && pool) {
          pool.query('DELETE FROM attendance_logs');
        }
        return { changes: count };
      }
    }

    if (sql.startsWith('INSERT INTO sessions') || sql.startsWith('INSERT OR REPLACE INTO sessions')) {
      const [name, subject, room, day_of_week, start_time, end_time, late_after, is_active] = params;
      const sessId = memoryData.nextSessionId++;
      const sessObj = {
        id: sessId,
        name,
        subject,
        room: room || '',
        day_of_week: Number(day_of_week),
        start_time,
        end_time,
        late_after: late_after || null,
        is_active: is_active !== undefined ? Number(is_active) : 1,
      };
      memoryData.sessions.push(sessObj);
      saveMemoryData();

      if (isMysqlConnected && pool) {
        pool.query(
          'INSERT INTO sessions (name, subject, room, day_of_week, start_time, end_time, late_after, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [name, subject, room || '', Number(day_of_week), start_time, end_time, late_after || null, is_active !== undefined ? Number(is_active) : 1]
        );
      }
      return { changes: 1, lastInsertRowid: sessId };
    }

    if (sql.startsWith('UPDATE sessions')) {
      const id = Number(params[params.length - 1]);
      const sess = memoryData.sessions.find(s => s.id === id);
      if (!sess) return { changes: 0 };

      const setMatch = sql.match(/SET (.+?) WHERE/i);
      if (setMatch) {
        const parts = setMatch[1].split(',').map(p => p.trim());
        parts.forEach((part, index) => {
          if (part.includes('name = ?')) sess.name = params[index];
          if (part.includes('subject = ?')) sess.subject = params[index];
          if (part.includes('room = ?')) sess.room = params[index];
          if (part.includes('day_of_week = ?')) sess.day_of_week = Number(params[index]);
          if (part.includes('start_time = ?')) sess.start_time = params[index];
          if (part.includes('end_time = ?')) sess.end_time = params[index];
          if (part.includes('late_after = ?')) sess.late_after = params[index];
          if (part.includes('is_active = ?')) sess.is_active = Number(params[index]);
        });
      }
      saveMemoryData();

      if (isMysqlConnected && pool) {
        pool.query(
          'UPDATE sessions SET name=?, subject=?, room=?, day_of_week=?, start_time=?, end_time=?, late_after=?, is_active=? WHERE id=?',
          [sess.name, sess.subject, sess.room, sess.day_of_week, sess.start_time, sess.end_time, sess.late_after, sess.is_active, id]
        );
      }
      return { changes: 1 };
    }

    if (sql.startsWith('DELETE FROM sessions')) {
      const id = Number(params[0]);
      const initLen = memoryData.sessions.length;
      memoryData.sessions = memoryData.sessions.filter(s => s.id !== id);
      saveMemoryData();
      if (isMysqlConnected && pool) {
        pool.query('DELETE FROM sessions WHERE id = ?', [id]);
      }
      return { changes: initLen - memoryData.sessions.length };
    }

    if (sql.includes('settings')) {
      const [key, value] = params;
      memoryData.settings[key] = value;
      saveMemoryData();
      if (isMysqlConnected && pool) {
        pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [key, String(value)]);
      }
      return { changes: 1 };
    }

    return { changes: 0 };
  }
}

const db = new UnifiedDatabase();

export default db;
export { DEFAULT_SETTINGS, DB_CONFIG };
