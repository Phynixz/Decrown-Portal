import { createContext, useContext, useEffect, useState } from "react";
import { withTenantContext } from "./api.js";

const TenantContext = createContext({
  businessName: "De-Crown Cottage",
  branding: {},
  bankDetails: {},
  phone: "",
  email: "",
  locations: [],
  loading: true,
});

export function TenantProvider({ children }) {
  const [config, setConfig] = useState({
    businessName: "De-Crown Cottage",
    branding: {},
    bankDetails: {},
    phone: "",
    email: "",
    locations: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(withTenantContext("/tenant-config"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const primaryColor = data.branding?.primaryColor;
        if (primaryColor && CSS.supports("color", primaryColor)) {
          document.documentElement.style.setProperty(
            "--color-navy",
            primaryColor,
          );
        }
        if (data.businessName) {
          document.title = `${data.businessName} | Property Portal`;
        }
        setConfig({
          businessName: data.businessName || "De-Crown Cottage",
          branding: data.branding || {},
          bankDetails: data.bankDetails || {},
          phone: data.phone || "",
          email: data.email || "",
          locations: data.locations || [],
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setConfig((c) => ({ ...c, loading: false }));
      });

    return () => {
      cancelled = true;
      document.documentElement.style.removeProperty("--color-navy");
    };
  }, []);

  return (
    <TenantContext.Provider value={config}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
