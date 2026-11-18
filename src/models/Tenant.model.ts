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
		businessType: {
			type: String,
			trim: true,
			lowercase: true,
			match: [/^[a-z0-9_]+$/, 'El rubro comercial debe tener formato slug válido (minúsculas, números y _)'],
			required: [true, 'El rubro comercial es obligatorio']
		},
		domain: {
			type: String,
			trim: true,
			lowercase: true,
			sparse: true
		},
		domainMode: {
			type: String,
			enum: ['vexx_subdomain', 'custom_domain'],
			default: 'vexx_subdomain'
		},
		activeTemplateKey: {
			type: String,
			trim: true,
			lowercase: true
		},
		unlockedTemplates: {
			type: [String],
			default: []
		},
		templateSettings: {
			type: Schema.Types.Mixed,
			default: {}
		},
		apiKey: {
			type: String,
			unique: true,
			sparse: true,
			trim: true
		},
		ownerContact: {
			email: { type: String, trim: true, lowercase: true },
			name: { type: String, trim: true },
			phone: { type: String, trim: true }
		},
		isActive: {
			type: Boolean,
			default: true
		},
		subscriptionStatus: {
			type: String,
			enum: ['active', 'past_due', 'suspended', 'trial'],
			default: 'active'
		},
		plan: {
			type: String,
			enum: Object.values(TenantPlan),
			default: TenantPlan.basic
		},
		planTier: {
			type: String,
			trim: true,
			lowercase: true,
			match: [/^[a-z0-9_-]+$/, 'El código de plan (planTier) debe tener formato slug válido'],
			required: [true, 'El plan de suscripción (planTier) es obligatorio']
		},
		activeAddons: {
			type: [String],
			default: []
		},
		customLabels: {
			type: Map,
			of: String,
			default: {}
		},
		addonLabels: {
			type: Schema.Types.Mixed,
			default: {}
		},
		extraEmployeesPurchased: {
			type: Number,
			default: 0,
			min: 0
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
