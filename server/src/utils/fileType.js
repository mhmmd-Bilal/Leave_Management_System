// Content-based file type detection (magic numbers). The client-supplied filename and MIME type
// are never trusted on their own.
export const MIME_TO_KIND = {
  "application/pdf": "pdf",
  "image/jpeg": "jpeg",
  "image/png": "png",
};
export const KIND_TO_EXT = { pdf: ".pdf", jpeg: ".jpg", png: ".png" };

export function detectFileType(buf) {
  if (!buf || buf.length < 5) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 8 && png.every((b, i) => buf[i] === b)) return "png";
  return null;
}
