const cloudinary = require('../config/cloudinary')
const fs = require('fs');
const UserModel = require('../models/user.model');
const submissionModel = require('../models/submission.model');
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
  },
  registerUser: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
      }

      const isExistingUser = await UserModel.findOne({ email });
      if (isExistingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const newUser = new UserModel({ name, email, password, role });
      await newUser.save();

      const token = newUser.generateAuthToken();

      return res.status(201).json({ message: 'User registered successfully', user: newUser, token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Registration failed', error });
    }
  },
  registerOrLoginUserViaGoogleAuth: async (req, res) => {
    try {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
      }
      let user = await UserModel.findOne({ email });
      if (!user) {
        user = new UserModel({ name, email, password: Math.random().toString(36).slice(-8) });
        await user.save();
      }
      const token = user.generateAuthToken();
      return res.status(200).json({ message: 'User logged in successfully', user, token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Google Auth failed', error });
    }
  },
  loginUser: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      const user = await UserModel.findOne({ email });
      if (!user || !user.comparePassword(password)) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      const token = user.generateAuthToken();
      user.lastLogin = new Date();
      await user.save();
      return res.status(200).json({ message: 'User logged in successfully', user, token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Login failed', error });
    }
  },
  updateUserProfile: async (req, res) => {
    try {
      const updateData = req.body;
      const userId = req.user.userId;
      const user = await UserModel.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await user.save();
      return res.status(200).json({ message: 'Profile updated successfully', profile: user.profile });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Profile update failed', error });
    }
  },
  getUserProfile: async (req, res) => {
    try {
      const userId = req.user.userId;
      const user = await UserModel.findById(userId).select('-password -otp -otpExpiry');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({ profile: user });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to fetch profile', error });
    }
  },
  forgotPassword_sendOTP: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const otp = user.generateOTP();
      await user.save();
      // Here, you would typically send the OTP via email. For simplicity, we return it in the response.
      return res.status(200).json({ message: 'OTP generated successfully', otp });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to initiate password reset', error });
    }
  },
  forgotPassword_verifyOTP: async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: 'Email, OTP, and new password are required' });
      }
      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!user.verifyOTP(otp)) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
      user.password = newPassword;
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
      return res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to reset password', error });
    }
  },
  resetPassword: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required' });
      }
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.comparePassword(currentPassword)) {
        return res.status(401).json({ message: 'Invalid current password' });
      }
      user.password = newPassword;
      await user.save();
      return res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to change password', error });
    }
  },
  add_OR_update_profile: async (req, res) => {
    try {
      const { userId } = req.user;
      const { bio, college, year, profilePic } = req.body;

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      user.profile.bio = bio || user.profile.bio;
      user.profile.college = college || user.profile.college;
      user.profile.year = year || user.profile.year;
      user.profile.profilePic = profilePic || user.profile.profilePic;
      await user.save();
      return res.status(200).json({ message: 'Profile added successfully', profile: user.profile });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to add profile', error });
    }
  },
  get_user: async (req, res) => {
    try {
      const { userId } = req.user;
      const user = await UserModel.findById(userId).select('-password -otp -otpExpiry');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // let's calculate rank based on points 
      //  from submissions
      const submissions = await submissionModel.find({ userId });
      const totalPoints = submissions.reduce((acc, sub) => acc + sub.points, 0);
      user.rank = calculateRank(totalPoints);
      user.points = totalPoints;
      await user.save();
      return res.status(200).json({ profile: user });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to retrieve profile', error });
    }
  }
};

function calculateRank(points) {
  if (points >= 1000) return 'Gold';
  if (points >= 500) return 'Silver';
  return 'Bronze';
}
module.exports = UserController;