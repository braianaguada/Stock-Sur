import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { canManageUsers } from "@/lib/permissions";

export function ProtectedRoute({ children, requiresSuperadmin = false }: { children: ReactNode; requiresSuperadmin?: boolean }) {
  const { session, loading, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (requiresSuperadmin && !canManageUsers(roles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
