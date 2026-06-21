document.addEventListener('DOMContentLoaded', async () => {
    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    
    const registeredUser = localStorage.getItem('wa_ads_registered_user') || 'Agent_Alpha';
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    const loadingSpinner = document.getElementById('loadingSpinner');
    
    // Setup Profile UI
    if (document.getElementById('welcomeName')) document.getElementById('welcomeName').innerText = registeredUser;
    if (document.getElementById('usernameDisplay')) document.getElementById('usernameDisplay').innerText = registeredUser;
    if (document.getElementById('profileImage')) document.getElementById('profileImage').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${registeredUser}`;

    let currentBalance = 0;

    if (loadingSpinner) loadingSpinner.style.display = 'none';

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        toggle?.classList.toggle('hamburger-active');
        overlay?.classList.toggle('hidden');
    }

    if (toggle) toggle.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);
    
    // Impersonation Recall Logic
    const adminToken = localStorage.getItem('admin_token');
    if (adminToken) {
        document.getElementById('impersonationBanner')?.classList.remove('hidden');
    }

    document.getElementById('returnToAdminBtn')?.addEventListener('click', () => {
        localStorage.setItem('token', adminToken);
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/admin-dashboard.html';
    });

    async function loadDashboardData() {
        try {
            const response = await fetch('/api/users/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Session Expired');
            const data = await response.json();

            // Update Metrics UI with Live Data
            currentBalance = parseFloat(data.totalBalance);
            document.getElementById('totalBalance').innerText = `KSh ${currentBalance.toLocaleString()}`;
            document.getElementById('totalEarnings').innerText = `KSh ${parseFloat(data.totalEarnings).toLocaleString()}`;
            document.getElementById('totalWithdrawn').innerText = `KSh ${parseFloat(data.totalWithdrawn).toLocaleString()}`;
            document.getElementById('pendingTasksCount').innerText = `${data.pendingTasks} tasks`;

            // Team Statistics
            document.getElementById('totalReferrals').innerText = data.referrals.total;
            document.getElementById('referralEarnings').innerText = data.referrals.earnings.toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById('teamL1').innerText = data.referrals.team.l1;
            document.getElementById('teamL2').innerText = data.referrals.team.l2;
            document.getElementById('teamL3').innerText = data.referrals.team.l3;

            // Referral Welcome Modal Protocol
            if (data.referrer) {
                const modal = document.getElementById('referralModal');
                const referrerSpan = document.getElementById('referrerDisplayName');
                const hasShown = sessionStorage.getItem('welcome_modal_shown');
                
                if (modal && referrerSpan && !hasShown) {
                    referrerSpan.innerText = `@${data.referrer}`;
                    modal.classList.remove('hidden');
                    setTimeout(() => { modal.classList.replace('opacity-0', 'opacity-100'); }, 100);
                    sessionStorage.setItem('welcome_modal_shown', 'true');
                }
            }

            // Weekly Objective Progress
            const percent = data.objective.percent;
            document.getElementById('weeklyObjectiveText').innerText = `Complete tasks to unlock the next level.`;
            document.getElementById('progressPercent').innerText = `${percent}%`;
            document.getElementById('targetFraction').innerText = data.objective.fraction;
            document.getElementById('progressLine').style.width = `${percent}%`;
            document.getElementById('circularProgress').style.strokeDashoffset = 364.4 - (percent / 100) * 364.4;

            // Analytic Chart Initialization
            initChart(data.chartData);

            // Earnings Breakdown Display
            const breakdownContainer = document.getElementById('earningsBreakdownContainer');
            if (breakdownContainer) {
                const sectorColors = {
                    'YouTube': 'text-emerald-500',
                    'Blogs': 'text-blue-500',
                    'Surveys': 'text-amber-500',
                    'TikTok': 'text-purple-500',
                    'Spins': 'text-indigo-500'
                };

                breakdownContainer.innerHTML = data.sectorEarnings.map(item => `
                    <div class="text-center md:text-left border-l md:border-l-0 md:border-r border-gray-800/50 last:border-0 pl-4 md:pl-0 md:pr-4">
                        <div class="text-[10px] font-medium text-gray-500 mb-0.5">${item.name} yield</div>
                        <div class="text-lg font-bold ${sectorColors[item.name] || 'text-white'} font-mono">KSh ${item.amount.toLocaleString()}</div>
                        ${item.limit ? `<div class="text-[10px] text-emerald-500 mt-0.5">${Math.max(0, item.limit - item.completed)} remaining</div>` : ''}
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Dashboard synchronization error:', err);
            triggerGlassDecision('Notice', 'Connection error. Please log in again to continue.', () => { window.location.href = '../login.html'; });
        } finally {
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
    }

    function initChart(chartData) {
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#6b7280', font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 10 } } }
                }
            }
        });
    }

    await loadDashboardData();

    // Auto-refresh timer: Sync dashboard telemetry every 5 minutes
    setInterval(async () => {
        await loadDashboardData();
    }, 300000);

    // Online Status Handler
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

    // Scroll Logic
    const mainContent = document.getElementById('mainContent');
    const backToTopBtn = document.getElementById('backToTop');
    const scrollProgress = document.getElementById('scrollProgress');

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

    // Modals and Logout
    document.getElementById('closeReferralModal')?.addEventListener('click', () => {
        const modal = document.getElementById('referralModal');
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if(confirm('Are you sure you want to log out?')) {
            localStorage.clear();
            localStorage.setItem('waa_ads_logged_in', 'false');
            window.location.href = '../index.html';
        }
    });

    document.getElementById('withdrawBtn')?.addEventListener('click', (e) => {
        if (currentBalance < 600) {
            e.preventDefault();
            alert(`Your balance is KSh ${currentBalance.toLocaleString()}. You need at least KSh 600 to withdraw.`);
        }
    });

    // Falling Rose Petals Animation Engine
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

});