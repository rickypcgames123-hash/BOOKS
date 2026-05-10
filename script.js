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

                const response = await fetch(`${API_BASE_URL}/api/books/${bookId}/action`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: newStatus,
                        user_name: loggedInAccount.name,
                        book_title: bookTitle
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    if (isBorrowing) {
                        statusSpan.classList.replace('available', 'checked-out');
                        statusSpan.textContent = 'Checked Out';
                        btn.textContent = 'Return Book';
                        btn.style.backgroundColor = '#e74c3c'; 

                        const borrowDate = new Date();
                        const dueDate = new Date();
                        dueDate.setDate(borrowDate.getDate() + 7); 
                        
                        const fineDateThreshold = new Date();
                        fineDateThreshold.setDate(borrowDate.getDate() + 10); 
                        card.dataset.fineDate = fineDateThreshold.toISOString();

                        let dateMsg = document.createElement('p');
                        dateMsg.className = 'date-msg';
                        dateMsg.style.cssText = 'font-size: 0.85rem; margin: 1rem 0; font-weight: bold; color: #34495e;';
                        dateMsg.textContent = `Due: ${dueDate.toLocaleDateString()}`;
                        card.insertBefore(dateMsg, btn);

                    } else {
                        const today = new Date();
                        const fineDate = new Date(card.dataset.fineDate);

                        if (card.dataset.fineDate && today > fineDate) {
                            const diffTime = Math.abs(today - fineDate);
                            const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            const fineAmount = daysLate * 2.50; 
                            alert(`⚠️ THIS BOOK IS OVERDUE! \nYou kept it past the limit. Fined $${fineAmount.toFixed(2)}.`);
                        } else {
                            alert("✅ Book returned successfully.");
                        }

                        statusSpan.classList.replace('checked-out', 'available');
                        statusSpan.textContent = 'Available';
                        btn.textContent = 'Borrow';
                        btn.style.backgroundColor = ''; 

                        const dateMsg = card.querySelector('.date-msg');
                        if (dateMsg) dateMsg.remove();
                        delete card.dataset.fineDate;
                    }
                } else {
                    alert("Error: " + data.error);
                    btn.textContent = isBorrowing ? 'Borrow' : 'Return Book'; 
                }
            } catch (error) {
                console.error("Failed to communicate with server:", error);
                alert("Network error. Please make sure the server is running.");
                btn.textContent = isBorrowing ? 'Borrow' : 'Return Book'; 
            } finally {
                btn.disabled = false; 
            }
        }

        // ADMIN REMOVE BOOK LOGIC
        if (e.target.classList.contains('remove-btn')) {
            const btn = e.target;
            const card = btn.closest('.book-card');
            const bookId = card.getAttribute('data-id');
            const bookTitle = card.querySelector('h3').textContent;

            if (confirm(`Are you sure you want to permanently delete "${bookTitle}"?`)) {
                btn.textContent = "Deleting...";
                btn.disabled = true;

                try {
                    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
                        method: 'DELETE'
                    });
                    
                    const data = await response.json();

                    if (response.ok) {
                        alert(`Success: ${bookTitle} has been removed.`);
                        card.remove(); 
                    } else {
                        alert("Error: " + data.error);
                        btn.textContent = "Remove Book";
                        btn.disabled = false;
                    }
                } catch (error) {
                    console.error("Failed to delete book:", error);
                    alert("Network error. Please make sure the server is running.");
                    btn.textContent = "Remove Book";
                    btn.disabled = false;
                }
            }
        }
    });

    // --- 5. History Modal Logic connected to Backend (Admin Only) ---
    const historyModal = document.getElementById('history-modal');
    const closeHistoryBtn = document.querySelector('.close-history');
    
    if (historyBtn && historyModal) {
        historyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const historyBody = document.getElementById('history-body');
            
            historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading history from database...</td></tr>';
            historyModal.classList.add('active');

            try {
                const response = await fetch(`${API_BASE_URL}/api/history`);
                const historyData = await response.json();
                
                historyBody.innerHTML = ''; 
                
                if(historyData.length === 0) {
                    historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No history recorded yet.</td></tr>';
                } else {
                    historyData.forEach(log => {
                        const dateObj = new Date(log.action_date);
                        const formattedDate = dateObj.toLocaleString();

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${formattedDate !== 'Invalid Date' ? formattedDate : log.action_date}</td>
                            <td>${log.book_title}</td>
                            <td>${log.user_name}</td>
                            <td style="color: ${log.action === 'Borrowed' ? '#e74c3c' : '#27ae60'}; font-weight:bold;">${log.action}</td>
                        `;
                        historyBody.appendChild(tr);
                    });
                }
            } catch (error) {
                console.error("Error fetching history:", error);
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Failed to load history. Ensure the Python server is running.</td></tr>';
            }
        });

        closeHistoryBtn.addEventListener('click', () => {
            historyModal.classList.remove('active');
        });

        window.addEventListener('click', (e) => {
            if (e.target === historyModal) {
                historyModal.classList.remove('active');
            }
        });
    }
});