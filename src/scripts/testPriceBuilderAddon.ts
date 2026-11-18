import assert from 'node:assert/strict';
import {
	PriceBuilderEngine,
	buildPresetChannelPricing,
	priceBuilderAddon,
	resolveMpEffectiveRates,
	toAdminConfigView,
	toPublicProductPriceView,
	toPublicStoreConfigView
} from '@/addons/price_builder';
import { normalizeActiveAddons, getAddonModule } from '@/addons/registry';
import { AppError } from '@/errors/app.error';
import { VexxPlanTier } from '@/interfaces/plan.interface';

function runTests() {
	console.log('🧪 Running Price Builder Addon domain tests...');

	// 1. Addon registry & alias backward compatibility
	const resolvedByAlias = getAddonModule('installments_cft');
	assert.equal(resolvedByAlias?.manifest.id, 'price_builder', 'Legacy alias installments_cft must resolve to price_builder');
	assert.ok(priceBuilderAddon.manifest.includedInPlans.includes(VexxPlanTier.LOCAL), 'Active from LOCAL tier');
	const normalized = normalizeActiveAddons(['installments_cft']);
	assert.ok(normalized.includes('price_builder'), 'normalizeActiveAddons maps installments_cft -> price_builder');

	// 2. MP Effective Rates resolution
	const mpConfig = {
		active: true,
		environment: 'production' as const,
		checkoutMode: 'bricks' as const,
		oauth: {
			connected: true,
			mpUserId: '123456789',
			refreshToken: 'secret-refresh-token'
		},
		credentials: {
			production: {
				credentialSource: 'oauth' as const,
				publicKey: 'APP_USR-public-key',
				accessToken: 'APP_USR-secret-access-token',
				webhookSecret: 'super-secret-wh'
			}
		},
		webCheckout: {
			settlementTerm: 'instant' as const,
			absorbInstallments: true,
			maxInstallmentsToAbsorb: 3
		},
		qr: {
			settlementTerm: 'instant' as const,
			allowCardsInQr: false,
			creditSettlementTerm: 'instant' as const
		},
		posPoint: {
			debitSettlementTerm: 'instant' as const,
			creditSettlementTerm: 'instant' as const
		}
	};

	const rates = resolveMpEffectiveRates(mpConfig as any);
	assert.equal(rates.webTerm, 'instant');
	assert.ok(rates.webBasePercent > 0, 'Web base commission must be positive');
	assert.ok(rates.qrAccountMoneyPercent > 0, 'QR account commission must be positive');

	const baseEcommerceConfig = {
		taxes: { iva: 21 },
		pricingStrategy: {
			method: 'markup',
			defaultProfitMargin: 50,
			absorbInstallments: true,
			maxInstallmentsToAbsorb: 3
		},
		paymentGateways: {
			defaultWebGateway: 'mercadopago',
			mercadopago: mpConfig
		}
	};

	// 3. 3-prices preset + inheritance (cash -> transfer -> qr)
	const preset3 = buildPresetChannelPricing('3_prices');
	const calc3 = PriceBuilderEngine.calculate({
		providerCost: 32000,
		additionalCosts: [
			{ concept: 'Packaging / Bolsa', value: 1200, type: 'fixed', category: 'expense' },
			{ concept: 'IIBB Provincia', value: 3.5, type: 'percent_over_price', category: 'tax' }
		],
		channelPricing: preset3,
		dolar: 1200,
		config: baseEcommerceConfig
	});

	assert.equal(calc3.activeGateway.key, 'mercadopago');
	assert.equal(calc3.price.cashPrice, calc3.price.transferPrice, 'Cash linked to transfer');
	assert.equal(calc3.price.transferPrice, calc3.price.qrPrice, 'Transfer linked to QR');
	assert.ok(
		calc3.price.channels.cash.netProfit > calc3.price.channels.qr.netProfit,
		'Cash has higher net profit than QR when equalized to QR price'
	);
	assert.equal(calc3.price.shippingSubsidy, 0, 'No shipping subsidy when no shipping cost is present');
	assert.ok(calc3.price.displaySummary.length >= 2, 'Display summary generated');

	// 4. Shipping cost concept triggers shippingSubsidy insight only when present
	const calcWithShipping = PriceBuilderEngine.calculate({
		providerCost: 32000,
		additionalCosts: [
			{ concept: 'Envío correo', value: 4500, type: 'fixed', category: 'shipping' }
		],
		channelPricing: preset3,
		dolar: 1200,
		config: baseEcommerceConfig
	});
	assert.equal(calcWithShipping.price.shippingSubsidy, 4500);
	assert.ok(
		calcWithShipping.insights.some((ins) => ins.code === 'SHIPPING_SUBSIDY_INFO'),
		'Emits SHIPPING_SUBSIDY_INFO insight when shipping cost is included'
	);

	// 5. Payment restrictions (no card / no interest-free installments)
	const calcCashOnly = PriceBuilderEngine.calculate({
		providerCost: 10000,
		channelPricing: buildPresetChannelPricing('2_prices'),
		paymentRestrictions: {
			allowCardPayment: false,
			allowInterestFreeInstallments: false
		},
		dolar: 1200,
		config: baseEcommerceConfig
	});
	assert.equal(calcCashOnly.price.channels.debit.enabled, false, 'Debit disabled when allowCardPayment is false');
	assert.equal(calcCashOnly.price.channels.credit1Pay.enabled, false, 'Credit 1 pay disabled');
	assert.equal(calcCashOnly.price.channels.list.enabled, false, 'List disabled');
	assert.equal(calcCashOnly.price.installments.hasThreeInstallmentsSeamless, false);

	// 6. Sanitizers (Admin, Public Store Config, Public Product Price)
	const adminView = toAdminConfigView(baseEcommerceConfig, 'https://vura.vexx.ar');
	assert.equal((adminView.paymentGateways.mercadopago as any).oauth.connected, true);
	assert.equal((adminView.paymentGateways.mercadopago as any).oauth.refreshToken, undefined, 'Never leak refreshToken to admin');
	assert.equal((adminView.paymentGateways.mercadopago as any).credentials.production.hasAccessToken, true);
	assert.equal((adminView.paymentGateways.mercadopago as any).credentials.production.accessToken, undefined, 'Never leak accessToken to admin');

	const publicStore = toPublicStoreConfigView(baseEcommerceConfig);
	assert.equal(publicStore.publicKey, 'APP_USR-public-key');
	assert.equal(publicStore.environment, 'production');
	assert.equal(publicStore.isTestMode, false);
	assert.equal(publicStore.maxInstallments, 3);
	assert.equal((publicStore as any).accessToken, undefined);

	const publicProduct = toPublicProductPriceView({
		price: calc3.price,
		finance: calc3.finance,
		paymentRestrictions: { allowCardPayment: true, allowInterestFreeInstallments: true }
	});
	assert.ok(publicProduct.price.displaySummary.length > 0);
	assert.equal(publicProduct.price.channels.cash.netProfit, undefined);
	assert.equal(publicProduct.finance, undefined);

	// 7. Fail-fast when configured defaultWebGateway is inactive
	assert.throws(
		() =>
			PriceBuilderEngine.calculate({
				providerCost: 10000,
				dolar: 1200,
				config: {
					...baseEcommerceConfig,
					paymentGateways: {
						defaultWebGateway: 'getnet',
						mercadopago: mpConfig,
						getnet: { active: false }
					}
				}
			}),
		(err: unknown) => err instanceof AppError && err.statusCode === 400
	);

	// 8. Mercado Pago installment tiers (2, 3, 6, 9, 12, 18 cuotas s/i)
	const listByTier: Record<number, number> = {};
	for (const tier of [2, 3, 6, 9, 12, 18] as const) {
		const res = PriceBuilderEngine.calculate({
			providerCost: 10000,
			dolar: 1200,
			config: {
				...baseEcommerceConfig,
				pricingStrategy: {
					...baseEcommerceConfig.pricingStrategy,
					maxInstallmentsToAbsorb: tier
				}
			}
		});
		listByTier[tier] = res.price.listPrice;
		assert.ok(
			res.price.displaySummary.some((d) => d.label.includes(`${tier} cuotas s/i`)),
			`displaySummary must include ${tier} cuotas s/i`
		);
	}
	assert.ok(listByTier[2] < listByTier[3]);
	assert.ok(listByTier[3] < listByTier[6]);
	assert.ok(listByTier[6] < listByTier[9]);
	assert.ok(listByTier[9] < listByTier[12]);
	assert.ok(listByTier[12] < listByTier[18]);

	// 9. defaultAdditionalCosts fallback on undefined vs explicit empty []
	const configWithDefaultCosts = {
		...baseEcommerceConfig,
		defaultAdditionalCosts: [{ concept: 'Packaging base', value: 1500, type: 'fixed', category: 'expense' }]
	};
	const calcInheritDefault = PriceBuilderEngine.calculate({
		providerCost: 10000,
		dolar: 1200,
		config: configWithDefaultCosts
	});
	assert.equal(calcInheritDefault.finance.additionalCosts.length, 1, 'undefined additionalCosts inherits defaultAdditionalCosts');

	const calcExplicitEmpty = PriceBuilderEngine.calculate({
		providerCost: 10000,
		additionalCosts: [],
		dolar: 1200,
		config: configWithDefaultCosts
	});
	assert.equal(calcExplicitEmpty.finance.additionalCosts.length, 0, 'explicit [] additionalCosts overrides defaults');

	// 10. Per-product maxInstallments cap (<= store maxInstallmentsToAbsorb)
	const config12Inst = {
		...baseEcommerceConfig,
		pricingStrategy: {
			...baseEcommerceConfig.pricingStrategy,
			maxInstallmentsToAbsorb: 12
		}
	};
	const prodCap12 = PriceBuilderEngine.calculate({
		providerCost: 10000,
		dolar: 1200,
		config: config12Inst
	});
	const prodCap6 = PriceBuilderEngine.calculate({
		providerCost: 10000,
		dolar: 1200,
		paymentRestrictions: { allowCardPayment: true, allowInterestFreeInstallments: true, maxInstallments: 6 },
		config: config12Inst
	});
	const prodCap3 = PriceBuilderEngine.calculate({
		providerCost: 10000,
		dolar: 1200,
		paymentRestrictions: { allowCardPayment: true, allowInterestFreeInstallments: true, maxInstallments: 3 },
		config: config12Inst
	});
	assert.ok(prodCap3.price.listPrice < prodCap6.price.listPrice);
	assert.ok(prodCap6.price.listPrice < prodCap12.price.listPrice);
	assert.ok(prodCap6.price.displaySummary.some((d) => d.label.includes('6 cuotas s/i')));
	assert.ok(prodCap3.price.displaySummary.some((d) => d.label.includes('3 cuotas s/i')));
	assert.throws(
		() =>
			PriceBuilderEngine.calculate({
				providerCost: 10000,
				dolar: 1200,
				paymentRestrictions: { allowCardPayment: true, allowInterestFreeInstallments: true, maxInstallments: 18 },
				config: config12Inst
			}),
		(err: unknown) => err instanceof AppError && err.statusCode === 400
	);

	// 10. QR commission & activeGateway remain intact when allowCardPayment === false
	const qrNoCardMp = PriceBuilderEngine.calculate({
		providerCost: 10000,
		dolar: 1200,
		paymentRestrictions: { allowCardPayment: false, allowInterestFreeInstallments: false },
		channelPricing: {
			qr: { enabled: true, mode: 'auto', inheritCosts: true }
		},
		config: baseEcommerceConfig
	});
	assert.deepEqual(qrNoCardMp.activeGateway, { key: 'mercadopago', label: 'Mercado Pago' });
	assert.equal(qrNoCardMp.price.channels.qr.enabled, true);
	assert.ok(qrNoCardMp.price.channels.qr.feeLabel.includes('0.80% + IVA = 0.97%'));
	assert.equal(qrNoCardMp.price.channels.debit.enabled, false);
	assert.equal(qrNoCardMp.price.channels.credit1Pay.enabled, false);
	assert.equal(qrNoCardMp.price.channels.list.enabled, false);

	const qrNoCardGetnet = PriceBuilderEngine.calculate({
		providerCost: 10000,
		dolar: 1200,
		paymentRestrictions: { allowCardPayment: false, allowInterestFreeInstallments: false },
		channelPricing: {
			qr: { enabled: true, mode: 'auto', inheritCosts: true }
		},
		config: {
			...baseEcommerceConfig,
			paymentGateways: {
				defaultWebGateway: 'getnet',
				getnet: { active: true, baseCommission: 3.5, qrCommission: 0.8, debitCommission: 1.5, cft3cuotas: 0, cft6Cuotas: 10 }
			}
		}
	});
	assert.deepEqual(qrNoCardGetnet.activeGateway, { key: 'getnet', label: 'Getnet' });
	assert.equal(qrNoCardGetnet.price.channels.qr.feeLabel, 'Comisión Getnet QR: 0.80% + IVA = 0.97%');

	const qrNoGateway = PriceBuilderEngine.calculate({
		providerCost: 10000,
		dolar: 1200,
		paymentRestrictions: { allowCardPayment: false, allowInterestFreeInstallments: false },
		channelPricing: {
			qr: { enabled: true, mode: 'auto', inheritCosts: true }
		},
		config: {
			...baseEcommerceConfig,
			paymentGateways: {
				mercadopago: { active: false },
				getnet: { active: false },
				uala: { active: false }
			}
		}
	});
	assert.equal(qrNoGateway.activeGateway.key, 'none');
	assert.equal(qrNoGateway.price.channels.qr.feeLabel, 'Sin pasarela QR configurada: 0%');

	// 11. Configurable priceRoundingMode ('exact', '10', '50', '100', '500', 'auto')
	const noCostConfig = {
		...baseEcommerceConfig,
		costCurrency: 'ARS' as const,
		defaultAdditionalCosts: [],
		pricingStrategy: {
			...baseEcommerceConfig.pricingStrategy,
			method: 'margin' as const,
			defaultProfitMargin: 30
		}
	};
	// 23500 / 0.70 = 33571.43
	const exactCalc = PriceBuilderEngine.calculate({
		providerCost: 23500,
		dolar: 1,
		priceRoundingMode: 'exact',
		config: noCostConfig
	});
	assert.equal(exactCalc.price.cashPrice, 33571);

	const step10Calc = PriceBuilderEngine.calculate({
		providerCost: 23500,
		dolar: 1,
		priceRoundingMode: '10',
		config: noCostConfig
	});
	assert.equal(step10Calc.price.cashPrice, 33570);

	const step50Calc = PriceBuilderEngine.calculate({
		providerCost: 23500,
		dolar: 1,
		priceRoundingMode: '50',
		config: noCostConfig
	});
	assert.equal(step50Calc.price.cashPrice, 33550);

	const step100Calc = PriceBuilderEngine.calculate({
		providerCost: 23500,
		dolar: 1,
		priceRoundingMode: '100',
		config: noCostConfig
	});
	assert.equal(step100Calc.price.cashPrice, 33600);

	const step500Calc = PriceBuilderEngine.calculate({
		providerCost: 23500,
		dolar: 1,
		priceRoundingMode: '500',
		config: noCostConfig
	});
	assert.equal(step500Calc.price.cashPrice, 33500);

	// Auto tiered rounding: <2000 -> 10, 2000..<10000 -> 50, 10000..<50000 -> 100, >=50000 -> 500
	const autoConfig = {
		...noCostConfig,
		pricingStrategy: {
			...noCostConfig.pricingStrategy,
			priceRoundingMode: 'auto' as const
		}
	};
	// 1000 / 0.70 = 1428.57 -> 1430 (step 10)
	assert.equal(PriceBuilderEngine.calculate({ providerCost: 1000, dolar: 1, config: autoConfig }).price.cashPrice, 1430);
	// 5000 / 0.70 = 7142.86 -> 7150 (step 50)
	assert.equal(PriceBuilderEngine.calculate({ providerCost: 5000, dolar: 1, config: autoConfig }).price.cashPrice, 7150);
	// 23500 / 0.70 = 33571.43 -> 33600 (step 100)
	assert.equal(PriceBuilderEngine.calculate({ providerCost: 23500, dolar: 1, config: autoConfig }).price.cashPrice, 33600);
	// 40000 / 0.70 = 57142.86 -> 57000 (step 500)
	assert.equal(PriceBuilderEngine.calculate({ providerCost: 40000, dolar: 1, config: autoConfig }).price.cashPrice, 57000);

	console.log('✅ All Price Builder Addon tests passed!');
}

runTests();
