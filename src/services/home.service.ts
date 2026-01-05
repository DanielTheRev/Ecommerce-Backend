import { IBrandSection, IHomeOffer } from '@/interfaces/home.interface';
import { IProduct } from '@/interfaces/product.interface';
import { ProductService } from './product.service';
import { AppError } from '@/errors/app.error';

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
	private static readonly brandConfig: Record<
		string,
		Omit<IBrandSection, 'products' | 'brandName'>
	> = {
		Apple: {
			description: 'Diseño en titanio. Creado para Apple Intelligence.',
			image: 'https://www.apple.com/v/iphone-17/c/images/overview/cameras/back-camera/hero_rear_camera__cz6f2qdjc0q6_xlarge_2x.png',
			title: 'iPhone 16 Pro',
			subtitle: 'Titanium Design',
			textClass: 'text-white',
			buttonClass: 'bg-white text-black hover:bg-gray-200',
			icon: 'Apple'
		},
		Samsung: {
			description: 'El smartphone definitivo. Titanio. Inteligencia Artificial.',
			image: 'https://images.samsung.com/ar/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-features-kv-g.jpg?imbypass=true',
			title: 'Galaxy S25 Ultra',
			subtitle: 'Galaxy AI is here',
			textClass: 'text-white',
			buttonClass: 'bg-white text-black hover:bg-gray-200',
			icon: 'Smartphone'
		},
		Xiaomi: {
			description: 'Lentes ópticos Leica. Potencia y diseño sin límites.',
			image: 'https://xiaomistore.com.ar/desarrollos/landings/smartphones/redmi-14t/desktop/main-files/img01.jpg',
			title: 'Xiaomi 14T Series',
			subtitle: 'Master light, capture night',
			textClass: 'text-white',
			buttonClass: 'bg-white text-black hover:bg-gray-200',
			icon: 'Smartphone'
		},
		Motorola: {
			description: 'Descubre la fusión perfecta entre tecnología y estilo.',
			image: 'https://armoto.vteximg.com.br/arquivos/moto-edge-60-pro-pdp-CMF-Modal-static-01-D-zf1ke1kz.jpg',
			title: 'Diseño Sin Límites',
			subtitle: 'Hello Moto',
			textClass: 'text-white',
			buttonClass: 'bg-white text-black hover:bg-gray-200',
			icon: 'Smartphone'
		},
		POCO: {
			description: 'Rendimiento extremo para gaming y creadores.',
			image: 'https://i02.appmifile.com/mi-com-product/fly-birds/poco-f7/pc/837222dcf1c0c4a47659f44e9ac81b2a.jpg?f=webp',
			title: 'Pura Potencia',
			subtitle: 'Everything you need',
			textClass: 'text-white',
			buttonClass: 'bg-[#FFD700] text-black hover:bg-yellow-400',
			icon: 'Zap'
		}
	};

	private static async getProductsGroupByBrand(): Promise<IBrandSection[]> {
		try {
			const products = await ProductService.getAllProducts();
			// if products is empty, return empty array
			if (!products || products.length === 0) {
				console.log('No products found in getProductsGroupByBrand at HomeService');
				return [];
			}
			// Group products by brand
			const brandProductsMap = new Map<string, IProduct[]>();
			// Iterate over products and group them by brand
			products.forEach((product) => {
				const brand = product.brand;
				if (!brandProductsMap.has(brand)) {
					brandProductsMap.set(brand, []);
				}
				brandProductsMap.get(brand)!.push(product);
			});
			// Create brand sections array
			const brandGroups: IBrandSection[] = [];
			// Iterate over each brand and create the section if config exists
			brandProductsMap.forEach((brandProducts, brand) => {
				const sortedProducts = [...brandProducts].sort((a, b) =>
					b.model!.localeCompare(a.model!)
				);
				const config = this.brandConfig[brand];

				if (config) {
					brandGroups.push({
						brandName: brand,
						products: sortedProducts.slice(0, 4),
						...config
					});
				}
			});
			// Order according to desired brand priority: Apple, Samsung, Xiaomi, POCO
			const desiredOrder = ['Apple', 'Samsung', 'Xiaomi', 'POCO'];
			brandGroups.sort((a, b) => {
				const ia = desiredOrder.indexOf(a.brandName);
				const ib = desiredOrder.indexOf(b.brandName);
				// If one of the brands is in the desired order, it gets priority
				if (ia !== -1 || ib !== -1) {
					if (ia === -1) return 1; // a goes after b
					if (ib === -1) return -1; // a goes before b
					return ia - ib; // both in desiredOrder: preserve specified order
				}
				// Fallback: alphabetical
				return a.brandName.localeCompare(b.brandName);
			});
			return brandGroups;
		} catch (error) {
			throw new AppError('Error grouping products by brand', 500);
		}
	}

	static async getHomeConfig() {
		const productByBrand = await this.getProductsGroupByBrand();
		return {
			offers: this.offers,
			productByBrand
		};
	}
}
