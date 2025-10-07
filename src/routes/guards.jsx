// src/routes/guards.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth"; // adjust path if yours is ../auth
import FullScreenLoader from "../components/FullScreenLoader";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

export function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (ADMIN_UID && user.uid !== ADMIN_UID) {
    return (
      <div className="p-6 text-red-600">
        403 — You don’t have access to this page.
      </div>
    );
  }
  return children;
}
