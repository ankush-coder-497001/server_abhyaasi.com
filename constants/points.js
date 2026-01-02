// ================= POINTS SYSTEM CONSTANTS =================
// Standardized point values across all submission types and completions
const POINTS = {
  // Completion Points
  COURSE_COMPLETION: 100,       // Points awarded for completing a course
  PROFESSION_COMPLETION: 300,   // Points awarded for completing a profession

  // Submission Attempt Points (for leaderboard/progress)
  MCQ_SUBMISSION: 10,           // Points for MCQ submission attempt
  CODE_SUBMISSION: 15,          // Points for code submission attempt

  // Rank Thresholds (for medal tier calculations)
  GOLD_THRESHOLD: 1000,         // Points needed for Gold medal
  SILVER_THRESHOLD: 300,        // Points needed for Silver medal
  // Bronze is default if below Silver
};

module.exports = POINTS;
