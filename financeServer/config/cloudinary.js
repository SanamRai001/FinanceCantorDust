// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// ── Cloudinary config ─────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer storage using Cloudinary ───────
// replaces local diskStorage in transactionRoutes.js
export const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'finance-attachments', // folder name in your Cloudinary account
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
    resource_type:  'auto', // handles both images and PDFs
    transformation: [{ quality: 'auto' }] // auto compress images
  }
});

export default cloudinary;