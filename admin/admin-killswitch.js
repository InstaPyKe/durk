document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');

    const btn = document.getElementById('killSwitchBtn');
    const indicator = document.getElementById('statusIndicator');
    let isKillSwitchActive = false;

    async function fetchStatus() {
        try {
            const res = await fetch('/api/users/admin/system-status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            isKillSwitchActive = data.isKillSwitchActive;
            updateUI();
        } catch (err) { console.error("Telemetry failure", err); }
    }

    function updateUI() {
        if (isKillSwitchActive) {
            indicator.className = 'mb-8 inline-flex items-center gap-3 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full';
            indicator.innerHTML = '<span class="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span><span class="text-[10px] font-black text-rose-500 uppercase tracking-widest">System Terminated</span>';
            btn.innerText = "Disengage Kill Switch";
            btn.className = "w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-900/40 active:scale-95";
        } else {
            indicator.className = 'mb-8 inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full';
            indicator.innerHTML = '<span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span><span class="text-[10px] font-black text-emerald-500 uppercase tracking-widest">System Online</span>';
            btn.innerText = "Engage Kill Switch";
            btn.className = "w-full py-5 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-rose-900/40 active:scale-95";
        }
    }

    btn.onclick = async () => {
        const action = isKillSwitchActive ? 'RE-ENABLE' : 'TERMINATE';
        
        const executeToggle = async () => {
            btn.disabled = true;
            btn.innerText = "EXECUTING...";

            try {
                const res = await fetch('/api/users/admin/kill-switch', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ active: !isKillSwitchActive })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    isKillSwitchActive = !isKillSwitchActive;
                    document.getElementById('lastChange').innerText = new Date().toLocaleTimeString();
                    updateUI();
                    alert(data.message);
                } else {
                    const data = await res.json();
                    alert(data.message || "Failed to execute protocol.");
                }
            } catch (err) { alert("Command transmission failed."); }
            btn.disabled = false;
        };

        if (window.triggerGlassDecision) {
            window.triggerGlassDecision(
                isKillSwitchActive ? 'RE-ENGAGE SYSTEM' : 'SYSTEM KILL SWITCH',
                isKillSwitchActive 
                    ? `⚠️ RESTORATION PROTOCOL: Re-enable the platform for all visitors and user nodes?`
                    : `🚨 TERMINATION PROTOCOL: Shut down all public access and user account dashboard cycles immediately?`,
                executeToggle
            );
        } else if (confirm(`⚠️ CRITICAL PROTOCOL: Are you sure you want to ${action} all user nodes?`)) {
            executeToggle();
        }
    };

    fetchStatus();
});