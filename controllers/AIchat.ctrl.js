const { chatWithAI, chatWithAIRelatedPlatform } = require("../services/AI.svc");

const AIChatController = {
  chat: async (req, res, next) => {
    try {

      const { message, embedding } = req.body;
      const aiResponse = await chatWithAI(message, embedding);
      res.status(200).json({
        status: 'success',
        data: {
          response: aiResponse
        }
      });
    } catch (error) {
      console.error('AI Chat Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process AI chat request'
      });
    }
  },
  voiceChat: async (req, res, next) => {
    try {
      const { message, embedding } = req.body;
      const aiResponse = await chatWithAI(message, embedding, true);

      res.status(200).json({
        status: 'success',
        data: {
          response: aiResponse
        }
      });
    } catch (error) {
      console.error('AI Voice Chat Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process AI voice chat request'
      });
    }
  },
  chatWithRelatedPlatform: async (req, res, next) => {
    try {
      const { message } = req.body;
      const aiResponse = await chatWithAIRelatedPlatform(message);
      res.status(200).json({
        status: 'success',
        data: {
          response: aiResponse
        }
      });
    } catch (error) {
      console.error('AI Related Platform Chat Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process AI related platform chat request'
      });
    }
  }
}

module.exports = AIChatController;