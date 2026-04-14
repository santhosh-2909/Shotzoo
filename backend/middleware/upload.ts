import multer, { StorageEngine, FileFilterCallback } from 'multer';
import { Request } from 'express';

/**
 * In-memory storage so the file lives in `req.file.buffer`.
 * Controllers convert the buffer to a `data:image/...;base64,...` URL
 * and store it on the User document. This avoids any disk write,
 * which is required on serverless platforms (Vercel, Netlify, etc.)
 * where the filesystem is read-only.
 *
 * Size cap is intentionally low (1 MB) because the base64-encoded
 * image is stored inline in the User document.
 */
const storage: StorageEngine = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: function (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    if (/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, png, gif, webp) are allowed'));
    }
  },
  limits: { fileSize: 1 * 1024 * 1024 },
});

/** Convert a multer in-memory file to a `data:<mime>;base64,<payload>` URL. */
export function fileToDataUrl(file: Express.Multer.File | undefined): string | null {
  if (!file?.buffer) return null;
  return 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64');
}

export default upload;
