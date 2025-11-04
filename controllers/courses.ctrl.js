const CourseModel = require('../models/course.model');
const UserModel = require('../models/user.model');
const CourseController = {
  enrollInCourse: async (req, res) => {
    try {
      const courseId = req.params.id;
      const userId = req.user.userId;
      const { permissionFromUser } = req.body; // true or false 

      const course = await CourseModel.findById(courseId).populate('modules');

      if (!course.isPublished) {
        return res.status(403).json({ message: "this course is not published yet" })
      }

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.currentCourse && !permissionFromUser) {
        return res.status(400).json({ message: 'User is already enrolled in another course. Please confirm to switch courses.' });
      }

      if (user.currentCourse && user.currentCourse.toString() === courseId) {
        return res.status(400).json({ message: 'User already enrolled in this course' });
      }

      const alreadyCompleted = user.completedCourses.some(cId => cId.toString() === courseId);
      if (alreadyCompleted) {
        return res.status(400).json({ message: 'User has already completed this course' });
      }

      user.currentCourse = course._id;
      user.currentModule = course.modules.length > 0 && course.modules.find(m => m.order === 1)._id;
      await user.save();
      res.json({ message: 'Enrolled in course successfully', courseId: course._id, courseTitle: course.title });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
  unenroll_from_course: async (req, res) => {
    try {
      const userId = req.user.userId;
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!user.currentCourse) {
        return res.status(400).json({ message: 'User is not enrolled in any course' });
      }
      if (user.currentProfession) {
        return res.status(400).json({ message: 'Cannot unenroll from course while enrolled in a profession. Please unenroll from the profession first.' });
      }
      user.currentCourse = null;
      user.currentModule = null;
      await user.save();
      res.json({ message: 'Unenrolled from course successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error });
    }
  },
  getAllCourses: async (req, res) => {
    try {
      // we are not sending the correct answers from modules of mcq
      const courses = await CourseModel.find({ isPublished: true }).populate({
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
      const course = await CourseModel.findById(courseId, { isPublished: true }).populate('modules').populate('createdBy', 'name email');
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
      const { title, description, difficulty, thumbnailUrl, duration } = req.body;
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
        duration,
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
  toggleCourseVisibility: async (req, res) => {
    try {
      const { courseId } = req.params;
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "course not found !" })
      }

      course.isPublished = course.isPublished ? false : true;
      await course.save();
      res.status(200).json({ message: `course is now ${course.isPublished ? 'published' : 'archived'}` })
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Error In Toggle Course visibility" })
    }
  }
}

module.exports = CourseController;