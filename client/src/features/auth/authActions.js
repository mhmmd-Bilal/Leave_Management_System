import { createAction } from "@reduxjs/toolkit";

// Dispatched by the base query when the server answers 401 for an authenticated request.
export const sessionExpired = createAction("auth/sessionExpired");
