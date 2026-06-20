document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const tableBody = document.getElementById('transactionTableBody');
    const searchInput = document.getElementById('transactionSearchInput');
    const statusFilter = document.getElementById('statusFilter');
    let allTransactions = [];

    async function fetchTransactions() {
        try {
            const res = await fetch('/api/users/admin/transactions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            allTransactions = await res.json();
            renderTransactions(allTransactions);
        } catch (err) { 
            console.error("Ledger Sync Failure", err); 
            if (window.showSystemMessage) window.showSystemMessage("Failed to sync financial ledger.", "error");
        }
    }

    function renderTransactions(logs) {
        if (logs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="px-8 py-20 text-center text-gray-600 italic tracking-widest uppercase text-[10px]">No transaction nodes found in this sector.</td></tr>`;
            return;
        }
        tableBody.innerHTML = logs.map(log => `
                <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition group">
                    <td class="px-8 py-4">
                        <i class="bi ${log.flow === 'earning' ? 'bi-arrow-down-left text-emerald-500' : 'bi-arrow-up-right text-rose-500'} mr-2"></i>
                        <span class="text-[9px] font-black uppercase tracking-widest">${log.flow}</span>
                    </td>
                    <td class="px-8 py-4 text-white font-bold">${log.username}</td>
                    <td class="px-8 py-4 font-mono text-sm ${log.flow === 'earning' ? 'text-emerald-400' : 'text-rose-400'}">
                        ${log.flow === 'earning' ? '+' : '-'} KSh ${parseFloat(log.amount).toLocaleString()}
                    </td>
                    <td class="px-8 py-4 text-gray-400 text-xs font-medium">${log.source}</td>
                    <td class="px-8 py-4">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest 
                            ${log.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' : 
                              log.status === 'Pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}">
                            ${log.status}
                        </span>
                    </td>
                    <td class="px-8 py-4 text-right text-gray-500 text-[10px] font-mono">
                        ${new Date(log.created_at).toLocaleString()}
                    </td>
                </tr>
            `).join('');
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedStatus = statusFilter.value;

        const filtered = allTransactions.filter(log => {
            const matchesSearch = 
                log.username.toLowerCase().includes(searchTerm) || 
                log.amount.toString().includes(searchTerm) ||
                (log.user_id && log.user_id.toString().includes(searchTerm));
            const matchesStatus = selectedStatus === 'all' || log.status === selectedStatus;
            return matchesSearch && matchesStatus;
        });
        renderTransactions(filtered);
    }

    searchInput?.addEventListener('input', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);

    fetchTransactions();
});