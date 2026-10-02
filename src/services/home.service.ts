import { IBrandSection, IHomeConfig, IHomeOffer } from '@/interfaces/home.interface';
import { IProduct } from '@/interfaces/product.interface';
import { ProductService } from './product.service';
import { BannerService } from './banner.service';
import { HeroService } from './hero.service';
import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { MenuService } from './menu.service';
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
			products.forEach((p) => productsMap.set(p._id.toString(), p));

			// 4. Iterate over active banners and build sections
			for (const banner of activeBanners) {
				let matchingProducts: IProduct[] = [];

				if (banner.showProducts) {
					const count = banner.productsCount || 4;
					const source = banner.productSource || (banner.brandName ? 'brand' : 'recent');
					const sourceVal = (banner.productSourceValue || banner.brandName || '')
						.trim()
						.toLowerCase();

					if (source === 'category' && sourceVal) {
						matchingProducts = products.filter((p) =>
							(p.category || '').toLowerCase().includes(sourceVal)
						);
					} else if (source === 'collection' && sourceVal) {
						matchingProducts = products.filter((p) => {
							const tags = (p as any).tags || (p as any).collections || [];
							return (
								tags.some((t: string) => t.toLowerCase().includes(sourceVal)) ||
								(p.category || '').toLowerCase().includes(sourceVal)
							);
						});
					} else if (source === 'brand' && sourceVal) {
						matchingProducts =
							brandProductsMap.get(sourceVal) ||
							products.filter((p) => (p.brand || '').toLowerCase().includes(sourceVal));
					} else if (
						source === 'manual' &&
						banner.manualProductIds &&
						banner.manualProductIds.length > 0
					) {
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
					showProducts: banner.showProducts ?? matchingProducts.length > 0,
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

	static async getHomeConfig(
		models: TenantModels,
		tenantSlug?: string,
		options?: { newsLimit?: number; splitColors?: boolean }
	): Promise<IHomeConfig> {
		const newsLimit = options?.newsLimit ? Math.max(1, Number(options.newsLimit)) : 12;
		const splitColors = options?.splitColors === true;
		const cacheKey = `home:full:${newsLimit}:${splitColors}`;
		if (tenantSlug) {
			const cached = (await import('./cache.service')).CacheService.get<IHomeConfig>(
				tenantSlug,
				cacheKey
			);
			if (cached) return cached;
		}

		// Obtener configuración global del tenant (con caché interna o lean)
		const config = await EcommerceService.getConfig(models).catch(() => null);
		const sections = config?.homeLayout?.sections;

		// Construir tareas paralelas dinámicas según secciones activas en el CMS del tenant
		const tasks: Record<string, Promise<any>> = {};

		if (sections?.hero?.active === true) {
			tasks['heroSlides'] = HeroService.getActiveSlides(models, tenantSlug);
		}

		if (sections?.categories?.active === true) {
			const menuSlug = sections.categories.menuSlug || 'categories';
			tasks['categoriesMenu'] = MenuService.getMenuBySlugOrId(models, menuSlug, tenantSlug);
		}

		if (sections?.shopTheLook?.active === true) {
			tasks['shopTheLook'] = ShopTheLookService.getActiveLooks(models, tenantSlug);
		}

		if (sections?.news?.active === true) {
			const limit = sections.news.limit ? Math.max(1, Number(sections.news.limit)) : newsLimit;
			tasks['news'] = ProductService.getSmartNews(models, limit, splitColors);
		}

		if (sections?.brandSections?.active === true) {
			tasks['productByBrand'] = this.getProductsGroupByBrand(models);
		}

		if (sections?.mostSales?.active === true) {
			const limit = sections.mostSales.limit ? Math.max(1, Number(sections.mostSales.limit)) : 8;
			tasks['mostSales'] = ProductService.searchProducts({
				models,
				filters: {
					sortBy: 'createdAt',
					sortOrder: 'desc',
					splitColors: true
				},
				limit
			}).then((res) => (res.data || []) as unknown as IProduct[]);
		}

		// Ejecución simultánea de todas las consultas activas (Fail-safe)
		const taskKeys = Object.keys(tasks);
		const settledResults = await Promise.allSettled(Object.values(tasks));

		const resolved: Record<string, any> = {};
		taskKeys.forEach((key, index) => {
			const res = settledResults[index];
			if (res.status === 'fulfilled') {
				resolved[key] = res.value;
			} else {
				console.error(`[HomeService] Error resolviendo sección "${key}":`, res.reason);
				resolved[key] = key === 'categoriesMenu' ? null : [];
			}
		});

		// Barra de beneficios / Cuotas dinámicas
		let dynamicOffers: IHomeOffer[] = [];
		if (sections?.trustBar?.active === true) {
			const maxInstallments = config?.paymentGateways?.mercadopago?.maxInstallments ?? 1;
			const absorbInstallments = config?.pricingStrategy?.absorbInstallments ?? true;

			let installmentsText = 'Sin cuotas sin interés';
			if (absorbInstallments) {
				installmentsText =
					maxInstallments >= 6
						? '6 cuotas sin interés'
						: maxInstallments >= 3
							? '3 cuotas sin interés'
							: 'Cuotas sin interés';
			}

			dynamicOffers = [
				{
					...this.offers[0],
					description: installmentsText
				},
				this.offers[1],
				this.offers[2]
			];
		}

		const categoriesMenu = resolved['categoriesMenu'] || null;

		const result: IHomeConfig = {
			// homeLayout: config?.homeLayout,
			heroSlides: resolved['heroSlides'] || [],
			offers: dynamicOffers,
			productByBrand: resolved['productByBrand'] || [],
			categoriesMenu,
			shopTheLook: resolved['shopTheLook'] || [],
			news: resolved['news'] || [],
			mostSales: resolved['mostSales'] || []
		};

		if (tenantSlug) {
			const { CacheService } = await import('./cache.service');
			CacheService.set(tenantSlug, cacheKey, result, 10 * 60 * 1000);
		}

		return result;
	}
}
