import cloudinaryV2 from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const cloudinary = cloudinaryV2.v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "houselink-properties",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "mp4", "mov"],
    resource_type: "auto",
  } as any,
});

export { cloudinary, storage };
export default cloudinary;
