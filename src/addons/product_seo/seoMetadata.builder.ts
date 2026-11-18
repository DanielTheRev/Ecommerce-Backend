export interface BuildProductSeoInput {
	product: {
		name: string;
		slug?: string;
		brand?: string;
		barcode?: string;
		shortDescription?: string;
		status?: string;
		netStock?: number;
		images?: Array<{ url?: string }>;
		variants?: Array<{ sku?: string; stock?: number; isActive?: boolean }>;
		price?: {
			listPrice?: number;
			cashTransferPrice?: number;
		};
		seo?: {
			metaTitle?: string;
			metaDescription?: string;
			metaImage?: { url?: string };
		};
	};
	storeName: string;
	baseUrl?: string;
	includeJsonLd?: boolean;
}

export interface ProductSeoMetadataPayload {
	canonicalUrl: string;
	robots: 'index, follow' | 'noindex, nofollow';
	openGraph: Record<string, string | number>;
	twitter: Record<string, string>;
	jsonLd?: Record<string, unknown>;
}

/**
 * Construye automáticamente los metadatos Open Graph, Twitter Cards, robots/canonical
 * y JSON-LD (schema.org/Product) sin intervención manual del comerciante.
 */
export function buildProductSeoMetadata(input: BuildProductSeoInput): ProductSeoMetadataPayload {
	const { product, storeName, baseUrl = '', includeJsonLd = true } = input;
	const cleanBase = baseUrl.replace(/\/+$/, '');
	const slug = (product.slug || '').replace(/^\/+/, '');
	const canonicalUrl = cleanBase ? `${cleanBase}/productos/${slug}` : `/productos/${slug}`;

	const title = (product.seo?.metaTitle || `${product.name} | ${storeName}`).trim();
	const description = (product.seo?.metaDescription || product.shortDescription || product.name).trim().slice(0, 160);
	const primaryImage = product.seo?.metaImage?.url || product.images?.[0]?.url || '';

	const totalStock = Array.isArray(product.variants) && product.variants.length > 0
		? product.variants.filter((v) => v.isActive !== false).reduce((sum, v) => sum + Number(v.stock || 0), 0)
		: Number(product.netStock || 0);
	const inStock = totalStock > 0;
	const availabilityUrl = inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
	const priceAmount = Number(product.price?.cashTransferPrice || product.price?.listPrice || 0);
	const isPublished = (product.status || 'published') === 'published';

	const openGraph: Record<string, string | number> = {
		'og:type': 'product',
		'og:title': title,
		'og:description': description,
		'og:url': canonicalUrl,
		'og:site_name': storeName,
		...(primaryImage ? { 'og:image': primaryImage, 'og:image:width': 1200, 'og:image:height': 630 } : {}),
		...(priceAmount > 0 ? { 'product:price:amount': priceAmount, 'product:price:currency': 'ARS' } : {}),
		'product:availability': inStock ? 'in stock' : 'out of stock',
		...(product.brand ? { 'product:brand': product.brand } : {})
	};

	const twitter: Record<string, string> = {
		'twitter:card': primaryImage ? 'summary_large_image' : 'summary',
		'twitter:title': title,
		'twitter:description': description,
		...(primaryImage ? { 'twitter:image': primaryImage } : {})
	};

	const payload: ProductSeoMetadataPayload = {
		canonicalUrl,
		robots: isPublished ? 'index, follow' : 'noindex, nofollow',
		openGraph,
		twitter
	};

	if (includeJsonLd) {
		const images = (product.images || []).map((i) => i.url).filter((u): u is string => Boolean(u));
		if (primaryImage && !images.includes(primaryImage)) {
			images.unshift(primaryImage);
		}
		const sku = product.barcode || product.variants?.[0]?.sku || slug || undefined;

		payload.jsonLd = {
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: product.name,
			description,
			...(images.length > 0 ? { image: images } : {}),
			...(sku ? { sku } : {}),
			...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
			offers: {
				'@type': 'Offer',
				url: canonicalUrl,
				priceCurrency: 'ARS',
				price: priceAmount,
				availability: availabilityUrl
			}
		};
	}

	return payload;
}
