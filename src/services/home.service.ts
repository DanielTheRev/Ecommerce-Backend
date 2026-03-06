import { IBrandSection, IHomeOffer } from '@/interfaces/home.interface';
import { IProduct } from '@/interfaces/product.interface';
import { ProductService } from './product.service';
import { BannerService } from './banner.service';
import { HeroService } from './hero.service';
import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';

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

			// 3. Group products by brand for O(1) access
			const brandProductsMap = new Map<string, IProduct[]>();
			products.forEach((product) => {
				const brand = product.brand;
				if (!brandProductsMap.has(brand)) {
					brandProductsMap.set(brand, []);
				}
				brandProductsMap.get(brand)!.push(product);
			});

			const brandSections: IBrandSection[] = [];

			// 4. Iterate over active banners and build sections
			for (const banner of activeBanners) {
				const productsForBrand = brandProductsMap.get(banner.brandName) || [];
				
				// Sort products by model as requested
				const sortedProducts = productsForBrand.sort((a, b) =>
					b.model!.localeCompare(a.model!)
				);

				brandSections.push({
					brandName: banner.brandName,
					title: banner.title,
					subtitle: banner.subtitle,
					description: banner.description,
					image: banner.image,
					textClass: banner.textClass,
					buttonClass: banner.buttonClass,
					icon: banner.icon,
					products: sortedProducts.slice(0, 4)
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

	static async getHomeConfig(models: TenantModels) {
		const productByBrand = await this.getProductsGroupByBrand(models);
		// Fetch Hero Slides
		const heroSlides = await HeroService.getActiveSlides(models);

		return {
			heroSlides,
			offers: this.offers,
			productByBrand
		};
	}
}
