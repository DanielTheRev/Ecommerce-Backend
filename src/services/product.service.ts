import { AppError } from '@/errors/app.error';
import { IOrderItem } from '@/interfaces/order.interface';
import { IProduct, IProductCreateDTO } from '@/interfaces/product.interface';
import { Product } from '@/models/Product.model';
import slugify from 'slugify';
import { getDolar } from './dolar.service';
import { PaymentService } from './Payment.service';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { ImageService } from './images.service';

export class ProductService {
	private constructor() { }

	static async createProduct(data: IProductCreateDTO, imagesDTO: Express.Multer.File[]): Promise<IProduct> {
		try {
			this.checkFields(data);
			const slug = this.generateSlug(data.brand, data.model);
			const { venta } = await getDolar();

			const prices = await PaymentService.CalculatePrices(
				EcommercePaymentProviders.UALA,
				data.price,
				venta
			);

			if (imagesDTO.length === 0) throw new AppError('No images provided', 'No se proporcionaron imágenes', 400);
			const rawImages = imagesDTO.map((image, index) => ({
				id: `${data.brand}-${data.model}-${index}`,
				source: image
			}));
			// TODO mejorar la ruta de las images en cloudinary
			const images = await ImageService.UploadImages(rawImages, 'electromix/product-images');
			const newProduct = await Product.create({
				slug,
				brand: data.brand,
				shortDescription: data.shortDescription,
				largeDescription: data.largeDescription,
				model: data.model,
				category: data.category,
				features: data.features,
				stock: 10,
				prices,
				images,
				colors: data.colors,
				storage: data.storage,
				specifications: data.specifications
			});
			return newProduct.toObject() as unknown as IProduct;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create product', 'Error al crear el producto', 500);
		}
	}

	static async getAllProducts(): Promise<IProduct[]> {
		try {
			const products = (await Product.find().lean()) as unknown as IProduct[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductById(id: string): Promise<IProduct> {
		try {
			const product = (await Product.findById(id).lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product', 'Error al obtener el producto', 500);
		}
	}

	static async getProductsByIds(ids: string[]): Promise<IProduct[]> {
		try {
			const products = (await Product.find({
				_id: { $in: ids }
			}).lean()) as unknown as IProduct[];
			if (products.length === 0)
				throw new AppError(
					'No products found for the given IDs',
					'No se encontraron productos para los IDs dados',
					404
				);
			if (products.length !== ids.length)
				throw new AppError(
					'Some products not found for the given IDs',
					'Algunos productos no se encontraron para los IDs dados',
					404
				);
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async verifyProductStockFromIds(
		products: { _id: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of products) {
				const prod = await Product.findById(item._id).lean();
				if (!prod)
					throw new AppError(
						`Product with ID ${item._id} not found`,
						`Producto ${item._id} no encontrado`,
						404
					);
				if (prod.stock < item.quantity)
					throw new AppError(
						`Insufficient stock for product ID ${item._id}`,
						`Stock insuficiente para el producto ${item._id}`,
						400
					);
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to verify product stock',
				'Error al verificar el stock del producto',
				500
			);
		}
	}

	static async reduceProductStock(
		products: { _id: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of products) {
				const prod = await Product.findById(item._id);
				if (!prod)
					throw new AppError(
						`Product with ID ${item._id} not found`,
						`Producto ${item._id} no encontrado`,
						404
					);
				await Product.findByIdAndUpdate(item._id, { $inc: { stock: -item.quantity } });
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to reduce product stock',
				'Error al reducir el stock del producto',
				500
			);
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
				throw new AppError(
					'Failed to restore product stock',
					'Error al restaurar el stock del producto',
					500
				);
			}
		}
	}

	private static checkFields(data: IProductCreateDTO) {
		try {
			const { brand, shortDescription, largeDescription, model, price, features } = data;
			if (
				!brand ||
				!model ||
				!shortDescription ||
				!largeDescription ||
				!price ||
				features.length === 0
			) {
				throw new AppError(
					'ProductService.createProduct: Missing fields when user creates a product',
					'Todos los campos son requeridos',
					400
				);
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'ProductService.createProduct: Error checking fields',
				'Error al verificar los campos',
				500
			);
		}
	}
	private static generateSlug(brand: string, model: string): string {
		try {
			const slug = slugify(`${brand}-${model}`, {
				lower: true,
				strict: true
			});
			return slug;
		} catch (error) {
			throw new AppError(
				'ProductService.generateSlug: Error generating slug',
				'Error al generar el slug',
				500
			);
		}
	}
}
