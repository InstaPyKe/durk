document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const systemAlert = document.getElementById('systemAlert');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const successInterface = document.getElementById('successInterface');
    const successMessage = document.getElementById('successMessage');

    // --- Rate Limiting State ---
    let submissionAttempts = 0;
    const MAX_ATTEMPTS = 3;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const card = document.querySelector('.auth-card');
        systemAlert.classList.remove('overload-mode', 'success-mode');

        const email = document.getElementById('userEmail').value.trim();
        const password = document.getElementById('userPassword').value.trim();

        if (!email || !password) {
            showStatus('Validation Exception: Credentials payload fields cannot be incomplete.', 'error');
            return;
        }

        // --- Rate Limit Check ---
        submissionAttempts++;
        if (submissionAttempts > MAX_ATTEMPTS) {
            alertTitle.innerText = 'Security Overload';
            alertMessage.innerHTML = `Too many requests detected.<br>Terminal locked for 30s.`;
            systemAlert.style.display = 'flex';
            systemAlert.classList.add('overload-mode');
            submitBtn.disabled = true;
            
            setTimeout(() => {
                submissionAttempts = 0;
                submitBtn.disabled = false;
                systemAlert.style.display = 'none';
            }, 30000);
            return;
        }

        // Visual execution processing animation state change
        submitBtn.innerText = 'Authenticating Agent...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok) {
                systemAlert.style.display = 'none';
                form.style.display = 'none';
                successMessage.innerText = 'Credentials verified. Welcome back, Agent.';
                successInterface.style.display = 'flex';
                
                localStorage.setItem('token', result.token);
                localStorage.setItem('waa_ads_logged_in', 'true');
                localStorage.setItem('wa_ads_registered_user', result.user.username);
                localStorage.setItem('wa_ads_registered_email', result.user.email);
                
                // Trigger subtle fade-out animation
                card.classList.add('fade-exit');
                
                // Immediate Redirection to Agent Dashboard
                if (!localStorage.getItem('durkwalmart_selected_tier_id')) {
                    localStorage.setItem('durkwalmart_selected_tier_name', 'Tier 1: Starter');
                    localStorage.setItem('durkwalmart_selected_tier_id', '1');
                }
                setTimeout(() => {
                    window.location.href = 'user/dashboard.html';
                }, 500);
            } else {
                throw new Error(result.message || 'Authentication failed');
            }
        } catch (err) {
            submitBtn.innerText = 'Check In';
            submitBtn.disabled = false;
            
            let errorTitle = 'Access Denied'; // Default for invalid credentials
            if (err.message.includes('Internal Server Error')) {
                errorTitle = 'System Error';
            }

            showStatus(err.message, 'error', errorTitle);
        }
    });

    function showStatus(msg, type, title) {
        alertTitle.innerText = title || (type === 'success' ? 'Protocol Success' : 'Access Denied');
        alertMessage.innerText = msg;
        systemAlert.style.display = 'flex';
        systemAlert.classList.remove('overload-mode'); // Ensure overload-mode is removed for any new status
        
        if (type === 'success') {
            systemAlert.classList.add('success-mode');
        } else {
            systemAlert.classList.remove('success-mode');
        }
    }

    // --- Password Visibility Toggle ---
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            btn.style.color = isPassword ? 'var(--primary-green)' : 'rgba(255, 255, 255, 0.3)';
        });
    });

    // --- Scanline Trigger ---
    form.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            document.body.classList.add('scanning');
        }, { once: true });
    });

    // --- Forgot Password Modal Logic ---
    const forgotModal = document.getElementById('forgotPasswordModal');
    const forgotTrigger = document.getElementById('forgotPassTrigger');
    const closeForgotModal = document.getElementById('closeForgotModal');
    const forgotForm = document.getElementById('forgotForm');
    const forgotAlert = document.getElementById('forgotAlert');
    const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');

    forgotTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        forgotModal.classList.add('active');
    });

    closeForgotModal.addEventListener('click', () => {
        forgotModal.classList.remove('active');
        forgotAlert.style.display = 'none';
        forgotForm.reset();
    });

    window.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
            forgotModal.classList.remove('active');
            forgotAlert.style.display = 'none';
            forgotForm.reset();
        }
    });

    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        forgotSubmitBtn.innerText = 'Dispatching Cryptographic Link...';
        forgotSubmitBtn.disabled = true;

        setTimeout(() => {
            forgotAlert.innerText = 'Protocol Executed: Reset link has been dispatched to your secure inbox.';
            forgotAlert.classList.add('success');
            forgotAlert.style.display = 'block';
            forgotSubmitBtn.innerText = 'Link Dispatched';
            
            setTimeout(() => {
                forgotModal.classList.remove('active');
                forgotAlert.style.display = 'none';
                forgotForm.reset();
                forgotSubmitBtn.innerText = 'Dispatch Reset Link';
                forgotSubmitBtn.disabled = false;
            }, 2500);
        }, 1500);
    });

    // --- High-Performance HTML5 Canvas Background Balloon Simulator ---
    const canvas = document.getElementById('balloon-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let balloons = [];
        const balloonCount = 60;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        class Balloon {
            constructor() {
                this.radius = Math.random() * 20 + 10;
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = -(Math.random() * 0.4 + 0.2);
                const colors = ['rgba(0, 234, 135, 0.12)', 'rgba(0, 112, 243, 0.08)', 'rgba(255, 215, 0, 0.08)'];
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.stringLength = this.radius * 2;
            }
            update() {
                this.x += this.vx; this.y += this.vy;
                if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) this.vx = -this.vx;
                if (this.y + this.radius + this.stringLength < 0) { this.y = canvas.height + this.radius + 10; this.x = Math.random() * canvas.width; }
            }
            draw() {
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill();
                ctx.beginPath(); ctx.moveTo(this.x, this.y + this.radius); ctx.lineTo(this.x - 3, this.y + this.radius + 5); ctx.lineTo(this.x + 3, this.y + this.radius + 5); ctx.closePath(); ctx.fillStyle = this.color; ctx.fill();
                ctx.beginPath(); ctx.moveTo(this.x, this.y + this.radius + 5); ctx.quadraticCurveTo(this.x - 2, this.y + this.radius + (this.stringLength/2), this.x, this.y + this.radius + this.stringLength); ctx.strokeStyle = this.color; ctx.lineWidth = 1; ctx.stroke();
            }
        }
        for (let i = 0; i < balloonCount; i++) balloons.push(new Balloon());
        function animate() { ctx.clearRect(0, 0, canvas.width, canvas.height); balloons.forEach(b => { b.update(); b.draw(); }); requestAnimationFrame(animate); }
        animate();
    }
});