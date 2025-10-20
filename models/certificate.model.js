const mongoose = require('mongoose');
const { Schema } = mongoose;

const CertificateSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  pdfUrl: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Certificate', CertificateSchema);
