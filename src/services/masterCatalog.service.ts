import { connectionManager } from '@/config/multitenancy';
import { IMasterProduct, IMasterProductDocument, IMasterProductLookupResult } from '@/interfaces/masterProduct.interface';
import { MasterProductSchema } from '@/models/MasterProduct.model';
import { SEED_MASTER_PRODUCTS } from '@/data/seedMasterCatalog';
import { Model } from 'mongoose';

export class MasterCatalogService {
	private constructor() {}

	/**
	 * Obtiene el modelo MasterProduct enlazado a la conexión master_db
	 */
	public static getMasterProductModel(): Model<IMasterProductDocument> {
		const masterDb = connectionManager.getMasterDb();
		if (masterDb.models.MasterProduct) {
			return masterDb.model<IMasterProductDocument>('MasterProduct');
		}
		return masterDb.model<IMasterProductDocument>('MasterProduct', MasterProductSchema);
	}

	/**
	 * Inicializa y puebla el catálogo base de kioscos si está vacío.
	 */
	public static async initCatalog(): Promise<number> {
		try {
			const MasterModel = this.getMasterProductModel();
			const count = await MasterModel.countDocuments();
			if (count === 0) {
				console.log('📦 Inicializando catálogo maestro global con productos de kiosco...');
				const inserted = await MasterModel.insertMany(SEED_MASTER_PRODUCTS, { ordered: false });
				console.log(`✅ Catálogo maestro poblado con ${inserted.length} productos base.`);
				return inserted.length;
			}
			return count;
		} catch (error) {
			console.error('⚠️ Error al inicializar catálogo maestro:', error);
			return 0;
		}
	}

	/**
	 * Consulta un producto por código de barras.
	 * 1. Busca en la base de datos global de NexoCommerce.
	 * 2. Si no existe, consulta como fallback inteligente a OpenFoodFacts.
	 * 3. Si lo encuentra en la base externa, lo guarda silenciosamente en la DB global para siempre.
	 */
	public static async lookupBarcode(rawBarcode: string): Promise<IMasterProductLookupResult> {
		const barcode = (rawBarcode || '').trim();
		if (!barcode || barcode.length < 6) {
			return { found: false, source: 'not_found' };
		}

		try {
			const MasterModel = this.getMasterProductModel();

			// 1. Búsqueda local en DB Maestra
			const existing = await MasterModel.findOne({ barcode }).lean();
			if (existing) {
				return {
					found: true,
					source: 'database',
					product: existing
				};
			}

			// 2. Fallback externo (OpenFoodFacts con timeout de 2.5 segundos)
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 2500);

				const externalRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
					signal: controller.signal
				});
				clearTimeout(timeoutId);

				if (externalRes.ok) {
					const data = await externalRes.json() as any;
					if (data.status === 1 && data.product) {
						const p = data.product;
						const name = (p.product_name_es || p.product_name || '').trim();
						const brand = (p.brands || '').split(',')[0]?.trim() || 'Genérico';
						const category = (p.categories || '').split(',')[0]?.trim() || 'Kiosco / Almacén';
						const imageUrl = p.image_url || p.image_front_url || '';

						if (name) {
							// Guardar en la DB global silenciosamente
							const newProductData: Partial<IMasterProduct> = {
								barcode,
								name,
								brand,
								category,
								imageUrl,
								unit: 'un',
								isSoldByWeight: false,
								suggestedPrice: 0,
								source: 'crowdsourced',
								verified: true
							};

							const saved = await MasterModel.create(newProductData);

							return {
								found: true,
								source: 'external',
								product: saved.toObject()
							};
						}
					}
				}
			} catch (extErr) {
				// Timeout o error de red externa silencioso
			}

			return { found: false, source: 'not_found' };
		} catch (error) {
			console.error(`❌ Error en lookupBarcode(${barcode}):`, error);
			return { found: false, source: 'not_found' };
		}
	}

	/**
	 * Búsqueda predictiva o por texto en el catálogo maestro
	 */
	public static async search(query: string, limit: number = 20): Promise<IMasterProduct[]> {
		const q = (query || '').trim();
		if (!q) return [];

		try {
			const MasterModel = this.getMasterProductModel();
			const regex = new RegExp(q, 'i');

			const results = await MasterModel.find({
				$or: [
					{ barcode: regex },
					{ name: regex },
					{ brand: regex },
					{ category: regex }
				]
			})
				.limit(Math.min(limit, 50))
				.lean();

			return results as IMasterProduct[];
		} catch (error) {
			console.error(`❌ Error en search("${query}"):`, error);
			return [];
		}
	}

	/**
	 * Crowdsourcing silencioso:
	 * Cuando cualquier comerciante crea o actualiza un producto con código de barras en su tienda local,
	 * se registra o enriquece de forma asíncrona en el catálogo global de NexoCommerce.
	 */
	public static silentlyUpsertFromProduct(data: {
		barcode?: string;
		model: string;
		brand?: string;
		category?: string;
		imageUrl?: string;
		unit?: string;
		isSoldByWeight?: boolean;
		price?: number;
	}): void {
		const barcode = (data.barcode || '').trim();
		if (!barcode || barcode.length < 6 || !data.model) {
			return;
		}

		// Ejecución en segundo plano sin bloquear el request del comerciante
		setImmediate(async () => {
			try {
				const MasterModel = this.getMasterProductModel();

				await MasterModel.updateOne(
					{ barcode },
					{
						$setOnInsert: {
							barcode,
							name: data.model.trim(),
							brand: data.brand?.trim() || 'Genérico',
							category: data.category?.trim() || 'Almacén',
							imageUrl: data.imageUrl || '',
							unit: data.unit || 'un',
							isSoldByWeight: !!data.isSoldByWeight,
							suggestedPrice: data.price || 0,
							source: 'crowdsourced',
							verified: true
						}
					},
					{ upsert: true }
				);
			} catch (err) {
				// Ignorar duplicados o errores en background
			}
		});
	}

	/**
	 * Método para re-poblar el catálogo o forzar inserción masiva
	 */
	public static async seedCatalog(): Promise<{ count: number }> {
		const MasterModel = this.getMasterProductModel();
		let insertedCount = 0;

		for (const item of SEED_MASTER_PRODUCTS) {
			try {
				await MasterModel.updateOne(
					{ barcode: item.barcode },
					{ $setOnInsert: item },
					{ upsert: true }
				);
				insertedCount++;
			} catch {
				// Ignorar duplicados
			}
		}

		return { count: insertedCount };
	}
}
