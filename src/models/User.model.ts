import { IUser, Role } from '@/interfaces/user.interface';
import bcrypt from 'bcryptjs';
import { Schema, model } from 'mongoose';

const userSchema = new Schema<IUser>(
	{
		name: {
			type: String,
			required: [true, 'El nombre es requerido'],
			trim: true
		},
		googleID: {
			type: String,
			unique: true,
			trim: true,
			sparse: true
		},
		email: {
			type: String,
			required: [true, 'El email es requerido'],
			unique: true,
			trim: true,
			lowercase: true
		},
		profilePhoto: {
			type: String,
			trim: true
		},
		role: {
			type: String,
			enum: Role,
			default: Role.user
		},
		password: {
			type: String,
			minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
			select: false,
			default: null
		},
		isActive: {
			type: Boolean,
			default: true
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// Middleware to hash password before save
userSchema.pre('save', async function (next) {
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
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
	return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ isActive: 1 });

// Schema exportado para multi-tenancy (model registry)
export { userSchema };

export const User = model<IUser>('User', userSchema);
