import { Types } from 'mongoose';
import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { PushNotificationService } from '../pushNotification.service';

export class ProductInventoryService {
	static async verifyVariantStock(
		models: TenantModels,
		items: { _id: string; sku: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of items) {
				const product = (await models.Product.findById(item._id).lean()) as any;
				if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

				const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
				if (hasVariants) {
					const variant =
						product.variants.find((v: any) => v.sku === item.sku && v.isActive) ||
						(item.sku ? null : product.variants[0]);

					if (!variant) {
						throw new AppError(
							`Variant ${item.sku} not found`,
							`Variante ${item.sku || 'predeterminada'} no encontrada o inactiva en "${product.model}"`,
							404
						);
					}

					const availableStock = variant.stock - (variant.reservedStock || 0);
					if (availableStock < item.quantity) {
						throw new AppError(
							`Insufficient stock for variant ${item.sku}`,
							`Stock insuficiente para "${product.model}" (disponible: ${availableStock})`,
							400
						);
					}
				} else {
					// Producto simple o al peso sin variantes
					if (typeof product.stock === 'number') {
						const availableStock = product.stock - (product.reservedStock || 0);
						if (availableStock < item.quantity) {
							throw new AppError(
								`Insufficient stock for product ${product.model}`,
								`Stock insuficiente para "${product.model}" (disponible: ${availableStock})`,
								400
							);
						}
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
		items: { _id: string; sku: string; quantity: number }[]
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
									'variants.$[elem].stock': -item.quantity
								}
							},
							arrayFilters: [{ 'elem.sku': matchedVariant.sku }]
						}
					};
				} else {
					return {
						updateOne: {
							filter: {
								_id: new Types.ObjectId(item._id),
								...(typeof product?.stock === 'number'
									? { stock: { $gte: item.quantity } }
									: {})
							},
							update: {
								$inc: {
									stock: -item.quantity
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
						.select('brand model variants lowStockThreshold')
						.lean();

					for (const prod of updatedProducts) {
						const threshold = (prod as any).lowStockThreshold ?? 3;
						for (const v of (prod as any).variants || []) {
							const matched = items.find(
								(it) => String(it._id) === String((prod as any)._id) && it.sku === v.sku
							);
							if (matched && v.stock !== undefined && v.stock <= threshold) {
								const isOutOfStock = v.stock <= 0;
								const variantLabel = v.sku || v.size || v.color || '';
								PushNotificationService.sendAdminPushNotification({
									models,
									title: isOutOfStock
										? `❌ Sin Stock: ${(prod as any).model}`
										: `⚠️ Stock Crítico: ${(prod as any).model}`,
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
				'Error al reducir el stock de la variante',
				500
			);
		}
	}

	static async restoreVariantStock(
		models: TenantModels,
		items: { product: any; variantSku: string; quantity: number }[]
	) {
		for (const item of items) {
			try {
				// Usamos .collection para bypassear el Strict Mode del Schema Base
				await models.Product.collection.findOneAndUpdate(
					{
						_id: new Types.ObjectId(item.product.toString()),
						'variants.sku': item.variantSku
					},
					{ $inc: { 'variants.$[elem].stock': item.quantity } },
					{ arrayFilters: [{ 'elem.sku': item.variantSku }] }
				);
			} catch (error) {
				if (error instanceof AppError) throw error;
				throw new AppError(
					'Failed to restore variant stock',
					'Error al restaurar el stock de la variante',
					500
				);
			}
		}
	}
}
