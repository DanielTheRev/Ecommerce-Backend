import { IOrderItem } from '@/interfaces/order.interface';
import { Schema } from 'mongoose';

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
		// Precios al momento de la compra — captura el estado exacto en el instante de la venta
		prices: {
			// ── Campos PÚBLICOS (cliente los puede ver) ─────────────────────
			efectivo_transferencia: { type: Number },
			tarjeta_credito_debito: { type: Number },
			cuotas: {
				cuotas_3_si: { type: Number },
				cuotas_6_si: { type: Number }
			},
			// ── Campos SENSIBLES (solo admin) — select: false ──────────────
			costPrice: {
				inUSD: { type: Number, ...ADMIN_ONLY },
				inARS: { type: Number, ...ADMIN_ONLY }
			},
			dolarPrice: { type: Number, ...ADMIN_ONLY },
			profitMargin: { type: Number, ...ADMIN_ONLY },
			baseCommission: { type: Number, ...ADMIN_ONLY },
			cft6Cuotas: { type: Number, ...ADMIN_ONLY },
			earnings: {
				cash_transfer: { type: Number, ...ADMIN_ONLY },
				card_3_installments: { type: Number, ...ADMIN_ONLY },
				card_6_installments: { type: Number, ...ADMIN_ONLY },
				ticket: { type: Number, ...ADMIN_ONLY }
			}
		}
	},
	// Snapshot de la variante elegida — sin reconstruir nada en runtime
	// ClothingProduct: tiene size | TechProduct: tiene attributes
	variantSnapshot: {
		sku: { type: String, required: true, trim: true, uppercase: true },
		size: { type: String, trim: true },                // ClothingProduct (talle)
		attributes: [{                                     // TechProduct (RAM, storage, etc.)
			key: { type: String },
			value: { type: String }
		}],
		color: {
			name: { type: String, trim: true },
			hex: { type: String, trim: true }
		},
		imageReference: {
			url: { type: String, required: false },
			public_id: { type: String, required: false }
		},
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
	}
});

