document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../login.html'; return; }

    const profileForm = document.getElementById('profileSettingsForm');
    const passwordForm = document.getElementById('passwordSecurityForm');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const profileImage = document.getElementById('profileImage');

    // 1. Initial Synchronization: Fetch User Data
    async function syncSettings() {
        try {
            // Fetch main dashboard data for header
            const dashRes = await fetch('/api/users/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
            const dashData = await dashRes.json();

            // Fetch specific settings data
            const res = await fetch('/api/users/settings', { headers: { 'Authorization': `Bearer ${token}` } });
            const user = await res.json();

            // Pre-fill fields
            if (usernameDisplay) usernameDisplay.innerText = user.username;
            if (profileImage) profileImage.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
            
            // Form pre-fill (Ensure these IDs match your HTML)
            if (document.getElementById('fullName')) document.getElementById('fullName').value = user.full_name || '';
            if (document.getElementById('phoneNumber')) document.getElementById('phoneNumber').value = user.phone_number || '';
            if (document.getElementById('emailDisplay')) document.getElementById('emailDisplay').value = user.email || '';
            if (document.getElementById('bio')) document.getElementById('bio').value = user.bio || '';

        } catch (err) { console.error('Sync Error:', err); }
    }

    // 2. Handle Profile Update
    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Synchronizing...";

        const payload = {
            full_name: document.getElementById('fullName').value,
            phone_number: document.getElementById('phoneNumber').value,
            bio: document.getElementById('bio').value
        };

        try {
            const res = await fetch('/api/users/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            alert(result.message);
            if (res.ok) syncSettings();
        } catch (err) { alert("Handshake Failed."); }
        finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Save Profile Changes";
        }
    });

    // 3. Handle Password Rotation
    passwordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNew = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNew) {
            alert("Security Alert: New passphrases do not match.");
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Rotating Vault Keys...";

        try {
            const res = await fetch('/api/users/settings/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const result = await res.json();
            alert(result.message);
            if (res.ok) passwordForm.reset();
        } catch (err) { alert("Security update failed."); }
        finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Update Password";
        }
    });

    // Sidebar/Logout boilerplate (Consistent with other pages)
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (confirm('Terminate active session?')) {
            localStorage.clear();
            window.location.href = '../public/index.html';
        }
    });

    await syncSettings();
});