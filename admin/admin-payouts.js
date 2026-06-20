document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    const payoutsTableBody = document.getElementById('payoutsTableBody');
    const pendingCount = document.getElementById('pendingCount');

    async function fetchPendingPayouts() {
        try {
            const response = await fetch('/api/users/admin/payouts/pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (!response.ok) {
                console.error("Admin Payouts API Error:", data);
                alert(data.message || 'Failed to fetch pending payouts. Re-authenticating.');
                localStorage.clear();
                window.location.href = '/admin/admin-login.html';
                return;
            }

            pendingCount.innerText = data.length;
            payoutsTableBody.innerHTML = data.map(payout => `
                <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition-all group">
                    <td class="px-8 py-4">${payout.id}</td>
                    <td class="px-8 py-4">${payout.username}</td>
                    <td class="px-8 py-4">KSh ${parseFloat(payout.amount).toLocaleString()}</td>
                    <td class="px-8 py-4">${payout.phone_number}</td>
                    <td class="px-8 py-4">${payout.wallet_type}</td>
                    <td class="px-8 py-4">${new Date(payout.created_at).toLocaleString()}</td>
                    <td class="px-8 py-4 text-right">
                        <button onclick="processPayout(${payout.id}, 'Completed')" class="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold transition">Approve</button>
                        <button onclick="processPayout(${payout.id}, 'Rejected')" class="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold transition">Reject</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Failed to fetch pending payouts:', err);
            alert('Failed to load payouts data. Please check server connection.');
        }
    }

    window.processPayout = async (payoutId, status) => {
        if (!confirm(`Are you sure you want to ${status.toLowerCase()} payout ID ${payoutId}?`)) return;
        try {
            const response = await fetch(`/api/users/admin/payouts/${payoutId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                fetchPendingPayouts(); // Refresh the list
            } else {
                alert(data.message || 'Failed to process payout.');
            }
        } catch (err) {
            console.error('Error processing payout:', err);
            alert('Network error or server unreachable.');
        }
    };

    fetchPendingPayouts();
    // Auto-refresh every 30 seconds
    setInterval(fetchPendingPayouts, 30000);
});