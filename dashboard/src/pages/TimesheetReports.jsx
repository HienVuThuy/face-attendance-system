import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Download, ChevronLeft, ChevronRight, UserCheck, Clock, UserX, Award, RotateCcw } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import { getInitials } from '../utils/helpers';

const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

export default function TimesheetReports() {
  const { getTimesheet, students } = useData();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { addToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const timesheetData = await getTimesheet(month, year);
      setData(timesheetData);
    } catch (err) {
      console.error(err);
      addToast('Lỗi tải dữ liệu chấm công: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getTimesheet, month, year, addToast]);

  const handleManualReload = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
      addToast('✅ Đã làm mới bảng chấm công!', 'success');
    } catch {
      addToast('Không thể làm mới bảng chấm công', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (data.length === 0) {
      addToast('Không có dữ liệu sinh viên để xuất báo cáo', 'error');
      return;
    }

    let csv = "data:text/csv;charset=utf-8,\uFEFFMã SV,Họ và Tên,Lớp,Đúng giờ,Đi muộn,Vắng mặt,Tỉ lệ (%),Xếp loại\n";
    data.forEach(s => {
      const score = s.rate >= 90 ? 'A' : s.rate >= 75 ? 'B' : s.rate >= 60 ? 'C' : 'D';
      csv += `"${s.id}","${s.name}","${s.lop || ''}",${s.present},${s.late},${s.absent},"${s.rate}%","${score}"\n`;
    });

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Bao_Cao_Cham_Cong_${MONTHS[month]}_${year}.csv`;
    link.click();
    addToast(`Đã xuất báo cáo chấm công ${MONTHS[month]} ${year} ra file CSV!`, 'success');
  };

  // Summary stats
  const avgRate = data.length > 0
    ? Math.round(data.reduce((sum, s) => sum + s.rate, 0) / data.length)
    : 0;
  const totalPresent = data.reduce((sum, s) => sum + s.present, 0);
  const totalLate = data.reduce((sum, s) => sum + s.late, 0);
  const totalAbsent = data.reduce((sum, s) => sum + s.absent, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Month Selector & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-xs p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Xem dữ liệu tháng trước"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-slate-800 min-w-[130px] text-center tabular-nums">
                {MONTHS[month]} / {year}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Xem dữ liệu tháng tiếp theo"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualReload}
            disabled={isRefreshing}
            title="Làm mới bảng chấm công"
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-blue-600 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-60"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none transition-colors border border-emerald-300/80 shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-700" /> Xuất Báo Cáo Chấm Công
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 text-center">
          <p className="text-2xl font-black text-blue-600 tabular-nums">{avgRate}%</p>
          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
            <Award className="w-3.5 h-3.5 text-blue-500" /> Tỉ lệ chuyên cần TB
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 text-center">
          <p className="text-2xl font-black text-emerald-600 tabular-nums">{totalPresent}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Lượt đúng giờ
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 text-center">
          <p className="text-2xl font-black text-amber-600 tabular-nums">{totalLate}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" /> Lượt đi muộn
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 text-center">
          <p className="text-2xl font-black text-rose-600 tabular-nums">{totalAbsent}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
            <UserX className="w-3.5 h-3.5 text-rose-500" /> Lượt vắng mặt
          </p>
        </div>
      </div>

      {/* Timesheet Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Bảng tổng hợp chấm công chuyên cần">
            <thead>
              <tr>
                <th scope="col">Sinh viên</th>
                <th scope="col">Mã SV</th>
                <th scope="col" className="text-center">Đúng giờ</th>
                <th scope="col" className="text-center">Đi muộn</th>
                <th scope="col" className="text-center">Vắng mặt</th>
                <th scope="col">Tỉ lệ đi học</th>
                <th scope="col" className="text-center">Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              {data.map((student, i) => {
                const score = student.rate >= 90 ? 'A' :
                  student.rate >= 75 ? 'B' :
                  student.rate >= 60 ? 'C' : 'D';

                const scoreColors = {
                  A: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
                  B: 'text-blue-700 bg-blue-50 border border-blue-200',
                  C: 'text-amber-700 bg-amber-50 border border-amber-200',
                  D: 'text-rose-700 bg-rose-50 border border-rose-200',
                };

                const barBg = student.rate >= 80
                  ? 'bg-emerald-500'
                  : student.rate >= 60
                  ? 'bg-amber-500'
                  : 'bg-rose-500';

                return (
                  <tr key={student.id} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs">
                          {getInitials(student.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{student.name}</p>
                          <p className="text-xs text-slate-400 font-medium">{student.lop}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm text-slate-700 font-bold tabular-nums">{student.id}</td>
                    <td className="text-center">
                      <span className="text-emerald-600 font-bold tabular-nums">{student.present}</span>
                      <span className="text-slate-400 text-xs tabular-nums">/{student.totalDays}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-amber-600 font-bold tabular-nums">{student.late}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-rose-600 font-bold tabular-nums">{student.absent}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 progress-bar" role="progressbar" aria-valuenow={student.rate} aria-valuemin={0} aria-valuemax={100}>
                          <div
                            className={`progress-bar-fill ${barBg}`}
                            style={{ width: `${student.rate}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-800 min-w-[38px] text-right tabular-nums">
                          {student.rate}%
                        </span>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black shadow-xs ${scoreColors[score]}`}>
                        {score}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    Chưa có dữ liệu sinh viên nào trong hệ thống.
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
