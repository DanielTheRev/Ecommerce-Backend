import { IProduct } from '@/interfaces/product.interface';

export class ProductDisplayService {
	/**
	 * Clasifica automáticamente la categoría de un producto en una zona corporal macro para indumentaria,
	 * o retorna la categoría directa normalizada para otros rubros (Tech, Beauty, General).
	 */
	public static getApparelZone(category?: string, _productType?: string): string {
		if (!category) return 'other';
		const normalized = category
			.toLowerCase()
			.trim()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');

		// Top / Parte Superior (Plano medio/torso)
		const topKeywords = [
			'remera', 'remeras', 't-shirt', 't-shirts', 'tshirt', 'tshirts',
			'top', 'tops', 'crop top', 'crop tops', 'musculosa', 'musculosas',
			'camisa', 'camisas', 'blusa', 'blusas', 'camisola', 'camisolas',
			'chomba', 'chombas', 'body', 'bodys'
		];
		if (topKeywords.some((k) => normalized === k || normalized.includes(k))) {
			return 'top';
		}

		// Bottom / Parte Inferior (Plano entero / piernas)
		const bottomKeywords = [
			'pantalon', 'pantalones', 'jean', 'jeans', 'denim',
			'short', 'shorts', 'bermuda', 'bermudas', 'baggy', 'baggies',
			'jogger', 'joggers', 'cargo', 'cargos', 'calza', 'calzas',
			'palazzo', 'palazzos', 'slack', 'slacks', 'falda', 'faldas',
			'pollera', 'polleras', 'minifalda', 'minifaldas'
		];
		if (bottomKeywords.some((k) => normalized === k || normalized.includes(k))) {
			return 'bottom';
		}

		// Outerwear / Abrigo / Capas intermedias
		const outerwearKeywords = [
			'abrigo', 'abrigos', 'campera', 'camperas', 'camperon', 'camperones',
			'sweater', 'sweaters', 'sueter', 'sueteres', 'cardigan', 'cardigans',
			'buzo', 'buzos', 'hoodie', 'hoodies', 'polera', 'poleras', 'poleron', 'polerones',
			'chaqueta', 'chaquetas', 'tapado', 'tapados', 'parka', 'parkas',
			'chaleco', 'chalecos', 'saco', 'sacos', 'blazer', 'blazers',
			'trench', 'anorak', 'anoraks', 'camisaco', 'camisacos'
		];
		if (outerwearKeywords.some((k) => normalized === k || normalized.includes(k))) {
			return 'outerwear';
		}

		// Full Body / Enteritos / Vestidos
		const fullBodyKeywords = [
			'vestido', 'vestidos', 'mono', 'monos', 'enterito', 'enteritos',
			'jumpsuit', 'jumpsuits', 'traje', 'trajes'
		];
		if (fullBodyKeywords.some((k) => normalized === k || normalized.includes(k))) {
			return 'full_body';
		}

		// Calzado / Accesorios
		const otherApparelKeywords = [
			'calzado', 'calzados', 'zapatilla', 'zapatillas', 'sneaker', 'sneakers',
			'zapato', 'zapatos', 'bota', 'botas', 'sandalia', 'sandalias', 'accesorio', 'accesorios'
		];
		if (otherApparelKeywords.some((k) => normalized === k || normalized.includes(k))) {
			return 'other';
		}

		// Si no es indumentaria (ej: Tech, Belleza) o no matchea palabras clave de ropa,
		// retorna la categoría normalizada para permitir interleaving multirubro por categoría.
		return normalized || 'other';
	}

	/**
	 * Desdobla virtualmente los productos que tienen múltiples variantes de color
	 * para que cada color se exponga como una tarjeta independiente en el catálogo.
	 */
	public static splitProductsByColor<T extends IProduct>(products: T[], filterSize?: string): T[] {
		if (!products || products.length === 0) return products;

		const result: T[] = [];
		const targetSizes = filterSize
			? filterSize
					.split(',')
					.map((s) => s.trim().toLowerCase())
					.filter(Boolean)
			: [];

		for (const product of products) {
			if (!product.variants || product.variants.length <= 1) {
				result.push(product);
				continue;
			}

			// Agrupar variantes activas por color
			const colorGroups = new Map<string, { name: string; hex: string; imageRef?: any; variants: any[] }>();

			for (const variant of product.variants) {
				if (variant.isActive === false) continue;

				let colorName = '';
				let colorHex = '#000000';
				let imageRef = (variant as any).imageReference;

				if ((variant as any).color && (variant as any).color.name) {
					colorName = String((variant as any).color.name).trim();
					colorHex = (variant as any).color.hex || '#000000';
				} else if ((variant as any).colorName) {
					colorName = String((variant as any).colorName).trim();
					colorHex = (variant as any).colorHex || '#000000';
				}

				if (!colorName) continue;

				const key = colorName.toLowerCase();
				if (!colorGroups.has(key)) {
					colorGroups.set(key, { name: colorName, hex: colorHex, imageRef, variants: [] });
				}
				const group = colorGroups.get(key)!;
				group.variants.push(variant);
				if (!group.imageRef && imageRef) {
					group.imageRef = imageRef;
				}
			}

			// Si el producto no tiene colores definidos o tiene 1 solo color, lo dejamos intacto
			if (colorGroups.size <= 1) {
				result.push(product);
				continue;
			}

			// Desdoblar en tarjetas virtuales por color
			for (const group of colorGroups.values()) {
				if (targetSizes.length > 0) {
					const hasMatchingSize = group.variants.some((v) => {
						const sz = String(v.size || '')
							.trim()
							.toLowerCase();
						return targetSizes.includes(sz) && Number(v.stock || 0) > 0 && v.isActive !== false;
					});
					if (!hasMatchingSize) continue;
				}

				let productImages = product.images ? [...product.images] : [];
				if (group.imageRef && group.imageRef.url) {
					const matchingIdx = productImages.findIndex(
						(img) => img.url === group.imageRef.url || img.public_id === group.imageRef.public_id
					);
					if (matchingIdx > 0) {
						productImages = [
							productImages[matchingIdx],
							...productImages.slice(0, matchingIdx),
							...productImages.slice(matchingIdx + 1)
						];
					} else if (matchingIdx === -1) {
						productImages = [
							{ url: group.imageRef.url, public_id: group.imageRef.public_id || 'variant-img' },
							...productImages
						];
					}
				}

				const virtualProduct: any = {
					...product,
					_id: `${product._id}_c_${group.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
					parentProductId: String(product._id),
					selectedColor: group.name,
					selectedColorHex: group.hex,
					images: productImages,
					variants: group.variants,
					virtualVariant: true
				};

				result.push(virtualProduct);
			}
		}

		return result;
	}

	/**
	 * Algoritmo de Entrelazado y Cadencia Visual (Visual Merchandising Interleaving)
	 * con soporte de Anti-Clustering (dispersión de variantes del mismo producto).
	 * Alterna los productos en un patrón rítmico armónico [TOP -> BOTTOM -> OUTERWEAR -> BOTTOM...]
	 * evitando que productos con el mismo ID padre queden pegados uno al lado del otro.
	 */
	public static interleaveProducts<
		T extends { _id?: any; parentProductId?: any; category?: string; productType?: string }
	>(
		products: T[],
		options: { antiClusterDistance?: number } = {}
	): T[] {
		if (!products || products.length <= 2) return products;

		const antiClusterDistance = options.antiClusterDistance ?? 3;
		const buckets: Record<string, T[]> = {};
		const bucketKeysOrder: string[] = [];

		for (const p of products) {
			const zone = this.getApparelZone(p.category, p.productType);
			if (!buckets[zone]) {
				buckets[zone] = [];
				bucketKeysOrder.push(zone);
			}
			buckets[zone].push(p);
		}

		// Si todos los productos pertenecen a una única categoría o zona, mantener buckets
		const preferredOrder = ['top', 'bottom', 'outerwear', 'bottom', 'full_body', 'other'];
		const activePreferred = preferredOrder.filter((z) => buckets[z] && buckets[z].length > 0);
		const remainingBuckets = bucketKeysOrder.filter((k) => !preferredOrder.includes(k));
		const sequencePattern =
			activePreferred.length > 0 ? [...activePreferred, ...remainingBuckets] : bucketKeysOrder;

		if (sequencePattern.length === 0) {
			return products;
		}

		const result: T[] = [];
		let remainingCount = products.length;
		let patternIndex = 0;

		const getRootId = (item: T): string => {
			if (item.parentProductId) return String(item.parentProductId);
			const idStr = String(item._id || '');
			return idStr.split('_')[0] || idStr;
		};

		const pickBestFromBucket = (bucket: T[]): T | null => {
			if (bucket.length === 0) return null;
			const recentRootIds = result.slice(-antiClusterDistance).map(getRootId);
			const nonConflictingIndex = bucket.findIndex(
				(item) => !recentRootIds.includes(getRootId(item))
			);
			if (nonConflictingIndex !== -1) {
				return bucket.splice(nonConflictingIndex, 1)[0];
			}
			return bucket.shift()!;
		};

		while (remainingCount > 0) {
			let addedInRound = false;
			for (let i = 0; i < sequencePattern.length; i++) {
				const currentKey = sequencePattern[(patternIndex + i) % sequencePattern.length];
				const bucket = buckets[currentKey];
				if (bucket && bucket.length > 0) {
					const item = pickBestFromBucket(bucket);
					if (item) {
						result.push(item);
						remainingCount--;
						addedInRound = true;
					}
				}
			}

			// Fallback de seguridad: si en una ronda completa no se pudo agregar por anti-clustering,
			// forzar agregar del primer bucket disponible
			if (!addedInRound) {
				for (const key of sequencePattern) {
					const bucket = buckets[key];
					if (bucket && bucket.length > 0) {
						result.push(bucket.shift()!);
						remainingCount--;
						addedInRound = true;
						break;
					}
				}
			}

			patternIndex = (patternIndex + 1) % sequencePattern.length;
		}

		return result;
	}
}
