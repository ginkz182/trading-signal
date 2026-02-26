const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Payment Service - Cancel & Notifications', () => {
    let PaymentService;
    let paymentService;
    let mockSubscriberService;
    let mockNotificationService;
    let mockMonitorService;
    let mockPool;
    let mockStripeInstance;
    let mockStripe;

    beforeEach(() => {
        mockStripeInstance = {
            checkout: {
                sessions: { create: sinon.stub() }
            },
            webhooks: {
                constructEvent: sinon.stub()
            },
            subscriptions: {
                list: sinon.stub(),
                update: sinon.stub()
            }
        };
        mockStripe = sinon.stub().returns(mockStripeInstance);

        const mockClient = {
            query: sinon.stub().resolves({ rows: [] }),
            release: sinon.stub(),
        };
        mockPool = {
            connect: sinon.stub().resolves(mockClient),
            query: sinon.stub().resolves({ rows: [] }),
            end: sinon.stub()
        };

        mockSubscriberService = {
            pool: mockPool,
            getSubscriber: sinon.stub(),
            updateSubscription: sinon.stub().resolves({
                newTier: 'premium',
                expiresAt: new Date('2026-03-24')
            })
        };

        mockNotificationService = {
            sendToSingleChat: sinon.stub().resolves()
        };

        mockMonitorService = {
            notifyPaymentSuccess: sinon.stub().resolves(),
            notifySubscriptionCancelled: sinon.stub().resolves(),
        };

        PaymentService = proxyquire('../../src/services/payment.service', {
            'stripe': mockStripe,
            '../config': {
                ...require('../../src/config'),
                stripe: {
                    secretKey: 'sk_test_mock',
                    webhookSecret: 'whsec_mock',
                    prices: {
                        premium_monthly: 'price_mock_123',
                    },
                    amounts: {
                        premium_monthly: 19900,
                    }
                },
                tiers: {
                    premium: { displayName: 'Resident', monthlyPrice: 19900 }
                },
                telegram: { botUsername: 'testbot' }
            }
        });

        paymentService = new PaymentService(mockSubscriberService, mockNotificationService, mockMonitorService);
    });

    afterEach(() => sinon.restore());

    // ========== cancelSubscription ==========
    describe('cancelSubscription()', () => {
        it('should return no_subscription when user has no stripe_customer_id', async () => {
            mockSubscriberService.getSubscriber.resolves({ tier: 'premium', stripe_customer_id: null });

            const result = await paymentService.cancelSubscription('123');

            expect(result.cancelled).to.be.false;
            expect(result.reason).to.equal('no_subscription');
        });

        it('should return not_recurring when user is not on auto-renewal', async () => {
            mockSubscriberService.getSubscriber.resolves({
                tier: 'premium',
                stripe_customer_id: 'cus_123',
                is_auto_renewal: false
            });

            const result = await paymentService.cancelSubscription('123');

            expect(result.cancelled).to.be.false;
            expect(result.reason).to.equal('not_recurring');
        });

        it('should return no_active_subscription when Stripe has no active subs', async () => {
            mockSubscriberService.getSubscriber.resolves({
                tier: 'premium',
                stripe_customer_id: 'cus_123',
                is_auto_renewal: true
            });
            mockStripeInstance.subscriptions.list.resolves({ data: [] });

            const result = await paymentService.cancelSubscription('123');

            expect(result.cancelled).to.be.false;
            expect(result.reason).to.equal('no_active_subscription');
        });

        it('should cancel subscription at period end and update DB', async () => {
            mockSubscriberService.getSubscriber.resolves({
                tier: 'premium',
                stripe_customer_id: 'cus_123',
                is_auto_renewal: true
            });
            const periodEnd = Math.floor(new Date('2026-04-01').getTime() / 1000);
            mockStripeInstance.subscriptions.list.resolves({
                data: [{ id: 'sub_123', current_period_end: periodEnd }]
            });
            mockStripeInstance.subscriptions.update.resolves({});

            const result = await paymentService.cancelSubscription('123');

            expect(result.cancelled).to.be.true;
            expect(result.expiryDate).to.be.a('string');
            sinon.assert.calledWith(mockStripeInstance.subscriptions.update, 'sub_123', {
                cancel_at_period_end: true
            });
            sinon.assert.calledWith(mockPool.query,
                sinon.match(/is_auto_renewal = false/),
                ['123']
            );
            sinon.assert.calledWith(mockMonitorService.notifySubscriptionCancelled,
                '123',
                sinon.match(/Auto-renewal stopped/)
            );
        });

        it('should cancel multiple subscriptions if user has more than one', async () => {
            mockSubscriberService.getSubscriber.resolves({
                tier: 'premium',
                stripe_customer_id: 'cus_123',
                is_auto_renewal: true
            });
            const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 30;
            mockStripeInstance.subscriptions.list.resolves({
                data: [
                    { id: 'sub_1', current_period_end: periodEnd },
                    { id: 'sub_2', current_period_end: periodEnd }
                ]
            });
            mockStripeInstance.subscriptions.update.resolves({});

            const result = await paymentService.cancelSubscription('123');

            expect(result.cancelled).to.be.true;
            expect(mockStripeInstance.subscriptions.update.callCount).to.equal(2);
        });
    });

    // ========== Payment success notification ==========
    describe('handleCheckoutCompleted() - Notifications', () => {
        it('should send payment success message to user after checkout', async () => {
            const session = {
                client_reference_id: 'chat_200',
                mode: 'payment',
                amount_total: 19900,
                currency: 'thb',
                payment_intent: 'pi_200'
            };

            mockSubscriberService.getSubscriber.resolves({
                tier: 'premium',
                subscription_end_at: new Date('2026-04-01')
            });

            await paymentService.handleCheckoutCompleted(session);

            sinon.assert.calledWith(mockSubscriberService.updateSubscription,
                'chat_200', 'premium', 30, 'stripe_payment'
            );
            sinon.assert.calledWith(mockNotificationService.sendToSingleChat,
                'chat_200',
                sinon.match(/Payment Successful/)
            );
            sinon.assert.calledWith(mockMonitorService.notifyPaymentSuccess,
                'chat_200',
                199,
                'thb',
                'stripe_payment'
            );
        });

        it('should still upgrade even if notification fails', async () => {
            const session = {
                client_reference_id: 'chat_300',
                mode: 'subscription',
                amount_total: 19900,
                currency: 'thb',
                payment_intent: 'pi_300',
                customer: 'cus_300',
                subscription: 'sub_300'
            };

            mockSubscriberService.getSubscriber.rejects(new Error('DB error'));

            await paymentService.handleCheckoutCompleted(session);

            // Subscription should still be updated
            sinon.assert.calledWith(mockSubscriberService.updateSubscription,
                'chat_300', 'premium', 30, 'stripe_subscription'
            );
        });
    });

    // ========== Renewal notification ==========
    describe('handleInvoicePaymentSucceeded() - Notifications', () => {
        it('should send renewal message on recurring payment', async () => {
            const invoice = {
                id: 'in_renew',
                customer: 'cus_renew',
                amount_paid: 19900,
                currency: 'thb',
                billing_reason: 'subscription_cycle',
                payment_intent: 'pi_renew'
            };

            mockPool.query.resolves({ rows: [{ chat_id: 'chat_renew' }] });
            mockSubscriberService.getSubscriber.resolves({
                tier: 'premium',
                subscription_end_at: new Date('2026-05-01')
            });

            await paymentService.handleInvoicePaymentSucceeded(invoice);

            sinon.assert.calledWith(mockSubscriberService.updateSubscription,
                'chat_renew', 'premium', 30, 'stripe_recurring'
            );
            sinon.assert.calledWith(mockNotificationService.sendToSingleChat,
                'chat_renew',
                sinon.match(/Subscription Renewed/)
            );
            sinon.assert.calledWith(mockMonitorService.notifyPaymentSuccess,
                'chat_renew',
                199,
                'thb',
                'stripe_recurring'
            );
        });

        it('should skip subscription_create events (handled by checkout)', async () => {
            const invoice = {
                id: 'in_create',
                customer: 'cus_create',
                billing_reason: 'subscription_create'
            };

            await paymentService.handleInvoicePaymentSucceeded(invoice);

            sinon.assert.notCalled(mockSubscriberService.updateSubscription);
        });
    });
});
