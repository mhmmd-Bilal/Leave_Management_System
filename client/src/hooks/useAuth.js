import { useSelector } from "react-redux";
import { selectAuthInitialized, selectCurrentUser } from "../features/auth/authSlice.js";

export function useAuth() {
  const user = useSelector(selectCurrentUser);
  const initialized = useSelector(selectAuthInitialized);
  return { user, role: user?.role, initialized, isAuthenticated: Boolean(user) };
}
