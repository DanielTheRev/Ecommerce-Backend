import { VexxPlanTier } from './plan.interface';
import { TenantBusinessType } from './tenant.interface';

export const TEMPLATE_ENGINE_TYPES = ['astro', 'angular', 'custom'] as const;
export type TemplateEngineType = (typeof TEMPLATE_ENGINE_TYPES)[number];

export const TEMPLATE_PRICING_TYPES = [
	'included_in_plan',
	'monthly_addon',
	'one_time_purchase',
	'custom_quote'
] as const;
export type TemplatePricingType = (typeof TEMPLATE_PRICING_TYPES)[number];

export const TEMPLATE_CHECKOUT_MODES = [
	'whatsapp_and_pickup',
	'full_ecommerce',
	'hybrid'
] as const;
export type TemplateCheckoutMode = (typeof TEMPLATE_CHECKOUT_MODES)[number];

export const TEMPLATE_KINDS = ['mobile_catalog', 'full_website'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const TEMPLATE_DOMAIN_MODES = ['vexx_subdomain', 'custom_domain'] as const;
export type TenantDomainMode = (typeof TEMPLATE_DOMAIN_MODES)[number];

export interface ITemplateCustomizableField {
	key: string;
	label: string;
	type: 'string' | 'boolean' | 'select' | 'color';
	defaultValue: string | boolean;
	options?: string[];
	description?: string;
}

export interface IStorefrontTemplate {
	_id?: string;
	key: string;
	name: string;
	shortDescription: string;
	longDescription?: string;
	engine: TemplateEngineType;
	checkoutMode: TemplateCheckoutMode;
	/** Tipo comercial: catálogo móvil minimalista (POINT) vs tienda web completa (PRO) */
	templateKind?: TemplateKind;
	thumbnailUrl: string;
	previewUrl?: string;
	minPlanTier: VexxPlanTier;
	supportedBusinessTypes: (TenantBusinessType | '*')[];
	pricingType: TemplatePricingType;
	/** Precio principal en ARS según pricingType (0 si es included_in_plan) */
	priceARS: number;
	/** Precio mensual opcional en ARS (para plantillas/páginas web con abono mensual) */
	monthlyPriceARS?: number;
	/** Precio único de activación/desarrollo opcional en ARS */
	oneTimePriceARS?: number;
	features: string[];
	customizableFields: ITemplateCustomizableField[];
	isDefaultForPlan?: Record<string, boolean>;
	isDefaultForBusinessType?: Record<string, boolean>;
	isActive: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface ITenantStorefrontSummary {
	domainMode: TenantDomainMode;
	vexxSubdomain: string;
	vexxSubdomainUrl: string;
	customDomain?: string;
	customDomainUrl?: string;
	primaryStorefrontUrl: string;
	hasCustomDomainCapability: boolean;
	activeTemplateKey?: string;
	activeTemplateName?: string;
	activeTemplateEngine?: TemplateEngineType;
	activeTemplateCheckoutMode?: TemplateCheckoutMode;
	unlockedTemplates: string[];
	templateSettings: Record<string, unknown>;
}
