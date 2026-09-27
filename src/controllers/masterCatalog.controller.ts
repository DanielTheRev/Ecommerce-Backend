import { Request, Response } from 'express';
import { MasterCatalogService } from '@/services/masterCatalog.service';

export class MasterCatalogController {
	/**
	 * GET /api/v1/master-catalog/lookup/:barcode
	 * Busca un producto en el catálogo global por su código de barras
	 */
	static async lookupBarcode(req: Request, res: Response): Promise<void> {
		try {
			const { barcode } = req.params;
			if (!barcode) {
				res.status(400).json({
					success: false,
					message: 'Código de barras requerido'
				});
				return;
			}

			const result = await MasterCatalogService.lookupBarcode(barcode);
			res.status(200).json({
				success: true,
				...result
			});
		} catch (error: any) {
			res.status(500).json({
				success: false,
				message: error.message || 'Error consultando catálogo maestro'
			});
		}
	}

	/**
	 * GET /api/v1/master-catalog/search?q=...&limit=...
	 * Búsqueda de productos en el catálogo global
	 */
	static async search(req: Request, res: Response): Promise<void> {
		try {
			const query = (req.query.q as string) || '';
			const limit = parseInt(req.query.limit as string) || 20;

			const data = await MasterCatalogService.search(query, limit);
			res.status(200).json({
				success: true,
				count: data.length,
				data
			});
		} catch (error: any) {
			res.status(500).json({
				success: false,
				message: error.message || 'Error buscando en catálogo maestro'
			});
		}
	}

	/**
	 * POST /api/v1/master-catalog/seed
	 * Fuerza la siembra o actualización masiva del catálogo maestro
	 */
	static async seed(req: Request, res: Response): Promise<void> {
		try {
			const result = await MasterCatalogService.seedCatalog();
			res.status(200).json({
				success: true,
				message: 'Catálogo maestro sincronizado con éxito',
				...result
			});
		} catch (error: any) {
			res.status(500).json({
				success: false,
				message: error.message || 'Error al poblar catálogo maestro'
			});
		}
	}
}
