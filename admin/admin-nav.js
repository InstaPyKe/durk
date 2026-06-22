// Injected global responsive styling context
(function() {
    const styleNode = document.createElement('style');
    styleNode.textContent = `
        /* Fluid spacing and scale adjustments for admin templates */
        @media (max-width: 640px) {
            main {
                padding: 1rem !important;
            }
            .p-6, .p-8 {
                padding: 1rem !important;
            }
            /* Flex layouts stack vertically on mobile */
            main .flex.justify-between.items-end,
            main .flex.justify-between.items-center,
            main .flex.justify-between {
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 0.75rem !important;
            }
            main .flex.items-center.gap-4,
            main .flex.items-center.gap-3 {
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 0.5rem !important;
            }
            /* Ensure input boxes and buttons stretch full width */
            main .flex.items-center.gap-4 > *,
            main .flex.items-center.gap-3 > *,
            main .flex.items-center.gap-4 input,
            main .flex.items-center.gap-3 input,
            main .flex.items-center.gap-4 button,
            main .flex.items-center.gap-3 button {
                width: 100% !important;
                text-align: center !important;
            }
        }
        @media (max-width: 480px) {
            .logout-text {
                display: none !important;
            }
            .logout-icon {
                display: inline-block !important;
            }
            /* Scale font-sizes dynamically for smaller screens */
            .text-4xl { font-size: 1.75rem !important; line-height: 2rem !important; }
            .text-3xl { font-size: 1.5rem !important; line-height: 1.75rem !important; }
            .text-2xl { font-size: 1.25rem !important; line-height: 1.5rem !important; }
            .text-xl { font-size: 1.1rem !important; }
            .text-sm { font-size: 0.75rem !important; }
            .text-xs { font-size: 0.7rem !important; }
        }
        @media (max-width: 320px) {
            body {
                font-size: 11px !important;
            }
            main {
                padding: 0.5rem !important;
            }
            admin-header, header, .h-16 {
                height: auto !important;
                padding-top: 0.5rem !important;
                padding-bottom: 0.5rem !important;
                padding-left: 0.5rem !important;
                padding-right: 0.5rem !important;
                flex-wrap: wrap !important;
                gap: 0.5rem !important;
            }
            .grid {
                grid-template-columns: 1fr !important;
                gap: 0.5rem !important;
            }
            .p-6, .p-8 {
                padding: 0.75rem !important;
            }
            h2, .text-3xl {
                font-size: 1.25rem !important;
            }
            h3, .text-xl {
                font-size: 0.875rem !important;
            }
            th, td {
                padding: 0.5rem !important;
                font-size: 9px !important;
            }
            input, select, textarea {
                padding-top: 0.5rem !important;
                padding-bottom: 0.5rem !important;
                padding-left: 2rem !important;
                padding-right: 0.5rem !important;
                font-size: 10px !important;
            }
            .input-wrapper i, .relative i {
                left: 0.5rem !important;
            }
            button, .btn {
                padding: 0.5rem 0.75rem !important;
                font-size: 9px !important;
            }
            .glass-panel.w-full.max-w-lg,
            .glass-panel.w-full.max-w-2xl {
                max-width: 100% !important;
                margin: 0.5rem !important;
                padding: 1rem !important;
                border-radius: 1.5rem !important;
            }
            /* Table responsiveness fix: Force parent container scrollable */
            .glass-panel:has(table) {
                overflow-x: auto !important;
                max-width: 100% !important;
            }
            admin-sidebar {
                width: 85vw !important;
                max-width: 220px !important;
            }
        }
        @media (max-width: 250px) {
            .admin-header-logo {
                display: none !important;
            }
            /* Micro screen text scale */
            body {
                font-size: 10px !important;
            }
            .text-4xl { font-size: 1.25rem !important; }
            .text-3xl { font-size: 1.1rem !important; }
            .text-2xl { font-size: 1rem !important; }
        }

        /* --- Toast Notifications animations & overrides --- */
        @keyframes toastSlideIn {
            from { transform: translateX(120%) scale(0.9); opacity: 0; }
            to { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes toastSlideOut {
            from { transform: translateX(0) scale(1); opacity: 1; }
            to { transform: translateX(120%) scale(0.9); opacity: 0; }
        }
        .toast-card {
            animation: toastSlideIn 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards;
            background: rgba(17, 24, 39, 0.9) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            position: relative;
            overflow: hidden;
        }
        .toast-card.fade-out {
            animation: toastSlideOut 0.3s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
        .toast-progress-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            width: 100%;
            transition: width 0.05s linear;
        }
    `;
    document.head.appendChild(styleNode);

    // Dynamic Notification Container Initializer
    function setupContainer() {
        let container = document.getElementById('adminNotificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'adminNotificationContainer';
            container.className = 'fixed bottom-8 right-8 z-[10000] flex flex-col gap-3 max-w-sm w-[calc(100%-4rem)] pointer-events-none';
            document.body.appendChild(container);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupContainer);
    } else {
        setupContainer();
    }

    // Modern Stackable Toast Generator
    const customShowMessage = function(message, type = 'success') {
        setupContainer();
        const container = document.getElementById('adminNotificationContainer');
        if (!container) return;

        // Limit active alerts to prevent screen cluttering (max 5)
        while (container.children.length >= 5) {
            container.children[0].remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast-card flex gap-3 p-4 rounded-2xl border pointer-events-auto transition-all duration-300 hover:translate-y-[-2px]';

        const types = {
            success: {
                title: 'Sync Success',
                icon: 'bi-shield-check',
                colorClass: 'text-emerald-400',
                borderClass: 'border-emerald-500/20 shadow-[0_4px_25px_rgba(10,185,129,0.18)]',
                iconBgClass: 'bg-emerald-500/10 border-emerald-500/30',
                progressBg: 'bg-emerald-500'
            },
            error: {
                title: 'System Fault',
                icon: 'bi-exclamation-octagon',
                colorClass: 'text-rose-400',
                borderClass: 'border-rose-500/20 shadow-[0_4px_25px_rgba(244,63,94,0.18)]',
                iconBgClass: 'bg-rose-500/10 border-rose-500/30',
                progressBg: 'bg-rose-500'
            },
            warning: {
                title: 'Warning Alert',
                icon: 'bi-exclamation-triangle',
                colorClass: 'text-amber-400',
                borderClass: 'border-amber-500/20 shadow-[0_4px_25px_rgba(245,158,11,0.18)]',
                iconBgClass: 'bg-amber-500/10 border-amber-500/30',
                progressBg: 'bg-amber-500'
            },
            info: {
                title: 'Portal Sync',
                icon: 'bi-info-circle',
                colorClass: 'text-blue-400',
                borderClass: 'border-blue-500/20 shadow-[0_4px_25px_rgba(59,130,246,0.18)]',
                iconBgClass: 'bg-blue-500/10 border-blue-500/30',
                progressBg: 'bg-blue-500'
            }
        };

        const config = types[type] || types.success;
        toast.classList.add(...config.borderClass.split(' '));

        // Layout includes action clipboard copy button for errors/logs
        toast.innerHTML = `
            <div class="toast-icon-container flex items-center justify-center shrink-0 w-8 h-8 rounded-lg border ${config.iconBgClass}">
                <i class="bi ${config.icon} ${config.colorClass} text-base"></i>
            </div>
            <div class="flex-1 flex flex-col justify-center min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <span class="toast-title text-[9px] font-black uppercase tracking-widest ${config.colorClass}">${config.title}</span>
                    <button class="toast-copy text-[8px] text-gray-500 hover:text-white font-bold uppercase tracking-wider transition-colors flex items-center gap-1" title="Copy Message">
                        <i class="bi bi-copy"></i> Copy
                    </button>
                </div>
                <p class="toast-desc text-[11px] leading-snug mt-0.5 break-words font-medium text-gray-300">${message}</p>
            </div>
            <button class="toast-close text-gray-500 hover:text-white transition-colors h-fit self-center pl-2">
                <i class="bi bi-x-lg text-[10px]"></i>
            </button>
            <div class="toast-progress-bar ${config.progressBg}"></div>
        `;

        container.appendChild(toast);

        const dismiss = () => {
            if (toast.classList.contains('fade-out')) return;
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.toast-close').addEventListener('click', dismiss);

        // Copy button capability
        toast.querySelector('.toast-copy').addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(message);
            // Flash a quick notice
            const cText = toast.querySelector('.toast-copy');
            cText.innerHTML = '<i class="bi bi-check2"></i> Copied';
            setTimeout(() => {
                cText.innerHTML = '<i class="bi bi-copy"></i> Copy';
            }, 2000);
        });

        // Interactive pause/resume timeline values
        const duration = 5000;
        let elapsed = 0;
        const interval = 50;
        let isHovered = false;
        const progressEl = toast.querySelector('.toast-progress-bar');

        const countdownTimer = setInterval(() => {
            if (!isHovered) {
                elapsed += interval;
                if (progressEl) {
                    const widthPercent = Math.max(0, 100 - (elapsed / duration) * 100);
                    progressEl.style.width = `${widthPercent}%`;
                }
                if (elapsed >= duration) {
                    clearInterval(countdownTimer);
                    dismiss();
                }
            }
        }, interval);

        toast.addEventListener('mouseenter', () => { isHovered = true; });
        toast.addEventListener('mouseleave', () => { isHovered = false; });
    };

    // Protect window.showSystemMessage using getter/setter so that inline assignments are ignored
    Object.defineProperty(window, 'showSystemMessage', {
        get() {
            return customShowMessage;
        },
        set(newVal) {
            // Silently ignore attempts to overwrite it
        },
        configurable: true
    });

    // Override browser window.alert to route through gorgeous stackable notifications
    const originalAlert = window.alert;
    window.alert = function(msg) {
        const text = String(msg).toLowerCase();
        let type = 'info';
        if (text.includes('error') || text.includes('failed') || text.includes('failure') || text.includes('blocked') || text.includes('unreachable') || text.includes('breach') || text.includes('invalid')) {
            type = 'error';
        } else if (text.includes('success') || text.includes('verified') || text.includes('complete') || text.includes('saved') || text.includes('purged') || text.includes('authorized')) {
            type = 'success';
        } else if (text.includes('confirm') || text.includes('attention') || text.includes('warn')) {
            type = 'warning';
        }
        customShowMessage(msg, type);
    };

    // Unified Global triggerGlassDecision mechanism to overlay custom confirmation prompts
    window.triggerGlassDecision = function(title, text, onConfirm, onAbort = () => {}) {
        let modal = document.getElementById('glassDecisionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'glassDecisionModal';
            modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm hidden';
            modal.innerHTML = `
                <div class="glass-panel p-8 rounded-[2rem] max-w-sm w-full mx-4 border-t-4 border-rose-500 shadow-2xl">
                    <div id="decisionIcon" class="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6">
                        <i class="bi bi-shield-exclamation text-xl"></i>
                    </div>
                    <h3 id="decisionTitle" class="text-lg font-black uppercase tracking-tighter text-white mb-2">Confirm Protocol</h3>
                    <p id="decisionText" class="text-xs italic text-gray-400 leading-relaxed mb-8">Are you sure you want to proceed with this protocol?</p>
                    <div class="flex gap-3">
                        <button id="decisionConfirm" class="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-rose-900/20">Confirm</button>
                        <button id="decisionAbort" class="flex-1 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl border border-white/10 transition-all">Abort</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('decisionTitle').innerText = title;
        document.getElementById('decisionText').innerText = text;

        const panel = modal.querySelector('.glass-panel');
        const iconBox = document.getElementById('decisionIcon');
        const iconEl = iconBox.querySelector('i');
        const confirmBtn = document.getElementById('decisionConfirm');

        const isDanger = title.includes('PURGE') || title.includes('DELETE') || title.includes('TERMINATE') || title.includes('KILL') || title.includes('REJECT');
        if (isDanger) {
            panel.style.borderTopColor = '#f43f5e';
            iconBox.className = 'w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6';
            iconEl.className = 'bi bi-shield-exclamation text-xl';
            confirmBtn.className = 'flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-rose-900/20';
        } else {
            panel.style.borderTopColor = '#10b981';
            iconBox.className = 'w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6';
            iconEl.className = 'bi bi-shield-check text-xl';
            confirmBtn.className = 'flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20';
        }

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
    };
})();

class AdminHeader extends HTMLElement {
    connectedCallback() {
        const active = this.getAttribute('active');
        this.className = "sticky top-0 z-50 w-full glass-panel border-b border-gray-800 px-3 py-3 sm:px-6 sm:py-4 flex justify-between items-center";
        this.innerHTML = `
            <div class="flex items-center gap-4 md:gap-8">
                <button id="mobileSidebarToggle" class="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white transition">
                    <i class="bi bi-list text-2xl"></i>
                </button>
                <a href="/admin/admin-dashboard.html" class="text-xl font-black tracking-tighter text-white admin-header-logo">
                    durk<span class="text-emerald-500">ADMIN</span>
                </a>
                <nav class="hidden md:flex items-center gap-1">
                    ${this.getNavLink('/admin/admin-dashboard.html', 'Dashboard', active === 'dashboard')}
                    ${this.getNavLink('/admin/admin-management.html', 'Users', active === 'users')}
                    ${this.getNavLink('/admin/admin-payouts.html', 'Payouts', active === 'payouts')}
                    ${this.getNavLink('/admin/admin-referrals.html', 'Referrals', active === 'referrals')}
                    ${this.getNavLink('/admin/admin-tasks.html', 'Tasks', active === 'tasks')}
                    ${this.getNavLink('/admin/admin-transactions.html', 'Ledger', active === 'transactions')}
                </nav>
            </div>
            <div class="flex items-center gap-4">
                <a href="/admin/admin-killswitch.html" class="p-2 rounded-lg ${active === 'killswitch' ? 'text-rose-500 bg-rose-500/10' : 'text-gray-400 hover:text-rose-400'} transition">
                    <i class="bi bi-shield-shaded text-lg"></i>
                </a>
                <button id="navLogoutBtn" class="px-3 py-1.5 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-500 hover:text-white transition flex items-center gap-1.5" title="Logout">
                    <i class="bi bi-box-arrow-left text-xs logout-icon hidden"></i>
                    <span class="logout-text">Logout</span>
                </button>
            </div>
        `;

        this.querySelector('#navLogoutBtn').addEventListener('click', () => {
            if(confirm('Terminate admin session?')) {
                localStorage.clear();
                window.location.href = '/admin/admin-login.html';
            }
        });

        this.querySelector('#mobileSidebarToggle')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('toggle-admin-sidebar'));
        });
    }

    getNavLink(href, label, isActive) {
        return `
            <a href="${href}" class="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition 
                ${isActive ? 'text-emerald-500 bg-emerald-500/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}">
                ${label}
            </a>
        `;
    }
}

class AdminSidebar extends HTMLElement {
    connectedCallback() {
        const active = this.getAttribute('active');
        // Mobile: fixed drawer with transform and max-width safety bounds. Desktop: static sidebar.
        this.className = "fixed lg:static inset-y-0 left-0 z-[60] w-64 max-w-[85vw] lg:max-w-none glass-panel border-r border-gray-800 flex flex-col h-full transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none";
        this.innerHTML = `
            <div class="p-4 sm:p-6 flex items-center justify-between border-b border-gray-800/40 mb-4 admin-sidebar-header">
                <span class="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Management</span>
                <button id="closeSidebarBtn" class="lg:hidden text-gray-400 hover:text-white transition">
                    <i class="bi bi-x-lg text-lg"></i>
                </button>
            </div>
            <nav class="flex-1 px-4 space-y-1 admin-sidebar-nav">
                ${this.getLink('/admin/admin-dashboard.html', 'bi-speedometer2', 'Overview', active === 'dashboard')}
                ${this.getLink('/admin/admin-management.html', 'bi-people', 'User Matrix', active === 'users')}
                ${this.getLink('/admin/admin-referrals.html', 'bi-diagram-3', 'Referral Network', active === 'referrals')}
                ${this.getLink('/admin/admin-payouts.html', 'bi-wallet2', 'Payout Queue', active === 'payouts')}
                <div class="pt-4 pb-2 px-4 text-[9px] font-bold text-gray-600 uppercase tracking-widest">Control Center</div>
                ${this.getLink('/admin/admin-tasks.html', 'bi-list-task', 'Task Pipeline', active === 'tasks')}
                ${this.getLink('/admin/admin-transactions.html', 'bi-bank', 'Transactions', active === 'transactions')}
                ${this.getLink('/admin/admin-killswitch.html', 'bi-shield-lock', 'Kill Switch', active === 'killswitch')}
                <div class="pt-4 pb-2 px-4 text-[9px] font-bold text-gray-600 uppercase tracking-widest">Configuration</div>
                ${this.getLink('/admin/dashboard_manager.html', 'bi-sliders', 'System Settings', active === 'config')}
            </nav>
        `;

        // Mobile backdrop overlay
        const backdrop = document.createElement('div');
        backdrop.className = "fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] hidden lg:hidden opacity-0 transition-opacity duration-300";
        document.body.appendChild(backdrop);

        const toggleSidebar = () => {
            const isHidden = this.classList.contains('-translate-x-full');
            if (isHidden) {
                backdrop.classList.remove('hidden');
                setTimeout(() => {
                    this.classList.remove('-translate-x-full');
                    backdrop.classList.add('opacity-100');
                }, 10);
            } else {
                this.classList.add('-translate-x-full');
                backdrop.classList.remove('opacity-100');
                setTimeout(() => backdrop.classList.add('hidden'), 300);
            }
        };

        window.addEventListener('toggle-admin-sidebar', toggleSidebar);
        backdrop.onclick = toggleSidebar;
        this.querySelector('#closeSidebarBtn')?.addEventListener('click', toggleSidebar);
        
        // Auto-close sidebar on mobile when a navigation link is clicked
        this.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 1024) toggleSidebar();
            });
        });
    }

    getLink(href, icon, label, isActive) {
        return `
            <a href="${href}" class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition 
                ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}">
                <i class="bi ${icon}"></i> ${label}
            </a>
        `;
    }
}

customElements.define('admin-header', AdminHeader);
customElements.define('admin-sidebar', AdminSidebar);