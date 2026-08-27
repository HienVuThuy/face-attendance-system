import express from 'express';
import studentsRouter from '../routes/students.js';
import attendanceRouter from '../routes/attendance.js';
import sessionsRouter from '../routes/sessions.js';
import settingsRouter from '../routes/settings.js';

const app = express();
app.use(express.json());
app.use('/api/students', studentsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/settings', settingsRouter);

const server = app.listen(3099, async () => {
  console.log('\n--- 1. TEST GET /api/sessions ---');
  let res = await fetch('http://localhost:3099/api/sessions');
  let data = await res.json();
  console.log('GET /api/sessions status:', res.status, 'Sessions count:', data.length);

  console.log('\n--- 2. TEST GET /api/sessions/current ---');
  res = await fetch('http://localhost:3099/api/sessions/current');
  data = await res.json();
  console.log('GET /api/sessions/current:', data);

  console.log('\n--- 3. TEST POST /api/attendance (Trong giờ học: Thứ 2 lúc 08:10) ---');
  // Tạo Date vào Thứ 2 lúc 08:10:00 (VD: 2026-08-24 08:10 là Thứ 2)
  const mondayInClass = new Date('2026-08-24T08:10:00+07:00').getTime();
  res = await fetch('http://localhost:3099/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'B21DCCN001',
      timestamp: mondayInClass,
      confidence: 98.5,
    }),
  });
  data = await res.json();
  console.log('POST /api/attendance (08:10) status:', res.status, 'Data:', data);

  console.log('\n--- 4. TEST POST /api/attendance (Ngoài giờ học: Thứ 2 lúc 12:00) ---');
  const mondayOutOfClass = new Date('2026-08-24T12:00:00+07:00').getTime();
  res = await fetch('http://localhost:3099/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'B21DCCN002',
      timestamp: mondayOutOfClass,
      confidence: 97.2,
    }),
  });
  data = await res.json();
  console.log('POST /api/attendance (12:00) status:', res.status, 'Data:', data);

  server.close(() => process.exit(0));
});
