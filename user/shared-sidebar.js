class AdminSidebar extends HTMLElement {
    connectedCallback() {
        const active = this.getAttribute('active');
        this.className = "w-64 glass-panel border-r border-gray-800 hidden lg:flex flex-col h-full";
        
        this.innerHTML = `
            <div class="p-6">
                <a href="admin-dashboard.html" class="text-2xl font-black tracking-tighter text-white">
                    durk<span class="text-emerald-500">ADMIN</span>
                </a>
            </div>
            <nav class="flex-1 px-4 space-y-2 overflow-y-auto">
                ${this.getLink('admin-dashboard.html', 'bi-speedometer2', 'Dashboard', active === 'dashboard')}
                ${this.getLink('admin-management.html', 'bi-people', 'User Matrix', active === 'users')}
                ${this.getLink('youtube_manager.html', 'bi-youtube', 'YouTube Control', active === 'youtube')}
                ${this.getLink('tiktok_manager.html', 'bi-tiktok', 'TikTok Management', active === 'tiktok')}
                ${this.getLink('blog_manager.html', 'bi-journal-text', 'Blog Manager', active === 'blogs')}
                ${this.getLink('dashboard_manager.html', 'bi-sliders', 'System Config', active === 'config')}
            </nav>
            <div class="p-4 border-t border-gray-800">
                <button id="sidebarLogoutBtn" class="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl transition font-medium">
                    <i class="bi bi-box-arrow-left"></i> Terminate Session
                </button>
            </div>
        `;

        this.querySelector('#sidebarLogoutBtn').addEventListener('click', () => {
            if(confirm('Terminate active session and logout of node?')) {
                localStorage.clear();
                window.location.href = '../public/login.html';
            }
        });
    }

    getLink(href, icon, label, isActive) {
        const baseClass = "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition";
        const activeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        const inactiveClass = "text-gray-400 hover:bg-white/5 hover:text-white";
        
        return `
            <a href="${href}" class="${baseClass} ${isActive ? activeClass : inactiveClass}">
                <i class="bi ${icon}"></i> ${label}
            </a>
        `;
    }
}
customElements.define('admin-sidebar', AdminSidebar);