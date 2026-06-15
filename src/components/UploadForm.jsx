import { useState } from 'react';
import { uploadFile } from '../utils/api';

export default function UploadForm() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setUploadStatus('Error: Please select a valid file first.');
            return;
        }

        try {
            setUploadStatus('Streaming binary payload to hostinger...');
            const result = await uploadFile(selectedFile);
            
            if (result.success) {
                setUploadStatus(`Success! Public URL: ${result.fileUrl}`);
                console.log("Uploaded file details:", result);
            } else {
                setUploadStatus(`Backend Rejected Request: ${result.message}`);
            }
        } catch (error) {
            setUploadStatus('Network Pipeline Exception failed.');
            console.error(error);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #333', borderRadius: '8px' }}>
            <h3>Secure File Transfer Console</h3>
            <form onSubmit={handleFormSubmit}>
                <input 
                    type="file" 
                    accept="image/png, image/jpeg" 
                    onChange={(e) => setSelectedFile(e.target.files[0])} 
                />
                <button type="submit" style={{ marginLeft: '10px' }}>Execute Upload</button>
            </form>
            {uploadStatus && <p style={{ marginTop: '15px', color: '#00ff00' }}>{uploadStatus}</p>}
        </div>
    );
}
