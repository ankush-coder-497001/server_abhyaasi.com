const mongoose = require('mongoose');
const { Schema } = mongoose;

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
  badges: [{ type: Schema.Types.ObjectId, ref: 'Badge' }],
  certificates: [{ type: Schema.Types.ObjectId, ref: 'Certificate' }],
  lastLogin: { type: Date },
  otp: { type: String },
  otpExpiry: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
