const moduleModel = require("../models/module.model");
const Profession = require("../models/profession.model");
const userModel = require("../models/user.model");
const Profession_controller = {
  create_profession: async (req, res) => {
    try {
      const { name, description, thumbnail, estimatedDuration } = req.body;
      if (!name || !description || !thumbnail || !estimatedDuration) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const newProfession = new Profession({
        name,
        description,
        thumbnail,
        estimatedDuration,
        courses: [],
        tags: req.body.tags || [],
      });
      await newProfession.save();
      res.status(201).json({
        message: "Profession created successfully",
        profession: newProfession,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },

  edit_profession: async (req, res) => {
    try {
      const { name, description, thumbnail, estimatedDuration } = req.body;
      const { professionId } = req.params;
      if (!name || !description || !thumbnail || !estimatedDuration) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const profession = await Profession.findById(professionId);
      if (!profession) {
        return res.status(404).json({ message: "Profession not found" });
      }

      profession.name = name;
      profession.description = description;
      profession.thumbnail = thumbnail;
      profession.estimatedDuration = estimatedDuration;
      profession.tags = req.body.tags || [];
      await profession.save();
      res
        .status(200)
        .json({ message: "Profession updated successfully", profession });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },

  assign_courses: async (req, res) => {
    try {
      const { professionId } = req.params;
      const { courseIdsWithOrder } = req.body; // array of course IDs
      if (
        !professionId ||
        !courseIdsWithOrder ||
        !Array.isArray(courseIdsWithOrder)
      ) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const profession = await Profession.findById(professionId);
      if (!profession) {
        return res.status(404).json({ message: "Profession not found" });
      }
      // sort the courseIdsWithOrder by order
      courseIdsWithOrder.sort((a, b) => a.order - b.order);
      // Map to only include courseId and order
      profession.courses = courseIdsWithOrder.map((item) => ({
        course: item.courseId,
        order: item.order,
      }));
      await profession.save();
      res
        .status(200)
        .json({ message: "Courses assigned successfully", profession });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },
  get_profession: async (req, res) => {
    try {
      const { professionId } = req.params;
      if (!professionId) {
        return res.status(400).json({ message: "Profession ID is required" });
      }
      const profession = await Profession.findById(professionId).populate({
        path: "courses.course",
        populate: { path: "modules", select: "-mcqs.correctOptionIndex" },
      });
      if (!profession) {
        return res.status(404).json({ message: "Profession not found" });
      }
      res.status(200).json({ profession });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },
  get_all_professions: async (req, res) => {
    try {
      const professions = await Profession.find().populate("courses");
      res.status(200).json({ professions });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },
  enroll_in_profession: async (req, res) => {
    try {
      const { professionId } = req.params;
      const { userId } = req.user;
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!professionId) {
        return res.status(400).json({ message: "Profession ID is required" });
      }
      const profession = await Profession.findById(professionId).populate(
        "courses.course"
      );
      if (!profession) {
        return res.status(404).json({ message: "Profession not found" });
      }

      if (user.enrolledProfessions.includes(professionId)) {
        return res
          .status(400)
          .json({ message: "User already enrolled in this profession" });
      }

      if (user.currentCourse && user.currentModule) {
        return res.status(400).json({
          message:
            "Cannot enroll in a new profession while enrolled in a course. Please complete or unenroll from the current course first.",
        });
      }
      user.enrolledProfessions.push(professionId);
      user.currentProfession = professionId;
      const firstCourse = profession.courses.sort(
        (a, b) => a.order - b.order
      )[0];
      if (!firstCourse) {
        user.currentCourse = null;
        user.currentModule = null;
      } else {
        user.currentCourse = firstCourse.course;
        const firstModule = await moduleModel
          .findOne({ courseId: firstCourse.course._id })
          .sort({ order: 1 });
        if (firstModule) {
          user.currentModule = firstModule._id;
        }
      }

      await user.save();
      res
        .status(200)
        .json({ message: "Enrolled in profession successfully", profession });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },
  unenroll_from_profession: async (req, res) => {
    try {
      const { professionId } = req.params;
      const { userId } = req.user;
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!professionId) {
        return res.status(400).json({ message: "Profession ID is required" });
      }
      const profession = await Profession.findById(professionId);
      if (!profession) {
        return res.status(404).json({ message: "Profession not found" });
      }
      const index = user.enrolledProfessions.indexOf(professionId);
      if (index === -1) {
        return res
          .status(400)
          .json({ message: "User is not enrolled in this profession" });
      }
      user.enrolledProfessions.splice(index, 1);
      if (
        user.currentProfession &&
        user.currentProfession.toString() === professionId
      ) {
        user.currentProfession = null;
      }
      // If the user's current course/module belongs to this profession, clear them
      if (user.currentCourse) {
        const isCurrentCourseInProfession = profession.courses.some(
          (c) => c.course.toString() === user.currentCourse.toString()
        );
        if (isCurrentCourseInProfession) {
          user.currentCourse = null;
          user.currentModule = null;
        }
      }
      await user.save();
      res.status(200).json({
        message: "Unenrolled from profession successfully",
        profession,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },
  toggleProfessionVisibility: async (req, res) => {
    try {
      const { professionId } = req.params;
      const profession = await Profession.findById(professionId);
      if (!profession) {
        return res.status(404).json({ message: "profession not found" });
      }
      profession.isPublished = profession.isPublished ? false : true;
      await profession.save();
      res.status(200).json({
        message: `profession is ${profession.isPublished ? "published" : "archived"
          }`,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },

  delete_profession: async (req, res) => {
    try {
      const { professionId } = req.params;
      const profession = await Profession.findById(professionId);
      if (!profession) {
        return res.status(404).json({ message: "Profession not found" });
      }
      await Profession.findByIdAndDelete(professionId);
      res.status(200).json({ message: "Profession deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },
};
module.exports = Profession_controller;
