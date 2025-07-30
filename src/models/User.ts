import { Schema, model, Document } from 'mongoose';

export enum Role {
	user = 'user',
	admin = 'admin'
}

export interface IUser extends Document {
	name: string;
	email: string;
	role: Role;
	googleID: string;
	profilePhoto: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

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
			trim: true
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

// Middleware para hashear password antes de guardar
// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();

//   try {
//     const salt = await bcrypt.genSalt(12);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (error) {
//     next(error as Error);
//   }
// });

// Método para comparar contraseñas
// userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// Índices
userSchema.index({ email: 1 });
userSchema.index({ isActive: 1 });

export const User = model<IUser>('User', userSchema);
