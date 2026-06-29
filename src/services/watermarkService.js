const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');

const ensureDir = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const addPdfWatermark = async ({ inputPath, watermarkText, outputFileName }) => {
  const bytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    page.drawText(watermarkText, {
      x: width / 8,
      y: height / 2,
      size: 36,
      font,
      color: rgb(0.85, 0.1, 0.1),
      opacity: 0.2,
      rotate: degrees(35)
    });
  });

  const outputDirectory = path.resolve(process.cwd(), process.env.WATERMARK_OUTPUT_DIR || 'uploads/watermarked');
  ensureDir(outputDirectory);
  const safeName = outputFileName || `wm-${Date.now()}.pdf`;
  const outputPath = path.join(outputDirectory, safeName);

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
};

const addPdfWatermarkToBuffer = async (pdfBuffer, watermarkText, seller) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    // Footer info watermark (always drawn for security)
    page.drawText(watermarkText, {
      x: 20,
      y: 15,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.5
    });
  });

  const hasCustom = seller && 
    (['Elite', 'Nexus'].includes(seller.subscriptionTier) || (seller.level && seller.level >= 5)) && 
    seller.watermarkSettings && 
    seller.watermarkSettings.logoUrl;

  if (hasCustom) {
    let imageBytes;
    let isPng = true;
    try {
      const logoPath = seller.watermarkSettings.logoUrl;
      if (logoPath.startsWith('data:image')) {
        const base64Data = logoPath.split(';base64,').pop();
        imageBytes = Buffer.from(base64Data, 'base64');
        isPng = logoPath.includes('image/png');
      } else {
        const resolvedPath = path.resolve(process.cwd(), logoPath);
        if (fs.existsSync(resolvedPath)) {
          imageBytes = fs.readFileSync(resolvedPath);
          isPng = logoPath.endsWith('.png') || logoPath.endsWith('.PNG');
        }
      }

      if (imageBytes) {
        let image;
        if (isPng) {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          image = await pdfDoc.embedJpg(imageBytes);
        }

        const position = seller.watermarkSettings.position || 'diagonal';
        const opacity = (seller.watermarkSettings.opacity || 30) / 100;

        pages.forEach((page) => {
          const { width, height } = page.getSize();
          const scale = 0.25;
          const imgWidth = image.width * scale;
          const imgHeight = image.height * scale;

          let options = {
            width: imgWidth,
            height: imgHeight,
            opacity: opacity
          };

          if (position === 'center') {
            options.x = (width - imgWidth) / 2;
            options.y = (height - imgHeight) / 2;
          } else if (position === 'corner') {
            options.x = width - imgWidth - 20;
            options.y = height - imgHeight - 20;
          } else {
            // diagonal
            options.x = (width - imgWidth) / 2;
            options.y = (height - imgHeight) / 2;
            options.rotate = degrees(30);
          }

          page.drawImage(image, options);
        });
      }
    } catch (err) {
      console.warn("[Custom Watermark Logo Failed] Serving standard text watermark instead:", err.message);
      // Fallback: draw standard text diagonal watermark
      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 10,
          y: height / 2,
          size: 11,
          font,
          color: rgb(0.7, 0.7, 0.7),
          opacity: 0.22,
          rotate: degrees(30)
        });
      });
    }
  } else {
    // Draw standard text diagonal watermark
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: width / 10,
        y: height / 2,
        size: 11,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.22,
        rotate: degrees(30)
      });
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

module.exports = {
  addPdfWatermark,
  addPdfWatermarkToBuffer
};
