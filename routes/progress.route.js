const express = require('express');
const router = express.Router();
const Auth = require('../middlewares/auth');
const Progress_controller = require('../controllers/progress.ctrl');

router.get('/:courseId', Auth, Progress_controller.generate_progress_report_perCourse);
router.get('/', Auth, Progress_controller.generate_overall_progress_report);

module.exports = router;