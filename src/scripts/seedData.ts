import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product';
import { IProductCreate } from '../types/product.types';

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

const sampleProducts: IProductCreate[] = [
	{
		name: 'Xiaomi 14T Pro 512GB 12GB RAM 5G Gray',
		stock: 100,
		price: 504.5,
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
		price: 194.25,
		discount: 0,
		rating: 5.0,
		reviews: 232,
		stock: 150,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_947415-MLA73061395543_112023-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_947415-MLA73061395543_112023-F.webp'
		},
		features: ['Carga rápida', 'Dual SIM', 'Conectividad USB-C']
	},
	{
		name: 'Xiaomi Note 14 128GB 6GB RAM Black',
		price: 126.75,
		discount: 0,
		rating: 4.8,
		reviews: 234,
		stock: 200,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp'
		},
		features: ['Pantalla AMOLED', 'Dual SIM', 'MIUI 14']
	},
	{
		name: 'Xiaomi Note 14 256GB 8GB RAM Black',
		price: 150.25,
		discount: 5,
		rating: 4.1,
		reviews: 107,
		stock: 80,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_804679-MLA82609666421_022025-F.webp'
		},
		features: ['Pantalla AMOLED', 'Cámara triple', 'Actualización garantizada']
	},
	{
		name: 'Xiaomi Note 14 Pro 256GB 8GB RAM 5G Black',
		price: 239.75,
		discount: 10,
		rating: 4.8,
		reviews: 471,
		stock: 120,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp'
		},
		features: ['Sensor de proximidad', 'Alta batería', 'Conectividad USB-C']
	},
	{
		name: 'Xiaomi Note 14 Pro+ 256GB 8GB RAM 5G Black',
		price: 286.5,
		discount: 15,
		rating: 4.8,
		reviews: 166,
		stock: 90,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp'
		},
		features: ['Carga rápida', 'Diseño liviano', 'MIUI 14']
	},
	{
		name: 'Xiaomi Note 14 Pro+ 512GB 12GB RAM 5G Purple',
		price: 336.5,
		discount: 10,
		rating: 4.9,
		reviews: 318,
		stock: 70,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Android 13']
	},
	{
		name: 'Xiaomi Note 14 Pro 256GB 8GB RAM 4G',
		price: 288,
		discount: 10,
		rating: 4.9,
		reviews: 318,
		stock: 70,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_877874-MLA82154417427_012025-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Android 13']
	},
	{
		name: 'Xiaomi Note 14S 256GB 8GB RAM Black',
		price: 177.5,
		discount: 15,
		rating: 4.3,
		reviews: 259,
		stock: 110,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_899882-MLA83466716865_042025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_899882-MLA83466716865_042025-F.webp'
		},
		features: ['Pantalla AMOLED', 'Cámara triple', 'MIUI 14']
	},
	{
		name: 'Xiaomi Poco C71 64GB 3GB RAM Black',
		price: 54.5,
		discount: 10,
		rating: 4.4,
		reviews: 83,
		stock: 300,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_609355-MLA84093363728_052025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_609355-MLA84093363728_052025-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Android 13']
	},
	{
		name: 'Xiaomi Poco X6 Pro 512GB 12GB RAM 5G Black',
		price: 267.0,
		discount: 0,
		rating: 4.0,
		reviews: 480,
		stock: 60,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_660762-MLA74048129932_012024-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_660762-MLA74048129932_012024-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Actualización garantizada']
	},
	{
		name: 'Xiaomi Redmi 13 128GB 6GB RAM Black',
		price: 89.75,
		discount: 0,
		rating: 4.6,
		reviews: 152,
		stock: 180,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_900918-MLA84154192425_042025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_900918-MLA84154192425_042025-F.webp'
		},
		features: ['Carga rápida', 'Alta batería', 'Conectividad USB-C']
	},
	{
		name: 'Xiaomi Redmi A3X 64GB 3GB RAM Green',
		price: 57.0,
		discount: 5,
		rating: 4.6,
		reviews: 234,
		stock: 250,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_865914-MLA84516843358_052025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_865914-MLA84516843358_052025-F.webp'
		},
		features: ['5G', 'Cámara triple', 'Android 13']
	},
	{
		name: 'Xiaomi Redmi A5 64GB 3GB RAM Gold',
		price: 57.0,
		discount: 15,
		rating: 4.4,
		reviews: 351,
		stock: 130,
		image: {
			light: 'https://http2.mlstatic.com/D_NQ_NP_2X_977889-MLA83232263510_042025-F.webp',
			dark: 'https://http2.mlstatic.com/D_NQ_NP_2X_977889-MLA83232263510_042025-F.webp'
		},
		features: ['5G', 'Diseño liviano', 'Android 13']
	}
];

const productsLucho: IProductCreate[] = [
	// SAMSUNG
	{
		name: 'Samsung A16 4/128',
		price: 222999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$',
			dark: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'Samsung A16 6/128',
		price: 255999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$',
			dark: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
		},
		features: ['6GB RAM', '128GB almacenamiento']
	},
	{
		name: 'Samsung A16 8/256',
		price: 277000 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$',
			dark: 'https://images.samsung.com/is/image/samsung/p6pim/ar/sm-a166mzafaro/gallery/ar-galaxy-a16-5g-sm-a166-sm-a166mzafaro-544452887?$684_547_PNG$'
		},
		features: ['8GB RAM', '256GB almacenamiento']
	},
	{
		name: 'Samsung A26 8/256',
		price: 380999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg',
			dark: 'https://acdn-us.mitiendanube.com/stores/001/155/056/products/negro-a12d0c17bf0f7e15f517498239894694-1024-1024.jpg'
		},
		features: ['8GB RAM', '256GB almacenamiento']
	},
	{
		name: 'Samsung A06 4/64',
		price: 151500 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png'
		},
		features: ['4GB RAM', '64GB almacenamiento']
	},
	{
		name: 'Samsung A06 4/128',
		price: 174000 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/s/a/samsung-a06-black-front_4.png'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},

	// MOTOROLA
	{
		name: 'Motorola E15 2/64',
		price: 134999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-e15-mistyblue-front_back.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-e15-mistyblue-front_back.png'
		},
		features: ['2GB RAM', '64GB almacenamiento']
	},
	{
		name: 'Motorola G05 4/128',
		price: 167999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-g05-forestgreen-front_back.png',
			dark: 'https://tiendaonline.movistar.com.ar/media/catalog/product/m/o/moto-g05-forestgreen-front_back.png'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'Motorola G15 4/128',
		price: 186499 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg',
			dark: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'Motorola G15 4/256',
		price: 205999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg',
			dark: 'https://ar.celulares.com/fotos/motorola-moto-g15-power-97991-g.jpg'
		},
		features: ['4GB RAM', '256GB almacenamiento']
	},
	{
		name: 'Motorola G35 4/256',
		price: 231999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://www.megatone.net/images/Articulos/zoom2x/209/MKT0710MHM-1.png',
			dark: 'https://www.megatone.net/images/Articulos/zoom2x/209/MKT0710MHM-1.png'
		},
		features: ['4GB RAM', '256GB almacenamiento']
	},
	{
		name: 'Motorola G55 5G 8/256',
		price: 299499 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://i.zst.com.br/thumbs/12/17/14/-1533012903.jpg',
			dark: 'https://i.zst.com.br/thumbs/12/17/14/-1533012903.jpg'
		},
		features: ['8GB RAM', '256GB almacenamiento', '5G']
	},
	{
		name: 'Motorola G84 5G 8/256',
		price: 297999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://cdn.smart-gsm.com/blog/wp-content/uploads/2023/09/motorola-moto-g84_4.jpg',
			dark: 'https://cdn.smart-gsm.com/blog/wp-content/uploads/2023/09/motorola-moto-g84_4.jpg'
		},
		features: ['8GB RAM', '256GB almacenamiento', '5G']
	},

	// XIAOMI
	{
		name: 'Xiaomi A5 4/128',
		price: 152500 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/236/748/products/whatsapp-image-2025-06-26-at-5-29-23-pm-858d7a6f788714dab417509697967180-1024-1024.jpg',
			dark: 'https://acdn-us.mitiendanube.com/stores/236/748/products/whatsapp-image-2025-06-26-at-5-29-23-pm-858d7a6f788714dab417509697967180-1024-1024.jpg'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'Xiaomi 14C 4/128',
		price: 175000 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg',
			dark: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'Xiaomi 14C 4/256',
		price: 188000 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg',
			dark: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
		},
		features: ['4GB RAM', '256GB almacenamiento']
	},
	{
		name: 'Xiaomi 14C 8/256',
		price: 205000 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg',
			dark: 'https://www.heavenimagenes.com/heavencommerce/7a1fcd03-6179-4c60-bec2-35692a1ae7ae/images/v2/XIAOMI/19061_xlarge.jpg'
		},
		features: ['8GB RAM', '256GB almacenamiento']
	},
	{
		name: 'Xiaomi Note 14 6/128',
		price: 241499 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.ventaconcretada.com/wp-content/uploads/2025/01/xiaomi-redmi-note-14-4G-2025.webp',
			dark: 'https://www.ventaconcretada.com/wp-content/uploads/2025/01/xiaomi-redmi-note-14-4G-2025.webp'
		},
		features: ['6GB RAM', '128GB almacenamiento']
	},
	{
		name: 'Xiaomi Note 14 Pro 8/256',
		price: 372999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://acdn-us.mitiendanube.com/stores/052/917/products/diseno-sin-titulo-2025-01-21t202211-877-c121844a3f980ee77c17375017810763-1024-1024.png',
			dark: 'https://acdn-us.mitiendanube.com/stores/052/917/products/diseno-sin-titulo-2025-01-21t202211-877-c121844a3f980ee77c17375017810763-1024-1024.png'
		},
		features: ['8GB RAM', '256GB almacenamiento']
	},

	// POCO / REALME
	{
		name: 'POCO C71 4/128',
		price: 149999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://dcdn-us.mitiendanube.com/stores/001/743/766/products/75e58b2eba44f669a24ca986a11cf0be-eec5525558f45d49d717456821894599-1024-1024.jpg',
			dark: 'https://dcdn-us.mitiendanube.com/stores/001/743/766/products/75e58b2eba44f669a24ca986a11cf0be-eec5525558f45d49d717456821894599-1024-1024.jpg'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'POCO C75 6/128',
		price: 167499 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 5,
		image: {
			light: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png',
			dark: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png'
		},
		features: ['6GB RAM', '128GB almacenamiento']
	},
	{
		name: 'POCO C75 8/256',
		price: 198999 / 1295,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png',
			dark: 'https://fixechelectronica.com.ar/wp-content/uploads/2024/12/Poco-C75-3.png'
		},
		features: ['8GB RAM', '256GB almacenamiento']
	}
];

const productsLuchito: IProductCreate[] = [
	{
		name: 'iPhone 11 64gb',
		price: 285,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg',
			dark: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 11 128gb',
		price: 315,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg',
			dark: 'https://www.arrichetta.com.ar/wp-content/uploads/2020/04/iphone-11-Negro.jpg'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 12 64gb (Grado AB)',
		price: 285,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 12 128gb (Grado AB)',
		price: 320,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 12 128gb (Grado A+)',
		price: 345,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 12 pro (caja) 128GB',
		price: 410,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 12 pro (Caja) 256GB',
		price: 430,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 13 128GB (A+)',
		price: 420,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 13 256GB (A+ Caja)',
		price: 470,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 13 128GB SELLADO',
		price: 590,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 14 128GB (Caja)',
		price: 470,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701',
			dark: 'https://buy.gazelle.com/cdn/shop/files/iPhone_12_-_Black_-_Overlap_Trans-cropped_35b3e9dd-e7da-4979-9b74-95368554e55e.jpg?v=1753395701'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 14 Pro 128GB',
		price: 620,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp',
			dark: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 14 Pro Max 128GB',
		price: 720,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp',
			dark: 'https://http2.mlstatic.com/D_Q_NP_651710-MLM51559386433_092022-O.webp'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 15 128GB SELLADO',
		price: 780,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://cdn-ipoint.waugi.com.ar/26703-thickbox_default/iphone-15-pro-max-256gb.jpg',
			dark: 'https://cdn-ipoint.waugi.com.ar/26703-thickbox_default/iphone-15-pro-max-256gb.jpg'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	},
	{
		name: 'iPhone 16 128GB SELLADO',
		price: 870,
		discount: 0,
		rating: 0,
		reviews: 0,
		stock: 10,
		image: {
			light: 'https://www.1p.sg/cdn/shop/files/iPhone-16-Black_1cebd178-ed7b-4386-983e-e3aca356bd31.jpg?v=1750415943&width=1445',
			dark: 'https://www.1p.sg/cdn/shop/files/iPhone-16-Black_1cebd178-ed7b-4386-983e-e3aca356bd31.jpg?v=1750415943&width=1445'
		},
		features: ['4GB RAM', '128GB almacenamiento']
	}
];

function createProductsWithPrices(products: IProductCreate[], dolarHoy: number) {
	return products.map((product) => {
		const myCommission = 50000;

		const ualaSalesCommission = 0.049;
		const IVA = 1.21;
		const ualaSalesCommissionWithIVA = ualaSalesCommission * IVA;

		const threeInstallmentsCFT = 0.0869 * IVA; // 3 cuotas sin interés 8.69% + IVA
		const sixInstallmentsCFT = 0.1439 * IVA; // 6 cuotas sin interés 14,39% + IVA
		// Precio del producto viene en dolares
		const productBaseUSD = product.price;

		// Precio en Pesos Argentinos con mi comisión
		const basePriceARS = productBaseUSD * dolarHoy + myCommission;

		// Precio final absorbiendo comisión Uala
		const priceWithUala = basePriceARS / (1 - ualaSalesCommissionWithIVA);
		// Precio final sin intervención de Uala
		const priceWithOutUala = basePriceARS;

		/* 		// Precio con 3 cuotas sin interés absorbidas por mi
		const price3Cuotas = priceWithUala * (1 + threeInstallmentsCFT);
		const cuota3 = price3Cuotas / 3;

		// Precio con 6 cuotas sin interés absorbidas por mi
		const price6Cuotas = priceWithUala * (1 + sixInstallmentsCFT);
		const cuota6 = price6Cuotas / 6; */
		const price6Cuotas = priceWithUala * (1 + sixInstallmentsCFT);
		const cuota3 = price6Cuotas / 3;
		const cuota6 = price6Cuotas / 6;

		return {
			...product,
			prices: {
				efectivo_transferencia: Math.round(priceWithOutUala),
				tarjeta_credito_debito: Math.round(price6Cuotas),
				tarjeta_credito_3_cuotas: Math.round(price6Cuotas),
				tarjeta_credito_6_cuotas: Math.round(price6Cuotas),
				cuotas: {
					'3_cuotas_sin_interes': Math.round(cuota3),
					'6_cuotas_sin_interes': Math.round(cuota6)
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
				`${index + 1}. ${product.name} - $${product.prices.efectivo_transferencia} (${
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
