import { Server as SocketIOServer } from 'socket.io';
import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection } from '@/config/modelRegistry';
import {
	ActiveScannerInfo,
	AuthSocket,
	ScanBarcodeAckResponse,
	ScanBarcodePayload
} from './socket.types';

/**
 * Gestor de eventos POS y escáner remoto de códigos de barras (SRP).
 */
export class ScannerSocketHandler {
	private activeScanners: Map<string, ActiveScannerInfo> = new Map();

	registerHandlers(io: SocketIOServer, socket: AuthSocket): void {
		const tenantSlug = socket.tenantSlug;
		const { _id, name } = socket.user || {};

		socket.on('pos:join_terminal', (data: { terminalId: string }) => {
			if (!tenantSlug || !data?.terminalId) return;
			const cleanTerminal = String(data.terminalId).trim().toLowerCase();
			const roomName = `terminal_${tenantSlug}_${cleanTerminal}`;
			socket.join(roomName);
			console.log(`🖥️ POS Terminal joined room [${roomName}] from socket ${socket.id}`);

			const terminalScanners = this.getActiveScanners(tenantSlug, cleanTerminal);
			socket.emit('pos:scanner_status', {
				connected: terminalScanners.length > 0,
				scannersCount: terminalScanners.length,
				scanners: terminalScanners,
				terminalId: cleanTerminal
			});
		});

		socket.on('pos:leave_terminal', (data: { terminalId: string }) => {
			if (!tenantSlug || !data?.terminalId) return;
			const cleanTerminal = String(data.terminalId).trim().toLowerCase();
			socket.leave(`terminal_${tenantSlug}_${cleanTerminal}`);
		});

		socket.on(
			'pos:scanner_join',
			(data: { terminalId?: string; deviceId?: string; deviceName?: string }, callback?: Function) => {
				if (!tenantSlug) {
					if (typeof callback === 'function') callback({ success: false, message: 'Tenant no identificado' });
					return;
				}

				const deviceId = data?.deviceId || socket.id;
				const deviceName = data?.deviceName || (name ? `Celular de ${name}` : 'Dispositivo Móvil');
				const terminalId = data?.terminalId ? String(data.terminalId).trim().toLowerCase() : undefined;

				socket.isScanner = true;
				socket.scannerDeviceId = deviceId;
				socket.scannerTerminalId = terminalId;

				if (terminalId) {
					socket.join(`terminal_${tenantSlug}_${terminalId}`);
				}

				const scannerInfo: ActiveScannerInfo = {
					socketId: socket.id,
					userId: _id ? String(_id) : socket.id,
					userName: name || 'Operador Móvil',
					tenantSlug,
					deviceId,
					deviceName,
					terminalId,
					connectedAt: new Date()
				};

				this.activeScanners.set(socket.id, scannerInfo);
				console.log(`📱 [Scanner Mode ON] ${deviceName} (${deviceId}) paired with [${terminalId || 'GLOBAL'}] on tenant [${tenantSlug}]`);

				this.notifyScannerStatus(io, tenantSlug, terminalId);

				if (typeof callback === 'function') {
					callback({
						success: true,
						message: 'Modo escáner activado correctamente',
						scanner: scannerInfo
					});
				}
			}
		);

		socket.on('pos:scanner_leave', (callback?: Function) => {
			const info = this.activeScanners.get(socket.id);
			if (info) {
				this.activeScanners.delete(socket.id);
				socket.isScanner = false;
				if (info.terminalId && tenantSlug) {
					socket.leave(`terminal_${tenantSlug}_${info.terminalId}`);
				}
				this.notifyScannerStatus(io, info.tenantSlug, info.terminalId);
				console.log(`📱 [Scanner Mode OFF] ${info.deviceName} disconnected from scanner mode`);
			}
			if (typeof callback === 'function') {
				callback({ success: true, message: 'Modo escáner desactivado' });
			}
		});

		socket.on(
			'pos:scan_barcode',
			async (data: ScanBarcodePayload, callback?: (response: ScanBarcodeAckResponse) => void) => {
				if (!tenantSlug || !data?.barcode) {
					if (typeof callback === 'function') {
						callback({
							success: false,
							found: false,
							barcode: '',
							message: 'Código de barras requerido',
							product: null,
							matchedVariant: null
						});
					}
					return;
				}

				const cleanBarcode = String(data.barcode).trim();
				const terminalId = data.terminalId ? String(data.terminalId).trim().toLowerCase() : socket.scannerTerminalId;
				const deviceId = data.deviceId || socket.scannerDeviceId || socket.id;
				const deviceName = data.deviceName || (name ? `Celular de ${name}` : 'Lector Móvil');
				const quantity = data.quantity && data.quantity > 0 ? Number(data.quantity) : 1;

				console.log(`📷 [POS Scan] Barcode: ${cleanBarcode} | Terminal: ${terminalId || 'GLOBAL'} | From: ${deviceName}`);

				const scanner = this.activeScanners.get(socket.id);
				if (scanner) {
					scanner.lastScanAt = new Date();
				}

				let foundResult: any = null;
				try {
					const tenant = await connectionManager.getTenantBySlug(tenantSlug);
					if (tenant) {
						const tenantDb = connectionManager.getTenantDb(tenant.dbName);
						const models = getModelsForConnection(tenantDb);
						const { ProductService } = await import('@/services/product.service');
						foundResult = await ProductService.findByBarcode(models, cleanBarcode);
					}
				} catch {
					foundResult = null;
				}

				const eventPayload = {
					barcode: cleanBarcode,
					product: foundResult?.product || null,
					matchedVariant: foundResult?.matchedVariant || null,
					quantity,
					scannedBy: name || 'Dispositivo Móvil',
					deviceId,
					deviceName,
					terminalId: terminalId || null,
					timestamp: new Date().toISOString()
				};

				this.emitBarcodeScanned(io, tenantSlug, eventPayload, terminalId);

				if (typeof callback === 'function') {
					callback({
						success: true,
						found: !!foundResult,
						barcode: cleanBarcode,
						message: foundResult
							? `Producto encontrado: ${foundResult.product.model}`
							: 'Código transmitido al mostrador (producto no registrado)',
						product: foundResult?.product
							? {
									_id: foundResult.product._id?.toString(),
									model: foundResult.product.model,
									brand: foundResult.product.brand,
									category: foundResult.product.category,
									price: foundResult.product.price,
									images: foundResult.product.images || [],
									barcode: foundResult.product.barcode
							  }
							: null,
						matchedVariant: foundResult?.matchedVariant
							? {
									_id: foundResult.matchedVariant._id?.toString(),
									sku: foundResult.matchedVariant.sku,
									barcode: foundResult.matchedVariant.barcode,
									stock: foundResult.matchedVariant.stock,
									size: foundResult.matchedVariant.size,
									color: foundResult.matchedVariant.color,
									price: foundResult.matchedVariant.price
							  }
							: null
					});
				}
			}
		);
	}

	handleDisconnect(io: SocketIOServer, socket: AuthSocket): void {
		const scanner = this.activeScanners.get(socket.id);
		if (scanner) {
			this.activeScanners.delete(socket.id);
			this.notifyScannerStatus(io, scanner.tenantSlug, scanner.terminalId);
			console.log(`📱 [Scanner Disconnected] ${scanner.deviceName}`);
		}
	}

	emitBarcodeScanned(io: SocketIOServer, tenantSlug: string, eventPayload: any, terminalId?: string): void {
		if (terminalId) {
			const cleanTerminal = terminalId.trim().toLowerCase();
			io.to(`terminal_${tenantSlug}_${cleanTerminal}`).emit('pos:barcode_scanned', eventPayload);
			io.to(`admins_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
		} else {
			io.to(`pos_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
			io.to(`admins_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
		}
	}

	notifyScannerStatus(io: SocketIOServer, tenantSlug: string, terminalId?: string): void {
		if (!tenantSlug) return;
		const terminalScanners = this.getActiveScanners(tenantSlug, terminalId);
		const payload = {
			connected: terminalScanners.length > 0,
			scannersCount: terminalScanners.length,
			scanners: terminalScanners,
			terminalId: terminalId || null,
			timestamp: new Date().toISOString()
		};

		if (terminalId) {
			io.to(`terminal_${tenantSlug}_${terminalId}`).emit('pos:scanner_status', payload);
		}
		io.to(`pos_${tenantSlug}`).emit('pos:scanner_status', payload);
		io.to(`admins_${tenantSlug}`).emit('pos:scanner_status', payload);
	}

	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		const cleanSlug = tenantSlug.trim().toLowerCase();
		const cleanTerminal = terminalId ? terminalId.trim().toLowerCase() : undefined;
		const list: ActiveScannerInfo[] = [];

		for (const scanner of this.activeScanners.values()) {
			if (scanner.tenantSlug === cleanSlug && (!cleanTerminal || scanner.terminalId === cleanTerminal)) {
				list.push(scanner);
			}
		}

		return list;
	}
}
