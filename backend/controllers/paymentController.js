const User = require('../models/userModel');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const getAuthToken = async () => {
    const response = await axios.post(process.env.PESAPAL_AUTH_URL, {
        consumer_key: process.env.PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
    });
    return response.data.token;
};

exports.initiatePayment = async (req, res) => {
    try {
        const user = await User.findByEmail(req.body.email);
        if (!user) return res.status(404).json({ message: "User not found" });

        const token = await getAuthToken();
        const merchantReference = uuidv4();
        
        // Save reference to user to track later
        await User.updatePaymentReference(user.id, merchantReference);

        const payload = {
            id: merchantReference,
            currency: "KES",
            amount: 500.00,
            description: "DurkWalmart Account Activation",
            callback_url: "http://localhost:3000/payment.html",
            notification_id: process.env.PESAPAL_IPN_ID,
            billing_address: {
                email_address: user.email,
                phone_number: user.phone_number,
                first_name: user.full_name || user.username
            }
        };

        const response = await axios.post(`${process.env.PESAPAL_BASE_URL}/Transactions/SubmitOrderRequest`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        res.json({ redirect_url: response.data.redirect_url });
    } catch (error) {
        console.error("PesaPal Error:", error.response?.data || error.message);
        res.status(500).json({ message: "Payment initialization failed" });
    }
};

// Verify transaction status manually (called by frontend on redirect)
exports.checkTransactionStatus = async (req, res) => {
    try {
        const { orderTrackingId, merchantReference } = req.query;
        if (!orderTrackingId) return res.status(400).json({ message: "Tracking ID required" });

        const token = await getAuthToken();
        const statusRes = await axios.get(
            `${process.env.PESAPAL_BASE_URL}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (statusRes.data.payment_status_description === "Completed") {
            const user = await User.activateUserByReference(merchantReference, orderTrackingId);
            return res.json({ status: "Completed", message: "Account activated successfully", user });
        }

        res.json({ status: statusRes.data.payment_status_description, message: "Payment not yet completed" });

    } catch (error) {
        console.error("Status Check Error:", error.message);
        res.status(500).json({ message: "Internal verification failure" });
    }
};

// This handles the IPN callback from PesaPal to activate the user
exports.handleIPN = async (req, res) => {
    try {
        const { OrderTrackingId, MerchantReference } = req.query;
        const token = await getAuthToken();
        
        const statusRes = await axios.get(
            `${process.env.PESAPAL_BASE_URL}/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (statusRes.data.payment_status_description === "Completed") {
            await User.activateUserByReference(MerchantReference, OrderTrackingId);
            console.log(`[SYSTEM] User activated via Reference: ${MerchantReference}`);
        }

        res.status(200).send("OK");
    } catch (error) {
        console.error("IPN Error:", error.message);
        res.status(500).send("Error");
    }
};