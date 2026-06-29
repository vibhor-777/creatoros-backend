const express = require('express');
const { auth, authorize, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', optionalAuth, productController.listProducts);
router.get('/admin/pending', auth, authorize('admin'), productController.getPendingProductsForAdmin);
router.post('/:productId/moderate', auth, authorize('admin'), productController.moderateProduct);

router.get('/:productId', productController.getProductById);
router.get('/:productId/download', auth, productController.downloadProduct);
router.post('/', auth, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }, { name: 'gallery', maxCount: 4 }]), productController.createProduct);
router.patch('/:productId', auth, productController.updateProduct);
router.post('/:productId/duplicate', auth, productController.duplicateProduct);
router.delete('/admin/clear-all', auth, authorize('admin'), productController.clearAllProducts);
router.delete('/:productId', auth, productController.deleteProduct);

module.exports = router;
