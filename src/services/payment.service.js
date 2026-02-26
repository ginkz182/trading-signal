const Stripe = require('stripe');
const config = require('../config');
const messages = require('../config/messages');

class PaymentService {
    constructor(subscriberService, notificationService, monitorService) {
        this.subscriberService = subscriberService;
        this.notificationService = notificationService;
        this.monitorService = monitorService;
        
        if (config.stripe.secretKey) {
            this.stripe = Stripe(config.stripe.secretKey);
            console.log("💳 Stripe initialized");
        } else {
            console.warn("⚠️ Stripe Secret Key missing. PaymentService (Stripe) disabled.");
        }
    }

    /**
     * Creates a Stripe Checkout Session
     * @param {string} chatId - User's Telegram Chat ID
     * @param {string} planType - 'premium_monthly'
     * @param {string} mode - 'subscription' (Card) or 'payment' (PromptPay)
     */
    async createCheckoutSession(chatId, planType = 'premium_monthly', mode = 'subscription') {
        if (!this.stripe) throw new Error("Stripe not configured");

        const priceId = config.stripe.prices[planType];
        const amount = config.stripe.amounts[planType];

        if (!priceId) throw new Error("Invalid plan type");

        try {
            const line_items = [];
            
            if (mode === 'subscription') {
                line_items.push({
                    price: priceId, // Recurring Price ID
                    quantity: 1,
                });
            } else {
                // For one-time payments (PromptPay), we construct an ad-hoc price
                line_items.push({
                    price_data: {
                        currency: 'thb',
                        product_data: {
                            name: 'Purrfect Resident (1 Month Access)',
                            description: 'Manual renewal for trading signals',
                        },
                        unit_amount: amount || 30000, // Default 300 THB if missing
                    },
                    quantity: 1,
                });
            }

            const sessionConfig = {
                payment_method_types: mode === 'subscription' ? ['card'] : ['promptpay'],
                line_items: line_items,
                mode: mode,
                allow_promotion_codes: true, // Let Stripe handle promo codes and discounts
                success_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/success`, 
                cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/cancel`,
                client_reference_id: chatId,
                metadata: {
                    chatId: chatId,
                    plan: planType,
                    type: mode
                }
            };
            
            const session = await this.stripe.checkout.sessions.create(sessionConfig);
            return session.url;
        } catch (error) {
            console.error("Stripe Checkout Error:", error);
            throw error;
        }
    }

    /**
     * Handles Stripe Webhook Events
     * @param {Buffer} body 
     * @param {string} signature 
     */
    async handleWebhook(body, signature) {
        if (!this.stripe) return;

        let event;
        try {
            event = this.stripe.webhooks.constructEvent(
                body,
                signature,
                config.stripe.webhookSecret
            );
        } catch (err) {
            console.error(`⚠️ Webhook signature verification failed.`, err.message);
            throw new Error(`Webhook Error: ${err.message}`);
        }

        console.log(`🔔 Stripe Webhook: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleCheckoutCompleted(event.data.object);
                break;
            case 'invoice.payment_succeeded':
            case 'invoice.paid':
                await this.handleInvoicePaymentSucceeded(event.data.object);
                break;
            case 'invoice.payment_failed':
                await this.handleInvoicePaymentFailed(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object);
                break;
            default:
                // console.log(`Unhandled event type ${event.type}`);
        }
    }

    async handleInvoicePaymentFailed(invoice) {
        const customerId = invoice.customer;
        console.warn(`❌ Payment failed for invoice ${invoice.id} (Customer: ${customerId})`);
        
        try {
            const res = await this.subscriberService.pool.query(
                "SELECT chat_id FROM subscribers WHERE stripe_customer_id = $1",
                [customerId]
            );

            if (res.rows.length > 0) {
                const chatId = res.rows[0].chat_id;
                // Notify user
                if (this.notificationService) {
                    await this.notificationService.sendToSingleChat(
                        chatId,
                        `⚠️ <b>Payment Failed</b>
                        
We could not process your subscription renewal. 
Please ensure your card details are up to date. 

Retrying in a few days...`
                    );
                }
            }
        } catch (err) {
            console.error("Error handling payment failure:", err);
        }
    }

    async handleCheckoutCompleted(session) {
        // This fires for both Subscription (first payment) and One-time Payment
        const chatId = session.client_reference_id || session.metadata?.chatId;
        const mode = session.mode; // 'subscription' or 'payment'
        
        if (!chatId) {
            console.error("❌ Checkout completed but no chatId found in metadata.");
            return;
        }

        console.log(`💰 Checkout completed for ${chatId} (${mode})`);
        
        // 30 days duration for both initial subscription and manual payment
        const durationDays = 30; 
        
        try {
            // Update the user's subscription
            // Note: If mode is 'subscription', Stripe manages the recurring billing. 
            // But we still need to unlock the regular tiers logic.
            // We set 'is_auto_renewal' to true for subscriptions.

            let isAuto = (mode === 'subscription');
            
            // Log payment to 'payments' table
            const client = await this.subscriberService.pool.connect();
            try {
                await client.query(
                    `INSERT INTO payments (chat_id, provider, transaction_id, amount, currency, status, metadata)
                     VALUES ($1, 'stripe', $2, $3, $4, 'paid', $5)
                     ON CONFLICT (transaction_id) DO NOTHING`,
                    [
                        chatId, 
                        session.payment_intent || session.subscription, // ID
                        (session.amount_total || 0) / 100, 
                        session.currency,
                        JSON.stringify(session)
                    ]
                );
                
                // Update subscriber Stripe Customer ID
                if (session.customer) {
                    await client.query(
                        `UPDATE subscribers SET stripe_customer_id = $1, is_auto_renewal = $2 WHERE chat_id = $3`,
                        [session.customer, isAuto, chatId]
                    );
                }

                // If it's a manual payment (PromptPay), we treat it as an extension.
                // If it's a subscription, 'invoice.payment_succeeded' will likely fire too? 
                // Checks: 'checkout.session.completed' usually fires AFTER payment is successful.
                // For 'subscription' mode, this validates the SETUP. 
                // The actual 'invoice.payment_succeeded' might handle the time extension, 
                // BUT determining if this is the first one is tricky. 
                // Safe bet: 'checkout.session.completed' grants the initial 30 days. 
                // Subsequent 'invoice.payment_succeeded' events extend it.
                
                await this.subscriberService.updateSubscription(
                    chatId, 
                    'premium', // Tier
                    durationDays, 
                    `stripe_${mode}`
                );

                // Notify user of successful payment
                if (this.notificationService) {
                    try {
                        const updatedSub = await this.subscriberService.getSubscriber(chatId);
                        const tierConfig = config.tiers.premium;
                        const tierDisplay = tierConfig.displayName.toUpperCase();
                        const expiry = updatedSub?.subscription_end_at
                            ? `\n<b>Expires:</b> ${new Date(updatedSub.subscription_end_at).toLocaleDateString()}`
                            : '';
                        await this.notificationService.sendToSingleChat(
                            chatId,
                            messages.paymentSuccess(tierDisplay, expiry)
                        );
                    } catch (notifyErr) {
                        console.warn(`⚠️ Failed to send payment confirmation to ${chatId}`);
                    }
                }

                // Notify admin
                if (this.monitorService && session.amount_total && session.currency) {
                    try {
                        const amount = session.amount_total / 100;
                        await this.monitorService.notifyPaymentSuccess(chatId, amount, session.currency, `stripe_${mode}`);
                    } catch (adminErr) {
                        console.warn(`⚠️ Failed to send admin payment notification for ${chatId}`);
                    }
                }

            } finally {
                client.release();
            }

        } catch (err) {
            console.error(`❌ Failed to process checkout for ${chatId}:`, err);
        }
    }

    async handleInvoicePaymentSucceeded(invoice) {
        // This fires for recurring subscription renewals
        if (invoice.billing_reason === 'subscription_create') {
            // We already handled this in checkout.session.completed usually, 
            // DO NOT duplicate the extension logic here to avoid double-crediting if both fire close together.
            // OR: We can rely solely on this for subscriptions? 
            console.log(`ℹ️ Invoice ${invoice.id} is for subscription creation (skipping, handled by checkout)`);
            return;
        }
        
        const customerId = invoice.customer;
        // We need to find the chat_id associated with this customer
        // We can look up in our DB.
        
        try {
            const res = await this.subscriberService.pool.query(
                "SELECT chat_id FROM subscribers WHERE stripe_customer_id = $1",
                [customerId]
            );
            
            if (res.rows.length === 0) {
                console.warn(`⚠️ Invoice succeeded but no user found for customer ${customerId}`);
                return;
            }
            
            const chatId = res.rows[0].chat_id;
            console.log(`💰 Recurring payment succeeded for ${chatId}. Extending subscription.`);

            // Log payment
            await this.subscriberService.pool.query(
                `INSERT INTO payments (chat_id, provider, transaction_id, amount, currency, status, metadata)
                 VALUES ($1, 'stripe', $2, $3, $4, 'paid', $5)
                 ON CONFLICT (transaction_id) DO NOTHING`,
                [
                    chatId, 
                    invoice.payment_intent || invoice.id, 
                    (invoice.amount_paid || 0) / 100, 
                    invoice.currency,
                    JSON.stringify(invoice)
                ]
            );

            // Extend subscription by 30 days
            // We use 'updateSubscription' but we need to ensure it ADDS to the current time if valid.
            // Our updateSubscription logic in SubscriberService currently sets 'newEndAt' based on NOW + duration.
            // We might need to tweak `updateSubscription` to support "Extend" logic vs "Set New" logic.
            // For now, let's assume updateSubscription resets from NOW. 
            // Since this runs ON the billing date, NOW + 30 days is correct for renewal.
            
            await this.subscriberService.updateSubscription(
                chatId, 
                'premium', 
                30, 
                'stripe_recurring'
            );

            // Notify user of renewal
            if (this.notificationService) {
                try {
                    const updatedSub = await this.subscriberService.getSubscriber(chatId);
                    const expiry = updatedSub?.subscription_end_at
                        ? new Date(updatedSub.subscription_end_at).toLocaleDateString()
                        : 'N/A';
                    await this.notificationService.sendToSingleChat(
                        chatId,
                        messages.renewalSuccess(expiry)
                    );
                } catch (notifyErr) {
                    console.warn(`⚠️ Failed to send renewal notification to ${chatId}`);
                }
            }

            // Notify admin
            if (this.monitorService && invoice.amount_paid && invoice.currency) {
                try {
                    const amount = invoice.amount_paid / 100;
                    await this.monitorService.notifyPaymentSuccess(chatId, amount, invoice.currency, 'stripe_recurring');
                } catch (adminErr) {
                    console.warn(`⚠️ Failed to send admin renewal notification for ${chatId}`);
                }
            }
            
        } catch (err) {
            console.error(`❌ Failed to process invoice ${invoice.id}:`, err);
        }
    }

    async handleSubscriptionDeleted(subscription) {
        console.log(`❌ Subscription deleted: ${subscription.id}`);
        // Downgrade user
        const customerId = subscription.customer;
        
        try {
            const res = await this.subscriberService.pool.query(
                "SELECT chat_id FROM subscribers WHERE stripe_customer_id = $1",
                [customerId]
            );
            
            if (res.rows.length > 0) {
                const chatId = res.rows[0].chat_id;
                // Update to free, clear auto-renewal flag
                await this.subscriberService.pool.query(
                    `UPDATE subscribers SET 
                     tier = 'free', 
                     is_auto_renewal = false, 
                     subscription_end_at = NULL 
                     WHERE chat_id = $1`,
                    [chatId]
                );
                
                // Clear custom assets on downgrade
                await this.subscriberService.pool.query(
                    `DELETE FROM user_assets WHERE chat_id = $1`,
                    [chatId]
                );
                
                console.log(`📉 Downgraded user ${chatId} due to subscription cancellation.`);
            }
        } catch (err) {
            console.error("Error handling sub deletion:", err);
        }
    }

    /**
     * Cancel a user's recurring Stripe subscription
     * Cancels at period end so they keep access until expiry
     */
    async cancelSubscription(chatId) {
        if (!this.stripe) throw new Error("Stripe not configured");

        // Look up user's stripe customer ID
        const subscriber = await this.subscriberService.getSubscriber(chatId);
        if (!subscriber || !subscriber.stripe_customer_id) {
            return { cancelled: false, reason: 'no_subscription' };
        }

        if (!subscriber.is_auto_renewal) {
            return { cancelled: false, reason: 'not_recurring' };
        }

        try {
            // Find active subscriptions for this customer
            const subscriptions = await this.stripe.subscriptions.list({
                customer: subscriber.stripe_customer_id,
                status: 'active',
            });

            if (subscriptions.data.length === 0) {
                return { cancelled: false, reason: 'no_active_subscription' };
            }

            // Cancel at period end (user keeps access until expiry)
            for (const sub of subscriptions.data) {
                await this.stripe.subscriptions.update(sub.id, {
                    cancel_at_period_end: true,
                });
            }

            // Update DB
            await this.subscriberService.pool.query(
                `UPDATE subscribers SET is_auto_renewal = false WHERE chat_id = $1`,
                [chatId]
            );

            const periodEnd = subscriptions.data[0].current_period_end;
            let expiryDate;
            if (periodEnd) {
                expiryDate = new Date(periodEnd * 1000).toLocaleDateString();
            } else if (subscriber.subscription_end_at) {
                expiryDate = new Date(subscriber.subscription_end_at).toLocaleDateString();
            } else {
                expiryDate = 'your current billing period';
            }

            // Notify Admin
            if (this.monitorService) {
                try {
                    await this.monitorService.notifySubscriptionCancelled(chatId, "Auto-renewal stopped by user via /cancel command");
                } catch (adminErr) {
                    console.warn(`⚠️ Failed to send admin cancel notification for ${chatId}`);
                }
            }

            return { cancelled: true, expiryDate };
        } catch (err) {
            console.error(`❌ Failed to cancel subscription for ${chatId}:`, err);
            throw err;
        }
    }
}

module.exports = PaymentService;
