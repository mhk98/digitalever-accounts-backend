const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images"); // Set destination folder
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`; // Generate unique file name
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|gif|webp|pdf/;

  const mimeType = fileTypes.test(file.mimetype);
  const extname = fileTypes.test(path.extname(file.originalname));
  if (mimeType && extname) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file format. Supported formats: jpeg, jpg, png, gif, webp",
      ),
    );
  }
};

const uploadFile = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
}).single("file"); // Use "file" as the field name for PDF uploads

const uploadPdf = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
}).single("file"); // Use "file" as the field name for PDF uploads

// Configure upload for single and multiple file uploads
const uploadSingle = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // 5 MB limit
  fileFilter: fileFilter,
}).single("image");

const uploadMultiple = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // 5 MB limit per file
  fileFilter: fileFilter,
}).array("gallery_images", 10); // Allow up to 10 files

module.exports = {
  uploadFile,
  uploadSingle,
  uploadMultiple,
};
