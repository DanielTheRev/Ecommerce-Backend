import { Document } from 'mongoose';

export type MasterProductSource = 'seed' | 'crowdsourced' | 'admin';

export interface IMasterProduct {
	barcode: string;
	name: string;
	brand?: string;
	category: string;
	description?: string;
	imageUrl?: string;
	unit?: string;
	isSoldByWeight?: boolean;
	suggestedPrice?: number;
	source: MasterProductSource;
	verified: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface IMasterProductDocument extends IMasterProduct, Document {}

export interface IMasterProductLookupResult {
	found: boolean;
	source?: 'database' | 'external' | 'not_found';
	product?: Partial<IMasterProduct>;
}
