import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product';
import { IProductCreate } from '../types/product.types';

// Cargar variables de entorno
dotenv.config();

const sampleProducts: IProductCreate[] = [
	{
		name: 'Xiaomi 14T Pro 512GB 12GB RAM 5G Gray',
		price: 504.5 / 0.922681,
		discount: 5,
		rating: 4.7,
		reviews: 100,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_978043-MLA81976272653_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_978043-MLA81976272653_012025-F.webp'
		},
		features: ['Carga rápida', 'Cámara triple', 'Actualización garantizada']
	},
	{
		name: 'Xiaomi Note 13 Pro 256GB 8GB RAM 5G Blue',
		price: 194.25 / 0.922681,
		discount: 0,
		rating: 5.0,
		reviews: 232,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_947415-MLA73061395543_112023-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_947415-MLA73061395543_112023-F.webp'
		},
		features: ['Carga rápida', 'Dual SIM', 'Conectividad USB-C']
	},
	{
		name: 'Xiaomi Note 14 128GB 6GB RAM Black',
		price: 126.75 / 0.922681,
		discount: 0,
		rating: 4.8,
		reviews: 234,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp'
		},
		features: ['Pantalla AMOLED', 'Dual SIM', 'MIUI 14']
	},
	{
		name: 'Xiaomi Note 14 256GB 8GB RAM Black',
		price: 150.25 / 0.922681,
		discount: 5,
		rating: 4.1,
		reviews: 107,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp'
		},
		features: ['Pantalla AMOLED', 'Cámara triple', 'Actualización garantizada']
	},
	{
		name: 'Xiaomi Note 14 Pro 256GB 8GB RAM 5G Black',
		price: 239.75 / 0.922681,
		discount: 10,
		rating: 4.8,
		reviews: 471,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp'
		},
		features: ['Sensor de proximidad', 'Alta batería', 'Conectividad USB-C']
	},
	{
		name: 'Xiaomi Note 14 Pro+ 256GB 8GB RAM 5G Black',
		price: 286.5 / 0.922681,
		discount: 15,
		rating: 4.8,
		reviews: 166,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp'
		},
		features: ['Carga rápida', 'Diseño liviano', 'MIUI 14']
	},
	{
		name: 'Xiaomi Note 14 Pro+ 512GB 12GB RAM 5G Purple',
		price: 336.5 / 0.922681,
		discount: 10,
		rating: 4.9,
		reviews: 318,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Android 13']
	},
	{
		name: 'Xiaomi Note 14S 256GB 8GB RAM Black',
		price: 177.5 / 0.922681,
		discount: 15,
		rating: 4.3,
		reviews: 259,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_899882-MLA83466716865_042025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_899882-MLA83466716865_042025-F.webp'
		},
		features: ['Pantalla AMOLED', 'Cámara triple', 'MIUI 14']
	},
	{
		name: 'Xiaomi Poco C71 64GB 3GB RAM Black',
		price: 54.5 / 0.922681,
		discount: 10,
		rating: 4.4,
		reviews: 83,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_609355-MLA84093363728_052025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_609355-MLA84093363728_052025-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Android 13']
	},
	{
		name: 'Xiaomi Poco X6 Pro 512GB 12GB RAM 5G Black',
		price: 267.0 / 0.922681,
		discount: 0,
		rating: 4.0,
		reviews: 480,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_660762-MLA74048129932_012024-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_660762-MLA74048129932_012024-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Actualización garantizada']
	},
	{
		name: 'Xiaomi Redmi 13 128GB 6GB RAM Black',
		price: 89.75 / 0.922681,
		discount: 0,
		rating: 4.6,
		reviews: 152,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_900918-MLA84154192425_042025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_900918-MLA84154192425_042025-F.webp'
		},
		features: ['Carga rápida', 'Alta batería', 'Conectividad USB-C']
	},
	{
		name: 'Xiaomi Redmi A3X 64GB 3GB RAM Green',
		price: 57.0 / 0.922681,
		discount: 5,
		rating: 4.6,
		reviews: 234,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_865914-MLA84516843358_052025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_865914-MLA84516843358_052025-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Android 13']
	},
	{
		name: 'Xiaomi Redmi A5 64GB 3GB RAM Gold',
		price: 57.0 / 0.922681,
		discount: 15,
		rating: 4.4,
		reviews: 351,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_977889-MLA83232263510_042025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_977889-MLA83232263510_042025-F.webp'
		},
		features: ['5G', 'Diseño liviano', 'Android 13']
	}
];

const seedDatabase = async (): Promise<void> => {
	try {
		// Conectar a MongoDB
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		// Limpiar la colección existente
		await Product.deleteMany({});
		console.log('🗑️ Productos existentes eliminados');

		// Insertar productos de prueba
		const createdProducts = await Product.insertMany(sampleProducts);
		console.log(`✨ ${createdProducts.length} productos de prueba creados`);

		// Mostrar algunos productos creados
		console.log('\n📦 Productos creados:');
		createdProducts.slice(0, 3).forEach((product, index) => {
			console.log(
				`${index + 1}. ${product.name} - $${product.price} (${product.discount}% descuento)`
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
