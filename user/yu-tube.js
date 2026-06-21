// 0. Initialize YouTube API Registry
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let isTimerInitialized = false;
let apiReady = false;

// Signal API readiness
window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    console.log("[System] YouTube API ready.");
};

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
        videoFrame: document.getElementById('youtubePlayer'),
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
        progressFill: document.getElementById('progressFill'),
        taskList: document.getElementById('taskList')
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

    let currentTask = null;
    let secondsLeft = 0;
    let isPaused = false;
    let timerInterval = null;

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

        // Update specific YouTube Sector Yield (Wallet Balance)
        const ytStats = data.sectorEarnings.find(s => s.name === 'YouTube');
        const ytWalletDisplay = document.getElementById('youtubeWalletBalance');
        if (ytWalletDisplay && ytStats) {
            ytWalletDisplay.innerText = `KSh ${parseFloat(ytStats.amount).toLocaleString()}`;
            
            // Update Daily Progress Bar
            const completed = ytStats.completed || 0;
            const limit = ytStats.limit || 10;
            const percent = (completed / limit) * 100;
            
            if (elements.progressText) elements.progressText.innerText = `${completed} / ${limit}`;
            if (elements.progressFill) elements.progressFill.style.width = `${percent}%`;
        }
    }

    // 2. Fetch Available YouTube Task
    async function fetchTask() {
        try {
            const response = await fetch('/api/users/tasks/type/youtube', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                const errorData = await response.json();
                if (elements.statusMsg) {
                    elements.statusMsg.innerHTML = `
                        <div class="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] text-center">
                            <p class="text-emerald-500 font-bold mb-1 text-sm">Demo session</p>
                            <p class="text-[10px] text-gray-400 leading-relaxed mt-1">Please log in as a real user to earn rewards.</p>
                        </div>`;
                }
                if (elements.startBtn) elements.startBtn.disabled = true;
                if (elements.claimBtn) elements.claimBtn.disabled = true;
                return;
            }

            const tasks = await response.json();

            if (tasks.length > 0) {
                currentTask = tasks[0];
                if (elements.taskTitle) elements.taskTitle.innerText = currentTask.title;
                if (elements.taskDescription) {
                    const desc = (currentTask.description || 'Watch to get rewards.').replace(/(https?:\/\/[^\s]+)/g, '').replace(/@[a-zA-Z0-9._]+/g, '').trim();
                    elements.taskDescription.innerText = desc.charAt(0).toUpperCase() + desc.slice(1);
                }
                if (elements.rewardText) elements.rewardText.innerText = `KSh ${parseFloat(currentTask.reward).toLocaleString()} reward`;
                
                renderTaskList(tasks);
                selectTask(tasks[0]);
            } else {
                if (elements.statusMsg) {
                    elements.statusMsg.innerHTML = `
                        <div class="py-12 text-center">
                            <i class="bi bi-check2-circle text-4xl text-emerald-500/20 mb-3 block"></i>
                            <p class="text-[11px] text-gray-500 font-bold mb-1">No more videos</p>
                            <p class="text-[10px] text-gray-400 mt-1">You have finished all tasks for today.</p>
                        </div>`;
                }
                if (elements.claimBtn) elements.claimBtn.disabled = true;
                if (elements.startBtn) elements.startBtn.disabled = true;
            }
        } catch (err) {
            console.error("Sync Error:", err);
            showGlassNotification("Connection error. Retrying...", 'error');
            setTimeout(fetchTask, 5000);
        }
    }

    function renderTaskList(tasks) {
        if (!elements.taskList) return;
        elements.taskList.innerHTML = tasks.map((task, index) => `
            <button onclick="window.loadSpecificTask(${index})" class="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:bg-white/[0.08] hover:border-emerald-500/30 transition-all text-left group">
                <div class="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <i class="bi bi-play-circle-fill text-emerald-500 text-lg group-hover:scale-110 transition"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-white truncate">${task.title}</p>
                    <p class="text-[10px] text-gray-500 mt-0.5">KSh ${task.reward} reward</p>
                </div>
            </button>
        `).join('');

        window.currentTaskQueue = tasks;
        window.loadSpecificTask = (index) => {
            selectTask(window.currentTaskQueue[index]);
        };
    }

    function selectTask(task) {
        currentTask = task;
        if (elements.taskTitle) elements.taskTitle.innerText = currentTask.title;
        if (elements.taskDescription) {
            const desc = (currentTask.description || 'Watch to get rewards.').replace(/(https?:\/\/[^\s]+)/g, '').replace(/@[a-zA-Z0-9._]+/g, '').trim();
            elements.taskDescription.innerText = desc.charAt(0).toUpperCase() + desc.slice(1);
        }
        if (elements.rewardText) elements.rewardText.innerText = `KSh ${parseFloat(currentTask.reward).toLocaleString()} reward`;
        
        if (player && typeof player.destroy === 'function') {
            player.destroy();
        }
        
        if (elements.overlay) elements.overlay.classList.remove('hidden');
        if (elements.countdownContainer) elements.countdownContainer.classList.add('hidden');
        isTimerInitialized = false;
        if (timerInterval) clearInterval(timerInterval);
        
        initYoutubePlayer(currentTask.video_link);
    }

    // 2.1 YouTube Player Initializer
    function initYoutubePlayer(url) {
        // If API isn't ready, retry in 500ms
        if (!apiReady || typeof YT === 'undefined' || !YT.Player) {
            setTimeout(() => initYoutubePlayer(url), 300);
            return;
        }

        let videoId = '';
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
            } else if (urlObj.hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.split('/').pop();
            } else {
                // Fallback for direct IDs or embed links
                videoId = url.split('embed/')[1]?.split('?')[0] || url.split('v=')[1]?.split('&')[0] || url;
            }
        } catch (e) {
            videoId = url.split('v=')[1]?.split('&')[0] || url;
        }
        
        player = new YT.Player('youtubePlayer', {
            videoId: videoId,
            playerVars: { 'autoplay': 0, 'controls': 1, 'rel': 0, 'enablejsapi': 1 },
            events: {
                'onReady': () => {
                    // Only enable button when player is loaded and cued
                    if (elements.startBtn) elements.startBtn.disabled = false;
                },
                'onStateChange': (event) => {
                    updateTimerState();
                    if (event.data === 1 && !isTimerInitialized) {
                        isTimerInitialized = true;
                        startSecurityTimer(currentTask.duration);
                    }
                }
            }
        });
    }

    // 2.2 Watch Now Trigger
    elements.startBtn?.addEventListener('click', () => {
        if (elements.overlay) elements.overlay.classList.add('hidden');
        if (elements.countdownContainer) elements.countdownContainer.classList.remove('hidden');

        // 1. Play video immediately to preserve user activation context
        if (player && typeof player.playVideo === 'function') {
            player.playVideo();
        }
        
        // 2. Immediately start timer to satisfy "simultaneous" request
        if (!isTimerInitialized && currentTask) {
            isTimerInitialized = true;
            startSecurityTimer(currentTask.duration);
        }

        // 3. Sync Ledger (Background task - doesn't block UI playback)
        fetch('/api/users/tasks/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ taskId: currentTask.id })
        }).catch(err => console.error("Ledger Sync Failure", err));
    });

    // 3. Security Timer Logic
    function startSecurityTimer(duration) {
        secondsLeft = duration;
        if (elements.claimBtn) elements.claimBtn.disabled = true;
        
        const isTabActive = !document.hidden && document.hasFocus();
        const playing = player && typeof player.getPlayerState === 'function' && player.getPlayerState() === 1;
        isPaused = !(isTabActive && playing);
        
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            if (isPaused) return; // Skip logic cycle if engine is paused

            secondsLeft--;
            elements.timerDisplay.innerText = `Wait ${secondsLeft}s`;

            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
                elements.timerDisplay.innerText = "Claim reward";
                elements.claimBtn.disabled = false;
                elements.claimBtn.classList.add('bg-emerald-500', 'text-black');
            }
        }, 1000);
    }

    // 4. Execute Payout Handshake
    elements.claimBtn.addEventListener('click', async () => {
        elements.claimBtn.disabled = true;
        elements.claimBtn.innerText = "Saving...";

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
                // Instant yield update for the YouTube sector wallet
                const ytWalletDisplay = document.getElementById('youtubeWalletBalance');
                if (ytWalletDisplay && result.newSectorBalance) {
                    ytWalletDisplay.innerText = `KSh ${parseFloat(result.newSectorBalance).toLocaleString()}`;
                    
                    // Trigger green pulse animation
                    ytWalletDisplay.classList.add('balance-increment-active');
                    setTimeout(() => ytWalletDisplay.classList.remove('balance-increment-active'), 2000);
                }

                showGlassNotification(result.message, 'success');
                await syncBalance();
                location.reload(); // Load next task
            } else {
                showGlassNotification(result.message, 'error');
            }
        } catch (err) {
            showGlassNotification("Failed to save reward.", 'error');
        }
    });

    // 4.1 Skip Task Trigger
    elements.skipBtn?.addEventListener('click', () => {
        triggerGlassDecision('Skip video', 'Skip this video? You will not receive a reward.', () => {
            location.reload();
        });
    });

    // 5. Watch Time Validator: Enforce tab presence during verification
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulseRed {
            0%, 100% { color: #ff3333; opacity: 1; transform: scale(1); }
            50% { color: #f87171; opacity: 0.8; transform: scale(1.02); }
        }
        @keyframes pulseGreen {
            0%, 100% { color: #00ea87; transform: scale(1); }
            50% { color: #bbfce0; transform: scale(1.15); }
        }
        .balance-increment-active {
            animation: pulseGreen 0.5s ease-in-out 4 !important;
            text-shadow: 0 0 15px rgba(0, 234, 135, 0.6);
        }
        .timer-paused-alert {
            animation: pulseRed 1s infinite ease-in-out;
            text-shadow: 0 0 12px rgba(255, 51, 51, 0.4);
        }
        #youtubePlayer {
            width: calc(100% - 10px) !important;
            height: calc(100% - 10px) !important;
            border: 2px solid #10b981;
            border-radius: 1.25rem;
            margin: 5px auto;
            overflow: hidden;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
        }
    `;
    document.head.appendChild(style);

    const handleAutoPause = (pause, msg = "Paused") => {
        isPaused = pause;
        if (pause && secondsLeft > 0) {
            elements.timerDisplay.innerText = msg;
            elements.timerDisplay.classList.add('timer-paused-alert');
        } else {
            elements.timerDisplay.classList.remove('timer-paused-alert');
            if (secondsLeft > 0) elements.timerDisplay.innerText = `Wait ${secondsLeft}s`;
        }
    };

    const updateTimerState = () => {
        const isTabActive = !document.hidden && document.hasFocus();
        const playing = player && typeof player.getPlayerState === 'function' && player.getPlayerState() === 1;

        if (isTabActive && playing) {
            handleAutoPause(false);
        } else {
            let msg = "Paused";
            if (player && typeof player.getPlayerState === 'function' && player.getPlayerState() === 3) {
                msg = "Buffering... paused";
            }
            handleAutoPause(true, msg);
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
            syncDot.className = 'w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse';
            syncText.innerText = 'Online';
            syncText.className = 'text-[9px] font-medium text-emerald-500';
        } else {
            syncDot.className = 'w-1.5 h-1.5 bg-rose-500 rounded-full';
            syncText.innerText = 'Offline';
            syncText.className = 'text-[9px] font-medium text-rose-500';
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // 7. Logout Handler
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        triggerGlassDecision('Log out', 'Are you sure you want to log out of your session?', () => {
            localStorage.clear();
            window.location.href = '../index.html';
        });
    });

    await syncBalance();
    await fetchTask();
});