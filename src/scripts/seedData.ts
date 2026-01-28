import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product.model';
import slugify from 'slugify';
import { IProductCategories, IProductCreateDTO } from '@/interfaces/product.interface';
import { ProductService } from '@/services/product.service';

// Cargar variables de entorno
dotenv.config();

const productsLuchito: IProductCreateDTO[] = [
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A35',
		largeDescription: 'Samsung A35',
		model: 'A35',
		price: 302.97,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
			}
		],
		features: ['Nuevo', '5g', '8gb ram', '128gb ']
	},
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A35',
		largeDescription: 'Samsung A35',
		model: 'A35',
		price: 310.94,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
			}
		],
		features: ['Nuevo', '5g', '8gb ram', '256gb ']
	},
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A55',
		largeDescription: 'Samsung A55',
		model: 'A55',
		price: 390.67,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
			}
		],
		features: ['Nuevo', '5g', '8gb ram', '256gb ']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 11',
		largeDescription: 'iPhone 11',
		model: 'iPhone 11',
		price: 285,
		category: IProductCategories.Smartphones,
		images: [
			{ file: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg' }
		],
		features: ['Tester', '64GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 11',
		largeDescription: 'iPhone 11',
		model: 'iPhone 11',
		price: 315,
		category: IProductCategories.Smartphones,
		images: [
			{ file: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg' }
		],
		features: ['Tester', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 12 64gb',
		largeDescription: 'iPhone 12 64gb',
		model: 'iPhone 12',
		price: 285,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Grado AB', '64gb ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 12',
		largeDescription: 'iPhone 12',
		model: 'iPhone 12',
		price: 320,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Grado AB', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 12',
		largeDescription: 'iPhone 12',
		model: 'iPhone 12',
		price: 345,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Grado A+', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 12 pro',
		largeDescription: 'iPhone 12 pro',
		model: 'iPhone 12 pro',
		price: 410,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Caja', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 12 pro',
		largeDescription: 'iPhone 12 pro',
		model: 'iPhone 12 pro',
		price: 430,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Caja', '256GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 13',
		largeDescription: 'iPhone 13',
		model: 'iPhone 13',
		price: 420,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Grado A+', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 13',
		largeDescription: 'iPhone 13',
		model: 'iPhone 13',
		price: 470,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Grado A+', 'Caja', '256GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 13',
		largeDescription: 'iPhone 13',
		model: 'iPhone 13',
		price: 590,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Nuevo', '128GB ']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 14',
		largeDescription: 'iPhone 14',
		model: 'iPhone 14',
		price: 470,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
			}
		],
		features: ['Tester', 'Caja', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 14 Pro',
		largeDescription: 'iPhone 14 Pro',
		model: 'iPhone 14 Pro',
		price: 620,
		category: IProductCategories.Smartphones,
		images: [{ file: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp' }],
		features: ['Tester', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 14 Pro Max',
		largeDescription: 'iPhone 14 Pro Max',
		model: 'iPhone 14 Pro Max',
		price: 720,
		category: IProductCategories.Smartphones,
		images: [{ file: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp' }],
		features: ['Tester', '128GB ', '100% batería']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 15',
		largeDescription: 'iPhone 15',
		model: 'iPhone 15',
		price: 780,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://cdn-ipoint.waugi.com.ar/26703-thickbox_default/iphone-15-pro-max-256gb.jpg'
			}
		],
		features: ['Nuevo', '128GB ']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 16',
		largeDescription: 'iPhone 16',
		model: 'iPhone 16',
		price: 870,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://www.1p.sg/cdn/shop/files/iPhone-16-Black_1cebd178-ed7b-4386-983e-e3aca356bd31.jpg?v=1750415943&width=1445'
			}
		],
		features: ['Nuevo', '128GB ']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 16 Pro',
		largeDescription: 'iPhone 16 Pro',
		model: 'iPhone 16 Pro',
		price: 1120,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://riz.shop/cdn/shop/files/New_5_aca99c60-6795-4672-993e-1a0423d0821e.jpg?v=1734173737'
			}
		],
		features: ['Nuevo', '256GB ']
	},
	{
		brand: 'Apple',
		shortDescription: 'iPhone 16 Pro Max',
		largeDescription: 'iPhone 16 Pro Max',
		model: 'iPhone 16 Pro Max',
		price: 1210,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://riz.shop/cdn/shop/files/New_5_aca99c60-6795-4672-993e-1a0423d0821e.jpg?v=1734173737'
			}
		],
		features: ['Nuevo', '256GB ']
	}
];

const productsLucho: IProductCreateDTO[] = [
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A16',
		largeDescription: 'Samsung A16',
		model: 'A16',
		price: 150.67,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
			}
		],
		features: ['Nuevo', '4g', '4gb ram', '128gb ']
	},
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A16',
		largeDescription: 'Samsung A16',
		model: 'A16',
		price: 172.97,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
			}
		],
		features: ['Nuevo', '5g', '6gb ram', '128 ']
	},
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A16',
		largeDescription: 'Samsung A16',
		model: 'A16',
		price: 187.16,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
			}
		],
		features: ['Nuevo', '5g', '8gb ram', '256gb ']
	},
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A26',
		largeDescription: 'Samsung A26',
		model: 'A26',
		price: 257.43,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
			}
		],
		features: ['Nuevo', '5g', '8gb ram', '256gb ']
	},
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A06',
		largeDescription: 'Samsung A06',
		model: 'A06',
		price: 102.36,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png'
			}
		],
		features: ['Nuevo', '4g', '4GB ram', '64GB ']
	},
	{
		brand: 'Samsung',
		shortDescription: 'Samsung A06',
		largeDescription: 'Samsung A06',
		model: 'A06',
		price: 117.56,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png'
			}
		],
		features: ['Nuevo', '4g', '4GB ram', '128GB ']
	},
	{
		brand: 'Motorola',
		shortDescription: 'Motorola E15',
		largeDescription: 'Motorola E15',
		model: 'E15',
		price: 91.21,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-e15-mistyblue-front_back.png'
			}
		],
		features: ['Nuevo', '4g', '2GB ram', '64GB ']
	},
	{
		brand: 'Motorola',
		shortDescription: 'Motorola G05',
		largeDescription: 'Motorola G05',
		model: 'G05',
		price: 113.51,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-g05-forestgreen-front_back.png'
			}
		],
		features: ['Nuevo', '4g', '4GB ram', '128GB ']
	},
	{
		brand: 'Motorola',
		shortDescription: 'Motorola G15',
		largeDescription: 'Motorola G15',
		model: 'G15',
		price: 126.01,
		category: IProductCategories.Smartphones,
		images: [{ file: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg' }],
		features: ['Nuevo', '4g', '4GB ram', '128GB ']
	},
	{
		brand: 'Motorola',
		shortDescription: 'Motorola G15',
		largeDescription: 'Motorola G15',
		model: 'G15',
		price: 139.18,
		category: IProductCategories.Smartphones,
		images: [{ file: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg' }],
		features: ['Nuevo', '4g', '4GB ram', '256GB ']
	},
	{
		brand: 'Motorola',
		shortDescription: 'Motorola G35',
		largeDescription: 'Motorola G35',
		model: 'G35',
		price: 156.75,
		category: IProductCategories.Smartphones,
		images: [{ file: 'https://www.megatone.net/images/Articulos/zoom2x/209/MKT0710MHM-1.png' }],
		features: ['Nuevo', '4g', '4GB ram', '256GB ']
	},
	{
		brand: 'Motorola',
		shortDescription: 'Motorola G55',
		largeDescription: 'Motorola G55',
		model: 'G55',
		price: 202.36,
		category: IProductCategories.Smartphones,
		images: [{ file: 'https://i.zst.com.br/thumbs/12/17/14/-1533012903.jpg' }],
		features: ['Nuevo', '5G', '8GB ram', '256GB ']
	},
	{
		brand: 'Motorola',
		shortDescription: 'Motorola G84',
		largeDescription: 'Motorola G84',
		model: 'G84',
		price: 201.35,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://cdn.smart-gsm.com/blog/wp-content/uploads/2023/09/motorola-moto-g84_4.jpg'
			}
		],
		features: ['Nuevo', '5G', '8GB ram', '256GB ']
	},
	{
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi A5',
		largeDescription: 'Xiaomi A5',
		model: 'A5',
		price: 103.04,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://acdn-us.mitiendanube.com/stores/236/748/products/whatsapp-image-2025-06-26-at-5-29-23-pm-858d7a6f788714dab417509697967180-1024-1024.jpg'
			}
		],
		features: ['Nuevo', '4G', '4GB ram', '128GB']
	},
	{
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C',
		largeDescription: 'Xiaomi 14C',
		model: '14C',
		price: 118.24,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
			}
		],
		features: ['Nuevo', '4G', '4GB ram', '128GB ']
	},
	{
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C',
		largeDescription: 'Xiaomi 14C',
		model: '14C',
		price: 127.02,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
			}
		],
		features: ['Nuevo', '4G', '4GB ram', '256GB ']
	},
	{
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C',
		largeDescription: 'Xiaomi 14C',
		model: '14C',
		price: 138.51,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
			}
		],
		features: ['Nuevo', '4G', '8GB ram', '256GB ']
	},
	{
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi Note 14 Pro',
		largeDescription: 'Xiaomi Note 14 Pro',
		model: 'Note 14 Pro',
		price: 382.26,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://www.ventaconcretada.com/wp-content/uploads/2025/01/xiaomi-redmi-note-14-4G-2025.webp'
			}
		],
		features: ['Nuevo', '5G', '6GB ram', '128GB ']
	},
	{
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi Note 14 Pro',
		largeDescription: 'Xiaomi Note 14 Pro',
		model: 'Note 14 Pro',
		price: 252.02,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://acdn-us.mitiendanube.com/stores/052/917/products/diseno-sin-titulo-2025-01-21t202211-877-c121844a3f980ee77c17375017810763-1024-1024.png'
			}
		],
		features: ['Nuevo', '4G', '8GB ram', '256GB ']
	},
	{
		brand: 'POCO',
		shortDescription: 'POCO C71',
		largeDescription: 'POCO C71',
		model: 'C71',
		price: 101.35,
		category: IProductCategories.Smartphones,
		images: [
			{
				file: 'https://dcdn-us.mitiendanube.com/stores/001/743/766/products/75e58b2eba44f669a24ca986a11cf0be-eec5525558f45d49d717456821894599-1024-1024.jpg'
			}
		],
		features: ['Nuevo', '4G', '4GB ram', '128GB ']
	},
	{
		brand: 'POCO',
		shortDescription: 'POCO C75',
		largeDescription: 'POCO C75',
		model: 'C75',
		price: 113.17,
		category: IProductCategories.Smartphones,
		images: [
			{ file: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png' }
		],
		features: ['Nuevo', '4G', '6GB ram', '128GB ']
	},
	{
		brand: 'POCO',
		shortDescription: 'POCO C75',
		largeDescription: 'POCO C75',
		model: 'C75',
		price: 134.45,
		category: IProductCategories.Smartphones,
		images: [
			{ file: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png' }
		],
		features: ['Nuevo', '4G', '8GB ram', '256GB ']
	}
];

function createProductPromises(products: IProductCreateDTO[]) {
	return products.map((product) => ProductService.createProduct(product));
}

const seedDatabase = async (): Promise<void> => {
	const products = [...productsLucho, ...productsLuchito];
	try {
		// Conectar a MongoDB
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		// Limpiar la colección existente
		await Product.deleteMany({});
		console.log('🗑️ Productos existentes eliminados');

		// Insertar productos de prueba
		const createdProducts = await Promise.allSettled(createProductPromises(products));
		console.log(`✨ ${createdProducts.length} productos de prueba creados`);

		// Mostrar algunos productos creados
		console.log('\n📦 Productos creados:');
		// createdProducts.slice(0, 3).forEach((product, index) => {
		// 	console.log(
		// 		`${index + 1}. ${product.brand + ' ' + product.model} - $${product.prices.efectivo_transferencia} (${
		// 			product.discount
		// 		}% descuento)`
		// 	);
		// });

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
