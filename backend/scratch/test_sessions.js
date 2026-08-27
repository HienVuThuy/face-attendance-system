import db from '../database.js';

setTimeout(() => {
  console.log('\n--- KIỂM TRA SESSIONS TRONG DATABASE ---');
  const sessions = db.prepare('SELECT * FROM sessions').all();
  console.log('Tổng số ca học:', sessions.length);
  sessions.forEach(s => {
    console.log(`[ID ${s.id}] Thứ ${s.day_of_week === 7 ? 'CN' : s.day_of_week + 1} (${s.day_of_week}) | ${s.start_time} - ${s.end_time} | ${s.name}: ${s.subject} (${s.room})`);
  });

  console.log('\n--- THỬ TRA CA HỌC HIỆN TẠI (Thứ 2 lúc 08:10) ---');
  // Giả sử Thứ 2 (day_of_week = 1), 08:10
  const testDay = 1;
  const testTime = '08:10';
  const matched = db.prepare(
    'SELECT * FROM sessions WHERE day_of_week = ? AND start_time <= ? AND end_time >= ? AND is_active = 1'
  ).all(testDay, testTime, testTime);
  console.log('Kết quả khớp Thứ 2 lúc 08:10:', matched);

  console.log('\n--- THỬ TRA CA HỌC NGOÀI GIỜ (Thứ 2 lúc 12:00) ---');
  const testTimeOut = '12:00';
  const matchedOut = db.prepare(
    'SELECT * FROM sessions WHERE day_of_week = ? AND start_time <= ? AND end_time >= ? AND is_active = 1'
  ).all(testDay, testTimeOut, testTimeOut);
  console.log('Kết quả khớp Thứ 2 lúc 12:00:', matchedOut);

  process.exit(0);
}, 1500);
