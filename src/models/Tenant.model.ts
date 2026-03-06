import { ITenant, TenantPlan } from '@/interfaces/tenant.interface';
import { Schema } from 'mongoose';

export const TenantSchema = new Schema<ITenant>(
	{
		slug: {
			type: String,
			required: [true, 'El slug es requerido'],
			unique: true,
			trim: true,
			lowercase: true
		},
		name: {
			type: String,
			required: [true, 'El nombre es requerido'],
			trim: true
		},
		dbName: {
			type: String,
			required: [true, 'El nombre de la base de datos es requerido'],
			unique: true,
			trim: true
		},
		domain: {
			type: String,
			trim: true,
			sparse: true
		},
		isActive: {
			type: Boolean,
			default: true
		},
		plan: {
			type: String,
			enum: Object.values(TenantPlan),
			default: TenantPlan.basic
		},
		commission: {
			percentage: {
				type: Number,
				default: 10,
				min: 0,
				max: 100
			},
			fixedFee: {
				type: Number,
				default: 0,
				min: 0
			}
		},
		settings: {
			logo: { type: String },
			primaryColor: { type: String, default: '#3B82F6' },
			allowedOrigins: [{ type: String }]
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// slug ya tiene unique:true → índice automático
// domain ya tiene sparse:true → definido arriba
TenantSchema.index({ isActive: 1 });
