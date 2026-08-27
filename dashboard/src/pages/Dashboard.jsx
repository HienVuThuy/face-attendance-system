import { useState } from 'react';
import { Users, UserCheck, UserX, Clock, Activity, ShieldCheck, Sparkles, RotateCcw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import { formatTime, getInitials } from '../utils/helpers';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/60 p-3.5 text-xs text-white">
      <p className="font-bold text-slate-200 mb-2 border-b border-slate-800 pb-1">{label}</p>
      {payload.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
            <span className="text-slate-300 font-medium">{item.name}:</span>
          </div>
          <span className="font-bold text-white tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { stats, logs, weeklyData, pieData, backendOnline, refreshAll, lastSyncTime, syncMode } = useData();
  const { addToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAll();
      addToast('✅ Đã cập nhật số liệu thống kê Dashboard mới nhất!', 'success');
    } catch {
      addToast('Lỗi khi làm mới số liệu', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const recentLogs = logs.slice(0, 5);

  const attendanceRateToday = stats.totalStudents > 0
    ? Math.round((stats.todayCheckins / stats.totalStudents) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Status */}
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 rounded-2xl p-6 text-white shadow-lg overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-blue-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-200" /> Hệ thống IoT Trực tuyến
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" /> Backend: {backendOnline ? 'Đã kết nối' : 'Đang kết nối...'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 text-xs font-semibold border border-cyan-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-dot" /> {syncMode === 'sse' ? 'SSE Real-time' : 'Auto-Sync'} • {formatTime(lastSyncTime)}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Hệ Thống Điểm Danh & Nhận Diện Khuôn Mặt IoT</h2>
          <p className="text-blue-100 text-sm mt-1 max-w-xl">
            Tự động nhận diện sinh trắc học qua camera AI ESP32-CAM và cập nhật số liệu thời gian thực không cần tải lại trang.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60"
            title="Làm mới toàn bộ số liệu thống kê"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Đang tải...' : 'Làm mới số liệu'}
          </button>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5 text-right">
            <p className="text-[11px] text-blue-200 font-medium">Tỷ lệ có mặt hôm nay</p>
            <p className="text-2xl font-black text-white tabular-nums">
              {attendanceRateToday}%
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards with Real Trends */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger-children">
        <StatCard
          icon={Users}
          label="Tổng SV đăng ký"
          value={stats.totalStudents.toLocaleString()}
          trend={stats.trends?.totalStudents || 0}
          trendLabel="so với tháng trước"
          color="blue"
        />
        <StatCard
          icon={UserCheck}
          label="Check-in hôm nay"
          value={stats.todayCheckins}
          trend={stats.trends?.todayCheckins || 0}
          trendLabel="so với hôm qua"
          color="green"
        />
        <StatCard
          icon={UserX}
          label="Vắng mặt hôm nay"
          value={stats.absentToday}
          trend={stats.trends?.absentToday || 0}
          trendLabel="so với hôm qua"
          color="red"
        />
        <StatCard
          icon={Clock}
          label="Đi muộn hôm nay"
          value={stats.lateToday}
          trend={stats.trends?.lateToday || 0}
          trendLabel="so với hôm qua"
          color="yellow"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar Chart - 7 day trends */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" /> Xu hướng điểm danh tuần
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Thống kê so sánh 7 ngày gần nhất theo ca học</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Đúng giờ
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" /> Đi muộn
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ml-2" /> Vắng
            </div>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={weeklyData} barGap={4} barCategoryGap="22%">
              <defs>
                <linearGradient id="barOnTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="barLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="barAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Đúng giờ" fill="url(#barOnTime)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Đi muộn" fill="url(#barLate)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Vắng mặt" fill="url(#barAbsent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 animate-slide-up flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Tỷ lệ chuyên cần
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Phân bổ tỷ lệ trên toàn hệ thống</p>
          </div>

          <div className="my-2">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={82}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Details */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            {pieData.map((item) => {
              const total = pieData.reduce((a, b) => a + b.value, 0);
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shadow-xs" style={{ background: item.color }} aria-hidden="true" />
                    <span className="text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium tabular-nums">{item.value} Lượt</span>
                    <span className="font-bold text-slate-900 tabular-nums bg-slate-100 px-2 py-0.5 rounded-full">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 animate-slide-up overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Hoạt động điểm danh gần đây</h3>
            <p className="text-xs text-slate-500 mt-0.5">5 lượt check-in mới nhất theo luồng nhận diện trực tiếp</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
            {logs.length} Lượt điểm danh
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Bảng hoạt động điểm danh gần nhất">
            <thead>
              <tr>
                <th scope="col">Sinh viên</th>
                <th scope="col">Mã SV</th>
                <th scope="col">Lớp</th>
                <th scope="col">Thời gian</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log, i) => (
                <tr key={log.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-in">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                        {getInitials(log.name)}
                      </div>
                      <span className="font-bold text-slate-800">{log.name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-sm text-slate-600 font-semibold tabular-nums">{log.studentId}</td>
                  <td className="text-slate-600 font-medium">{log.lop}</td>
                  <td className="text-slate-600 font-mono tabular-nums font-medium">{formatTime(log.timestamp)}</td>
                  <td><StatusBadge status={log.status} /></td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Chưa có hoạt động điểm danh nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
