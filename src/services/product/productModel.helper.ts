import { TenantModels } from '@/config/modelRegistry';

/**
 * Obtiene el modelo de Mongoose unificado (Product).
 * Con la unificación de Schemas, todas las operaciones operan sobre models.Product.
 */
export function getProductModel(models: TenantModels, _type?: string): any {
	return models.Product;
}
