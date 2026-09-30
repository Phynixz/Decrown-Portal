const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const hasCloudinaryConfig =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

let storage;

if (hasCloudinaryConfig) {
  const cloudinary = require("cloudinary").v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const isPDF = file.mimetype === "application/pdf";
      return {
        folder: req.tenantClient
          ? `receipt-system/${req.tenantClient.subdomain}`
          : "receipt-system",
        resource_type: isPDF ? "raw" : "image",
      };
    },
  });
} else {
  storage = multer.memoryStorage();
}

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 4, fields: 30 },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error("Only JPEG, PNG, WebP, GIF, and PDF files are allowed"));
    }
    callback(null, true);
  },
});
