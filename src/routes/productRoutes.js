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
router.post('/', auth, upload.single('file'), productController.createProduct);
router.patch('/:productId', auth, productController.updateProduct);
router.delete('/:productId', auth, productController.deleteProduct);


router.delete('/admin/clear-all', auth, authorize('admin'), productController.clearAllProducts);
module.exports = router;
