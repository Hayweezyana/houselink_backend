import express, { Request, Response } from "express";
import multer from "multer";
import { storage as cloudinaryStorage } from "../config/cloudinary";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();
const upload = multer({ storage: cloudinaryStorage as any });

router.post(
  "/media",
  authMiddleware,
  upload.array("files", 10),
  (req: Request, res: Response) => {
    try {
      const urls = (req.files as Express.Multer.File[]).map((f: any) => f.path || f.secure_url);
      res.json({ urls });
    } catch {
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

export default router;
