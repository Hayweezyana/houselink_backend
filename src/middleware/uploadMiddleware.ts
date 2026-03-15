import multer from "multer";
import { storage as cloudinaryStorage } from "../config/cloudinary";

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime", // .mov
];

const upload = multer({
  storage: cloudinaryStorage as any,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error("Only images (jpg, png, webp) and videos (mp4, mov) are allowed") as any;
      err.status = 400;
      cb(err);
    }
  },
});

export default upload;
