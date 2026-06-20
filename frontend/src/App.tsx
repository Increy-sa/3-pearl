import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { ClientPortal } from './pages/ClientPortal';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { StaffDashboard } from './pages/admin/StaffDashboard';
import { ManageStaff } from './pages/admin/ManageStaff';
import { ReportsDashboard } from './pages/admin/ReportsDashboard';
import { AdminSettings } from './pages/admin/AdminSettings';
import { Login } from './pages/auth/Login';
import { CustomerDashboard } from './pages/customer/CustomerDashboard';
import { useAuthStore } from './store/useAuthStore';

// ── Staff Guard ───────────────────────────────────────────────────────────────
// Protects /dashboard/** from CUSTOMER and unauthenticated users.
// ─────────────────────────────────────────────────────────────────────────────
function StaffGuard({ children }: { children: React.ReactNode }) {
  const { user, isProfileComplete } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'CUSTOMER') {
    return <Navigate to={isProfileComplete ? '/dashboard/customer' : '/client'} replace />;
  }

  return <>{children}</>;
}

// ── Client Guard ──────────────────────────────────────────────────────────────
// /client is ONLY accessible to: CUSTOMER with an incomplete profile.
// Everyone else gets redirected:
//   • Not logged in             → /login
//   • CUSTOMER, profile done    → /dashboard/customer
//   • Any staff role            → /dashboard
// ─────────────────────────────────────────────────────────────────────────────
function ClientGuard({ children }: { children: React.ReactNode }) {
  const { user, isProfileComplete } = useAuthStore();

  // Not logged in → must login first
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'CUSTOMER') {
    // Profile already complete → nothing left to fill
    if (isProfileComplete) return <Navigate to="/dashboard/customer" replace />;
    // Profile incomplete → allow onboarding
    return <>{children}</>;
  }

  // Staff — redirect to their dashboard
  return <Navigate to="/dashboard" replace />;
}


function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/client" replace />} />

          <Route
            path="/client"
            element={
              <ClientGuard>
                <ClientPortal />
              </ClientGuard>
            }
          />

          <Route path="/login" element={<Login />} />
          <Route path="/dashboard/customer" element={<CustomerDashboard />} />

          {/* All /dashboard routes are protected by StaffGuard */}
          <Route
            path="/dashboard"
            element={
              <StaffGuard>
                <DashboardLayout />
              </StaffGuard>
            }
          >
            <Route index element={<StaffDashboard />} />
            <Route path="staff" element={<ManageStaff />} />
            <Route path="reports" element={<ReportsDashboard />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
