const express = require("express");
const router = express.Router();
const AIChatController = require("../controllers/AIchat.ctrl");

router.post("/chat", AIChatController.chat);
router.post("/voice-chat", AIChatController.voiceChat);
router.post("/chat-related-platform", AIChatController.chatWithRelatedPlatform);

module.exports = router;