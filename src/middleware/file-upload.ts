/**
 * Multer file upload configuration.
 *
 * Uses memory storage so file buffers can be uploaded directly to
 * Cloudinary without touching the local filesystem.
 *
 * Constraints: 10 MB max, JPEG/PNG/WebP only.
 */

import multer from 'multer';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});
