import { Schema, model } from 'mongoose';
import { IAddressDocument } from '@/interfaces/address.interface';

const addressSchema = new Schema<IAddressDocument>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true
		},
		alias: {
			type: String,
			required: [true, 'El alias de la dirección es requerido'],
			trim: true
		},
		recipientName: {
			type: String,
			required: [true, 'El nombre del destinatario es requerido'],
			trim: true
		},
		street: {
			type: String,
			required: [true, 'La calle es requerida'],
			trim: true
		},
		number: {
			type: String,
			required: [true, 'El número es requerido'],
			trim: true
		},
		apartment: {
			type: String,
			trim: true
		},
		city: {
			type: String,
			required: [true, 'La ciudad es requerida'],
			trim: true
		},
		state: {
			type: String,
			required: [true, 'La provincia/estado es requerida'],
			trim: true
		},
		zipCode: {
			type: String,
			required: [true, 'El código postal es requerido'],
			trim: true
		},
		phone: {
			type: String,
			required: [true, 'El teléfono es requerido'],
			trim: true
		},
		isDefault: {
			type: Boolean,
			default: false
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// Índice opcional si vamos a hacer búsquedas frecuentes por usuario
addressSchema.index({ user: 1 });

export { addressSchema };
