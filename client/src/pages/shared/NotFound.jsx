import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { homeFor } from "../../utils/constants.js";

export default function NotFound() {
  const { role } = useAuth();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <p className="text-slate-600">This page does not exist.</p>
      <Link to={role ? homeFor(role) : "/login"} className="text-sm font-medium text-brand-600 hover:underline">Go to the app</Link>
    </div>
  );
}
