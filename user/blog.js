document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // --- Element Selectors ---
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    const mainContent = document.getElementById('mainContent');
    const backToTopBtn = document.getElementById('backToTop');
    const scrollProgress = document.getElementById('scrollProgress');

    const usernameDisplay = document.getElementById('usernameDisplay');
    const profileImage = document.getElementById('profileImage');
    const userBalanceHeader = document.getElementById('userBalance');

    const blogSubmissionForm = document.getElementById('blogSubmissionForm');
    const titleInput = document.getElementById('title');
    const categorySelect = document.getElementById('category');
    const contentTextarea = document.getElementById('content');
    const charCountSpan = document.getElementById('charCount');
    const submitBlogBtn = document.getElementById('submitBlogBtn');
    const myBlogSubmissionsTableBody = document.getElementById('myBlogSubmissionsTableBody');

    // --- Unified Glassy Notification Engine ---
    function showGlassNotification(message, type = 'success') {
        const container = document.getElementById('glassNotifyContainer');
        if (!container) return;

        const node = document.createElement('div');
        node.className = 'glass-notification-node flex items-center gap-4 p-5 rounded-2xl pointer-events-auto min-w-[280px] shadow-2xl';
        
        const icons = {
            success: 'bi-shield-check text-emerald-400',
            error: 'bi-exclamation-octagon text-rose-400',
            info: 'bi-info-circle text-blue-400'
        };

        node.innerHTML = `
            <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                <i class="bi ${icons[type] || icons.info} text-lg"></i>
            </div>
            <div class="flex flex-col">
                <span class="text-[8px] font-medium text-white/40 mb-0">Notice</span>
                <p class="text-[10px] text-emerald-100/90 leading-tight mt-0.5">${message}</p>
            </div>
        `;

        container.appendChild(node);
        setTimeout(() => {
            node.style.opacity = '0';
            node.style.transform = 'translateX(20px)';
            setTimeout(() => node.remove(), 400);
        }, 4000);
    }

    function triggerGlassDecision(title, text, onConfirm, onAbort = () => {}) {
        const modal = document.getElementById('glassDecisionModal');
        if (!modal) return;
        document.getElementById('decisionTitle').innerText = title;
        document.getElementById('decisionText').innerText = text;
        document.getElementById('decisionIcon').innerHTML = `<i class="bi bi-shield-lock text-xl"></i>`;
        
        modal.classList.remove('hidden');
        
        const cleanup = () => {
            modal.classList.add('hidden');
            document.getElementById('decisionConfirm').onclick = null; // Clear previous handlers
            document.getElementById('decisionAbort').onclick = null;
        };
        
        document.getElementById('decisionAbort').onclick = () => {
            cleanup();
            onAbort();
        };
        document.getElementById('decisionConfirm').onclick = () => {
            cleanup();
            onConfirm();
        };
    }

    // --- Sidebar Toggle Logic ---
    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        toggle?.classList.toggle('hamburger-active');
        overlay?.classList.toggle('hidden');
    }
    if (toggle) toggle.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // --- Back to Top Logic ---
    if (mainContent) {
        mainContent.addEventListener('scroll', () => {
            const scrollTop = mainContent.scrollTop;
            const scrollHeight = mainContent.scrollHeight - mainContent.clientHeight;
            const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
            if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;

            if (scrollTop > 500) backToTopBtn?.classList.add('back-to-top-visible');
            else backToTopBtn?.classList.remove('back-to-top-visible');
        });
    }
    backToTopBtn?.addEventListener('click', () => {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- Logout Handler ---
    document.getElementById('logoutBtn')?.addEventListener('click', () => { // Changed to use triggerGlassDecision
        triggerGlassDecision('Log out', 'Are you sure you want to log out of your session?', () => {
            localStorage.clear();
            localStorage.setItem('waa_ads_logged_in', 'false');
            window.location.href = '../public/index.html';
        });
    });

    // 0. Immediate Profile Initialization (Pre-sync)
    const cachedUser = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
    if (usernameDisplay) usernameDisplay.innerText = cachedUser;
    if (profileImage) profileImage.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cachedUser}`;

    // 1. Synchronize Node Identity and Balance
    async function syncHeaderData() {
        try {
            const res = await fetch('/api/users/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();

            if (usernameDisplay) usernameDisplay.innerText = data.username || 'Agent_Alpha';
            if (profileImage) profileImage.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username || 'Agent_Alpha'}`;
            if (userBalanceHeader) userBalanceHeader.innerText = `KSh ${parseFloat(data.totalBalance).toLocaleString()}`;
        } catch (err) {
            showGlassNotification('Header sync error: ' + err.message, 'error');
        }
    }

    // --- Blog Submission Form Logic ---
    if (contentTextarea && charCountSpan) {
        contentTextarea.addEventListener('input', () => {
            charCountSpan.innerText = `${contentTextarea.value.length} Characters`;
        });
    }

    blogSubmissionForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        submitBlogBtn.disabled = true;
        submitBlogBtn.innerHTML = '<svg class="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending...';

        const blogData = {
            title: titleInput.value.trim(),
            category: categorySelect.value,
            content: contentTextarea.value.trim()
        };

        try {
            const response = await fetch('/api/users/blogs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(blogData)
            });

            const result = await response.json();

            if (response.ok) {
                showGlassNotification(result.message, 'success');
                blogSubmissionForm.reset();
                if (charCountSpan) charCountSpan.innerText = '0 Characters';
                loadUserBlogs(); // Refresh history
            } else {
                showGlassNotification(result.message || 'Blog submission failed.', 'error');
            }
        } catch (err) {
            showGlassNotification('Network error: Failed to submit blog.', 'error');
        } finally {
            submitBlogBtn.disabled = false;
            submitBlogBtn.innerHTML = '<span>Dispatch for review</span>';
        }
    });

    // --- Load User Blog Submissions History ---
    async function loadUserBlogs() {
        try {
            const response = await fetch('/api/users/blogs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch blog submissions.');
            const blogs = await response.json();

            if (myBlogSubmissionsTableBody) {
                if (blogs.length === 0) {
                    myBlogSubmissionsTableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500 italic">No blog submissions found.</td></tr>`;
                } else {
                    myBlogSubmissionsTableBody.innerHTML = blogs.map(blog => `
                        <tr class="hover:bg-gray-800/20 transition">
                            <td class="px-6 py-4 whitespace-nowrap text-gray-300 font-mono">${blog.id}</td>
                            <td class="px-6 py-4 text-gray-300">${blog.title}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-emerald-400 font-mono">KSh ${parseFloat(blog.reward).toFixed(2)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    blog.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' :
                                    blog.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' :
                                    'bg-amber-500/20 text-amber-400'
                                }">
                                    ${blog.status}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">${new Date(blog.created_at).toLocaleString()}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Error loading user blogs:', err);
            showGlassNotification('Failed to load blog submissions.', 'error');
            myBlogSubmissionsTableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-rose-500 italic">Failed to load submissions.</td></tr>`;
        }
    }

    await syncHeaderData();
    await loadUserBlogs();
});