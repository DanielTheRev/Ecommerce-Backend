import { Types } from 'mongoose';
import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { PushNotificationService } from '../pushNotification.service';

export class ProductInventoryService {
	static async verifyVariantStock(
		models: TenantModels,
		items: { _id: string; sku?: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of items) {
				const product = (await models.Product.findById(item._id).lean()) as any;
				if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

				const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
				if (hasVariants) {
					const variant =
						product.variants.find((v: any) => v.sku === item.sku && v.isActive !== false) ||
						(item.sku ? null : product.variants[0]);

					if (!variant) {
						throw new AppError(
							`Variant ${item.sku || 'default'} not found`,
							`Variante ${item.sku || 'predeterminada'} no encontrada o inactiva en "${product.name || product.model}"`,
							404
						);
					}

					const availableStock = variant.stock - (variant.reservedStock || 0);
					if (availableStock < item.quantity) {
						throw new AppError(
							`Insufficient stock for variant ${item.sku}`,
							`Stock insuficiente para "${product.name || product.model}" (disponible: ${availableStock})`,
							400
						);
					}
				} else {
					// Producto simple o al peso sin variantes (Carnicería, Kiosco, Panadería, etc.)
					const currentStock = typeof product.netStock === 'number'
						? product.netStock
						: (typeof product.stock === 'number' ? product.stock : 0);
					const availableStock = currentStock - (product.reservedStock || 0);
					if (availableStock < item.quantity) {
						throw new AppError(
							`Insufficient stock for product ${product.name || product.model}`,
							`Stock insuficiente para "${product.name || product.model}" (disponible: ${availableStock})`,
							400
						);
					}
				}
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to verify variant stock',
				'Error al verificar el stock del producto',
				500
			);
		}
	}

	static async reduceVariantStock(
		models: TenantModels,
		items: { _id: string; sku?: string; quantity: number }[]
	): Promise<boolean> {
		try {
			const productIds = items.map((i) => new Types.ObjectId(i._id));
			const products = await models.Product.collection
				.find({ _id: { $in: productIds } })
				.toArray();
			const productMap = new Map<string, any>(products.map((p) => [p._id.toString(), p]));

			const operations = items.map((item) => {
				const product = productMap.get(item._id);
				const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;
				const matchedVariant = hasVariants
					? product.variants.find((v: any) => v.sku === item.sku) || product.variants[0]
					: null;

				if (hasVariants && matchedVariant) {
					return {
						updateOne: {
							filter: {
								_id: new Types.ObjectId(item._id),
								'variants.sku': matchedVariant.sku,
								'variants.stock': { $gte: item.quantity }
							},
							update: {
								$inc: {
									'variants.$[elem].stock': -item.quantity,
									netStock: -item.quantity
								}
							},
							arrayFilters: [{ 'elem.sku': matchedVariant.sku }]
						}
					};
				} else {
					// Producto simple o pesable/fraccionado directo en netStock
					return {
						updateOne: {
							filter: {
								_id: new Types.ObjectId(item._id),
								netStock: { $gte: item.quantity }
							},
							update: {
								$inc: {
									netStock: -item.quantity
								}
							}
						}
					};
				}
			});

			const result = await models.Product.collection.bulkWrite(operations, { ordered: true });

			if (result.modifiedCount !== items.length) {
				throw new AppError(
					'Stock reduction failed for one or more variants',
					'No se pudo reducir el stock de uno o más productos',
					400
				);
			}

			// Verificación asíncrona de alertas de Stock Bajo/Agotado para Notificaciones Push (Expo)
			(async () => {
				try {
					const prodIds = [...new Set(items.map((i) => new Types.ObjectId(i._id)))];
					const updatedProducts = await models.Product.find({ _id: { $in: prodIds } })
						.select('name brand model netStock variants lowStockThreshold')
						.lean();

					for (const prod of updatedProducts) {
						const threshold = (prod as any).lowStockThreshold ?? 3;
						const prodLabel = (prod as any).name || (prod as any).model;

						// Si tiene variantes
						if (Array.isArray((prod as any).variants) && (prod as any).variants.length > 0) {
							for (const v of (prod as any).variants) {
								const matched = items.find(
									(it) => String(it._id) === String((prod as any)._id) && it.sku === v.sku
								);
								if (matched && v.stock !== undefined && v.stock <= threshold) {
									const isOutOfStock = v.stock <= 0;
									const variantLabel = v.sku || v.size || v.color || '';
									PushNotificationService.sendAdminPushNotification({
										models,
										title: isOutOfStock
											? `❌ Sin Stock: ${prodLabel}`
											: `⚠️ Stock Crítico: ${prodLabel}`,
										body: isOutOfStock
											? `La variante ${variantLabel} se quedó sin stock (0 unidades).`
											: `Quedan solo ${v.stock} unidad(es) disponible(s) de ${variantLabel}.`,
										channelId: 'store_alerts',
										data: {
											productId: String((prod as any)._id),
											sku: v.sku,
											currentStock: v.stock,
											type: 'low_stock'
										}
									});
								}
							}
						} else {
							// Producto simple o al peso
							const netStock = (prod as any).netStock ?? 0;
							if (netStock <= threshold) {
								const isOutOfStock = netStock <= 0;
								PushNotificationService.sendAdminPushNotification({
									models,
									title: isOutOfStock
										? `❌ Sin Stock: ${prodLabel}`
										: `⚠️ Stock Crítico: ${prodLabel}`,
									body: isOutOfStock
										? `El producto "${prodLabel}" se quedó sin stock.`
										: `Quedan solo ${netStock} unidad(es)/medida(s) disponible(s) de "${prodLabel}".`,
									channelId: 'store_alerts',
									data: {
										productId: String((prod as any)._id),
										currentStock: netStock,
										type: 'low_stock'
									}
								});
							}
						}
					}
				} catch (err) {
					console.warn('[PushNotification] Error en verificación de stock bajo:', err);
				}
			})();

			return true;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to reduce variant stock',
				'Error al reducir el stock del producto',
				500
			);
		}
	}

	static async restoreVariantStock(
		models: TenantModels,
		items: { product: any; variantSku?: string; quantity: number }[]
	) {
		for (const item of items) {
			try {
				const prodId = new Types.ObjectId(item.product.toString());
				if (item.variantSku) {
					await models.Product.collection.findOneAndUpdate(
						{
							_id: prodId,
							'variants.sku': item.variantSku
						},
						{
							$inc: {
								'variants.$[elem].stock': item.quantity,
								netStock: item.quantity
							}
						},
						{ arrayFilters: [{ 'elem.sku': item.variantSku }] }
					);
				} else {
					await models.Product.collection.findOneAndUpdate(
						{ _id: prodId },
						{ $inc: { netStock: item.quantity } }
					);
				}
			} catch (error) {
				if (error instanceof AppError) throw error;
				throw new AppError(
					'Failed to restore variant stock',
					'Error al restaurar el stock del producto',
					500
				);
			}
		}
	}
}
