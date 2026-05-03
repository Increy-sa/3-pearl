import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClientPortal } from './pages/ClientPortal';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { StaffDashboard } from './pages/admin/StaffDashboard';
import { ManageStaff } from './pages/admin/ManageStaff';
import { ReportsDashboard } from './pages/admin/ReportsDashboard';
import { AdminSettings } from './pages/admin/AdminSettings';
import { Login } from './pages/auth/Login';
import { CustomerDashboard } from './pages/customer/CustomerDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/client" replace />} />
        <Route path="/client" element={<ClientPortal />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/customer" element={<CustomerDashboard />} />
        
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<StaffDashboard />} />
          <Route path="staff" element={<ManageStaff />} />
          <Route path="reports" element={<ReportsDashboard />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
