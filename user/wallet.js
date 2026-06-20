document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../login.html';
        return;
    }

    // --- Element Selectors ---
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    const mainContent = document.getElementById('mainContent');
    const backToTopBtn = document.getElementById('backToTop');
    const scrollProgress = document.getElementById('scrollProgress');

    const usernameDisplay = document.getElementById('usernameDisplay');
    const profileImage = document.getElementById('profileImage');
    const totalBalanceDisplay = document.getElementById('totalBalanceDisplay'); // Main balance card
    const totalEarningsDisplay = document.getElementById('totalEarningsDisplay');
    const referralEarningsDisplay = document.getElementById('referralEarningsDisplay');
    const totalWithdrawnDisplay = document.getElementById('totalWithdrawnDisplay');
    const walletTypeSelect = document.getElementById('walletType');
    const withdrawalHistoryTableBody = document.getElementById('withdrawalHistoryTableBody');
    const withdrawalForm = document.getElementById('withdrawalForm');
    const payoutPhoneInput = document.getElementById('payoutPhone');
    const payoutAmountInput = document.getElementById('payoutAmount');
    const withdrawSubmitBtn = document.getElementById('withdrawSubmitBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const validationErrorMessage = document.getElementById('validationErrorMessage');
    const errorText = document.getElementById('errorText');
    const successModal = document.getElementById('successModal');
    const availableBalanceDisplay = document.getElementById('availableBalanceDisplay');
    const statusTitle = document.getElementById('statusTitle');
    const statusDescription = document.getElementById('statusDescription');
    const statusIcon = document.getElementById('statusIcon');

    // --- Sidebar Toggle Logic ---
    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        toggle?.classList.toggle('hamburger-active');
        overlay?.classList.toggle('hidden');
    }
    if (toggle) toggle.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // --- Update Available Balance Display ---
    function updateAvailableDisplay() {
        const type = walletTypeSelect.value;
        const balance = type === 'Main Balance' ? currentBalance : (sectorBalances[type] || 0);
        if (availableBalanceDisplay) {
            availableBalanceDisplay.innerText = `Available: KSh ${parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }
    walletTypeSelect?.addEventListener('change', updateAvailableDisplay);

    // --- Auto-format Phone Number (07XXXXXXXX) ---
    payoutPhoneInput?.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Keep only digits
        if (value.length > 10) value = value.slice(0, 10); // Limit to 10 digits
        e.target.value = value;
    });

    // --- Back to Top Logic ---
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

    // --- Unified Status Modal Logic ---
    window.toggleModal = (show, type = 'success', title = '', desc = '') => {
        if (show) {
            statusTitle.innerText = title;
            statusDescription.innerText = desc;
            statusIcon.className = `mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-all duration-500 bg-${type === 'success' ? 'emerald' : 'rose'}-500/10 border border-${type === 'success' ? 'emerald' : 'rose'}-500/20 text-${type === 'success' ? 'emerald' : 'rose'}-500`;
            statusIcon.innerHTML = type === 'success' ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
            successModal.classList.remove('hidden');
            setTimeout(() => { successModal.classList.replace('opacity-0', 'opacity-100'); }, 10);
        } else {
            successModal.classList.replace('opacity-100', 'opacity-0');
            setTimeout(() => successModal.classList.add('hidden'), 300);
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
                <span class="text-[8px] font-medium text-white/40 mb-0">Notice</span>
                <p class="text-[10px] text-emerald-100/90 leading-tight mt-0.5">${message}</p>
            </div>
        `;

        container.appendChild(node);
        setTimeout(() => {
            node.style.opacity = '0';
            node.style.transform = 'translateX(20px)';
            setTimeout(() => node.remove(), 400);
        }, 4000);
    }

    // --- Fetch Wallet Data ---
    let currentBalance = 0;
    let sectorBalances = {};
    async function fetchWalletData() {
        try {
            const response = await fetch('/api/users/wallet', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch wallet data.');
            const data = await response.json();

            // Update header profile
            if (usernameDisplay) usernameDisplay.innerText = data.username || 'Agent_Alpha';
            if (profileImage) profileImage.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username || 'Agent_Alpha'}`;

            // Update balance displays
            currentBalance = parseFloat(data.totalBalance);
            sectorBalances = data.sectorBalances || {};
            
            updateAvailableDisplay();
            if (totalBalanceDisplay) totalBalanceDisplay.innerText = `KSh ${currentBalance.toLocaleString()}`;
            if (totalEarningsDisplay) totalEarningsDisplay.innerText = `KSh ${parseFloat(data.totalEarnings).toLocaleString()}`;
            if (referralEarningsDisplay) referralEarningsDisplay.innerText = `KSh ${parseFloat(data.referralEarnings).toLocaleString()}`;
            if (totalWithdrawnDisplay) totalWithdrawnDisplay.innerText = `KSh ${parseFloat(data.totalWithdrawn).toLocaleString()}`;

            // Populate withdrawal history
            if (withdrawalHistoryTableBody) {
                if (data.withdrawalHistory.length === 0) {
                    withdrawalHistoryTableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-10 text-center text-gray-500 italic">No withdrawal records found.</td></tr>`;
                } else {
                    withdrawalHistoryTableBody.innerHTML = data.withdrawalHistory.map(record => `
                        <tr class="hover:bg-gray-800/20 transition">
                            <td class="px-6 py-4 whitespace-nowrap text-gray-300 font-mono">${record.id}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-emerald-400 font-mono">KSh ${parseFloat(record.amount).toLocaleString()}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
                                    ${record.status}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">${new Date(record.created_at).toLocaleString()}</td>
                        </tr>
                    `).join('');
                }
            }

        } catch (err) {
            console.error('Wallet data synchronization error:', err);
            // Optionally show a toast or alert for session expired
        }
    }

    // --- Handle Withdrawal Form Submission ---
    withdrawalForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const amount = parseFloat(payoutAmountInput.value);
        const phone_number = payoutPhoneInput.value.trim();
        const wallet_type = walletTypeSelect.value;

        // Enforce category-specific minimums
        const minWithdrawal = wallet_type === 'Main Balance' ? 600 : 900;
        const categoryBalance = wallet_type === 'Main Balance' ? currentBalance : (sectorBalances[wallet_type] || 0);

        // Basic client-side validation
        if (isNaN(amount) || amount <= 0) {
            errorText.innerText = 'Enter a valid amount.';
            validationErrorMessage.classList.remove('hidden');
            return;
        }
        if (amount < minWithdrawal) {
            errorText.innerText = `You need at least KSh ${minWithdrawal} to withdraw from this wallet.`;
            validationErrorMessage.classList.remove('hidden');
            return;
        }
        if (amount > categoryBalance) {
            errorText.innerText = `Insufficient funds. You only have KSh ${parseFloat(categoryBalance).toLocaleString()} available.`;
            validationErrorMessage.classList.remove('hidden');
            return;
        }
        if (!phone_number || !/^07\d{8}$/.test(phone_number)) {
            errorText.innerText = 'Phone number must start with 07 and be 10 digits.';
            validationErrorMessage.classList.remove('hidden');
            return;
        }
        validationErrorMessage.classList.add('hidden');

        // Show loading state
        withdrawSubmitBtn.disabled = true;
        withdrawSubmitBtn.querySelector('span').innerText = 'Processing...';
        withdrawSubmitBtn.querySelector('svg:first-of-type').classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
        try {
            const response = await fetch('/api/users/withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount, phone_number, wallet_type })
            });

            const result = await response.json();

            if (response.ok) {
                showGlassNotification(result.message, 'success');
                withdrawalForm.reset();
                fetchWalletData(); // Refresh data after successful withdrawal
            } else {
                toggleModal(true, 'error', 'Transmission Failed', result.message);
            }
        } catch (err) {
            toggleModal(true, 'error', 'Network Error', 'Failed to connect to withdrawal gateway.');
        }
        finally {
            withdrawSubmitBtn.disabled = false;
            withdrawSubmitBtn.querySelector('span').innerText = 'Withdraw';
            withdrawSubmitBtn.querySelector('svg:first-of-type').classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
        }
    });

    // Initial data load
    await fetchWalletData();
});