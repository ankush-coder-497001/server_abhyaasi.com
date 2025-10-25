const PDFDocument = require('pdfkit');
const cloudinary = require('../config/cloudinary');
const path = require('path');
const { PassThrough } = require('stream');

class CertificateService {
  constructor() {
    this.CERTIFICATE_WIDTH = 842;  // A4 landscape width
    this.CERTIFICATE_HEIGHT = 595; // A4 landscape height
    this.THEME_COLORS = {
      primary: '#09232F',   // Dark blue
      accent: '#1BBDC6',    // Turquoise
      text: '#333333'
    };
  }

  /**
   * Generate a certificate PDF, upload to Cloudinary, and return URLs.
   * @param {Object} userData - user info (expects _id, name)
   * @param {Object} courseData - course info (expects _id, title, completedAt)
   */
  async generateCertificate(userData, courseData) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [this.CERTIFICATE_WIDTH, this.CERTIFICATE_HEIGHT],
          layout: 'landscape',
          margin: 0
        });

        // Stream PDF directly to Cloudinary (no need to keep all chunks in memory)
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'certificates',
            resource_type: 'raw',
            format: 'pdf'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve({
              pdfUrl: result.secure_url,
              publicId: result.public_id
            });
          }
        );

        const passThrough = new PassThrough();
        passThrough.pipe(uploadStream);

        // Pipe PDF data into the PassThrough stream
        doc.pipe(passThrough);

        // Draw the certificate design
        await this._addCertificateDesign(doc, userData, courseData);

        // Finalize and send
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Adds all certificate design elements
   */
  async _addCertificateDesign(doc, userData, courseData) {
    const { name, _id: userId } = userData;
    const { title, completedAt, _id: courseId } = courseData;

    // Background
    doc.rect(0, 0, this.CERTIFICATE_WIDTH, this.CERTIFICATE_HEIGHT)
      .fill('#ffffff');

    // Border
    doc.rect(40, 40, this.CERTIFICATE_WIDTH - 80, this.CERTIFICATE_HEIGHT - 80)
      .strokeColor(this.THEME_COLORS.accent)
      .lineWidth(2)
      .stroke();

    // Logo (optional)
    try {
      const logoPath = path.join(__dirname, '../assets/abhyasi-logo.png');
      doc.image(logoPath, this.CERTIFICATE_WIDTH / 2 - 100, 60, { width: 200 });
    } catch (err) {
      console.warn('Logo not found, skipping image.');
    }

    // Certificate Title
    doc.font('Helvetica-Bold')
      .fontSize(36)
      .fillColor(this.THEME_COLORS.primary)
      .text('Certificate of Completion', 0, 160, { align: 'center' });

    // Recipient Info
    doc.fontSize(24)
      .fillColor(this.THEME_COLORS.text)
      .text('This is to certify that', 0, 240, { align: 'center' });

    doc.font('Helvetica-Bold')
      .fontSize(32)
      .fillColor(this.THEME_COLORS.accent)
      .text(name || 'Unnamed Student', 0, 280, { align: 'center' });

    // Course Info
    doc.font('Helvetica')
      .fontSize(24)
      .fillColor(this.THEME_COLORS.text)
      .text('has successfully completed the course', 0, 340, { align: 'center' });

    doc.font('Helvetica-Bold')
      .fontSize(28)
      .fillColor(this.THEME_COLORS.primary)
      .text(title || 'Untitled Course', 0, 380, { align: 'center' });

    // Completion Date
    const dateStr = new Date(completedAt || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    doc.font('Helvetica')
      .fontSize(16)
      .fillColor(this.THEME_COLORS.text)
      .text(`Issued on ${dateStr}`, 0, 460, { align: 'center' });

    // Certificate ID
    const certificateId = this._generateCertificateId(userId, courseId);
    doc.fontSize(10)
      .fillColor('#777')
      .text(`Certificate ID: ${certificateId}`, 0, 540, { align: 'center' });

    // Verification link
    doc.fontSize(10)
      .fillColor('#999')
      .text('Verify this certificate at abhyasi.com/verify', 0, 555, { align: 'center' });
  }

  /**
   * Generate unique certificate ID
   */
  _generateCertificateId(userId, courseId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const userPart = userId ? userId.toString().slice(-4).toUpperCase() : 'USER';
    const coursePart = courseId ? courseId.toString().slice(-4).toUpperCase() : 'COUR';
    return `ABH-${timestamp}-${userPart}-${coursePart}`;
  }
}

module.exports = new CertificateService();
