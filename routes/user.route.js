const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const UserController = require('../controllers/user.ctrl');
const Auth = require('../middlewares/auth')


router.post('/register', UserController.registerUser);
router.post('/login', UserController.loginUser);
router.get('/profile', Auth, UserController.getUserProfile);
router.put('/profile', Auth, UserController.updateUserProfile);
router.post('/register_or_login_via_oauth', UserController.registerOrLoginUserViaGoogleAuth);
router.post('/forgot_password_send_otp', UserController.forgotPassword_sendOTP);
router.post('/forgot_password_verify_otp', UserController.forgotPassword_verifyOTP);
router.post('/reset_password', UserController.resetPassword);


// profile routes
router.put('/add_OR_update_profile', Auth, UserController.add_OR_update_profile);
router.get('/get_user', Auth, UserController.get_user);
// this is for uploading single images 
// this will return the url of the uploaded image 
// public route
router.post('/upload-image', upload.single('image'), UserController.uploadImage);

module.exports = router;