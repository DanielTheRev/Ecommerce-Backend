export interface IProvince {
	nombre: string;
	capital: string;
}

export const ARGENTINA_PROVINCES: IProvince[] = [
	{
		"nombre": "Buenos Aires",
		"capital": "La Plata"
	},
	{
		"nombre": "Catamarca",
		"capital": "San Fernando del Valle de Catamarca"
	},
	{
		"nombre": "Chaco",
		"capital": "Resistencia"
	},
	{
		"nombre": "Chubut",
		"capital": "Rawson"
	},
	{
		"nombre": "Ciudad Autónoma de Buenos Aires",
		"capital": "CABA"
	},
	{
		"nombre": "Córdoba",
		"capital": "Córdoba"
	},
	{
		"nombre": "Corrientes",
		"capital": "Corrientes"
	},
	{
		"nombre": "Entre Ríos",
		"capital": "Paraná"
	},
	{
		"nombre": "Formosa",
		"capital": "Formosa"
	},
	{
		"nombre": "Jujuy",
		"capital": "San Salvador de Jujuy"
	},
	{
		"nombre": "La Pampa",
		"capital": "Santa Rosa"
	},
	{
		"nombre": "La Rioja",
		"capital": "La Rioja"
	},
	{
		"nombre": "Mendoza",
		"capital": "Mendoza"
	},
	{
		"nombre": "Misiones",
		"capital": "Posadas"
	},
	{
		"nombre": "Neuquén",
		"capital": "Neuquén"
	},
	{
		"nombre": "Río Negro",
		"capital": "Viedma"
	},
	{
		"nombre": "Salta",
		"capital": "Salta"
	},
	{
		"nombre": "San Juan",
		"capital": "San Juan"
	},
	{
		"nombre": "San Luis",
		"capital": "San Luis"
	},
	{
		"nombre": "Santa Cruz",
		"capital": "Río Gallegos"
	},
	{
		"nombre": "Santa Fe",
		"capital": "Santa Fe de la Vera Cruz"
	},
	{
		"nombre": "Santiago del Estero",
		"capital": "Santiago del Estero"
	},
	{
		"nombre": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
		"capital": "Ushuaia"
	},
	{
		"nombre": "Tucumán",
		"capital": "San Miguel de Tucumán"
	}
];

// List of province names for validation
export const ARGENTINA_PROVINCE_NAMES = ARGENTINA_PROVINCES.map(p => p.nombre);

export enum ShippingZone {
	CABA = 'caba',
	BUENOS_AIRES = 'buenosAires',
	INTERIOR = 'interior'
}

/**
 * Detects the shipping zone based on the province/state name or postal code.
 */
export function detectShippingZone(stateOrProvince: string, zipCode?: string): ShippingZone {
	if (zipCode) {
		const numericCP = parseInt(zipCode.replace(/\D/g, ''), 10);
		if (!isNaN(numericCP)) {
			if (numericCP >= 1000 && numericCP <= 1499) return ShippingZone.CABA;
			if ((numericCP >= 1500 && numericCP <= 1999) || (numericCP >= 2700 && numericCP <= 2999) || (numericCP >= 6000 && numericCP <= 8999)) {
				return ShippingZone.BUENOS_AIRES;
			}
		}
	}

	if (!stateOrProvince) return ShippingZone.INTERIOR;

	const normalized = stateOrProvince
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, ''); // Remover tildes

	if (
		normalized === 'caba' ||
		normalized.includes('capital federal') ||
		normalized.includes('ciudad autonoma de buenos aires')
	) {
		return ShippingZone.CABA;
	}

	if (normalized.includes('buenos aires') || normalized === 'gba') {
		return ShippingZone.BUENOS_AIRES;
	}

	return ShippingZone.INTERIOR;
}

/**
 * Legacy check: if state qualifies for province-level free shipping.
 */
export function isEligibleForFreeShipping(stateName: string): boolean {
	if (!stateName) return false;
	const zone = detectShippingZone(stateName);
	return zone === ShippingZone.CABA || zone === ShippingZone.BUENOS_AIRES;
}

export interface IDynamicShippingCalculationParams {
	subtotal: number;
	itemCount: number;
	accumulatedSubsidy: number;
	stateOrProvince: string;
	zipCode?: string;
	shippingConfig?: {
		freeShippingThreshold?: number;
		defaultItemSubsidy?: number;
		minShippingFloor?: number;
		zoneRates?: {
			caba?: number;
			buenosAires?: number;
			interior?: number;
		};
	};
}

export interface IDynamicShippingCalculationResult {
	zone: ShippingZone;
	zoneBaseRate: number;
	accumulatedSubsidy: number;
	isFreeShipping: boolean;
	minShippingFloor: number;
	finalShippingCost: number;
}

/**
 * Calculates the dynamic shipping cost applying zone rates, item subsidies,
 * free shipping thresholds, and the credibility floor price.
 */
export function calculateDynamicShippingCost(
	params: IDynamicShippingCalculationParams
): IDynamicShippingCalculationResult {
	const {
		subtotal,
		itemCount,
		accumulatedSubsidy,
		stateOrProvince,
		zipCode,
		shippingConfig
	} = params;

	const threshold = shippingConfig?.freeShippingThreshold ?? 80000;
	const minShippingFloor = shippingConfig?.minShippingFloor ?? 5000;
	const zoneRates = {
		caba: shippingConfig?.zoneRates?.caba ?? 8900,
		buenosAires: shippingConfig?.zoneRates?.buenosAires ?? 9900,
		interior: shippingConfig?.zoneRates?.interior ?? 11900
	};

	const zone = detectShippingZone(stateOrProvince, zipCode);
	const zoneBaseRate = zoneRates[zone];

	// 1. Umbral de Envío Gratis
	if (subtotal >= threshold) {
		return {
			zone,
			zoneBaseRate,
			accumulatedSubsidy,
			isFreeShipping: true,
			minShippingFloor,
			finalShippingCost: 0
		};
	}

	// 2. Cálculo con subsidio y piso de credibilidad
	const effectiveSubsidy = accumulatedSubsidy > 0 ? accumulatedSubsidy : (itemCount * (shippingConfig?.defaultItemSubsidy ?? 4000));
	const rawCost = zoneBaseRate - effectiveSubsidy;
	const finalShippingCost = Math.max(rawCost, minShippingFloor);

	return {
		zone,
		zoneBaseRate,
		accumulatedSubsidy: effectiveSubsidy,
		isFreeShipping: false,
		minShippingFloor,
		finalShippingCost
	};
}
