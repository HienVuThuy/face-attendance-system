import { useState, useEffect } from 'react';
import { Clock, Wifi, Globe, Save, RotateCcw, Sliders, Cpu } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useData();
  const { addToast } = useToast();

  const [formState, setFormState] = useState(settings);

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  const cleanIp = (val) => {
    if (!val) return '';
    return val.replace(/^https?:\/\//i, '').replace(/:[0-9]+.*$/, '').replace(/\/.*$/, '').trim();
  };

  const handleChange = (key, value) => {
    if (key === 'espCamIp' || key === 'espDevkitIp') {
      value = cleanIp(value);
    }
    setFormState(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formState,
        espCamIp: cleanIp(formState.espCamIp),
        espDevkitIp: cleanIp(formState.espDevkitIp),
      };
      await updateSettings(payload);
      addToast('✅ Đã lưu và áp dụng địa chỉ IP mới cho toàn bộ hệ thống!', 'success');
    } catch (err) {
      addToast('Lỗi lưu cấu hình: ' + err.message, 'error');
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings();
      addToast('Đã khôi phục cài đặt mặc định ban đầu', 'info');
    } catch (err) {
      addToast('Lỗi khôi phục: ' + err.message, 'error');
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-fade-in max-w-4xl">
      {/* Attendance Rules */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Quy tắc điểm danh ca học</h3>
            <p className="text-sm text-slate-500">Cấu hình thời gian bắt đầu ca và ngưỡng đánh dấu đi muộn</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="settings-shift-start" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Giờ bắt đầu ca học
              </label>
              <input
                id="settings-shift-start"
                type="time"
                value={formState.shiftStart || '07:00'}
                onChange={(e) => handleChange('shiftStart', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono font-bold"
              />
              <p className="text-xs text-slate-400 mt-1">VD: 07:00 AM — Sinh viên check-in trước giờ này là "Đúng giờ"</p>
            </div>
            <div>
              <label htmlFor="settings-late-threshold" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngưỡng đánh dấu đi muộn
              </label>
              <input
                id="settings-late-threshold"
                type="time"
                value={formState.lateThreshold || '07:15'}
                onChange={(e) => handleChange('lateThreshold', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono font-bold"
              />
              <p className="text-xs text-slate-400 mt-1">Check-in sau thời gian này sẽ tự động phân loại "Đi muộn"</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div>
              <label htmlFor="settings-auto-open-door" className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    id="settings-auto-open-door"
                    type="checkbox"
                    checked={Boolean(formState.autoOpenDoor)}
                    onChange={(e) => handleChange('autoOpenDoor', e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${formState.autoOpenDoor ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${formState.autoOpenDoor ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-800">Tự động kích hoạt mở cửa</span>
                  <p className="text-xs text-slate-500">Kích hoạt rơ-le mở cửa khi nhận diện khuôn mặt thành công</p>
                </div>
              </label>
            </div>

            <div>
              <label htmlFor="settings-door-duration" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Thời gian giữ mở cửa (giây)
              </label>
              <input
                id="settings-door-duration"
                type="number"
                min="1"
                max="30"
                value={formState.doorOpenDuration || 5}
                onChange={(e) => handleChange('doorOpenDuration', parseInt(e.target.value) || 5)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* IoT Connection Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Kết nối phần cứng IoT</h3>
            <p className="text-sm text-slate-500">Cấu hình địa chỉ IP của ESP32-CAM và ESP32 DevKit (Relay)</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="settings-esp-cam-ip" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Địa chỉ IP ESP32-CAM (Camera)
              </label>
              <input
                id="settings-esp-cam-ip"
                type="text"
                value={formState.espCamIp || '192.168.1.100'}
                onChange={(e) => handleChange('espCamIp', e.target.value)}
                placeholder="192.168.x.x"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono font-bold"
              />
              <p className="text-xs text-slate-400 mt-1">Luồng MJPEG: http://&lt;IP&gt;:81/stream</p>
            </div>
            <div>
              <label htmlFor="settings-esp-devkit-ip" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Địa chỉ IP ESP32 DevKit (Relay Mở Cửa)
              </label>
              <input
                id="settings-esp-devkit-ip"
                type="text"
                value={formState.espDevkitIp || '192.168.1.101'}
                onChange={(e) => handleChange('espDevkitIp', e.target.value)}
                placeholder="192.168.x.x"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono font-bold"
              />
              <p className="text-xs text-slate-400 mt-1">Lệnh mở cửa HTTP: GET http://&lt;IP&gt;/unlock</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Face Recognition Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Cấu hình AI Nhận diện Khuôn mặt</h3>
            <p className="text-sm text-slate-500">Thiết lập ngưỡng sai số nhận diện (Distance Threshold)</p>
          </div>
        </div>
        <div className="p-6">
          <div className="max-w-md">
            <label htmlFor="settings-face-threshold" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ngưỡng khoảng cách FaceMatcher (Threshold): <span className="font-mono text-blue-600">{formState.faceThreshold || 0.5}</span>
            </label>
            <input
              id="settings-face-threshold"
              type="range"
              min="0.3"
              max="0.8"
              step="0.05"
              value={formState.faceThreshold || 0.5}
              onChange={(e) => handleChange('faceThreshold', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
              <span>0.3 (Nghiêm ngặt)</span>
              <span>0.5 (Khuyên dùng)</span>
              <span>0.8 (Dễ tính)</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Khoảng cách Euclidean càng nhỏ thì độ chính xác càng cao. Nếu người lạ bị nhận nhầm, hãy giảm xuống 0.45.
            </p>
          </div>
        </div>
      </div>

      {/* System Preferences */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Tùy chọn hệ thống</h3>
            <p className="text-sm text-slate-500">Ngôn ngữ hiển thị và múi giờ vận hành</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="settings-language-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngôn ngữ giao diện
              </label>
              <div className="relative">
                <select
                  id="settings-language-select"
                  value={formState.language || 'vi'}
                  onChange={(e) => handleChange('language', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none bg-white pr-8 font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="vi">🇻🇳 Tiếng Việt (Mặc định)</option>
                  <option value="en">🇺🇸 English</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="settings-timezone-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Múi giờ khu vực
              </label>
              <div className="relative">
                <select
                  id="settings-timezone-select"
                  value={formState.timezone || 'Asia/Ho_Chi_Minh'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none bg-white pr-8 font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="Asia/Ho_Chi_Minh">UTC+7 (Hồ Chí Minh / Hà Nội)</option>
                  <option value="Asia/Bangkok">UTC+7 (Bangkok)</option>
                  <option value="Asia/Tokyo">UTC+9 (Tokyo)</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save / Reset Buttons */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 outline-none transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" /> Khôi phục mặc định
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
        >
          <Save className="w-4 h-4" /> Lưu cấu hình hệ thống
        </button>
      </div>
    </form>
  );
}
