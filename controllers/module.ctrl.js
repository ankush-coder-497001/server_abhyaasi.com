const Module_Model = require('../models/module.model')
const Course_Model = require('../models/course.model')
const Submission_Model = require('../models/submission.model')
const codeExecutionService = require('../services/codeExecution.svc');
const User_Model = require('../models/user.model');
const { trusted } = require('mongoose');
const Certificate_service = require('../services/certificate.svc');
const courseModel = require('../models/course.model');
const Profession_Model = require('../models/profession.model');
const POINTS = require('../constants/points');

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

      console.log('[SUBMIT_CODE] moduleId:', moduleId);
      console.log('[SUBMIT_CODE] userId:', userId);

      const Module_model = await Module_Model.findById(moduleId);
      const userModel = await User_Model.findById(userId);

      if (!Module_model || !Module_model.codingTask) {
        return res.status(404).json({
          status: 'error',
          message: 'Module or coding task not found'
        });
      }

      console.log('[MODULE]', {
        moduleId: Module_model._id,
        courseId: Module_model.courseId,
        order: Module_model.order
      });

      if (!Module_model.codingTask.languages.includes(language)) {
        return res.status(400).json({
          status: 'error',
          message: 'Language not supported'
        });
      }

      // ---------------- Submission handling ----------------
      const lastSubmission = await Submission_Model.findOne({
        userId,
        moduleId,
        type: 'code'
      }).sort({ createdAt: -1 });

      let submission;
      const attemptNumber = lastSubmission ? lastSubmission.attemptNumber + 1 : 1;

      if (lastSubmission) {
        submission = lastSubmission;
        submission.lastAttemptAt = new Date();
        submission.payload = { code, language };
        submission.currentCode = code;
        submission.status = 'running';
      } else {
        submission = new Submission_Model({
          userId,
          moduleId,
          courseId: Module_model.courseId,
          type: 'code',
          payload: { code, language },
          currentCode: code,
          status: 'running',
          attemptNumber
        });
      }

      await submission.save();

      // ---------------- Run test cases ----------------
      let totalTests = 0;
      let passedTests = 0;
      const testResults = [];

      for (const testCase of Module_model.codingTask.testcases) {
        totalTests++;
        try {
          const result = await codeExecutionService.executeCode(
            language,
            code,
            testCase,
            Module_model.codingTask.timeoutSeconds
          );

          const passed =
            !result.error &&
            codeExecutionService.validateOutput(
              result.output,
              testCase.expectedOutput
            );

          if (passed) passedTests++;

          testResults.push({
            testcaseId: testCase._id,
            passed,
            output: result.output,
            error: result.error,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            hidden: testCase.hidden || false
          });
        } catch (err) {
          testResults.push({
            testcaseId: testCase._id,
            passed: false,
            output: null,
            error: err.message,
            hidden: testCase.hidden || false
          });
        }
      }

      submission.status = passedTests === totalTests ? 'passed' : 'failed';
      submission.score = (passedTests / totalTests) * 100;
      submission.runResult = { testResults };
      await submission.save();

      // Format visible results - always show test case details but hide sensitive info for hidden tests that fail
      const visibleResults = testResults.map(r => {
        if (r.hidden && !r.passed) {
          // For hidden tests that failed, only show pass/fail status and generic error message
          return {
            testcaseId: r.testcaseId,
            passed: r.passed,
            hidden: true,
            error: r.error ? 'Test execution failed' : null
          };
        }
        // For public tests or hidden tests that passed, show all details
        return {
          testcaseId: r.testcaseId,
          passed: r.passed,
          input: r.input,
          expectedOutput: r.expectedOutput,
          actualOutput: r.output,
          error: r.error,
          hidden: r.hidden || false
        };
      });

      // ---------------- If code passed ----------------
      if (submission.status === 'passed') {
        const mcqSubmission = await Submission_Model.findOne({
          userId,
          moduleId,
          type: 'mcq',
          status: 'passed'
        });

        console.log('[MCQ]', mcqSubmission ? 'PASSED' : 'NOT PASSED');

        if (mcqSubmission) {
          const course = await Course_Model
            .findById(Module_model.courseId)
            .populate('modules');

          const nextModule = course.modules.find(
            m => m.order === Module_model.order + 1
          );

          console.log('[NEXT MODULE]', nextModule?._id || 'NONE');

          // ================= COURSE COMPLETED =================
          if (!nextModule) {
            console.log('[COURSE COMPLETED]', course.title);

            // ✅ Mark course as completed (IMPORTANT FIX)
            const alreadyCompleted = userModel.completedCourses.some(
              cc => cc.courseId.toString() === course._id.toString()
            );

            if (!alreadyCompleted) {
              console.log('[COURSE COMPLETION] Saving + generating certificate');

              const certificateData = {
                title: course.title,
                completedAt: new Date(),
                _id: course._id
              };

              const cert = await Certificate_service.generateCertificate(
                userModel,
                certificateData
              );

              userModel.completedCourses.push({
                courseId: course._id,
                completedDate: new Date(),
                points: POINTS.COURSE_COMPLETION,
                certificate: !!cert?.pdfUrl,
                certificateUrl: cert?.pdfUrl,
                certificatePdfUrl: cert?.pdfUrl,
                certificateImageUrl: cert?.imageUrl
              });
            }

            // ================= PROFESSION FLOW =================
            if (userModel.currentProfession) {
              const profession = await Profession_Model
                .findById(userModel.currentProfession)
                .populate('courses.course');

              console.log('[PROFESSION COURSES]');
              profession.courses.forEach(c =>
                console.log({
                  order: c.order,
                  title: c.course.title
                })
              );

              const currentCourseObj = profession.courses.find(
                c => c.course._id.toString() === course._id.toString()
              );

              const nextCourseInProfession = profession.courses.find(
                c => c.order === currentCourseObj.order + 1
              );

              console.log(
                '[NEXT COURSE]',
                nextCourseInProfession?.course?.title || 'NONE'
              );

              if (nextCourseInProfession) {
                const nextModuleInNextCourse = await Module_Model
                  .findOne({ courseId: nextCourseInProfession.course._id })
                  .sort({ order: 1 });

                userModel.currentCourse =
                  nextCourseInProfession.course._id;
                userModel.currentModule =
                  nextModuleInNextCourse?._id || null;

                await userModel.save();

                return res.status(200).json({
                  status: 'success',
                  message: 'Course completed. Moved to next course.',
                  data: {
                    isCourseCompleted: true,
                    testResults: visibleResults
                  }
                });
              }

              // ================= PROFESSION COMPLETED =================
              console.log('[PROFESSION COMPLETED]');

              // Generate certificate for profession (profession already fetched above)
              const profCert = profession ? await Certificate_service.generateCertificate(
                userModel,
                {
                  title: profession.name || 'Profession',
                  completedAt: new Date(),
                  _id: profession._id
                }
              ) : null;

              userModel.completedProfessions.push({
                professionId: userModel.currentProfession,
                completedDate: new Date(),
                points: POINTS.PROFESSION_COMPLETION,
                certificate: !!profCert?.pdfUrl,
                certificateUrl: profCert?.pdfUrl,
                certificatePdfUrl: profCert?.pdfUrl,
                certificateImageUrl: profCert?.imageUrl
              });

              userModel.currentProfession = null;
            }

            userModel.currentCourse = null;
            userModel.currentModule = null;
            await userModel.save();

            return res.status(200).json({
              status: 'success',
              message: 'Course completed successfully',
              data: { isCourseCompleted: true }
            });
          }

          // ================= MOVE TO NEXT MODULE =================
          userModel.currentModule = nextModule._id;
          await userModel.save();

          return res.status(200).json({
            status: 'success',
            message: 'Module completed. Moving to next module.',
            data: { isModuleCompleted: true }
          });
        }
      }

      // ---------------- Default response ----------------
      return res.status(200).json({
        status: 'success',
        message:
          submission.status === 'passed'
            ? 'All tests passed'
            : `${passedTests}/${totalTests} tests passed`,
        data: {
          submissionId: submission._id,
          status: submission.status,
          score: submission.score,
          passedTests,
          totalTests,
          testResults: visibleResults,
          summary: {
            totalTestCases: totalTests,
            passedTestCases: passedTests,
            failedTestCases: totalTests - passedTests,
            successPercentage: submission.score
          }
        }
      });

    } catch (error) {
      console.error('[SUBMIT_CODE ERROR]', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process code submission'
      });
    }
  }
  ,

  get_module: async (req, res) => {
    try {
      const { moduleId } = req.params;
      const { userId } = req.user;

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

      // Get completion status from Submission model
      let isMcqCompleted = false;
      let isCodingCompleted = false;
      let mcqScore = 0;
      let codingScore = 0;
      let mcqCooldown = null;
      let codingCooldown = null;
      let mcqAttemptsLeft = null;
      let codingAttemptsLeft = null;
      let storedCode = null;

      if (userId) {
        const mcqSubmission = await Submission_Model.findOne({
          userId,
          moduleId,
          type: 'mcq',
          status: 'passed'
        });

        const codingSubmission = await Submission_Model.findOne({
          userId,
          moduleId,
          type: 'code',
          status: 'passed'
        });

        // Get latest MCQ submission (passed or failed) for cooldown info
        const latestMcqSubmission = await Submission_Model.findOne({
          userId,
          moduleId,
          type: 'mcq'
        }).sort({ createdAt: -1 });

        // Get latest Coding submission (passed or failed) for cooldown info and stored code
        const latestCodingSubmission = await Submission_Model.findOne({
          userId,
          moduleId,
          type: 'code'
        }).sort({ createdAt: -1 });

        isMcqCompleted = !!mcqSubmission;
        isCodingCompleted = !!codingSubmission;
        mcqScore = mcqSubmission ? mcqSubmission.score : 0;
        codingScore = codingSubmission ? codingSubmission.score : 0;

        // Get stored code from latest submission
        if (latestCodingSubmission && latestCodingSubmission.currentCode) {
          storedCode = latestCodingSubmission.currentCode;
        }

        // Check MCQ cooldown
        if (latestMcqSubmission && latestMcqSubmission.cooldownUntil) {
          mcqCooldown = {
            isInCooldown: latestMcqSubmission.cooldownUntil > new Date(),
            cooldownUntil: latestMcqSubmission.cooldownUntil,
            cooldownRemainingSeconds: Math.ceil((latestMcqSubmission.cooldownUntil - new Date()) / 1000),
            attemptNumber: latestMcqSubmission.attemptNumber
          };
        }

        // Check Coding cooldown
        if (latestCodingSubmission && latestCodingSubmission.cooldownUntil) {
          codingCooldown = {
            isInCooldown: latestCodingSubmission.cooldownUntil > new Date(),
            cooldownUntil: latestCodingSubmission.cooldownUntil,
            cooldownRemainingSeconds: Math.ceil((latestCodingSubmission.cooldownUntil - new Date()) / 1000),
            attemptNumber: latestCodingSubmission.attemptNumber
          };
        }

        // Calculate attempts left for MCQ
        if (latestMcqSubmission && Module.mcqs.length > 0) {
          const mcqWithMaxAttempts = Module.mcqs.find(mcq => mcq.maxAttempts !== undefined);
          if (mcqWithMaxAttempts && mcqWithMaxAttempts.maxAttempts) {
            mcqAttemptsLeft = Math.max(0, mcqWithMaxAttempts.maxAttempts - latestMcqSubmission.attemptNumber);
          }
        }

        // Calculate attempts left for Coding (based on module's max attempts if defined)
        if (latestCodingSubmission && Module.codingTask && Module.codingTask.maxAttempts) {
          codingAttemptsLeft = Math.max(0, Module.codingTask.maxAttempts - latestCodingSubmission.attemptNumber);
        }
      }

      res.status(200).json({
        status: 'success',
        message: 'Module retrieved successfully',
        data: {
          ...Module.toObject ? Module.toObject() : Module,
          isMcqCompleted,
          isCodingCompleted,
          mcqScore,
          codingScore,
          isModuleCompleted: isMcqCompleted && isCodingCompleted,
          mcqCooldown,
          codingCooldown,
          mcqAttemptsLeft,
          codingAttemptsLeft,
          storedCode
        }
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
      const { answers } = req.body;
      const { userId } = req.user;

      console.log('[SUBMIT_MCQ] moduleId:', moduleId);
      console.log('[SUBMIT_MCQ] userId:', userId);

      const module = await Module_Model.findById(moduleId);
      const user = await User_Model.findById(userId);

      if (!module || !user) {
        return res.status(404).json({
          status: 'error',
          message: 'Module or user not found'
        });
      }

      // ---------------- Cooldown check ----------------
      const existingSubmission = await Submission_Model.findOne({
        userId,
        moduleId,
        type: 'mcq'
      }).sort({ createdAt: -1 });

      if (
        existingSubmission?.cooldownUntil &&
        existingSubmission.cooldownUntil > new Date()
      ) {
        return res.status(403).json({
          status: 403,
          message: `Cooldown active until ${existingSubmission.cooldownUntil}`
        });
      }

      // ---------------- Validation ----------------
      if (!Array.isArray(answers) || answers.length !== module.mcqs.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid answers format'
        });
      }

      const attemptNumber = existingSubmission
        ? existingSubmission.attemptNumber + 1
        : 1;

      // ---------------- Scoring ----------------
      let score = 0;
      const totalMarks = module.mcqs.length * 5;

      const results = module.mcqs.map((mcq, index) => {
        const isCorrect = mcq.correctOptionIndex === answers[index];
        if (isCorrect) score += 5;
        return {
          questionId: mcq._id,
          isCorrect,
          userAnswer: answers[index],
          correctAnswer: isCorrect ? undefined : mcq.correctOptionIndex,
          explanation: isCorrect ? undefined : mcq.explanation
        };
      });

      const percentage = (score / totalMarks) * 100;
      const isPassed = percentage >= 70;

      // ---------------- Save submission ----------------
      let submission = existingSubmission || new Submission_Model({
        userId,
        moduleId,
        courseId: module.courseId,
        type: 'mcq'
      });

      submission.payload = { answers, results };
      submission.status = isPassed ? 'passed' : 'failed';
      submission.score = percentage;
      submission.attemptNumber = attemptNumber;

      await submission.save();

      // ---------------- If MCQ passed ----------------
      if (isPassed) {
        const codeSubmission = await Submission_Model.findOne({
          userId,
          moduleId,
          type: 'code',
          status: 'passed'
        });

        if (codeSubmission) {
          const course = await Course_Model
            .findById(module.courseId)
            .populate('modules');

          const nextModule = course.modules.find(
            m => m.order === module.order + 1
          );

          // ================= COURSE COMPLETED =================
          if (!nextModule) {
            console.log('[COURSE COMPLETED]', course.title);

            // ✅ Ensure course completion stored
            const alreadyCompleted = user.completedCourses.some(
              cc => cc.courseId.toString() === course._id.toString()
            );

            if (!alreadyCompleted) {
              console.log('[COURSE COMPLETION] Saving course + certificate');

              const certData = {
                title: course.title,
                completedAt: new Date(),
                _id: course._id
              };

              const cert = await Certificate_service.generateCertificate(
                user,
                certData
              );

              user.completedCourses.push({
                courseId: course._id,
                completedDate: new Date(),
                points: POINTS.COURSE_COMPLETION,
                certificate: !!cert?.pdfUrl,
                certificateUrl: cert?.pdfUrl,
                certificatePdfUrl: cert?.pdfUrl,
                certificateImageUrl: cert?.imageUrl
              });
            }

            // ================= PROFESSION FLOW =================
            if (user.currentProfession) {
              const profession = await Profession_Model
                .findById(user.currentProfession)
                .populate('courses.course');

              const currentCourseObj = profession.courses.find(
                c => c.course._id.toString() === course._id.toString()
              );

              const nextCourse = profession.courses.find(
                c => c.order === currentCourseObj.order + 1
              );

              console.log('[NEXT COURSE]', nextCourse?.course?.title || 'NONE');

              if (nextCourse) {
                const nextModuleInCourse = await Module_Model
                  .findOne({ courseId: nextCourse.course._id })
                  .sort({ order: 1 });

                user.currentCourse = nextCourse.course._id;
                user.currentModule = nextModuleInCourse?._id || null;

                await user.save();

                return res.status(200).json({
                  status: 'success',
                  message: 'Course completed. Moved to next course.',
                  data: { isCourseCompleted: true }
                });
              }

              // ================= PROFESSION COMPLETED =================
              console.log('[PROFESSION COMPLETED]');

              const profCert = await Certificate_service.generateCertificate(
                user,
                {
                  title: profession.name,
                  completedAt: new Date(),
                  _id: profession._id
                }
              );

              user.completedProfessions.push({
                professionId: profession._id,
                completedDate: new Date(),
                points: POINTS.PROFESSION_COMPLETION,
                certificate: !!profCert?.pdfUrl,
                certificateUrl: profCert?.pdfUrl,
                certificatePdfUrl: profCert?.pdfUrl,
                certificateImageUrl: profCert?.imageUrl
              });

              user.currentProfession = null;
            }

            user.currentCourse = null;
            user.currentModule = null;
            await user.save();

            return res.status(200).json({
              status: 'success',
              message: 'Course completed successfully',
              data: { isCourseCompleted: true }
            });
          }

          // ================= MOVE TO NEXT MODULE =================
          user.currentModule = nextModule._id;
          await user.save();

          return res.status(200).json({
            status: 'success',
            message: 'Module completed. Moving to next module.',
            data: { isModuleCompleted: true }
          });
        }
      }

      // ---------------- Cooldown on failure ----------------
      if (!isPassed && attemptNumber > 3) {
        submission.cooldownUntil = new Date(Date.now() + 60 * 60000);
        await submission.save();
      }

      return res.status(200).json({
        status: 'success',
        message: isPassed
          ? 'MCQ completed successfully'
          : 'Some answers were incorrect',
        data: {
          submissionId: submission._id,
          score: submission.score,
          passed: isPassed,
          attemptNumber,
          results,
          cooldownUntil: submission.cooldownUntil
        }
      });

    } catch (error) {
      console.error('[SUBMIT_MCQ ERROR]', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to submit MCQ'
      });
    }
  }
  ,
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