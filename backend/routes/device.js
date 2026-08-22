// ============================================================
// routes/device.js — Điều khiển phần cứng IoT (Relay / ESP32)
// ============================================================
// Đơn giản hóa: Dùng HTTP GET http://<espDevkitIp>/unlock?duration=5
// thay vì dựng MQTT broker riêng.
// ============================================================

import { Router } from 'express';
import axios from 'axios';
import db from '../database.js';

const router = Router();

// ── POST /api/device/unlock ──────────────────────────────
// Gửi yêu cầu mở khóa cửa tới ESP32 DevKit qua HTTP
router.post('/unlock', async (req, res) => {
  const durationSetting = db.prepare("SELECT value FROM settings WHERE key = 'doorOpenDuration'").get();
  const ipSetting = db.prepare("SELECT value FROM settings WHERE key = 'espDevkitIp'").get();

  const duration = req.body.duration || (durationSetting ? Number(durationSetting.value) : 5);
  const espIp = req.body.ip || (ipSetting ? ipSetting.value : '192.168.1.101');

  const targetUrl = `http://${espIp}/unlock?duration=${duration}`;

  try {
    // Timeout 3 giây để tránh treo request nếu ESP32 offline
    const response = await axios.get(targetUrl, { timeout: 3000 });
    res.json({
      success: true,
      simulated: false,
      message: `Đã gửi tín hiệu mở khóa tới ESP32 (${espIp}) trong ${duration}s`,
      deviceResponse: response.data,
    });
  } catch (error) {
    // ⚠️ [SIMULATED MODE]: Khi ESP32 DevKit chưa kết nối hoặc đang chạy demo không phần cứng,
    // hệ thống sẽ tự động chuyển sang chế độ mở cửa ảo (simulated) để Dashboard vẫn hoạt động bình thường.
    res.status(200).json({
      success: false,
      simulated: true,
      message: `[MÔ PHỎNG / SIMULATED] Không kết nối được ESP32 tại ${espIp} (${error.message}). Đã kích hoạt đếm ngược mở cửa ảo ${duration}s trên Dashboard.`,
      targetUrl,
    });
  }
});

// ── GET /api/device/status ───────────────────────────────
// Kiểm tra trạng thái kết nối phần cứng (ESP32-CAM và ESP32 DevKit)
router.get('/status', async (req, res) => {
  const espCamSetting = db.prepare("SELECT value FROM settings WHERE key = 'espCamIp'").get();
  const espDevkitSetting = db.prepare("SELECT value FROM settings WHERE key = 'espDevkitIp'").get();

  const camIp = espCamSetting ? espCamSetting.value : '192.168.1.100';
  const devkitIp = espDevkitSetting ? espDevkitSetting.value : '192.168.1.101';

  let camOnline = false;
  let devkitOnline = false;

  try {
    await axios.get(`http://${camIp}/status`, { timeout: 1500 });
    camOnline = true;
  } catch {
    camOnline = false;
  }

  try {
    await axios.get(`http://${devkitIp}/status`, { timeout: 1500 });
    devkitOnline = true;
  } catch {
    devkitOnline = false;
  }

  res.json({
    espCam: { ip: camIp, online: camOnline },
    espDevkit: { ip: devkitIp, online: devkitOnline },
  });
});

export default router;
