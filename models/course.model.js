const mongoose = require('mongoose');
const { Schema } = mongoose;


const CourseSchema = new Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  description: { type: String },
  modules: [{ type: Schema.Types.ObjectId, ref: 'Module' }], // ordered
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
  profession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profession", // link each course to its profession
  },
  thumbnailUrl: { type: String },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);
