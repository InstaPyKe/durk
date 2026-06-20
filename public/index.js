document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Dynamic Authentication Navigation State Switcher ---
    const authNavContainer = document.getElementById('authNavContainer');
    const heroCTA = document.getElementById('heroCTA');
    const isUserLoggedIn = localStorage.getItem('waa_ads_logged_in') === 'true';

    if (isUserLoggedIn) {
        if (authNavContainer) {
            authNavContainer.innerHTML = `<a href="payment.html" class="btn btn-blue" style="padding: 10px 20px; font-size:0.85rem;">Go to Dashboard</a>`;
        }
        if (heroCTA) {
            heroCTA.innerText = 'Go to Dashboard';
            heroCTA.setAttribute('href', 'payment.html');
            heroCTA.className = 'btn btn-blue';
        }
    }

    // --- 2. Mobile Device Hamburger Navigation Interactivity Controller ---
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const navLinks = document.getElementById('navLinks');
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');

    if (hamburgerMenu && navLinks) {
        hamburgerMenu.addEventListener('click', () => {
            hamburgerMenu.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }

    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            if (window.innerWidth <= 560) {
                e.preventDefault();
                const parentLi = trigger.parentElement;
                parentLi.classList.toggle('mobile-active');
            }
        });
    });

    document.querySelectorAll('.nav-links > li > a:not(.dropdown-trigger)').forEach(link => {
        link.addEventListener('click', () => {
            if (hamburgerMenu && navLinks) {
                hamburgerMenu.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });
    });


    // --- 3. Dynamic Testimonials Slide Loop Array Logic Component ---
    const track = document.getElementById('testimonialTrack');
    const slides = Array.from(track ? track.children : []);
    const dotsContainer = document.getElementById('sliderDots');
    let currentSlideIndex = 0;
    let slideInterval;

    if (track && slides.length > 0 && dotsContainer) {
        slides.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (index === 0) dot.classList.add('active');
            dot.addEventListener('click', () => {
                goToSlide(index);
                resetSlideTimer();
            });
            dotsContainer.appendChild(dot);
        });

        const dots = Array.from(dotsContainer.children);

        function goToSlide(index) {
            track.style.transform = `translateX(-${index * 100}%)`;
            dots[currentSlideIndex].classList.remove('active');
            dots[index].classList.add('active');
            currentSlideIndex = index;
        }

        function nextSlide() {
            let nextIndex = (currentSlideIndex + 1) % slides.length;
            goToSlide(nextIndex);
        }

        function startSlideTimer() {
            slideInterval = setInterval(nextSlide, 5000);
        }

        function resetSlideTimer() {
            clearInterval(slideInterval);
            startSlideTimer();
        }

        startSlideTimer();
    }


    // --- 5. Intersection Observer Reveal Logic ---
    const revealOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Trigger increment animation when metrics section is visible
                if (entry.target.classList.contains('metrics-grid')) {
                    animateMetrics();
                }
            }
        });
    }, revealOptions);

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    function animateMetrics() {
        const counters = [
            { id: 'count-members', end: 152400, prefix: '', suffix: '+' },
            { id: 'count-payouts', end: 2.4, prefix: '$', suffix: 'M+' },
            { id: 'count-tasks', end: 4.8, prefix: '', suffix: 'M+' }
        ];

        counters.forEach(counter => {
            const el = document.getElementById(counter.id);
            if (!el || el.dataset.animated) return;
            el.dataset.animated = "true"; // Prevent re-triggering

            const duration = 2000; // 2 seconds animation
            const startTime = performance.now();

            function update(now) {
                const progress = Math.min((now - startTime) / duration, 1);
                
                // Ease Out Cubic: 1 - (1 - progress)^3 
                // This causes the animation to start fast and slow down at the end
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const current = easedProgress * counter.end;
                
                if (counter.end % 1 === 0) {
                    el.innerText = counter.prefix + Math.floor(current).toLocaleString() + counter.suffix;
                } else {
                    el.innerText = counter.prefix + current.toFixed(1) + counter.suffix;
                }

                if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
        });
    }

    // --- 6. Back to Top Logic ---
    const backToTopBtn = document.getElementById('backToTop');
    const heroSection = document.getElementById('welcome');
    const progressCircle = document.querySelector('.progress-ring__circle');
    const circumference = 148; // 2 * PI * 23.5

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = scrollTop / docHeight;
        
        // Update the progress ring offset
        progressCircle.style.strokeDashoffset = circumference - (scrollPercent * circumference);

        if (scrollTop > heroSection.offsetHeight) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});