const express = require('express');
const router = express.Router();
const config = require('../config');

module.exports = (paymentService) => {
    // secure webhook endpoint
    router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
        const signature = req.headers['stripe-signature'];

        try {
            await paymentService.handleWebhook(req.body, signature);
            res.json({ received: true });
        } catch (err) {
            console.error(`Webhook Error: ${err.message}`);
            res.status(400).send(`Webhook Error: ${err.message}`);
        }
    });

    return router;
};
