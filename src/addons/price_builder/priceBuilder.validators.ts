import { z } from 'zod';

const channelKeyEnum = z.enum(['cash', 'transfer', 'qr', 'debit', 'credit1Pay', 'list']);

const costConceptSchema = z.object({
	concept: z.string().trim().min(1),
	type: z.enum(['fixed', 'percent_over_provider', 'percent_over_price']),
	category: z.enum(['expense', 'tax', 'shipping']).default('expense'),
	value: z.number().min(0)
});

const channelRuleSchema = z.object({
	enabled: z.boolean().default(true),
	mode: z.enum(['auto', 'linked', 'discount_from_list', 'fixed']).default('auto'),
	linkedTo: channelKeyEnum.optional(),
	discountPercent: z.number().min(0).max(99).optional(),
	fixedPrice: z.number().min(0).optional(),
	inheritCosts: z.boolean().default(true),
	excludedCostConcepts: z.array(z.string()).optional(),
	extraCosts: z.array(costConceptSchema).optional()
});

export const calculatePreviewSchema = z.object({
	costPrice: z.number().min(0).optional(),
	providerCost: z.number().min(0).optional(),
	pricingMethodChoice: z.enum(['markup', 'margin']).optional(),
	priceRoundingMode: z.enum(['exact', '10', '50', '100', '500', 'auto']).optional(),
	useCustomProfit: z.boolean().optional(),
	customProfitMargin: z.number().min(0).max(99).optional(),
	additionalCosts: z.array(costConceptSchema).optional(),
	paymentRestrictions: z.object({
		allowCardPayment: z.boolean().optional(),
		allowInterestFreeInstallments: z.boolean().optional()
	}).optional(),
	channelPricing: z.object({
		cash: channelRuleSchema.optional(),
		transfer: channelRuleSchema.optional(),
		qr: channelRuleSchema.optional(),
		debit: channelRuleSchema.optional(),
		credit1Pay: channelRuleSchema.optional(),
		list: channelRuleSchema.optional()
	}).optional(),
	dolar: z.number().positive().optional()
});
