import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { AppError } from '@/errors/app.error';
import { ProductService } from '@/services/product.service';
import { socketManager } from '@/sockets/socketManager';

export class PosController {
	/**
	 * POST /api/pos/scan
	 * Endpoint de escaneo remoto REST (fallback para contingencias de conexión socket)
	 */
	static async scanBarcode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { barcode, terminalId, deviceId, deviceName, quantity } = req.body;

			if (!barcode || typeof barcode !== 'string' || !barcode.trim()) {
				throw new AppError('Barcode is required', 'El código de barras es requerido', 400);
			}

			const cleanBarcode = barcode.trim();
			const tenantSlug = req.tenant?.slug || (req as any).tenantSlug || 'vura';
			const parsedQuantity = quantity && Number(quantity) > 0 ? Number(quantity) : 1;
			const senderName = req.user?.name || 'Lector Móvil (REST)';

			let foundResult: any = null;

			try {
				foundResult = await ProductService.findByBarcode(req.models!, cleanBarcode);
			} catch (err: any) {
				foundResult = null;
			}

			// Broadcast en tiempo real a los terminales POS mediante Socket.IO
			socketManager.broadcastScannedBarcode(tenantSlug, {
				barcode: cleanBarcode,
				product: foundResult?.product || null,
				matchedVariant: foundResult?.matchedVariant || null,
				quantity: parsedQuantity,
				scannedBy: senderName,
				deviceId: deviceId || 'rest-client',
				deviceName: deviceName || (req.user?.name ? `Móvil de ${req.user.name}` : 'Lector Android'),
				terminalId: terminalId ? String(terminalId).trim().toLowerCase() : undefined
			});

			res.status(200).json({
				success: true,
				found: !!foundResult,
				message: foundResult
					? `Producto "${foundResult.product.model}" enviado al mostrador POS`
					: `Código "${cleanBarcode}" transmitido al mostrador (producto no registrado en catálogo)`,
				data: {
					barcode: cleanBarcode,
					product: foundResult?.product || null,
					matchedVariant: foundResult?.matchedVariant || null,
					quantity: parsedQuantity,
					terminalId: terminalId || null
				}
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/pos/pairing
	 * Retorna la información necesaria para que la app móvil escanee un código QR en la pantalla del POS
	 * y se vincule instantáneamente a esta caja / terminal.
	 */
	static async getPairingData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const tenantSlug = req.tenant?.slug || (req as any).tenantSlug || 'vura';
			const terminalId = (req.query.terminalId as string) || 'caja-principal';
			const cleanTerminal = terminalId.trim().toLowerCase();

			const pairingInfo = {
				tenantSlug,
				terminalId: cleanTerminal,
				pairingCode: `${tenantSlug.toUpperCase()}-${cleanTerminal.toUpperCase()}`,
				wsPath: '/api/socket.io',
				qrPayload: JSON.stringify({
					action: 'pos_pair',
					tenant: tenantSlug,
					terminal: cleanTerminal,
					timestamp: Date.now()
				})
			};

			res.status(200).json({
				success: true,
				data: pairingInfo
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/pos/scanners
	 * Retorna la lista de dispositivos móviles conectados en modo escáner en este comercio.
	 */
	static async getActiveScanners(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const tenantSlug = req.tenant?.slug || (req as any).tenantSlug || 'vura';
			const terminalId = req.query.terminalId as string | undefined;

			const scanners = socketManager.getActiveScanners(tenantSlug, terminalId);

			res.status(200).json({
				success: true,
				count: scanners.length,
				data: scanners
			});
		} catch (error) {
			next(error);
		}
	}
}
