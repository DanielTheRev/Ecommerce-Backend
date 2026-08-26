export interface IDolarQuote {
	moneda: string;
	casa: string;
	nombre: string;
	compra: number;
	venta: number;
	fechaActualizacion: string;
}

// In-memory cache with 10 minutes TTL
let cachedDolares: IDolarQuote[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const getAllDolares = async (forceRefresh = false): Promise<IDolarQuote[]> => {
	const now = Date.now();
	if (!forceRefresh && cachedDolares && (now - lastCacheTime < CACHE_TTL_MS)) {
		return cachedDolares;
	}

	try {
		const response = await fetch('https://dolarapi.com/v1/dolares');
		if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

		const data: IDolarQuote[] = await response.json();
		if (Array.isArray(data) && data.length > 0) {
			cachedDolares = data;
			lastCacheTime = now;
			return data;
		}
		throw new Error('Formato inválido de cotizaciones');
	} catch (error) {
		if (cachedDolares) {
			return cachedDolares; // Fallback to stale cache if available
		}
		// Fallback emergency default if API is completely down
		return [
			{ moneda: 'USD', casa: 'oficial', nombre: 'Oficial', compra: 1000, venta: 1050, fechaActualizacion: new Date().toISOString() },
			{ moneda: 'USD', casa: 'blue', nombre: 'Blue', compra: 1400, venta: 1420, fechaActualizacion: new Date().toISOString() },
			{ moneda: 'USD', casa: 'bolsa', nombre: 'Bolsa (MEP)', compra: 1380, venta: 1390, fechaActualizacion: new Date().toISOString() },
			{ moneda: 'USD', casa: 'ccl', nombre: 'Contado con Liquidación', compra: 1410, venta: 1425, fechaActualizacion: new Date().toISOString() },
			{ moneda: 'USD', casa: 'tarjeta', nombre: 'Tarjeta', compra: 1600, venta: 1680, fechaActualizacion: new Date().toISOString() },
			{ moneda: 'USD', casa: 'mayorista', nombre: 'Mayorista', compra: 1020, venta: 1030, fechaActualizacion: new Date().toISOString() },
			{ moneda: 'USD', casa: 'cripto', nombre: 'Cripto', compra: 1415, venta: 1430, fechaActualizacion: new Date().toISOString() }
		];
	}
};

export const getDolar = async (quoteType: string = 'oficial', customRate: number = 0) => {
	// If custom rate is chosen and provided
	if (quoteType === 'custom' && customRate > 0) {
		return { compra: customRate, venta: customRate };
	}

	const dolares = await getAllDolares();
	const normalizedType = quoteType.toLowerCase();
	const match = dolares.find(d => d.casa.toLowerCase() === normalizedType) 
		|| dolares.find(d => d.casa.toLowerCase() === 'oficial') 
		|| dolares[0];

	return {
		compra: match.compra || match.venta || 1000,
		venta: match.venta || match.compra || 1000
	};
};
