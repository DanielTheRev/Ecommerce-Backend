import { AppError } from '@/errors/app.error';
import { IOrderItem } from '@/interfaces/order.interface';
import { IProduct } from '@/interfaces/product.interface';
import { Product } from '@/models/Product.model';

export class ProductService {
	static async getAllProducts(): Promise<IProduct[]> {
		try {
			const products = (await Product.find().lean()) as unknown as IProduct[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 500);
		}
	}

	static async getProductById(id: string): Promise<IProduct> {
		try {
			const product = (await Product.findById(id).lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product', 500);
		}
	}

	static async getProductsByIds(ids: string[]): Promise<IProduct[]> {
		try {
			const products = (await Product.find({
				_id: { $in: ids }
			}).lean()) as unknown as IProduct[];
			if (products.length === 0) throw new AppError('No products found for the given IDs', 404);
			if (products.length !== ids.length)
				throw new AppError('Some products not found for the given IDs', 404);
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 500);
		}
	}

	static async verifyProductStockFromIds(
		products: { _id: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of products) {
				const prod = await Product.findById(item._id).lean();
				if (!prod) throw new AppError(`Product with ID ${item._id} not found`, 404);
				if (prod.stock < item.quantity)
					throw new AppError(`Insufficient stock for product ID ${item._id}`, 400);
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to verify product stock', 500);
		}
	}

	static async reduceProductStock(
		products: { _id: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of products) {
				const prod = await Product.findById(item._id);
				if (!prod) throw new AppError(`Product with ID ${item._id} not found`, 404);
				await Product.findByIdAndUpdate(item._id, { $inc: { stock: -item.quantity } });
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to reduce product stock', 500);
		}
	}

	static async restoreProductStock(items: IOrderItem[]) {
		for (const item of items) {
			try {
				await Product.findByIdAndUpdate(
					item.product,
					{ $inc: { stock: item.quantity } },
					{ new: true }
				);
			} catch (error) {
				if (error instanceof AppError) throw error;
				throw new AppError('Failed to restore product stock', 500);
			}
		}
	}
}
