import { Schema, model } from 'mongoose';
import { IRoleProfileDocument } from '@/interfaces/permission.interface';

const roleProfileSchema = new Schema<IRoleProfileDocument>(
	{
		name: {
			type: String,
			required: [true, 'El nombre del perfil de rol es obligatorio'],
			trim: true
		},
		description: {
			type: String,
			trim: true,
			default: ''
		},
		permissions: {
			type: [String],
			default: []
		},
		isDefault: {
			type: Boolean,
			default: false
		}
	},
	{
		timestamps: true
	}
);

roleProfileSchema.index({ name: 1 });

export { roleProfileSchema };
export const RoleProfile = model<IRoleProfileDocument>('RoleProfile', roleProfileSchema);
