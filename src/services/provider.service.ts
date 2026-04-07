import { TenantModels } from "@/config/modelRegistry";
import { AppError } from "@/errors/app.error";
import { IProvider, IProviderDocument } from "@/interfaces/provider.interface";
import { ProductService } from "./product.service";


export class ProviderService {
  /**
   * @description Get all providers
   * @param models - Tenant models
   * @returns Promise<IProvider[]>
   */
  static async getProviders(models: TenantModels): Promise<IProvider[]> {
    try {
      const providers = await models.Provider.find().sort({ name: 1 }).lean();
      return providers;
    } catch (error) {
      throw new AppError(
        'Failed to retrieve providers',
        'Error al intentar recuperar los proveedores',
        500
      );
    }
  }

  static async getProviderById(models: TenantModels, id: string) {
    try {
      const provider = await models.Provider.findById(id);
      if (!provider) throw new AppError('Provider not found', 'Proveedor no encontrado', 404);
      const products = await ProductService.getProviderProducts(models, id);
      return { provider, products };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to retrieve provider',
        'Error al intentar recuperar el proveedor',
        500
      );
    }
  }

  static async createProvider(models: TenantModels, provider: IProvider) {
    try {
      const newProvider = new models.Provider(provider);
      await newProvider.save();
      return newProvider;
    } catch (error) {
      throw new AppError(
        'Failed to create provider',
        'Error al intentar crear el proveedor',
        500
      );
    }
  }

  static async updateProvider(models: TenantModels, id: string, data: Partial<IProvider>) {
    if (!id) throw new AppError('Provider ID is required', 'El ID del proveedor es requerido', 400);
    if (!data) throw new AppError('Provider is required', 'Los nuevos datos son requeridos', 400);
    try {
      const updatedProvider = await models.Provider.findByIdAndUpdate(id, data, { new: true });
      if (!updatedProvider) throw new AppError('Provider not found', 'Proveedor no encontrado', 404);
      return updatedProvider;
    } catch (error) {
      throw new AppError(
        'Failed to update provider',
        'Error al intentar actualizar el proveedor',
        500
      );
    }
  }
}