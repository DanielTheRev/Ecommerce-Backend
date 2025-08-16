import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product';
import { IProductCreate } from '../types/product.types';
import slugify from 'slugify';

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
		price: 222999 / 1350,
		model: 'A16',
		brand: 'Samsung',
		shortDescription: 'Samsung A16 4/128',
		largeDescription: 'Samsung A16 4/128',
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
		price: 255999 / 1350,
		model: 'A16',
		brand: 'Samsung',
		shortDescription: 'Samsung A16 6/128',
		largeDescription: 'Samsung A16 6/128',
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
		price: 277000 / 1350,
		model: 'A16',
		brand: 'Samsung',
		shortDescription: 'Samsung A16 8/256',
		largeDescription: 'Samsung A16 8/256',
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
		price: 380999 / 1350,
		model: 'A26',
		brand: 'Samsung',
		shortDescription: 'Samsung A26 8/256',
		largeDescription: 'Samsung A26 8/256',
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
		price: 151500 / 1350,
		model: 'A06',
		brand: 'Samsung',
		shortDescription: 'Samsung A06 4/64',
		largeDescription: 'Samsung A06 4/64',
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
		price: 174000 / 1350,
		model: 'A06',
		brand: 'Samsung',
		shortDescription: 'Samsung A06 4/128',
		largeDescription: 'Samsung A06 4/128',
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
		price: 134999 / 1350,
		model: 'E15',
		brand: 'Motorola',
		shortDescription: 'Motorola E15 2/64',
		largeDescription: 'Motorola E15 2/64',
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
		price: 167999 / 1350,
		model: 'G05',
		brand: 'Motorola',
		shortDescription: 'Motorola G05 4/128',
		largeDescription: 'Motorola G05 4/128',
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
		price: 186499 / 1350,
		model: 'G15',
		brand: 'Motorola',
		shortDescription: 'Motorola G15 4/128',
		largeDescription: 'Motorola G15 4/128',
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
		price: 205999 / 1350,
		model: 'G15',
		brand: 'Motorola',
		shortDescription: 'Motorola G15 4/256',
		largeDescription: 'Motorola G15 4/256',
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
		price: 231999 / 1350,
		model: 'G35',
		brand: 'Motorola',
		shortDescription: 'Motorola G35 4/256',
		largeDescription: 'Motorola G35 4/256',
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
		price: 299499 / 1350,
		model: 'G55',
		brand: 'Motorola',
		shortDescription: 'Motorola G55 5G 8/256',
		largeDescription: 'Motorola G55 5G 8/256',
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
		price: 297999 / 1350,
		model: 'G84',
		brand: 'Motorola',
		shortDescription: 'Motorola G84 5G 8/256',
		largeDescription: 'Motorola G84 5G 8/256',
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
		price: 152500 / 1350,
		model: 'A5',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi A5 4/128',
		largeDescription: 'Xiaomi A5 4/128',
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
		price: 175000 / 1350,
		model: '14C',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C 4/128',
		largeDescription: 'Xiaomi 14C 4/128',
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
		price: 188000 / 1350,
		model: '14C',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C 4/256',
		largeDescription: 'Xiaomi 14C 4/256',
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
		price: 205000 / 1350,
		model: '14C',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi 14C 8/256',
		largeDescription: 'Xiaomi 14C 8/256',
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
		price: 241499 / 1350,
		model: 'Note 14',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi Note 14 6/128',
		largeDescription: 'Xiaomi Note 14 6/128',
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
		price: 372999 / 1350,
		model: 'Note 14 Pro',
		brand: 'Xiaomi',
		shortDescription: 'Xiaomi Note 14 Pro 8/256',
		largeDescription: 'Xiaomi Note 14 Pro 8/256',
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
		price: 149999 / 1350,
		model: 'C71',
		brand: 'POCO',
		shortDescription: 'POCO C71 4/128',
		largeDescription: 'POCO C71 4/128',
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
		price: 167499 / 1350,
		model: 'C75',
		brand: 'POCO',
		shortDescription: 'POCO C75 6/128',
		largeDescription: 'POCO C75 6/128',
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
		price: 198999 / 1350,
		model: 'C75',
		brand: 'POCO',
		shortDescription: 'POCO C75 8/256',
		largeDescription: 'POCO C75 8/256',
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
		price: 285,
		model: 'iPhone 11',
		brand: 'Apple',
		shortDescription: 'iPhone 11 64gb',
		largeDescription: 'iPhone 11 64gb',
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
		price: 315,
		model: 'iPhone 11',
		brand: 'Apple',
		shortDescription: 'iPhone 11 128gb',
		largeDescription: 'iPhone 11 128gb',
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
		price: 285,
		model: 'iPhone 12 (Grado AB)',
		brand: 'Apple',
		shortDescription: 'iPhone 12 64gb (Grado AB)',
		largeDescription: 'iPhone 12 64gb (Grado AB)',
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
		price: 320,
		model: 'iPhone 12 128gb (Grado AB)',
		brand: 'Apple',
		shortDescription: 'iPhone 12 128gb (Grado AB)',
		largeDescription: 'iPhone 12 128gb (Grado AB)',
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
		price: 345,
		model: 'iPhone 12 128gb (Grado A+)',
		brand: 'Apple',
		shortDescription: 'iPhone 12 128gb (Grado A+)',
		largeDescription: 'iPhone 12 128gb (Grado A+)',
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
		price: 410,
		model: 'iPhone 12 pro (caja) 128GB',
		brand: 'Apple',
		shortDescription: 'iPhone 12 pro (caja) 128GB',
		largeDescription: 'iPhone 12 pro (caja) 128GB',
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
		price: 430,
		model: 'iPhone 12 pro (Caja) 256GB',
		brand: 'Apple',
		shortDescription: 'iPhone 12 pro (Caja) 256GB',
		largeDescription: 'iPhone 12 pro (Caja) 256GB',
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
		price: 420,
		model: 'iPhone 13 128GB (A+)',
		brand: 'Apple',
		shortDescription: 'iPhone 13 128GB (A+)',
		largeDescription: 'iPhone 13 128GB (A+)',
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
		price: 470,
		model: 'iPhone 13 256GB (A+ Caja)',
		brand: 'Apple',
		shortDescription: 'iPhone 13 256GB (A+ Caja)',
		largeDescription: 'iPhone 13 256GB (A+ Caja)',
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
		price: 590,
		model: 'iPhone 13 128GB SELLADO',
		brand: 'Apple',
		shortDescription: 'iPhone 13 128GB SELLADO',
		largeDescription: 'iPhone 13 128GB SELLADO',
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
		price: 470,
		model: 'iPhone 14 128GB (Caja)',
		brand: 'Apple',
		shortDescription: 'iPhone 14 128GB (Caja)',
		largeDescription: 'iPhone 14 128GB (Caja)',
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
		price: 620,
		model: 'iPhone 14 Pro 128GB',
		brand: 'Apple',
		shortDescription: 'iPhone 14 Pro 128GB',
		largeDescription: 'iPhone 14 Pro 128GB',
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
		price: 720,
		model: 'iPhone 14 Pro Max 128GB',
		brand: 'Apple',
		shortDescription: 'iPhone 14 Pro Max 128GB',
		largeDescription: 'iPhone 14 Pro Max 128GB',
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
		price: 780,
		model: 'iPhone 15 128GB SELLADO',
		brand: 'Apple',
		shortDescription: 'iPhone 15 128GB SELLADO',
		largeDescription: 'iPhone 15 128GB SELLADO',
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
		price: 870,
		model: 'iPhone 16 128GB SELLADO',
		brand: 'Apple',
		shortDescription: 'iPhone 16 128GB SELLADO',
		largeDescription: 'iPhone 16 128GB SELLADO',
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
		product.slug = slugify(product.shortDescription, {
			lower: true,
			strict: true
		});

		const MiGanancia = product.brand === 'Apple' ? 0.1 : 0.30;

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
