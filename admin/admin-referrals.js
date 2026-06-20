document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');

    const tableBody = document.getElementById('referralTableBody');

    async function fetchReferrals() {
        try {
            const res = await fetch('/api/users/admin/referrals', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const referrals = await res.json();
            
            tableBody.innerHTML = referrals.map(ref => `
                <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition">
                    <td class="px-8 py-4 text-gray-500 font-mono text-[10px]">${ref.referred_id}</td>
                    <td class="px-8 py-4">
                        <div class="flex flex-col">
                            <span class="text-white font-bold">${ref.referred_username}</span>
                            <span class="text-[9px] text-gray-500">${ref.referred_email}</span>
                        </div>
                    </td>
                    <td class="px-8 py-4">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ref.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}">
                            ${ref.status}
                        </span>
                    </td>
                    <td class="px-8 py-4 font-bold text-emerald-400">KSh ${parseFloat(ref.total_commission || 0).toLocaleString()}</td>
                    <td class="px-8 py-4 text-gray-500 text-[10px] font-mono">${new Date(ref.date).toLocaleString()}</td>
                    <td class="px-8 py-4">
                        <span class="text-emerald-400 font-bold">@${ref.referrer_username}</span>
                    </td>
                </tr>
            `).join('');
        } catch (err) { console.error("Referral Fetch Error", err); }
    }

    fetchReferrals();
});