import mongoose from 'mongoose';

const DEV_MASTER_URI = 'mongodb://127.0.0.1:27017/master_db';

const VERTICAL_PRESETS = [
	{
		key: 'fashion',
		label: 'Indumentaria (Moda)',
		icon: '👕',
		variantMode: 'fashion',
		labels: {
			nameLabel: 'Nombre de la prenda',
			variantsTitle: 'Colores & Talles (Agrupado estilo Vura)',
			variantsSubtitle: 'Tocá las fotos de arriba para vincular 1 o varias a cada color. Se sincroniza al instante.',
			weightTitle: 'Venta por Peso',
			specsTitle: 'Composición & Cuidados',
			bundleTitle: 'Looks & Conjuntos',
		},
		addonLabels: {
			media_studio: {
				galleryTitle: 'Fotos por Color & Look',
				gallerySubtitle: 'Subí varias fotos por color (4:5 recomendado para indumentaria) y vinculalas.',
			},
			variants: {
				variantsTitle: 'Colores & Talles (Agrupado estilo Vura)',
				variantsSubtitle: 'Tocá las fotos de arriba para vincular 1 o varias a cada color. Se sincroniza al instante.',
			},
			product_bundles: {
				bundleTitle: 'Looks & Conjuntos',
			},
			details_builder: {
				title: 'Detalles & Especificaciones',
				specsTitle: 'Ficha Técnica (Atributos)',
				careInstructionsLabel: 'Composición & Cuidados',
				settingsTabTitle: 'Indumentaria & Medidas'
			},
			tech_specs: {
				specsTitle: 'Composición & Cuidados',
			},
		},
		addonSettings: {
			details_builder: {
				showSpecifications: true,
				showCareInstructions: true,
				showTags: true,
				showFeatures: false,
				allowBulkPaste: true
			},
			size_guide: {
				allowCustomColumns: true,
				showToleranceField: true
			},
			cross_sell_studio: {
				allowVariantSelection: true,
				maxItems: 8,
				showInStorefront: true
			},
			marketing_banners: {
				enableHeroSliders: true,
				enablePromoBanners: true,
				enableBentoMenus: true,
				maxHeroSlides: 6
			}
		},
		variantColumns: {
			showColorColumn: true,
			showSizeColumn: true,
			showVolumeColumn: false,
			showAttributesColumn: false,
			allowPerVariantPrice: true,
			allowPerVariantMargin: true,
		},
		defaultAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
		recommendedAddons: [
			'store_identity',
			'store_management',
			'pos',
			'cash_register',
			'sales_control',
			'daily_summary',
			'customer_accounts',
			'suppliers',
			'category_manager',
			'variants',
			'media_studio',
			'product_descriptions',
			'details_builder',
			'size_guide',
			'product_seo',
			'cross_sell_studio',
			'price_builder',
			'product_bundles',
			'data_sets',
			'coupons',
			'web_catalog',
			'online_orders',
			'home_layout',
			'storefront_templates',
			'customer_auth'
		],
	},
	{
		key: 'tech_electronics',
		label: 'Tecnología / Celulares',
		icon: '📱',
		variantMode: 'tech',
		labels: {
			nameLabel: 'Modelo / Equipo',
			variantsTitle: 'Colores & Almacenamientos (Agrupado + Margen propio)',
			variantsSubtitle: 'Cada color vincula sus múltiples fotos arriba; cada capacidad tiene su costo y margen.',
			weightTitle: 'Venta por Peso',
			specsTitle: 'Ficha Técnica & Especificaciones',
			bundleTitle: 'Kits & Accesorios',
		},
		addonLabels: {
			media_studio: {
				galleryTitle: 'Galería por Color / Variante',
				gallerySubtitle: 'Vinculá fotos de frente, cámaras o caja a cada color.',
			},
			variants: {
				variantsTitle: 'Colores & Almacenamientos (Agrupado + Margen propio)',
				variantsSubtitle: 'Cada color vincula sus múltiples fotos arriba; cada capacidad tiene su costo y margen.',
			},
			product_bundles: {
				bundleTitle: 'Kits & Accesorios',
			},
			tech_specs: {
				specsTitle: 'Ficha Técnica & Especificaciones',
			},
		},
		variantColumns: {
			showColorColumn: true,
			showSizeColumn: false,
			showVolumeColumn: false,
			showAttributesColumn: true,
			allowPerVariantPrice: true,
			allowPerVariantMargin: true,
		},
		defaultAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
		recommendedAddons: ['variants', 'media_studio', 'tech_specs'],
	},
	{
		key: 'kiosk_grocery',
		label: 'Kiosco / Bebidas',
		icon: '🥤',
		variantMode: 'presentation',
		labels: {
			nameLabel: 'Producto',
			variantsTitle: 'Presentaciones & Litros (Lista simple)',
			variantsSubtitle: 'Un solo eje sin color ni talle. Cada tamaño vincula su foto arriba.',
			weightTitle: 'Productos por Peso / Fiambrería',
			specsTitle: 'Información del Producto',
			bundleTitle: 'Combos & Promos',
		},
		addonLabels: {
			media_studio: {
				galleryTitle: 'Fotos por Presentación',
				gallerySubtitle: 'Asociá la foto correspondiente a cada tamaño o sabor.',
			},
			variants: {
				variantsTitle: 'Presentaciones & Litros (Lista simple)',
				variantsSubtitle: 'Un solo eje sin color ni talle. Cada tamaño vincula su foto arriba.',
			},
			weighable: {
				weightTitle: 'Productos por Peso / Fiambrería',
			},
			product_bundles: {
				bundleTitle: 'Combos & Promos',
			},
		},
		variantColumns: {
			showColorColumn: false,
			showSizeColumn: false,
			showVolumeColumn: true,
			showAttributesColumn: false,
			allowPerVariantPrice: true,
			allowPerVariantMargin: true,
		},
		defaultAspectRatios: ['1:1', '9:16'],
		recommendedAddons: ['variants', 'pos', 'weighable', 'price_builder'],
	},
	{
		key: 'greengrocery',
		label: 'Verdulería / Frutería',
		icon: '🍌',
		variantMode: 'presentation',
		labels: {
			nameLabel: 'Fruta / Verdura',
			variantsTitle: 'Orígenes / Calidades & Stock (Kg)',
			variantsSubtitle: 'Un solo eje por origen + Balanza ($/Kg). Si tiene un solo tipo, no usa variantes.',
			weightTitle: 'Balanza ($/Kg)',
			specsTitle: 'Origen & Conservación',
			bundleTitle: 'Bolsones & Combos',
		},
		addonLabels: {
			media_studio: {
				galleryTitle: 'Fotos del Producto / Origen',
				gallerySubtitle: 'Opcional: vinculá la foto de cada origen o variedad.',
			},
			variants: {
				variantsTitle: 'Orígenes / Calidades & Stock (Kg)',
				variantsSubtitle: 'Un solo eje por origen + Balanza ($/Kg). Si tiene un solo tipo, no usa variantes.',
			},
			weighable: {
				weightTitle: 'Balanza ($/Kg)',
			},
			product_bundles: {
				bundleTitle: 'Bolsones & Combos',
			},
		},
		variantColumns: {
			showColorColumn: false,
			showSizeColumn: false,
			showVolumeColumn: true,
			showAttributesColumn: false,
			allowPerVariantPrice: true,
			allowPerVariantMargin: true,
		},
		defaultAspectRatios: ['1:1'],
		recommendedAddons: ['variants', 'weighable', 'pos', 'price_builder'],
	},
];

async function run() {
	if (!DEV_MASTER_URI.includes('127.0.0.1') && !DEV_MASTER_URI.includes('localhost')) {
		throw new Error('ABORTED: Solo se permite ejecutar contra MongoDB local de desarrollo.');
	}

	await mongoose.connect(DEV_MASTER_URI);
	const db = mongoose.connection.db!;
	const now = new Date();

	const presetsColl = db.collection('vertical_presets');
	const ops = VERTICAL_PRESETS.map((preset) => ({
		updateOne: {
			filter: { key: preset.key },
			update: { $set: { ...preset, updatedAt: now }, $setOnInsert: { createdAt: now } },
			upsert: true,
		},
	}));
	const presetRes = await presetsColl.bulkWrite(ops);
	console.log(`✅ vertical_presets en master_db (dev): matched=${presetRes.matchedCount}, upserted=${presetRes.upsertedCount}, modified=${presetRes.modifiedCount}`);

	const tenantsColl = db.collection('tenants');

	await tenantsColl.updateOne(
		{ slug: 'vura' },
		{
			$addToSet: {
				activeAddons: {
					$each: [
						'store_identity',
						'store_management',
						'pos',
						'cash_register',
						'sales_control',
						'daily_summary',
						'customer_accounts',
						'suppliers',
						'category_manager',
						'local_delivery',
						'variants',
						'media_studio',
						'product_descriptions',
						'details_builder',
						'size_guide',
						'product_seo',
						'cross_sell_studio',
						'price_builder',
						'fiscal_audit',
						'arca_invoicing',
						'coupons',
						'newsletter',
						'email_studio',
						'meta_marketing',
						'google_analytics',
						'web_catalog',
						'online_orders',
						'home_layout',
						'product_bundles',
						'data_sets',
						'metric_datasets',
						'ecommerce_web',
						'storefront_templates',
						'marketing_banners',
						'custom_domain',
						'storefront_connection',
						'customer_auth'
					]
				}
			},
			$set: {
				activeTemplateKey: 'vura_angular_flagship',
				unlockedTemplates: ['vura_angular_flagship', 'vura_editorial', 'point_mobile_catalog'],
				domainMode: 'custom_domain',
				domain: 'vura.com.ar',
				customLabels: VERTICAL_PRESETS[0].labels,
				updatedAt: now,
			},
		}
	);
	console.log('✅ Tenant "vura" actualizado en dev con todos los addons PRO + plantilla activa + customLabels = fashion');

	const vuraTenant = await tenantsColl.findOne({ slug: 'vura' });
	if (vuraTenant?.dbName) {
		const vuraDb = mongoose.connection.useDb(String(vuraTenant.dbName)).db!;
		const addonInstallationsColl = vuraDb.collection('addoninstallations');
		const vuraSpecFields = JSON.stringify([
			{ key: 'Género', inputType: 'select', required: true, options: ['Mujer', 'Hombre', 'Unisex', 'Niños'], allowMerchantAddOption: true, allowFeatured: false },
			{ key: 'Fit / Corte', inputType: 'select', required: false, options: ['Al Cuerpo', 'Regular', 'Oversized', 'Relaxed'], optionsSource: 'ecommerce.clothingFits', allowMerchantAddOption: true, allowFeatured: false },
			{ key: 'Material', inputType: 'text', required: false, allowFeatured: true, placeholder: 'Ej: Tricot de 85% poliéster y 15% spandex' },
			{ key: 'Temporada', inputType: 'select', required: false, options: ['Primavera / Verano', 'Otoño / Invierno', 'Todo el año'], allowMerchantAddOption: true, allowFeatured: false }
		]);
		await addonInstallationsColl.updateOne(
			{ addonId: 'details_builder' },
			{
				$set: {
					addonId: 'details_builder',
					isConfigured: true,
					settings: {
						showSpecifications: true,
						showCareInstructions: true,
						showTags: true,
						showFeatures: false,
						allowBulkPaste: true,
						suggestedSpecKeysCsv: 'Diseño,Calce,Delantero,Busto,Breteles,Tela,Composición,Acceso',
						suggestedCareChipsCsv: 'Lavar con agua fría,No usar secadora,Plancha tibia,No usar lavandina',
						specFieldsJson: vuraSpecFields
					},
					updatedAt: now
				},
				$setOnInsert: { createdAt: now }
			},
			{ upsert: true }
		);
		await addonInstallationsColl.updateOne(
			{ addonId: 'size_guide' },
			{
				$set: {
					addonId: 'size_guide',
					isConfigured: true,
					settings: {
						allowCustomColumns: true,
						showToleranceField: true
					},
					updatedAt: now
				},
				$setOnInsert: { createdAt: now }
			},
			{ upsert: true }
		);
		console.log(`✅ AddonInstallations de Vura configurados en ${vuraTenant.dbName}: details_builder (con specFieldsJson) + size_guide`);
	}

	await tenantsColl.updateOne(
		{ slug: 'leo-mariaangelica' },
		{
			$addToSet: {
				activeAddons: {
					$each: [
						'store_identity',
						'store_management',
						'pos',
						'cash_register',
						'sales_control',
						'daily_summary',
						'customer_accounts',
						'suppliers',
						'category_manager',
						'weighable',
						'price_builder',
						'master_catalog',
						'fiscal_audit',
						'arca_invoicing',
						'coupons'
					]
				}
			},
			$set: {
				customLabels: VERTICAL_PRESETS[2].labels,
				updatedAt: now,
			},
		}
	);
	console.log('✅ Tenant "leo-mariaangelica" actualizado en dev: activeAddons de Kiosco + customLabels = kiosk_grocery');

	await mongoose.disconnect();
}

run().catch((err) => {
	console.error('❌ Error:', err);
	process.exit(1);
});
