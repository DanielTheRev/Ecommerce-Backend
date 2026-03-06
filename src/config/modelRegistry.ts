import { Connection, Model } from 'mongoose';

// Schemas
import { BaseProductSchema } from '@/models/Product.model';
import { TechProductSchema } from '@/models/discriminators/TechProduct.discriminator';
import { ClothingProductSchema } from '@/models/discriminators/ClothingProduct.discriminator';
import { userSchema } from '@/models/User.model';
import { orderSchema } from '@/models/Order.model';
import { EcommerceSchema } from '@/models/Ecommerce.model';
import { shippingOptionSchema } from '@/models/ShippingOption.model';
import { paymentMethodSchema } from '@/models/PaymentMethod.model';
import { HeroSlideSchema } from '@/models/HeroSlide.model';
import { BannerSchema } from '@/models/Banner.model';

// Interfaces
import { IProductDocument } from '@/interfaces/product.interface';
import { IUser } from '@/interfaces/user.interface';
import { IOrder, IOrderModel } from '@/interfaces/order.interface';
import { IEcommerceConfig } from '@/interfaces/ecommerce.interface';
import { IShippingOption } from '@/interfaces/shippingMethods.interface';
import { IPaymentMethod } from '@/interfaces/paymentMethod.interface';
import { IHeroSlide } from '@/models/HeroSlide.model';
import { IBanner } from '@/interfaces/home.interface';

/**
 * TenantModels - Todos los modelos Mongoose de un tenant.
 * Los servicios reciben este objeto en vez de importar modelos directamente.
 */
export interface TenantModels {
	Product: Model<IProductDocument>;
	TechProduct: Model<IProductDocument>;
	ClothingProduct: Model<IProductDocument>;
	User: Model<IUser>;
	Order: IOrderModel;
	EcommerceConfig: Model<any>;
	ShippingOption: Model<IShippingOption>;
	PaymentMethod: Model<IPaymentMethod>;
	HeroSlide: Model<IHeroSlide>;
	Banner: Model<IBanner>;
}

/**
 * Registra todos los modelos en una conexión de tenant y los retorna.
 * Si los modelos ya están registrados (cache), los retorna directamente.
 *
 * Esto permite que el MISMO schema funcione en múltiples DBs
 * sin tener que modificar los archivos de modelo originales.
 */
export function getModelsForConnection(db: Connection): TenantModels {
	// Product (base + discriminators)
	let ProductModel: Model<IProductDocument>;
	if (db.models.Product) {
		ProductModel = db.model<IProductDocument>('Product');
	} else {
		ProductModel = db.model<IProductDocument>('Product', BaseProductSchema);
	}

	let TechProductModel: Model<IProductDocument>;
	if (db.models.TechProduct) {
		TechProductModel = db.model<IProductDocument>('TechProduct');
	} else {
		TechProductModel = ProductModel.discriminator<IProductDocument>('TechProduct', TechProductSchema);
	}

	let ClothingProductModel: Model<IProductDocument>;
	if (db.models.ClothingProduct) {
		ClothingProductModel = db.model<IProductDocument>('ClothingProduct');
	} else {
		ClothingProductModel = ProductModel.discriminator<IProductDocument>('ClothingProduct', ClothingProductSchema);
	}

	// User
	const UserModel = db.models.User
		? db.model<IUser>('User')
		: db.model<IUser>('User', userSchema);

	// Order
	const OrderModel = db.models.Order
		? db.model<IOrder, IOrderModel>('Order')
		: db.model<IOrder, IOrderModel>('Order', orderSchema);

	// EcommerceConfig
	const EcommerceConfigModel = db.models.EcommerceConfig
		? db.model('EcommerceConfig')
		: db.model('EcommerceConfig', EcommerceSchema);

	// ShippingOption
	const ShippingOptionModel = db.models.ShippingOption
		? db.model<IShippingOption>('ShippingOption')
		: db.model<IShippingOption>('ShippingOption', shippingOptionSchema);

	// PaymentMethod
	const PaymentMethodModel = db.models.PaymentMethod
		? db.model<IPaymentMethod>('PaymentMethod')
		: db.model<IPaymentMethod>('PaymentMethod', paymentMethodSchema);

	// HeroSlide
	const HeroSlideModel = db.models.HeroSlide
		? db.model<IHeroSlide>('HeroSlide')
		: db.model<IHeroSlide>('HeroSlide', HeroSlideSchema);

	// Banner
	const BannerModel = db.models.Banner
		? db.model<IBanner>('Banner')
		: db.model<IBanner>('Banner', BannerSchema);

	return {
		Product: ProductModel,
		TechProduct: TechProductModel,
		ClothingProduct: ClothingProductModel,
		User: UserModel,
		Order: OrderModel as IOrderModel,
		EcommerceConfig: EcommerceConfigModel,
		ShippingOption: ShippingOptionModel,
		PaymentMethod: PaymentMethodModel,
		HeroSlide: HeroSlideModel,
		Banner: BannerModel
	};
}
