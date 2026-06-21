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
        overlay: document.getElementById('gameScreenOverlay'),
        startBtn: document.getElementById('startGameBtn'),
        grid: document.getElementById('puzzleGrid'),
        statusBadge: document.getElementById('gameStatusBadge'),
        scoreLabel: document.getElementById('gameScoreLabel'),
        progressBar: document.getElementById('gameProgressBar'),
        claimBtn: document.getElementById('claimGameRewardBtn'),
        username: document.getElementById('usernameDisplay'),
        profileImg: document.getElementById('profileImage'),
        taskList: document.getElementById('taskList')
    };

    let currentTaskId = null;
    let puzzleState = [1, 2, 3, 4, 5, 6, 7, 8, null];
    const winningState = [1, 2, 3, 4, 5, 6, 7, 8, null];

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

    // 1. Synchronize Profile Data
    async function syncProfile() {
        try {
            const res = await fetch('/api/users/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (elements.username) elements.username.innerText = data.username;
            if (elements.profileImg) elements.profileImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`;
            // Update Games Wallet Badge
            const gamesStats = data.sectorEarnings.find(s => s.name === 'Games');
            const gamesWalletDisplay = document.getElementById('gamesWalletBalance');
            if (gamesWalletDisplay && gamesStats) {
                gamesWalletDisplay.innerText = `Yield: KSh ${parseFloat(gamesStats.amount).toLocaleString()}`;
            }

            // Fetch available game task
            try {
                const gameRes = await fetch('/api/users/tasks/type/game', { headers: { 'Authorization': `Bearer ${token}` } });
                const tasks = await gameRes.json();
                if (tasks.length > 0) {
                    renderTaskList(tasks);
                    selectTask(tasks[0]);
                } else {
                    // This block is now essentially unreachable as the backend 
                    // provides a default System Game Node if empty.
                    elements.statusBadge.innerText = "Status: Initializing Free Play...";
                }
            } catch (taskErr) {
                // Fallback for demo or if API fails to find a task
                showGlassNotification("Failed to fetch game tasks. Local engine active.", "info");
                elements.startBtn.disabled = false; // Allow play but warning on payout
            }
        } catch (err) { showGlassNotification("Profile synchronization failed.", "error"); }
    }
    
    function renderTaskList(tasks) {
        if (!elements.taskList) return;
        elements.taskList.innerHTML = tasks.map((task, index) => `
            <button onclick="window.loadSpecificTask(${index})" class="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:bg-white/[0.08] hover:border-indigo-500/30 transition-all text-left group">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <i class="bi bi-controller text-indigo-500 text-lg group-hover:scale-110 transition"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-black text-white uppercase truncate tracking-tight">${task.title}</p>
                    <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Yield: KSh ${task.reward}</p>
                </div>
            </button>
        `).join('');

        window.currentTaskQueue = tasks;
        window.loadSpecificTask = (index) => {
            selectTask(window.currentTaskQueue[index]);
        };
    }

    function selectTask(task) {
        currentTaskId = task.id;
        elements.startBtn.disabled = false;
        elements.statusBadge.innerText = "Status: Awaiting Init";
        elements.statusBadge.classList.replace('text-emerald-400', 'text-indigo-400');
        elements.startBtn.innerHTML = `Start Game <span class="ml-2 text-[10px] opacity-60">(Reward: KSh ${task.reward})</span>`;
        
        // Reset engine state
        puzzleState = [1, 2, 3, 4, 5, 6, 7, 8, null];
        elements.grid.classList.add('hidden');
        elements.overlay.classList.remove('hidden');
        elements.claimBtn.disabled = true;
        elements.claimBtn.innerText = "Claim Reward";
        elements.claimBtn.className = "w-full py-4 bg-gray-800 text-gray-500 font-black rounded-xl text-xs transition uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed";
        renderGrid();
    }

    // --- Online Status Handler ---
    function updateOnlineStatus() {
        const syncDot = document.getElementById('syncDot');
        const syncText = document.getElementById('syncText');
        if (!syncDot || !syncText) return;
        
        if (navigator.onLine) {
            syncDot.className = 'w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse';
            syncText.innerText = 'Online';
        } else {
            syncDot.className = 'w-1.5 h-1.5 bg-rose-500 rounded-full';
            syncText.innerText = 'Offline';
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // --- Logout Logic ---
    function handleLogout() {
        triggerGlassDecision('SECURITY LOGOUT', 'Terminate active session and purge authentication token?', () => {
            localStorage.clear();
            localStorage.setItem('waa_ads_logged_in', 'false');
            window.location.href = '../index.html';
        });
    }
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('sidebarLogoutBtn')?.addEventListener('click', handleLogout);

    // --- Falling Rose Petals Animation Engine ---
    const petalCanvas = document.getElementById('petal-canvas');
    if (petalCanvas) {
        const pCtx = petalCanvas.getContext('2d');
        let petals = [];
        const petalCount = 35; 

        function resizePetalCanvas() {
            petalCanvas.width = window.innerWidth;
            petalCanvas.height = window.innerHeight;
        }
        resizePetalCanvas();
        window.addEventListener('resize', resizePetalCanvas);

        class Petal {
            constructor() {
                this.reset();
                this.y = Math.random() * petalCanvas.height; 
            }
            reset() {
                this.x = Math.random() * petalCanvas.width;
                this.y = -20;
                this.size = Math.random() * 8 + 4;
                this.weight = Math.random() * 0.5 + 0.3; 
                this.oscillation = Math.random() * Math.PI * 2;
                this.oscillationSpeed = Math.random() * 0.02 + 0.01;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = (Math.random() - 0.5) * 1.2;
                const roseColors = ['#fda4af', '#f43f5e', '#fb7185', '#e11d48'];
                this.color = roseColors[Math.floor(Math.random() * roseColors.length)];
            }
            update() {
                this.y += this.weight;
                this.x += Math.sin(this.oscillation) * 0.7; 
                this.oscillation += this.oscillationSpeed;
                this.rotation += this.rotationSpeed;
                if (this.y > petalCanvas.height + 20) this.reset();
            }
            draw() {
                pCtx.save();
                pCtx.translate(this.x, this.y);
                pCtx.rotate(this.rotation * Math.PI / 180);
                pCtx.fillStyle = this.color;
                pCtx.globalAlpha = 0.35; 
                pCtx.beginPath();
                pCtx.ellipse(0, 0, this.size, this.size / 1.6, 0, 0, 2 * Math.PI);
                pCtx.fill();
                pCtx.restore();
            }
        }

        for (let i = 0; i < petalCount; i++) petals.push(new Petal());

        function animatePetals() {
            pCtx.clearRect(0, 0, petalCanvas.width, petalCanvas.height);
            petals.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animatePetals);
        }
        animatePetals();
    }

    // 2. Puzzle Engine
    function renderGrid() {
        console.log("renderGrid called. Puzzle state:", puzzleState);
        elements.grid.innerHTML = '';
        puzzleState.forEach((val, idx) => {
            const tile = document.createElement('div');
            tile.className = `w-full h-full flex items-center justify-center text-xl font-black rounded-lg transition-all cursor-pointer ${
                val ? 'bg-indigo-500/20 border border-indigo-500/40 text-white hover:bg-indigo-500/40' : 'bg-transparent border-none pointer-events-none'
            }`;
            tile.innerText = val || '';
            if (val) tile.onclick = () => moveTile(idx);
            elements.grid.appendChild(tile);
        });
        updateProgress();
    }

    function moveTile(idx) {
        const emptyIdx = puzzleState.indexOf(null);
        const adjacent = [idx - 1, idx + 1, idx - 3, idx + 3];
        const isLeftEdge = idx % 3 === 0;
        const isRightEdge = idx % 3 === 2;

        const validMoves = adjacent.filter(i => {
            if (i < 0 || i > 8) return false;
            if (isLeftEdge && i === idx - 1) return false;
            if (isRightEdge && i === idx + 1) return false;
            return true;
        });

        if (validMoves.includes(emptyIdx)) {
            [puzzleState[idx], puzzleState[emptyIdx]] = [puzzleState[emptyIdx], puzzleState[idx]];
            renderGrid();
            checkWin();
        }
    }

    function shuffle() {
        // Guarantee solvability by making 100 valid random moves from the solved state
        for (let i = 0; i < 100; i++) {
            const emptyIdx = puzzleState.indexOf(null);
            const adjacent = [emptyIdx - 1, emptyIdx + 1, emptyIdx - 3, emptyIdx + 3];
            const isLeft = emptyIdx % 3 === 0;
            const isRight = emptyIdx % 3 === 2;
            const moves = adjacent.filter(idx => idx >= 0 && idx <= 8 && !(isLeft && idx === emptyIdx - 1) && !(isRight && idx === emptyIdx + 1));
            const move = moves[Math.floor(Math.random() * moves.length)];
            [puzzleState[emptyIdx], puzzleState[move]] = [puzzleState[move], puzzleState[emptyIdx]];
        }
        renderGrid();
    }

    function updateProgress() {
        let correct = 0;
        puzzleState.forEach((val, idx) => {
            if (val === winningState[idx] && val !== null) correct++;
        });
        elements.scoreLabel.innerText = `${correct} / 8 Nodes Aligned`;
        elements.progressBar.style.width = `${(correct / 8) * 100}%`;
    }

    function checkWin() {
        if (JSON.stringify(puzzleState) === JSON.stringify(winningState)) {
            elements.statusBadge.innerText = "Status: Verified";
            elements.statusBadge.classList.replace('text-indigo-400', 'text-emerald-400');
            elements.claimBtn.disabled = false;
            elements.claimBtn.classList.replace('bg-gray-800', 'bg-emerald-500');
            elements.claimBtn.classList.replace('text-gray-500', 'text-black');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
    }

    // 3. Handlers
    elements.startBtn.addEventListener('click', () => {
        elements.overlay.classList.add('hidden');
        elements.grid.classList.remove('hidden');
        elements.statusBadge.innerText = "Status: Online";
        shuffle();
    });

    elements.claimBtn.addEventListener('click', async () => {
        elements.claimBtn.disabled = true;
        elements.claimBtn.innerText = "Synchronizing...";

        try {
            if (!currentTaskId) {
                showGlassNotification("Cannot claim reward: No active game task found. Playing in local mode does not award payouts.", "error");
                elements.claimBtn.disabled = false;
                return;
            }
            const response = await fetch('/api/users/transactions/payout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ taskId: currentTaskId })
            });

            const result = await response.json();
            if (response.ok) {
                const gamesWalletDisplay = document.getElementById('gamesWalletBalance');
                if (gamesWalletDisplay && result.newSectorBalance) {
                    gamesWalletDisplay.innerText = `Yield: KSh ${parseFloat(result.newSectorBalance).toLocaleString()}`;
                    
                    // Apply green pulse animation
                    gamesWalletDisplay.classList.add('balance-increment-active');
                    setTimeout(() => gamesWalletDisplay.classList.remove('balance-increment-active'), 2000);
                }

                showGlassNotification(result.message, "success");
                location.reload();
            } else {
                showGlassNotification(result.message, "error");
                elements.claimBtn.disabled = false;
            }
        } catch (err) { showGlassNotification("Handshake Refused.", "error"); elements.claimBtn.disabled = false; }
    });
    
    // --- Online Status Handler ---
    function updateOnlineStatus() {
        const syncDot = document.getElementById('syncDot');
        const syncText = document.getElementById('syncText');
        if (!syncDot || !syncText) return;
        
        if (navigator.onLine) {
            syncDot.className = 'w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse';
            syncText.innerText = 'Online';
        } else {
            syncDot.className = 'w-1.5 h-1.5 bg-rose-500 rounded-full';
            syncText.innerText = 'Offline';
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // --- Logout Logic ---
    function handleLogout() {
        if (confirm('Terminate active session?')) {
            triggerGlassDecision('SECURITY LOGOUT', 'Terminate active session and purge authentication token?', () => {
                localStorage.clear();
                localStorage.setItem('waa_ads_logged_in', 'false');
                window.location.href = '../index.html';
            });
        }
    }
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('sidebarLogoutBtn')?.addEventListener('click', handleLogout);

    // --- Withdrawal access check ---
    document.getElementById('withdrawBtn')?.addEventListener('click', async (e) => {
        const dashRes = await fetch('/api/users/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
        const dashData = await dashRes.json();
        if (parseFloat(dashData.totalBalance) < 600) {
            e.preventDefault();
            showGlassNotification(`Access Denied: A minimum of 600 KSh is required to access the withdrawal module.`, "error");
        }
    });

    // --- Animation Styles ---
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulseGreen { 0%, 100% { color: #00ea87; transform: scale(1); } 50% { color: #bbfce0; transform: scale(1.15); } }
        .balance-increment-active { animation: pulseGreen 0.5s ease-in-out 4 !important; text-shadow: 0 0 15px rgba(0, 234, 135, 0.6); }
        .timer-paused-alert { animation: pulseRed 1s infinite ease-in-out; text-shadow: 0 0 12px rgba(255, 51, 51, 0.4); }
    `;
    document.head.appendChild(style);

    syncProfile();
});