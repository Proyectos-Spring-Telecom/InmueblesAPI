import * as multer from "multer";

export const MULTIPART_FILE_OPTIONS = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Solo se permiten PNG, JPG, JPEG o PDF"), false);
    }
    cb(null, true);
  },
};
