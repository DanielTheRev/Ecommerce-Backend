import { Schema } from 'mongoose';
import {
	IStorefrontTemplate,
	ITemplateCustomizableField,
	TEMPLATE_CHECKOUT_MODES,
	TEMPLATE_ENGINE_TYPES,
	TEMPLATE_PRICING_TYPES
} from '@/interfaces/storefrontTemplate.interface';
import { VexxPlanTier } from '@/interfaces/plan.interface';

const TemplateCustomizableFieldSchema = new Schema<ITemplateCustomizableField>(
	{
		key: { type: String, required: true, trim: true },
		label: { type: String, required: true, trim: true },
		type: {
			type: String,
			enum: ['string', 'boolean', 'select', 'color'],
			required: true
		},
		defaultValue: { type: Schema.Types.Mixed, required: true },
		options: { type: [String], default: undefined },
		description: { type: String, trim: true }
	},
	{ _id: false }
);

export const StorefrontTemplateSchema = new Schema<IStorefrontTemplate>(
	{
		key: {
			type: String,
			required: [true, 'La clave (key) de la plantilla es obligatoria'],
			unique: true,
			trim: true,
			lowercase: true,
			match: [/^[a-z0-9_-]+$/, 'La clave de la plantilla debe contener solo minúsculas, números, guiones y guiones bajos']
		},
		name: {
			type: String,
			required: [true, 'El nombre de la plantilla es obligatorio'],
			trim: true
		},
		shortDescription: {
			type: String,
			required: [true, 'La descripción corta es obligatoria'],
			trim: true
		},
		longDescription: {
			type: String,
			trim: true
		},
		engine: {
			type: String,
			enum: TEMPLATE_ENGINE_TYPES,
			default: 'astro',
			required: true
		},
		checkoutMode: {
			type: String,
			enum: TEMPLATE_CHECKOUT_MODES,
			default: 'whatsapp_and_pickup',
			required: true
		},
		templateKind: {
			type: String,
			enum: ['mobile_catalog', 'full_website']
		},
		thumbnailUrl: {
			type: String,
			default: '',
			trim: true
		},
		previewUrl: {
			type: String,
			trim: true
		},
		minPlanTier: {
			type: String,
			enum: Object.values(VexxPlanTier),
			default: VexxPlanTier.POINT,
			required: true
		},
		supportedBusinessTypes: {
			type: [String],
			default: ['*']
		},
		pricingType: {
			type: String,
			enum: TEMPLATE_PRICING_TYPES,
			default: 'included_in_plan',
			required: true
		},
		priceARS: {
			type: Number,
			default: 0,
			min: 0
		},
		monthlyPriceARS: {
			type: Number,
			min: 0
		},
		oneTimePriceARS: {
			type: Number,
			min: 0
		},
		features: {
			type: [String],
			default: []
		},
		customizableFields: {
			type: [TemplateCustomizableFieldSchema],
			default: []
		},
		isDefaultForPlan: {
			type: Schema.Types.Mixed,
			default: {}
		},
		isDefaultForBusinessType: {
			type: Schema.Types.Mixed,
			default: {}
		},
		isActive: {
			type: Boolean,
			default: true
		}
	},
	{
		timestamps: true,
		versionKey: false,
		collection: 'storefront_templates'
	}
);

StorefrontTemplateSchema.index({ isActive: 1, minPlanTier: 1 });
