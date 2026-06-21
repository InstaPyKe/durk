document.addEventListener('DOMContentLoaded', () => {
    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    function toggleSidebar() {
        if (sidebar && toggle && overlay) {
            sidebar.classList.toggle('-translate-x-full');
            toggle.classList.toggle('hamburger-active');
            overlay.classList.toggle('hidden');
        }
    }

    if (toggle) toggle.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // Load persistence data (username for header)
    const username = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
    
    // 1. Synchronize Node Identity and Balance
    async function syncBalance() {
        const res = await fetch('/api/users/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        const userDisplay = document.getElementById('usernameDisplay');
        const profileImg = document.getElementById('profileImage');

        if (userDisplay) userDisplay.innerText = data.username || username;
        if (profileImg) profileImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username || username}`;
    }

    // --- Referral Logic ---
    const referralCountDisplay = document.getElementById('referralCount');
    const totalReferralEarningsDisplay = document.getElementById('totalReferralEarnings');
    const l1EarningsDisplay = document.getElementById('l1Earnings');
    const l2EarningsDisplay = document.getElementById('l2Earnings');
    const l3EarningsDisplay = document.getElementById('l3Earnings');
    const referralLinkInput = document.getElementById('referralLinkInput');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const copyFeedback = document.getElementById('copyFeedback');

    async function loadReferralStats() {
        try {
            const response = await fetch('/api/users/referral-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = '../login.html';
                }
                throw new Error('Failed to fetch referral statistics');
            }

            const stats = await response.json();
            if (referralCountDisplay) referralCountDisplay.innerText = stats.referral_count;
            if (totalReferralEarningsDisplay) totalReferralEarningsDisplay.innerText = `KSh ${stats.referral_earnings.toFixed(2)}`;
            if (l1EarningsDisplay) l1EarningsDisplay.innerText = `KSh ${stats.l1_earnings.toFixed(2)}`;
            if (l2EarningsDisplay) l2EarningsDisplay.innerText = `KSh ${stats.l2_earnings.toFixed(2)}`;
            if (l3EarningsDisplay) l3EarningsDisplay.innerText = `KSh ${stats.l3_earnings.toFixed(2)}`;

            // Update dynamic percentage nodes
            if (document.getElementById('l1Pct')) document.getElementById('l1Pct').innerText = stats.l1_pct;
            if (document.getElementById('l2Pct')) document.getElementById('l2Pct').innerText = stats.l2_pct;
            if (document.getElementById('l3Pct')) document.getElementById('l3Pct').innerText = stats.l3_pct;

            // Render Downline Tables (Levels 1, 2, 3) for agent interaction
            renderLevelTable('l1TableBody', stats.team.l1);
            renderLevelTable('l2TableBody', stats.team.l2);
            renderLevelTable('l3TableBody', stats.team.l3);

            // Identify upstream referrer node
            const referrerInfo = document.getElementById('upstreamReferrer');
            if (referrerInfo && stats.my_referrer) {
                referrerInfo.innerHTML = `Linked to Referrer Node: <span class="text-emerald-400 font-black">@${stats.my_referrer}</span>`;
            }

            // Update Network Tier Badge based on L1 referral count
            const tierBadge = document.getElementById('networkTierBadge');
            if (tierBadge) {
                const isElite = stats.referral_count > 10;
                tierBadge.innerText = isElite ? 'Elite Node' : 'Standard Node';
                tierBadge.className = `ml-2 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                    isElite ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`;
                tierBadge.classList.remove('hidden');
            }

            // Use the functional referral link provided by backend
            if (referralLinkInput) referralLinkInput.value = stats.referral_link;

        } catch (err) {
            console.error('Referral Stats Load Error:', err);
            // alert('System Error: Unable to synchronize with referral matrix.');
        }
    }

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

    function triggerGlassDecision(title, text, onConfirm) {
        const modal = document.getElementById('glassDecisionModal');
        document.getElementById('decisionTitle').innerText = title;
        document.getElementById('decisionText').innerText = text;
        document.getElementById('decisionIcon').innerHTML = `<i class="bi bi-shield-lock text-xl"></i>`;
        
        modal.classList.remove('hidden');
        
        const cleanup = () => modal.classList.add('hidden');
        
        document.getElementById('decisionAbort').onclick = cleanup;
        document.getElementById('decisionConfirm').onclick = () => {
            cleanup();
            onConfirm();
        };
    }

    if (copyLinkBtn && referralLinkInput) {
        copyLinkBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(referralLinkInput.value);
                showGlassNotification('Referral link synchronized to clipboard cache.');
            } catch (err) {
                showGlassNotification('Clipboard synchronization failed.', 'error');
            }
        });
    }

    syncBalance();
    loadReferralStats();

    // Back to Top Logic
    const mainContent = document.getElementById('mainContent');
    const backToTopBtn = document.getElementById('backToTop');
    const scrollProgress = document.getElementById('scrollProgress');

    if (mainContent) {
        mainContent.addEventListener('scroll', () => {
            const scrollTop = mainContent.scrollTop;
            const scrollHeight = mainContent.scrollHeight - mainContent.clientHeight;
            const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
            if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;

            if (scrollTop > 500) {
                backToTopBtn?.classList.add('back-to-top-visible');
            } else {
                backToTopBtn?.classList.remove('back-to-top-visible');
            }
        });
    }

    backToTopBtn?.addEventListener('click', () => {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- Data Rendering Node for Referral Tables ---
    function renderLevelTable(elementId, users) {
        const tbody = document.getElementById(elementId);
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-gray-600 italic font-medium uppercase tracking-tighter">No nodes identified in this layer.</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr class="hover:bg-white/[0.02] transition-colors border-t border-gray-800/50 group">
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-xs tracking-tight group-hover:text-emerald-400 transition-colors">@${user.username}</span>
                        <span class="text-[8px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Agent Node</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <i class="bi bi-whatsapp text-emerald-500 text-[10px]"></i>
                        <span class="text-emerald-400/80 font-mono text-[11px] font-bold tracking-tighter group-hover:text-emerald-400 transition-colors">${user.phone}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <span class="px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${
                        user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:bg-rose-500/20'
                    }">${user.status === 'Active' ? 'Verified' : 'Pending'}</span>
                </td>
            </tr>
        `).join('');
    }

    // Logout handler
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        triggerGlassDecision('SECURITY LOGOUT', 'Terminate active session and purge authentication token?', () => {
            localStorage.clear();
            localStorage.setItem('waa_ads_logged_in', 'false');
            window.location.href = '../index.html';
        });
    });
});