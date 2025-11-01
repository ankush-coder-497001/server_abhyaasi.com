const nodeMailer = require('nodemailer');
require('dotenv').config();

const transporter = nodeMailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

const EmailService = {
  sendOTPEmail: async (to, otp) => {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`
    };
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending OTP email:', error);
    }
  },
};
module.exports = EmailService;