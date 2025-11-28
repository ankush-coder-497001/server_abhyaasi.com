const submission = require("../models/submission.model");
const UserModel = require("../models/user.model");
const Badge = require("../models/badge.model");

const LeaderBoard_Controller = {
  getLeaderBoard: async (req, res) => {
    try {
      // lets calculate points for each user based on their submissions
      const leaderboardData = await submission.aggregate([
        { $match: { status: "passed" } },
        {
          $group: {
            _id: "$userId",
            totalPoints: { $sum: "$score" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        {
          $unwind: "$userInfo",
        },
        {
          $lookup: {
            from: "badges",
            localField: "userInfo.badges",
            foreignField: "_id",
            as: "badgesInfo",
          },
        },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            totalPoints: 1,
            name: "$userInfo.name",
            username: "$userInfo.username",
            avatar: "$userInfo.profile.profilePic",
            rank: "$userInfo.rank",
            badges: {
              $map: {
                input: "$badgesInfo",
                as: "badge",
                in: { title: "$$badge.title", iconUrl: "$$badge.iconUrl" },
              },
            },
          },
        },
        {
          $sort: { totalPoints: -1 },
        },
        { $limit: 50 },
      ]);

      // Add rank number to each entry
      const leaderboardWithRank = leaderboardData.map((entry, index) => ({
        rankPosition: index + 1,
        ...entry,
      }));

      res.status(200).json({ leaderboard: leaderboardWithRank });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getAllLeaderBoard: async (req, res) => {
    try {
      // Get all users with their total points from passed submissions
      const leaderboardData = await submission.aggregate([
        { $match: { status: { $in: ["passed", "completed"] } } },
        {
          $group: {
            _id: "$userId",
            totalPoints: { $sum: "$score" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        {
          $unwind: "$userInfo",
        },
        {
          $lookup: {
            from: "badges",
            localField: "userInfo.badges",
            foreignField: "_id",
            as: "badgesInfo",
          },
        },
        {
          $project: {
            userId: "$_id",
            totalPoints: 1,
            name: "$userInfo.name",
            username: "$userInfo.username",
            avatar: "$userInfo.profile.profilePic",
            rank: "$userInfo.rank",
            badges: {
              $map: {
                input: "$badgesInfo",
                as: "badge",
                in: { title: "$$badge.title", iconUrl: "$$badge.iconUrl" },
              },
            },
          },
        },
      ]);

      // Get all users and add their points (or 0 if no points)
      const allUsers = await UserModel.find()
        .limit(50)
        .populate("badges", "title iconUrl");

      // Create a map of userId -> points for quick lookup
      const pointsMap = {};
      leaderboardData.forEach((entry) => {
        pointsMap[entry.userId.toString()] = entry.totalPoints;
      });

      // Combine all users with their points
      const finalLeaderboard = allUsers.map((user, index) => ({
        userId: user._id,
        totalPoints: pointsMap[user._id.toString()] || 0,
        name: user.name,
        username: user.username,
        avatar: user.profile?.profilePic || null,
        rank: user.rank,
        badges:
          user.badges?.map((b) => ({ title: b.title, iconUrl: b.iconUrl })) ||
          [],
      }));

      // Sort by points descending
      finalLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

      // Re-assign ranks after sorting - use rankPosition for the numeric rank
      const leaderboardWithRank = finalLeaderboard.map((entry, index) => ({
        ...entry,
        rankPosition: index + 1,
      }));

      res.status(200).json({ leaderboard: leaderboardWithRank });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};

module.exports = LeaderBoard_Controller;
