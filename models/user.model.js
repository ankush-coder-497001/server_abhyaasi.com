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

const CompletedCourseSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  completedDate: { type: Date, default: Date.now },
  points: { type: Number, default: 0 },
  certificate: { type: Boolean, default: false },
  certificateUrl: { type: String },
  certificatePdfUrl: { type: String },
  certificateImageUrl: { type: String }
}, { _id: true });

const CompletedProfessionSchema = new Schema({
  professionId: { type: Schema.Types.ObjectId, ref: 'Profession' },
  completedDate: { type: Date, default: Date.now },
  points: { type: Number, default: 0 },
  certificate: { type: Boolean, default: false },
  certificateUrl: { type: String },
  certificatePdfUrl: { type: String },
  certificateImageUrl: { type: String }
}, { _id: true });

const EnrolledProfessionSchema = new Schema({
  professionId: { type: Schema.Types.ObjectId, ref: 'Profession' },
  enrolledDate: { type: Date, default: Date.now }
}, { _id: true });

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
  completedCourses: { type: [CompletedCourseSchema], default: [] },
  enrolledProfessions: { type: [EnrolledProfessionSchema], default: [] },
  completedProfessions: { type: [CompletedProfessionSchema], default: [] },
  currentProfession: { type: Schema.Types.ObjectId, ref: 'Profession' }
}, { timestamps: true });

UserSchema.pre('save', function (next) {
  // Hash password before saving
  if (this.isModified('password')) {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
  }

  // Clean up invalid completed courses entries (remove entries without courseId)
  if (this.isModified('completedCourses')) {
    this.completedCourses = this.completedCourses.filter(item => item && item.courseId);
  }

  // Clean up invalid completed professions entries (remove entries without professionId)
  if (this.isModified('completedProfessions')) {
    this.completedProfessions = this.completedProfessions.filter(item => item && item.professionId);
  }

  next();
});

// Post-find hook to clean up any corrupted data
UserSchema.post(/^find/, function (doc) {
  if (!doc) return;

  // Handle single document
  if (doc._id) {
    if (doc.completedCourses && Array.isArray(doc.completedCourses)) {
      doc.completedCourses = doc.completedCourses.filter(item => item && item.courseId);
    }
    if (doc.completedProfessions && Array.isArray(doc.completedProfessions)) {
      doc.completedProfessions = doc.completedProfessions.filter(item => item && item.professionId);
    }
  }
  // Handle multiple documents (findMany)
  else if (Array.isArray(doc)) {
    doc.forEach(user => {
      if (user && user._id) {
        if (user.completedCourses && Array.isArray(user.completedCourses)) {
          user.completedCourses = user.completedCourses.filter(item => item && item.courseId);
        }
        if (user.completedProfessions && Array.isArray(user.completedProfessions)) {
          user.completedProfessions = user.completedProfessions.filter(item => item && item.professionId);
        }
      }
    });
  }
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
