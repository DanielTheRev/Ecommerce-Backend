import { Schema } from 'mongoose';

export const CalculatedProfitsSchema = new Schema({
	transfer: { type: Number, default: 0 },
	card_ticket1Pay: { type: Number, default: 0 },
	card3Installments: { type: Number, default: 0 },
	card6Installments: { type: Number, default: 0 }
}, { _id: false });