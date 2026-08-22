import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const DataContext = createContext(null);

const API_BASE = '/api';

export function DataProvider({ children }) {
  // State from backend
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
    shiftStart: '07:00',
    lateThreshold: '07:15',
    espCamIp: '192.168.100.178',
    espDevkitIp: '192.168.1.101',
    faceThreshold: 0.5,
    autoOpenDoor: true,
    doorOpenDuration: 5,
    language: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
  });

  const [stats, setStats] = useState({
    totalStudents: 0,
    todayCheckins: 0,
    onTimeToday: 0,
    lateToday: 0,
    absentToday: 0,
    trends: {
      totalStudents: 0,
      todayCheckins: 0,
      absentToday: 0,
      lateToday: 0,
    },
  });

  const [weeklyData, setWeeklyData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);

  // ===== FETCH METHODS =====
  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }, []);

  const fetchLogs = useCallback(async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/attendance${query ? `?${query}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [dashRes, weekRes, distRes] = await Promise.all([
        fetch(`${API_BASE}/stats/dashboard`),
        fetch(`${API_BASE}/stats/weekly`),
        fetch(`${API_BASE}/stats/distribution`),
      ]);

      if (dashRes.ok) {
        const data = await dashRes.json();
        setStats(data);
      }
      if (weekRes.ok) {
        const data = await weekRes.json();
        setWeeklyData(data);
      }
      if (distRes.ok) {
        const data = await distRes.json();
        setPieData(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStudents(), fetchLogs(), fetchSettings(), fetchStats()]);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }, [fetchStudents, fetchLogs, fetchSettings, fetchStats]);

  // Initial Load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ===== STUDENT ACTIONS =====
  const addStudent = useCallback(async (newStudent) => {
    try {
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent),
      });
      if (!res.ok) {
        let errMsg = 'Lỗi thêm sinh viên';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await res.text();
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }
      await Promise.all([fetchStudents(), fetchStats()]);
      return true;
    } catch (err) {
      console.error('addStudent error:', err);
      throw err;
    }
  }, [fetchStudents, fetchStats]);

  const updateStudent = useCallback(async (id, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (!res.ok) {
        let errMsg = 'Lỗi cập nhật sinh viên';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await res.text();
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }
      await Promise.all([fetchStudents(), fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error('updateStudent error:', err);
      throw err;
    }
  }, [fetchStudents, fetchLogs, fetchStats]);

  const deleteStudent = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        let errMsg = 'Lỗi xóa sinh viên';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await res.text();
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }
      await Promise.all([fetchStudents(), fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error('deleteStudent error:', err);
      throw err;
    }
  }, [fetchStudents, fetchLogs, fetchStats]);

  const addStudentDescriptor = useCallback(async (id, descriptor) => {
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(id)}/descriptors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: Array.from(descriptor) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi lưu vector khuôn mặt');
      }
      await fetchStudents();
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchStudents]);

  // ===== ATTENDANCE LOG ACTIONS =====
  const addAttendanceLog = useCallback(async (logData) => {
    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi ghi nhận điểm danh');
      }
      const data = await res.json();
      await Promise.all([fetchLogs(), fetchStats()]);
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  const updateAttendanceLog = useCallback(async (id, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE}/attendance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi cập nhật lịch sử');
      }
      await Promise.all([fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  const deleteAttendanceLog = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/attendance/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi xóa bản ghi');
      }
      await Promise.all([fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  const clearAttendanceLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi xóa tất cả');
      }
      await Promise.all([fetchLogs(), fetchStats()]);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchLogs, fetchStats]);

  // ===== SETTINGS ACTIONS =====
  const updateSettings = useCallback(async (newSettings) => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi lưu cấu hình');
      }
      await fetchSettings();
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [fetchSettings]);

  const resetSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/reset`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi đặt lại cài đặt');
      }
      const data = await res.json();
      setSettings(data.settings);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, []);

  // ===== DEVICE ACTIONS =====
  const unlockDoor = useCallback(async (duration) => {
    try {
      const res = await fetch(`${API_BASE}/device/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      });
      return await res.json();
    } catch (err) {
      console.error('Error unlocking door:', err);
      return { success: false, message: err.message };
    }
  }, []);

  const checkDeviceStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/device/status`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  }, []);

  // ===== TIMESHEET REPORT METHOD =====
  const getTimesheet = useCallback(async (month, year) => {
    try {
      const res = await fetch(`${API_BASE}/stats/timesheet?month=${month}&year=${year}`);
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (err) {
      console.error('Error fetching timesheet:', err);
      return [];
    }
  }, []);

  // Computed today's logs from logs list
  const todayLogs = useMemo(() => {
    const todayStr = new Date().toDateString();
    return logs.filter(l => new Date(l.timestamp).toDateString() === todayStr);
  }, [logs]);

  const value = {
    students,
    logs,
    settings,
    stats,
    todayLogs,
    weeklyData,
    pieData,
    loading,
    backendOnline,
    refreshAll,
    fetchStudents,
    fetchLogs,
    fetchStats,
    addStudent,
    updateStudent,
    deleteStudent,
    addStudentDescriptor,
    addAttendanceLog,
    updateAttendanceLog,
    deleteAttendanceLog,
    clearAttendanceLogs,
    updateSettings,
    resetSettings,
    unlockDoor,
    checkDeviceStatus,
    getTimesheet,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
