const CourseModel = require('../models/course.model');
const CourseController = {
  getAllCourses: async (req, res) => {
    try {
      // we are not sending the correct answers from modules of mcq 
      const courses = await CourseModel.find().populate({
        path: 'modules',
        select: '-mcqs.correctOptionIndex'
      }).populate('createdBy', 'name email');
      res.json(courses);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
  getCourseBySlug: async (req, res) => {
    try {
      const courseSlug = req.params.slug;
      const course = await CourseModel.findOne({ slug: courseSlug }).populate('modules').populate('createdBy', 'name email');
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      res.json(course);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
  getCourseById: async (req, res) => {
    try {
      const courseId = req.params.id;
      const course = await CourseModel.findById(courseId).populate('modules').populate('createdBy', 'name email');
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      res.json({ message: 'Course retrieved successfully', course });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
  createCourse: async (req, res) => {
    try {
      const { title, description, difficulty, thumbnailUrl } = req.body;
      const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      const existingCourse = await CourseModel.findOne({ slug });
      if (existingCourse) {
        return res.status(400).json({ message: 'Course with this slug already exists' });
      }
      const newCourse = new CourseModel({
        title,
        slug,
        description,
        difficulty,
        thumbnailUrl,
        createdBy: req.user._id
      });
      await newCourse.save();
      res.status(201).json({ message: 'Course created successfully', course: newCourse });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
  updateCourse: async (req, res) => {
    try {
      const courseId = req.params.id;
      const updates = req.body;
      const course = await CourseModel.findByIdAndUpdate(courseId, updates, { new: true });
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      res.json({ message: 'Course updated successfully', course });
    }
    catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
  removeCourse: async (req, res) => {
    try {
      const courseId = req.params.id;
      const course = await CourseModel.findByIdAndDelete(courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      res.json({ message: 'Course deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
}

module.exports = CourseController;