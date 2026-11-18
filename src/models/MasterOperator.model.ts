import { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type MasterOperatorRole = 'superadmin' | 'operator';

export interface IMasterOperator {
	_id: string;
	name: string;
	email: string;
	password?: string;
	role: MasterOperatorRole;
	permissions: string[];
	isActive: boolean;
	tokenVersion: number;
	resetPasswordTokenHash?: string;
	resetPasswordExpiresAt?: Date;
	lastLoginAt?: Date;
	createdAt: Date;
	updatedAt: Date;
	comparePassword?(candidatePassword: string): Promise<boolean>;
}

export const MasterOperatorSchema = new Schema<IMasterOperator>(
	{
		name: {
			type: String,
			required: [true, 'El nombre del operador es requerido'],
			trim: true
		},
		email: {
			type: String,
			required: [true, 'El email del operador es requerido'],
			unique: true,
			trim: true,
			lowercase: true
		},
		password: {
			type: String,
			required: [true, 'La contraseña es requerida'],
			minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
			select: false
		},
		role: {
			type: String,
			enum: ['superadmin', 'operator'],
			default: 'operator',
			required: true
		},
		permissions: {
			type: [String],
			default: []
		},
		isActive: {
			type: Boolean,
			default: true
		},
		tokenVersion: {
			type: Number,
			default: 0
		},
		resetPasswordTokenHash: {
			type: String,
			select: false
		},
		resetPasswordExpiresAt: {
			type: Date,
			select: false
		},
		lastLoginAt: {
			type: Date
		}
	},
	{
		timestamps: true,
		versionKey: false,
		collection: 'master_operators'
	}
);

MasterOperatorSchema.pre('save', async function (next) {
	try {
		if (this.isModified('password') && this.password) {
			const salt = await bcrypt.genSalt(12);
			this.password = await bcrypt.hash(this.password, salt);
		}
		next();
	} catch (error) {
		next(error as Error);
	}
});

MasterOperatorSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
	if (!this.password) return false;
	return bcrypt.compare(candidatePassword, this.password);
};

MasterOperatorSchema.index({ isActive: 1, role: 1 });
