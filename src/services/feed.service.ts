import { TenantModels } from '@/config/modelRegistry';
import { ITenant } from '@/interfaces/tenant.interface';

export class FeedService {
	private constructor() {}

	/**
	 * Resuelve el dominio base del tenant para generar URLs absolutas
	 */
	private static resolveStoreDomain(tenant?: ITenant): string {
		if (tenant?.domain) {
			const clean = tenant.domain.trim().replace(/\/+$/, '');
			return clean.startsWith('http') ? clean : `https://${clean}`;
		}
		const slug = tenant?.slug || 'tienda';
		return `https://${slug}.ganarplata.com`;
	}

	/**
	 * Mapea el tipo de producto / categoría a la taxonomía estándar de Google Merchant / Meta
	 */
	private static resolveGoogleCategory(product: any, tenantBusinessType?: string): string {
		const type = product.productType;
		if (type === 'ClothingProduct' || tenantBusinessType === 'fashion') {
			return 'Apparel & Accessories > Clothing';
		}
		if (type === 'TechProduct' || tenantBusinessType === 'tech_electronics') {
			return 'Electronics';
		}
		if (
			tenantBusinessType === 'kiosk_grocery' ||
			tenantBusinessType === 'gastronomy' ||
			tenantBusinessType === 'butcher' ||
			tenantBusinessType === 'bakery'
		) {
			return 'Food, Beverages & Tobacco';
		}
		return product.category ? `General Merchandise > ${product.category}` : 'General Merchandise';
	}

	/**
	 * Resuelve el valor del campo gender para Meta / Google
	 */
	private static resolveGender(product: any): string {
		if (product.gender) {
			const g = String(product.gender).toLowerCase();
			if (g.includes('hombre') || g === 'male') return 'male';
			if (g.includes('mujer') || g === 'female') return 'female';
			return 'unisex';
		}
		return 'unisex';
	}

	/**
	 * Genera el feed de productos para Meta Catalog (Facebook / Instagram)
	 * Formatos soportados: 'xml' (Google Merchant / Meta RSS 2.0) y 'csv'
	 */
	public static async generateMetaFeed(
		models: TenantModels,
		tenant: ITenant | undefined,
		format: 'xml' | 'csv' = 'xml'
	): Promise<{ content: string; contentType: string; filename: string }> {
		const tenantSlug = tenant?.slug || 'catalogo';

		// Buscamos todos los productos publicados con al menos 1 imagen
		const products = await models.Product.find({
			status: 'published',
			'images.0': { $exists: true }
		}).lean();

		const validProducts = products.filter(
			(p: any) => p.images && p.images.length > 0 && (p.price?.listPrice || p.price?.card_ticket1PayPrice || 0) > 0
		);

		if (format === 'csv') {
			return {
				content: this.buildMetaCsv(validProducts, tenant),
				contentType: 'text/csv; charset=utf-8',
				filename: `${tenantSlug}-meta-catalog.csv`
			};
		}

		return {
			content: this.buildMetaXml(validProducts, tenant),
			contentType: 'application/xml; charset=utf-8',
			filename: `${tenantSlug}-meta-catalog.xml`
		};
	}

	/**
	 * Construye el archivo XML en formato RSS 2.0 (Google Merchant / Meta Feed Standard)
	 */
	private static buildMetaXml(products: any[], tenant?: ITenant): string {
		const storeName = tenant?.name || 'Catálogo Oficial';
		const storeDomain = this.resolveStoreDomain(tenant);

		const itemsXml = products
			.map((p) => {
				const id = p._id.toString();
				const title = this.sanitizeText(p.model || p.seo?.metaTitle || 'Producto');
				const rawDesc = p.description || p.largeDescription || p.seo?.metaDescription || p.model || '';
				const description = this.sanitizeText(this.stripHtml(rawDesc));
				const link = `${storeDomain}/products/${p.slug}`;
				const imageLink = p.images[0]?.url || '';
				const brand = this.sanitizeText(p.brand || storeName);
				const googleCategory = this.resolveGoogleCategory(p, tenant?.businessType);
				const gender = this.resolveGender(p);

				const additionalImages = (p.images.slice(1, 10) as Array<{ url: string }>)
					.map((img) => img?.url)
					.filter(Boolean);

				// Stock total de todas las variantes
				let totalStock = 0;
				if (Array.isArray(p.variants) && p.variants.length > 0) {
					totalStock = p.variants.reduce((acc: number, v: any) => acc + (v.stock || 0), 0);
				} else if (typeof p.stock === 'number') {
					totalStock = p.stock;
				}
				const availability = totalStock > 0 ? 'in stock' : 'out of stock';

				// Precios: Precio de lista oficial y de oferta transferencia si aplica
				const listPrice = p.price?.listPrice || p.price?.card_ticket1PayPrice || 0;
				const transferPrice = p.price?.cashTransferPrice || 0;
				const priceFormatted = `${listPrice.toFixed(2)} ARS`;
				let salePriceTag = '';
				if (transferPrice > 0 && transferPrice < listPrice) {
					salePriceTag = `\n        <g:sale_price>${transferPrice.toFixed(2)} ARS</g:sale_price>`;
				}

				const additionalImagesXml = additionalImages
					.map((url) => `\n        <g:additional_image_link>${this.escapeXml(url)}</g:additional_image_link>`)
					.join('');

				return `      <item>
        <g:id>${id}</g:id>
        <g:title><![CDATA[${title}]]></g:title>
        <g:description><![CDATA[${description}]]></g:description>
        <g:link>${this.escapeXml(link)}</g:link>
        <g:image_link>${this.escapeXml(imageLink)}</g:image_link>${additionalImagesXml}
        <g:brand>${brand}</g:brand>
        <g:condition>new</g:condition>
        <g:availability>${availability}</g:availability>
        <g:price>${priceFormatted}</g:price>${salePriceTag}
        <g:google_product_category>${this.escapeXml(googleCategory)}</g:google_product_category>
        <g:fb_product_category>${this.escapeXml(googleCategory)}</g:fb_product_category>
        <g:gender>${gender}</g:gender>
        <g:age_group>adult</g:age_group>
        <g:item_group_id>${id}</g:item_group_id>
      </item>`;
			})
			.join('\n');

		return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${this.escapeXml(storeName)} - Catálogo Oficial</title>
    <link>${this.escapeXml(storeDomain)}</link>
    <description>Catálogo dinámico de productos de ${this.escapeXml(storeName)} para Meta Commerce y Google Shopping</description>
${itemsXml}
  </channel>
</rss>`;
	}

	/**
	 * Construye el archivo CSV con las columnas oficiales de Meta
	 */
	private static buildMetaCsv(products: any[], tenant?: ITenant): string {
		const storeName = tenant?.name || 'Catálogo Oficial';
		const storeDomain = this.resolveStoreDomain(tenant);

		const headers = [
			'id',
			'title',
			'description',
			'availability',
			'condition',
			'price',
			'link',
			'image_link',
			'brand',
			'google_product_category',
			'fb_product_category',
			'quantity_to_sell_on_facebook',
			'sale_price',
			'item_group_id',
			'gender',
			'age_group'
		];

		const rows = products.map((p) => {
			const id = p._id.toString();
			const title = p.model || p.seo?.metaTitle || 'Producto';
			const rawDesc = p.description || p.largeDescription || p.seo?.metaDescription || p.model || '';
			const description = this.stripHtml(rawDesc);
			const link = `${storeDomain}/products/${p.slug}`;
			const imageLink = p.images[0]?.url || '';
			const brand = p.brand || storeName;
			const googleCategory = this.resolveGoogleCategory(p, tenant?.businessType);
			const gender = this.resolveGender(p);

			let totalStock = 0;
			if (Array.isArray(p.variants) && p.variants.length > 0) {
				totalStock = p.variants.reduce((acc: number, v: any) => acc + (v.stock || 0), 0);
			} else if (typeof p.stock === 'number') {
				totalStock = p.stock;
			}
			const availability = totalStock > 0 ? 'in stock' : 'out of stock';

			const listPrice = p.price?.listPrice || p.price?.card_ticket1PayPrice || 0;
			const transferPrice = p.price?.cashTransferPrice || 0;
			const priceFormatted = `${listPrice.toFixed(2)} ARS`;
			let salePriceFormatted = '';
			if (transferPrice > 0 && transferPrice < listPrice) {
				salePriceFormatted = `${transferPrice.toFixed(2)} ARS`;
			}

			return [
				this.escapeCsv(id),
				this.escapeCsv(title),
				this.escapeCsv(description),
				this.escapeCsv(availability),
				this.escapeCsv('new'),
				this.escapeCsv(priceFormatted),
				this.escapeCsv(link),
				this.escapeCsv(imageLink),
				this.escapeCsv(brand),
				this.escapeCsv(googleCategory),
				this.escapeCsv(googleCategory),
				this.escapeCsv(totalStock),
				this.escapeCsv(salePriceFormatted),
				this.escapeCsv(id),
				this.escapeCsv(gender),
				this.escapeCsv('adult')
			].join(',');
		});

		return [headers.join(','), ...rows].join('\n');
	}

	private static stripHtml(html: string): string {
		if (!html) return '';
		return html
			.replace(/<[^>]*>?/gm, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	private static sanitizeText(text: string): string {
		if (!text) return '';
		// Evitar secuencias que puedan romper CDATA
		return text.replace(/\]\]>/g, ']]&gt;');
	}

	private static escapeXml(unsafe: string): string {
		if (!unsafe) return '';
		return unsafe
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	private static escapeCsv(value: any): string {
		if (value === null || value === undefined) return '""';
		const stringValue = String(value).replace(/"/g, '""');
		return `"${stringValue}"`;
	}
}
