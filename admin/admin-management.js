document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const tableBody = document.getElementById('userTableBody');
    const searchInput = document.getElementById('userSearchInput');
    let allUsers = [];

    async function fetchUsers() {
        try {
            const res = await fetch('/api/users/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
            allUsers = await res.json();
            renderUsers(allUsers);
        } catch (err) { console.error("User Fetch Error", err); }
    }

    function renderUsers(usersList) {
        tableBody.innerHTML = usersList.map(user => `
            <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition">
                <td class="px-8 py-5 text-gray-500 font-mono text-[10px]">${user.id}</td>
                <td class="px-8 py-5 cursor-pointer group" onclick='openUserDetail(${JSON.stringify(user).replace(/'/g, "&apos;")})'>
                    <div class="flex flex-col">
                        <span class="text-white font-bold tracking-tight">${user.username}</span>
                        <span class="text-[9px] text-gray-500 font-medium uppercase">${user.email}</span>
                        <span class="text-[9px] text-emerald-500/70 font-mono mt-0.5">${user.phone_number}</span>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <span class="w-fit px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}">
                        ${user.status === 'Active' ? 'Active Paid' : 'Inactive Unpaid'}
                    </span>
                </td>
                <td class="px-8 py-5 font-bold text-white">KSh ${parseFloat(user.balance || 0).toLocaleString()}</td>
                <td class="px-8 py-5 text-gray-500 font-medium">${new Date(user.created_at).toLocaleDateString()}</td>
                <td class="px-8 py-5 text-right space-x-2">
                    <button onclick="loginAsUser(${user.id})" title="Login as Agent" class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition"><i class="bi bi-box-arrow-in-right"></i></button>
                    <button onclick="toggleUserStatus(${user.id}, '${user.status}')" title="Toggle Activation" class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition"><i class="bi bi-shield-check"></i></button>
                    <button onclick="deleteUser(${user.id})" class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition"><i class="bi bi-trash3"></i></button>
                </td>
            </tr>
        `).join('');
    }

    searchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        renderUsers(allUsers.filter(u => 
            u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || u.id.toString().includes(term)
        ));
    });

    window.openUserDetail = (user) => {
        document.getElementById('detailAvatar').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
        document.getElementById('detailFullName').innerText = user.full_name || 'Anonymous Agent';
        document.getElementById('detailUsername').innerText = `@${user.username}`;
        document.getElementById('detailEmail').innerText = user.email;
        document.getElementById('detailPhone').innerText = user.phone_number;
        document.getElementById('detailBalance').innerText = `KSh ${parseFloat(user.balance).toLocaleString()}`;
        document.getElementById('detailJoined').innerText = new Date(user.created_at).toLocaleString();
        document.getElementById('detailBio').innerText = user.bio || "This agent hasn't provided a neural signature (bio).";
        
        const badge = document.getElementById('detailStatusBadge');
        badge.innerHTML = `<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}">${user.status === 'Active' ? 'Active Paid' : 'Inactive Unpaid'}</span>`;

        document.getElementById('detailLoginAsBtn').onclick = () => {
            loginAsUser(user.id);
        };

        document.getElementById('creditBtn').onclick = () => adjustBalance(user.id, 'credit');
        document.getElementById('debitBtn').onclick = () => adjustBalance(user.id, 'debit');
        
        document.getElementById('userDetailModal').style.display = 'flex';
    };

    window.closeDetailModal = () => {
        document.getElementById('userDetailModal').style.display = 'none';
    };

    async function adjustBalance(id, type) {
        const amount = document.getElementById('adjustAmount').value;
        if (!amount || amount <= 0) return alert("Please specify a valid amount.");
        
        if (!confirm(`Confirm ${type} of KSh ${amount} to this agent node?`)) return;

        try {
            const res = await fetch(`/api/users/admin/users/adjust-balance/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ amount, type })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                document.getElementById('adjustAmount').value = '';
                closeDetailModal();
                fetchUsers();
            } else alert(data.message);
        } catch (err) { alert("Adjustment sequence failed."); }
    }

    window.loginAsUser = async (id) => {
        if (!confirm("CRITICAL OVERRIDE: Switch to agent session? Your admin session will be terminated locally to prevent identity collision.")) return;
        
        try {
            const res = await fetch(`/api/users/admin/users/login-as/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (res.ok) {
                // Preserve administrative session for recall
                localStorage.setItem('admin_token', token);
                // Replace admin token with the user's troubleshooting token
                localStorage.setItem('token', data.token);
                localStorage.setItem('wa_ads_registered_user', data.username);
                window.location.href = '/user/dashboard.html';
            } else {
                alert(data.message);
            }
        } catch (err) { alert("Impersonation sequence failed."); }
    };

    window.approveAllUsers = async () => {
        const inactiveCount = allUsers.filter(u => u.status !== 'Active').length;
        if (inactiveCount === 0) return alert("No pending nodes found in buffer.");
        
        if (!confirm(`CRITICAL OVERRIDE: Deploy authorization for ${inactiveCount} agents?`)) return;
        
        try {
            const res = await fetch('/api/users/admin/users/approve-all', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchUsers();
            }
        } catch (err) { alert("Bulk approval transmission failed."); }
    };

    window.exportActiveUsersCSV = () => {
        const activeUsers = allUsers.filter(u => u.status === 'Active');
        if (activeUsers.length === 0) return alert("No active nodes found in current buffer to export.");

        // Define CSV Headers
        const headers = ["UID", "Username", "Email", "Phone", "Balance (KSh)", "Joined Date"];
        
        // Format Rows
        const rows = activeUsers.map(u => [
            u.id,
            `"${u.username}"`,
            `"${u.email}"`,
            `"${u.phone_number}"`,
            u.balance,
            `"${new Date(u.created_at).toLocaleDateString()}"`
        ]);

        const csvContent = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `active_agents_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
        } catch (err) { alert("Matrix Update Failed"); }
    };

    window.deleteUser = async (id) => {
        const executeDelete = async () => {
            try {
                const res = await fetch(`/api/users/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    if (window.showSystemMessage) window.showSystemMessage(data.message || "Agent successfully purged from matrix.", "success");
                    fetchUsers();
                } else {
                    if (window.showSystemMessage) window.showSystemMessage(data.message || "Purge sequence failed.", "error");
                }
            } catch (err) {
                if (window.showSystemMessage) window.showSystemMessage("Network breach during purge attempt.", "error");
            }
        };

        if (window.triggerGlassDecision) {
            window.triggerGlassDecision(
                'PURGE AGENT',
                `⚠️ SECURITY PROTOCOL: Permanently delete agent node #${id} from the database? This action cannot be reversed.`,
                executeDelete
            );
        } else if (confirm(`CRITICAL PROTOCOL: Purge agent node #${id}?`)) {
            executeDelete();
        }
    };

    fetchUsers();
});