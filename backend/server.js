// ============================================================
// server.js — Entry point Express API Server
// ============================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import studentsRouter from './routes/students.js';
import attendanceRouter from './routes/attendance.js';
import sessionsRouter from './routes/sessions.js';
import statsRouter from './routes/stats.js';
import settingsRouter from './routes/settings.js';
import deviceRouter from './routes/device.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Đảm bảo thư mục uploads tồn tại
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static route phục vụ ảnh chân dung đã upload
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/students', studentsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/device', deviceRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'IoT Face Attendance Backend',
    version: '1.0.0',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ error: err.message || 'Lỗi máy chủ nội bộ' });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🚀 IoT Face Attendance Backend Server is Running           ║
║   🌐 URL: http://localhost:${PORT}                            ║
║   📡 API Base: http://localhost:${PORT}/api                  ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
