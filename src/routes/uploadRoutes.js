const express = require('express');
const router = express.Router();

// --- DEPENDENCY INJECTIONS ---
const { auth } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

// Optional: Keep this imported if you plan to move the logic to a controller later
// const { uploadIdCard } = require('../controllers/uploadController');

// --- ROUTE DEFINITIONS ---
// The pipeline strictly executes: 1. Auth Check -> 2. File Parse -> 3. Response Callback
router.post('/file', auth, uploadImage.single('document'), (req, res) => {
    
    // Safety Trap: Prevent crashes if the payload is empty
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            message: "Upload failed: No file detected in the payload." 
        });
    }

    // Execution Success: Return the metadata to the client
    return res.status(200).json({
        success: true,
        message: "File uploaded successfully.",
        fileName: req.file.filename,
        fileUrl: req.file.path // Path depends on your specific Multer storage config
    });
});

module.exports = router;
