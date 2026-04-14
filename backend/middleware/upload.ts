import multer, { StorageEngine, FileFilterCallback } from 'multer';
import path from 'node:path';
import { Request } from 'express';

const storage: StorageEngine = multer.diskStorage({
  destination: function (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: function (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    if (/jpeg|jpg|png|gif|webp/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;
