import { Types } from 'mongoose';
import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { IProduct } from '@/interfaces/product.interface';
import { EcommerceService } from '../ecommerce.service';
import { FinanceService } from '../finance.service';
import { getDolar } from '../dolar.service';

export class ProductPricingService {
	/**
	 * Previsualiza el impacto del recálculo de precios por actualización de dólar o márgenes
	 */
	static async previewRecalculatePrices(
		models: TenantModels,
		config: any,
		onlyActive: boolean = true
	) {
		try {
			const query = onlyActive ? { status: 'published' } : {};
			const products = (await models.Product.find(query)
				.select('+finance')
				.lean()) as unknown as IProduct[];

			if (!products || products.length === 0) {
				return {
					totalProducts: 0,
					onlyActive,
					dolar: 0,
					quoteType: config.dollarQuoteType || 'oficial',
					items: []
				};
			}

			const { venta: dolarVenta } = await getDolar(
				config.dollarQuoteType || 'oficial',
				config.customDollarRate || 0
			);
			const isARS = config.costCurrency === 'ARS';
			const items = [];

			for (const product of products) {
				let baseCost = 0;
				let additionalCosts: any[] = [];
				let customProfitMargin = undefined;
				let pricingMethodChoice: any = undefined;
				let discountPercentageTransfer: number | undefined = undefined;

				const rawProduct = product as any;
				const oldPrices = rawProduct.prices || rawProduct.price;

				if (product.finance?.providerCost) {
					baseCost = isARS
						? product.finance.providerCost.inARS
						: product.finance.providerCost.inUSD;
					additionalCosts = product.finance.additionalCosts || [];
					customProfitMargin = product.finance.pricingStrategy?.targetProfit;
					pricingMethodChoice = product.finance.pricingStrategy?.method;
					discountPercentageTransfer = product.price?.discountPercentageTransfer;
				} else if (oldPrices) {
					baseCost = isARS
						? oldPrices.costPrice?.inARS || oldPrices.providerCost?.inARS || 0
						: oldPrices.costPrice?.inUSD || oldPrices.providerCost?.inUSD || 0;

					if (baseCost === 0 && typeof oldPrices === 'number') {
						baseCost = oldPrices;
					}
					pricingMethodChoice = oldPrices.customPricingMethod;
					customProfitMargin = oldPrices.profitMargin;
				}

				if (!baseCost) continue;

				const { price: newPrice } = await FinanceService.CalculatePrices({
					providerCost: baseCost,
					additionalCosts,
					discountPercentageTransfer,
					dolar: dolarVenta,
					models,
					config,
					useCustomProfit: customProfitMargin !== undefined,
					customProfitMargin,
					pricingMethodChoice
				});

				const oldCash = Number(product.price?.cashTransferPrice || 0);
				const newCash = Number(newPrice?.cashTransferPrice || 0);
				const oldCard = Number(product.price?.listPrice || (product.price as any)?.cardPrice || 0);
				const newCard = Number(newPrice?.listPrice || (newPrice as any)?.cardPrice || 0);

				const cashDiff = newCash - oldCash;
				const cashDiffPercent =
					oldCash > 0 ? Number(((cashDiff / oldCash) * 100).toFixed(2)) : 0;

				const cardDiff = newCard - oldCard;
				const cardDiffPercent =
					oldCard > 0 ? Number(((cardDiff / oldCard) * 100).toFixed(2)) : 0;

				const mainImage =
					Array.isArray(product.images) && product.images.length > 0
						? typeof product.images[0] === 'string'
							? product.images[0]
							: (product.images[0] as any).secure_url || (product.images[0] as any).url
						: '';

				items.push({
					_id: product._id,
					model: product.model,
					brand: product.brand,
					image: mainImage,
					status: product.status,
					oldPrice: {
						cashTransferPrice: oldCash,
						cardPrice: oldCard,
						installments: product.price?.installments
					},
					newPrice: {
						cashTransferPrice: newCash,
						cardPrice: newCard,
						installments: newPrice?.installments
					},
					diff: {
						cashDiff,
						cashDiffPercent,
						cardDiff,
						cardDiffPercent
					}
				});
			}

			return {
				totalProducts: items.length,
				onlyActive,
				dolar: dolarVenta,
				quoteType: config.dollarQuoteType || 'oficial',
				items
			};
		} catch (error) {
			console.error('Error in previewRecalculatePrices:', error);
			throw error;
		}
	}

	/**
	 * Recalcula masivamente los precios y finanzas de todos los productos
	 */
	static async recalculateAllProductsPrices(
		models: TenantModels,
		config: any,
		onlyActive: boolean = true
	): Promise<{ updatedCount: number }> {
		try {
			console.log(`🔄 Iniciando recalculo masivo de precios (onlyActive: ${onlyActive})...`);
			const query = onlyActive ? { status: 'published' } : {};
			const products = (await models.Product.find(query)
				.select('+finance')
				.lean()) as unknown as IProduct[];

			if (!products || products.length === 0) {
				console.log('No hay productos para recalcular.');
				return { updatedCount: 0 };
			}

			const { venta: dolarVenta } = await getDolar(
				config.dollarQuoteType || 'oficial',
				config.customDollarRate || 0
			);
			const isARS = config.costCurrency === 'ARS';
			const bulkOps = [];

			for (const product of products) {
				let baseCost = 0;
				let additionalCosts: any[] = [];
				let customProfitMargin = undefined;
				let pricingMethodChoice: any = undefined;
				let discountPercentageTransfer: number | undefined = undefined;

				const rawProduct = product as any;
				const oldPrices = rawProduct.prices || rawProduct.price;

				if (product.finance?.providerCost) {
					baseCost = isARS
						? product.finance.providerCost.inARS
						: product.finance.providerCost.inUSD;
					additionalCosts = product.finance.additionalCosts || [];
					customProfitMargin = product.finance.pricingStrategy?.targetProfit;
					pricingMethodChoice = product.finance.pricingStrategy?.method;
					discountPercentageTransfer = product.price?.discountPercentageTransfer;
				} else if (oldPrices) {
					baseCost = isARS
						? oldPrices.costPrice?.inARS || oldPrices.providerCost?.inARS || 0
						: oldPrices.costPrice?.inUSD || oldPrices.providerCost?.inUSD || 0;

					if (baseCost === 0 && typeof oldPrices === 'number') {
						baseCost = oldPrices;
					}
					pricingMethodChoice = oldPrices.customPricingMethod;
					customProfitMargin = oldPrices.profitMargin;
				}

				if (!baseCost) {
					continue;
				}

				const { price: calculatedPrice, finance: calculatedFinance } =
					await FinanceService.CalculatePrices({
						providerCost: baseCost,
						additionalCosts,
						discountPercentageTransfer,
						dolar: dolarVenta,
						models,
						config,
						useCustomProfit: customProfitMargin !== undefined,
						customProfitMargin,
						pricingMethodChoice
					});

				bulkOps.push({
					updateOne: {
						filter: { _id: product._id },
						update: {
							$set: { price: calculatedPrice, finance: calculatedFinance },
							$unset: { prices: '' }
						}
					}
				});
			}

			if (bulkOps.length > 0) {
				const result = await models.Product.bulkWrite(bulkOps);
				console.log(
					`✅ Recalculo masivo completado. Productos actualizados: ${result.modifiedCount}`
				);
				return { updatedCount: result.modifiedCount };
			}
			return { updatedCount: 0 };
		} catch (error) {
			console.error('❌ Error en recalculo masivo:', error);
			throw error;
		}
	}

	/**
	 * Previsualiza el impacto de remover un costo adicional (ej: IVA o Seguro)
	 */
	static async previewBulkRemoveAdditionalCost(
		models: TenantModels,
		options: {
			conceptQuery: string;
			statusFilter?: string;
			categoryFilter?: string;
			newProfitMargin?: number;
			exactMatch?: boolean;
		}
	) {
		const rawQuery = String(options.conceptQuery || '').trim();
		if (!rawQuery) {
			throw new AppError(
				'conceptQuery is required',
				'Debés ingresar el nombre del costo adicional a buscar (ej: IVA)',
				400
			);
		}

		const normalizeConcept = (s: string) =>
			String(s || '')
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '')
				.trim();

		const normTarget = normalizeConcept(rawQuery);
		if (!normTarget) {
			throw new AppError('Invalid conceptQuery', 'El texto de búsqueda no es válido', 400);
		}

		const filter: any = {};
		if (options.statusFilter && options.statusFilter !== 'all') {
			filter.status = options.statusFilter;
		}
		if (options.categoryFilter && options.categoryFilter.trim()) {
			filter.category = options.categoryFilter.trim();
		}

		const products = (await models.Product.find(filter)
			.select('+finance brand model category status price images')
			.sort({ category: 1, model: 1 })
			.lean()) as any[];

		const config = await EcommerceService.getConfig(models);
		const { venta } = await getDolar(
			config.dollarQuoteType || 'oficial',
			config.customDollarRate || 0
		);

		const items: any[] = [];
		const isExact = !!options.exactMatch;

		for (const p of products) {
			const additionalCosts = Array.isArray(p.finance?.additionalCosts)
				? p.finance.additionalCosts
				: [];
			const matchesCondition = (c: any) =>
				isExact
					? String(c.concept || '').trim() === rawQuery
					: normalizeConcept(c.concept).includes(normTarget);

			const matchedCosts = additionalCosts.filter(matchesCondition);

			if (matchedCosts.length === 0) continue;

			const remainingCosts = additionalCosts
				.filter((c: any) => !matchesCondition(c))
				.map((c: any) => ({
					concept: c.concept,
					type: c.type,
					value: Number(c.value) || 0,
					category: c.category || (/env[ií]o/i.test(c.concept || '') ? 'shipping' : 'expense')
				}));

			const providerCost = Number(
				p.finance?.providerCost?.inARS || p.finance?.providerCost?.inUSD || 0
			);
			if (providerCost <= 0) continue;

			const currentMargin = Number(
				p.finance?.pricingStrategy?.targetProfit ||
					(config?.pricingStrategy as any)?.profit ||
					(config?.pricingStrategy as any)?.defaultProfitMargin ||
					30
			);
			const targetMargin =
				options.newProfitMargin !== undefined &&
				options.newProfitMargin !== null &&
				!isNaN(Number(options.newProfitMargin)) &&
				Number(options.newProfitMargin) > 0
					? Number(options.newProfitMargin)
					: currentMargin;

			const pricingMethod = (p.finance?.pricingStrategy?.method ||
				config?.pricingStrategy?.method ||
				'margin') as any;
			const discountTransfer = p.price?.discountPercentageTransfer;

			const { price: newPrice, finance: newFinance } = await FinanceService.CalculatePrices({
				providerCost,
				additionalCosts: remainingCosts,
				discountPercentageTransfer: discountTransfer,
				useCustomProfit: true,
				customProfitMargin: targetMargin,
				pricingMethodChoice: pricingMethod,
				dolar: venta,
				models,
				config
			});

			const oldListPrice = Number(p.price?.listPrice || 0);
			const oldTransferPrice = Number(p.price?.cashTransferPrice || 0);
			const oldProfitTransfer = Number(p.finance?.calculatedProfits?.transfer || 0);
			const oldProfit3Installments = Number(p.finance?.calculatedProfits?.card3Installments || 0);

			const newListPrice = Number(newPrice.listPrice || 0);
			const newTransferPrice = Number(newPrice.cashTransferPrice || 0);
			const newProfitTransfer = Number(newFinance.calculatedProfits?.transfer || 0);
			const newProfit1Pay = Number(newFinance.calculatedProfits?.card_ticket1Pay || 0);
			const newProfit3Installments = Number(newFinance.calculatedProfits?.card3Installments || 0);

			// Costo total cubierto en el nuevo escenario
			const totalCostNew = newTransferPrice - newProfitTransfer;
			// Ganancia neta con cupón -10% en Transferencia
			const newProfitTransferCoupon10 = Math.round(newTransferPrice * 0.9 - totalCostNew);
			// Ganancia neta con cupón -10% en 3 Cuotas
			const netFromMP3Installments = totalCostNew + newProfit3Installments;
			const newProfit3InstallmentsCoupon10 = Math.round(
				netFromMP3Installments * 0.9 - totalCostNew
			);

			// Reserva de reposición que queda en bolsillo del comerciante
			const restockConcept = (newFinance.additionalCosts || []).find((c: any) =>
				/reposici[oó]n/i.test(c.concept || '')
			);
			const restockReserveARS = Math.round(
				Number((restockConcept as any)?.calculatedAmountInARS || 0)
			);

			const removedAmountARS = matchedCosts.reduce(
				(acc: number, c: any) => acc + Number(c.calculatedAmountInARS || 0),
				0
			);

			const primaryImage =
				p.images && p.images.length > 0
					? typeof p.images[0] === 'string'
						? p.images[0]
						: p.images[0]?.url || ''
					: '';

			items.push({
				_id: String(p._id),
				model: p.model || '',
				brand: p.brand || '',
				category: p.category || '',
				status: p.status || 'published',
				image: primaryImage,
				providerCost,
				oldMargin: currentMargin,
				newMargin: targetMargin,
				matchedConcepts: matchedCosts.map((c: any) => ({
					concept: c.concept,
					type: c.type,
					value: c.value,
					calculatedAmountInARS: Math.round(Number(c.calculatedAmountInARS || 0))
				})),
				remainingConcepts: (newFinance.additionalCosts || []).map((c: any) => ({
					concept: c.concept,
					type: c.type,
					value: c.value,
					calculatedAmountInARS: Math.round(Number(c.calculatedAmountInARS || 0))
				})),
				removedAmountARS: Math.round(removedAmountARS),
				restockReserveARS,
				oldListPrice,
				newListPrice,
				diffListPrice: newListPrice - oldListPrice,
				oldTransferPrice,
				newTransferPrice,
				diffTransferPrice: newTransferPrice - oldTransferPrice,
				oldProfitTransfer,
				newProfitTransfer,
				oldProfit3Installments,
				newProfit3Installments,
				newProfit1Pay,
				newProfitTransferCoupon10,
				newProfit3InstallmentsCoupon10
			});
		}

		return {
			conceptQuery: rawQuery,
			totalMatched: items.length,
			items
		};
	}

	/**
	 * Aplica la eliminación masiva del concepto de costo adicional confirmado a los IDs seleccionados
	 */
	static async applyBulkRemoveAdditionalCost(
		models: TenantModels,
		options: {
			productIds: string[];
			conceptQuery: string;
			newProfitMargin?: number;
			exactMatch?: boolean;
		}
	) {
		const rawQuery = String(options.conceptQuery || '').trim();
		if (!rawQuery) {
			throw new AppError('conceptQuery is required', 'El concepto a eliminar es requerido', 400);
		}
		if (!Array.isArray(options.productIds) || options.productIds.length === 0) {
			throw new AppError(
				'productIds required',
				'Debés seleccionar al menos un producto para actualizar',
				400
			);
		}

		const normalizeConcept = (s: string) =>
			String(s || '')
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '')
				.trim();

		const normTarget = normalizeConcept(rawQuery);
		const validIds = options.productIds.filter((id) => Types.ObjectId.isValid(id));

		const config = await EcommerceService.getConfig(models);
		const { venta } = await getDolar(
			config.dollarQuoteType || 'oficial',
			config.customDollarRate || 0
		);

		const products = await models.Product.find({ _id: { $in: validIds } }).select(
			'+finance brand model category status price images'
		);

		let updatedCount = 0;
		const updatedIds: string[] = [];
		const errors: any[] = [];
		const isExact = !!options.exactMatch;

		for (const product of products) {
			try {
				const additionalCosts = Array.isArray(product.finance?.additionalCosts)
					? product.finance.additionalCosts
					: [];

				const matchesCondition = (c: any) =>
					isExact
						? String(c.concept || '').trim() === rawQuery
						: normalizeConcept(c.concept).includes(normTarget);

				const matchedCosts = additionalCosts.filter(matchesCondition);
				if (matchedCosts.length === 0) continue;

				const remainingCosts = additionalCosts
					.filter((c: any) => !matchesCondition(c))
					.map((c: any) => ({
						concept: c.concept,
						type: c.type,
						value: Number(c.value) || 0,
						category: (c.category ||
							(/env[ií]o/i.test(c.concept || '') ? 'shipping' : 'expense')) as any
					}));

				const providerCost = Number(
					product.finance?.providerCost?.inARS || product.finance?.providerCost?.inUSD || 0
				);
				if (providerCost <= 0) continue;

				const currentMargin = Number(
					product.finance?.pricingStrategy?.targetProfit ||
						(config?.pricingStrategy as any)?.profit ||
						(config?.pricingStrategy as any)?.defaultProfitMargin ||
						30
				);
				const targetMargin =
					options.newProfitMargin !== undefined &&
					options.newProfitMargin !== null &&
					!isNaN(Number(options.newProfitMargin)) &&
					Number(options.newProfitMargin) > 0
						? Number(options.newProfitMargin)
						: currentMargin;

				const pricingMethod = (product.finance?.pricingStrategy?.method ||
					config?.pricingStrategy?.method ||
					'margin') as any;

				const { price, finance } = await FinanceService.CalculatePrices({
					providerCost,
					additionalCosts: remainingCosts,
					discountPercentageTransfer: (product.price as any)?.discountPercentageTransfer,
					useCustomProfit: true,
					customProfitMargin: targetMargin,
					pricingMethodChoice: pricingMethod,
					dolar: venta,
					models,
					config
				});

				await models.Product.updateOne(
					{ _id: product._id },
					{
						$set: { price, finance },
						$unset: { prices: '' }
					}
				);

				updatedCount++;
				updatedIds.push(String(product._id));
			} catch (err: any) {
				console.error(`❌ Error al recalcular producto ${product._id} (${product.model}):`, err);
				errors.push({
					_id: String(product._id),
					model: product.model,
					error: err.message || 'Error al recalcular producto'
				});
			}
		}

		return {
			success: errors.length === 0,
			updatedCount,
			updatedIds,
			errors
		};
	}

	/**
	 * Calibración rápida de precios y finanzas para un solo producto (Modal Rápido).
	 */
	static async updateProductQuickPricing(
		models: TenantModels,
		id: string,
		data: {
			providerCost?: number;
			profitMargin?: number;
			discountPercentageTransfer?: number;
			additionalCosts?: any[];
		}
	) {
		if (!Types.ObjectId.isValid(id)) {
			throw new AppError('Invalid ID', 'ID de producto inválido', 400);
		}
		const product = await models.Product.findById(id).select(
			'+finance brand model category status price images'
		);
		if (!product) {
			throw new AppError('Product not found', 'Producto no encontrado', 404);
		}

		const config = await EcommerceService.getConfig(models);
		const { venta } = await getDolar(
			config.dollarQuoteType || 'oficial',
			config.customDollarRate || 0
		);

		const finalCosts = Array.isArray(data.additionalCosts)
			? data.additionalCosts
			: product.finance?.additionalCosts || [];

		const finalProviderCost =
			data.providerCost !== undefined && Number(data.providerCost) > 0
				? Number(data.providerCost)
				: Number(product.finance?.providerCost?.inARS || product.finance?.providerCost?.inUSD || 0);

		if (finalProviderCost <= 0) {
			throw new AppError(
				'Provider cost must be greater than zero',
				'El costo de proveedor debe ser mayor a 0',
				400
			);
		}

		const currentMargin = Number(
			product.finance?.pricingStrategy?.targetProfit ||
				(config?.pricingStrategy as any)?.profit ||
				(config?.pricingStrategy as any)?.defaultProfitMargin ||
				30
		);

		const finalMargin =
			data.profitMargin !== undefined &&
			!isNaN(Number(data.profitMargin)) &&
			Number(data.profitMargin) > 0
				? Number(data.profitMargin)
				: currentMargin;

		const finalDiscountTransfer =
			data.discountPercentageTransfer !== undefined &&
			!isNaN(Number(data.discountPercentageTransfer))
				? Number(data.discountPercentageTransfer)
				: ((product.price as any)?.discountPercentageTransfer ?? 15);

		const pricingMethod = (product.finance?.pricingStrategy?.method ||
			config?.pricingStrategy?.method ||
			'margin') as any;

		const { price, finance } = await FinanceService.CalculatePrices({
			providerCost: finalProviderCost,
			additionalCosts: finalCosts,
			discountPercentageTransfer: finalDiscountTransfer,
			useCustomProfit: true,
			customProfitMargin: finalMargin,
			pricingMethodChoice: pricingMethod,
			dolar: venta,
			models,
			config
		});

		await models.Product.updateOne(
			{ _id: product._id },
			{
				$set: { price, finance },
				$unset: { prices: '' }
			}
		);

		return {
			success: true,
			product: {
				_id: String(product._id),
				brand: product.brand,
				model: product.model,
				price,
				finance
			}
		};
	}
}
