import { IBrandSection, IHomeConfig, IHomeOffer } from '@/interfaces/home.interface';
import { IProduct } from '@/interfaces/product.interface';
import { ProductService } from './product.service';
import { BannerService } from './banner.service';
import { HeroService } from './hero.service';
import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { BentoService } from './bento.service';
import { ShopTheLookService } from './shopTheLook.service';
import { EcommerceService } from './ecommerce.service';

export class HomeService {
	private static readonly offers: IHomeOffer[] = [
		{
			icon: 'credit-card',
			title: 'Financiación',
			description: '3 y 6  cuotas sin interés',
			details: 'En todos los productos',
			gradient: 'from-primary/20 to-primary/5',
			iconBg: 'bg-primary/10',
			iconColor: 'text-primary'
		},
		{
			icon: 'banknote',
			title: 'Pago Inmediato',
			description: '15% OFF en transferencia',
			details: 'Bancaria o Alias',
			gradient: 'from-accent/20 to-accent/5',
			iconBg: 'bg-accent/10',
			iconColor: 'text-accent-foreground'
		},
		{
			icon: 'shield-plus',
			title: 'Garantía Total',
			description: 'Garantía en todos los productos',
			details: 'Protección completa',
			gradient: 'from-green-500/20 to-green-500/5',
			iconBg: 'bg-green-500/10',
			iconColor: 'text-green-600'
		}
	];


	private static async getProductsGroupByBrand(models: TenantModels): Promise<IBrandSection[]> {
		try {
			// 1. Get all active banners configured in CMS
			const activeBanners = await BannerService.getActiveBanners(models);

			// 2. Get all products to map them
			const products = await ProductService.getAllProducts(models);

			// 3. Group products by normalized brand for case-insensitive matching
			const brandProductsMap = new Map<string, IProduct[]>();
			products.forEach((product) => {
				const brandKey = (product.brand || '').trim().toLowerCase();
				if (brandKey) {
					if (!brandProductsMap.has(brandKey)) {
						brandProductsMap.set(brandKey, []);
					}
					brandProductsMap.get(brandKey)!.push(product);
				}
			});

			const brandSections: IBrandSection[] = [];
			const productsMap = new Map<string, IProduct>();
			products.forEach(p => productsMap.set(p._id.toString(), p));

			// 4. Iterate over active banners and build sections
			for (const banner of activeBanners) {
				let matchingProducts: IProduct[] = [];

				if (banner.showProducts) {
					const count = banner.productsCount || 4;
					const source = banner.productSource || (banner.brandName ? 'brand' : 'recent');
					const sourceVal = (banner.productSourceValue || banner.brandName || '').trim().toLowerCase();

					if (source === 'category' && sourceVal) {
						matchingProducts = products.filter(p => (p.category || '').toLowerCase().includes(sourceVal));
					} else if (source === 'collection' && sourceVal) {
						matchingProducts = products.filter(p => {
							const tags = (p as any).tags || (p as any).collections || [];
							return tags.some((t: string) => t.toLowerCase().includes(sourceVal)) || (p.category || '').toLowerCase().includes(sourceVal);
						});
					} else if (source === 'brand' && sourceVal) {
						matchingProducts = brandProductsMap.get(sourceVal) || products.filter(p => (p.brand || '').toLowerCase().includes(sourceVal));
					} else if (source === 'manual' && banner.manualProductIds && banner.manualProductIds.length > 0) {
						matchingProducts = banner.manualProductIds
							.map((id: any) => productsMap.get(id.toString()))
							.filter((p): p is IProduct => !!p);
					} else {
						// Recent products
						matchingProducts = products;
					}

					matchingProducts = matchingProducts.slice(0, count);
				}

				brandSections.push({
					name: banner.name || banner.title || banner.brandName || 'Banner',
					brandName: banner.brandName || '',
					title: banner.title || '',
					subtitle: banner.subtitle || '',
					description: banner.description || '',
					image: banner.image,
					imageMobile: banner.imageMobile || '',
					linkType: banner.linkType || (banner.brandName ? 'brand' : 'none'),
					linkValue: banner.linkValue || banner.brandName || '',
					showProducts: banner.showProducts ?? (matchingProducts.length > 0),
					textClass: banner.textClass || 'text-white',
					buttonClass: banner.buttonClass || 'bg-white text-black',
					icon: banner.icon || 'Smartphone',
					products: matchingProducts
				});
			}

			return brandSections;
		} catch (error) {
			throw new AppError(
				'Error grouping products by brand',
				'Error al agrupar productos por marca',
				500
			);
		}
	}

	static async getHomeConfig(models: TenantModels, tenantSlug?: string): Promise<IHomeConfig> {
		const cacheKey = 'home:full';
		if (tenantSlug) {
			const cached = (await import('./cache.service')).CacheService.get<IHomeConfig>(tenantSlug, cacheKey);
			if (cached) return cached;
		}

		const productByBrand = await this.getProductsGroupByBrand(models);
		// Fetch Hero Slides
		const heroSlides = await HeroService.getActiveSlides(models, tenantSlug);
		const bentoConfig = await BentoService.getBentoConfig(models, tenantSlug);
		const ShopTheLooks = await ShopTheLookService.getActiveLooks(models, tenantSlug);

		const config = await EcommerceService.getConfig(models);
		const maxInstallments = config?.paymentGateways?.mercadopago?.maxInstallments ?? 1;
		const absorbInstallments = config?.pricingStrategy?.absorbInstallments ?? true;
		
		let installmentsText = 'Sin cuotas sin interés';
		if (absorbInstallments) {
			installmentsText = maxInstallments >= 6 ? '6 cuotas sin interés' : (maxInstallments >= 3 ? '3 cuotas sin interés' : 'Cuotas sin interés');
		}

		const dynamicOffers = [
			{
				...this.offers[0],
				description: installmentsText
			},
			this.offers[1],
			this.offers[2]
		];

		// Últimos productos subidos
		const news = (await ProductService.searchProducts({
			models,
			filters: {
				sortBy: 'createdAt',
				sortOrder: 'asc'
			},
			page: 1,
			limit: 12
		})).data as unknown as IProduct[];

		// Productos más vendidos (controlado por isFeatured mientras no haya ventas reales)
		const mostSales = (await ProductService.searchProducts({
			models,
			filters: {
				featured: true
			},
			limit: 8
		})).data as unknown as IProduct[];

		const result: IHomeConfig = {
			heroSlides,
			offers: dynamicOffers,
			productByBrand,
			bentoConfig,
			shopTheLook: ShopTheLooks,
			news,
			mostSales
		};

		if (tenantSlug) {
			const { CacheService } = await import('./cache.service');
			CacheService.set(tenantSlug, cacheKey, result, 10 * 60 * 1000);
		}

		return result;
	}
}
