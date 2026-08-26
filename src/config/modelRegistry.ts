import { Connection, Model } from 'mongoose';

// Schemas
import { BannerSchema } from '@/models/Banner.model';
import { cashRegisterSchema } from '@/models/CashRegister.model';
import { ClothingProductSchema } from '@/models/discriminators/ClothingProduct.discriminator';
import { TechProductSchema } from '@/models/discriminators/TechProduct.discriminator';
import { BeautyProductSchema } from '@/models/discriminators/BeautyProduct.discriminator';
import { GeneralProductSchema } from '@/models/discriminators/GeneralProduct.discriminator';
import { EcommerceSchema } from '@/models/Ecommerce.model';
import { HeroSlideSchema } from '@/models/HeroSlide.model';
import { orderSchema } from '@/models/Order.model';
import { paymentMethodSchema } from '@/models/PaymentMethod.model';
import { BaseProductSchema } from '@/models/Product.model';
import { shippingOptionSchema } from '@/models/ShippingOption.model';
import { userSchema } from '@/models/User.model';
import { BentoConfigSchema } from '@/models/BentoConfig.model';
import { ShopTheLookSchema } from '@/models/shopTheLook.model';
import { addressSchema } from '@/models/Address.model';
import { SkuCounterSchema, ISkuCounterDocument } from '@/models/SkuCounter.model';
import { favoriteSchema } from '@/models/Favorite.model';
import { IFavoriteDocument } from '@/interfaces/favorites.interface';
import { cartSchema } from '@/models/Cart.model';
import { ICartDocument } from '@/interfaces/cart.interface';
import { notificationSchema } from '@/models/Notification.model';
import { INotificationDocument } from '@/interfaces/notification.interface';
import { providerSchema } from '@/models/provider.model';
import { CouponSchema } from '@/models/Coupon.model';
import { NewsletterSchema } from '@/models/Newsletter.model';

// Interfaces
import { ICashRegisterDocument, ICashRegisterModel } from '@/interfaces/cash-register.interface';
import { IBanner } from '@/interfaces/home.interface';
import { IOrder, IOrderModel } from '@/interfaces/order.interface';
import { IPaymentMethod } from '@/interfaces/paymentMethod.interface';
import { IProductDocument } from '@/interfaces/product.interface';
import { IShippingOption } from '@/interfaces/shippingMethods.interface';
import { IUser } from '@/interfaces/user.interface';
import { IHeroSlide } from '@/interfaces/hero.interface';
import { IBentoConfigDocument } from '@/interfaces/bento.interface';
import { IShopTheLookDocument } from '@/interfaces/shopTheLook.interface';
import { IAddressDocument } from '@/interfaces/address.interface';
import { IProviderDocument } from '@/interfaces/provider.interface';
import { ICouponDocument } from '@/interfaces/coupon.interface';
import { INewsletterDocument } from '@/interfaces/newsletter.interface';

/**
 * TenantModels - Todos los modelos Mongoose de un tenant.
 */
export interface TenantModels {
	Product: Model<IProductDocument>;
	TechProduct: Model<IProductDocument>;
	ClothingProduct: Model<IProductDocument>;
	BeautyProduct: Model<IProductDocument>;
	GeneralProduct: Model<IProductDocument>;
	User: Model<IUser>;
	Order: IOrderModel;
	EcommerceConfig: Model<any>;
	ShippingOption: Model<IShippingOption>;
	PaymentMethod: Model<IPaymentMethod>;
	HeroSlide: Model<IHeroSlide>;
	Banner: Model<IBanner>;
	CashRegister: ICashRegisterModel;
	BentoConfig: Model<IBentoConfigDocument>;
	ShopTheLook: Model<IShopTheLookDocument>;
	Provider: Model<IProviderDocument>;
	Address: Model<IAddressDocument>;
	SkuCounter: Model<ISkuCounterDocument>;
	Favorite: Model<IFavoriteDocument>;
	Cart: Model<ICartDocument>;
	Notification: Model<INotificationDocument>;
	Coupon: Model<ICouponDocument>;
	Newsletter: Model<INewsletterDocument>;
}

export function getModelsForConnection(db: Connection): TenantModels {
	// Product (Base Model)
	const ProductModel = db.models.Product
		? (db.model('Product') as Model<IProductDocument>)
		: db.model<IProductDocument>('Product', BaseProductSchema);

	// Discriminators
	const TechProductModel = db.models.TechProduct
		? (db.model('TechProduct') as Model<IProductDocument>)
		: ProductModel.discriminator<IProductDocument>('TechProduct', TechProductSchema);

	const ClothingProductModel = db.models.ClothingProduct
		? (db.model('ClothingProduct') as Model<IProductDocument>)
		: ProductModel.discriminator<IProductDocument>('ClothingProduct', ClothingProductSchema);

	const BeautyProductModel = db.models.BeautyProduct
		? (db.model('BeautyProduct') as Model<IProductDocument>)
		: ProductModel.discriminator<IProductDocument>('BeautyProduct', BeautyProductSchema);

	const GeneralProductModel = db.models.GeneralProduct
		? (db.model('GeneralProduct') as Model<IProductDocument>)
		: ProductModel.discriminator<IProductDocument>('GeneralProduct', GeneralProductSchema);

	// User
	const UserModel = db.models.User
		? (db.model('User') as Model<IUser>)
		: db.model<IUser>('User', userSchema);

	// Order
	const OrderModel = db.models.Order
		? (db.model('Order') as unknown as IOrderModel)
		: (db.model('Order', orderSchema) as unknown as IOrderModel);

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

	// CashRegister
	const CashRegisterModel = db.models.CashRegister
		? db.model<ICashRegisterDocument>('CashRegister')
		: db.model<ICashRegisterDocument>('CashRegister', cashRegisterSchema);

	// BentoConfig
	const BentoConfigModel = db.models.BentoConfig
		? db.model<IBentoConfigDocument>('BentoConfig')
		: db.model<IBentoConfigDocument>('BentoConfig', BentoConfigSchema);

	// ShopTheLook
	const ShopTheLookModel = db.models.ShopTheLook
		? db.model<IShopTheLookDocument>('ShopTheLook')
		: db.model<IShopTheLookDocument>('ShopTheLook', ShopTheLookSchema);

	// Provider
	const ProviderModel = db.models.Provider
		? db.model<IProviderDocument>('Provider')
		: db.model<IProviderDocument>('Provider', providerSchema);

	// Address
	const AddressModel = db.models.Address
		? db.model<IAddressDocument>('Address')
		: db.model<IAddressDocument>('Address', addressSchema);

	// SkuCounter
	const SkuCounterModel = db.models.SkuCounter
		? db.model<ISkuCounterDocument>('SkuCounter')
		: db.model<ISkuCounterDocument>('SkuCounter', SkuCounterSchema);

	// Favorite
	const FavoriteModel = db.models.Favorite
		? db.model<IFavoriteDocument>('Favorite')
		: db.model<IFavoriteDocument>('Favorite', favoriteSchema);

	// Cart
	const CartModel = db.models.Cart
		? db.model<ICartDocument>('Cart')
		: db.model<ICartDocument>('Cart', cartSchema);

	// Notification
	const NotificationModel = db.models.Notification
		? db.model<INotificationDocument>('Notification')
		: db.model<INotificationDocument>('Notification', notificationSchema);

	// Coupon
	const CouponModel = db.models.Coupon
		? db.model<ICouponDocument>('Coupon')
		: db.model<ICouponDocument>('Coupon', CouponSchema);

	// Newsletter
	const NewsletterModel = db.models.Newsletter
		? db.model<INewsletterDocument>('Newsletter')
		: db.model<INewsletterDocument>('Newsletter', NewsletterSchema);

	return {
		Product: ProductModel,
		TechProduct: TechProductModel,
		ClothingProduct: ClothingProductModel,
		BeautyProduct: BeautyProductModel,
		GeneralProduct: GeneralProductModel,
		User: UserModel,
		Order: OrderModel as IOrderModel,
		EcommerceConfig: EcommerceConfigModel,
		ShippingOption: ShippingOptionModel,
		PaymentMethod: PaymentMethodModel,
		HeroSlide: HeroSlideModel,
		Banner: BannerModel,
		CashRegister: CashRegisterModel as ICashRegisterModel,
		BentoConfig: BentoConfigModel,
		ShopTheLook: ShopTheLookModel,
		Provider: ProviderModel,
		Address: AddressModel,
		SkuCounter: SkuCounterModel,
		Favorite: FavoriteModel,
		Cart: CartModel,
		Notification: NotificationModel,
		Coupon: CouponModel,
		Newsletter: NewsletterModel
	};
}
