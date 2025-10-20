const mongoose = require('mongoose');
const { Schema } = mongoose;

const LeaderboardEntrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true },
  points: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

LeaderboardEntrySchema.index({ points: -1 });

module.exports = mongoose.model('LeaderboardEntry', LeaderboardEntrySchema);
