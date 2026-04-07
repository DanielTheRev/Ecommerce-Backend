
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from '../models/Product.model';
import { TechProduct } from '../models/discriminators/TechProduct.discriminator';
import { ClothingProduct } from '../models/discriminators/ClothingProduct.discriminator';
import { getDolar } from '@/services/dolar.service';
import { PaymentService } from '@/services/Payment.service';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import slugify from 'slugify';

dotenv.config();

function genSlug(brand: string, model: string) {
	return slugify(`${brand}-${model}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, { lower: true, strict: true });
}

function sku(prefix: string, i: number, suffix: string) {
	return `${prefix}-${String(i).padStart(3, '0')}-${suffix}`.toUpperCase();
}

// ============ TECH SEED DATA ============
function getTechProducts() {
	const items: any[] = [];
	let idx = 1;

	// Smartphones Samsung
	const samsungModels = [
		{ model: 'A06', price: 102, ram: '4GB', storages: ['64GB', '128GB'] },
		{ model: 'A16', price: 150, ram: '4GB', storages: ['128GB', '256GB'] },
		{ model: 'A26', price: 257, ram: '8GB', storages: ['256GB'] },
		{ model: 'A35', price: 302, ram: '8GB', storages: ['128GB', '256GB'] },
		{ model: 'A55', price: 390, ram: '8GB', storages: ['256GB'] },
		{ model: 'S24', price: 850, ram: '8GB', storages: ['128GB', '256GB'] },
		{ model: 'S24 Ultra', price: 1200, ram: '12GB', storages: ['256GB', '512GB'] },
	];
	for (const s of samsungModels) {
		items.push({
			brand: 'Samsung', model: s.model, price: s.price,
			category: 'Smartphones',
			shortDescription: `Samsung Galaxy ${s.model} - Smartphone de última generación`,
			largeDescription: `<p>El Samsung Galaxy ${s.model} combina rendimiento y diseño en un smartphone potente.</p>`,
			features: ['Nuevo', '5G', `${s.ram} RAM`],
			specifications: [{ key: 'RAM', value: s.ram }, { key: 'Pantalla', value: '6.5"' }],
			ram: s.ram, processor: 'Exynos', os: 'Android 14', screenSize: '6.5"',
			storage: s.storages,
			variants: s.storages.flatMap(st => [
				{ sku: sku('SAM', idx, st.replace('GB', '')), attributes: [{ key: 'Storage', value: st }, { key: 'Color', value: 'Negro' }], color: { name: 'Negro', hex: '#000000' }, stock: 10, reservedStock: 0, isActive: true, images: [] },
				{ sku: sku('SAM', idx, st.replace('GB', '') + 'W'), attributes: [{ key: 'Storage', value: st }, { key: 'Color', value: 'Blanco' }], color: { name: 'Blanco', hex: '#FFFFFF' }, stock: 8, reservedStock: 0, isActive: true, images: [] },
			])
		});
		idx++;
	}

	// iPhones
	const iphones = [
		{ model: 'iPhone 12', price: 320, storage: ['128GB'] },
		{ model: 'iPhone 13', price: 470, storage: ['128GB', '256GB'] },
		{ model: 'iPhone 14', price: 590, storage: ['128GB', '256GB'] },
		{ model: 'iPhone 14 Pro', price: 700, storage: ['128GB', '256GB'] },
		{ model: 'iPhone 15', price: 780, storage: ['128GB', '256GB'] },
		{ model: 'iPhone 15 Pro', price: 950, storage: ['256GB', '512GB'] },
		{ model: 'iPhone 16', price: 870, storage: ['128GB', '256GB'] },
		{ model: 'iPhone 16 Pro', price: 1120, storage: ['256GB', '512GB'] },
		{ model: 'iPhone 16 Pro Max', price: 1300, storage: ['256GB', '512GB', '1TB'] },
	];
	for (const ip of iphones) {
		items.push({
			brand: 'Apple', model: ip.model, price: ip.price,
			category: 'Smartphones',
			shortDescription: `Apple ${ip.model} - Experiencia premium`,
			largeDescription: `<p>${ip.model} con chip de última generación y cámara profesional.</p>`,
			features: ['Nuevo', '5G', 'Face ID'], specifications: [{ key: 'Chip', value: 'A-Series' }],
			ram: '6GB', processor: 'Apple Bionic', os: 'iOS 18', screenSize: '6.1"',
			storage: ip.storage,
			variants: ip.storage.flatMap(st => [
				{ sku: sku('APL', idx, st.replace('GB', '').replace('TB', 'T')), attributes: [{ key: 'Storage', value: st }, { key: 'Color', value: 'Negro' }], color: { name: 'Negro', hex: '#1C1C1E' }, stock: 5, reservedStock: 0, isActive: true, images: [] },
			])
		});
		idx++;
	}

	// Motorola
	const motos = [
		{ model: 'E15', price: 91, ram: '2GB', storage: ['64GB'] },
		{ model: 'G05', price: 113, ram: '4GB', storage: ['128GB'] },
		{ model: 'G15', price: 126, ram: '4GB', storage: ['128GB', '256GB'] },
		{ model: 'G55', price: 202, ram: '8GB', storage: ['256GB'] },
	];
	for (const m of motos) {
		items.push({
			brand: 'Motorola', model: m.model, price: m.price,
			category: 'Smartphones',
			shortDescription: `Motorola Moto ${m.model}`, largeDescription: `<p>Moto ${m.model}, gran relación precio-calidad.</p>`,
			features: ['Nuevo', '4G', `${m.ram} RAM`], specifications: [{ key: 'RAM', value: m.ram }],
			ram: m.ram, processor: 'MediaTek', os: 'Android 14',
			storage: m.storage,
			variants: m.storage.map(st => ({ sku: sku('MOT', idx, st.replace('GB', '')), attributes: [{ key: 'Storage', value: st }], stock: 15, reservedStock: 0, isActive: true, images: [] }))
		});
		idx++;
	}

	// Xiaomi
	const xiaomis = [
		{ model: 'Redmi A5', price: 103, ram: '4GB', storage: ['128GB'] },
		{ model: 'Redmi 14C', price: 118, ram: '4GB', storage: ['128GB', '256GB'] },
		{ model: 'Note 14 Pro', price: 252, ram: '8GB', storage: ['256GB'] },
	];
	for (const x of xiaomis) {
		items.push({
			brand: 'Xiaomi', model: x.model, price: x.price,
			category: 'Smartphones',
			shortDescription: `Xiaomi ${x.model}`, largeDescription: `<p>Xiaomi ${x.model} con tecnología Snapdragon.</p>`,
			features: ['Nuevo', '4G', `${x.ram} RAM`], specifications: [{ key: 'RAM', value: x.ram }],
			ram: x.ram, processor: 'Snapdragon', os: 'Android 14', storage: x.storage,
			variants: x.storage.map(st => ({ sku: sku('XIA', idx, st.replace('GB', '')), attributes: [{ key: 'Storage', value: st }], stock: 12, reservedStock: 0, isActive: true, images: [] }))
		});
		idx++;
	}

	// Consolas
	const consolas = [
		{ brand: 'Sony', model: 'PlayStation 5 Slim', price: 520, cat: 'Consolas' },
		{ brand: 'Sony', model: 'PlayStation 5 Pro', price: 750, cat: 'Consolas' },
		{ brand: 'Microsoft', model: 'Xbox Series X', price: 480, cat: 'Consolas' },
		{ brand: 'Microsoft', model: 'Xbox Series S', price: 280, cat: 'Consolas' },
		{ brand: 'Nintendo', model: 'Switch OLED', price: 310, cat: 'Consolas' },
	];
	for (const c of consolas) {
		items.push({
			brand: c.brand, model: c.model, price: c.price, category: c.cat,
			shortDescription: `${c.brand} ${c.model}`, largeDescription: `<p>Consola ${c.model} de última generación.</p>`,
			features: ['Nuevo', 'Sellado'], specifications: [{ key: 'Tipo', value: 'Consola' }],
			storage: [],
			variants: [{ sku: sku('CON', idx, 'STD'), attributes: [{ key: 'Edición', value: 'Standard' }], stock: 8, reservedStock: 0, isActive: true, images: [] }]
		});
		idx++;
	}

	// TVs
	const tvs = [
		{ brand: 'Samsung', model: 'Crystal UHD 50"', price: 420 },
		{ brand: 'Samsung', model: 'Neo QLED 55"', price: 890 },
		{ brand: 'LG', model: 'NanoCell 50"', price: 380 },
		{ brand: 'LG', model: 'OLED C4 55"', price: 1100 },
	];
	for (const t of tvs) {
		items.push({
			brand: t.brand, model: t.model, price: t.price, category: 'Pantallas',
			shortDescription: `${t.brand} ${t.model} Smart TV`, largeDescription: `<p>Televisor ${t.brand} ${t.model} con resolución 4K.</p>`,
			features: ['4K', 'Smart TV', 'HDR'], specifications: [{ key: 'Resolución', value: '4K UHD' }],
			screenSize: t.model.match(/\d+"/)?.[0] || '55"', storage: [],
			variants: [{ sku: sku('TV', idx, 'BLK'), attributes: [{ key: 'Color', value: 'Negro' }], stock: 6, reservedStock: 0, isActive: true, images: [] }]
		});
		idx++;
	}

	return items;
}

// ============ CLOTHING SEED DATA ============
function getClothingProducts() {
	const items: any[] = [];
	let idx = 1;
	const sizes = ['S', 'M', 'L', 'XL'];
	const shoeSizes = ['38', '39', '40', '41', '42', '43', '44'];

	// Remeras
	const remeras = [
		{ brand: 'Nike', model: 'Dri-FIT Legend', price: 35, material: 'Poliéster' },
		{ brand: 'Nike', model: 'Sportswear Club', price: 30, material: 'Algodón' },
		{ brand: 'Adidas', model: 'Essentials 3 Rayas', price: 28, material: 'Algodón' },
		{ brand: 'Adidas', model: 'Trefoil Tee', price: 32, material: 'Algodón' },
		{ brand: 'Puma', model: 'ESS Logo Tee', price: 25, material: 'Algodón' },
		{ brand: 'Under Armour', model: 'Tech 2.0', price: 38, material: 'Poliéster' },
		{ brand: 'Topper', model: 'Básica Training', price: 15, material: 'Algodón' },
		{ brand: 'Levi\'s', model: 'Classic Tee', price: 40, material: 'Algodón' },
	];
	for (const r of remeras) {
		items.push({
			brand: r.brand, model: r.model, price: r.price, category: 'Remeras',
			shortDescription: `Remera ${r.brand} ${r.model}`, largeDescription: `<p>Remera ${r.brand} ${r.model}, ideal para el día a día.</p>`,
			features: ['Nueva', r.material], specifications: [{ key: 'Material', value: r.material }],
			gender: 'Hombre', fit: 'Regular', material: r.material, sizeType: 'Ropa',
			composition: [{ material: r.material, percentage: 100 }],
			variants: sizes.flatMap(s => [
				{ sku: sku('REM', idx, `${s}-BLK`), attributes: [{ key: 'Talle', value: s }, { key: 'Color', value: 'Negro' }], color: { name: 'Negro', hex: '#000000' }, stock: 20, reservedStock: 0, isActive: true, images: [] },
				{ sku: sku('REM', idx, `${s}-WHT`), attributes: [{ key: 'Talle', value: s }, { key: 'Color', value: 'Blanco' }], color: { name: 'Blanco', hex: '#FFFFFF' }, stock: 15, reservedStock: 0, isActive: true, images: [] },
			])
		});
		idx++;
	}

	// Pantalones
	const pantalones = [
		{ brand: 'Nike', model: 'Jogger Sportswear', price: 55, material: 'French Terry' },
		{ brand: 'Adidas', model: 'Tiro 24', price: 50, material: 'Poliéster reciclado' },
		{ brand: 'Puma', model: 'ESS Slim Pants', price: 42, material: 'Algodón' },
		{ brand: 'Levi\'s', model: 'Jean 501 Original', price: 75, material: 'Denim' },
		{ brand: 'Levi\'s', model: 'Jean 511 Slim', price: 70, material: 'Denim' },
		{ brand: 'Wrangler', model: 'Classic Regular', price: 60, material: 'Denim' },
	];
	for (const p of pantalones) {
		items.push({
			brand: p.brand, model: p.model, price: p.price, category: 'Pantalones',
			shortDescription: `Pantalón ${p.brand} ${p.model}`, largeDescription: `<p>${p.brand} ${p.model}, comodidad y estilo.</p>`,
			features: ['Nuevo', p.material], specifications: [{ key: 'Material', value: p.material }],
			gender: 'Hombre', fit: p.model.includes('Slim') ? 'Slim' : 'Regular', material: p.material, sizeType: 'Ropa',
			variants: sizes.map(s => ({ sku: sku('PAN', idx, `${s}-NVY`), attributes: [{ key: 'Talle', value: s }, { key: 'Color', value: 'Azul' }], color: { name: 'Azul', hex: '#1A237E' }, stock: 12, reservedStock: 0, isActive: true, images: [] }))
		});
		idx++;
	}

	// Buzos / Hoodies
	const buzos = [
		{ brand: 'Nike', model: 'Club Fleece Hoodie', price: 65, material: 'French Terry' },
		{ brand: 'Adidas', model: 'Essentials Hoodie', price: 58, material: 'Algodón French Terry' },
		{ brand: 'Puma', model: 'ESS Big Logo Hoodie', price: 48, material: 'Algodón' },
		{ brand: 'Under Armour', model: 'Rival Fleece', price: 62, material: 'Poliéster Fleece' },
		{ brand: 'Champion', model: 'Powerblend Hoodie', price: 55, material: 'Algodón Blend' },
	];
	for (const b of buzos) {
		items.push({
			brand: b.brand, model: b.model, price: b.price, category: 'Buzos',
			shortDescription: `Buzo ${b.brand} ${b.model}`, largeDescription: `<p>Hoodie ${b.brand} ${b.model}, abrigo premium.</p>`,
			features: ['Nuevo', 'Capucha', b.material], specifications: [{ key: 'Material', value: b.material }],
			gender: 'Unisex', fit: 'Regular', material: b.material, sizeType: 'Ropa',
			variants: sizes.map(s => ({ sku: sku('BUZ', idx, `${s}-GRY`), attributes: [{ key: 'Talle', value: s }, { key: 'Color', value: 'Gris' }], color: { name: 'Gris', hex: '#9E9E9E' }, stock: 10, reservedStock: 0, isActive: true, images: [] }))
		});
		idx++;
	}

	// Camperas
	const camperas = [
		{ brand: 'Nike', model: 'Windrunner', price: 90, material: 'Nylon' },
		{ brand: 'Adidas', model: 'BSC 3S Insulated', price: 95, material: 'Poliéster' },
		{ brand: 'The North Face', model: 'Resolve 2', price: 130, material: 'DryVent' },
	];
	for (const c of camperas) {
		items.push({
			brand: c.brand, model: c.model, price: c.price, category: 'Camperas',
			shortDescription: `Campera ${c.brand} ${c.model}`, largeDescription: `<p>Campera ${c.brand} ${c.model}.</p>`,
			features: ['Nueva', 'Impermeable'], specifications: [{ key: 'Material', value: c.material }],
			gender: 'Hombre', fit: 'Regular', material: c.material, sizeType: 'Ropa', season: 'Invierno',
			variants: sizes.map(s => ({ sku: sku('CAM', idx, `${s}-BLK`), attributes: [{ key: 'Talle', value: s }], color: { name: 'Negro', hex: '#000000' }, stock: 6, reservedStock: 0, isActive: true, images: [] }))
		});
		idx++;
	}

	// Zapatillas
	const zapas = [
		{ brand: 'Nike', model: 'Air Max 90', price: 120.0 },
		{ brand: 'Nike', model: 'Air Force 1', price: 110.0 },
		{ brand: 'Adidas', model: 'Samba OG', price: 105.0 },
		{ brand: 'Adidas', model: 'Superstar', price: 95.0 },
		{ brand: 'New Balance', model: '574', price: 100.0 },
		{ brand: 'Puma', model: 'Suede Classic', price: 85.0 },
	];
	for (const z of zapas) {
		items.push({
			brand: z.brand, model: z.model, price: z.price, category: 'Zapatillas',
			shortDescription: `${z.brand} ${z.model}`, largeDescription: `<p>Zapatillas ${z.brand} ${z.model}, un clásico.</p>`,
			features: ['Nuevas', 'Clásicas'], specifications: [{ key: 'Tipo', value: 'Urbana' }],
			gender: 'Unisex', fit: 'Regular', material: 'Cuero/Textil', sizeType: 'Calzado',
			variants: shoeSizes.slice(0, 5).map(s => ({ sku: sku('ZAP', idx, `${s}-BLK`), attributes: [{ key: 'Talle', value: s }], color: { name: 'Negro', hex: '#000000' }, stock: 8, reservedStock: 0, isActive: true, images: [] }))
		});
		idx++;
	}

	// Shorts
	const shorts = [
		{ brand: 'Nike', model: 'Dri-FIT Challenger', price: 35 },
		{ brand: 'Adidas', model: 'Aeroready Short', price: 30 },
	];
	for (const s of shorts) {
		items.push({
			brand: s.brand, model: s.model, price: s.price, category: 'Shorts',
			shortDescription: `Short ${s.brand} ${s.model}`, largeDescription: `<p>Short deportivo ${s.brand}.</p>`,
			features: ['Nuevo', 'Deportivo'], specifications: [{ key: 'Tipo', value: 'Running' }],
			gender: 'Hombre', fit: 'Regular', material: 'Poliéster', sizeType: 'Ropa',
			variants: sizes.map(sz => ({ sku: sku('SHR', idx, `${sz}-BLK`), attributes: [{ key: 'Talle', value: sz }], stock: 15, reservedStock: 0, isActive: true, images: [] }))
		});
		idx++;
	}

	return items;
}

// ============ SEED FUNCTION ============
const seedDatabase = async (): Promise<void> => {
	try {
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		await Product.deleteMany({});
		console.log('🗑️ Productos existentes eliminados');

		const { venta } = await getDolar();
		console.log(`💵 Dólar: $${venta}`);

		const techData = getTechProducts();
		const clothingData = getClothingProducts();

		let created = 0;

		// Insert Tech products
		for (const item of techData) {
			try {
				const prices = await PaymentService.CalculatePrices(EcommercePaymentProviders.UALA, item.price, venta);
				await TechProduct.create({
					slug: genSlug(item.brand, item.model),
					brand: item.brand, model: item.model, category: item.category,
					shortDescription: item.shortDescription, largeDescription: item.largeDescription,
					features: item.features, specifications: item.specifications,
					prices, discount: 0, images: [],
					variants: item.variants, storage: item.storage || [],
					ram: item.ram, processor: item.processor, os: item.os, screenSize: item.screenSize,
				});
				created++;
			} catch (e: any) { console.error(`❌ Tech: ${item.brand} ${item.model}:`, e.message); }
		}
		console.log(`📱 ${created} productos tech creados`);

		let clothCreated = 0;
		for (const item of clothingData) {
			try {
				const prices = await PaymentService.CalculatePrices(EcommercePaymentProviders.UALA, item.price, venta);
				await ClothingProduct.create({
					slug: genSlug(item.brand, item.model),
					brand: item.brand, model: item.model, category: item.category,
					shortDescription: item.shortDescription, largeDescription: item.largeDescription,
					features: item.features, specifications: item.specifications,
					prices, discount: 0, images: [],
					variants: item.variants,
					gender: item.gender, fit: item.fit, material: item.material,
					sizeType: item.sizeType, composition: item.composition, season: item.season,
				});
				clothCreated++;
			} catch (e: any) { console.error(`❌ Clothing: ${item.brand} ${item.model}:`, e.message); }
		}
		console.log(`👕 ${clothCreated} productos de ropa creados`);
		console.log(`\n🎉 Total: ${created + clothCreated} productos creados!`);
	} catch (error) {
		console.error('❌ Error al poblar la base de datos:', error);
	} finally {
		await mongoose.connection.close();
		console.log('🔒 Conexión cerrada');
		process.exit(0);
	}
};

if (require.main === module) { seedDatabase(); }
export { seedDatabase };
