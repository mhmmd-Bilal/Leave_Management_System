import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { homeFor } from "../utils/constants.js";
import Spinner from "./ui/Spinner.jsx";

/** Frontend route guard (UX only - every permission is enforced again by the backend). */
export default function ProtectedRoute({ roles }) {
  const { user, initialized } = useAuth();
  const location = useLocation();
  if (!initialized) return <div className="flex min-h-screen items-center justify-center"><Spinner label="Checking session..." /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
