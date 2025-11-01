const mongoose = require('mongoose');
const { Schema } = mongoose;

const TestResultSchema = new Schema({
  testcaseId: { type: String },
  passed: { type: Boolean },
  output: { type: String },
  error: { type: String }
}, { _id: false });

const SubmissionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
  type: { type: String, enum: ['mcq', 'code'], required: true },
  payload: { type: Schema.Types.Mixed }, // project files meta or mcq answers
  status: { type: String, enum: ['pending', 'running', 'passed', 'failed', 'blocked', 'needs_review'], default: 'pending' },
  score: { type: Number }, // 0..100
  attemptNumber: { type: Number, default: 1 },
  runResult: {
    logs: { type: String },
    testResults: [TestResultSchema]
  },
  cooldownUntil: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// index for lookups
SubmissionSchema.index({ userId: 1, moduleId: 1, status: 1 });

module.exports = mongoose.model('Submission', SubmissionSchema);
