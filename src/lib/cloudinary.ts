/**
 * Cloudinary upload helper.
 *
 * Uploads image buffers (from multer memory storage) to Cloudinary
 * and returns the secure URL. Photos go to the "photos" folder,
 * ID proofs go to the "id-proofs" folder.
 */

import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image buffer to Cloudinary.
 * @param buffer - The file buffer from multer
 * @param folder - Cloudinary folder name (e.g. "photos", "id-proofs")
 * @returns The secure URL of the uploaded image
 */
export async function uploadImage(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `nait/${folder}`,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result!.secure_url);
      },
    );
    stream.end(buffer);
  });
}
