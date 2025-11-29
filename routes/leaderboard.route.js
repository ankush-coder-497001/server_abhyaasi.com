const express = require("express");
const router = express.Router();
const Auth = require("../middlewares/auth");
const LeaderBoard_Controller = require("../controllers/leaderboard.ctrl");

router.get("/", Auth, LeaderBoard_Controller.getLeaderBoard);
router.get("/all-list", Auth, LeaderBoard_Controller.getAllLeaderBoard);

module.exports = router;
