import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { ArcaService } from '@/services/arca.service';
import { AppError } from '@/errors/app.error';

export class ArcaController {
	/**
	 * GET /api/arca/status
	 * Verifica el estado de conexión con los servidores de ARCA / AFIP.
	 */
	static async checkStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const result = await ArcaService.checkServerStatus(req.models!);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/arca/taxpayer/:cuit
	 * Consulta los datos de un contribuyente en el padrón de ARCA.
	 */
	static async getTaxpayer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { cuit } = req.params;
			const result = await ArcaService.getTaxpayerDetails(req.models!, cuit);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/arca/invoice/order/:orderId
	 * Emite la factura electrónica en ARCA para una orden y devuelve el CAE.
	 */
	static async createInvoiceForOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { orderId } = req.params;
			const result = await ArcaService.createInvoiceForOrder(req.models!, orderId);
			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/arca/invoice/:id
	 * Obtiene los detalles de una factura electrónica por su ID.
	 */
	static async getInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const invoice = await req.models!.Invoice.findById(id);
			if (!invoice) {
				throw new AppError('Invoice not found', 'Comprobante fiscal no encontrado', 404);
			}
			res.status(200).json(invoice);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/arca/invoice/:id/pdf
	 * Genera y descarga el PDF reglamentario de la factura electrónica.
	 */
	static async getInvoicePdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const pdfBuffer = await ArcaService.generateInvoicePdf(req.models!, id);

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `inline; filename="factura-${id}.pdf"`);
			res.status(200).send(pdfBuffer);
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/arca/monotributo/report
	 * Obtiene el reporte y termómetro fiscal de Monotributo para los últimos 12 meses móviles.
	 */
	static async getMonotributoReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const report = await ArcaService.getMonotributoReport(req.models!);
			res.status(200).json(report);
		} catch (error) {
			next(error);
		}
	}
}
