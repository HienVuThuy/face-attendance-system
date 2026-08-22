import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ToastProvider } from './components/Toast';
import { DataProvider } from './context/DataContext';
import Dashboard from './pages/Dashboard';
import LiveCamera from './pages/LiveCamera';
import StudentManagement from './pages/StudentManagement';
import AttendanceLogs from './pages/AttendanceLogs';
import TimesheetReports from './pages/TimesheetReports';
import Settings from './pages/Settings';

const pages = {
  dashboard: Dashboard,
  camera: LiveCamera,
  students: StudentManagement,
  logs: AttendanceLogs,
  timesheet: TimesheetReports,
  settings: Settings,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const ActivePage = pages[activeTab] || Dashboard;
  const sidebarWidth = sidebarCollapsed ? 72 : 260;

  return (
    <DataProvider>
      <ToastProvider>
        <div className="min-h-screen bg-slate-100">
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
          />
          <Header
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sidebarWidth={`${sidebarWidth}px`}
          />

          {/* Main Content */}
          <main
            className="pt-16 min-h-screen transition-all duration-300"
            style={{ marginLeft: `${sidebarWidth}px` }}
          >
            <div className="p-6">
              <ActivePage key={activeTab} />
            </div>
          </main>
        </div>
      </ToastProvider>
    </DataProvider>
  );
}
