const mongoose = require('mongoose');
const { Schema } = mongoose;

const BadgeSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  iconUrl: { type: String },
  criteria: { type: String } // descriptive string for evaluation
}, { timestamps: true });

module.exports = mongoose.model('Badge', BadgeSchema);
