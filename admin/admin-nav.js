class AdminHeader extends HTMLElement {
    connectedCallback() {
        const active = this.getAttribute('active');
        this.className = "sticky top-0 z-50 w-full glass-panel border-b border-gray-800 px-6 py-4 flex justify-between items-center";
        this.innerHTML = `
            <div class="flex items-center gap-4 md:gap-8">
                <button id="mobileSidebarToggle" class="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white transition">
                    <i class="bi bi-list text-2xl"></i>
                </button>
                <a href="/admin/admin-dashboard.html" class="text-xl font-black tracking-tighter text-white">
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
                <button id="navLogoutBtn" class="px-4 py-2 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-500 hover:text-white transition">
                    Logout
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
        // Mobile: fixed drawer with transform. Desktop: static sidebar.
        this.className = "fixed lg:static inset-y-0 left-0 z-[60] w-64 glass-panel border-r border-gray-800 flex flex-col h-full transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none";
        this.innerHTML = `
            <div class="p-6 flex items-center justify-between">
                <span class="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Management</span>
                <button id="closeSidebarBtn" class="lg:hidden text-gray-400 hover:text-white transition">
                    <i class="bi bi-x-lg text-lg"></i>
                </button>
            </div>
            <nav class="flex-1 px-4 space-y-1">
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