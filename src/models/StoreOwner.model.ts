import { Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IStoreOwner {
	_id: string;
	tenantId: Types.ObjectId | string;
	name: string;
	lastName?: string;
	email: string;
	phone?: string;
	dni?: string;
	profilePhoto?: string;
	password?: string;
	isActive: boolean;
	isEmailVerified: boolean;
	tokenVersion: number;
	resetPasswordTokenHash?: string;
	resetPasswordExpiresAt?: Date;
	lastLoginAt?: Date;
	createdAt: Date;
	updatedAt: Date;
	comparePassword?(candidatePassword: string): Promise<boolean>;
}

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

export const StoreOwnerSchema = new Schema<IStoreOwner>(
	{
		tenantId: {
			type: Schema.Types.ObjectId,
			ref: 'Tenant',
			required: [true, 'El comercio asociado es requerido'],
			index: true
		},
		name: {
			type: String,
			required: [true, 'El nombre del dueño es requerido'],
			trim: true
		},
		lastName: {
			type: String,
			trim: true
		},
		email: {
			type: String,
			required: [true, 'El email del dueño es requerido'],
			trim: true,
			lowercase: true
		},
		phone: {
			type: String,
			trim: true
		},
		dni: {
			type: String,
			trim: true
		},
		profilePhoto: {
			type: String
		},
		password: {
			type: String,
			required: [true, 'La contraseña es requerida'],
			minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
			select: false
		},
		isActive: {
			type: Boolean,
			default: true
		},
		isEmailVerified: {
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
		collection: 'store_owners'
	}
);

StoreOwnerSchema.pre('save', async function (next) {
	try {
		if (this.isModified('password') && this.password && !BCRYPT_HASH_REGEX.test(this.password)) {
			const salt = await bcrypt.genSalt(12);
			this.password = await bcrypt.hash(this.password, salt);
		}
		next();
	} catch (error) {
		next(error as Error);
	}
});

StoreOwnerSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
	if (!this.password) return false;
	return bcrypt.compare(candidatePassword, this.password);
};

StoreOwnerSchema.index({ tenantId: 1, email: 1 }, { unique: true });
StoreOwnerSchema.index({ tenantId: 1, isActive: 1 });
