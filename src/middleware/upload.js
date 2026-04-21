// src/middleware/upload.js
// Handles image uploads using multer (memory storage) + sharp (optimisation).
// Images are resized to a max of 1200px wide, converted to JPEG at 80% quality,
// and saved to /public/uploads/. The resulting filename is stored in req.uploadedFile
// for the controller to save to the database.

const multer = require('multer');
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const { AppError } = require('../utils/errors');

const UPLOAD_DIR     = path.join(__dirname, '../../public/uploads');
const MAX_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880', 10); // 5MB default
const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Store in memory so sharp can process the buffer before writing to disk
const storage = multer.memoryStorage();

const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter(req, file, cb) {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, WebP, and GIF images are allowed', 400));
    }
  },
});

// Middleware factory — call as upload('image') where 'image' is the form field name
function upload(fieldName) {
  return [
    // Step 1: multer receives the file into memory
    multerUpload.single(fieldName),

    // Step 2: if a file was uploaded, process it with sharp
    async (req, res, next) => {
      if (!req.file) return next(); // no file uploaded — that's fine, field is optional

      try {
        const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.jpg`;
        const outputPath = path.join(UPLOAD_DIR, filename);

        await sharp(req.file.buffer)
          .resize({ width: 1200, withoutEnlargement: true }) // never upscale
          .jpeg({ quality: 80 })
          .toFile(outputPath);

        // Expose the public-facing URL path to the controller
        req.uploadedFile = `/uploads/${filename}`;
        next();
      } catch (err) {
        next(new AppError('Image processing failed', 500));
      }
    },
  ];
}

module.exports = { upload };
