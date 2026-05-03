import { Schema, model } from 'mongoose';
import { IFavoriteDocument } from '@/interfaces/favorites.interface';

const favoriteSchema = new Schema<IFavoriteDocument>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true
		},
		product: {
			type: Schema.Types.ObjectId,
			ref: 'Product',
			required: true
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// Índice único compuesto: un usuario no puede tener el mismo producto dos veces
favoriteSchema.index({ user: 1, product: 1 }, { unique: true });

// Índice para búsquedas rápidas por usuario
favoriteSchema.index({ user: 1, createdAt: -1 });

export { favoriteSchema };

export const Favorite = model<IFavoriteDocument>('Favorite', favoriteSchema);
