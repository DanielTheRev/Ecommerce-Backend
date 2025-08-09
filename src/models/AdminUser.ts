import { Schema, model, Document } from 'mongoose';
import { Role } from './User';
import bcrypt from 'bcryptjs';

export interface IAdminUser extends Document {
	name: string;
	email: string;
	role: Role.admin;
	password: string;
	token: string;
	comparePassword(candidatePassword: string): Promise<boolean>;
	hasPassword(password: string): Promise<string>;
}

export interface IAdminUserCreate {
	name: string;
	email: string;
	password: string;
	token?: string;
}

const userAdminSchema = new Schema<IAdminUser>(
	{
		name: {
			type: String,
			required: [true, 'El nombre es requerido'],
			trim: true
		},
		email: {
			type: String,
			required: [true, 'El email es requerido'],
			unique: true,
			trim: true,
			lowercase: true
		},
		password: {
			type: String,
			required: [true, 'La contraseña es requerida'],
			minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
		},
		role: {
			type: String,
			enum: Role,
			default: Role.admin
		},
		token: {
			type: String,
			required: false
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// Middleware para hashear password antes de guardar
userAdminSchema.pre('save', async function (next) {
	if (!this.isModified('password')) return next();

	try {
		const salt = await bcrypt.genSalt(12);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error) {
		next(error as Error);
	}
});

// Método para comparar contraseñas
userAdminSchema.methods.comparePassword = async function (
	candidatePassword: string
): Promise<boolean> {
	return bcrypt.compare(candidatePassword, this.password);
};

export const AdminUsers = model<IAdminUser>('AdminUsers', userAdminSchema);
