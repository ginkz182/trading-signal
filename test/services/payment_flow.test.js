const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const config = require('../../src/config');

describe('Payment Service Flow', () => {
    let PaymentService;
    let paymentService;
    let mockSubscriberService;
    let mockNotificationService;
    let mockPool;
    let mockStripe;
    let mockStripeInstance;

    beforeEach(() => {
        // Mock Stripe
        mockStripeInstance = {
            checkout: {
                sessions: {
                    create: sinon.stub()
                }
            },
            webhooks: {
                constructEvent: sinon.stub()
            }
        };
        mockStripe = sinon.stub().returns(mockStripeInstance);

        // Mock PG Pool
        const mockClient = {
            query: sinon.stub(),
            release: sinon.stub(),
        };
        mockPool = {
            connect: sinon.stub().resolves(mockClient),
            query: sinon.stub(), 
            end: sinon.stub()
        };

        // Mock SubscriberService
        mockSubscriberService = {
            pool: mockPool,
            updateSubscription: sinon.stub().resolves({ 
                newTier: 'purrfect_resident', 
                expiresAt: new Date() 
            })
        };

        // Mock NotificationService
        mockNotificationService = {
            sendToSingleChat: sinon.stub()
        };

        // Load PaymentService with mocks
        PaymentService = proxyquire('../../src/services/payment.service', {
            'stripe': mockStripe,
            'pg': { Pool: sinon.stub().returns(mockPool) },
            '../config': {
                ...config,
                stripe: {
                    ...config.stripe,
                    secretKey: 'sk_test_mock',
                    prices: {
                        premium_monthly: 'price_mock_123'
                    },
                    amounts: {
                        premium_monthly: 19900
                    }
                }
            }
        });

        paymentService = new PaymentService(mockSubscriberService, mockNotificationService);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('1. createCheckoutSession', () => {
        it('should create a subscription session for Card payment', async () => {
            mockStripeInstance.checkout.sessions.create.resolves({ url: 'https://stripe.com/checkout' });

            const url = await paymentService.createCheckoutSession('123', 'premium_monthly', 'subscription');
            
            expect(url).to.equal('https://stripe.com/checkout');
            sinon.assert.calledWith(mockStripeInstance.checkout.sessions.create, sinon.match({
                mode: 'subscription',
                client_reference_id: '123'
            }));
        });

        it('should create a one-time payment session for PromptPay', async () => {
            mockStripeInstance.checkout.sessions.create.resolves({ url: 'https://stripe.com/pay' });

            const url = await paymentService.createCheckoutSession('123', 'premium_monthly', 'payment');
            
            expect(url).to.equal('https://stripe.com/pay');
            sinon.assert.calledWith(mockStripeInstance.checkout.sessions.create, sinon.match({
                mode: 'payment',
                payment_method_types: ['promptpay'],
                line_items: sinon.match.array.deepEquals([
                    {
                        price_data: {
                            currency: 'thb',
                            product_data: {
                                name: 'Purrfect Resident (1 Month Access)',
                                description: 'Manual renewal for trading signals',
                            },
                            unit_amount: 19900
                        },
                        quantity: 1
                    }
                ])
            }));
        });
    });

    describe('2. handleWebhook', () => {
        it('should handle checkout.session.completed (Success)', async () => {
            const eventPayload = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'sess_123',
                        client_reference_id: 'chat_123',
                        mode: 'payment',
                        amount_total: 19900,
                        currency: 'thb',
                        payment_intent: 'pi_123'
                    }
                }
            };

            mockStripeInstance.webhooks.constructEvent.returns(eventPayload);
            const mockClient = await mockPool.connect(); // Get the mock client

            await paymentService.handleWebhook(Buffer.from('test'), 'sig');

            // Expect DB log (using the mockClient we created in beforeEach)
            // Note: In actual implementation, we call subscriberService.pool.connect(). 
            // In our mock, mockSubscriberService.pool is mockPool.
            // mockPool.connect() returns mockClient.
            sinon.assert.calledWith(mockClient.query, 
                sinon.match(/INSERT INTO payments/),
                sinon.match.array.contains(['chat_123', 'pi_123'])
            );

            // Expect Subscription Update
            sinon.assert.calledWith(mockSubscriberService.updateSubscription,
                'chat_123', 'premium', 30, 'stripe_payment'
            );
        });

        it('should handle invoice.payment_succeeded (Subscription Renewal)', async () => {
            const eventPayload = {
                type: 'invoice.payment_succeeded',
                data: {
                    object: {
                        id: 'in_123',
                        customer: 'cus_123',
                        amount_paid: 19900,
                        currency: 'thb',
                        billing_reason: 'subscription_cycle',
                        payment_intent: 'pi_invoice_123'
                    }
                }
            };

            mockStripeInstance.webhooks.constructEvent.returns(eventPayload);
            
            // Mock finding user by stripe customer id
            mockPool.query.resolves({ rows: [{ chat_id: 'chat_999' }] });

            await paymentService.handleWebhook(Buffer.from('test'), 'sig');

            sinon.assert.calledWith(mockSubscriberService.updateSubscription,
                'chat_999', 'premium', 30, 'stripe_recurring'
            );
        });

        it('should handle invoice.payment_failed (Notify User)', async () => {
            const eventPayload = {
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        id: 'in_fail_123',
                        customer: 'cus_fail_123',
                    }
                }
            };

            mockStripeInstance.webhooks.constructEvent.returns(eventPayload);
            mockPool.query.resolves({ rows: [{ chat_id: 'chat_fail_999' }] });

            await paymentService.handleWebhook(Buffer.from('test'), 'sig');

            sinon.assert.calledWith(mockNotificationService.sendToSingleChat,
                'chat_fail_999',
                sinon.match.string
            );
        });

        it('should handle customer.subscription.deleted (Downgrade)', async () => {
            const eventPayload = {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_deleted_123',
                        customer: 'cus_deleted_123',
                    }
                }
            };

            mockStripeInstance.webhooks.constructEvent.returns(eventPayload);
            mockPool.query.resolves({ rows: [{ chat_id: 'chat_downgrade_999' }] });

            await paymentService.handleWebhook(Buffer.from('test'), 'sig');

            sinon.assert.calledWith(mockPool.query, 
                sinon.match(/UPDATE subscribers SET\s+tier = 'free',\s+is_auto_renewal = false,\s+subscription_end_at = NULL\s+WHERE chat_id = \$1/),
                ['chat_downgrade_999']
            );
            
            sinon.assert.calledWith(mockPool.query,
                sinon.match(/DELETE FROM user_assets WHERE chat_id = \$1/),
                ['chat_downgrade_999']
            );
        });

        it('should verify webhook signatures', async () => {
            mockStripeInstance.webhooks.constructEvent.throws(new Error('Invalid signature'));

            try {
                await paymentService.handleWebhook(Buffer.from('bad'), 'bad_sig');
                throw new Error('Should have thrown');
            } catch (err) {
                expect(err.message).to.include('Webhook Error: Invalid signature');
            }
        });
    });
});
