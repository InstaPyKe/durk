let currentBalance = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    const elements = {
        username: document.getElementById('usernameDisplay'),
        welcome: document.getElementById('welcomeName'),
        balance: document.getElementById('totalBalance'),
        earnings: document.getElementById('totalEarnings'),
        withdrawn: document.getElementById('totalWithdrawn'),
        tasks: document.getElementById('pendingTasksCount'),
        refTotal: document.getElementById('totalReferrals'),
        refEarnings: document.getElementById('referralEarnings'),
        teamL1: document.getElementById('teamL1'),
        teamL2: document.getElementById('teamL2'),
        teamL3: document.getElementById('teamL3'),
        sectors: document.getElementById('earningsBreakdownContainer'),
        progressPercent: document.getElementById('progressPercent'),
        targetFraction: document.getElementById('targetFraction'),
        circularProgress: document.getElementById('circularProgress'),
        loading: document.getElementById('loadingSpinner')
    };

    try {
        const response = await fetch('/api/users/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Session Expired');
        const data = await response.json();

        // 1. Update Profile & Header
        currentBalance = parseFloat(data.totalBalance);
        elements.username.innerText = data.username;
        elements.welcome.innerText = data.username;
        elements.tasks.innerText = data.pendingTasks;

        // 2. Update Finance Stats
        elements.balance.innerText = `KSh ${data.totalBalance.toLocaleString()}`;
        elements.earnings.innerText = `KSh ${data.totalEarnings.toLocaleString()}`;
        elements.withdrawn.innerText = `KSh ${data.totalWithdrawn.toLocaleString()}`;

        // 3. Update Network
        elements.refTotal.innerText = data.referrals.total;
        elements.refEarnings.innerText = data.referrals.earnings.toFixed(2);
        elements.teamL1.innerText = data.referrals.team.l1;
        elements.teamL2.innerText = data.referrals.team.l2;
        elements.teamL3.innerText = data.referrals.team.l3;

        // 4. Update Sector Earnings
        elements.sectors.innerHTML = data.sectorEarnings.map(s => `
            <div class="space-y-2">
                <div class="flex items-center gap-2">
                    <i class="bi ${s.icon} text-${s.color}-500"></i>
                    <span class="text-[10px] text-gray-400 font-bold uppercase">${s.name}</span>
                </div>
                <div class="text-lg font-black text-white font-mono">KSh ${s.amount}</div>
            </div>
        `).join('');

        // 5. Update Progress
        elements.progressPercent.innerText = `${data.objective.percent}%`;
        elements.targetFraction.innerText = data.objective.fraction;
        const offset = 364.4 - (364.4 * data.objective.percent) / 100;
        elements.circularProgress.style.strokeDashoffset = offset;

        // 6. Initialize Chart
        initChart(data.chartData);

    } catch (err) {
        console.error(err);
        document.getElementById('sessionToast').style.display = 'flex';
    } finally {
        elements.loading.style.opacity = '0';
        setTimeout(() => elements.loading.style.display = 'none', 300);
    }
});

function initChart(chartData) {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Yield',
                data: chartData.values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: {
                    grid: { display: false },
                    ticks: { color: '#4b5563', font: { size: 10, family: 'monospace' } }
                }
            }
        }
    });
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '../index.html';
});

document.getElementById('withdrawBtn')?.addEventListener('click', (e) => {
    if (currentBalance < 600) {
        e.preventDefault();
        alert(`Access Denied: Your current balance is KSh ${currentBalance.toFixed(2)}. A minimum of 600 KSh is required to access the withdrawal module.`);
    }
});