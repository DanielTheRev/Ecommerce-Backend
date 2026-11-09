/**
 * ============================================================================
 * CONFIGURACIÓN CENTRAL DE FORMULARIOS POR RUBRO Y PLAN - VEXX
 * Directorio: src/config/formCapabilities.ts
 * ============================================================================
 */

import { VexxPlanTier } from '@/interfaces/plan.interface';
import { AppError } from '@/errors/app.error';

export interface ProductFormConfig {
	showBarcodeScanner: boolean;
	showPrintBarcodeLabelButton: boolean;
	showWeightScalePrice: boolean;
	showVariantsGrid: boolean;
	showSizeGuideAndFits: boolean;
	showTechSpecs: boolean;
	showBeautyAttributes: boolean;
	showMultiPhotosGallery: boolean;
	showInstallmentsAndListPrice: boolean;
	showWebCatalogOptions: boolean;
	showShopTheLookTags: boolean;
	showSeoFields: boolean;
}

/**
 * Resuelve la visibilidad de campos de formulario para el alta y edición de productos.
 * Utilizado por el Panel Web (@if de Angular) y por la app Android para evitar sobrecarga de campos.
 */
export function resolveProductFormConfig(
	businessType?: string,
	planTier?: string,
	storeAcceptsInstallments: boolean = false
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

	// Base universal: Código de barras siempre disponible (físico o para imprimir etiquetas)
	const config: ProductFormConfig = {
		showBarcodeScanner: true,
		showPrintBarcodeLabelButton: true,
		showWeightScalePrice: false,
		showVariantsGrid: false,
		showSizeGuideAndFits: false,
		showTechSpecs: false,
		showBeautyAttributes: false,
		showMultiPhotosGallery: isPointOrPro,
		showInstallmentsAndListPrice: storeAcceptsInstallments,
		showWebCatalogOptions: isPointOrPro,
		showShopTheLookTags: isPro && normalizedVertical === 'fashion',
		showSeoFields: isPro
	};

	// Ajustes específicos por vertical
	switch (normalizedVertical) {
		case 'kiosk_grocery':
		case 'butcher':
		case 'bakery':
		case 'gastronomy':
			config.showWeightScalePrice = true;
			config.showVariantsGrid = false;
			config.showInstallmentsAndListPrice = false; // Comercios de mostrador rápido no muestran cuotas
			break;

		case 'fashion':
			config.showVariantsGrid = true;
			config.showSizeGuideAndFits = isPointOrPro;
			config.showWeightScalePrice = false;
			break;

		case 'tech_electronics':
			config.showTechSpecs = true;
			config.showWeightScalePrice = false;
			break;

		case 'beauty':
			config.showBeautyAttributes = true;
			config.showWeightScalePrice = false;
			break;

		default:
			throw new AppError(
				'Invalid business type',
				`El rubro comercial '${businessType}' no es reconocido para la configuración de formularios.`,
				500
			);
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
	/** Filtro por link de proveedor (Indumentaria / Moda) */
	showSupplierLinkFilter: boolean;
	/** Filtro por guía de talles (Indumentaria / Moda) */
	showSizeGuideFilter: boolean;
}

/**
 * Resuelve la visibilidad de filtros y pestañas en la vista de lista de productos.
 * Utilizado por el Panel Web y Android para ocultar botones irrelevantes según el plan y rubro.
 */
export function resolveProductListViewConfig(
	businessType?: string,
	planTier?: string
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

	return {
		showEloRankingTab: isPro,
		showImgSeoFilter: isPro,
		showFeaturedFilter: isPointOrPro,
		showSupplierLinkFilter: isPointOrPro && isFashion,
		showSizeGuideFilter: isPointOrPro && isFashion
	};
}
