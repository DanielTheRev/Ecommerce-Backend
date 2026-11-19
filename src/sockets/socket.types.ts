import { Socket } from 'socket.io';
import { IUser } from '@/interfaces/user.interface';

export interface ActiveScannerInfo {
	socketId: string;
	userId: string;
	userName: string;
	tenantSlug: string;
	deviceId: string;
	deviceName: string;
	terminalId?: string;
	connectedAt: Date;
	lastScanAt?: Date;
}

export interface ScanBarcodePayload {
	barcode: string;
	terminalId?: string;
	deviceId?: string;
	deviceName?: string;
	quantity?: number;
}

export interface ScanBarcodeAckResponse {
	success: boolean;
	found: boolean;
	barcode: string;
	message: string;
	product: any | null;
	matchedVariant: any | null;
}

export interface AuthSocket extends Socket {
	user?: IUser;
	tenantSlug?: string;
	authAudience?: string;
	isScanner?: boolean;
	scannerDeviceId?: string;
	scannerTerminalId?: string;
}
