import {
  LayoutDashboard,
  Camera,
  Users,
  ClockArrowDown,
  FileSpreadsheet,
  Settings,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'camera', label: 'Camera Nhận diện', icon: Camera },
  { id: 'students', label: 'Quản lý Sinh viên', icon: Users },
  { id: 'logs', label: 'Lịch sử Điểm danh', icon: ClockArrowDown },
  { id: 'timesheet', label: 'Chấm công & Báo cáo', icon: FileSpreadsheet },
  { id: 'settings', label: 'Cài đặt hệ thống', icon: Settings },
];

export default function Sidebar({ activeTab, onTabChange, collapsed = false, onCollapse }) {
  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-300 ease-in-out select-none ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
      aria-label="Thanh điều hướng chính"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-blue-400" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-white font-bold text-sm tracking-wide leading-tight">
              IoT ATTENDANCE
            </h1>
            <p className="text-slate-400 text-[10px] font-semibold tracking-widest uppercase">
              Face Recognition
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto" aria-label="Menu chính">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`w-full min-h-[42px] flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative focus-visible:ring-2 focus-visible:ring-blue-400 outline-none ${
                isActive
                  ? 'bg-blue-500/20 text-blue-300 font-semibold shadow-inner'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" aria-hidden="true" />
              )}
              <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => onCollapse && onCollapse(!collapsed)}
          aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          className="w-full min-h-[38px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-blue-400 outline-none transition-colors text-xs font-medium cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Thu gọn</span>
            </>
          )}
        </button>
      </div>

      {/* User Info at bottom */}
      {!collapsed && (
        <div className="px-4 pb-5 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
              A
            </div>
            <div className="min-w-0">
              <p className="text-slate-200 text-sm font-semibold truncate">Administrator</p>
              <p className="text-slate-400 text-[11px] font-mono tabular-nums">v2.0.1 • IoT AI</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export { navItems };
