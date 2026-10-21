/** Shared Mongoose toJSON transform: exposes `id`, hides internals and secrets. */
export function cleanJson(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  delete ret.passwordHash;
  delete ret.tokenVersion;
  delete ret.leaveVersion;
  return ret;
}
