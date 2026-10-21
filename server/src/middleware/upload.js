import multer from "multer";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import { detectFileType, MIME_TO_KIND } from "../utils/fileType.js";

const ALLOWED_EXT = /\.(pdf|jpe?g|png)$/i;

// Memory storage: the file is never written to the server's disk; it is streamed to Cloudinary.
export const uploadMedicalDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxBytes, files: 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    if (!MIME_TO_KIND[file.mimetype] || !ALLOWED_EXT.test(file.originalname || "")) {
      return cb(new ApiError(422, "Only PDF, JPG, JPEG and PNG files are allowed"));
    }
    return cb(null, true);
  },
}).single("medicalDocument");

/** Content inspection (magic bytes): the declared type must match the real file content. */
export function verifyUploadedFile(req, _res, next) {
  if (!req.file) return next();
  const detected = detectFileType(req.file.buffer);
  if (!detected || detected !== MIME_TO_KIND[req.file.mimetype]) {
    return next(new ApiError(422, "The uploaded file content does not match an allowed PDF, JPG or PNG file"));
  }
  return next();
}
