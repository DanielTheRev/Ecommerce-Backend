import { PriceRoundingMode, PricingMethod } from '@/interfaces/ecommerce.interface';
import { ICostConcept, IProductFinance, IPricingInsight } from '@/interfaces/product.interface';

export type ChannelKey = 'cash' | 'transfer' | 'qr' | 'debit' | 'credit1Pay' | 'list';
export type ChannelRuleMode = 'auto' | 'linked' | 'discount_from_list' | 'fixed';
export type ChannelSurface = 'all' | 'web' | 'pos';
export type PricingPresetKey = '2_prices' | '3_prices' | '6_channels';

export type WebSettlementTerm = 'instant' | '10d' | '18d' | '35d';
export type QrDebitSettlementTerm = 'instant' | '2d';
export type QrCreditSettlementTerm = 'instant' | '10d';
export type GatewayEnvironment = 'sandbox' | 'production';
export type MpCheckoutMode = 'pro' | 'bricks' | 'hybrid';
export type CredentialSource = 'oauth' | 'manual';

export interface IPriceBuilderChannelRule {
	enabled: boolean;
	mode: ChannelRuleMode;
	linkedTo?: ChannelKey;
	discountPercent?: number;
	fixedPrice?: number;
	inheritCosts: boolean;
	excludedCostConcepts?: string[];
	extraCosts?: ICostConcept[];
}

export type IPriceBuilderChannelPricing = Partial<Record<ChannelKey, IPriceBuilderChannelRule>>;

export interface IPriceBuilderChannelSnapshot {
	enabled: boolean;
	price: number;
	mode: ChannelRuleMode;
	inheritCosts: boolean;
	linkedTo?: ChannelKey;
	discountPercent?: number;
	excludedCostConcepts?: string[];
	extraCosts?: ICostConcept[];
	costBaseARS: number;
	feeLabel: string;
	netProfit: number;
	netMarginPercent: number;
	isWarningLoss: boolean;
	isBelowTargetMargin: boolean;
	surface: ChannelSurface;
}

export interface IDisplaySummaryItem {
	label: string;
	price: number;
	channels: ChannelKey[];
	surface: ChannelSurface;
}

export interface IPriceBuilderInsight extends IPricingInsight {
	suggestedFix?: {
		label: string;
		expensiveCh: ChannelKey;
		cheapCh: ChannelKey;
		suggestedPrice: number;
	};
}

/**
 * Punto de extensión futuro para descuentos escalonados por cantidad (bulk / tier pricing).
 */
export interface IQuantityPriceTier {
	minQuantity: number;
	discountPercent: number;
	unitPrice?: number;
}

export interface IPaymentRestrictions {
	allowCardPayment: boolean;
	allowInterestFreeInstallments: boolean;
	/** Techo opcional por producto (<= maxInstallmentsToAbsorb de la tienda). */
	maxInstallments?: number;
}

export interface IMercadoPagoSurfaceConfig {
	active: boolean;
	environment: GatewayEnvironment;
	checkoutMode: MpCheckoutMode;
	oauth?: {
		connected: boolean;
		mpUserId?: string | null;
		refreshToken?: string;
		tokenExpiresAt?: Date | string;
	};
	credentials?: {
		production?: {
			credentialSource?: CredentialSource;
			publicKey?: string;
			accessToken?: string;
			webhookSecret?: string;
		};
		sandbox?: {
			publicKey?: string;
			accessToken?: string;
			webhookSecret?: string;
		};
	};
	storefrontChannels?: {
		minimalCatalog?: {
			environment: GatewayEnvironment;
			checkoutMode: MpCheckoutMode;
			sandboxToken?: string;
		};
		webTemplate?: {
			environment: GatewayEnvironment;
			checkoutMode: MpCheckoutMode;
			sandboxToken?: string;
		};
		customWeb?: {
			environment: GatewayEnvironment;
			liveApiKey?: string;
			testApiKey?: string;
		};
	};
	maxInstallments?: number;
	excludedPaymentMethods?: string[];
	excludedPaymentTypes?: string[];
	customRatesOverride?: boolean;
	webCheckout?: {
		settlementTerm: WebSettlementTerm;
		baseCommission: number;
		cft2cuotas: number;
		cft3cuotas: number;
		cft6Cuotas: number;
		cft9cuotas?: number;
		cft12cuotas?: number;
		cft18cuotas?: number;
		/** Reservado para futuro: monto mínimo de compra para ofrecer cuotas s/i (espejo de la regla en MP). */
		minAmountForInstallments?: number;
	};
	qr?: {
		allowCardsInQr: boolean;
		accountMoneyCommission: number;
		debitTerm: QrDebitSettlementTerm;
		debitCommission: number;
		creditTerm: QrCreditSettlementTerm;
		creditCommission: number;
		prepaidCommission: number;
	};
	posPoint?: {
		debitCommission: number;
		creditCommission: number;
		prepaidCommission: number;
		pixCommission: number;
	};
	// Legacy flat fields (retrocompatibilidad con configs previas)
	publicKey?: string;
	accessToken?: string;
	webhookSecret?: string;
	baseCommission?: number;
	qrCommission?: number;
	debitCommission?: number;
	cft3cuotas?: number;
	cft6Cuotas?: number;
	cft12cuotas?: number;
}

export interface IPriceBuilderCalculateInput {
	providerCost: number;
	additionalCosts?: ICostConcept[];
	discountPercentageTransfer?: number;
	channelPricing?: IPriceBuilderChannelPricing;
	paymentRestrictions?: Partial<IPaymentRestrictions>;
	useCustomProfit?: boolean;
	customProfitMargin?: number;
	pricingMethodChoice?: PricingMethod;
	priceRoundingMode?: PriceRoundingMode;
	dolar: number;
	config: any;
}

export interface IPriceBuilderCalculateResult {
	activeGateway: { key: string; label: string };
	price: {
		listPrice: number;
		card_ticket1PayPrice: number;
		cashTransferPrice: number;
		cashPrice: number;
		transferPrice: number;
		qrPrice: number;
		debitPrice: number;
		shippingSubsidy: number;
		channels: Record<ChannelKey, IPriceBuilderChannelSnapshot>;
		displaySummary: IDisplaySummaryItem[];
		updatedAt: Date;
		installments: {
			threePaymentsAmount: number;
			sixPaymentsAmount: number;
			hasThreeInstallmentsSeamless: boolean;
			hasSixInstallmentsSeamless: boolean;
		};
	};
	finance: IProductFinance;
	insights: IPriceBuilderInsight[];
}

export interface ISanitizedPublicStoreConfig {
	gateway: string;
	environment: GatewayEnvironment;
	isTestMode: boolean;
	publicKey: string;
	checkoutMode: MpCheckoutMode;
	maxInstallments: number;
	absorbInstallments: boolean;
	excludedPaymentMethods: string[];
	excludedPaymentTypes: string[];
}
