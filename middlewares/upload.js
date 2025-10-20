const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png' && ext !== '.webp') {
    return cb(new Error('Only images are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

module.exports = upload;