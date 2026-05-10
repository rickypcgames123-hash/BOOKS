// --- DEPLOYMENT URL SETUP ---
// Change this to your Render URL when deployed (e.g., "https://my-library.onrender.com")
const API_BASE_URL = "https://books-h0tq.onrender.com";

document.addEventListener('DOMContentLoaded', () => {
    // --- 0. Check Login Status & Role ---
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const currentAdmin = JSON.parse(localStorage.getItem('currentAdmin'));
    const loggedInAccount = currentUser || currentAdmin; 
    
    const loginBtn = document.getElementById('nav-login-btn');
    const historyBtn = document.getElementById('nav-history-btn');
    const bookGrid = document.querySelector('.book-grid');
    const searchInput = document.querySelector('.search-container input');
    const searchBtn = document.querySelector('.search-btn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    if (loggedInAccount && loginBtn) {
        const prefix = currentAdmin ? "Admin:" : "User:";
        loginBtn.textContent = `${prefix} ${loggedInAccount.name.split(' ')[0]}`;
        loginBtn.href = "#"; 
        
        loginBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentAdmin');
            alert("Logged out successfully.");
            window.location.reload();
        });

        if (currentAdmin && historyBtn) {
            historyBtn.style.display = 'block';
            document.getElementById('nav-admin-dash').style.display = 'block';
        }
    }

    // --- 1. Fetch & Display Books Dynamically ---
    async function loadBooks() {
        try {
            // FIXED: Using backticks instead of single quotes here!
            const response = await fetch(`${API_BASE_URL}/api/books`);
            const books = await response.json();
            
            bookGrid.innerHTML = ''; 
            
            books.forEach(book => {
                const isAvailable = book.status === 'available';
                const statusClass = isAvailable ? 'available' : 'checked-out';
                const statusText = isAvailable ? 'Available' : 'Checked Out';
                const btnText = isAvailable ? 'Borrow' : 'Return Book';
                const btnColor = isAvailable ? '' : 'style="background-color: #e74c3c;"';

                const isAdmin = !!currentAdmin;
                const removeBtnHTML = isAdmin 
                    ? `<button class="remove-btn" style="background-color: #c0392b; color: white; border: none; padding: 0.6rem; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 0.5rem;">Remove Book</button>` 
                    : '';

                const card = document.createElement('div');
                card.className = 'book-card';
                card.setAttribute('data-category', book.category);
                card.setAttribute('data-id', book.id); 
                
                card.innerHTML = `
                    <img src="${book.coverImage}" alt="${book.title}" class="book-cover">
                    <h3>${book.title}</h3>
                    <p class="author">${book.author}</p>
                    <span class="status ${statusClass}">${statusText}</span>
                    <button class="action-btn" ${btnColor}>${btnText}</button>
                    ${removeBtnHTML}
                `;
                bookGrid.appendChild(card);
            });
        } catch (error) {
            console.error("Error fetching books:", error);
            bookGrid.innerHTML = '<p style="text-align:center; width:100%;">Error loading the library catalog. Please ensure the Python backend is running.</p>';
        }
    }

    loadBooks();

    // --- 2. Search & Filter Logic ---
    const filterByText = () => {
        const query = searchInput.value.toLowerCase().trim();
        filterBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-filter="all"]').classList.add('active');

        document.querySelectorAll('.book-card').forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            const author = card.querySelector('.author').textContent.toLowerCase();
            card.style.display = (title.includes(query) || author.includes(query)) ? 'flex' : 'none';
        });
    };

    if(searchInput) searchInput.addEventListener('keyup', filterByText);
    if(searchBtn) searchBtn.addEventListener('click', (e) => { e.preventDefault(); filterByText(); });

    // --- 3. Category Buttons ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            searchInput.value = '';
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filterValue = btn.getAttribute('data-filter');
            document.querySelectorAll('.book-card').forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                card.style.display = (filterValue === 'all' || cardCategory === filterValue) ? 'flex' : 'none';
            });
        });
    });

    // --- 4. Event Delegation (Borrow, Return, & Delete Logic) ---
    bookGrid.addEventListener('click', async function(e) {
        
        // BORROW & RETURN LOGIC
        if (e.target.classList.contains('action-btn')) {
            if (!loggedInAccount) {
                alert("Please log in to borrow or return books.");
                window.location.href = "login.html";
                return;
            }

            const btn = e.target; 
            const card = btn.closest('.book-card');
            const bookId = card.getAttribute('data-id'); 
            const statusSpan = card.querySelector('.status');
            const bookTitle = card.querySelector('h3').textContent;
            
            const isBorrowing = btn.textContent === 'Borrow';
            const newStatus = isBorrowing ? 'checked-out' : 'available';

            try {
                btn.disabled = true;
                btn.textContent = "Processing...";

                const response = await