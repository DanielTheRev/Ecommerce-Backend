import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product.model';
import slugify from 'slugify';
import { IProductCreate } from '@/interfaces/product.interface';

// Cargar variables de entorno
dotenv.config();

const getDolarBlue = async () => {
	try {
		const response = await fetch('https://dolarapi.com/v1/dolares/oficial');

		if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

		const data: any = await response.json();
		const { compra, venta, fechaActualizacion } = data;

		console.log('💸 Dólar Blue');
		console.log(`Compra: $${compra}`);
		console.log(`Venta: $${venta}`);
		console.log(`Última actualización: ${fechaActualizacion}`);
		return { venta };
	} catch (error: any) {
		console.error('Error al obtener el dólar blue:', error.message);
		return { venta: 0 };
	}
};

const productsLucho: IProductCreate[] = [
	// SAMSUNG
	{
		price: 222999 / 1480,
		model: 'A16',
		brand: 'Samsung',
		shortDescription: 'Samsung A16',
		largeDescription: 'Samsung A16',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$',
			dark: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '4gb ram', '128gb ']
		}
	},
	{
		price: 255999 / 1480,
		model: 'A16',
		brand: 'Samsung',
		shortDescription: 'Samsung A16',
		largeDescription: 'Samsung A16',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$',
			dark: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
		},
		features: {
			principalFeatures: ['Nuevo', '5g', '6gb ram', '128 ']
		}
	},
	{
		price: 277000 / 1480,
		model: 'A16',
		brand: 'Samsung',
		shortDescription: 'Samsung A16',
		largeDescription: 'Samsung A16',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$',
			dark: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
		},
		features: {
			principalFeatures: ['Nuevo', '5g', '8gb ram', '256gb ']
		}
	},
	{
		price: 380999 / 1480,
		model: 'A26',
		brand: 'Samsung',
		shortDescription: 'Samsung A26',
		largeDescription: 'Samsung A26',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg',
			dark: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '5g', '8gb ram', '256gb ']
		}
	},
	{
		price: 151500 / 1480,
		model: 'A06',
		brand: 'Samsung',
		shortDescription: 'Samsung A06',
		largeDescription: 'Samsung A06',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '4GB ram', '64GB ']
		}
	},
	{
		price: 174000 / 1480,
		model: 'A06',
		brand: 'Samsung',
		shortDescription: 'Samsung A06',
		largeDescription: 'Samsung A06',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '4GB ram', '128GB ']
		}
	},

	// MOTOROLA
	{
		price: 134999 / 1480,
		model: 'E15',
		brand: 'Motorola',
		shortDescription: 'Motorola E15',
		largeDescription: 'Motorola E15',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-e15-mistyblue-front_back.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-e15-mistyblue-front_back.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '2GB ram', '64GB ']
		}
	},
	{
		price: 167999 / 1480,
		model: 'G05',
		brand: 'Motorola',
		shortDescription: 'Motorola G05',
		largeDescription: 'Motorola G05',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-g05-forestgreen-front_back.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-g05-forestgreen-front_back.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '4GB ram', '128GB ']
		}
	},
	{
		price: 186499 / 1480,
		model: 'G15',
		brand: 'Motorola',
		shortDescription: 'Motorola G15',
		largeDescription: 'Motorola G15',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg',
			dark: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '4GB ram', '128GB ']
		}
	},
	{
		price: 205999 / 1480,
		model: 'G15',
		brand: 'Motorola',
		shortDescription: 'Motorola G15',
		largeDescription: 'Motorola G15',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg',
			dark: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '4GB ram', '256GB ']
		}
	},
	{
		price: 231999 / 1480,
		model: 'G35',
		brand: 'Motorola',
		shortDescription: 'Motorola G35',
		largeDescription: 'Motorola G35',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://www.megatone.net/images/Articulos/zoom2x/209/MKT0710MHM-1.png',
			dark: 'https://www.megatone.net/images/Articulos/zoom2x/209/MKT0710MHM-1.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4g', '4GB ram', '256GB ']
		}
	},
	{
		price: 299499 / 1480,
		model: 'G55',
		brand: 'Motorola',
		shortDescription: 'Motorola G55',
		largeDescription: 'Motorola G55',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://i.zst.com.br/thumbs/12/17/14/-1533012903.jpg',
			dark: 'https://i.zst.com.br/thumbs/12/17/14/-1533012903.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '5G', '8GB ram', '256GB ']
		}
	},
	{
		price: 297999 / 1480,
		model: 'G84',
		brand: 'Motorola',
		shortDescription: 'Motorola G84',
		largeDescription: 'Motorola G84',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://cdn.smart-gsm.com/blog/wp-content/uploads/2023/09/motorola-moto-g84_4.jpg',
			dark: 'https://cdn.smart-gsm.com/blog/wp-content/uploads/2023/09/motorola-moto-g84_4.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '5G', '8GB ram', '256GB ']
		}
	},

	// XIAOMI
	{
		price: 152500 / 1480,
		model: 'A5',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi A5',
		largeDescription: 'Xiaomi A5',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/236/748/products/whatsapp-image-2025-06-26-at-5-29-23-pm-858d7a6f788714dab417509697967180-1024-1024.jpg',
			dark: 'https://acdn-us.mitiendanube.com/stores/236/748/products/whatsapp-image-2025-06-26-at-5-29-23-pm-858d7a6f788714dab417509697967180-1024-1024.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '4GB ram', '128GB']
		}
	},
	{
		price: 175000 / 1480,
		model: '14C',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C',
		largeDescription: 'Xiaomi 14C',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg',
			dark: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '4GB ram', '128GB ']
		}
	},
	{
		price: 188000 / 1480,
		model: '14C',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C',
		largeDescription: 'Xiaomi 14C',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg',
			dark: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '4GB ram', '256GB ']
		}
	},
	{
		price: 205000 / 1480,
		model: '14C',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C',
		largeDescription: 'Xiaomi 14C',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg',
			dark: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '8GB ram', '256GB ']
		}
	},
	{
		price: 565750 / 1480,
		model: 'Note 14 Pro',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi Note 14 Pro',
		largeDescription: 'Xiaomi Note 14 Pro',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.ventaconcretada.com/wp-content/uploads/2025/01/xiaomi-redmi-note-14-4G-2025.webp',
			dark: 'https://www.ventaconcretada.com/wp-content/uploads/2025/01/xiaomi-redmi-note-14-4G-2025.webp'
		},
		features: {
			principalFeatures: ['Nuevo', '5G', '6GB ram', '128GB ']
		}
	},
	{
		price: 372999 / 1480,
		model: 'Note 14 Pro',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi Note 14 Pro',
		largeDescription: 'Xiaomi Note 14 Pro',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/052/917/products/diseno-sin-titulo-2025-01-21t202211-877-c121844a3f980ee77c17375017810763-1024-1024.png',
			dark: 'https://acdn-us.mitiendanube.com/stores/052/917/products/diseno-sin-titulo-2025-01-21t202211-877-c121844a3f980ee77c17375017810763-1024-1024.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '8GB ram', '256GB ']
		}
	},

	// POCO / RE
	{
		price: 149999 / 1480,
		model: 'C71',
		brand: 'POCO',
		shortDescription: 'POCO C71',
		largeDescription: 'POCO C71',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://dcdn-us.mitiendanube.com/stores/001/743/766/products/75e58b2eba44f669a24ca986a11cf0be-eec5525558f45d49d717456821894599-1024-1024.jpg',
			dark: 'https://dcdn-us.mitiendanube.com/stores/001/743/766/products/75e58b2eba44f669a24ca986a11cf0be-eec5525558f45d49d717456821894599-1024-1024.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '4GB ram', '128GB ']
		}
	},
	{
		price: 167499 / 1480,
		model: 'C75',
		brand: 'POCO',
		shortDescription: 'POCO C75',
		largeDescription: 'POCO C75',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png',
			dark: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '6GB ram', '128GB ']
		}
	},
	{
		price: 198999 / 1480,
		model: 'C75',
		brand: 'POCO',
		shortDescription: 'POCO C75',
		largeDescription: 'POCO C75',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png',
			dark: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png'
		},
		features: {
			principalFeatures: ['Nuevo', '4G', '8GB ram', '256GB ']
		}
	}
];

const productsLuchito: IProductCreate[] = [
	// SAMSUNG
	{
		price: 448400 / 1480,
		model: 'A35',
		brand: 'Samsung',
		shortDescription: 'Samsung A35',
		largeDescription: 'Samsung A35',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg',
			dark: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '5g', '8gb ram', '128gb ']
		}
	},
	{
		price: 460200 / 1480,
		model: 'A35',
		brand: 'Samsung',
		shortDescription: 'Samsung A35',
		largeDescription: 'Samsung A35',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg',
			dark: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '5g', '8gb ram', '256gb ']
		}
	},
	{
		price: 578200 / 1480,
		model: 'A55',
		brand: 'Samsung',
		shortDescription: 'Samsung A55',
		largeDescription: 'Samsung A55',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg',
			dark: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '5g', '8gb ram', '256gb ']
		}
	},
	{
		price: 285,
		model: 'iPhone 11',
		brand: 'Apple',
		shortDescription: 'iPhone 11',
		largeDescription: 'iPhone 11',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg',
			dark: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg'
		},
		features: {
			principalFeatures: ['Tester', '64GB ', '100% batería']
		}
	},
	{
		price: 315,
		model: 'iPhone 11',
		brand: 'Apple',
		shortDescription: 'iPhone 11',
		largeDescription: 'iPhone 11',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg',
			dark: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg'
		},
		features: {
			principalFeatures: ['Tester', '128GB ', '100% batería']
		}
	},
	{
		price: 285,
		model: 'iPhone 12',
		brand: 'Apple',
		shortDescription: 'iPhone 12 64gb',
		largeDescription: 'iPhone 12 64gb',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Grado AB', '64gb ', '100% batería']
		}
	},
	{
		price: 320,
		model: 'iPhone 12',
		brand: 'Apple',
		shortDescription: 'iPhone 12',
		largeDescription: 'iPhone 12',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Grado AB', '128GB ', '100% batería']
		}
	},
	{
		price: 345,
		model: 'iPhone 12',
		brand: 'Apple',
		shortDescription: 'iPhone 12',
		largeDescription: 'iPhone 12',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Grado A+', '128GB ', '100% batería']
		}
	},
	{
		price: 410,
		model: 'iPhone 12 pro',
		brand: 'Apple',
		shortDescription: 'iPhone 12 pro',
		largeDescription: 'iPhone 12 pro',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Caja', '128GB ', '100% batería']
		}
	},
	{
		price: 430,
		model: 'iPhone 12 pro',
		brand: 'Apple',
		shortDescription: 'iPhone 12 pro',
		largeDescription: 'iPhone 12 pro',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Caja', '256GB ', '100% batería']
		}
	},
	{
		price: 420,
		model: 'iPhone 13',
		brand: 'Apple',
		shortDescription: 'iPhone 13',
		largeDescription: 'iPhone 13',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Grado A+', '128GB ', '100% batería']
		}
	},
	{
		price: 470,
		model: 'iPhone 13',
		brand: 'Apple',
		shortDescription: 'iPhone 13',
		largeDescription: 'iPhone 13',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Grado A+', 'Caja', '256GB ', '100% batería']
		}
	},
	{
		price: 590,
		model: 'iPhone 13',
		brand: 'Apple',
		shortDescription: 'iPhone 13',
		largeDescription: 'iPhone 13',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Nuevo', '128GB ']
		}
	},
	{
		price: 470,
		model: 'iPhone 14',
		brand: 'Apple',
		shortDescription: 'iPhone 14',
		largeDescription: 'iPhone 14',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: {
			principalFeatures: ['Tester', 'Caja', '128GB ', '100% batería']
		}
	},
	{
		price: 620,
		model: 'iPhone 14 Pro',
		brand: 'Apple',
		shortDescription: 'iPhone 14 Pro',
		largeDescription: 'iPhone 14 Pro',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp',
			dark: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp'
		},
		features: {
			principalFeatures: ['Tester', '128GB ', '100% batería']
		}
	},
	{
		price: 720,
		model: 'iPhone 14 Pro Max',
		brand: 'Apple',
		shortDescription: 'iPhone 14 Pro Max',
		largeDescription: 'iPhone 14 Pro Max',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp',
			dark: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp'
		},
		features: {
			principalFeatures: ['Tester', '128GB ', '100% batería']
		}
	},
	{
		price: 780,
		model: 'iPhone 15',
		brand: 'Apple',
		shortDescription: 'iPhone 15',
		largeDescription: 'iPhone 15',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://cdn-ipoint.waugi.com.ar/26703-thickbox_default/iphone-15-pro-max-256gb.jpg',
			dark: 'https://cdn-ipoint.waugi.com.ar/26703-thickbox_default/iphone-15-pro-max-256gb.jpg'
		},
		features: {
			principalFeatures: ['Nuevo', '128GB ']
		}
	},
	{
		price: 870,
		model: 'iPhone 16',
		brand: 'Apple',
		shortDescription: 'iPhone 16',
		largeDescription: 'iPhone 16',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.1p.sg/cdn/shop/files/iPhone-16-Black_1cebd178-ed7b-4386-983e-e3aca356bd31.jpg?v=1750415943&width=1445',
			dark: 'https://www.1p.sg/cdn/shop/files/iPhone-16-Black_1cebd178-ed7b-4386-983e-e3aca356bd31.jpg?v=1750415943&width=1445'
		},
		features: {
			principalFeatures: ['Nuevo', '128GB ']
		}
	},
	{
		price: 1120,
		model: 'iPhone 16 Pro',
		brand: 'Apple',
		shortDescription: 'iPhone 16 Pro',
		largeDescription: 'iPhone 16 Pro',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://riz.shop/cdn/shop/files/New_5_aca99c60-6795-4672-993e-1a0423d0821e.jpg?v=1734173737',
			dark: 'https://riz.shop/cdn/shop/files/New_5_aca99c60-6795-4672-993e-1a0423d0821e.jpg?v=1734173737'
		},
		features: {
			principalFeatures: ['Nuevo', '256GB ']
		}
	},
	{
		price: 1210,
		model: 'iPhone 16 Pro Max',
		brand: 'Apple',
		shortDescription: 'iPhone 16 Pro Max',
		largeDescription: 'iPhone 16 Pro Max',
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://riz.shop/cdn/shop/files/New_5_aca99c60-6795-4672-993e-1a0423d0821e.jpg?v=1734173737',
			dark: 'https://riz.shop/cdn/shop/files/New_5_aca99c60-6795-4672-993e-1a0423d0821e.jpg?v=1734173737'
		},
		features: {
			principalFeatures: ['Nuevo', '256GB ']
		}
	}
];

function createProductsWithPrices(products: IProductCreate[], dolarHoy: number) {
	return products.map((product) => {
		product.slug = slugify(
			`${product.shortDescription}-${product.features.principalFeatures.toString()}`,
			{
				lower: true,
				strict: true
			}
		);

		const MiGanancia = product.brand === 'Apple' ? 0.1 : 0.1;

		// Tu ganancia objetivo en ARS
		const gananciaObjetivo = product.price * dolarHoy * MiGanancia;

		// Precio que quieres recibir en mano (costo del producto en ARS + tu ganancia)
		const precioBaseEnARS = product.price * dolarHoy;
		const precioObjetivo = precioBaseEnARS + gananciaObjetivo;

		// Recargos de Ualá con IVA
		const commissionUala = 0.049 * 1.21;
		const CFT_6_cuotas = 0.1439 * 1.21;

		// Para 1 pago (efectivo, transferencia o tarjeta de débito)
		// El precio final que el cliente paga debe ser el precio objetivo, pero "inflado" para cubrir la comisión de Ualá.
		// Fórmula: Precio del Cliente = Precio Objetivo / (1 - Tasa de Comisión de Ualá)
		const precioEfectivoTransferencia = Math.round(precioObjetivo);
		// Para 6 cuotas (tarjeta de crédito)
		// El precio final debe ser el precio objetivo, "inflado" para cubrir tanto la comisión de Ualá como el CFT.
		// Fórmula: Precio del Cliente = Precio Objetivo / (1 - Tasa de Comisión de Ualá - Tasa de CFT)
		// Nota: El cálculo de Ualá es sobre el precio final.
		const precio6Cuotas = Math.round(precioObjetivo / (1 - commissionUala - CFT_6_cuotas));

		// Cálculo del % ahorro de pagar en efectivo vs 6 cuotas
		const percentage = Math.round(
			((precio6Cuotas - precioEfectivoTransferencia) / precio6Cuotas) * 100
		);

		return {
			...product,
			discount: percentage,
			prices: {
				efectivo_transferencia: precioEfectivoTransferencia,
				tarjeta_credito_debito: precio6Cuotas,
				cuotas: {
					'3_cuotas_sin_interes': Math.round(precio6Cuotas / 3),
					'6_cuotas_sin_interes': Math.round(precio6Cuotas / 6)
				}
			}
		};
	});
}

const seedDatabase = async (): Promise<void> => {
	const { venta } = await getDolarBlue();
	const products = [...productsLucho, ...productsLuchito];
	const ProductsWithPrices = createProductsWithPrices(products, venta);
	try {
		// Conectar a MongoDB
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		// Limpiar la colección existente
		await Product.deleteMany({});
		console.log('🗑️ Productos existentes eliminados');

		// Insertar productos de prueba
		const createdProducts = await Product.insertMany(ProductsWithPrices);
		console.log(`✨ ${createdProducts.length} productos de prueba creados`);

		// Mostrar algunos productos creados
		console.log('\n📦 Productos creados:');
		createdProducts.slice(0, 3).forEach((product, index) => {
			console.log(
				`${index + 1}. ${product.brand + ' ' + product.model} - $${product.prices.efectivo_transferencia} (${
					product.discount
				}% descuento)`
			);
		});

		console.log('\n🎉 ¡Base de datos poblada exitosamente!');
	} catch (error) {
		console.error('❌ Error al poblar la base de datos:', error);
	} finally {
		await mongoose.connection.close();
		console.log('🔒 Conexión cerrada');
		process.exit(0);
	}
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
	seedDatabase();
}

export { seedDatabase };
