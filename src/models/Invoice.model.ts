import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvoice {
	order: mongoose.Types.ObjectId;
	cae: string;
	caeExpiration: Date;
	voucherType: number; // 11 = Factura C, 6 = Factura B, 1 = Factura A
	voucherTypeName: string; // 'Factura C', 'Factura B', 'Factura A'
	ptoVta: number;
	voucherNumber: number;
	voucherDate: string; // YYYYMMDD
	docType: number; // 96 = DNI, 80 = CUIT, 99 = Consumidor Final
	docNumber: string;
	amountTotal: number;
	amountNet: number;
	amountTax: number;
	qrData?: string;
	status: 'authorized' | 'rejected' | 'pending';
	clientSnapshot?: {
		name: string;
		email: string;
		identificationType?: string;
		identificationNumber?: string;
		address?: string;
	};
	afipResponse?: any;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface IInvoiceDocument extends Document, Omit<IInvoice, 'order'> {
	order: mongoose.Types.ObjectId;
}

export const invoiceSchema = new Schema<IInvoiceDocument>(
	{
		order: {
			type: Schema.Types.ObjectId,
			ref: 'Order',
			required: true,
			index: true
		},
		cae: {
			type: String,
			required: true,
			trim: true
		},
		caeExpiration: {
			type: Date,
			required: true
		},
		voucherType: {
			type: Number,
			required: true
		},
		voucherTypeName: {
			type: String,
			default: 'Factura C'
		},
		ptoVta: {
			type: Number,
			required: true
		},
		voucherNumber: {
			type: Number,
			required: true
		},
		voucherDate: {
			type: String,
			required: true
		},
		docType: {
			type: Number,
			required: true,
			default: 99
		},
		docNumber: {
			type: String,
			required: true,
			default: '0'
		},
		amountTotal: {
			type: Number,
			required: true
		},
		amountNet: {
			type: Number,
			required: true
		},
		amountTax: {
			type: Number,
			default: 0
		},
		qrData: {
			type: String
		},
		status: {
			type: String,
			enum: ['authorized', 'rejected', 'pending'],
			default: 'authorized'
		},
		clientSnapshot: {
			name: { type: String },
			email: { type: String },
			identificationType: { type: String },
			identificationNumber: { type: String },
			address: { type: String }
		},
		afipResponse: {
			type: Schema.Types.Mixed
		}
	},
	{
		timestamps: true
	}
);

invoiceSchema.index({ ptoVta: 1, voucherType: 1, voucherNumber: 1 });

export default mongoose.model<IInvoiceDocument>('Invoice', invoiceSchema);
