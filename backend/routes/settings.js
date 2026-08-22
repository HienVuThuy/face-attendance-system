// ============================================================
// routes/settings.js — API Cài đặt cấu hình hệ thống
// ============================================================

import { Router } from 'express';
import db, { DEFAULT_SETTINGS } from '../database.js';

const router = Router();

// ── GET /api/settings ────────────────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = { ...DEFAULT_SETTINGS };

  rows.forEach(r => {
    // Parse boolean / number nếu cần
    if (r.value === 'true') settings[r.key] = true;
    else if (r.value === 'false') settings[r.key] = false;
    else if (!isNaN(Number(r.value)) && r.key === 'doorOpenDuration') settings[r.key] = Number(r.value);
    else if (!isNaN(Number(r.value)) && r.key === 'faceThreshold') settings[r.key] = Number(r.value);
    else settings[r.key] = r.value;
  });

  res.json(settings);
});

// ── PUT /api/settings ────────────────────────────────────
router.put('/', (req, res) => {
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ error: 'Dữ liệu cấu hình không hợp lệ' });
  }

  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const transaction = db.transaction((entries) => {
    for (const [key, value] of entries) {
      upsert.run(key, String(value));
    }
  });

  transaction(Object.entries(newSettings));

  res.json({ message: 'Đã cập nhật cấu hình hệ thống thành công' });
});

// ── POST /api/settings/reset ─────────────────────────────
router.post('/reset', (req, res) => {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      upsert.run(key, String(value));
    }
  });

  transaction();

  res.json({ message: 'Đã khôi phục cài đặt mặc định', settings: DEFAULT_SETTINGS });
});

export default router;
