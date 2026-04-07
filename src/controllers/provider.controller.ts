import { AuthRequest } from '@/middleware/auth';
import { NextFunction, Response } from 'express';
import { ProviderService } from '@/services/provider.service';
import { IProvider } from '@/interfaces/provider.interface';

export class ProviderController {
  static async createProvider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await ProviderService.createProvider(req.models!, req.body);
      res.status(201).json(provider);
    } catch (error) {
      next(error);
    }
  }
  /**
   * @description Get all providers
   * @param req - AuthRequest
   * @param res - Response
   * @param next - NextFunction
   * @returns Promise<Response<IProvider[]>>
  */
  static async getProviders(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<IProvider[]>> {
    try {
      const providers = await ProviderService.getProviders(req.models!);
      return res.json(providers);
    } catch (error) {
      return next(error);
    }
  }

  static async getProviderByIdWithProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await ProviderService.getProviderById(req.models!, req.params.id);
      res.json(provider);
    } catch (error) {
      next(error);
    }
  }

  static async updateProvider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await ProviderService.updateProvider(req.models!, req.params.id, req.body);
      res.json(provider);
    } catch (error) {
      next(error);
    }
  }
}