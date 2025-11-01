const submission = require('../models/submission.model');

const LeaderBoard_Controller = {
  getLeaderBoard: async (req, res) => {
    try {

      // lets calculate points for each user based on their submissions
      const leaderboardData = await submission.aggregate([
        { $match: { status: 'passed' } },
        {
          $group: {
            _id: '$userId',
            totalPoints: { $sum: '$pointsAwarded' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $unwind: '$userInfo'
        },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            totalPoints: 1,
            username: '$userInfo.username',
            avatar: '$userInfo.profile.profilePic'
          }
        },
        {
          $sort: { totalPoints: -1 }
        },
        { $limit: 50 }
      ]);

      res.status(200).json({ leaderboard: leaderboardData });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = LeaderBoard_Controller;