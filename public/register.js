document.addEventListener('DOMContentLoaded', () => {
    
    const form = document.getElementById('registrationForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const submitBtn = document.getElementById('submitBtn');

    // Determine the API base URL for network synchronization
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.startsWith('file://'))
        ? (window.location.port === '3000' ? '' : 'http://localhost:3000')
        : '';

    // Capture referral code from URL if present (?ref=ID)
    const urlParams = new URLSearchParams(window.location.search);
    // Ensure referrerId is treated as an integer or null
    const rawRef = urlParams.get('ref');
    const referrerId = (rawRef && !isNaN(rawRef)) ? parseInt(rawRef) : null;

    // --- Referrer Identity Resolution Node ---
    if (referrerId) {
        const fetchReferrer = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/users/public/referrer/${referrerId}`);
                if (res.ok) {
                    const data = await res.json();
                    const notice = document.getElementById('referrerNotice');
                    if (notice) {
                        notice.innerHTML = `<i class="bi bi-person-check-fill mr-2"></i> Registering under agent: <span class="text-emerald-500 font-black">@${data.username}</span>`;
                        notice.classList.remove('hidden');
                    }
                }
            } catch (err) { console.error("Identity resolution failed", err); }
        };
        fetchReferrer();
    }

    // --- Rate Limiting State ---
    let submissionAttempts = 0;
    const MAX_ATTEMPTS = 3;

    // Regex Definition Maps
    // Strict Gmail validation (6-30 chars, lowercase, numbers, dots)
    const gmailRegex = /^[a-z0-9](\.?[a-z0-9]){5,29}@gmail\.com$/i;
    // Safaricom specific regex for Kenyan nodes
    const safaricomRegex = /^(?:254|\+254|0)?(7(?:[0129]\d|4[0-3568]|5[7-9]|6[89])|11[0-5])\d{6}$/;

    // Tracking Engine Verification states
    let validationStatus = {
        username: false,
        email: false,
        phone: false,
        password: false,
        confirm: false
    };

    // Real-time Event Listener Triggers
    usernameInput.addEventListener('input', validateUsername);
    usernameInput.addEventListener('change', validateUsername);

    emailInput.addEventListener('input', validateEmail);
    emailInput.addEventListener('change', validateEmail);

    passwordInput.addEventListener('input', () => { validatePassword(); validateConfirm(); });
    passwordInput.addEventListener('change', () => { validatePassword(); validateConfirm(); });

    confirmInput.addEventListener('input', validateConfirm);
    confirmInput.addEventListener('change', validateConfirm);

    if (phoneInput) {
        phoneInput.addEventListener('input', validatePhone);
        phoneInput.addEventListener('change', validatePhone);
    }

    // Trigger validation checks to accommodate browser autofill/restored values
    setTimeout(() => {
        if (usernameInput.value.trim()) validateUsername();
        if (emailInput.value.trim()) validateEmail();
        if (phoneInput && phoneInput.value.trim()) validatePhone();
        if (passwordInput.value) validatePassword();
        if (confirmInput.value) validateConfirm();
    }, 500);

    // --- Real-time Username Evaluator Rules ---
     async function validateUsername() {
        const val = usernameInput.value.trim();
        const feedback = document.getElementById('usernameFeedback');
        
        if(val.length < 4) {
            setInputState(usernameInput, feedback, 'Username must consist of 4+ characters.', false);
            validationStatus.username = false;
            evaluateFormCompleteness();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/users/check-username/${encodeURIComponent(val)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.available) {
                    setInputState(usernameInput, feedback, 'Username handle is available.', true);
                    validationStatus.username = true;
                } else {
                    setInputState(usernameInput, feedback, 'Access Denied: Username handle already registered.', false);
                    validationStatus.username = false;
                }
            } else {
                setInputState(usernameInput, feedback, 'Username handle accepted.', true);
                validationStatus.username = true;
            }
        } catch (err) {
            setInputState(usernameInput, feedback, 'Username handle accepted.', true);
            validationStatus.username = true;
        }
        evaluateFormCompleteness();
    }

    // --- Real-time Corporate Email Validation Node ---
    function validateEmail() {
        const val = emailInput.value.trim();
        const feedback = document.getElementById('emailFeedback');
        if(gmailRegex.test(val)) {
            setInputState(emailInput, feedback, '', true);
            validationStatus.email = true;
        } else {
            setInputState(emailInput, feedback, 'Provide a valid, existing @gmail.com address.', false);
            validationStatus.email = false;
        }
        evaluateFormCompleteness();
    }

    // --- Real-time International Format Phone Parser Component ---
    function validatePhone() {
        const rawVal = phoneInput.value.trim();
        // Strip structural spaces, brackets or hyphens for precise international digit calculation audits
        const cleanVal = rawVal.replace(/[\s\-\(\)]/g, '');
        const feedback = document.getElementById('phoneFeedback');

        if (safaricomRegex.test(cleanVal)) {
            setInputState(phoneInput, feedback, '', true);
            validationStatus.phone = true;
        } else {
            setInputState(phoneInput, feedback, 'Access Denied: Only Kenyan Safaricom numbers are permitted (e.g., 0712345678).', false);
            validationStatus.phone = false;
        }
        evaluateFormCompleteness();
    }

    // --- Password Strength Meter Engine with Metric Weight Calculations ---
    function validatePassword() {
        const val = passwordInput.value;
        const feedback = document.getElementById('passwordFeedback');
        const bar = document.getElementById('strengthBar');
        const label = document.getElementById('strengthLabel');
        
        let score = 0;
        if (!val) {
            bar.style.width = '0%';
            label.innerText = 'Strength: Empty';
            setInputState(passwordInput, feedback, 'Security passphrase is required.', false);
            validationStatus.password = false;
            evaluateFormCompleteness();
            return;
        }

        // Incremental rule evaluation heuristics
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        // Visual response metrics based on composite scores
        switch(score) {
            case 1:
            case 2:
                bar.style.width = '30%';
                bar.style.backgroundColor = varColor('--danger-red');
                label.innerText = 'Strength: Weak / Vulnerable';
                break;
            case 3:
                bar.style.width = '60%';
                bar.style.backgroundColor = varColor('--primary-yellow');
                label.innerText = 'Strength: Medium / Acceptable';
                break;
            case 4:
            case 5:
                bar.style.width = '100%';
                bar.style.backgroundColor = varColor('--primary-green');
                label.innerText = 'Strength: Excellent / High Protection';
                break;
        }

        if (val.length >= 6) {
            setInputState(passwordInput, feedback, '', true);
            validationStatus.password = true;
        } else {
            setInputState(passwordInput, feedback, 'Minimum metric threshold is 6 characters.', false);
            validationStatus.password = false;
        }
        evaluateFormCompleteness();
    }

    // --- Password Passphrase Structural Match Audit Validation ---
    function validateConfirm() {
        const pass = passwordInput.value;
        const conf = confirmInput.value;
        const feedback = document.getElementById('confirmFeedback');

        if (!conf) {
            setInputState(confirmInput, feedback, 'Please confirm your key encryption sequence.', false);
            validationStatus.confirm = false;
        } else if (pass === conf) {
            setInputState(confirmInput, feedback, '', true);
            validationStatus.confirm = true;
        } else {
            setInputState(confirmInput, feedback, 'Security passphrases do not match.', false);
            validationStatus.confirm = false;
        }
        evaluateFormCompleteness();
    }

    // --- Central Form UI Modifier Pipeline Utility ---
    function setInputState(inputEl, feedbackEl, message, isValid) {
        if (isValid) {
            inputEl.classList.remove('input-invalid');
            inputEl.classList.add('input-valid');
            feedbackEl.className = 'field-feedback feedback-success';
            feedbackEl.innerText = message;
        } else {
            inputEl.classList.remove('input-valid');
            inputEl.classList.add('input-invalid');
            feedbackEl.className = 'field-feedback feedback-error';
            feedbackEl.innerText = message;
        }
    }

    function varColor(varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    // --- Unified Glassy Notification Engine ---
    function showGlassNotification(message, type = 'success') {
        const container = document.getElementById('formAlertContainer');
        if (!container) return;

        const iconEl = container.querySelector('.form-alert-icon');
        const titleEl = container.querySelector('.form-alert-title');
        const msgEl = container.querySelector('.form-alert-message');

        const icons = {
            success: '<i class="bi bi-shield-check"></i>',
            error: '<i class="bi bi-exclamation-octagon"></i>',
            info: '<i class="bi bi-info-circle"></i>',
            warning: '<i class="bi bi-exclamation-triangle"></i>'
        };

        const titles = {
            success: 'System Handshake',
            error: 'Access Denied',
            info: 'System Sync',
            warning: 'Security Alert'
        };

        container.className = 'form-alert-container ' + type;
        iconEl.innerHTML = icons[type] || icons.info;
        titleEl.innerText = titles[type] || 'Notification';
        msgEl.innerText = message;

        // Auto-hide success or info notifications, but keep error notifications visible so user can resolve issues
        if (type !== 'error') {
            setTimeout(() => {
                if (container.classList.contains(type) && msgEl.innerText === message) {
                    container.classList.add('hidden');
                }
            }, 6000);
        }
    }

    // --- Submission Guard / Enable Control Evaluation Rule ---
    function evaluateFormCompleteness() {
        const allValid = Object.values(validationStatus).every(status => status === true);
        submitBtn.disabled = !allValid;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        submitBtn.innerText = 'Initializing...';
        submitBtn.disabled = true;
        showGlassNotification("Initializing synchronization sequence...", "info");

        submissionAttempts++;
        if (submissionAttempts > MAX_ATTEMPTS) {
            showGlassNotification("Security Overload: Too many requests detected. Terminal locked for 30s.", "error");
            submitBtn.disabled = true;
            setTimeout(() => {
                submissionAttempts = 0;
                submitBtn.disabled = false;
            }, 30000);
            return;
        }

        const finalValidationCheck = Object.values(validationStatus).every(status => status === true);
        if (!finalValidationCheck) {
            showGlassNotification("Input Blocked: Resolve all highlighted errors before submitting.", "error");
            submitBtn.innerText = 'Create & Select Plan';
            submitBtn.disabled = false;
            return;
        }

        try {
            const registrationData = {
                username: usernameInput.value.trim(),
                email: emailInput.value.trim(),
                phone_number: phoneInput.value.trim(),
                password: passwordInput.value,
                confirmPassword: confirmInput.value,
                full_name: usernameInput.value.trim(),
                referrer_id: referrerId
            };

            const response = await fetch(`${API_BASE}/api/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData)
            });
            const result = await response.json();

            if (response.ok) {
                showGlassNotification(result.message || 'Registration successful. Redirecting...', "success");
                submitBtn.innerText = 'Sync Complete';
                localStorage.setItem('token', result.token);
                setTimeout(() => window.location.href = 'payment.html', 2000);
            } else {
                showGlassNotification(result.message || 'Access Denied', "error");
                submitBtn.innerText = 'Create & Select Plan';
                submitBtn.disabled = false;
            }
        } catch (err) {
            showGlassNotification("Network Portal: Failed to reach synchronization node.", "error");
            submitBtn.innerText = 'Create & Select Plan';
            submitBtn.disabled = false;
        }
    });

    // --- Password Visibility Toggle Logic ---
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const isPassword = input.getAttribute('type') === 'password';
            
            input.setAttribute('type', isPassword ? 'text' : 'password');
            btn.style.color = isPassword ? 'var(--primary-green)' : 'rgba(255, 255, 255, 0.3)';
        });
    });

    // --- Scanline Trigger Logic ---
    form.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            document.body.classList.add('scanning');
        }, { once: true });
    });

    // --- Back to Top Logic (from dashboard.html) ---
    const mainContent = document.getElementById('mainContent');
    const backToTopBtn = document.getElementById('backToTop');
    const scrollProgress = document.getElementById('scrollProgress');

    if (mainContent && backToTopBtn && scrollProgress) {
        mainContent.addEventListener('scroll', () => {
            const scrollTop = mainContent.scrollTop;
            const scrollHeight = mainContent.scrollHeight - mainContent.clientHeight;
            const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
            scrollProgress.style.transform = `scaleX(${progress})`;

            if (mainContent.scrollTop > 500) {
                backToTopBtn.classList.add('back-to-top-visible');
            } else {
                backToTopBtn.classList.remove('back-to-top-visible');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- 5. High-Performance HTML5 Canvas Background Balloon Simulator ---
    const canvas = document.getElementById('balloon-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let balloons = [];
        const balloonCount = 100;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        class Balloon {
            constructor() {
                this.radius = Math.random() * 25 + 15;
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 1.2;
                this.vy = -(Math.random() * 0.6 + 0.4);
                const colors = [
                    'rgba(0, 112, 243, 0.18)',  
                    'rgba(0, 234, 135, 0.18)',  
                    'rgba(255, 215, 0, 0.18)',
                    'rgba(168, 85, 247, 0.18)'
                ];
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.stringLength = this.radius * 2;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
                    this.vx = -this.vx;
                }

                if (this.y + this.radius + this.stringLength < 0) {
                    this.y = canvas.height + this.radius + 10;
                    this.x = Math.random() * canvas.width;
                    this.vx = (Math.random() - 0.5) * 1.2;
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.radius);
                ctx.lineTo(this.x - 4, this.y + this.radius + 6);
                ctx.lineTo(this.x + 4, this.y + this.radius + 6);
                ctx.closePath();
                ctx.fillStyle = this.color;
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.radius + 6);
                ctx.quadraticCurveTo(this.x - 3, this.y + this.radius + (this.stringLength/2), this.x, this.y + this.radius + this.stringLength);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        for (let i = 0; i < balloonCount; i++) {
            balloons.push(new Balloon());
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            balloons.forEach(balloon => {
                balloon.update();
                balloon.draw();
            });
            requestAnimationFrame(animate);
        }
        animate();
    }
});