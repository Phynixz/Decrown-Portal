import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import AdminLogin from "./pages/AdminLogin.jsx";
import RegistrationForm from "./pages/RegistrationForm.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import LandlordDashboard from "./pages/LandlordDashboard.jsx";
import PropertyForm from "./pages/PropertyForm.jsx";
import OperationsWorkspace from "./pages/OperationsWorkspace.jsx";
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
import LandingPage from "./pages/LandingPage.jsx";
import RoomSearchPage from "./pages/RoomSearchPage.jsx";
import RoomDetailsPage from "./pages/RoomDetailsPage.jsx";
import { getJSON } from "./api.js";

import { TenantProvider } from "./tenantContext.jsx";

function DirectorWorkspaceRoute() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState({ loading: true, error: "", name: "" });

  useEffect(() => {
    const token = sessionStorage.getItem("platformToken") || "";
    if (!token) {
      navigate("/platform/login", { replace: true });
      return;
    }
    if (sessionStorage.getItem("platformRole") !== "owner") {
      navigate("/platform/clients", { replace: true });
      return;
    }
    let cancelled = false;
    getJSON(`/platform/tenants/${clientId}/stats`, token)
      .then((stats) => {
        if (!cancelled)
          setWorkspace({ loading: false, error: "", name: stats.businessName });
      })
      .catch((error) => {
        if (!cancelled)
          setWorkspace({ loading: false, error: error.message, name: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, navigate]);

  if (workspace.loading)
    return <main className="grid min-h-screen place-items-center text-sm text-muted">Loading landlord workspace…</main>;
  if (workspace.error)
    return <main className="mx-auto max-w-2xl px-6 py-16 text-sm text-danger">{workspace.error}</main>;
  return (
    <OperationsWorkspace
      directorAccess
      clientId={clientId}
      clientName={workspace.name}
    />
  );
}

export default function App() {
  return (
    <TenantProvider>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/rooms" element={<RoomSearchPage />} />
      <Route path="/rooms/:propertyId" element={<RoomDetailsPage />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/signup" element={<ClientSignup />} />
      <Route path="/register" element={<RegistrationForm />} />
      <Route path="/admin" element={<LandlordDashboard />} />
      <Route path="/admin/operations" element={<OperationsWorkspace />} />
      <Route path="/admin/legacy-operations" element={<AdminDashboard />} />
      <Route path="/admin/properties/new" element={<PropertyForm />} />
      <Route path="/delete" element={<DeleteRecords />} />
      <Route path="/portal" element={<TenantPortal />} />
      <Route path="/receipt" element={<Receipt />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/profile" element={<TenantProfile />} />

      <Route path="/platform/login" element={<PlatformLogin />} />
      {/* Friendly operator URLs; /platform remains the canonical route. */}
      <Route path="/operator" element={<Navigate to={sessionStorage.getItem("platformToken") ? "/platform" : "/platform/login"} replace />} />
      <Route path="/operator/login" element={<Navigate to="/platform/login" replace />} />
      <Route path="/operator/clients" element={<Navigate to="/platform/clients" replace />} />
      <Route path="/operator/settings" element={<Navigate to="/platform/settings" replace />} />
      <Route
        path="/platform/clients/:clientId/workspace"
        element={<DirectorWorkspaceRoute />}
      />
      <Route path="/platform" element={<PlatformLayout />}>
        <Route index element={<PlatformOverview />} />
        <Route path="clients" element={<PlatformClients />} />
        <Route path="settings" element={<PlatformSettings />} />
      </Route>
      {/* Old approval-queue links now enter the unified operator dashboard. */}
      <Route path="/platform/queue" element={<Navigate to="/platform/clients" replace />} />
      <Route path="/operator/*" element={<Navigate to="/platform" replace />} />

      {/* Unknown public URLs return to the public homepage, not an admin login. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </TenantProvider>
);
}
