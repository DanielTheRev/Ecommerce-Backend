import { IOrderItem } from '@/interfaces/order.interface';
import { Schema } from 'mongoose';
import { providerSchema } from '../provider.model';

// Campos de precios sensibles — solo visible para admins (select: false = default excluido)
// Para incluirlos: .select('+items.productSnapshot.prices.costPrice ...')
const ADMIN_ONLY = { select: false };

export const orderItemSchema = new Schema<IOrderItem>({
	// Snapshot del producto al momento de la compra
	// Incluye _id para operaciones de stock y consultas relacionales
	productSnapshot: {
		_id: { type: String, required: true },
		brand: { type: String, required: true },
		model: { type: String, required: true },
		image: { type: String, default: '' },
		slug: { type: String, default: '' },
		providerSnapshot: {
			type: providerSchema,
			...ADMIN_ONLY
		},
		price: {
			listPrice: { type: Number },
			card_ticket1PayPrice: { type: Number },
			cashTransferPrice: { type: Number },
			discountPercentageTransfer: { type: Number },
			installments: {
				threePaymentsAmount: { type: Number },
				sixPaymentsAmount: { type: Number },
				hasThreeInstallmentsSeamless: { type: Boolean },
				hasSixInstallmentsSeamless: { type: Boolean }
			}
		},
		finance: {
			type: Schema.Types.Mixed,
			...ADMIN_ONLY
		}
	},
	variantSnapshot: {
		type: Schema.Types.Mixed,
		required: true
	},
	quantity: {
		type: Number,
		required: true,
		min: 1
	},
	price: {
		type: Number,
		required: true,
		min: 0
	},
	costPriceSnapshot: {
		inUSD: { type: Number, select: false },
		inARS: { type: Number, select: false }
	}
});

