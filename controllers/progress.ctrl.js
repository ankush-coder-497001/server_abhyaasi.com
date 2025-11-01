const Module_model = require('../models/module.model');
const User_model = require('../models/user.model');
const Submit_model = require('../models/submission.model');
const courseModel = require('../models/course.model');

const Progress_controller = {
  generate_progress_report_perCourse: async (req, res) => {
    try {
      const userId = req.user.userId;
      const courseId = req.params.courseId;
      const user = await User_model.findById(userId);
      const course = await courseModel.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: 'course not found' });
      }
      const modules = await Module_model.find({ course: courseId }).sort({ order: 1 });
      const submissions = await Submit_model.find({ userId, courseId, status: 'passed' });
      let completedModules = 0;
      let totalScore = 0;
      for (const module of modules) {
        const moduleSubs = submissions.filter(sub => sub.moduleId.toString() === module._id.toString());
        const code_submission = moduleSubs.find(sub => sub.type === 'project');
        const mcq_submission = moduleSubs.find(sub => sub.type === 'mcq');
        if (code_submission && mcq_submission) {
          completedModules += 1;
          const moduleScore = (code_submission.score || 0) + (mcq_submission.score || 0);
          totalScore += moduleScore;
        }
      }
      const averageScore = completedModules > 0 ? totalScore / completedModules : 0;
      const completionPercentage = modules.length > 0 ? (completedModules / modules.length) * 100 : 0;
      res.json({
        message: 'progress report generated successfully',
        userId,
        courseId,
        completedModules,
        totalModules: modules.length,
        averageScore,
        completionPercentage
      });
    } catch (error) {
      console.error('Error generating progress report:', error);
      res.status(500).json({ message: 'error generating progress report' });
    }
  },
  generate_overall_progress_report: async (req, res) => {
    try {
      const userId = req.user.userId;
      const user = await User_model.findById(userId).populate('completedCourses');
      const completedCourses = user.completedCourses || [];
      let overallCompletedModules = 0;
      let overallTotalModules = 0;
      let overallTotalScore = 0;
      let overallAverageScore = 0;
      let overallCompletionPercentage = 0;
      for (const course of completedCourses) {
        const modules = await Module_model.find({ course: course._id }).sort({ order: 1 });
        const submissions = await Submit_model.find({ userId, courseId: course._id, status: 'passed' });
        let completedModules = 0;
        let totalScore = 0;
        for (const module of modules) {
          const moduleSubs = submissions.filter(sub => sub.moduleId.toString() === module._id.toString());
          const code_submission = moduleSubs.find(sub => sub.type === 'project');
          const mcq_submission = moduleSubs.find(sub => sub.type === 'mcq');
          if (code_submission && mcq_submission) {
            completedModules += 1;
            const moduleScore = (code_submission.score || 0) + (mcq_submission.score || 0);
            totalScore += moduleScore;
          }
          overallCompletedModules += completedModules;
          overallTotalModules += modules.length;
          overallTotalScore += totalScore;
        }
        overallAverageScore = overallTotalModules > 0 ? overallTotalScore / overallTotalModules : 0;
        overallCompletionPercentage = overallTotalModules > 0 ? (overallCompletedModules / overallTotalModules) * 100 : 0;
      }
      res.json({
        message: 'overall progress report generated successfully',
        userId,
        overallCompletedModules,
        overallTotalModules,
        overallAverageScore,
        overallCompletionPercentage,
        overallTotalScore
      });
    } catch (error) {
      console.error('Error generating overall progress report:', error);
      res.status(500).json({ message: 'error generating overall progress report' });
    }
  }
}

module.exports = Progress_controller;