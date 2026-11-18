import slugify from 'slugify';
import { TenantModels } from '@/config/modelRegistry';
import {
	IProductBundleDocument,
	ICreateProductBundleDTO,
	IUpdateProductBundleDTO,
	IProductBundleItem
} from '@/interfaces/productBundle.interface';
import { AppError } from '@/errors/app.error';

export class ProductBundleService {
	/**
	 * Genera un slug único para el conjunto de productos dentro del tenant.
	 */
	private static async generateUniqueSlug(models: TenantModels, name: string, currentId?: string): Promise<string> {
		const baseSlug = slugify(name, { lower: true, strict: true, trim: true }) || 'combo';
		let slug = baseSlug;
		let counter = 1;

		while (true) {
			const existing = await models.ProductBundle.findOne({ slug });
			if (!existing || (currentId && existing._id.toString() === currentId)) {
				return slug;
			}
			slug = `${baseSlug}-${counter}`;
			counter++;
		}
	}

	/**
	 * Calcula finanzas y stock virtual reactivo a partir de los componentes.
	 */
	private static async calculateBundleFinancialsAndStock(
		models: TenantModels,
		items: Array<{ product: string; variantSku?: string; quantity: number }>,
		pricingType: 'custom' | 'sum_inherited',
		inputBundlePrice?: number,
		discountPercentage?: number
	): Promise<{
		inheritedCostPrice: number;
		bundlePrice: number;
		profitMarginPercent: number;
		virtualStock: number;
		calculatedDiscountPercentage: number;
	}> {
		if (!items || items.length < 2) {
			throw new AppError(
				'Invalid bundle items',
				'Un conjunto de productos / combo debe contener al menos 2 productos componentes.',
				400
			);
		}

		let totalCostPrice = 0;
		let sumRegularPrices = 0;
		let minStock = Infinity;

		for (const item of items) {
			const product = await models.Product.findById(item.product);
			if (!product) {
				throw new AppError('Product not found', `Producto componente con ID '${item.product}' no existe.`, 404);
			}

			const qty = Math.max(1, Number(item.quantity) || 1);

			// 1. Resolver costo de reposición del componente (inARS)
			const componentCost = product.finance?.providerCost?.inARS || 0;
			totalCostPrice += componentCost * qty;

			// 2. Resolver precio de venta regular del componente
			const componentPrice = product.price?.cashTransferPrice || product.price?.listPrice || 0;
			sumRegularPrices += componentPrice * qty;

			// 3. Resolver stock disponible para calcular stock virtual
			let availableStock = 0;
			const variants = (product as any).variants;
			if (item.variantSku && Array.isArray(variants) && variants.length > 0) {
				const variant = variants.find((v: any) => v.sku === item.variantSku);
				availableStock = variant ? Math.max(0, variant.stock || 0) : 0;
			} else if (Array.isArray(variants) && variants.length > 0) {
				availableStock = variants.reduce((acc: number, v: any) => acc + Math.max(0, v.stock || 0), 0);
			} else {
				availableStock = Math.max(0, (product as any).netStock || 0);
			}

			const possibleCombos = Math.floor(availableStock / qty);
			if (possibleCombos < minStock) {
				minStock = possibleCombos;
			}
		}

		const virtualStock = minStock === Infinity ? 0 : Math.max(0, minStock);

		// 4. Calcular precio final del combo
		let finalPrice = 0;
		let finalDiscount = 0;

		if (pricingType === 'sum_inherited') {
			const discount = Math.max(0, Math.min(100, Number(discountPercentage) || 0));
			finalPrice = Math.round(sumRegularPrices * (1 - discount / 100));
			finalDiscount = discount;
		} else {
			// 'custom'
			finalPrice = Number(inputBundlePrice) || 0;
			if (finalPrice <= 0) {
				throw new AppError('Invalid bundle price', 'El precio del combo debe ser mayor a 0.', 400);
			}
			if (sumRegularPrices > 0 && finalPrice < sumRegularPrices) {
				finalDiscount = Math.round(((sumRegularPrices - finalPrice) / sumRegularPrices) * 100);
			}
		}

		// 5. Calcular margen de ganancia neta en porcentaje
		const profitMarginPercent = finalPrice > 0
			? Number((((finalPrice - totalCostPrice) / finalPrice) * 100).toFixed(2))
			: 0;

		return {
			inheritedCostPrice: totalCostPrice,
			bundlePrice: finalPrice,
			profitMarginPercent,
			virtualStock,
			calculatedDiscountPercentage: finalDiscount
		};
	}

	/**
	 * Crea un nuevo combo / conjunto de productos.
	 */
	public static async createBundle(
		models: TenantModels,
		data: ICreateProductBundleDTO
	): Promise<IProductBundleDocument> {
		if (!data.name || !data.name.trim()) {
			throw new AppError('Name is required', 'El nombre del conjunto de productos es obligatorio.', 400);
		}

		const financials = await this.calculateBundleFinancialsAndStock(
			models,
			data.items,
			data.pricingType,
			data.bundlePrice,
			data.discountPercentage
		);

		const slug = await this.generateUniqueSlug(models, data.name);

		const bundle = await models.ProductBundle.create({
			name: data.name.trim(),
			slug,
			description: data.description?.trim(),
			category: data.category?.trim(),
			tags: data.tags || [],
			items: data.items,
			pricingType: data.pricingType,
			bundlePrice: financials.bundlePrice,
			discountPercentage: financials.calculatedDiscountPercentage,
			inheritedCostPrice: financials.inheritedCostPrice,
			profitMarginPercent: financials.profitMarginPercent,
			images: data.images || [],
			isActive: data.isActive !== undefined ? data.isActive : true,
			order: data.order || 0
		});

		(bundle as any).virtualStock = financials.virtualStock;
		return bundle;
	}

	/**
	 * Actualiza un combo existente.
	 */
	public static async updateBundle(
		models: TenantModels,
		id: string,
		data: IUpdateProductBundleDTO
	): Promise<IProductBundleDocument> {
		const bundle = await models.ProductBundle.findById(id);
		if (!bundle) {
			throw new AppError('Bundle not found', `No se encontró el conjunto de productos con ID '${id}'.`, 404);
		}

		const effectiveItems = data.items || (bundle.items as any);
		const effectivePricingType = data.pricingType || bundle.pricingType;
		const effectivePrice = data.bundlePrice !== undefined ? data.bundlePrice : bundle.bundlePrice;
		const effectiveDiscount = data.discountPercentage !== undefined ? data.discountPercentage : bundle.discountPercentage;

		const financials = await this.calculateBundleFinancialsAndStock(
			models,
			effectiveItems,
			effectivePricingType,
			effectivePrice,
			effectiveDiscount
		);

		if (data.name && data.name.trim() !== bundle.name) {
			bundle.name = data.name.trim();
			bundle.slug = await this.generateUniqueSlug(models, data.name, id);
		}

		if (data.description !== undefined) bundle.description = data.description.trim();
		if (data.category !== undefined) bundle.category = data.category.trim();
		if (data.tags !== undefined) bundle.tags = data.tags;
		if (data.items !== undefined) bundle.items = data.items as any;
		if (data.images !== undefined) bundle.images = data.images;
		if (data.isActive !== undefined) bundle.isActive = data.isActive;
		if (data.order !== undefined) bundle.order = data.order;

		bundle.pricingType = effectivePricingType;
		bundle.bundlePrice = financials.bundlePrice;
		bundle.discountPercentage = financials.calculatedDiscountPercentage;
		bundle.inheritedCostPrice = financials.inheritedCostPrice;
		bundle.profitMarginPercent = financials.profitMarginPercent;

		await bundle.save();
		(bundle as any).virtualStock = financials.virtualStock;
		return bundle;
	}

	/**
	 * Elimina un combo.
	 */
	public static async deleteBundle(models: TenantModels, id: string): Promise<void> {
		const result = await models.ProductBundle.findByIdAndDelete(id);
		if (!result) {
			throw new AppError('Bundle not found', `No se encontró el conjunto de productos con ID '${id}'.`, 404);
		}
	}

	/**
	 * Obtiene un combo por ID o Slug con cálculo reactivo de stock virtual.
	 */
	public static async getBundleByIdOrSlug(models: TenantModels, idOrSlug: string): Promise<IProductBundleDocument> {
		const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
		const bundle = isObjectId
			? await models.ProductBundle.findById(idOrSlug).populate('items.product')
			: await models.ProductBundle.findOne({ slug: idOrSlug.toLowerCase() }).populate('items.product');

		if (!bundle) {
			throw new AppError('Bundle not found', `No se encontró el conjunto de productos '${idOrSlug}'.`, 404);
		}

		// Calcular stock virtual reactivo al vuelo
		(bundle as any).virtualStock = this.computeReactiveStock(bundle.items);
		return bundle;
	}

	/**
	 * Obtiene todos los combos con stock virtual calculado en tiempo de ejecución.
	 */
	public static async getAllBundles(models: TenantModels, activeOnly = false): Promise<IProductBundleDocument[]> {
		const filter = activeOnly ? { isActive: true } : {};
		const bundles = await models.ProductBundle.find(filter).populate('items.product').sort({ order: 1, createdAt: -1 });

		for (const bundle of bundles) {
			(bundle as any).virtualStock = this.computeReactiveStock(bundle.items);
		}

		return bundles;
	}

	/**
	 * Cálculo de stock virtual puro en memoria a partir de los ítems poblados.
	 */
	private static computeReactiveStock(items: IProductBundleItem[]): number {
		if (!items || items.length === 0) return 0;
		let minStock = Infinity;

		for (const item of items) {
			const product = item.product as any;
			if (!product) return 0;

			const qty = Math.max(1, item.quantity || 1);
			let availableStock = 0;

			if (item.variantSku && Array.isArray(product.variants) && product.variants.length > 0) {
				const variant = product.variants.find((v: any) => v.sku === item.variantSku);
				availableStock = variant ? Math.max(0, variant.stock || 0) : 0;
			} else if (Array.isArray(product.variants) && product.variants.length > 0) {
				availableStock = product.variants.reduce((acc: number, v: any) => acc + Math.max(0, v.stock || 0), 0);
			} else {
				availableStock = Math.max(0, product.netStock || 0);
			}

			const possible = Math.floor(availableStock / qty);
			if (possible < minStock) {
				minStock = possible;
			}
		}

		return minStock === Infinity ? 0 : Math.max(0, minStock);
	}
}
