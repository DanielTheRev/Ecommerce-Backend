import { TenantModels } from '@/config/modelRegistry';
import { ITenant } from '@/interfaces/tenant.interface';

export class FeedService {
	private constructor() {}

	/**
	 * Genera el feed de productos para Meta Catalog (Facebook / Instagram)
	 * Formatos soportados: 'xml' (Google Merchant / Meta RSS 2.0) y 'csv'
	 */
	public static async generateMetaFeed(
		models: TenantModels,
		tenant: ITenant | undefined,
		format: 'xml' | 'csv' = 'xml'
	): Promise<{ content: string; contentType: string; filename: string }> {
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
				content: this.buildMetaCsv(validProducts),
				contentType: 'text/csv; charset=utf-8',
				filename: 'vura-meta-catalog.csv'
			};
		}

		return {
			content: this.buildMetaXml(validProducts),
			contentType: 'application/xml; charset=utf-8',
			filename: 'vura-meta-catalog.xml'
		};
	}

	/**
	 * Construye el archivo XML en formato RSS 2.0 (Google Merchant / Meta Feed Standard)
	 */
	private static buildMetaXml(products: any[]): string {
		const itemsXml = products
			.map((p) => {
				const id = p._id.toString();
				const title = this.sanitizeText(p.model || p.seo?.metaTitle || 'Prenda Vura');
				const rawDesc = p.description || p.largeDescription || p.seo?.metaDescription || p.model || '';
				const description = this.sanitizeText(this.stripHtml(rawDesc));
				const link = `https://vura.com.ar/products/${p.slug}`;
				const imageLink = p.images[0]?.url || '';
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
        <g:brand>Vura</g:brand>
        <g:condition>new</g:condition>
        <g:availability>${availability}</g:availability>
        <g:price>${priceFormatted}</g:price>${salePriceTag}
        <g:google_product_category>Apparel &amp; Accessories &gt; Clothing</g:google_product_category>
        <g:fb_product_category>Clothing &amp; Accessories &gt; Clothing</g:fb_product_category>
        <g:gender>female</g:gender>
        <g:age_group>adult</g:age_group>
        <g:item_group_id>${id}</g:item_group_id>
      </item>`;
			})
			.join('\n');

		return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Vura - Catálogo Oficial</title>
    <link>https://vura.com.ar</link>
    <description>Catálogo dinámico de productos Vura para Meta Commerce y Google Shopping</description>
${itemsXml}
  </channel>
</rss>`;
	}

	/**
	 * Construye el archivo CSV con las columnas oficiales de Meta
	 */
	private static buildMetaCsv(products: any[]): string {
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
			const title = p.model || p.seo?.metaTitle || 'Prenda Vura';
			const rawDesc = p.description || p.largeDescription || p.seo?.metaDescription || p.model || '';
			const description = this.stripHtml(rawDesc);
			const link = `https://vura.com.ar/products/${p.slug}`;
			const imageLink = p.images[0]?.url || '';

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
				this.escapeCsv('Vura'),
				this.escapeCsv('Apparel & Accessories > Clothing'),
				this.escapeCsv('Clothing & Accessories > Clothing'),
				this.escapeCsv(totalStock),
				this.escapeCsv(salePriceFormatted),
				this.escapeCsv(id),
				this.escapeCsv('female'),
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
