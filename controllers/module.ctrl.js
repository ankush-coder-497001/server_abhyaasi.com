const Module_Model = require('../models/module.model')
const Course_Model = require('../models/course.model')
const Submission_Model = require('../models/submission.model')
const codeExecutionService = require('../services/codeExecution.svc');
const User_Model = require('../models/user.model');
const { trusted } = require('mongoose');
const Certificate_service = require('../services/certificate.svc');
const courseModel = require('../models/course.model');
const Module_controller = {
  create_module: async (req, res) => {
    try {
      const { title, courseId, topics, theoryNotes, mcqs, codingTask, interviewQuestions, published } = req.body;
      const GetLastModule = await Module_Model.findOne({ courseId }).sort({ order: -1 });
      const order = GetLastModule ? GetLastModule.order + 1 : 1;
      const newModule = new Module_Model({
        title,
        courseId,
        order,
        topics,
        theoryNotes: theoryNotes,
        mcqs,
        codingTask,
        interviewQuestions,
        published
      });
      await newModule.save();

      const course = await courseModel.findById(courseId);
      course.modules.push(newModule._id);
      await course.save();

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
      const userModel = await User_Model.findById(userId);
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



      // Get previous attempt number
      const lastSubmission = await Submission_Model.findOne({
        userId,
        moduleId,
        type: 'code'
      }).sort({ createdAt: -1 });

      const attemptNumber = lastSubmission ? lastSubmission.attemptNumber + 1 : 1;
      let submission;
      if (lastSubmission) {
        lastSubmission.lastAttemptAt = new Date();
        lastSubmission.payload = { code, language };
        lastSubmission.status = 'running';
        submission = lastSubmission;
      } else {
        // Create new submission
        submission = new Submission_Model({
          userId,
          moduleId,
          courseId: module.courseId,
          type: 'code',
          payload: { code, language },
          status: 'running',
          attemptNumber
        });
      }
      await submission.save();
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
            testcaseId: testCase._id,
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
        const testCase = Module_model.codingTask.testcases.find(t => t._id === result.testcaseId);
        if (testCase && testCase.hidden) {
          return {
            testcaseId: result.testcaseId,
            passed: result.passed
          };
        }
        return result;
      });

      console.log(submission)


      if (submission.status === 'passed') {

        // now check is the mcq is also completed then lets mark the module as completed
        const mcqSubmission = await Submission_Model.findOne({
          userId,
          moduleId,
          type: 'mcq',
          status: 'passed'
        });

        if (mcqSubmission) {
          // means this module is completed 
          // lets find out next module and unlock it for the user
          const course = await Course_Model.findById(Module_model.courseId).populate('modules');
          const nextModule = course.modules.find(m => m.order === Module_model.order + 1);
          if (!nextModule) {
            // no next module it means we have completed all the modules in the course 

            // lets check if we are enrolled in a profession if enrolled then check if we have next course in the profession 
            let nextCourseInProfession;
            let nextModuleInNextCourse;
            if (userModel.currentProfession) {
              const profession = await Profession_Model.findById(userModel.currentProfession).populate('courses');
              const currentCourseIndex = profession.courses.findIndex(c => c.course.toString() === course._id.toString());
              nextCourseInProfession = profession.courses.find(c => c.order === currentCourseIndex + 1);
              if (!nextCourseInProfession) {
                // no next course that mean we have completed the profession lets cross check 
                let success = true;
                for (const profCourse of profession.courses) {
                  const isCompleted = userModel.completedCourses.some(cc => cc.toString() === profCourse.course.toString());
                  if (!isCompleted) {
                    nextCourseInProfession = profCourse;
                    success = false;
                    break;
                  }
                }
                if (success) {
                  const certificateData = {
                    title: profession.name,
                    completedAt: new Date(),
                    _id: profession._id
                  }

                  const res = await Certificate_service.generateCertificate(userModel, certificateData);
                  if (res.status === 'error') {
                    console.error('Certificate generation error:', res.error);
                  } else {
                    userModel.certificates.push(res.pdfUrl);
                  }

                  // user has completed the profession 
                  userModel.enrolledProfessions.push(userModel.currentProfession);
                  userModel.currentProfession = null;
                  userModel.currentCourse = null;
                  userModel.currentModule = null;
                  await userModel.save();
                  return res.status(200).json({
                    status: 'success',
                    message: 'Congratulations! You have completed the entire profession.',
                    data: {
                      isProfessionCompleted: true,
                      submissionId: submission._id,
                      status: submission.status,
                      score: submission.score,
                      testResults: visibleResults,
                      cooldownUntil: submission.cooldownUntil
                    }
                  });
                }
              }

              nextModuleInNextCourse = await Module_Model.findOne({ course: nextCourseInProfession.course }).sort({ order: 1 });
              userModel.currentModule = nextModuleInNextCourse ? nextModuleInNextCourse._id : null;
              userModel.currentCourse = nextCourseInProfession ? nextCourseInProfession.course : null;

              const certificateData = {
                title: course.title,
                completedAt: new Date(),
                _id: course._id
              }

              const res = await Certificate_service.generateCertificate(userModel, certificateData);
              if (res.status === 'error') {
                console.error('Certificate generation error:', res.error);
              } else {
                userModel.certificates.push(res.pdfUrl);
              }
              await userModel.save();

              return res.status(200).json({
                status: 'success',
                message: 'All tests passed! Moved to next course in profession.',
                data: {
                  submissionId: submission._id,
                  status: submission.status,
                  score: submission.score,
                  testResults: visibleResults,
                  cooldownUntil: submission.cooldownUntil
                }
              });

            }


            userModel.currentCourse = null;
            userModel.currentModule = null;

            // lets generate the ceretificate here
            const certificateData = {
              title: course.title,
              completedAt: new Date(),
              _id: course._id
            }
            const res = await Certificate_service.generateCertificate(userModel, certificateData);
            if (res.error) {
              console.error('Certificate generation error:', res.error);
            } else {

              userModel.certificates.push(res.pdfUrl);
            }
            userModel.completedCourses.push(course._id);
            await userModel.save();
            return res.status(200).json({
              status: 'success',
              message: 'Congratulations! You have completed all modules in this course.',
              data: {
                isCourseCompleted: true,
                submissionId: submission._id,
                status: submission.status,
                score: submission.score,
                testResults: visibleResults,
                cooldownUntil: submission.cooldownUntil
              }
            });
          }
          userModel.currentModule = nextModule ? nextModule._id : null;
          await userModel.save();
        }
      }

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
      const { userId } = req.user;

      const Module_model = await Module_Model.findById(moduleId);
      if (!Module_model) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found'
        });
      }

      const user = await User_Model.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // check for cooldown
      const existingSubmission = await Submission_Model.findOne({
        userId: req.user.userId,
        moduleId,
        type: 'mcq'
      }).sort({ createdAt: -1 });

      if (existingSubmission && existingSubmission.cooldownUntil && existingSubmission.cooldownUntil > new Date()) {
        return res.status(403).json({
          status: 'error',
          message: `You are on cooldown. Next attempt available at ${existingSubmission.cooldownUntil}`
        });
      } else {
        // reset cooldown if passed cooldown time
        if (existingSubmission && existingSubmission.cooldownUntil && existingSubmission.cooldownUntil <= new Date()) {
          existingSubmission.cooldownUntil = null;
          existingSubmission.attemptNumber = 0;
          await existingSubmission.save();
        }
      }


      if (!Array.isArray(answers) || answers.length !== Module_model.mcqs.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid answer format. Please provide answers for all questions.'
        });
      }

      const totalAttempts = existingSubmission ? existingSubmission.attemptNumber : 0;
      const attemptCount = totalAttempts ? totalAttempts + 1 : 1;

      // Check if max attempts reached for any MCQ
      const mcqWithExhaustedAttempts = Module_model.mcqs.find(mcq =>
        mcq.maxAttempts !== undefined && mcq.maxAttempts < attemptCount
      );

      if (mcqWithExhaustedAttempts) {

        submission.cooldownUntil = new Date(Date.now() + 60 * 60000); // 1 hour cooldown
        await submission.save();

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

      let submission;
      if (existingSubmission) {
        // update existing submission
        existingSubmission.payload = {
          answers,
          results
        };
        existingSubmission.status = isPassed ? 'passed' : 'failed';
        existingSubmission.score = (score / total) * 100;
        existingSubmission.attemptNumber = attemptCount;
        submission = existingSubmission;
      } else {
        // Create submission record
        submission = new Submission_Model({
          userId: userId,
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
      }
      await submission.save();

      // Update MCQ completion status if passed
      if (isPassed) {
        // check if the coding task is also completed then mark the module as completed
        const codingSubmission = await Submission_Model.findOne({
          userId: req.user.userId,
          moduleId,
          type: 'code',
          status: 'passed'
        });
        if (codingSubmission) {
          // means this module is completed 
          // lets find out next module and unlock it for the user
          const course = await Course_Model.findById(Module_model.courseId).populate('modules');
          const nextModule = course.modules.find(m => m.order === Module_model.order + 1);
          if (!nextModule && Module_model.isLastModule) {
            // no next module it means we have completed all the modules in the course 

            // lets check if we are enrolled in a profession if enrolled then check if we have next course in the profession
            let nextCourseInProfession;
            let nextModuleInNextCourse;
            if (user.currentProfession) {
              const profession = await Profession_Model.findById(user.currentProfession).populate('courses');
              const currentCourseIndex = profession.courses.findIndex(c => c.course.toString() === course._id.toString());
              nextCourseInProfession = profession.courses.find(c => c.order === currentCourseIndex + 1);
              if (!nextCourseInProfession) {
                // no next course that mean we have completed the profession lets cross check 
                let success = true;
                for (const profCourse of profession.courses) {
                  const isCompleted = user.completedCourses.some(cc => cc.toString() === profCourse.course.toString());
                  if (!isCompleted) {
                    nextCourseInProfession = profCourse;
                    success = false;
                    break;
                  }
                }
                if (success) {

                  const certificateData = {
                    title: profession.name,
                    completedAt: new Date(),
                    _id: profession._id
                  }

                  // lets generate the certificate here for profession completion
                  const res = await Certificate_service.generateCertificate(user, certificateData);
                  if (res.error) {
                    console.error('Certificate generation error:', res.error);
                  } else {
                    user.certificates.push(res.pdfUrl);
                  }
                  // user has completed the profession
                  user.enrolledProfessions.push(user.currentProfession);
                  user.currentProfession = null;
                  user.currentCourse = null;
                  user.currentModule = null;
                  await user.save();
                  return res.status(200).json({
                    status: 'success',
                    message: 'Congratulations! You have completed the entire profession.',
                    data: {
                      isProfessionCompleted: true,
                      submissionId: submission._id,
                      score: submission.score,
                      totalQuestions: Module_model.mcqs.length,
                      passed: isPassed,
                      results,
                      attemptNumber: attemptCount
                    }
                  });
                }
              }
              nextModuleInNextCourse = await Module_Model.findOne({ course: nextCourseInProfession.course }).sort({ order: 1 });
              user.currentModule = nextModuleInNextCourse ? nextModuleInNextCourse._id : null;
              user.currentCourse = nextCourseInProfession ? nextCourseInProfession.course : null;
              // lets generate a new certificate here for course completion
              const certificateData = {
                title: course.title,
                completedAt: new Date(),
                _id: course._id
              }
              const res = await Certificate_service.generateCertificate(user, certificateData);
              if (res.error) {
                console.error('Certificate generation error:', res.error);
              } else {

                user.certificates.push(res.pdfUrl);
              }

              await user.save();

              return res.status(200).json({
                status: 'success',
                message: 'All tests passed! Moved to next course in profession.',
                data: {
                  submissionId: submission._id,
                  score: submission.score,
                  totalQuestions: Module_model.mcqs.length,
                  passed: isPassed,
                  results,
                  attemptNumber: attemptCount
                }
              });

            }
            user.currentCourse = null;
            user.currentModule = null;
            // lets generate the certificate here
            const certificateData = {
              title: course.title,
              completedAt: new Date(),
              _id: course._id
            }
            const res = await Certificate_service.generateCertificate(user, certificateData);
            if (res.error) {
              console.error('Certificate generation error:', res.error);
            } else {
              user.certificates.push(res.pdfUrl);
            }
            user.completedCourses.push(course._id);
            await user.save();
            return res.status(200).json({
              status: 'success',
              message: 'Congratulations! You have completed all modules in this course.',
              data: {
                isCourseCompleted: true,
                submissionId: submission._id,
                score: submission.score,
                totalQuestions: Module_model.mcqs.length,
                passed: isPassed,
                results,
                attemptNumber: attemptCount
              }
            });
          }
          user.currentModule = nextModule ? nextModule._id : null;
          await user.save();
        }
      }

      // check if attempts are more than 3 so send cooldown for 1 hour
      let cooldownUntil;
      if (!isPassed && attemptCount > 3) {
        cooldownUntil = new Date(Date.now() + 60 * 60000); // 1 hour cooldown
        submission.cooldownUntil = cooldownUntil;
        await submission.save();
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
  get_my_module: async (req, res) => {
    try {
      const { userId } = req.user;
      const user = await User_Model.findById(userId);
      const userModule = await Module_Model.findById(user.currentModule).select('-mcqs.correctOptionIndex');
      const isCodingTaskCompleted = await Submission_Model.findOne({
        userId,
        moduleId: user.currentModule,
        type: 'code',
        status: 'passed'
      });
      const isMcqCompleted = await Submission_Model.findOne({
        userId,
        moduleId: user.currentModule,
        type: 'mcq',
        status: 'passed'
      });

      if (user && userModule) {
        userModule._doc.isCodingTaskCompleted = !!isCodingTaskCompleted;
        userModule._doc.isMcqCompleted = !!isMcqCompleted;
        userModule._doc.CodingTaskScore = isCodingTaskCompleted ? isCodingTaskCompleted.score : 0;
        userModule._doc.McqScore = isMcqCompleted ? isMcqCompleted.score : 0;
        userModule._doc.isModuleCompleted = !!(isCodingTaskCompleted && isMcqCompleted);
        return res.status(200).json({
          status: 'success',
          message: 'Current module retrieved successfully',
          data: userModule
        });
      }
      res.status(404).json({
        status: 'error',
        message: 'No current module found for the user'
      });

    } catch (error) {
      console.error(' Error in get_my_module:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get my module'
      });
    }
  }
}

module.exports = Module_controller