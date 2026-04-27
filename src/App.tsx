import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { ClientPortal } from "@/pages/ClientPortal";
import NotFound from "@/pages/NotFound";
import Index from "./pages/Index.tsx";
import HomePage from "./pages/HomePage.tsx";
import ServicePage from "./pages/ServicePage.tsx";

const queryClient = new QueryClient();

function homePathForRole(role?: string) {
  if (role === "client") {
    return "/client/tickets";
  }
  if (role === "inorins") {
    return "/staff/dashboard";
  }
  return "/login";
}

function FullScreenMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function RequireRole({ role, children }: { role: "client" | "inorins"; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullScreenMessage message="Restoring session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== role) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenMessage message="Restoring session..." />;
  }

  const homePath = homePathForRole(user?.role);

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homePath} replace /> : <LoginPage />}
      />

      <Route
        path="/staff/*"
        element={(
          <RequireRole role="inorins">
            <Index />
          </RequireRole>
        )}
      />

      <Route
        path="/client/*"
        element={(
          <RequireRole role="client">
            <ClientPortal />
          </RequireRole>
        )}
      />

      <Route path="/" element={<HomePage />} />
      <Route path="/service/:slug" element={<ServicePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
