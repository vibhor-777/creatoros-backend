const fs = require('fs');

let userController = fs.readFileSync('src/controllers/userController.js', 'utf8');
const verifyBlock = `  try {
    await user.save();
    await emailService.notifyUserVerificationResult(user, action === 'approve', user.rejectionReason);
    return sendSuccess(res, { user }, \`User verification \${action}d successfully\`);
  } catch (err) {
    console.error('Validation Error:', err);
    return sendError(res, 'Validation Error: ' + err.message, 400);
  }
});`;
userController = userController.replace(/await user\.save\(\);\s*\}\);/g, verifyBlock);
fs.writeFileSync('src/controllers/userController.js', userController);

let prodController = fs.readFileSync('src/controllers/productController.js', 'utf8');
const modBlock = `  try {
    await product.save();
    return sendSuccess(res, { product }, \`Product successfully \${action}d\`);
  } catch (err) {
    console.error('Save Error:', err);
    return sendError(res, 'Database Validation Error: ' + err.message, 400);
  }
});`;
prodController = prodController.replace(/await product\.save\(\);\s*return sendSuccess\(res, \{ product \}, \`Product successfully \$\\{action\\}d\`\);\s*\}\);/g, modBlock);
fs.writeFileSync('src/controllers/productController.js', prodController);

console.log('Done fixing controllers error handling');
