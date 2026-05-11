// src/middleware/upload.js
// Handles image uploads using multer (memory storage) + sharp (optimisation).
// Raster images are resized to max 1200px wide, converted to JPEG at 80% quality.
// SVGs are saved as-is via uploadSvg() — sharp is never called on vector files.
// Results are stored in req.uploadedFile / req.uploadedFiles for the controller.

const multer = require('multer');
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const { AppError } = require('../utils/errors');

const UPLOAD_DIR     = path.join(__dirname, '../../public/uploads');
const MAX_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880', 10); // 5MB default
const ALLOWED_TYPES      = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_TYPES_ALL  = [...ALLOWED_TYPES, 'image/svg+xml'];

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Store in memory so sharp can process the buffer before writing to disk
const storage = multer.memoryStorage();

// Raster-only multer — used by upload() for general image fields
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

// Mixed multer — accepts raster and SVG in a single pass, used by uploadFields
const multerMixed = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter(req, file, cb) {
    if (ALLOWED_TYPES_ALL.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, WebP, GIF, and SVG images are allowed', 400));
    }
  },
});

// Shared helper — saves a processed raster file via sharp and returns its public URL.
async function processRasterFile(file, subdir) {
  const filename  = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.jpg`;
  const targetDir = subdir ? path.join(UPLOAD_DIR, subdir) : UPLOAD_DIR;

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  await sharp(file.buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(path.join(targetDir, filename));

  return subdir ? `/uploads/${subdir}/${filename}` : `/uploads/${filename}`;
}

// Middleware factory — call as upload('image', 'menu') where 'image' is the form field name
// and 'menu' is the subdirectory within uploads/
function upload(fieldName, subdir = '') {
  return [
    // Step 1: multer receives the file into memory
    multerUpload.single(fieldName),

    // Step 2: if a file was uploaded, process it with sharp
    async (req, res, next) => {
      if (!req.file) return next(); // no file uploaded — that's fine, field is optional

      try {
        req.uploadedFile = await processRasterFile(req.file, subdir);
        next();
      } catch (err) {
        next(new AppError('Image processing failed', 500));
      }
    },
  ];
}

// Shared helper — saves an SVG buffer directly to disk and returns its public URL.
function processSvgFile(file, subdir) {
  const filename  = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.svg`;
  const targetDir = subdir ? path.join(UPLOAD_DIR, subdir) : UPLOAD_DIR;

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  fs.writeFileSync(path.join(targetDir, filename), file.buffer);

  return subdir ? `/uploads/${subdir}/${filename}` : `/uploads/${filename}`;
}

// Middleware factory for multiple named file fields.
// Accepts raster and SVG in a single multer pass.
// SVGs are written directly; rasters are processed through sharp.
// Sets req.uploadedFiles = { fieldName: urlPath, ... } for the controller.
function uploadFields(fields) {
  const multerFields = fields.map(f => ({ name: f.name, maxCount: 1 }));
  return [
    multerMixed.fields(multerFields),

    async (req, res, next) => {
      if (!req.files || Object.keys(req.files).length === 0) return next();
      req.uploadedFiles = {};

      try {
        for (const { name, subdir = '' } of fields) {
          const fileArr = req.files[name];
          if (!fileArr || fileArr.length === 0) continue;

          const file = fileArr[0];
          req.uploadedFiles[name] = file.mimetype === 'image/svg+xml'
            ? processSvgFile(file, subdir)
            : await processRasterFile(file, subdir);
        }
        next();
      } catch (err) {
        next(new AppError('Image processing failed', 500));
      }
    },
  ];
}

module.exports = { upload, uploadFields };
