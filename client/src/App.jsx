import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import AdminLogin from "./pages/AdminLogin.jsx";
import RegistrationForm from "./pages/RegistrationForm.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import LandlordDashboard from "./pages/LandlordDashboard.jsx";
import PropertyForm from "./pages/PropertyForm.jsx";
import DeleteRecords from "./pages/DeleteRecords.jsx";
import TenantPortal from "./pages/TenantPortal.jsx";
import Receipt from "./pages/Receipt.jsx";
import Terms from "./pages/Terms.jsx";
import TenantProfile from "./pages/TenantProfile.jsx";
import ClientSignup from "./pages/ClientSignup.jsx";
import PlatformLogin from "./pages/platform/PlatformLogin.jsx";
import PlatformLayout from "./pages/platform/PlatformLayout.jsx";
import PlatformOverview from "./pages/platform/PlatformOverview.jsx";
import PlatformClients from "./pages/platform/PlatformClients.jsx";
import PlatformSettings from "./pages/platform/PlatformSettings.jsx";
import ApprovalQueue from "./pages/ApprovalQueue.jsx";

import { TenantProvider } from "./tenantContext.jsx";

export default function App() {
  return (
    <TenantProvider>
      <Routes>
      <Route path="/" element={<Navigate to="/platform/login" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/signup" element={<ClientSignup />} />
      <Route path="/register" element={<RegistrationForm />} />
      <Route path="/admin" element={<LandlordDashboard />} />
      <Route path="/admin/operations" element={<AdminDashboard />} />
      <Route path="/admin/properties/new" element={<PropertyForm />} />
      <Route path="/delete" element={<DeleteRecords />} />
      <Route path="/portal" element={<TenantPortal />} />
      <Route path="/receipt" element={<Receipt />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/profile" element={<TenantProfile />} />

      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform" element={<PlatformLayout />}>
        <Route index element={<PlatformOverview />} />
        <Route path="clients" element={<PlatformClients />} />
        <Route path="settings" element={<PlatformSettings />} />
      </Route>
      <Route path="/platform/queue" element={<ApprovalQueue />} />

      <Route path="*" element={<Navigate to="/platform/login" replace />} />
    </Routes>
  </TenantProvider>
);
}
