import { TenantModels } from '@/config/modelRegistry';
import { IProduct } from '@/interfaces/product.interface';
import { IVisitorInfo } from '@/utils/deviceDetector';
import { AppError } from '@/errors/app.error';
import { EcommerceService } from '../ecommerce.service';
import { ProductDisplayService } from './productDisplay.service';

export class ProductRankingService {
	/**
	 * Registra una vista de producto (1st-Party Analytics) con auditoría de dispositivo, URL y protección anti-bots para ELO
	 */
	static async recordProductView(
		models: TenantModels,
		productId: string,
		visitorInfo?: IVisitorInfo
	): Promise<void> {
		try {
			const isBot = visitorInfo?.isBot ?? false;
			const device = visitorInfo?.device ?? (isBot ? 'bot' : 'desktop');

			const updateOps: any = {
				$set: {
					'metrics.lastViewedAt': new Date()
				}
			};

			// Si es un bot o crawler (Googlebot, Bingbot, Scraper, etc.):
			// 🛑 NO SUMA AL ELO NI A VIEWS HUMANAS PARA PROTEGER EL ALGORITMO
			if (isBot) {
				updateOps.$inc = {
					'metrics.botViewsCount': 1,
					'metrics.viewsByDevice.bot': 1
				};
			} else {
				// ✅ Visitante humano real (Celular, Desktop, Tablet)
				const config = await EcommerceService.getConfig(models);
				const viewWeight = config.catalogRanking?.viewWeight ?? 1;

				const incFields: Record<string, number> = {
					'metrics.viewsCount': 1,
					effectiveScore: viewWeight
				};
				if (device === 'mobile' || device === 'desktop' || device === 'tablet') {
					incFields[`metrics.viewsByDevice.${device}`] = 1;
				}
				updateOps.$inc = incFields;
			}

			// Si tenemos los detalles del visitante, agregamos el evento a recentViews (últimas 50 visitas)
			if (visitorInfo) {
				updateOps.$push = {
					'metrics.recentViews': {
						$each: [
							{
								viewedAt: new Date(),
								device: visitorInfo.device,
								browser: visitorInfo.browser,
								os: visitorInfo.os,
								url: visitorInfo.fullUrl,
								referrer: visitorInfo.referrer,
								ip: visitorInfo.ip,
								isBot: visitorInfo.isBot,
								botName: visitorInfo.botName,
								userAgent: visitorInfo.userAgent,
								rejectionReason: visitorInfo.rejectionReason,
								manuallyApproved: false
							}
						],
						$slice: -50 // Mantiene solo las últimas 50 visitas (ring buffer)
					}
				};
			}

			await models.Product.findByIdAndUpdate(productId, updateOps);
		} catch (error) {
			console.error('[ProductRankingService] Error in recordProductView:', error);
		}
	}

	/**
	 * Obtiene el historial de auditoría de vistas de un producto (dispositivos, URLs, bots)
	 */
	static async getProductViewsAudit(models: TenantModels, productId: string): Promise<any> {
		const product = await models.Product.findById(productId).select(
			'model brand slug metrics effectiveScore rankingScore'
		);
		if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

		const metrics = product.metrics || ({} as any);
		return {
			productId: product._id,
			model: product.model,
			brand: product.brand,
			slug: product.slug,
			effectiveScore: product.effectiveScore,
			rankingScore: product.rankingScore,
			humanViews: metrics.viewsCount || 0,
			botViews: metrics.botViewsCount || 0,
			totalHits: (metrics.viewsCount || 0) + (metrics.botViewsCount || 0),
			viewsByDevice: metrics.viewsByDevice || { mobile: 0, desktop: 0, tablet: 0, bot: 0 },
			recentViews: Array.isArray(metrics.recentViews) ? [...metrics.recentViews].reverse() : []
		};
	}

	/**
	 * Aprueba manualmente una vista que había sido clasificada como bot (para corregir si fue un falso positivo)
	 */
	static async approveManualViewPoint(
		models: TenantModels,
		productId: string,
		viewTimestamp: string | number
	): Promise<any> {
		const product = await models.Product.findById(productId);
		if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

		const config = await EcommerceService.getConfig(models);
		const viewWeight = config.catalogRanking?.viewWeight ?? 1;

		const targetTime = new Date(viewTimestamp).getTime();
		let approved = false;

		if (product.metrics && Array.isArray((product.metrics as any).recentViews)) {
			for (const v of (product.metrics as any).recentViews) {
				const vTime = new Date(v.viewedAt).getTime();
				if (Math.abs(vTime - targetTime) < 2000 && (v.isBot || !v.manuallyApproved)) {
					v.isBot = false;
					v.manuallyApproved = true;
					v.rejectionReason = 'Aprobado manualmente por el administrador (+1 punto ELO sumado)';
					approved = true;
					break;
				}
			}
		}

		if (approved) {
			if (!product.metrics) {
				product.metrics = { viewsCount: 0, cartAddsCount: 0, salesCount: 0 } as any;
			}
			const metrics = product.metrics as any;
			metrics.viewsCount = (metrics.viewsCount || 0) + 1;
			if (metrics.botViewsCount && metrics.botViewsCount > 0) {
				metrics.botViewsCount -= 1;
			}
			product.effectiveScore = (product.effectiveScore || product.rankingScore || 100) + viewWeight;
			await product.save();
		}

		return {
			success: true,
			message: approved
				? 'Punto de vista sumado manualmente con éxito'
				: 'Visita ya aprobada o no encontrada',
			data: await this.getProductViewsAudit(models, productId)
		};
	}

	/**
	 * Registra una adición al carrito para sumar puntuación de alta intención
	 */
	static async recordCartAdd(models: TenantModels, productId: string): Promise<void> {
		try {
			const config = await EcommerceService.getConfig(models);
			const cartWeight = config.catalogRanking?.cartWeight ?? 5;

			await models.Product.findByIdAndUpdate(productId, {
				$inc: {
					'metrics.cartAddsCount': 1,
					effectiveScore: cartWeight
				}
			});
		} catch (error) {
			console.error('[ProductRankingService] Error in recordCartAdd:', error);
		}
	}

	/**
	 * Registra una venta concretada para sumar puntuación máxima de conversión
	 */
	static async recordProductSale(
		models: TenantModels,
		productId: string,
		quantity: number = 1
	): Promise<void> {
		try {
			const config = await EcommerceService.getConfig(models);
			const saleWeight = config.catalogRanking?.saleWeight ?? 25;

			await models.Product.findByIdAndUpdate(productId, {
				$inc: {
					'metrics.salesCount': quantity,
					effectiveScore: saleWeight * quantity
				}
			});
		} catch (error) {
			console.error('[ProductRankingService] Error in recordProductSale:', error);
		}
	}

	/**
	 * Actualiza el rankingScore base manual desde el Panel de Control y recalcula el effectiveScore total
	 */
	static async updateRankingScore(
		models: TenantModels,
		productId: string,
		newBaseScore: number
	): Promise<IProduct> {
		const product = await models.Product.findById(productId);
		if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

		const config = await EcommerceService.getConfig(models);
		const viewWeight = config.catalogRanking?.viewWeight ?? 1;
		const cartWeight = config.catalogRanking?.cartWeight ?? 5;
		const saleWeight = config.catalogRanking?.saleWeight ?? 25;

		const views = product.metrics?.viewsCount || 0;
		const carts = product.metrics?.cartAddsCount || 0;
		const sales = product.metrics?.salesCount || 0;

		const effectiveScore =
			Number(newBaseScore) + views * viewWeight + carts * cartWeight + sales * saleWeight;

		product.rankingScore = newBaseScore;
		product.effectiveScore = effectiveScore;
		await product.save();

		return (product.toObject ? product.toObject() : product) as unknown as IProduct;
	}

	/**
	 * Recalcula masivamente los effectiveScore de todos los productos del catálogo
	 * aplicando la fórmula de ELO: BaseScore + (Vistas * wV) + (Carritos * wC) + (Ventas * wS)
	 */
	static async recalculateAllEffectiveScores(models: TenantModels): Promise<{ updatedCount: number }> {
		const config = await EcommerceService.getConfig(models);
		const viewWeight = config.catalogRanking?.viewWeight ?? 1;
		const cartWeight = config.catalogRanking?.cartWeight ?? 5;
		const saleWeight = config.catalogRanking?.saleWeight ?? 25;

		const products = await models.Product.find({}).select('_id rankingScore metrics effectiveScore');
		if (!products || products.length === 0) {
			return { updatedCount: 0 };
		}

		const bulkOps = products.map((p) => {
			const baseScore =
				p.rankingScore !== undefined && p.rankingScore !== null ? Number(p.rankingScore) : 100;
			const views = p.metrics?.viewsCount || 0;
			const carts = p.metrics?.cartAddsCount || 0;
			const sales = p.metrics?.salesCount || 0;
			const calculatedEffective =
				baseScore + views * viewWeight + carts * cartWeight + sales * saleWeight;

			return {
				updateOne: {
					filter: { _id: p._id },
					update: {
						$set: {
							rankingScore: baseScore,
							'metrics.viewsCount': views,
							'metrics.cartAddsCount': carts,
							'metrics.salesCount': sales,
							effectiveScore: calculatedEffective
						}
					}
				}
			};
		});

		const result = await models.Product.bulkWrite(bulkOps);
		return { updatedCount: result.modifiedCount || bulkOps.length };
	}

	/**
	 * Reinicia masivamente los scores ELO de todos los productos del catálogo a su base.
	 */
	static async resetAllToRankingBase(
		models: TenantModels,
		resetBaseTo100: boolean = false
	): Promise<{ updatedCount: number }> {
		const products = await models.Product.find({}).select('_id rankingScore');
		if (!products || products.length === 0) {
			return { updatedCount: 0 };
		}

		const bulkOps = products.map((p) => {
			const targetBase = resetBaseTo100
				? 100
				: p.rankingScore !== undefined && p.rankingScore !== null
				? Number(p.rankingScore)
				: 100;
			return {
				updateOne: {
					filter: { _id: p._id },
					update: {
						$set: {
							rankingScore: targetBase,
							effectiveScore: targetBase,
							'metrics.viewsCount': 0,
							'metrics.botViewsCount': 0,
							'metrics.cartAddsCount': 0,
							'metrics.salesCount': 0,
							'metrics.viewsByDevice': { mobile: 0, desktop: 0, tablet: 0, bot: 0 }
						}
					}
				}
			};
		});

		const result = await models.Product.bulkWrite(bulkOps);
		return { updatedCount: result.modifiedCount || bulkOps.length };
	}

	/**
	 * Reinicia el score ELO de un producto individual a su base.
	 */
	static async resetProductRankingBase(
		models: TenantModels,
		productId: string,
		resetBaseTo100: boolean = false
	): Promise<IProduct> {
		const product = await models.Product.findById(productId);
		if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

		const targetBase = resetBaseTo100
			? 100
			: product.rankingScore !== undefined && product.rankingScore !== null
			? Number(product.rankingScore)
			: 100;

		product.rankingScore = targetBase;
		product.effectiveScore = targetBase;
		if (!product.metrics) {
			product.metrics = {
				viewsCount: 0,
				botViewsCount: 0,
				cartAddsCount: 0,
				salesCount: 0,
				viewsByDevice: { mobile: 0, desktop: 0, tablet: 0, bot: 0 }
			};
		} else {
			product.metrics.viewsCount = 0;
			product.metrics.botViewsCount = 0;
			product.metrics.cartAddsCount = 0;
			product.metrics.salesCount = 0;
			product.metrics.viewsByDevice = { mobile: 0, desktop: 0, tablet: 0, bot: 0 };
		}

		await product.save();
		return (product.toObject ? product.toObject() : product) as unknown as IProduct;
	}

	/**
	 * Novedades Inteligentes (Smart Fill):
	 * 1. Prioriza los productos marcados como destacados (isFeatured: true), más recientes primero.
	 * 2. Si hay menos del límite, rellena con los últimos productos creados (createdAt: -1) sin duplicar.
	 * 3. NO repite productos ni desdobla por color por defecto (1 producto = 1 tarjeta).
	 * 4. Aplica cadencia visual (interleaveProducts).
	 */
	static async getSmartNews(
		models: TenantModels,
		limit: number = 12,
		splitColors: boolean = false
	): Promise<IProduct[]> {
		try {
			// 1. Obtener destacados activos ordenados por fecha descendente
			const featuredProducts = (await models.Product.find({
				status: 'published',
				isFeatured: true
			})
				.sort({ createdAt: -1 })
				.limit(limit)
				.lean()) as unknown as IProduct[];

			let combined = [...featuredProducts];

			// 2. Si no alcanza el límite, rellenar con productos recientes no destacados
			if (combined.length < limit) {
				const needed = limit - combined.length;
				const featuredIds = featuredProducts.map((p) => p._id);

				const recentProducts = (await models.Product.find({
					status: 'published',
					_id: { $nin: featuredIds }
				})
					.sort({ createdAt: -1 })
					.limit(needed)
					.lean()) as unknown as IProduct[];

				combined = [...combined, ...recentProducts];
			}

			// 3. En novedades NO se repiten colores ni se duplican tarjetas salvo petición explícita
			let processed = splitColors
				? ProductDisplayService.splitProductsByColor(combined)
				: combined;

			// 4. Aplicar cadencia visual / anti-clustering
			if (processed.length > 2) {
				processed = ProductDisplayService.interleaveProducts(processed);
			}

			// Límite estricto solicitado por el cliente/query
			return processed.slice(0, limit);
		} catch (error) {
			console.error('Error fetching smart news:', error);
			return [];
		}
	}
}
