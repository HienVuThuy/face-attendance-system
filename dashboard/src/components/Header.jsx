import { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, User, LogOut, Settings, ShieldCheck, Mail, Calendar, Key, CheckCircle, X, Menu } from 'lucide-react';
import Modal from './Modal';
import { useToast } from './Toast';
import { useData } from '../context/DataContext';
import { formatTime, formatDate } from '../utils/helpers';

const navTitles = {
  dashboard: 'Tổng quan',
  camera: 'Camera Nhận diện',
  students: 'Quản lý Sinh viên',
  sessions: 'Quản lý Ca học (Thời khoá biểu)',
  logs: 'Lịch sử Điểm danh',
  timesheet: 'Báo cáo',
  settings: 'Cài đặt hệ thống',
};

export default function Header({ activeTab, onTabChange, sidebarWidth, isMobile = false, onToggleMobileMenu }) {
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);

  const { logs, backendOnline } = useData();
  const { addToast } = useToast();

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const recentEvents = logs.slice(0, 5);

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenProfile = () => {
    setShowProfile(false);
    setShowProfileModal(true);
  };

  const handleGoSettings = () => {
    setShowProfile(false);
    if (onTabChange) {
      onTabChange('settings');
      addToast('⚙️ Đã chuyển đến Cài đặt hệ thống', 'info');
    }
  };

  const handleLogout = () => {
    setShowProfile(false);
    addToast('🔒 Đã đăng xuất khỏi phiên làm việc Quản trị viên!', 'info');
    if (onTabChange) {
      onTabChange('dashboard');
    }
  };

  return (
    <>
      <header
        className="fixed top-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 z-30 flex items-center justify-between px-4 sm:px-6 transition-all duration-300"
        style={{ left: isMobile ? 0 : sidebarWidth }}
        role="banner"
      >
        {/* Left: Page Title + Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {isMobile && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              aria-label="Mở menu điều hướng"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate max-w-[180px] sm:max-w-none">
            {navTitles[activeTab] || 'Dashboard'}
          </h2>
        </div>

        {/* Right: Notifications + Profile */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifPopover(!showNotifPopover)}
              aria-label="Thông báo hệ thống"
              className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 outline-none group cursor-pointer"
            >
              <Bell className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse-dot" />
            </button>

            {/* Notification Popover */}
            {showNotifPopover && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/80 py-3 animate-scale-in origin-top-right z-50">
                <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông báo hệ thống</h4>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {backendOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                  </span>
                </div>
                <div className="py-1 divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {recentEvents.length > 0 ? (
                    recentEvents.map(log => (
                      <div key={log.id} className="px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800">{log.name || 'Sinh viên'}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{formatTime(log.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Điểm danh: <span className="font-semibold text-emerald-600">{log.status === 'on-time' ? 'Đúng giờ' : 'Đi muộn'}</span> • {log.lop || log.studentId}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-center text-xs text-slate-400">
                      Chưa có sự kiện điểm danh nào mới
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-7 bg-slate-200" aria-hidden="true" />

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfile(!showProfile)}
              aria-expanded={showProfile}
              aria-haspopup="true"
              aria-label="Menu tài khoản Quản trị viên"
              className="flex items-center gap-2.5 px-2.5 py-1.5 min-h-[40px] rounded-lg hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 outline-none cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                A
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight">Admin</p>
                <p className="text-[11px] text-slate-500 font-medium">Quản trị viên</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showProfile ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showProfile && (
              <div
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl shadow-slate-900/10 border border-slate-200/80 py-2 animate-scale-in origin-top-right z-50"
                role="menu"
              >
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-800">Administrator</p>
                  <p className="text-xs text-slate-500">admin@iot-attendance.edu.vn</p>
                </div>
                <div className="py-1" role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleOpenProfile}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left cursor-pointer"
                  >
                    <User className="w-4 h-4 text-slate-400" /> Hồ sơ cá nhân
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleGoSettings}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" /> Cài đặt
                  </button>
                </div>
                <div className="border-t border-slate-100 pt-1" role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-500" /> Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= MODAL: HỒ SƠ QUẢN TRỊ VIÊN ================= */}
      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Hồ sơ Quản trị viên" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-blue-500/20">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-slate-800">Administrator</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 text-slate-400" /> admin@iot-attendance.edu.vn
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[11px] font-bold mt-1.5">
                <ShieldCheck className="w-3 h-3" /> Quản trị viên cao cấp (Super Admin)
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400">Hệ thống:</span>
              <span className="font-semibold text-slate-800">IoT Face Attendance v2.5</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400">Quyền hạn:</span>
              <span className="font-semibold text-emerald-700">Toàn quyền hệ thống & Thiết bị IoT</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Trạng thái:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Đang hoạt động
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
