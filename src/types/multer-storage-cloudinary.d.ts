declare module "multer-storage-cloudinary" {
  import { StorageEngine } from "multer";
  import { v2 as cloudinary } from "cloudinary";

  interface CloudinaryStorageOptions {
    cloudinary: typeof cloudinary;
    params?: Record<string, unknown> | ((req: Express.Request, file: Express.Multer.File) => Record<string, unknown>);
    [key: string]: unknown;
  }

  class CloudinaryStorage implements StorageEngine {
    constructor(options: CloudinaryStorageOptions);
    _handleFile(req: Express.Request, file: Express.Multer.File, cb: (error?: Error | null, info?: Partial<Express.Multer.File>) => void): void;
    _removeFile(req: Express.Request, file: Express.Multer.File, cb: (error: Error | null) => void): void;
  }

  export { CloudinaryStorage };
}
