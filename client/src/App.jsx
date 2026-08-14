import { Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./pages/AdminLogin.jsx";
import RegistrationForm from "./pages/RegistrationForm.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import DeleteRecords from "./pages/DeleteRecords.jsx";
import TenantPortal from "./pages/TenantPortal.jsx";
import Receipt from "./pages/Receipt.jsx";
import Terms from "./pages/Terms.jsx";
import TenantProfile from "./pages/TenantProfile.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/register" element={<RegistrationForm />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/delete" element={<DeleteRecords />} />
      <Route path="/portal" element={<TenantPortal />} />
      <Route path="/receipt" element={<Receipt />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/profile" element={<TenantProfile />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
