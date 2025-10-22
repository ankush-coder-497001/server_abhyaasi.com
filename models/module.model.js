const mongoose = require('mongoose');
const { Schema } = mongoose;


const TopicSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String } // markdown/html
}, { _id: false });

const MCQSchema = new Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true }, // 0-based
  explanation: { type: String },
  maxAttempts: { type: Number, default: 3 },
  isCompleted: { type: Boolean, default: false },
}, { timestamps: true });

const TestcaseSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['unit', 'integration', 'e2e'], default: 'unit' },
  input: { type: String }, // text input or JSON
  expectedOutput: { type: String },
  hidden: { type: Boolean, default: false }
}, { _id: false });

const CodingTaskSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String }, // markdown
  languages: [{ type: String }], // e.g., ['javascript','python']
  templateFiles: [{
    path: { type: String },
    content: { type: String }
  }],
  testcases: [TestcaseSchema],
  timeoutSeconds: { type: Number, default: 30 },
  isCompleted: { type: Boolean, default: false }
}, { timestamps: true });

const ModuleSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  title: { type: String, required: true },
  order: { type: Number, required: true }, // ordering within course
  topics: [TopicSchema], // max ~5 topics
  theoryNotes: {
    text: { type: String },
    pdfUrl: { type: String }
  },
  mcqs: [MCQSchema],
  codingTask: { type: CodingTaskSchema },
  interviewQuestions: [{ question: String, suggestedAnswer: String }],
  passCriteria: {
    mcqPassingPercent: { type: Number, default: 70 },
    projectMustPass: { type: Boolean, default: true }
  },
  published: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  isCompleted: { type: Boolean, default: false },
  cooldownUntil: { type: Date }
}, { timestamps: true });

ModuleSchema.index({ courseId: 1, order: 1 }, { unique: true });

ModuleSchema.pre('save', function (next) {
  if (this.isModified('order') && this.order < 1) {
    return next(new Error('Order must be a positive integer'));
  }

  if (this.order === 1) {
    this.isLocked = false;
  }

  next();
});

module.exports = mongoose.model('Module', ModuleSchema);
