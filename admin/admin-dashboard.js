document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '/admin/admin-login.html';

    const stats = {
        users: document.getElementById('statTotalUsers'),
        profits: document.getElementById('statProfits'),
        liabilities: document.getElementById('statLiabilities'),
        balances: document.getElementById('statUserBalances'),
        table: document.getElementById('userTableBody')
    };

    let allUsers = [];

    // 1. Initialize Analytics Charts
    const initCharts = (userGrowthData, financialData, referralCounts) => {
        new Chart(document.getElementById('userGrowthChart'), {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'New Agents',
                    data: [12, 19, 3, 5],
                    borderColor: userGrowthData.borderColor || '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                }
            }
        });

        new Chart(document.getElementById('referralDistributionChart'), {
            type: 'pie',
            data: {
                labels: ['Level 1', 'Level 2', 'Level 3'],
                datasets: [{
                    data: [referralCounts.l1, referralCounts.l2, referralCounts.l3],
                    backgroundColor: ['#10b981', '#3b82f6', '#6366f1'],
                    borderColor: 'rgba(22, 27, 34, 0.7)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af', font: { size: 10, weight: 'bold' }, padding: 20 }
                    }
                }
            }
        });

        new Chart(document.getElementById('financialChart'), {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr'],
                datasets: financialData.datasets || [
                    { label: 'Profits', data: [5000, 8000, 4500, 9000], backgroundColor: '#10b981' }, // Fallback
                    { label: 'Liabilities', data: [2000, 3000, 1500, 4000], backgroundColor: '#ef4444' } // Fallback
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    };

    // 2. Fetch Dashboard Stats
    async function fetchStats() {
        try {
            const res = await fetch('/api/users/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) {
                stats.users.innerText = data.totalUsers;
                stats.profits.innerText = `KSh ${parseFloat(data.totalProfits).toLocaleString()}`;
                stats.liabilities.innerText = `KSh ${parseFloat(data.totalLiabilities).toLocaleString()}`;
                stats.balances.innerText = `KSh ${parseFloat(data.totalUserBalances).toLocaleString()}`;
                
                // Populate Referral Metrics
                document.getElementById('statL1Count').innerText = data.referralCounts.l1;
                document.getElementById('statL1Earnings').innerText = `KSh ${data.referralCommissions.l1.toLocaleString()}`;
                document.getElementById('statL2Count').innerText = data.referralCounts.l2;
                document.getElementById('statL2Earnings').innerText = `KSh ${data.referralCommissions.l2.toLocaleString()}`;
                document.getElementById('statL3Count').innerText = data.referralCounts.l3;
                document.getElementById('statL3Earnings').innerText = `KSh ${data.referralCommissions.l3.toLocaleString()}`;

                initCharts(data.userGrowthChartData || {}, data.financialChartData || {}, data.referralCounts);
            }
        } catch (err) { console.error("Stats Fetch Error", err); }
    }

    // 3. User Matrix Logic
    async function fetchUsers() {
        try {
            const res = await fetch('/api/users/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
            allUsers = await res.json();
            renderUsers();
        } catch (err) { console.error("User Fetch Error", err); }
    }

    function renderUsers() {
        if (!stats.table) return;
        stats.table.innerHTML = allUsers.map(user => `
            <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition">
                <td class="px-8 py-4">
                    <div class="flex flex-col">
                        <span class="text-white font-bold tracking-tight">${user.username}</span>
                        <span class="text-[9px] text-gray-500 uppercase">${user.email}</span>
                    </div>
                </td>
                <td class="px-8 py-4 text-gray-400 font-mono text-[10px]">${user.phone_number}</td>
                <td class="px-8 py-4">
                    <span class="w-fit px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}">
                        ${user.status === 'Active' ? 'Active Paid' : 'Inactive Unpaid'}
                    </span>
                </td>
                <td class="px-8 py-4 font-bold text-white">KSh ${parseFloat(user.balance || 0).toLocaleString()}</td>
                <td class="px-8 py-4 text-right">
                    <button onclick="toggleUserStatus(${user.id}, '${user.status}')" class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition ${user.status === 'Active' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black'}">
                        ${user.status === 'Active' ? 'Deactivate' : 'Approve'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    window.toggleUserStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        const newPaymentStatus = newStatus === 'Active' ? 'Paid' : 'Pending';
        
        try {
            await fetch(`/api/users/admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus, payment_status: newPaymentStatus })
            });
            fetchUsers();
        } catch (err) { console.error("Status Toggle Failed", err); }
    };

    async function fetchActivities() {
        const log = document.getElementById('activityLog');
        try {
            const res = await fetch('/api/users/admin/activities', { headers: { 'Authorization': `Bearer ${token}` } });
            const activities = await res.json();
            
            const icons = {
                registration: 'bi-person-plus text-emerald-500',
                withdrawal: 'bi-cash-stack text-amber-500',
                earning: 'bi-lightning-charge text-indigo-500'
            };

            log.innerHTML = activities.map(act => `
                <div class="flex gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 transition hover:bg-white/[0.08]">
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <i class="bi ${icons[act.type] || 'bi-info-circle text-gray-400'}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] text-white font-bold truncate">${act.actor}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5 line-clamp-1">${act.description}</p>
                        <p class="text-[9px] text-gray-600 font-mono mt-1 uppercase">${new Date(act.timestamp).toLocaleTimeString()}</p>
                    </div>
                </div>
            `).join('');
        } catch (err) { console.error("Activity Fetch Error", err); }
    }

    // Initialize
    fetchStats();
    fetchUsers();
    fetchActivities();
    
    // Auto-refresh stats every 60 seconds
    setInterval(() => {
        fetchStats();
        fetchUsers();
        fetchActivities();
    }, 60000);
});