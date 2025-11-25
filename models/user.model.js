const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ProfileSchema = new Schema({
  bio: { type: String },
  college: { type: String },
  year: { type: Number },
  profilePic: { type: String }
}, { _id: false });

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student', enum: ['admin', 'student'] },
  profile: { type: ProfileSchema, default: {} },
  points: { type: Number, default: 0 },
  rank: { type: String, default: 'Bronze' },
  badges: [{ type: Schema.Types.ObjectId, ref: 'Badge' }],
  certificates: [{ type: String }], // URLs to certificate PDFs
  lastLogin: { type: Date },
  otp: { type: String },
  otpExpiry: { type: Date },
  activityHistory: [
    {
      date: { type: String },
    }
  ],
  isOauthUser: { type: Boolean, default: false },
  currentCourse: { type: Schema.Types.ObjectId, ref: 'Course' },
  currentModule: { type: Schema.Types.ObjectId, ref: 'Module' },
  completedCourses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
  enrolledProfessions: [{ type: Schema.Types.ObjectId, ref: 'Profession' }],
  currentProfession: { type: Schema.Types.ObjectId, ref: 'Profession' }
}, { timestamps: true });

UserSchema.pre('save', function (next) {
  // Hash password before saving
  if (this.isModified('password')) {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
  }
  next();
});

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compareSync(candidatePassword, this.password);
}

UserSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  this.otpExpiry = Date.now() + 10 * 60 * 1000;
  return otp;
}

UserSchema.methods.verifyOTP = function (otp) {
  if (this.otp === otp && this.otpExpiry > Date.now()) {
    return true;
  }
  return false;
}

UserSchema.methods.clearOTP = function () {
  this.otp = null;
  this.otpExpiry = null;
}

UserSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ userId: this._id, email: this.email, role: this.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return token;
}

module.exports = mongoose.model('User', UserSchema);
