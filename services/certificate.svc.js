const PDFDocument = require('pdfkit');
const cloudinary = require('../config/cloudinary');
const path = require('path');
const { PassThrough } = require('stream');
const sharp = require('sharp');

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
   * Generate a certificate (PDF + Image), upload to Cloudinary, and return URLs.
   * @param {Object} userData - user info (expects _id, name)
   * @param {Object} courseData - course info (expects _id, title, completedAt)
   */
  async generateCertificate(userData, courseData) {
    try {
      // Generate PDF
      const pdfUrl = await this._generateAndUploadPDF(userData, courseData);

      // Generate Image from PDF (fallback/preview)
      const imageUrl = await this._generateAndUploadImage(userData, courseData);

      return {
        pdfUrl,
        imageUrl,
        publicId: path.basename(pdfUrl)
      };
    } catch (error) {
      console.error('Certificate generation error:', error);
      throw error;
    }
  }

  /**
   * Generate PDF and upload to Cloudinary
   */
  async _generateAndUploadPDF(userData, courseData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [this.CERTIFICATE_WIDTH, this.CERTIFICATE_HEIGHT],
          layout: 'landscape',
          margin: 0
        });

        // Upload PDF as raw file with proper handling
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'certificates',
            resource_type: 'raw',  // Use 'raw' for PDF files
            format: 'pdf'
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              // Cloudinary serves raw files as downloadable by default
              // We modify the URL to serve inline for browser viewing
              // Example: https://res.cloudinary.com/cloud/raw/upload/v123/file.pdf
              // becomes: https://res.cloudinary.com/cloud/raw/upload/fl_attachment:pdf/v123/file.pdf
              const urlParts = result.secure_url.split('/');
              const uploadIndex = urlParts.indexOf('upload');
              if (uploadIndex !== -1) {
                // Insert the inline parameter after 'upload'
                urlParts.splice(uploadIndex + 1, 0, 'fl_attachment:inline');
                const pdfUrl = urlParts.join('/');
                resolve(pdfUrl);
              } else {
                resolve(result.secure_url);
              }
            }
          }
        );

        const passThrough = new PassThrough();
        passThrough.pipe(uploadStream);

        // Pipe PDF data into the PassThrough stream
        doc.pipe(passThrough);

        // Draw the certificate design
        this._addCertificateDesign(doc, userData, courseData);

        // Finalize and send
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate certificate as image and upload to Cloudinary
   */

  /**
   * Generate certificate as image and upload to Cloudinary
   */
  async _generateAndUploadImage(userData, courseData) {
    try {
      // Create SVG/HTML representation and convert to image
      const imageBuffer = await this._createCertificateImage(userData, courseData);

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'certificates',
            resource_type: 'image',
            format: 'png'
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result.secure_url);
            }
          }
        );

        uploadStream.end(imageBuffer);
      });
    } catch (error) {
      console.warn('Image generation skipped:', error.message);
      return null; // Return null if image generation fails, PDF is still available
    }
  }

  /**
   * Create certificate as image buffer
   */
  async _createCertificateImage(userData, courseData) {
    const { name } = userData;
    const { title, completedAt } = courseData;

    const dateStr = new Date(completedAt || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create SVG with certificate design
    const svg = this._generateCertificateSVG(name, title, dateStr);

    // Convert SVG to PNG buffer using sharp
    return sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }

  /**
   * Generate certificate as SVG string
   */
  _generateCertificateSVG(name, title, dateStr) {
    // Escape XML special characters
    const escapeXML = (str) => {
      if (!str) return 'N/A';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const safeName = escapeXML(name || 'Unnamed Student');
    const safeTitle = escapeXML(title || 'Untitled Course');
    const safeDate = escapeXML(dateStr);

    return `
      <svg width="1000" height="707" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect width="1000" height="707" fill="#ffffff"/>
        
        <!-- Border -->
        <rect x="50" y="50" width="900" height="607" fill="none" stroke="#1BBDC6" stroke-width="3"/>
        
        <!-- Inner decorative border -->
        <rect x="60" y="60" width="880" height="587" fill="none" stroke="#09232F" stroke-width="1" opacity="0.3"/>
        
        <!-- Top decoration -->
        <circle cx="500" cy="80" r="20" fill="#1BBDC6" opacity="0.3"/>
        <line x1="350" y1="80" x2="650" y2="80" stroke="#1BBDC6" stroke-width="1" opacity="0.5"/>
        
        <!-- Title -->
        <text x="500" y="150" font-size="54" font-weight="bold" fill="#09232F" text-anchor="middle" font-family="Arial">
          Certificate of Completion
        </text>
        
        <!-- Subtitle -->
        <text x="500" y="220" font-size="28" fill="#333333" text-anchor="middle" font-family="Arial">
          This is to certify that
        </text>
        
        <!-- Recipient Name -->
        <text x="500" y="290" font-size="48" font-weight="bold" fill="#1BBDC6" text-anchor="middle" font-family="Arial">
          ${safeName}
        </text>
        
        <!-- Achievement Text -->
        <text x="500" y="350" font-size="28" fill="#333333" text-anchor="middle" font-family="Arial">
          has successfully completed the course
        </text>
        
        <!-- Course Title -->
        <text x="500" y="410" font-size="32" font-weight="bold" fill="#09232F" text-anchor="middle" font-family="Arial">
          ${safeTitle}
        </text>
        
        <!-- Date -->
        <text x="500" y="480" font-size="20" fill="#666666" text-anchor="middle" font-family="Arial">
          Issued on ${safeDate}
        </text>
        
        <!-- Seal/Badge -->
        <circle cx="500" cy="570" r="25" fill="#1BBDC6" opacity="0.2"/>
        <circle cx="500" cy="570" r="20" fill="none" stroke="#1BBDC6" stroke-width="2"/>
        <text x="500" y="580" font-size="24" fill="#1BBDC6" text-anchor="middle" font-family="Arial" font-weight="bold">✓</text>
        
        <!-- Bottom text -->
        <text x="500" y="650" font-size="12" fill="#999999" text-anchor="middle" font-family="Arial">
          This certificate verifies completion of course requirements
        </text>
      </svg>
    `;
  }

  /**
   * Adds all certificate design elements to PDF
   */
  _addCertificateDesign(doc, userData, courseData) {
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

    // Inner decorative border
    doc.rect(50, 50, this.CERTIFICATE_WIDTH - 100, this.CERTIFICATE_HEIGHT - 100)
      .strokeColor(this.THEME_COLORS.primary)
      .lineWidth(0.5)
      .opacity(0.3)
      .stroke()
      .opacity(1);

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
