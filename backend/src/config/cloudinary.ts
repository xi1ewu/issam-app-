import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'da-consulting/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  } as object,
});

const fileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'da-consulting/files',
    allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    resource_type: 'auto',
  } as object,
});

export const uploadAvatar = multer({ storage: avatarStorage });
export const uploadFile = multer({ storage: fileStorage });
