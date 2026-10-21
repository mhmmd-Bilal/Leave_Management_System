export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const exactCI = (s) => new RegExp(`^${escapeRegex(s)}$`, "i");
export const containsCI = (s) => new RegExp(escapeRegex(s), "i");
