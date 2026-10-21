import { createSlice } from "@reduxjs/toolkit";
import { saveCsrfToken } from "../../utils/csrf.js";
import { sessionExpired } from "./authActions.js";
import { authApi } from "./authApi.js";

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, initialized: false },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sessionExpired, (state) => {
        state.user = null;
        saveCsrfToken(null);
      })
      .addMatcher(authApi.endpoints.getMe.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.initialized = true;
      })
      .addMatcher(authApi.endpoints.getMe.matchRejected, (state, { payload }) => {
        // Only an auth failure clears the session. A network blip or 5xx keeps the current user.
        if (payload?.status === 401 || payload?.status === 403) state.user = null;
        state.initialized = true;
      })
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.initialized = true;
        saveCsrfToken(payload.csrfToken);
      })
      .addMatcher(authApi.endpoints.updateProfile.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
      })
      .addMatcher(authApi.endpoints.changePassword.matchFulfilled, (_state, { payload }) => {
        saveCsrfToken(payload.csrfToken); // the server rotated the session
      })
      .addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
        state.user = null;
        saveCsrfToken(null);
      })
      .addMatcher(authApi.endpoints.logout.matchRejected, (state) => {
        state.user = null;
        saveCsrfToken(null);
      });
  },
});

export default authSlice.reducer;
export const selectCurrentUser = (state) => state.auth.user;
export const selectAuthInitialized = (state) => state.auth.initialized;
