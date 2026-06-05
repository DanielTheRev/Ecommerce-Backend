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

/**
 * Checks if a given state/province name is eligible for free shipping.
 * Only Buenos Aires and Ciudad Autónoma de Buenos Aires qualify.
 */
export function isEligibleForFreeShipping(stateName: string): boolean {
	if (!stateName) return false;
	
	const normalized = stateName.trim().toLowerCase();
	return normalized === 'buenos aires' || normalized === 'ciudad autónoma de buenos aires';
}
