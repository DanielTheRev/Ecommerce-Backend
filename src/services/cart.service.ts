import { TenantModels } from '../config/modelRegistry';
import { AppError } from '../errors/app.error';
import { ICartItemPayload } from '../interfaces/cart.interface';

export class CartService {
	/**
	 * Revalida los precios y la existencia de las variantes de cada item contra los productos reales de la BD.
	 */
	private static async revalidateAndSanitizeItems(models: TenantModels, rawItems: ICartItemPayload[]): Promise<any[]> {
		if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) return [];

		const sanitizedItems: any[] = [];

		for (const item of rawItems) {
			if (!item.productId || !item.sku) continue;

			try {
				const product = await models.Product.findOne({
					_id: item.productId,
					isActive: true
				}).lean() as any;

				if (!product) continue;

				const variant = product.variants?.find(
					(v: any) => v.sku === item.sku && v.isActive
				);

				if (!variant) continue;

				const imageUrl = variant.imageReference?.url || product.images?.[0]?.url || item.image;
				const maxQty = Math.max(1, Math.min(item.quantity || 1, variant.stock));

				sanitizedItems.push({
					productId: product._id,
					sku: variant.sku,
					brand: product.brand,
					model: product.model,
					size: variant.size || item.size,
					color: variant.color || item.color,
					image: imageUrl,
					priceEfectivo: product.price?.cashTransferPrice ?? item.priceEfectivo ?? 0,
					priceCreditoDebito: product.price?.listPrice ?? item.priceCreditoDebito ?? 0,
					quantity: maxQty
				});
			} catch (err) {
				continue;
			}
		}

		return sanitizedItems;
	}

	/**
	 * Obtiene el carrito activo del usuario revalidado contra la BD.
	 */
	static async getCart(models: TenantModels, userId: string) {
		try {
			let cart = await models.Cart.findOne({ user: userId });

			if (!cart) {
				cart = await models.Cart.create({
					user: userId,
					items: [],
					selectedAddress: null,
					paymentMethod: undefined,
					shippingId: undefined
				});
			}

			const revalidatedItems = await this.revalidateAndSanitizeItems(models, cart.items as any[]);

			cart.items = revalidatedItems as any;
			await cart.save();

			return {
				items: cart.items,
				selectedAddress: cart.selectedAddress,
				paymentMethod: cart.paymentMethod,
				shippingId: cart.shippingId
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al obtener el carrito', 'Failed to fetch cart', 500);
		}
	}

	/**
	 * Actualiza los elementos del carrito del usuario.
	 */
	static async updateCart(
		models: TenantModels,
		userId: string,
		data: {
			items?: ICartItemPayload[];
			selectedAddress?: any;
			paymentMethod?: string;
			shippingId?: string;
		}
	) {
		try {
			let cart = await models.Cart.findOne({ user: userId });
			if (!cart) {
				cart = new models.Cart({ user: userId });
			}

			if (data.items !== undefined) {
				cart.items = (await this.revalidateAndSanitizeItems(models, data.items)) as any;
			}

			if (data.selectedAddress !== undefined) {
				cart.selectedAddress = data.selectedAddress;
			}
			if (data.paymentMethod !== undefined) {
				cart.paymentMethod = data.paymentMethod;
			}
			if (data.shippingId !== undefined) {
				cart.shippingId = data.shippingId;
			}

			await cart.save();

			return {
				items: cart.items,
				selectedAddress: cart.selectedAddress,
				paymentMethod: cart.paymentMethod,
				shippingId: cart.shippingId
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al actualizar el carrito', 'Failed to update cart', 500);
		}
	}

	/**
	 * Fusiona el carrito invitado (del localStorage) con el carrito guardado del usuario al iniciar sesión.
	 */
	static async mergeCart(models: TenantModels, userId: string, guestItems: ICartItemPayload[]) {
		try {
			let cart = await models.Cart.findOne({ user: userId });
			if (!cart) {
				cart = new models.Cart({ user: userId, items: [] });
			}

			const existingItemsMap = new Map<string, any>();
			(cart.items || []).forEach((item: any) => {
				existingItemsMap.set(item.sku, { ...item.toObject() });
			});

			const sanitizedGuestItems = await this.revalidateAndSanitizeItems(models, guestItems);

			sanitizedGuestItems.forEach((guestItem) => {
				if (existingItemsMap.has(guestItem.sku)) {
					const existing = existingItemsMap.get(guestItem.sku);
					existing.quantity = (existing.quantity || 1) + (guestItem.quantity || 1);
					existingItemsMap.set(guestItem.sku, existing);
				} else {
					existingItemsMap.set(guestItem.sku, guestItem);
				}
			});

			const mergedList = Array.from(existingItemsMap.values());
			const finalRevalidatedItems = await this.revalidateAndSanitizeItems(models, mergedList);

			cart.items = finalRevalidatedItems as any;
			await cart.save();

			return {
				items: cart.items,
				selectedAddress: cart.selectedAddress,
				paymentMethod: cart.paymentMethod,
				shippingId: cart.shippingId
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al fusionar el carrito', 'Failed to merge cart', 500);
		}
	}

	/**
	 * Vacía el carrito del usuario.
	 */
	static async clearCart(models: TenantModels, userId: string) {
		try {
			const cart = await models.Cart.findOne({ user: userId });
			if (cart) {
				cart.items = [] as any;
				cart.selectedAddress = null;
				cart.paymentMethod = undefined;
				cart.shippingId = undefined;
				await cart.save();
			}
			return { items: [], selectedAddress: null, paymentMethod: undefined, shippingId: undefined };
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al vaciar el carrito', 'Failed to clear cart', 500);
		}
	}
}
