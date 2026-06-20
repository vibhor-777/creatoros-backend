const fs = require('fs');

// Replace in userController.js
let content = fs.readFileSync('src/controllers/userController.js', 'utf8');
content = content.replace(/\.select\('-password'\)/g, '');

// Add delete/patch routes to userController.js
const extraCode = `
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return sendError(res, 'User not found', 404);
  if (user.role === 'admin') return sendError(res, 'Cannot delete admin user', 400);
  await User.findByIdAndDelete(id);
  return sendSuccess(res, null, 'User deleted');
});

exports.clearAllUsers = asyncHandler(async (req, res) => {
  await User.deleteMany({ role: { $ne: 'admin' } });
  return sendSuccess(res, null, 'All non-admin users deleted');
});

exports.editUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByIdAndUpdate(id, req.body, { new: true });
  if (!user) return sendError(res, 'User not found', 404);
  return sendSuccess(res, user, 'User updated');
});
`;
if (!content.includes('clearAllUsers')) {
  content += extraCode;
}
fs.writeFileSync('src/controllers/userController.js', content);

// Replace in userRoutes.js
let routesContent = fs.readFileSync('src/routes/userRoutes.js', 'utf8');
if (!routesContent.includes('clear-all')) {
  const newRoutes = `
router.delete('/admin/clear-all', auth, authorize('admin'), userController.clearAllUsers);
router.delete('/:id', auth, authorize('admin'), userController.deleteUser);
router.patch('/:id/edit', auth, authorize('admin'), userController.editUser);
`;
  routesContent = routesContent.replace('module.exports = router;', newRoutes + '\\nmodule.exports = router;');
  fs.writeFileSync('src/routes/userRoutes.js', routesContent);
}

// Replace in productController.js
let prodContent = fs.readFileSync('src/controllers/productController.js', 'utf8');
if (!prodContent.includes('clearAllProducts')) {
  const extraProdCode = `
const clearAllProducts = asyncHandler(async (req, res) => {
  await Product.deleteMany({});
  return sendSuccess(res, null, 'All products deleted');
});
`;
  prodContent = prodContent.replace('module.exports = {', extraProdCode + '\\nmodule.exports = {\n  clearAllProducts,');
  fs.writeFileSync('src/controllers/productController.js', prodContent);
}

// Replace in productRoutes.js
let prodRoutes = fs.readFileSync('src/routes/productRoutes.js', 'utf8');
if (!prodRoutes.includes('clear-all')) {
  const newProdRoutes = `
router.delete('/admin/clear-all', auth, authorize('admin'), productController.clearAllProducts);
`;
  prodRoutes = prodRoutes.replace('module.exports = router;', newProdRoutes + '\\nmodule.exports = router;');
  fs.writeFileSync('src/routes/productRoutes.js', prodRoutes);
}

console.log('Done updating backend controllers and routes');
