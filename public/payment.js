document.addEventListener('DOMContentLoaded', () => {
    const proceedBtn = document.getElementById('proceedBtn');
    const userEmail = localStorage.getItem('wa_ads_registered_email');

    // Global safety timer: if the user does nothing for 1 minute, redirect back home
    const inactivityTimer = setTimeout(() => {
        window.location.href = 'index.html';
    }, 60000);

    // 1. Handle Payment Initiation
    if (proceedBtn) {
        proceedBtn.addEventListener('click', async () => {
            proceedBtn.innerText = "Initializing Secure Gateway...";
            proceedBtn.disabled = true;

            try {
                const response = await fetch('/api/payments/initiate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail })
                });
                const data = await response.json();
                if (data.redirect_url) {
                    window.location.href = data.redirect_url;
                }
            } catch (err) {
                alert("Gateway timeout. Please retry.");
                proceedBtn.innerText = "Proceed to Secure Payment";
                proceedBtn.disabled = false;
            }
        });
    }

    // 2. Handle Redirect Logic (On return from PesaPal)
    const urlParams = new URLSearchParams(window.location.search);
    const trackingId = urlParams.get('OrderTrackingId');
    const merchantRef = urlParams.get('OrderMerchantReference');

    if (trackingId) {
        // Show a "Verifying" message on the card
        document.querySelector('.auth-header h1').innerText = "VERIFYING...";
        document.querySelector('.info-text').innerText = "Communicating with PesaPal nodes. Please wait.";
        
        // Verify with the backend
        const verifyPayment = async () => {
            try {
                const response = await fetch(`/api/payments/status-check?orderTrackingId=${trackingId}&merchantReference=${merchantRef}`);
                const result = await response.json();

                if (result.status === "Completed") {
                    clearTimeout(inactivityTimer); // Stop the timer on success
                    document.querySelector('.info-text').innerText = "Sync Successful! Redirecting to login...";
                    setTimeout(() => window.location.href = 'login.html', 2000);
                } else {
                    document.querySelector('.info-text').innerText = "Payment pending or failed. Returning home in 1 minute...";
                    // Inactivity timer is already running and will trigger the redirect
                }
            } catch (err) {
                console.error("Verification failed", err);
            }
        };
        
        verifyPayment();
    } else if (window.location.href.includes('error') || window.location.href.includes('cancel')) {
        document.querySelector('.info-text').innerText = "Transaction interrupted. Returning home in 1 minute...";
    }
});