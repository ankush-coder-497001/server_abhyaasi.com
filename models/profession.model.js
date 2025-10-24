// models/Profession.js
import mongoose from "mongoose";

const professionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  // array of course IDs
  courses: [
    {
      course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
      order: { type: Number, default: 0 },
    },
  ],
  thumbnail: {
    type: String, // Cloudinary or local URL
  },
  estimatedDuration: {
    type: String, // e.g., "3 months"
  },
  tags: [String],
});

export const Profession = mongoose.model("Profession", professionSchema);
