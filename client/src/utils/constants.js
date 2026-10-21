export const homeFor = (role) => ({ employee: "/employee", hr: "/hr", admin: "/admin" }[role] || "/login");
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"];
export const ACCOUNT_STATUSES = ["pending", "active", "rejected", "disabled", "relieved"];
export const MAX_UPLOAD_MB = 5;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"];
