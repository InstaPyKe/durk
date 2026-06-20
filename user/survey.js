document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../login.html'; return; }

    // --- Sidebar Toggle Logic ---
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        toggle?.classList.toggle('hamburger-active');
        overlay?.classList.toggle('hidden');
    }
    if (toggle) toggle.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    const elements = {
        form: document.getElementById('surveyWizardForm'),
        submitBtn: document.getElementById('submitSurveyBtn'),
        title: document.getElementById('surveyTitle'),
        reward: document.getElementById('rewardAmount'),
        username: document.getElementById('usernameDisplay'),
        profileImg: document.getElementById('profileImage'),
        headerLoading: document.getElementById('headerProfileLoading'),
        headerContent: document.getElementById('headerProfileContent')
    };

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
                <span class="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">System Handshake</span>
                <p class="text-[9px] italic text-emerald-100/90 leading-tight uppercase tracking-tighter">${message}</p>
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
            document.getElementById('decisionConfirm').onclick = null;
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

    let currentTask = null;
    let answers = {};
    let sanitizedQuestions = [];

    // 1. Synchronize Profile
    async function syncProfile() {
        try {
            const res = await fetch('/api/users/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (elements.username) elements.username.innerText = data.username;
            if (elements.profileImg) elements.profileImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`;
            
            elements.headerLoading?.classList.add('hidden');
            elements.headerContent?.classList.replace('hidden', 'flex');
        } catch (err) { 
            showGlassNotification("Identity synchronization failed.", "error");
        }
    }

    // 2. Fetch Available Survey
    async function fetchSurvey() {
        try {
            const res = await fetch('/api/users/tasks/type/survey', { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (res.status === 403) {
                const errorData = await res.json();
                if (elements.form) {
                    elements.form.innerHTML = `
                        <div class="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] text-center">
                            <p class="text-rose-500 font-black uppercase tracking-widest mb-2">Security Protocol: Access Restricted</p>
                            <p class="text-[10px] text-gray-400 leading-relaxed uppercase tracking-tight">${errorData.message}. Use a <b>Real Agent Node</b> via Impersonation to test survey signatures.</p>
                        </div>`;
                }
                if (elements.submitBtn) elements.submitBtn.disabled = true;
                return;
            }

            const data = await res.json();
            const tasks = Array.isArray(data) ? data : [];

            if (tasks.length > 0) {
                currentTask = tasks[0];
                elements.title.innerText = currentTask.title;
                elements.reward.innerText = `Reward: KSh ${parseFloat(currentTask.reward).toLocaleString()}`;
                
                // Initialize Task Sequence in Ledger to satisfy duration/start-time requirements
                fetch('/api/users/tasks/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ taskId: currentTask.id })
                }).catch(err => console.error("Sequence Start Error", err));

                renderQuestions(currentTask.questions);
            } else {
                elements.form.innerHTML = `
                    <div class="py-20 text-center space-y-4">
                        <i class="bi bi-clipboard-check text-5xl text-gray-700"></i>
                        <p class="text-gray-500 uppercase font-black text-xs tracking-widest">Queue Exhausted</p>
                        <p class="text-[10px] text-gray-600 italic">No survey nodes available for synchronization at this time.</p>
                    </div>
                `;
            }
        } catch (err) { 
            showGlassNotification("Failed to synchronize with survey matrix.", "error");
        }
    }

    function renderQuestions(rawQuestions) {
        sanitizedQuestions = (Array.isArray(rawQuestions) ? rawQuestions : []).filter(q => q !== null);
        
        if (sanitizedQuestions.length === 0) {
            elements.form.innerHTML = `<p class="text-center text-gray-500 italic py-10">This survey has no active question nodes.</p>`;
            return;
        }

        elements.form.innerHTML = sanitizedQuestions.map((q, index) => `
            <div class="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500" style="animation-delay: ${index * 100}ms">
                <div class="flex items-center gap-3">
                    <span class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-black">${(index + 1).toString().padStart(2, '0')}</span>
                    <h3 class="text-lg font-bold text-white leading-tight tracking-tight">${q.question_text}</h3>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${['a', 'b', 'c', 'd'].map(opt => q[`option_${opt}`] ? `
                        <label class="group relative flex items-center p-4 bg-white/[0.01] border border-white/5 rounded-2xl cursor-pointer hover:bg-white/[0.03] hover:border-emerald-500/30 transition-all">
                            <input type="radio" name="q${index}" value="${opt}" class="hidden peer" onchange="window.handleSelection(${index}, '${opt}')">
                            <div class="w-7 h-7 rounded-xl border-2 border-gray-800 flex items-center justify-center group-hover:border-emerald-500/30 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all mr-3">
                                <span class="text-[9px] font-black text-gray-600 peer-checked:text-black">${opt.toUpperCase()}</span>
                            </div>
                            <span class="text-xs text-gray-400 group-hover:text-white transition-colors">${q[`option_${opt}`]}</span>
                        </label>
                    ` : '').join('')}
                </div>
            </div>
        `).join('');

        const notice = document.createElement('div');
        notice.id = "submissionNotice";
        notice.className = "text-center py-4";
        notice.innerHTML = `<p class="text-[10px] text-gray-500 uppercase font-black tracking-widest">Answer all questions to unlock reward synchronization</p>`;
        elements.form.appendChild(notice);
    }

    window.handleSelection = (index, val) => {
        answers[index] = val;
        const totalQuestions = sanitizedQuestions.length;
        const answeredCount = Object.keys(answers).length;

        if (answeredCount === totalQuestions) {
            if (elements.submitBtn) {
                elements.submitBtn.disabled = false;
                elements.submitBtn.classList.replace('bg-gray-800', 'bg-emerald-500');
                elements.submitBtn.classList.replace('text-gray-500', 'text-black');
                const notice = document.getElementById('submissionNotice');
                if (notice) notice.innerHTML = `<p class="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Sequence Complete: Ready for Payout</p>`;
            }
        }
    };

    elements.submitBtn.addEventListener('click', async () => {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerText = "Synchronizing Ledger...";
        try {
            const res = await fetch('/api/users/transactions/payout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ taskId: currentTask.id })
            });
            const data = await res.json();
            if (res.ok) {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                showGlassNotification(data.message, "success");
                setTimeout(() => window.location.href = 'dashboard.html', 2000);
            } else { 
                showGlassNotification(data.message, "error");
                elements.submitBtn.disabled = false; 
            }
        } catch (err) { 
            showGlassNotification("Critical Handshake Failure.", "error");
            elements.submitBtn.disabled = false; 
        }
    });

    // Logout handler
    const logoutHandler = () => triggerGlassDecision('SECURITY LOGOUT', 'Terminate active session and purge authentication token?', () => {
        localStorage.clear();
        window.location.href = '../public/index.html';
    });
    document.getElementById('logoutBtn')?.addEventListener('click', logoutHandler);
    document.getElementById('sidebarLogoutBtn')?.addEventListener('click', logoutHandler);

    syncProfile();
    fetchSurvey();
});