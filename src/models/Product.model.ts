import mongoose, { Schema } from 'mongoose';
import {
	ClothingGender,
	ClothingSizeType,
	IProductDocument
} from '@/interfaces/product.interface';

export const ProductSchema = new Schema<IProductDocument>(
	{
		// ====================================================================
		// BLOQUE 1: BASE PRODUCT (Común a Mostrador, Catálogo y E-commerce)
		// ====================================================================
		name: {
			type: String,
			required: false,
			trim: true,
			maxlength: 250
		},
		brand: {
			type: String,
			required: false,
			trim: true,
			maxlength: 200,
			default: undefined
		},
		model: {
			type: String,
			required: false,
			trim: true,
			maxlength: 200,
			default: undefined
		},
		subtitle: {
			type: String,
			trim: true,
			maxlength: 200
		},
		category: {
			type: String,
			required: [true, 'La categoría es obligatoria']
		},
		shortDescription: {
			type: String,
			required: false,
			default: undefined,
			trim: true
		},
		largeDescription: {
			type: String,
			required: false,
			default: undefined,
			trim: true
		},
		descriptions: {
			subtitle: { type: String, trim: true, maxlength: 200 },
			shortDescription: { type: String, trim: true, default: undefined },
			largeDescription: { type: String, trim: true, default: undefined }
		},
		slug: {
			type: String,
			unique: true
		},
		netStock: {
			type: Number,
			required: true,
			default: 0,
			min: 0
		},
		price: {
			listPrice: { type: Number, required: true, default: 0 },
			card_ticket1PayPrice: { type: Number, required: true, default: 0 },
			cashTransferPrice: { type: Number, required: true, default: 0 },
			cashPrice: { type: Number },
			transferPrice: { type: Number },
			qrPrice: { type: Number },
			debitPrice: { type: Number },
			discountPercentageTransfer: { type: Number, required: true, default: 0 },
			channels: { type: Schema.Types.Mixed },
			displaySummary: { type: Schema.Types.Mixed },
			updatedAt: { type: Date, default: Date.now },
			shippingSubsidy: { type: Number, default: 0 },
			installments: {
				threePaymentsAmount: { type: Number, required: true, default: 0 },
				sixPaymentsAmount: { type: Number, required: true, default: 0 },
				hasThreeInstallmentsSeamless: { type: Boolean, required: true, default: false },
				hasSixInstallmentsSeamless: { type: Boolean, required: true, default: false }
			}
		},
		finance: {
			type: new Schema(
				{
					exchangeRateSnapshot: { type: Number, required: true },
					mpCommissionSnapshot: {
						base: { type: Number, required: true },
						cft3Cuotas: { type: Number, required: true },
						cft6Cuotas: { type: Number, required: true }
					},
					providerCost: {
						inUSD: { type: Number, required: true },
						inARS: { type: Number, required: true }
					},
					additionalCosts: [
						{
							_id: false,
							concept: { type: String, required: true },
							value: { type: Number, required: true },
							type: {
								type: String,
								enum: ['fixed', 'percent_over_provider', 'percent_over_price'],
								required: true
							},
							category: {
								type: String,
								enum: ['expense', 'tax', 'shipping']
							}
						}
					],
					pricingStrategy: {
						method: { type: String, enum: ['markup', 'margin'], required: true },
						targetProfit: { type: Number, required: true }
					},
					calculatedProfits: {
						cash: { type: Number, default: 0 },
						transfer: { type: Number, default: 0 },
						qr: { type: Number, default: 0 },
						debit: { type: Number, default: 0 },
						card_ticket1Pay: { type: Number, default: 0 },
						card3Installments: { type: Number, default: 0 },
						card6Installments: { type: Number, default: 0 }
					}
				},
				{ _id: false }
			),
			required: true,
			select: false
		},
		channelPricing: { type: Schema.Types.Mixed },
		paymentRestrictions: {
			allowCardPayment: { type: Boolean, default: true },
			allowInterestFreeInstallments: { type: Boolean, default: true },
			maxInstallments: { type: Number, min: 1, max: 18 }
		},
		discount: {
			type: Number,
			required: true,
			default: 0,
			min: 0,
			max: 100
		},
		rating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5
		},
		reviews: {
			type: Number,
			default: 0,
			min: 0
		},
		images: {
			type: [
				{
					_id: false,
					id: { type: String, trim: true },
					url: { type: String, required: true },
					public_id: { type: String, required: false, default: '' },
					storageProvider: { type: String, required: false, default: 'cloudinary' },
					storageKey: { type: String, required: false, default: '' },
					width: { type: Number, required: false },
					height: { type: Number, required: false },
					bytes: { type: Number, required: false },
					format: { type: String, required: false },
					variantSkus: { type: [String], default: undefined },
					crops: {
						type: [
							{
								_id: false,
								aspectRatio: { type: String, enum: ['original', '1:1', '9:16', '4:5', '16:9'], required: true },
								url: { type: String, required: true },
								public_id: { type: String, required: false, default: '' },
								storageKey: { type: String, required: false, default: '' },
								width: { type: Number, required: false },
								height: { type: Number, required: false },
								bytes: { type: Number, required: false },
								format: { type: String, required: false }
							}
						],
						default: undefined
					},
					// [REMOVE-BEFORE-PROD]: legacy singular tagging fields
					variantSku: { type: String, trim: true },
					colorName: { type: String, trim: true },
					isMain: { type: Boolean, default: false },
					aspectRatio: {
						type: String,
						enum: ['original', '1:1', '9:16', '4:5', '16:9'],
						default: undefined
					}
				}
			],
			default: undefined
		},
		specifications: {
			type: [
				{
					_id: false,
					key: { type: String, required: true, trim: true },
					value: { type: String, required: true, trim: true },
					isFeatured: { type: Boolean, default: false }
				}
			],
			default: undefined
		},
		tags: {
			type: [String],
			default: undefined,
			index: true
		},
		features: {
			type: [String],
			default: undefined
		},
		lowStockThreshold: {
			type: Number,
			default: 3,
			min: 0
		},
		status: {
			type: String,
			enum: ['published', 'draft', 'paused', 'archived'],
			default: 'draft',
			index: true
		},
		isFeatured: {
			type: Boolean,
			default: false,
			index: true
		},
		rankingScore: {
			type: Number,
			default: 100,
			index: true
		},
		metrics: {
			viewsCount: { type: Number, default: 0 },
			botViewsCount: { type: Number, default: 0 },
			cartAddsCount: { type: Number, default: 0 },
			salesCount: { type: Number, default: 0 },
			viewsByDevice: {
				mobile: { type: Number, default: 0 },
				desktop: { type: Number, default: 0 },
				tablet: { type: Number, default: 0 },
				bot: { type: Number, default: 0 }
			},
			recentViews: [
				{
					viewedAt: { type: Date, default: Date.now },
					device: { type: String, enum: ['mobile', 'desktop', 'tablet', 'bot'], default: 'desktop' },
					browser: { type: String },
					os: { type: String },
					url: { type: String },
					referrer: { type: String },
					ip: { type: String },
					isBot: { type: Boolean, default: false },
					botName: { type: String },
					userAgent: { type: String },
					rejectionReason: { type: String },
					manuallyApproved: { type: Boolean, default: false }
				}
			],
			lastViewedAt: { type: Date }
		},
		effectiveScore: {
			type: Number,
			default: 100,
			index: true
		},
		seo: {
			metaTitle: { type: String },
			metaDescription: { type: String },
			metaImage: {
				url: { type: String },
				public_id: { type: String }
			}
		},
		provider: {
			type: Schema.Types.ObjectId,
			ref: 'Provider',
			select: false
		},
		linkProductProvider: {
			type: String,
			trim: true,
			select: false
		},
		recommendationsMode: {
			type: String,
			enum: ['auto', 'manual'],
			default: 'auto'
		},
		manualRecommendations: {
			type: [
				{
					type: Schema.Types.ObjectId,
					ref: 'Product'
				}
			],
			default: undefined
		},
		productType: {
			type: String,
			required: false,
			index: true
		},

		// ====================================================================
		// BLOQUE 2: VARIANTES UNIFICADAS
		// ====================================================================
		variants: {
			type: [
				new Schema(
					{
						sku: {
							type: String,
							required: true,
							trim: true,
							uppercase: true
						},
						label: {
							type: String,
							required: false,
							trim: true
						},
						stock: {
							type: Number,
							required: true,
							default: 0,
							min: 0
						},
						price: {
							type: Number,
							required: false,
							min: 0
						},
						inheritPrice: {
							type: Boolean,
							default: true
						},
						providerCost: {
							type: Number,
							required: false,
							min: 0
						},
						profitMargin: {
							type: Number,
							required: false,
							min: 0
						},
						prices: {
							type: Schema.Types.Mixed,
							required: false
						},
						reservedStock: {
							type: Number,
							default: 0,
							min: 0
						},
						isActive: {
							type: Boolean,
							default: true
						},
						barcode: {
							type: String,
							trim: true
						},
						color: {
							type: new Schema(
								{
									name: { type: String, required: true },
									hex: { type: String, required: true }
								},
								{ _id: false }
							),
							required: false
						},
						imageReference: {
							url: { type: String, required: false },
							public_id: { type: String, required: false }
						},
						imageIndex: {
							type: Number,
							required: false
						},
						size: {
							type: String,
							required: false,
							trim: true
						},
						volume: {
							type: String,
							required: false,
							trim: true
						},
						attributes: {
							type: [
								new Schema(
									{
										key: { type: String, required: true },
										value: { type: String, required: true }
									},
									{ _id: false }
								)
							],
							required: false,
							default: undefined
						}
					},
					{ _id: true }
				)
			],
			default: []
		},

		// ====================================================================
		// BLOQUE 3: MOSTRADOR, BALANZA Y PESABLES (Almacén / Carnicería / Kiosco)
		// ====================================================================
		barcode: {
			type: String,
			trim: true,
			sparse: true,
			index: true
		},
		isSoldByWeight: {
			type: Boolean,
			default: false,
			index: true
		},
		unit: {
			type: String,
			enum: ['kg', 'g', 'docena', 'un', 'l', 'ml'],
			trim: true,
			default: undefined
		},
		weight: {
			type: String,
			trim: true,
			default: undefined
		},

		// ====================================================================
		// BLOQUE 4: INDUMENTARIA & CALZADO (Moda)
		// ====================================================================
		gender: {
			type: String,
			enum: Object.values(ClothingGender),
			required: false
		},
		fit: {
			type: String,
			required: false,
			trim: true
		},
		material: {
			type: String,
			trim: true
		},
		composition: {
			type: [
				new Schema(
					{
						material: { type: String, required: true },
						percentage: { type: Number, required: true, min: 0, max: 100 }
					},
					{ _id: false }
				)
			],
			default: undefined
		},
		sizeType: {
			type: String,
			enum: Object.values(ClothingSizeType)
		},
		sizeGuide: {
			type: new Schema(
				{
					headers: [{ type: String }],
					rows: [
						{
							_id: false,
							size: { type: String, required: true },
							values: [{ type: String }]
						}
					],
					tolerance: { type: String, trim: true }
				},
				{ _id: false }
			),
			required: false
		},
		careInstructions: {
			type: [String],
			default: undefined
		},
		season: {
			type: String,
			trim: true
		},
		combineWith: {
			type: [
				{
					product: {
						type: Schema.Types.ObjectId,
						ref: 'Product',
						required: true
					},
					variantSku: {
						type: String,
						default: null,
						trim: true
					},
					color: {
						type: String,
						default: null,
						trim: true
					}
				}
			],
			default: undefined
		},

		// ====================================================================
		// BLOQUE 5: TECNOLOGÍA & CELULARES
		// ====================================================================
		storage: {
			type: [String],
			default: undefined
		},
		ram: {
			type: String,
			trim: true
		},
		processor: {
			type: String,
			trim: true
		},
		screenSize: {
			type: String,
			trim: true
		},
		os: {
			type: String,
			trim: true
		},
		connectivity: {
			type: [String],
			default: undefined
		},

		// ====================================================================
		// BLOQUE 6: PERFUMERÍA & COSMÉTICA
		// ====================================================================
		volume: {
			type: String,
			trim: true
		},
		concentration: {
			type: String,
			trim: true
		},
		fragranceFamily: {
			type: String,
			trim: true
		},
		scentNotes: {
			type: new Schema(
				{
					top: { type: String, trim: true },
					heart: { type: String, trim: true },
					base: { type: String, trim: true }
				},
				{ _id: false }
			),
			required: false
		},
		applicationArea: {
			type: String,
			trim: true
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

// ============================================================================
// ÍNDICES
// ============================================================================
ProductSchema.index({ slug: -1 });
ProductSchema.index({ brand: 1, model: 1 });
ProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
ProductSchema.index({ 'variants.barcode': 1 }, { sparse: true });
ProductSchema.index({ barcode: 1 }, { sparse: true });
ProductSchema.index({ name: 'text', brand: 'text', model: 'text', category: 'text' });

// Alias de retrocompatibilidad
export const BaseProductSchema = ProductSchema;

export const Product = mongoose.model<IProductDocument>('Product', ProductSchema);
