import { TenantModels } from '@/config/modelRegistry';
import { ProductType } from '@/interfaces/product.interface';

/**
 * Obtiene el modelo de Mongoose correspondiente según el discriminador productType.
 */
export function getProductModel(models: TenantModels, type?: string): any {
	switch (type) {
		case ProductType.TECH:
			return models.TechProduct;
		case ProductType.CLOTHING:
			return models.ClothingProduct;
		case ProductType.BEAUTY:
			return models.BeautyProduct;
		case ProductType.GENERAL:
			return models.GeneralProduct;
		default:
			return models.Product;
	}
}
