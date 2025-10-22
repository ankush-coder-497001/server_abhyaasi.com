const Module_Model = require('../models/module.model')
const Course_Model = require('../models/course.model')
const Module_controller = {
  create_module: async (req, res) => {
    try {
      const { title, courseId, topics, theory, mcqs, codingTask, interviewQuestions } = req.body;
      const GetLastModule = await Module_Model.findOne({ courseId }).sort({ order: -1 });
      const order = GetLastModule ? GetLastModule.order + 1 : 1;
      const newModule = new Module_Model({
        title,
        courseId,
        order,
        topics,
        theoryNotes: theory,
        mcqs,
        codingTask,
        interviewQuestions
      });
      await newModule.save();
      res.status(201).json({
        status: 'success',
        message: 'Module created successfully',
        data: newModule
      });
    } catch (error) {
      console.error(' Error in create_module:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create module'
      });
    }
  },
  edit_module: async (req, res) => {
    try {
      const { moduleId } = req.params;
      const updateData = req.body;
      const updatedModule = await Module_Model.findByIdAndUpdate(moduleId, updateData, { new: true });
      if (!updatedModule) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found'
        });
      }
      res.status(200).json({
        status: 'success',
        message: 'Module updated successfully',
        data: updatedModule
      });
    } catch (error) {
      console.error(' Error in edit_module:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to edit module'
      });
    }
  },
  get_module: async (req, res) => {
    try {
      const { moduleId } = req.params;
      // check the module is locked or not
      const Module = await Module_Model.findById(moduleId).select('-mcqs.correctOptionIndex');
      if (!Module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found'
        });
      }
      if (Module.order !== 1 && Module.isLocked) {
        return res.status(403).json({
          status: 'error',
          message: 'Module is locked'
        });
      }
      res.status(200).json({
        status: 'success',
        message: 'Module retrieved successfully',
        data: Module
      });
    } catch (error) {
      console.error(' Error in get_module:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get module'
      });
    }
  },
  remove_module: async (req, res) => {
    try {
      const { moduleId } = req.params;
      const deletedModule = await Module_Model.findByIdAndDelete(moduleId);

      // remove from the course's module list as well
      await Course_Model.updateOne(
        { _id: courseId },
        { $pull: { modules: moduleId } }
      );

      if (!deletedModule) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found'
        });
      }
      res.status(200).json({
        status: 'success',
        message: 'Module deleted successfully',
        data: deletedModule
      });
    } catch (error) {
      console.error(' Error in remove_module:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete module'
      });
    }
  },
  submit_mcq: async (req, res) => {
    try {
      const { moduleId } = req.params;
      const { answers } = req.body; // expecting an array of selected option indices
      const module_model = await Module_Model.findById(moduleId);
      if (!module_model) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found'
        });
      }

      // check for max attempts 

      if (!module_model.mcqs.maxAttempts <= 0) {
        return res.status(403).json({
          status: 'error',
          message: 'No attempts left for this MCQ retry after 24 hours'
        });
      }

      if (module_model.mcqs.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'No MCQs available for this module'
        });
      }

      if (module_model.mcqs.isCompleted) {
        return res.status(403).json({
          status: 'error',
          message: 'MCQ already completed for this module'
        });
      }


      let score = 0;
      let total = module_model.mcqs.length * 5; // assuming each question carries 5 marks
      module_model.mcqs.forEach((mcq, index) => {
        if (mcq.correctOptionIndex === answers[index]) {
          score += 5;
        }
      });

      const passingScore = (module_model.passCriteria.mcqPassingPercent / 100) * total;
      const isPassed = score >= passingScore;

      if (!isPassed) {
        module_model.mcqs.maxAttempts -= 1;
        await module_model.save();
        return res.status(200).json({
          status: 'success',
          message: 'MCQ submitted successfully, but not passed',
          data: { score, total: module_model.mcqs.length, attemptsLeft: module_model.mcqs.maxAttempts, answersReviewed: module_model.mcqs }
        });
      }

      module_model.mcqs.isCompleted = true;
      await module_model.save();
      res.status(200).json({
        status: 'success',
        message: 'MCQ submitted successfully',
        data: { score, total: module_model.mcqs.length }
      });
    } catch (error) {
      console.error(' Error in submit_mcq:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to submit mcq'
      });
    }
  },
}

module.exports = Module_controller