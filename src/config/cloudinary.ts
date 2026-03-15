import cloudinaryV2 from "cloudinary";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerCloudinary = require("multer-storage-cloudinary");
const CloudinaryStorage = multerCloudinary.CloudinaryStorage ?? multerCloudinary.default?.CloudinaryStorage ?? multerCloudinary;

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
