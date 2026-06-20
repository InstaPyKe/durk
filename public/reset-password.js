document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const alertBox = document.getElementById('alert');

    if (!token) {
        showAlert('Invalid access token. Please request a new reset link.', 'error');
        document.getElementById('resetForm').style.display = 'none';
    }

    document.getElementById('resetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirmPassword').value;

        if (password !== confirm) {
            return showAlert('Passwords do not match.', 'error');
        }

        const btn = document.getElementById('submitBtn');
        btn.innerText = 'Updating Node...';
        btn.disabled = true;

        try {
            const response = await fetch(`/api/users/reset-password/${token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (response.ok) {
                showAlert(result.message, 'success');
                setTimeout(() => window.location.href = 'login.html', 3000);
            } else {
                showAlert(result.message, 'error');
                btn.innerText = 'Synchronize Key';
                btn.disabled = false;
            }
        } catch (err) {
            showAlert('System offline. Check your connection.', 'error');
        }
    });

    function showAlert(msg, type) {
        alertBox.innerText = msg;
        alertBox.className = `alert alert-${type}`;
        alertBox.style.display = 'block';
    }
});