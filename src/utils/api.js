const BASE_URL = "https://api.studio-z.in/api/v1";

// Handles live user registration and dynamic token capture
export const registerUser = async (username, email, password) => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Test User", username, email, password, verificationMethod: "id_card" })
    });
    const data = await response.json();
    if (data.accessToken) {
        localStorage.setItem('token', data.accessToken); // Automation step
    }
    return data;
};

// Handles automated file streaming with header token injection
export const uploadFile = async (fileObject) => {
    const formData = new FormData();
    formData.append('document', fileObject); // Matches Multer setup

    const savedToken = localStorage.getItem('token'); // Pulls live token dynamically

    const response = await fetch(`${BASE_URL}/upload/file`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${savedToken}`
        },
        body: formData // Browser handles multipart boundaries automatically
    });
    return await response.json();
};
