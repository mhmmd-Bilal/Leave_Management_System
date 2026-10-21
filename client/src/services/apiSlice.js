import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { sessionExpired } from "../features/auth/authActions.js";
import { isAuthProbe } from "../utils/authProbe.js";
import { getCsrfToken } from "../utils/csrf.js";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || ""}/api`,
  credentials: "include", // HTTP-only JWT cookie
  prepareHeaders: (headers) => {
    const csrf = getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
    return headers;
  },
});

// Handles expired/revoked sessions centrally: a 401 anywhere else logs the user out locally.
const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && !isAuthProbe(args)) {
    api.dispatch(sessionExpired());
    api.dispatch(apiSlice.util.resetApiState());
  }
  return result;
};

export const TAGS = [
  "Me", "LeaveTypes", "Leave", "MyLeaves", "HrLeaves", "Balances", "Adjustments", "Employees",
  "Registrations", "HrAccounts", "AdminAccounts", "Notifications", "Dashboard", "Calendar", "Reports", "Settings", "Audit",
];

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: TAGS,
  refetchOnFocus: true, // data is refreshed when the tab regains focus ...
  refetchOnReconnect: true, // ... or the network comes back (needs setupListeners in the store)
  endpoints: () => ({}),
});

export const unwrap = (response) => response.data;
