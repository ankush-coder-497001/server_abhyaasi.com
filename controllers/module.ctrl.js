const Module_Model = require('../models/module.model')
const Course_Model = require('../models/course.model')
const Submission_Model = require('../models/submission.model')
const codeExecutionService = require('../services/codeExecution.svc');
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
      console.error('Error in edit_module:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update module'
      });
    }
  },
  submit_code: async (req, res) => {
    try {
      const { moduleId } = req.params;
      const { code, language } = req.body;
      const userId = req.user.userId;

      // Get module details
      const Module_model = await Module_Model.findById(moduleId);
      if (!Module_model || !Module_model.codingTask) {
        return res.status(404).json({
          status: 'error',
          message: 'Module or coding task not found'
        });
      }

      // Validate language support
      if (!Module_model.codingTask.languages.includes(language)) {
        return res.status(400).json({
          status: 'error',
          message: 'Language not supported for this task'
        });
      }



      // Create new submission
      const submission = new Submission_Model({
        userId,
        moduleId,
        type: 'code',
        payload: { code, language },
        status: 'running'
      });

      // Run test cases
      const testResults = [];
      let totalTests = 0;
      let passedTests = 0;

      for (const testCase of Module_model.codingTask.testcases) {
        totalTests++;
        try {
          const result = await codeExecutionService.executeCode(
            language,
            code,
            testCase,
            Module_model.codingTask.timeoutSeconds
          );

          const passed = !result.error &&
            codeExecutionService.validateOutput(result.output, testCase.expectedOutput);

          testResults.push({
            testcaseId: testCase.id,
            passed,
            output: result.output,
            error: result.error
          });

          if (passed) passedTests++;
        } catch (error) {
          testResults.push({
            testcaseId: testCase.id,
            passed: false,
            output: null,
            error: error.message
          });
        }
      }

      // Update submission with results
      submission.status = passedTests === totalTests ? 'passed' : 'failed';
      submission.score = (passedTests / totalTests) * 100;
      submission.runResult = {
        testResults
      };


      await submission.save();

      // Filter out hidden test case details
      const visibleResults = testResults.map(result => {
        const testCase = Module_model.codingTask.testcases.find(t => t.id === result.testcaseId);
        if (testCase && testCase.hidden) {
          return {
            testcaseId: result.testcaseId,
            passed: result.passed
          };
        }
        return result;
      });

      res.status(200).json({
        status: 'success',
        message: submission.status === 'passed' ? 'All tests passed!' : 'Some tests failed',
        data: {
          submissionId: submission._id,
          status: submission.status,
          score: submission.score,
          testResults: visibleResults,
          cooldownUntil: submission.cooldownUntil
        }
      });

    } catch (error) {
      console.error('Error in submit_code:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process code submission'
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

      const Module_model = await Module_Model.findById(moduleId);
      if (!Module_model) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found'
        });
      }

      // check if the module is under cooldown if not set the cooldownUntil to null
      if (Module_model.cooldownUntil && Module_model.cooldownUntil > new Date()) {
        return res.status(429).json({
          status: 'error',
          message: 'Please wait before attempting the MCQs again',
          cooldownUntil: Module_model.cooldownUntil
        });
      } else {
        Module_model.cooldownUntil = null;
        await Module_model.save();
      }


      if (!Array.isArray(answers) || answers.length !== Module_model.mcqs.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid answer format. Please provide answers for all questions.'
        });
      }

      // Get last submission to check attempts
      const totalAttempts = Module_Model.mcqs.find(mcq => mcq.userId === req.user.userId);

      const attemptCount = totalAttempts ? totalAttempts + 1 : 1;

      // Check if max attempts reached for any MCQ
      const mcqWithExhaustedAttempts = Module_model.mcqs.find(mcq =>
        mcq.maxAttempts !== undefined && mcq.maxAttempts < attemptCount
      );

      if (mcqWithExhaustedAttempts) {
        return res.status(403).json({
          status: 'error',
          message: 'Maximum attempts reached for one or more MCQs'
        });
      }

      if (Module_model.mcqs.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'No MCQs available for this module'
        });
      }

      // Check if already completed successfully
      const successfulSubmission = await Submission_Model.findOne({
        userId: req.user.userId,
        moduleId,
        type: 'mcq',
        status: 'passed'
      });

      if (successfulSubmission) {
        return res.status(403).json({
          status: 'error',
          message: 'MCQs already completed successfully for this module'
        });
      }


      let score = 0;
      let total = Module_model.mcqs.length * 5; // each question carries 5 marks

      // Calculate score
      const results = Module_model.mcqs.map((mcq, index) => {
        const isCorrect = mcq.correctOptionIndex === answers[index];
        if (isCorrect) score += 5;
        return {
          questionId: mcq._id,
          isCorrect,
          userAnswer: answers[index],
          // Only include correct answer in response if attempt failed
          correctAnswer: isCorrect ? undefined : mcq.correctOptionIndex,
          explanation: isCorrect ? undefined : mcq.explanation
        };
      });

      const passingScore = 70; // 70% passing criteria
      const isPassed = (score / total) * 100 >= passingScore;

      // Create submission record
      const submission = new Submission_Model({
        userId: req.user.id,
        courseId: Module_model.courseId,
        moduleId: moduleId,
        type: 'mcq',
        payload: {
          answers,
          results
        },
        status: isPassed ? 'passed' : 'failed',
        score: (score / total) * 100,
        attemptNumber: attemptCount
      });

      await submission.save();

      // Update MCQ completion status if passed
      if (isPassed) {
        await Module_Model.updateOne(
          { _id: moduleId, 'mcqs._id': { $in: Module_model.mcqs.map(m => m._id) } },
          { $set: { 'mcqs.$.isCompleted': true } }
        );
      }

      // check if attempts are more than 3 so send cooldown for 1 hour 
      let cooldownUntil;
      if (!isPassed && attemptCount > 3) {
        cooldownUntil = new Date(Date.now() + 60 * 60000); // 1 hour cooldown
        Module_model.cooldownUntil = cooldownUntil;
        await Module_model.save();
      }

      res.status(200).json({
        status: 'success',
        message: isPassed ? 'MCQ completed successfully!' : 'Some answers were incorrect',
        data: {
          submissionId: submission._id,
          score: submission.score,
          totalQuestions: Module_model.mcqs.length,
          passed: isPassed,
          results,
          attemptNumber: attemptCount,
          cooldownUntil,
          nextAttemptAt: cooldownUntil
        }
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