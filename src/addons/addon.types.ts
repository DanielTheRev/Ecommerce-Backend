import { ZodType } from 'zod';
import { PlanCapabilities, VexxPlanTier } from '@/interfaces/plan.interface';

export type AddonCategory =
	| 'operaciones'
	| 'producto'
	| 'marketing'
	| 'fiscal'
	| 'web_storefront'
	| 'tracking';

export type AddonSurface =
	| 'admin_form'
	| 'admin_module'
	| 'pos'
	| 'storefront_section'
	| 'tracker';

export type AddonImplementationStatus = 'ready' | 'draft';

export type AddonImpactDomain =
	| 'product_form'
	| 'product_pricing'
	| 'storefront_prices'
	| 'checkout'
	| 'shipping'
	| 'pos'
	| 'inventory'
	| 'fiscal'
	| 'media';

export type AddonProductFormSlotKey =
	| 'scanner_lookup'
	| 'supplier'
	| 'descriptions'
	| 'pricing'
	| 'inventory_unit'
	| 'media_gallery'
	| 'variants'
	| 'specs'
	| 'bundles'
	| 'catalog_visibility'
	| 'seo'
	| 'expirations';

export interface AddonProductFormSlotTarget {
	slot: AddonProductFormSlotKey;
	mode: 'replace' | 'extend';
	componentKey: string;
}

export interface AddonInteractionTarget {
	target: string;
	behavior: string;
}

export interface AddonTargets {
	domains: readonly AddonImpactDomain[];
	productFormSlots?: readonly AddonProductFormSlotTarget[];
	adminScreens?: readonly string[];
	storefrontBlocks?: readonly string[];
	interactions?: readonly AddonInteractionTarget[];
}

export interface AddonConfigurableLabel {
	key: string;
	label: string;
	description?: string;
	defaultValue: string;
	surface?: AddonSurface;
}

export interface AddonConfigurableSetting {
	key: string;
	label: string;
	description?: string;
	type: 'boolean' | 'string' | 'number';
	defaultValue: unknown;
}

export interface AddonManifest {
	id: string;
	aliases?: readonly string[];
	name: string;
	shortDescription: string;
	category: AddonCategory;
	icon: string;
	implementationStatus: AddonImplementationStatus;
	includedInPlans: readonly VexxPlanTier[];
	isPurchasable: boolean;
	monthlyPriceARS: number;
	surfaces: readonly AddonSurface[];
	grantsCapabilities: readonly (keyof PlanCapabilities)[];
	requiresSetup: boolean;
	targets?: AddonTargets;
	configurableLabels?: readonly AddonConfigurableLabel[];
	configurableSettings?: readonly AddonConfigurableSetting[];
	settingsRoute?: string;
	settingsSchema?: ZodType;
}

export interface AddonHooks {
	beforeProductValidate?: (
		payload: Record<string, unknown>,
		settings?: Record<string, unknown>
	) => void | Promise<void>;
}

export interface AddonModule {
	manifest: AddonManifest;
	hooks?: AddonHooks;
}

export interface PublicAddonCatalogItem {
	id: string;
	name: string;
	shortDescription: string;
	category: AddonCategory;
	icon: string;
	implementationStatus: AddonImplementationStatus;
	includedInPlans: readonly VexxPlanTier[];
	isPurchasable: boolean;
	monthlyPriceARS: number;
	surfaces: readonly AddonSurface[];
	grantsCapabilities: readonly (keyof PlanCapabilities)[];
	requiresSetup: boolean;
	targets?: AddonTargets;
	configurableLabels?: readonly AddonConfigurableLabel[];
	configurableSettings?: readonly AddonConfigurableSetting[];
	settingsRoute?: string;
}

export interface TenantAddonItem extends PublicAddonCatalogItem {
	isActive: boolean;
	isConfigured: boolean;
	status: 'active' | 'pending_setup' | 'available';
	settings?: Record<string, unknown>;
	labels?: Record<string, string>;
}
