// --- DEPLOYMENT URL SETUP ---
// Change this to your Render URL when deployed (e.g., "https://my-library.onrender.com")
const API_BASE_URL = "https://books-h0tq.onrender.com";

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Security Check ---
    const currentAdmin = JSON.parse(localStorage.getItem('currentAdmin'));
    
    if (!currentAdmin) {
        alert("Access Denied. You must be an administrator to view this page.");
        window.location.href = "login.html";
        return; 
    }

    // --- 2. Logout Logic ---
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('currentAdmin');
            alert("Admin logged out.");
            window.location.href = "login.html";
        });
    }

    // --- 3. Add Book Logic (Using FormData for Image Uploads) ---
    const addBookForm = document.getElementById('add-book-form');

    if (addBookForm) {
        addBookForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            
            const submitBtn = addBookForm.querySelector('button[type="submit"]');
            submitBtn.textContent = "Uploading...";
            submitBtn.disabled = true;

            const formData = new FormData();
            formData.append('title', document.getElementById('book-title').value);
            formData.append('author', document.getElementById('book-author').value);
            formData.append('isbn', document.getElementById('book-isbn').value);
            formData.append('category', document.getElementById('book-category').value);
            
            const imageFile = document.getElementById('book-image').files[0];
            formData.append('coverImage', imageFile);

            try {
                const response = await fetch(`${API_BASE_URL}/api/books`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();

                if (response.ok) {
                    alert(`Success! "${formData.get('title')}" has been added to the library.`);
                    addBookForm.reset();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (error) {
                console.error("Error communicating with backend:", error);
                alert("Failed to connect to the database.");
            } finally {
                submitBtn.textContent = "Add Book to Library";
                submitBtn.disabled = false;
            }
        });
    }
});