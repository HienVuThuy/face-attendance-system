// ============================================================
// routes/device.js — Trạng thái phần cứng IoT (ESP32-CAM)
// ============================================================

import { Router } from 'express';
import axios from 'axios';
import db from '../database.js';

const router = Router();

// ── GET /api/device/status ───────────────────────────────
// Kiểm tra trạng thái kết nối camera ESP32-CAM
router.get('/status', async (req, res) => {
  const espCamSetting = db.prepare("SELECT value FROM settings WHERE key = 'espCamIp'").get();
  const camIp = espCamSetting ? espCamSetting.value : '192.168.100.178';

  let camOnline = false;
  try {
    await axios.get(`http://${camIp}/status`, { timeout: 1500 });
    camOnline = true;
  } catch {
    camOnline = false;
  }

  res.json({
    espCam: { ip: camIp, online: camOnline },
  });
});

export default router;
