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

module.exports = {
  addPdfWatermark
};
