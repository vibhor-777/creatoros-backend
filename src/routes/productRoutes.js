const express = require('express');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', productController.listProducts);
router.get('/:productId', productController.getProductById);
router.get('/:productId/download', auth, productController.downloadProduct);
router.post('/', auth, upload.single('file'), productController.createProduct);
router.patch('/:productId', auth, productController.updateProduct);
router.delete('/:productId', auth, productController.deleteProduct);

module.exports = router;
