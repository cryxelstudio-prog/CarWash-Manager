import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import AppShell from "./components/layout/AppShell";
import LoginPage from "./pages/LoginPage";
import SetupWizard from "./pages/SetupWizard";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import VehiclesPage from "./pages/VehiclesPage";
import ServicesPage from "./pages/ServicesPage";
import PackagesPage from "./pages/PackagesPage";
import BookingsPage from "./pages/BookingsPage";
import QueuePage from "./pages/QueuePage";
import CalendarPage from "./pages/CalendarPage";
import EmployeesPage from "./pages/EmployeesPage";
import AttendancePage from "./pages/AttendancePage";
import PaymentsPage from "./pages/PaymentsPage";
import InvoicesPage from "./pages/InvoicesPage";
import CashUpPage from "./pages/CashUpPage";
import InventoryPage from "./pages/InventoryPage";
import SuppliersPage from "./pages/SuppliersPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReportsPage from "./pages/ReportsPage";
import BranchesPage from "./pages/BranchesPage";
import WashBaysPage from "./pages/WashBaysPage";
import QuickBookPage from "./pages/QuickBookPage";
import NotificationsPage from "./pages/NotificationsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import AuditPage from "./pages/AuditPage";
import ActivityPage from "./pages/ActivityPage";
import DiagnosticsPage from "./pages/DiagnosticsPage";
import BackupPage from "./pages/BackupPage";
import HelpPage from "./pages/HelpPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { loading, user, setupRequired } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (setupRequired) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loading, user, setupRequired } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;

  return (
    <Routes>
      <Route path="/setup" element={setupRequired ? <SetupWizard /> : <Navigate to="/" replace />} />
      <Route path="/login" element={!setupRequired && !user ? <LoginPage /> : <Navigate to="/" replace />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="quick-book" element={<QuickBookPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="cashup" element={<CashUpPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="wash-bays" element={<WashBaysPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        <Route path="backup" element={<BackupPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
