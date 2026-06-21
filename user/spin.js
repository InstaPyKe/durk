document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token && !localStorage.getItem('wa_ads_registered_user')) {
        window.location.href = '../login.html';
        return;
    }

    // --- Unified Status Modal Logic ---
    window.toggleStatusModal = (show, type = 'success', title = '', desc = '') => {
        const modal = document.getElementById('statusModal');
        const icon = document.getElementById('statusIcon');
        const titleEl = document.getElementById('statusTitle');
        const descEl = document.getElementById('statusDescription');

        if (show) {
            titleEl.innerText = title;
            descEl.innerText = desc;
            icon.className = `mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-${type === 'success' ? 'emerald' : 'rose'}-500/10 border border-${type === 'success' ? 'emerald' : 'rose'}-500/20 text-${type === 'success' ? 'emerald' : 'rose'}-500`;
            icon.innerHTML = type === 'success' ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
            modal.classList.remove('hidden');
            setTimeout(() => { modal.classList.replace('opacity-0', 'opacity-100'); modal.firstElementChild.classList.replace('scale-95', 'scale-100'); }, 10);
        } else {
            modal.classList.replace('opacity-100', 'opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
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

    // --- Element Selectors ---
    const spinBtn = document.getElementById('spinBtn');
    const claimBtn = document.getElementById('claimBtn');
    const wheel = document.getElementById('wheel'); // Now refers to the SVG element
    const statusMsg = document.getElementById('statusMsg'); // This is used for spin status, not header balance
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');

    // 0. Immediate Profile Initialization (Pre-sync)
    const cachedUser = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
    const usernameDisplay = document.getElementById('usernameDisplay');
    const profileImg = document.getElementById('profileImage');
    if (usernameDisplay) usernameDisplay.innerText = cachedUser;
    if (profileImg) profileImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cachedUser}`;

    // 1. Synchronize Local Balance and Quota (No Backend Connection)
    function syncBalance() {
        const username = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
        const stats = getLocalSpinStats();
        const totalClaimed = parseFloat(localStorage.getItem(`spin_total_${username}`)) || 0;

        // Update header profile
        if (usernameDisplay) usernameDisplay.innerText = username;
        if (profileImg) profileImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

        // Update main header node balance to reflect local accumulation
        const userBalanceHeader = document.getElementById('userBalance');
        if (userBalanceHeader) {
            userBalanceHeader.innerText = `KSh ${totalClaimed.toFixed(2)}`;
        }

        // Update spins sector yield display
        const spinWalletDisplay = document.getElementById('spinsWalletBalance');
        if (spinWalletDisplay) {
            spinWalletDisplay.innerText = `KSh ${totalClaimed.toFixed(2)}`;
        }

        // Daily Limit Tracking (3 spins per user per day)
        if (stats.count >= 3) {
            statusMsg.innerText = `Daily Limit Reached (${stats.count}/3). Access Reset in 24h.`;
            spinBtn.disabled = true;
            spinBtn.innerText = "LIMIT REACHED";
        } else {
            statusMsg.innerText = `Daily Quota: ${stats.count}/3 cycles completed.`;
            spinBtn.disabled = false;
            spinBtn.innerText = "Start";
        }
    }

    // --- Local Daily Tracking Logic ---
    const getLocalSpinStats = () => {
        const username = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
        const stats = JSON.parse(localStorage.getItem(`spin_stats_${username}`)) || { date: '', count: 0 };
        const today = new Date().toISOString().split('T')[0];
        
        if (stats.date !== today) {
            return { date: today, count: 0 };
        }
        return stats;
    };

    const updateLocalSpinStats = (count) => {
        const username = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`spin_stats_${username}`, JSON.stringify({ date: today, count }));
    };

    const updateLocalTotalClaimed = (amount) => {
        const username = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
        let total = parseFloat(localStorage.getItem(`spin_total_${username}`)) || 0;
        total += amount;
        localStorage.setItem(`spin_total_${username}`, total);
    };

    const getLocalSpinHistory = () => {
        const username = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
        return JSON.parse(localStorage.getItem(`spin_history_${username}`)) || [];
    };

    const addLocalSpinHistory = (amount) => {
        const username = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
        let history = getLocalSpinHistory();
        const entry = {
            amount: amount,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        history.unshift(entry);
        history = history.slice(0, 5); // Keep the last 5 results
        localStorage.setItem(`spin_history_${username}`, JSON.stringify(history));
        renderSpinHistory();
    };

    const renderSpinHistory = () => {
        const historyBody = document.getElementById('spinHistoryBody');
        if (!historyBody) return;
        const history = getLocalSpinHistory();
        
        if (history.length === 0) {
            historyBody.innerHTML = `<tr><td colspan="2" class="px-4 py-6 text-center text-gray-600 italic font-medium uppercase tracking-tighter">No cycles recorded in current session.</td></tr>`;
            return;
        }

        historyBody.innerHTML = history.map(h => `
            <tr class="hover:bg-white/[0.02] transition-colors">
                <td class="px-4 py-3 font-black text-emerald-400 font-mono">KSh ${h.amount.toFixed(2)}</td>
                <td class="px-4 py-3 text-right text-gray-500 font-bold uppercase tracking-widest">${h.timestamp}</td>
            </tr>
        `).join('');
    };

    // --- Audio Logic ---
    let audioCtx;
    const playBeep = (freq, duration, vol = 0.05) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    };

    const playTick = () => playBeep(600, 0.05, 0.02);
    const playSuccess = () => {
        playBeep(523.25, 0.2); setTimeout(() => playBeep(659.25, 0.2), 150); setTimeout(() => playBeep(783.99, 0.4), 300);
    };
    const playErrorBeep = () => playBeep(150, 0.4, 0.1);
    const initAudio = () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    };

    // --- Sidebar ---
    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        toggle?.classList.toggle('hamburger-active');
        overlay?.classList.toggle('hidden');
    }
    if (toggle) toggle.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // Logout handler
    const logoutHandler = () => triggerGlassDecision('SECURITY LOGOUT', 'Terminate active session and purge authentication token?', () => {
        localStorage.clear();
        localStorage.setItem('waa_ads_logged_in', 'false');
        window.location.href = '../index.html';
    });
    document.getElementById('logoutBtn')?.addEventListener('click', logoutHandler);
    document.getElementById('sidebarLogoutBtn')?.addEventListener('click', logoutHandler);

    // --- Spin Core Engine ---
    let currentRotation = 0, isSpinning = false, pendingReward = 0;
    const PRIZES = [10, 15, 20, 25, 30, 35, 40, 50];

    spinBtn?.addEventListener('click', () => {
        if (isSpinning) return;
        initAudio();
        console.log("Spin button clicked. Starting spin...");

        isSpinning = true;
        spinBtn.disabled = true;
        spinBtn.innerText = "ROTATING...";
        statusMsg.innerText = "Executing cycle...";

        const tickInterval = setInterval(playTick, 250);
        const targetIndex = Math.floor(Math.random() * PRIZES.length);
        pendingReward = PRIZES[targetIndex];

        const sectorAngle = 45;
        const offset = 22.5;
        const extraSpins = (5 + Math.floor(Math.random() * 5)) * 360;
        const landingRotation = -(targetIndex * sectorAngle + offset);
        
        currentRotation += extraSpins + (landingRotation - (currentRotation % 360));
        wheel.style.transform = `rotate(${currentRotation}deg)`;
        console.log("Wheel transform applied:", wheel.style.transform);

        setTimeout(() => {
            clearInterval(tickInterval);
            playSuccess();
            isSpinning = false;
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            
            statusMsg.innerText = `CONGRATULATIONS! You won KSh ${pendingReward.toFixed(2)}`;
            spinBtn.classList.add('hidden');
            claimBtn.classList.remove('hidden');
        }, 4000);
    });

    claimBtn?.addEventListener('click', () => {
        claimBtn.disabled = true;
        
        const stats = getLocalSpinStats();
        const newCount = stats.count + 1;
        updateLocalSpinStats(newCount);

        updateLocalTotalClaimed(pendingReward);
        addLocalSpinHistory(pendingReward);

        // Refresh balances immediately to reflect addition
        syncBalance();
        
        // Visual Pulse for confirming addition
        ['spinsWalletBalance', 'userBalance'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('balance-increment-active');
                void el.offsetWidth; // Trigger reflow to restart animation
                el.classList.add('balance-increment-active');
            }
        });

        toggleStatusModal(true, 'success', 'Reward Secured', `KSh ${pendingReward} has been added to your local session yield.`);
        
        setTimeout(() => {
            claimBtn.classList.add('hidden');
            spinBtn.classList.remove('hidden');
            spinBtn.innerText = "Spin Again";
            toggleStatusModal(false);
        }, 2000);
    });

    // --- Online Status ---
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

    // Style Injection for Animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulseGreen { 0%, 100% { color: #00ea87; transform: scale(1); } 50% { color: #bbfce0; transform: scale(1.15); } }
        .balance-increment-active { animation: pulseGreen 0.5s ease-in-out 4 !important; text-shadow: 0 0 15px rgba(0, 234, 135, 0.6); }
    `;
    document.head.appendChild(style);

    // --- Online Status ---
    updateOnlineStatus();

    syncBalance();
    renderSpinHistory();
});