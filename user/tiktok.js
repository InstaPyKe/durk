document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../login.html'; return; }

    // --- Sidebar Toggle Logic ---
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        toggle?.classList.toggle('hamburger-active');
        sidebarOverlay?.classList.toggle('hidden');
    }
    if (toggle) toggle.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

    const elements = {
        videoFrameContainer: document.getElementById('tiktokPlayer'),
        taskTitle: document.getElementById('taskTitle'),
        taskDescription: document.getElementById('taskDescription'),
        rewardText: document.getElementById('rewardAmount'),
        timerDisplay: document.getElementById('timerDisplay'),
        claimBtn: document.getElementById('claimBtn'),
        skipBtn: document.getElementById('skipBtn'),
        startBtn: document.getElementById('startBtn'),
        usernameDisplay: document.getElementById('usernameDisplay'),
        profileImage: document.getElementById('profileImage'),
        overlay: document.getElementById('playerOverlay'),
        countdownContainer: document.getElementById('countdownContainer'),
        statusMsg: document.getElementById('engineStatus'),
        progressText: document.getElementById('progressText'),
        progressFill: document.getElementById('progressFill')
    };

    let currentTask = null;
    let secondsLeft = 0;
    let isPaused = false;
    let isTimerInitialized = false;
    let timerInterval = null;
    let isTiktokVideoPlaying = false;

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
                <span class="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Notification</span>
                <p class="text-[9px] italic text-emerald-100/90 leading-tight uppercase tracking-tighter">${message.toLowerCase()}</p>
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
    };

    // 0. Immediate Profile Initialization (Pre-sync)
    const cachedUser = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
    if (elements.usernameDisplay) elements.usernameDisplay.innerText = cachedUser;
    if (elements.profileImage) elements.profileImage.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cachedUser}`;

    // 1. Synchronize Node Balance
    async function syncBalance() {
        const res = await fetch('/api/users/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (elements.usernameDisplay) {
            elements.usernameDisplay.innerText = data.username || 'Agent_Alpha';
        }
        if (elements.profileImage) {
            elements.profileImage.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username || 'Agent_Alpha'}`;
        }

        // Update specific TikTok Sector Yield (Wallet Balance)
        const tiktokStats = data.sectorEarnings.find(s => s.name === 'TikTok');
        const tiktokWalletDisplay = document.getElementById('tiktokWalletBalance');
        if (tiktokWalletDisplay && tiktokStats) {
            tiktokWalletDisplay.innerText = `KSh ${parseFloat(tiktokStats.amount).toLocaleString()}`;
            
            // Update Daily Progress Bar
            const completed = tiktokStats.completed || 0;
            const limit = tiktokStats.limit || 10;
            const percent = (completed / limit) * 100;
            
            if (elements.progressText) elements.progressText.innerText = `${completed} / ${limit}`;
            if (elements.progressFill) elements.progressFill.style.width = `${percent}%`;
        }
    }

    // Function to extract TikTok video ID from various URL formats
    function extractTiktokVideoId(url) {
        if (!url) return null;
        const trimmed = url.trim();
        const match = trimmed.match(/(?:video\/|v\/|vm\.tiktok\.com\/)([\d\w_-]{5,30})/);
        if (match && match[1]) return match[1].split('?')[0];
        if (/^[\d\w_-]{10,30}$/.test(trimmed)) return trimmed;
        return null;
    }

    // 2. Fetch Available TikTok Task
    async function fetchTask() {
        try {
            const response = await fetch('/api/users/tasks/type/tiktok', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                const errorData = await response.json();
                if (elements.statusMsg) {
                    elements.statusMsg.innerHTML = `
                        <div class="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center">
                            <p class="text-rose-500 font-bold mb-2">Access denied</p>
                            <p class="text-[11px] text-gray-400 leading-relaxed">This is a demo session. To earn real rewards, please <a href="/admin/admin-management.html" class="text-emerald-500 underline font-bold">impersonate</a> a real user node.</p>
                        </div>`;
                }
                if (elements.startBtn) elements.startBtn.disabled = true;
                if (elements.claimBtn) elements.claimBtn.disabled = true;
                return;
            }

            const tasks = await response.json();

            if (tasks.length > 0) {
                currentTask = tasks[0];
                if (elements.taskTitle) elements.taskTitle.innerText = "Finish the video";
                if (elements.taskDescription) {
                    // Don't show sensitive links or mentions in instructions
                    elements.taskDescription.innerText = "Watch to the end to get your reward.";
                }
                if (elements.rewardText) elements.rewardText.innerText = `Earnings: KSh ${parseFloat(currentTask.reward).toLocaleString()}`;
                if (elements.timerDisplay) elements.timerDisplay.innerText = formatTime(currentTask.duration);
                
                // Initialize player and wait for it to define the button state
                const isValid = initTiktokPlayer(currentTask.video_link);
                if (elements.startBtn) {
                    elements.startBtn.disabled = !isValid;
                }
            } else {
                if (elements.statusMsg) {
                    elements.statusMsg.innerHTML = `
                        <div class="py-12 text-center">
                            <i class="bi bi-check2-circle text-4xl text-rose-500/20 mb-4 block"></i>
                            <p class="text-[11px] text-gray-500 font-bold">All done for today</p>
                            <p class="text-xs text-gray-400 mt-1">Check back later for more videos.</p>
                        </div>`;
                }
                if (elements.claimBtn) elements.claimBtn.disabled = true;
                if (elements.startBtn) elements.startBtn.disabled = true;
            }
        } catch (err) {
            console.error("Sync Error:", err);
            showGlassNotification("Checking connection...", 'info');
            setTimeout(fetchTask, 5000);
        }
    }

    // 2.1 TikTok Player Initializer
    function initTiktokPlayer(url) {
        const videoId = extractTiktokVideoId(url);
        if (!videoId) {
            console.error("Invalid TikTok URL:", url);
            if (elements.statusMsg) elements.statusMsg.innerText = "Could not load video. Skipping...";
            if (elements.claimBtn) elements.claimBtn.disabled = true;
            return false;
        }

        const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
        elements.videoFrameContainer.innerHTML = `
            <iframe
                src="${embedUrl}"
                width="100%"
                height="100%"
                frameborder="0"
                allowfullscreen
                scrolling="no"
                allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                onload="this.contentWindow.postMessage('play', '*')"
            ></iframe>
        `;

        elements.videoFrameContainer.querySelector('iframe').onload = () => {
            console.log("TikTok iframe loaded.");
        };
        return true;
    }

    // 2.2 Watch Now Trigger
    elements.startBtn?.addEventListener('click', async () => {
        if (elements.overlay) elements.overlay.classList.add('hidden');
        if (elements.countdownContainer) elements.countdownContainer.classList.remove('hidden');
        
        isTiktokVideoPlaying = true;
        updateTimerState();
        if (!isTimerInitialized && currentTask) {
            isTimerInitialized = true;
            startSecurityTimer(currentTask.duration);
        }
        
        if (elements.statusMsg) {
            elements.statusMsg.innerText = "If the video doesn't play automatically, please tap the play icon inside the frame above!";
        }
        
        try {
            await fetch('/api/users/tasks/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ taskId: currentTask.id })
            });
        } catch (err) { console.error("Ledger Sync Failure", err); }

        const iframe = elements.videoFrameContainer.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({ type: 'play' }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
        }
    });

    // 2.3 TikTok Playback State Listener (simplified to prevent CORS block from stopping timer)
    window.addEventListener('message', (event) => {
        // Handled directly via user click triggers and tab presence verification
    });

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 3. Security Timer Logic
    function startSecurityTimer(duration) {
        secondsLeft = duration;
        if (elements.claimBtn) elements.claimBtn.disabled = true;
        const isTabActive = !document.hidden && document.hasFocus();
        isPaused = !(isTabActive && isTiktokVideoPlaying);
        
        if (timerInterval) clearInterval(timerInterval);

        if (elements.timerDisplay) elements.timerDisplay.innerText = formatTime(secondsLeft);

        timerInterval = setInterval(() => {
            if (isPaused) return; // Skip logic cycle if engine is paused

            if (secondsLeft > 0) {
                secondsLeft--;
                elements.timerDisplay.innerText = formatTime(secondsLeft);
            }

            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
                elements.timerDisplay.innerText = "00:00";
                elements.claimBtn.disabled = false;
                elements.claimBtn.classList.add('bg-emerald-500', 'text-black');
                
                // Automate payout claim
                elements.claimBtn.click();
            }
        }, 1000);
    }

    // 4. Execute Payout Handshake
    elements.claimBtn.addEventListener('click', async () => {
        elements.claimBtn.disabled = true;
        elements.claimBtn.innerText = "Saving rewards...";

        try {
            const response = await fetch('/api/users/transactions/payout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ taskId: currentTask.id })
            });

            const result = await response.json();
            if (response.ok) {
                // Instant yield update for the TikTok sector wallet
                const tiktokWalletDisplay = document.getElementById('tiktokWalletBalance');
                if (tiktokWalletDisplay && result.newSectorBalance) {
                    tiktokWalletDisplay.innerText = `KSh ${parseFloat(result.newSectorBalance).toLocaleString()}`;
                    
                    // Trigger green pulse animation
                    tiktokWalletDisplay.classList.add('balance-increment-active');
                    setTimeout(() => tiktokWalletDisplay.classList.remove('balance-increment-active'), 2000);
                }

                alert(result.message);
                await syncBalance();
                location.reload(); // Load next task
            } else {
                alert(result.message);
            }
        } catch (err) {
            alert("Critical Handshake Failure.");
        }
    });

    // 4.1 Skip Task Trigger
    elements.skipBtn?.addEventListener('click', () => {
        if (confirm('Skip this task sequence? No reward nodes will be synchronized.')) {
            location.reload();
        }
    });

    // 5. Watch Time Validator: Enforce tab presence during verification
    const handleAutoPause = (pause, msg = "Paused") => {
        isPaused = pause;
        if (pause && secondsLeft > 0) {
            elements.timerDisplay.innerText = msg;
        } else if (!pause) {
            elements.timerDisplay.classList.remove('timer-paused-alert');
            if (secondsLeft > 0) elements.timerDisplay.innerText = formatTime(secondsLeft);
        }
    };

    const updateTimerState = () => {
        const isTabActive = !document.hidden && document.hasFocus();
        if (isTabActive && isTiktokVideoPlaying) {
            handleAutoPause(false);
        } else {
            handleAutoPause(true, "Paused");
        }
    };

    document.addEventListener('visibilitychange', updateTimerState);
    window.addEventListener('blur', updateTimerState);
    window.addEventListener('focus', updateTimerState);

    // 6. Online Status Handler
    function updateOnlineStatus() {
        const syncDot = document.getElementById('syncDot');
        const syncText = document.getElementById('syncText');
        if (!syncDot || !syncText) return;
        
        if (navigator.onLine) {
            syncDot.className = 'w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse';
            syncText.innerText = 'Online';
            syncText.className = 'text-[9px] font-black text-rose-500 uppercase tracking-widest';
        } else {
            syncDot.className = 'w-1.5 h-1.5 bg-gray-500 rounded-full';
            syncText.innerText = 'Offline';
            syncText.className = 'text-[9px] font-black text-gray-500 uppercase tracking-widest';
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    await syncBalance();
    await fetchTask();
});