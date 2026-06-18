const express = require('express');
const router = express.Router();

// --- DEPENDENCY INJECTIONS ---
const { auth } = require('../middleware/auth');

// [ARCHITECTURAL FIX]: Removed curly braces. Direct import assumes module.exports = upload;
const upload = require('../middleware/upload'); 

// --- ROUTE DEFINITIONS ---
// The pipeline strictly executes: 1. File Parse -> 2. Response Callback
router.post('/file', upload.single('document'), (req, res) => {
    
    // Safety Trap: Prevent crashes if the payload is empty
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            message: "Upload failed: No file detected in the payload." 
        });
    }

    // --- OVERWRITE LINES 23 TO 28 WITH THIS ENGINE LOGIC ---
return res.status(200).json({
    success: true,
    message: "File uploaded successfully.",
    fileName: req.file.filename,
    fileUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    });
});

module.exports = router;
