const express = require('express');
const router = express.Router();
const CourseController = require('../controllers/courses.ctrl');
const Auth = require('../middlewares/auth')
const Role_Validation = require('../middlewares/Role_Validation')

router.use(Auth);

router.post('/enroll/:id', CourseController.enrollInCourse);
router.post('/unenroll', CourseController.unenroll_from_course);

router.get('/slug/:slug', CourseController.getCourseBySlug);
router.get('/get_all', CourseController.getAllCourses);
router.get('/:id', CourseController.getCourseById);

router.put('/:courseId', Role_Validation(['admin']), CourseController.toggleCourseVisibility);
router.post('/create', Role_Validation(['admin']), CourseController.createCourse);
router.put('/update/:id', Role_Validation(['admin']), CourseController.updateCourse);
router.delete('/delete/:id', Role_Validation(['admin']), CourseController.removeCourse);

module.exports = router;