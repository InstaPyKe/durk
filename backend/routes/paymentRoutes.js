const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/initiate', paymentController.initiatePayment);
router.get('/status-check', paymentController.checkTransactionStatus);
router.get('/callback', paymentController.handleIPN); // PesaPal sends status here

module.exports = router;