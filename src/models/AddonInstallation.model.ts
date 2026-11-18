import { Document, Schema } from 'mongoose';

export interface IAddonInstallation extends Document {
	addonId: string;
	isConfigured: boolean;
	settings: Record<string, unknown>;
	configuredAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export const AddonInstallationSchema = new Schema<IAddonInstallation>(
	{
		addonId: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true
		},
		isConfigured: {
			type: Boolean,
			default: false
		},
		settings: {
			type: Schema.Types.Mixed,
			default: {}
		},
		configuredAt: {
			type: Date
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);
