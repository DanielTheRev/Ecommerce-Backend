/**
 * ============================================================================
 * CONFIGURACIÓN CENTRAL DE FORMULARIOS POR RUBRO Y PLAN - VEXX
 * Directorio: src/config/formCapabilities.ts
 * ============================================================================
 */

import { VexxPlanTier } from '@/interfaces/plan.interface';
import { AppError } from '@/errors/app.error';
import { MEDIA_STUDIO_DEFAULT_LIMITS } from '@/addons/media_studio';

export type VariantMode = 'fashion' | 'tech' | 'presentation';

export interface ProductVariantFormConfig {
	variantMode: VariantMode;
	allowPerVariantPrice: boolean;
	allowPerVariantMargin: boolean;
	showColorColumn: boolean;
	showSizeColumn: boolean;
	showVolumeColumn: boolean;
	showAttributesColumn: boolean;
}

export interface ProductSizeGuideTemplateItem {
	id: string;
	name: string;
	headers: string[];
	defaultRows: string[];
	tolerance?: string;
	isDefault?: boolean;
}

export interface ProductSizeGuideFormConfig {
	addonEnabled: boolean;
	allowCustomColumns: boolean;
	showToleranceField: boolean;
	templates: ProductSizeGuideTemplateItem[];
}

export interface ProductSpecFieldSchema {
	key: string;
	inputType: 'text' | 'select';
	required: boolean;
	options?: string[];
	optionsSource?: string;
	allowMerchantAddOption?: boolean;
	allowFeatured?: boolean;
	placeholder?: string;
}

export interface ProductDetailsFormConfig {
	addonEnabled: boolean;
	showSpecifications: boolean;
	showCareInstructions: boolean;
	showTags: boolean;
	showFeatures: boolean;
	allowBulkPaste: boolean;
	suggestedSpecKeys: string[];
	suggestedCareChips: string[];
	specFields: ProductSpecFieldSchema[];
}

export interface ProductWebCatalogFormConfig {
	addonEnabled: boolean;
	showStatusSelector: boolean;
	showFeaturedToggle: boolean;
}

export interface ProductSeoFormConfig {
	addonEnabled: boolean;
	showSeoFields: boolean;
	showMetaImage: boolean;
	showSlugEditor: boolean;
	enableJsonLd: boolean;
}

export interface ProductCrossSellFormConfig {
	addonEnabled: boolean;
	allowVariantSelection: boolean;
	maxItems: number;
	showInStorefront: boolean;
}

export interface ProductGalleryFormConfig {
	addonEnabled: boolean;
	maxImages: number;
	defaultQuality: number;
	enableCropper: boolean;
	allowedAspectRatios: string[];
	enableVariantTagging: boolean;
	autoOptimizeWebP: boolean;
	idStrategy: 'vexx-uuid-agnostic';
}

export interface ProductDescriptionFormConfig {
	addonEnabled: boolean;
	showSubtitle: boolean;
	showShortDescription: boolean;
	showRichDescription: boolean;
}

export interface ProductFormLabels {
	name: string;
	category: string;
	brand: string;
	barcode: string;
	supplier: string;
	variantsTitle: string;
	weightTitle: string;
	specsTitle: string;
	bundleTitle: string;
}

export interface ProductFormPlaceholders {
	name: string;
	category: string;
	brand: string;
	barcode: string;
}

export interface ProductFormConfig {
	// 1. Hardware e Identificación
	showBarcodeScanner: boolean;
	showPrintBarcodeLabelButton: boolean;
	showMasterCatalogLookup: boolean;
	showSupplierSelector: boolean;

	// 2. Balanza y Pesables ($/Kg, Docenas, etc.)
	showWeightScalePrice: boolean;
	allowedWeighableUnits?: readonly string[];
	weighableConfig?: {
		addonEnabled: boolean;
		defaultUnit: string;
		pluBarcodePrefix?: string;
		allowFractionalVariants: boolean;
		allowedUnits: readonly string[];
	};

	// 3. Matriz de Variantes (Talles/Color en Moda, Almacenamiento en Tech, Presentaciones en Kiosco/Verdulería)
	showVariantsGrid: boolean;
	showSizeGuideAndFits: boolean;
	variantConfig: ProductVariantFormConfig;
	sizeGuideConfig: ProductSizeGuideFormConfig;

	// 4. Ficha Técnica / Details Builder (Clave-Valor reutilizable + ⭐ isFeatured + Cuidados + Tags)
	showSpecifications: boolean;
	detailsConfig: ProductDetailsFormConfig;

	// 5. Galería de Fotos y Media Studio
	showMultiPhotosGallery: boolean;
	maxImagesAllowed: number;
	allowVariantImageLinking: boolean;
	allowedAspectRatios: string[];
	galleryConfig: ProductGalleryFormConfig;

	// 5.5 Description Builder (Subtítulo, Descripción Corta y HTML Storytelling)
	descriptionConfig: ProductDescriptionFormConfig;

	// 6. Precios y Canales de Cobro
	showInstallmentsAndListPrice: boolean;

	// 7. Catálogo Digital y Visibilidad
	showWebCatalogOptions: boolean;
	webCatalogConfig: ProductWebCatalogFormConfig;

	// 8. Combos y Paquetes Comerciales (Point y Pro)
	showProductBundleOptions: boolean;
	bundleLabel: string;
	crossSellConfig: ProductCrossSellFormConfig;

	// 9. SEO y Posicionamiento en Buscadores (Exclusivo Pro)
	showSeoFields: boolean;
	seoConfig: ProductSeoFormConfig;

	// 10. Semántica dinámica por rubro + customLabels (Cero hardcoding en Front)
	labels: ProductFormLabels;
	placeholders: ProductFormPlaceholders;
}

interface VerticalCopyDefaults {
	bundleLabel: string;
	variantsTitle: string;
	weightTitle: string;
	nameLabel: string;
	namePlaceholder: string;
	categoryPlaceholder: string;
	brandPlaceholder: string;
	barcodePlaceholder: string;
}

const DEFAULT_VERTICAL_COPY: VerticalCopyDefaults = {
	bundleLabel: 'Packs & Promos',
	variantsTitle: 'Variantes & Stock',
	weightTitle: 'Venta por Peso / Fraccionado',
	nameLabel: 'Nombre / Modelo del producto',
	namePlaceholder: 'Ej: Producto ejemplo...',
	categoryPlaceholder: 'Ej: Categoría principal...',
	brandPlaceholder: 'Marca o fabricante',
	barcodePlaceholder: 'Ej: SKU-0001'
};

const VERTICAL_COPY_MAP: Record<string, VerticalCopyDefaults> = {
	kiosk_grocery: {
		bundleLabel: 'Packs & Promos',
		variantsTitle: 'Presentaciones',
		weightTitle: 'Balanza & Fraccionado ($/Kg)',
		nameLabel: 'Nombre del producto',
		namePlaceholder: 'Ej: Coca Cola 1.5L, Alfajor Triple, Yerba 1Kg...',
		categoryPlaceholder: 'Ej: Bebidas, Golosinas, Almacén...',
		brandPlaceholder: 'Ej: Coca-Cola, Arcor, Taragüi...',
		barcodePlaceholder: '7791234567890'
	},
	fashion: {
		bundleLabel: 'Shop The Look / Outfits',
		variantsTitle: 'Talles, Colores & Guía',
		weightTitle: 'Presentación por Unidad',
		nameLabel: 'Nombre / Modelo de la prenda',
		namePlaceholder: 'Ej: Remera Oversize, Jean Cargo, Camperita Puffer...',
		categoryPlaceholder: 'Ej: Remeras, Pantalones, Calzado...',
		brandPlaceholder: 'Ej: Vura, Marca propia...',
		barcodePlaceholder: 'Ej: SKU-REM-001'
	},
	tech_electronics: {
		bundleLabel: 'Kits & Combos Tech',
		variantsTitle: 'Almacenamiento, Color & Versiones',
		weightTitle: 'Presentación por Unidad',
		nameLabel: 'Modelo / Equipo',
		namePlaceholder: 'Ej: iPhone 15 128GB, Cargador USB-C 20W...',
		categoryPlaceholder: 'Ej: Smartphones, Audio, Accesorios...',
		brandPlaceholder: 'Ej: Apple, Samsung, Xiaomi...',
		barcodePlaceholder: 'Ej: IMEI / EAN / SKU-TECH-01'
	},
	butcher: {
		bundleLabel: 'Combos Parrilleros & Packs',
		variantsTitle: 'Presentaciones & Packs',
		weightTitle: 'Cortes por Kilo ($/Kg) & Balanza',
		nameLabel: 'Corte / Producto',
		namePlaceholder: 'Ej: Bife de Chorizo, Vacío, Milanesas de Nalga...',
		categoryPlaceholder: 'Ej: Vacunos, Cerdo, Pollo, Achuras...',
		brandPlaceholder: 'Ej: Frigorífico / Elaboración propia...',
		barcodePlaceholder: 'Ej: PLU / Código balanza'
	},
	bakery: {
		bundleLabel: 'Promos & Meriendas',
		variantsTitle: 'Presentaciones & Tamaños',
		weightTitle: 'Venta por Kilo / Docena',
		nameLabel: 'Producto de panadería',
		namePlaceholder: 'Ej: Medialunas de Manteca, Pan Francés, Torta...',
		categoryPlaceholder: 'Ej: Facturas, Panificados, Pastelería...',
		brandPlaceholder: 'Ej: Elaboración propia...',
		barcodePlaceholder: 'Ej: PLU / SKU-PAN-01'
	},
	gastronomy: {
		bundleLabel: 'Menús & Combos',
		variantsTitle: 'Tamaños & Porciones',
		weightTitle: 'Venta por Peso / Porción',
		nameLabel: 'Plato / Bebida',
		namePlaceholder: 'Ej: Hamburguesa Doble Cheddar, Pizza Muzzarella...',
		categoryPlaceholder: 'Ej: Burgers, Pizzas, Bebidas, Postres...',
		brandPlaceholder: 'Ej: Cocina propia...',
		barcodePlaceholder: 'Ej: SKU-MENU-01'
	}
};

function getVerticalCopy(normalizedVertical: string, customLabels: Record<string, string>): VerticalCopyDefaults {
	const base = VERTICAL_COPY_MAP[normalizedVertical] || DEFAULT_VERTICAL_COPY;
	return {
		...base,
		bundleLabel: customLabels.bundleTitle || base.bundleLabel,
		variantsTitle: customLabels.variantsTitle || base.variantsTitle,
		weightTitle: customLabels.weightTitle || base.weightTitle
	};
}

/**
 * Resuelve la visibilidad de campos de formulario para el alta y edición de productos.
 * Utilizado por el Panel Web (@if de Angular) y por la app Android para evitar sobrecarga de campos.
 */
export interface VerticalPresetFormOverride {
	variantMode?: VariantMode;
	variantColumns?: Partial<Omit<ProductVariantFormConfig, 'variantMode'>>;
	defaultAspectRatios?: string[];
	descriptionSettings?: {
		showSubtitle?: boolean;
		showShortDescription?: boolean;
		showRichDescription?: boolean;
	};
	mediaSettings?: {
		defaultQuality?: number;
		maxImagesPerProduct?: number;
		enableCropper?: boolean;
		enableVariantTagging?: boolean;
		allowedAspectRatios?: string[];
	};
	variantSettings?: {
		allowPerVariantPrice?: boolean;
		allowPerVariantMargin?: boolean;
		showColorColumn?: boolean;
		showSizeColumn?: boolean;
		showVolumeColumn?: boolean;
		showAttributesColumn?: boolean;
	};
	sizeGuideSettings?: {
		allowCustomColumns?: boolean;
		showToleranceField?: boolean;
	};
	detailsSettings?: {
		showSpecifications?: boolean;
		showCareInstructions?: boolean;
		showTags?: boolean;
		showFeatures?: boolean;
		allowBulkPaste?: boolean;
		suggestedSpecKeysCsv?: string;
		suggestedCareChipsCsv?: string;
		specFieldsJson?: string;
	};
	webCatalogSettings?: {
		showStatusSelector?: boolean;
		showFeaturedToggle?: boolean;
	};
	seoSettings?: {
		showSeoFields?: boolean;
		showMetaImage?: boolean;
		showSlugEditor?: boolean;
		enableJsonLd?: boolean;
	};
	crossSellSettings?: {
		allowVariantSelection?: boolean;
		maxItems?: number;
		showInStorefront?: boolean;
	};
	weighableSettings?: {
		defaultUnit?: string;
		pluBarcodePrefix?: string;
		allowFractionalVariants?: boolean;
	};
}

function parseCsvList(raw?: string): string[] {
	if (!raw || typeof raw !== 'string') return [];
	return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseSpecFieldSchemas(raw?: string): ProductSpecFieldSchema[] {
	if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && typeof (item as any).key === 'string' && (item as any).key.trim()))
			.map((item) => ({
				key: String(item.key).trim(),
				inputType: item.inputType === 'select' ? 'select' : 'text',
				required: Boolean(item.required),
				...(Array.isArray(item.options) ? { options: item.options.map((o) => String(o).trim()).filter(Boolean) } : {}),
				...(typeof item.optionsSource === 'string' && item.optionsSource.trim() ? { optionsSource: item.optionsSource.trim() } : {}),
				...(item.allowMerchantAddOption !== undefined ? { allowMerchantAddOption: Boolean(item.allowMerchantAddOption) } : {}),
				...(item.allowFeatured !== undefined ? { allowFeatured: Boolean(item.allowFeatured) } : {}),
				...(typeof item.placeholder === 'string' && item.placeholder.trim() ? { placeholder: item.placeholder.trim() } : {})
			}));
	} catch {
		return [];
	}
}

export const ECOMMERCE_NATIVE_LIST_KEYS = new Set(['clothingFits', 'brands', 'categories']);
export const VALID_LIST_KEY_REGEX = /^[a-zA-Z0-9_]+$/;

export function parseEcommerceOptionsSource(optionsSource?: string): string | null {
	if (!optionsSource || typeof optionsSource !== 'string') return null;
	const trimmed = optionsSource.trim();
	if (!trimmed.startsWith('ecommerce.')) return null;
	const key = trimmed.slice('ecommerce.'.length);
	return VALID_LIST_KEY_REGEX.test(key) ? key : null;
}

export function getEcommerceListValues(storeConfig: any, optionsSource?: string): string[] {
	const listKey = parseEcommerceOptionsSource(optionsSource);
	if (!listKey || !storeConfig) return [];
	if (ECOMMERCE_NATIVE_LIST_KEYS.has(listKey)) {
		return Array.isArray(storeConfig[listKey]) ? storeConfig[listKey] : [];
	}
	const custom = storeConfig.customLists;
	if (!custom || typeof custom !== 'object') return [];
	const val = custom instanceof Map ? custom.get(listKey) : custom[listKey];
	return Array.isArray(val) ? val : [];
}

export function mergeUniqueOptionLists(...lists: Array<readonly string[] | undefined>): string[] {
	const seenLower = new Set<string>();
	const merged: string[] = [];
	for (const list of lists) {
		if (!Array.isArray(list)) continue;
		for (const raw of list) {
			const trimmed = String(raw || '').trim();
			if (!trimmed) continue;
			const lower = trimmed.toLowerCase();
			if (!seenLower.has(lower)) {
				seenLower.add(lower);
				merged.push(trimmed);
			}
		}
	}
	return merged;
}

export function resolveProductFormConfig(
	businessType?: string,
	planTier?: string,
	storeAcceptsInstallments: boolean = false,
	activeAddons?: string[],
	customLabels: Record<string, string> = {},
	presetOverride?: VerticalPresetFormOverride
): ProductFormConfig {
	if (!planTier || !planTier.trim()) {
		throw new AppError(
			'Plan tier required',
			'El plan de suscripción (planTier) es obligatorio para resolver la configuración de formularios.',
			500
		);
	}
	if (!businessType || !businessType.trim()) {
		throw new AppError(
			'Business type required',
			'El rubro comercial (businessType) es obligatorio para resolver la configuración de formularios.',
			500
		);
	}

	const normalizedPlan = planTier.trim().toLowerCase() as VexxPlanTier;
	if (!Object.values(VexxPlanTier).includes(normalizedPlan)) {
		throw new AppError(
			'Invalid plan tier',
			`El plan '${planTier}' no es válido para resolver formularios. Planes admitidos: ${Object.values(VexxPlanTier).join(', ')}`,
			500
		);
	}

	const normalizedVertical = businessType.trim().toLowerCase();

	const isPro = normalizedPlan === VexxPlanTier.PRO;
	const isPointOrPro = normalizedPlan === VexxPlanTier.POINT || isPro;

	const variantMode: VariantMode = presetOverride?.variantMode
		? presetOverride.variantMode
		: normalizedVertical === 'fashion'
			? 'fashion'
			: normalizedVertical === 'tech_electronics'
				? 'tech'
				: 'presentation';

	// Límites de fotos y ratios según plan / Media Studio
	const maxImagesAllowed = MEDIA_STUDIO_DEFAULT_LIMITS[normalizedPlan] ?? 10;
	const defaultQuality = presetOverride?.mediaSettings?.defaultQuality ?? 100;
	const allowedAspectRatios =
		Array.isArray(presetOverride?.defaultAspectRatios) && presetOverride.defaultAspectRatios.length > 0
			? presetOverride.defaultAspectRatios
			: isPointOrPro
				? ['original', '1:1', '9:16', '16:9']
				: ['original', '1:1'];

	const copy = getVerticalCopy(normalizedVertical, customLabels);
	const bundleLabel = copy.bundleLabel;

	// Configuración limpia universal
	const config: ProductFormConfig = {
		showBarcodeScanner: true,
		showPrintBarcodeLabelButton: true,
		showMasterCatalogLookup: false,
		showSupplierSelector: isPointOrPro || normalizedPlan === VexxPlanTier.LOCAL,
		showWeightScalePrice: false,
		showVariantsGrid: false,
		showSizeGuideAndFits: false,
		variantConfig: {
			variantMode,
			allowPerVariantPrice: presetOverride?.variantColumns?.allowPerVariantPrice ?? true,
			allowPerVariantMargin: presetOverride?.variantColumns?.allowPerVariantMargin ?? true,
			showColorColumn: presetOverride?.variantColumns?.showColorColumn ?? (variantMode === 'fashion' || variantMode === 'tech'),
			showSizeColumn: presetOverride?.variantColumns?.showSizeColumn ?? (variantMode === 'fashion'),
			showVolumeColumn: presetOverride?.variantColumns?.showVolumeColumn ?? (variantMode === 'presentation'),
			showAttributesColumn: presetOverride?.variantColumns?.showAttributesColumn ?? (variantMode === 'tech')
		},
		sizeGuideConfig: {
			addonEnabled: normalizedVertical === 'fashion' && isPointOrPro,
			allowCustomColumns: presetOverride?.sizeGuideSettings?.allowCustomColumns ?? true,
			showToleranceField: presetOverride?.sizeGuideSettings?.showToleranceField ?? true,
			templates: []
		},
		showSpecifications: true,
		detailsConfig: {
			addonEnabled: true,
			showSpecifications: presetOverride?.detailsSettings?.showSpecifications ?? true,
			showCareInstructions: presetOverride?.detailsSettings?.showCareInstructions ?? false,
			showTags: presetOverride?.detailsSettings?.showTags ?? true,
			showFeatures: presetOverride?.detailsSettings?.showFeatures ?? false,
			allowBulkPaste: presetOverride?.detailsSettings?.allowBulkPaste ?? true,
			suggestedSpecKeys: parseCsvList(presetOverride?.detailsSettings?.suggestedSpecKeysCsv),
			suggestedCareChips: parseCsvList(presetOverride?.detailsSettings?.suggestedCareChipsCsv),
			specFields: parseSpecFieldSchemas(presetOverride?.detailsSettings?.specFieldsJson)
		},
		showMultiPhotosGallery: true,
		maxImagesAllowed,
		allowVariantImageLinking: isPointOrPro,
		allowedAspectRatios,
		galleryConfig: {
			addonEnabled: isPointOrPro,
			maxImages: maxImagesAllowed,
			defaultQuality,
			enableCropper: isPointOrPro,
			allowedAspectRatios,
			enableVariantTagging: false,
			autoOptimizeWebP: true,
			idStrategy: 'vexx-uuid-agnostic'
		},
		descriptionConfig: {
			addonEnabled: isPointOrPro || normalizedVertical === 'fashion' || normalizedVertical === 'tech_electronics',
			showSubtitle: isPointOrPro || normalizedVertical === 'fashion' || normalizedVertical === 'tech_electronics',
			showShortDescription: isPointOrPro || normalizedVertical === 'fashion' || normalizedVertical === 'tech_electronics',
			showRichDescription: isPointOrPro || normalizedVertical === 'fashion' || normalizedVertical === 'tech_electronics'
		},
		showInstallmentsAndListPrice: storeAcceptsInstallments,
		showWebCatalogOptions: isPointOrPro,
		webCatalogConfig: {
			addonEnabled: isPointOrPro,
			showStatusSelector: presetOverride?.webCatalogSettings?.showStatusSelector ?? isPointOrPro,
			showFeaturedToggle: presetOverride?.webCatalogSettings?.showFeaturedToggle ?? isPointOrPro
		},
		showProductBundleOptions: isPointOrPro,
		bundleLabel,
		crossSellConfig: {
			addonEnabled: isPointOrPro,
			allowVariantSelection: presetOverride?.crossSellSettings?.allowVariantSelection ?? true,
			maxItems: presetOverride?.crossSellSettings?.maxItems ?? 8,
			showInStorefront: presetOverride?.crossSellSettings?.showInStorefront ?? isPointOrPro
		},
		showSeoFields: isPointOrPro,
		seoConfig: {
			addonEnabled: isPointOrPro,
			showSeoFields: presetOverride?.seoSettings?.showSeoFields ?? isPointOrPro,
			showMetaImage: presetOverride?.seoSettings?.showMetaImage ?? isPointOrPro,
			showSlugEditor: presetOverride?.seoSettings?.showSlugEditor ?? isPointOrPro,
			enableJsonLd: presetOverride?.seoSettings?.enableJsonLd ?? isPro
		},
		labels: {
			name: copy.nameLabel,
			category: 'Categoría',
			brand: 'Marca (opcional)',
			barcode: 'Código de barras / SKU',
			supplier: 'Proveedor (opcional)',
			variantsTitle: copy.variantsTitle,
			weightTitle: copy.weightTitle,
			specsTitle: customLabels.specsTitle || 'Ficha Técnica & Especificaciones',
			bundleTitle: bundleLabel
		},
		placeholders: {
			name: copy.namePlaceholder,
			category: copy.categoryPlaceholder,
			brand: copy.brandPlaceholder,
			barcode: copy.barcodePlaceholder
		}
	};

	// Ajustes específicos por vertical
	switch (normalizedVertical) {
		case 'kiosk_grocery':
		case 'butcher':
		case 'bakery':
		case 'gastronomy':
			config.showWeightScalePrice = true;
			config.allowedWeighableUnits = ['kg', 'g', 'docena', 'un', 'l', 'ml'];
			config.showVariantsGrid = false;
			config.showInstallmentsAndListPrice = false; // Comercios de mostrador rápido no muestran cuotas
			break;

		case 'fashion':
			config.showVariantsGrid = true;
			config.showSizeGuideAndFits = isPointOrPro;
			config.showWeightScalePrice = false;
			break;

		case 'tech_electronics':
			config.showVariantsGrid = true; // Celulares / notebooks tienen variantes de almacenamiento y color
			config.showWeightScalePrice = false;
			break;

		case 'beauty':
			config.showVariantsGrid = true; // Perfumes tienen 50ml/100ml y cosméticos tonos
			config.showWeightScalePrice = false;
			break;

		default:
			if (presetOverride) {
				config.showVariantsGrid = true;
				config.showWeightScalePrice = false;
				break;
			}
			throw new AppError(
				'Invalid business type',
				`El rubro comercial '${businessType}' no es reconocido para la configuración de formularios.`,
				500
			);
	}

	// Gobierno autoritativo basado en complementos (Addons) cuando activeAddons está definido
	if (activeAddons !== undefined) {
		const addonSet = new Set(activeAddons.map((id) => id.trim().toLowerCase()));
		const hasBundles = addonSet.has('product_bundles') || addonSet.has('combos');
		const hasWeb = addonSet.has('web_catalog') || addonSet.has('ecommerce_web');
		const hasEcommerce = addonSet.has('ecommerce_web');
		const hasSeo = addonSet.has('product_seo') || addonSet.has('seo_pro') || hasEcommerce;
		const hasCrossSell = addonSet.has('cross_sell_studio') || addonSet.has('cross_sell') || addonSet.has('shop_the_look');
		const hasVariants = addonSet.has('variants') || addonSet.has('variant_studio');
		const hasMediaStudio = addonSet.has('media_studio') || addonSet.has('product_gallery');
		const hasDescriptions = addonSet.has('product_descriptions') || addonSet.has('description_builder');
		const hasDetails = addonSet.has('details_builder') || addonSet.has('tech_specs') || addonSet.has('product_details');
		const hasSizeGuide = addonSet.has('size_guide');
		const hasWeighable = addonSet.has('weighable');

		config.showSupplierSelector = addonSet.has('suppliers');
		config.showMasterCatalogLookup = config.showBarcodeScanner && addonSet.has('master_catalog');
		config.detailsConfig = {
			addonEnabled: hasDetails,
			showSpecifications: hasDetails && (presetOverride?.detailsSettings?.showSpecifications ?? true),
			showCareInstructions: hasDetails && (presetOverride?.detailsSettings?.showCareInstructions ?? false),
			showTags: hasDetails && (presetOverride?.detailsSettings?.showTags ?? true),
			showFeatures: hasDetails && (presetOverride?.detailsSettings?.showFeatures ?? false),
			allowBulkPaste: hasDetails && (presetOverride?.detailsSettings?.allowBulkPaste ?? true),
			suggestedSpecKeys: hasDetails ? parseCsvList(presetOverride?.detailsSettings?.suggestedSpecKeysCsv) : [],
			suggestedCareChips: hasDetails ? parseCsvList(presetOverride?.detailsSettings?.suggestedCareChipsCsv) : [],
			specFields: hasDetails ? parseSpecFieldSchemas(presetOverride?.detailsSettings?.specFieldsJson) : []
		};
		config.showSpecifications = config.detailsConfig.addonEnabled && config.detailsConfig.showSpecifications;
		config.showVariantsGrid = hasVariants;
		config.sizeGuideConfig = {
			addonEnabled: hasSizeGuide,
			allowCustomColumns: hasSizeGuide && (presetOverride?.sizeGuideSettings?.allowCustomColumns ?? true),
			showToleranceField: hasSizeGuide && (presetOverride?.sizeGuideSettings?.showToleranceField ?? true),
			templates: []
		};
		config.showSizeGuideAndFits = hasSizeGuide;
		config.allowVariantImageLinking = hasVariants && (hasMediaStudio || isPointOrPro);
		config.descriptionConfig = {
			addonEnabled: hasDescriptions,
			showSubtitle: hasDescriptions && (presetOverride?.descriptionSettings?.showSubtitle ?? true),
			showShortDescription: hasDescriptions && (presetOverride?.descriptionSettings?.showShortDescription ?? true),
			showRichDescription: hasDescriptions && (presetOverride?.descriptionSettings?.showRichDescription ?? true)
		};
		config.variantConfig = {
			...config.variantConfig,
			allowPerVariantPrice: presetOverride?.variantSettings?.allowPerVariantPrice ?? config.variantConfig.allowPerVariantPrice,
			allowPerVariantMargin: presetOverride?.variantSettings?.allowPerVariantMargin ?? config.variantConfig.allowPerVariantMargin,
			showColorColumn: presetOverride?.variantSettings?.showColorColumn ?? config.variantConfig.showColorColumn,
			showSizeColumn: presetOverride?.variantSettings?.showSizeColumn ?? config.variantConfig.showSizeColumn,
			showVolumeColumn: presetOverride?.variantSettings?.showVolumeColumn ?? config.variantConfig.showVolumeColumn,
			showAttributesColumn: presetOverride?.variantSettings?.showAttributesColumn ?? config.variantConfig.showAttributesColumn,
		};
		const resolvedMaxImages = hasMediaStudio
			? (presetOverride?.mediaSettings?.maxImagesPerProduct ?? maxImagesAllowed)
			: Math.min(3, maxImagesAllowed);
		const resolvedRatios = hasMediaStudio
			? (presetOverride?.mediaSettings?.allowedAspectRatios?.length ? presetOverride.mediaSettings.allowedAspectRatios : allowedAspectRatios)
			: ['original', '1:1'];
		config.galleryConfig = {
			addonEnabled: hasMediaStudio,
			maxImages: resolvedMaxImages,
			defaultQuality,
			enableCropper: hasMediaStudio && (presetOverride?.mediaSettings?.enableCropper ?? isPointOrPro),
			allowedAspectRatios: resolvedRatios,
			enableVariantTagging: hasVariants && (presetOverride?.mediaSettings?.enableVariantTagging ?? true),
			autoOptimizeWebP: true,
			idStrategy: 'vexx-uuid-agnostic'
		};
		config.maxImagesAllowed = config.galleryConfig.maxImages;
		config.allowedAspectRatios = config.galleryConfig.allowedAspectRatios;
		config.showWeightScalePrice = hasWeighable;
		if (hasWeighable && !config.allowedWeighableUnits) {
			config.allowedWeighableUnits = ['kg', 'g', 'docena', 'un', 'l', 'ml'];
		}
		config.weighableConfig = {
			addonEnabled: hasWeighable,
			defaultUnit: presetOverride?.weighableSettings?.defaultUnit || 'kg',
			pluBarcodePrefix: presetOverride?.weighableSettings?.pluBarcodePrefix,
			allowFractionalVariants: hasWeighable && (presetOverride?.weighableSettings?.allowFractionalVariants ?? true),
			allowedUnits: config.allowedWeighableUnits || ['kg', 'g', 'docena', 'un', 'l', 'ml']
		};
		config.showProductBundleOptions = hasBundles;
		config.crossSellConfig = {
			addonEnabled: hasCrossSell,
			allowVariantSelection: hasCrossSell && (presetOverride?.crossSellSettings?.allowVariantSelection ?? true),
			maxItems: hasCrossSell ? (presetOverride?.crossSellSettings?.maxItems ?? 8) : 0,
			showInStorefront: hasCrossSell && (presetOverride?.crossSellSettings?.showInStorefront ?? true)
		};
		config.webCatalogConfig = {
			addonEnabled: hasWeb,
			showStatusSelector: hasWeb && (presetOverride?.webCatalogSettings?.showStatusSelector ?? true),
			showFeaturedToggle: hasWeb && (presetOverride?.webCatalogSettings?.showFeaturedToggle ?? true)
		};
		config.showWebCatalogOptions = config.webCatalogConfig.addonEnabled;
		config.seoConfig = {
			addonEnabled: hasSeo,
			showSeoFields: hasSeo && (presetOverride?.seoSettings?.showSeoFields ?? true),
			showMetaImage: hasSeo && (presetOverride?.seoSettings?.showMetaImage ?? true),
			showSlugEditor: hasSeo && (presetOverride?.seoSettings?.showSlugEditor ?? true),
			enableJsonLd: hasSeo && (presetOverride?.seoSettings?.enableJsonLd ?? isPro)
		};
		config.showSeoFields = config.seoConfig.addonEnabled && config.seoConfig.showSeoFields;
		config.showInstallmentsAndListPrice = addonSet.has('price_builder') || addonSet.has('installments_cft');
	}

	return config;
}

export interface ProductListViewConfig {
	/** Pestaña de Ranking ELO en la tabla de productos (Exclusivo Pro / Tienda Web) */
	showEloRankingTab: boolean;
	/** Filtro por estado de Imagen SEO (Exclusivo Pro / Tienda Web) */
	showImgSeoFilter: boolean;
	/** Filtro por productos destacados (Point y Pro) */
	showFeaturedFilter: boolean;
	/** Filtro por link de proveedor (Indumentaria / Moda con addon suppliers) */
	showSupplierLinkFilter: boolean;
	/** Filtro por proveedor en la tabla de productos (Addon suppliers) */
	showSupplierFilter: boolean;
	/** Filtro por guía de talles (Indumentaria / Moda con addon variants) */
	showSizeGuideFilter: boolean;
	/** Filtro por productos pesables / balanza (Addon weighable) */
	showWeighableFilter: boolean;

	// === NUEVAS PESTAÑAS ARMONIZADAS ===
	/** Pestaña de Conjuntos de Datos / Filtros Dinámicos (Point y Pro / Addon data_sets) */
	showDataSetsTab: boolean;
	/** Pestaña de Conjuntos de Productos / Combos (Point y Pro / Addon product_bundles) */
	showProductBundlesTab: boolean;
	/** Etiqueta semántica para la pestaña de combos/conjuntos */
	bundleTabLabel: string;
	/** Desbloqueo de filtros por métricas en tiempo real en DataSets (Exclusivo Pro / Addon metric_datasets) */
	allowMetricFiltersInDataSets: boolean;
}

/**
 * Resuelve la visibilidad de filtros y pestañas en la vista de lista de productos.
 * Utilizado por el Panel Web y Android para ocultar botones irrelevantes según addons, plan y rubro.
 */
export function resolveProductListViewConfig(
	businessType?: string,
	planTier?: string,
	activeAddons?: string[],
	customLabels: Record<string, string> = {}
): ProductListViewConfig {
	if (!planTier || !planTier.trim()) {
		throw new AppError('Plan tier required', 'El planTier es obligatorio para resolver la vista de productos.', 500);
	}
	if (!businessType || !businessType.trim()) {
		throw new AppError('Business type required', 'El businessType es obligatorio para resolver la vista de productos.', 500);
	}

	const normalizedPlan = planTier.trim().toLowerCase() as VexxPlanTier;
	const normalizedVertical = businessType.trim().toLowerCase();

	const isPro = normalizedPlan === VexxPlanTier.PRO;
	const isPointOrPro = normalizedPlan === VexxPlanTier.POINT || isPro;
	const isFashion = normalizedVertical === 'fashion';
	const bundleTabLabel = getVerticalCopy(normalizedVertical, customLabels).bundleLabel;

	if (activeAddons !== undefined) {
		const addonSet = new Set(activeAddons.map((id) => id.trim().toLowerCase()));
		const hasEcommerce = addonSet.has('ecommerce_web');
		const hasWeb = addonSet.has('web_catalog') || hasEcommerce;
		const hasSuppliers = addonSet.has('suppliers');
		const hasVariants = addonSet.has('variants');
		const hasWeighable = addonSet.has('weighable');
		const hasBundles = addonSet.has('product_bundles') || addonSet.has('combos');

		return {
			showEloRankingTab: hasEcommerce,
			showImgSeoFilter: hasEcommerce,
			showFeaturedFilter: hasWeb,
			showSupplierLinkFilter: hasSuppliers && isFashion,
			showSupplierFilter: hasSuppliers,
			showSizeGuideFilter: hasVariants && isFashion,
			showWeighableFilter: hasWeighable,
			showDataSetsTab: addonSet.has('data_sets'),
			showProductBundlesTab: hasBundles,
			bundleTabLabel,
			allowMetricFiltersInDataSets: addonSet.has('metric_datasets') || hasEcommerce
		};
	}

	return {
		showEloRankingTab: isPro,
		showImgSeoFilter: isPro,
		showFeaturedFilter: isPointOrPro,
		showSupplierLinkFilter: isPointOrPro && isFashion,
		showSupplierFilter: true,
		showSizeGuideFilter: isPointOrPro && isFashion,
		showWeighableFilter: normalizedVertical !== 'fashion' && normalizedVertical !== 'tech_electronics',
		showDataSetsTab: isPointOrPro,
		showProductBundlesTab: isPointOrPro,
		bundleTabLabel,
		allowMetricFiltersInDataSets: isPro
	};
}
