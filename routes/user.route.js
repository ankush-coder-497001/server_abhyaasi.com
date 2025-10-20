const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const UserController = require('../controllers/user.ctrl');


// this is for uploading single images 
// this will return the url of the uploaded image 
// public route
router.post('/upload-image', upload.single('image'), UserController.uploadImage);

module.exports = router;