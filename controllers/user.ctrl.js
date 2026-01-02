const cloudinary = require('../config/cloudinary')
const fs = require('fs');
const UserModel = require('../models/user.model');
const submissionModel = require('../models/submission.model');
const EmailService = require('../services/email.svc');
const POINTS = require('../constants/points');
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

      const profile = {
        bio: 'Hey there! I am using Abhyaasi.',
        college: 'College ! Who cares',
        year: 1,
      }

      const newUser = new UserModel({ name, email, password, role, profile });
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
      let user = await UserModel.findOne({ email })
        .populate('completedCourses.courseId')
        .populate('completedProfessions.professionId');
      if (!user) {
        user = new UserModel({ name, email, password: Math.random().toString(36).slice(-8), isOauthUser: true });
        const token = user.generateAuthToken();
        await user.save();
        return res.status(201).json({ message: 'User registered via Google Auth successfully', user, token });
      }
      if (!user.isOauthUser) {
        return res.status(400).json({ message: 'Email already registered without OAuth. Please login using email and password.' });
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
      const user = await UserModel.findOne({ email })
        .populate('completedCourses.courseId')
        .populate('completedProfessions.professionId');
      if (!user || !user.comparePassword(password)) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      if (user.isOauthUser) {
        return res.status(400).json({ message: 'This account is registered via OAuth. Please login using Google Auth.' });
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
      const user = await UserModel.findById(userId)
        .select('-password -otp -otpExpiry')
        .populate('completedCourses.courseId', 'title description duration modules difficulty')
        .populate('completedProfessions.professionId', 'name description courses estimatedDuration');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({ profile: user });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to fetch profile', error });
    }
  },
  forgot_password: async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // check if email is verified via otp before allowing password reset
      if (user.otp !== null) {
        return res.status(400).json({ message: 'Email not verified. Please verify OTP before resetting password' });
      }
      user.password = password;
      await user.save();
      return res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to initiate password reset', error });
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
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: 'Email, OTP are required' });
      }
      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!user.verifyOTP(otp)) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
      return res.status(200).json({ message: 'OTP verified successfully' });
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
      const user = await UserModel.findById(userId)
        .select('-password -otp -otpExpiry')
        .populate({
          path: 'currentCourse',
          select: 'title description duration modules',
          populate: {
            path: 'modules',
            select: '_id title order topics isMcqCompleted isCodingCompleted'
          }
        })
        .populate('currentModule', 'title order topics')
        .populate('currentProfession', 'name description')
        .populate('completedCourses.courseId', 'title description duration modules difficulty')
        .populate('completedProfessions.professionId', 'name description courses estimatedDuration');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // If user has a current course, fetch module completion status
      if (user.currentCourse && user.currentCourse.modules) {
        const submissionModel = require('../models/submission.model');
        const moduleProgress = [];

        // If user is enrolled in a profession, get all courses from profession
        let coursesToCheck = [user.currentCourse];

        if (user.currentProfession) {
          // Fetch profession with all its courses
          const ProfessionModel = require('../models/profession.model');
          const profession = await ProfessionModel.findById(user.currentProfession)
            .populate({
              path: 'courses.course',
              select: 'modules title'
            });

          if (profession && profession.courses) {
            coursesToCheck = profession.courses.map(pc => pc.course).filter(c => c && c._id);
          }
        }

        // Now iterate through all courses to check module progress
        for (const course of coursesToCheck) {
          if (course && course.modules && Array.isArray(course.modules)) {
            for (const module of course.modules) {
              const moduleId = typeof module === 'object' ? module._id : module;

              const mcqSubmission = await submissionModel.findOne({
                userId,
                moduleId,
                type: 'mcq',
                status: 'passed'
              });

              const codingSubmission = await submissionModel.findOne({
                userId,
                moduleId,
                type: 'code',
                status: 'passed'
              });

              moduleProgress.push({
                moduleId,
                isMcqCompleted: !!mcqSubmission,
                isCodingCompleted: !!codingSubmission,
                mcqScore: mcqSubmission?.score || 0,
                codingScore: codingSubmission?.score || 0
              });
            }
          }
        }

        user._doc.moduleProgress = moduleProgress;
      }

      // let's calculate rank based on points from passed submissions
      // Get all passed/completed submissions for the user
      const submissions = await submissionModel.find({
        userId,
        status: { $in: ['passed', 'completed'] }
      });

      // Calculate total points from submission scores
      const totalPoints = submissions.reduce((acc, sub) => {
        return acc + (sub.score || 0);
      }, 0);

      user.rank = calculateRank(totalPoints);
      user.points = totalPoints;
      await user.save();
      return res.status(200).json({ profile: user });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to retrieve profile', error });
    }
  },
  get_all_users: async (req, res) => {
    try {
      const users = await UserModel.find()
        .populate('currentCourse')
        .populate('currentModule')
        .populate('currentProfession')
        .populate('completedCourses.courseId')
        .populate('completedProfessions.professionId')
        .select('-password -otp -otpExpiry');
      return res.status(200).json({ users });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to retrieve users', error });
    }
  },
  trackActivity: async (req, res) => {
    try {
      const { userId } = req.user;
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get today's date in UTC (yyyy-mm-dd format)
      const today = new Date().toISOString().split("T")[0];

      // Check if activity for today already exists
      const alreadyTracked = user.activityHistory && user.activityHistory.some(
        (entry) => entry.date && entry.date.trim() === today
      );

      if (alreadyTracked) {
        // Activity already tracked for today
        return res.status(200).json({ message: 'Activity already tracked for today' });
      }

      // Add today's activity
      if (!user.activityHistory) {
        user.activityHistory = [];
      }
      user.activityHistory.push({ date: today });
      await user.save();

      return res.status(200).json({ message: 'Activity tracked successfully' });
    } catch (error) {
      console.error('Track Activity Error:', error);
      return res.status(500).json({ message: 'Streak monitoring failed', error });
    }
  },
  updateEmail: async (req, res) => {
    try {
      const { email, otp } = req.body;
      const { userId } = req.user;
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!otp) {
        // generate and send otp to new email
        const generatedOTP = user.generateOTP();
        await user.save();
        await EmailService.sendOTPEmail(email, generatedOTP);
        return res.status(200).json({ message: 'OTP sent to new email' });
      }
      if (!user.verifyOTP(otp)) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      const isExistingUser = await UserModel.findOne({ email });
      if (isExistingUser) {
        return res.status(400).json({ message: 'Email is already in use by another account' });
      }

      user.email = email;
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
      // let's generate new token after email update
      const token = user.generateAuthToken();
      return res.status(200).json({ message: 'Email updated successfully', email: user.email, token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to update email', error });
    }
  },
  deleteAccount: async (req, res) => {
    try {
      const { userId } = req.user;
      const { otp } = req.body;
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!otp) {
        const generatedOTP = user.generateOTP();
        await user.save();
        await EmailService.sendOTPEmail(user.email, generatedOTP);
        return res.status(200).json({ message: 'OTP sent to your email. Please verify to delete account.' });
      }
      if (!user.verifyOTP(otp)) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
      await UserModel.findByIdAndDelete(userId);
      // lets delete all submissions by user as well
      await submissionModel.deleteMany({ userId });
      return res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to delete account', error });
    }
  },

  downloadCertificate: async (req, res) => {
    try {
      const { certificateUrl, filename } = req.body;

      if (!certificateUrl) {
        return res.status(400).json({ message: 'Certificate URL is required' });
      }

      // Fetch certificate from Cloudinary
      const response = await fetch(certificateUrl);
      if (!response.ok) {
        return res.status(response.status).json({ message: 'Failed to fetch certificate' });
      }

      const buffer = await response.buffer();
      const finalFilename = filename || 'certificate.pdf';

      // Set headers for download
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
      res.setHeader('Content-Length', buffer.length);

      // Send the file
      res.send(buffer);
    } catch (error) {
      console.error('Download error:', error);
      return res.status(500).json({ message: 'Failed to download certificate', error: error.message });
    }
  }
};

function calculateRank(points) {
  if (points >= POINTS.GOLD_THRESHOLD) return 'Gold';
  if (points >= POINTS.SILVER_THRESHOLD) return 'Silver';
  return 'Bronze';
}
module.exports = UserController;