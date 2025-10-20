const cloudinary = require('../config/cloudinary')
const fs = require('fs');
const UserController = {
  uploadImage: async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'myUploads', // Optional: cloudinary folder
      });

      // Delete the local file after upload
      fs.unlinkSync(req.file.path);

      return res.status(200).json({
        message: 'Image uploaded successfully',
        url: result.secure_url,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Upload failed', error });
    }
  }

}

module.exports = UserController;