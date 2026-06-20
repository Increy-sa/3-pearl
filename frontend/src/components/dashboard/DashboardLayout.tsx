import { useEffect, useState } from 'react';
import { Users, FileText, Settings, LogOut, LayoutDashboard, Bell, BarChart3, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../../config/api';

const ROLE_DISPLAY: Record<string, string> = {
  ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', SEO: 'مختص SEO',
};

export function DashboardLayout() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchNotifs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) await res.json();
    } catch (e) {}
  };

  useEffect(() => { fetchNotifs(); }, [token]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.role === 'ADMIN';
  const isAM = user?.role === 'ACCOUNT_MANAGER';

  const navLinkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
      location.pathname === path
        ? 'bg-indigo-500/10 text-indigo-400'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 lg:p-6 border-b border-slate-800">
        <h1 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 lg:w-6 lg:h-6 text-indigo-400 shrink-0" /> نظام الوكالة
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 lg:px-4 space-y-1 mt-4 overflow-y-auto">
        <Link to="/dashboard" className={navLinkClass('/dashboard')}>
          <FileText className="w-5 h-5 shrink-0" /> لوحة الطلبات
        </Link>
        {(isAdmin || isAM) && (
          <Link to="/dashboard/staff" className={navLinkClass('/dashboard/staff')}>
            <Users className="w-5 h-5 shrink-0" /> إدارة فريق العمل
          </Link>
        )}

        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            <Link to="/dashboard/reports" className={navLinkClass('/dashboard/reports')}>
              <BarChart3 className="w-5 h-5 shrink-0" /> التقارير والإحصائيات
            </Link>
          </div>
        )}

        {/* Settings — visible to ALL staff */}
        <div className={`${!isAdmin ? 'pt-4 mt-4 border-t border-slate-800' : ''} space-y-1`}>
          <Link to="/dashboard/settings" className={navLinkClass('/dashboard/settings')}>
            <Settings className="w-5 h-5 shrink-0" /> الإعدادات
          </Link>
        </div>
      </nav>

      {/* User Info + Logout */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500">{ROLE_DISPLAY[user?.role || '']}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2.5 hover:text-white hover:bg-slate-800 text-slate-400 text-sm rounded-xl transition-all duration-200">
          <LogOut className="w-4 h-4 shrink-0" /> تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50" dir="rtl">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile Sidebar Overlay ──────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute top-0 right-0 h-full w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        <header className="bg-white border-b px-4 sm:px-6 lg:px-8 py-3 lg:py-4 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 truncate">إدارة خط الإنتاج</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="hidden sm:inline bg-emerald-50 text-emerald-600 font-bold px-2.5 py-1 rounded-full text-xs">{user?.role}</span>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8"><Outlet /></div>
      </main>
    </div>
  );
}
