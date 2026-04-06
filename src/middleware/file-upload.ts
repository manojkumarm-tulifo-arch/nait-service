/**
 * Multer file upload configuration.
 *
 * Routes files to uploads/photos/ or uploads/id-proofs/ based on the
 * form field name. Filenames are UUID-based to avoid collisions and
 * prevent path-traversal via user-supplied names.
 *
 * Constraints: 10 MB max, JPEG/PNG/WebP only.
 */

import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dest = _file.fieldname === 'photo' ? 'uploads/photos' : 'uploads/id-proofs';
    cb(null, dest);
  },
  filename(_req, file, cb) {
    // UUID filename prevents collisions and path-traversal attacks
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${crypto.randomUUID()}${ext}`;
    cb(null, name);
  },
});

export const upload = multer({
  storage,
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
