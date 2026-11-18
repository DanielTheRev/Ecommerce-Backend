import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { connectionManager } from '@/config/multitenancy';
import { AppError } from '@/errors/app.error';
import { MEDIA_STUDIO_ASPECT_RATIOS } from '@/addons/media_studio';
import { normalizeActiveAddons } from '@/addons/registry';

const VERTICAL_PRESET_KEY_REGEX = /^[a-z0-9_]+$/;

const VerticalPresetLabelsSchema = z.object({
	nameLabel: z.string().trim().min(1),
	variantsTitle: z.string().trim().min(1),
	variantsSubtitle: z.string().trim().default(''),
	weightTitle: z.string().trim().min(1),
	specsTitle: z.string().trim().min(1),
	bundleTitle: z.string().trim().min(1),
});

const VerticalPresetColumnsSchema = z.object({
	showColorColumn: z.boolean(),
	showSizeColumn: z.boolean(),
	showVolumeColumn: z.boolean(),
	showAttributesColumn: z.boolean(),
	allowPerVariantPrice: z.boolean(),
	allowPerVariantMargin: z.boolean(),
});

const AddonLabelsSchema = z.record(z.string(), z.record(z.string(), z.string())).optional().default({});
const AddonSettingsSchema = z.record(z.string(), z.record(z.string(), z.unknown())).optional().default({});

export const UpsertVerticalPresetSchema = z.object({
	key: z
		.string()
		.trim()
		.regex(VERTICAL_PRESET_KEY_REGEX, 'La clave debe contener solo minúsculas, números y guiones bajos (/^[a-z0-9_]+$/).'),
	label: z.string().trim().min(1),
	icon: z.string().trim().min(1),
	variantMode: z.enum(['fashion', 'tech', 'presentation']),
	labels: VerticalPresetLabelsSchema,
	addonLabels: AddonLabelsSchema,
	addonSettings: AddonSettingsSchema,
	variantColumns: VerticalPresetColumnsSchema,
	defaultAspectRatios: z.array(z.enum(MEDIA_STUDIO_ASPECT_RATIOS)).default(['1:1']),
	recommendedAddons: z.array(z.string().trim().min(1)).default([]),
});

export const UpdateVerticalPresetBodySchema = UpsertVerticalPresetSchema.omit({ key: true }).extend({
	key: z
		.string()
		.trim()
		.regex(VERTICAL_PRESET_KEY_REGEX, 'La clave debe contener solo minúsculas, números y guiones bajos (/^[a-z0-9_]+$/).')
		.optional(),
});

export class VerticalPresetController {
	private static getCollection() {
		return connectionManager.getMasterDb().collection('vertical_presets');
	}

	/**
	 * GET /api/master/vertical-presets
	 */
	static async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const presets = await this.getCollection()
				.find({})
				.sort({ key: 1 })
				.toArray();

			res.status(200).json({
				success: true,
				count: presets.length,
				data: presets,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PUT /api/master/vertical-presets/:key
	 */
	static async updateByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const key = String(req.params.key || '').trim();
			if (!VERTICAL_PRESET_KEY_REGEX.test(key)) {
				throw new AppError(
					'Invalid vertical preset key',
					`La clave '${key}' no es válida. Debe cumplir /^[a-z0-9_]+$/.`,
					400
				);
			}

			const parsed = UpdateVerticalPresetBodySchema.parse(req.body);
			const now = new Date();
			const recommendedAddons = normalizeActiveAddons(parsed.recommendedAddons);

			const updated = await this.getCollection().findOneAndUpdate(
				{ key },
				{
					$set: {
						label: parsed.label,
						icon: parsed.icon,
						variantMode: parsed.variantMode,
						labels: parsed.labels,
						addonLabels: parsed.addonLabels ?? {},
						addonSettings: parsed.addonSettings ?? {},
						variantColumns: parsed.variantColumns,
						defaultAspectRatios: parsed.defaultAspectRatios,
						recommendedAddons,
						updatedAt: now,
					},
				},
				{ returnDocument: 'after' }
			);

			if (!updated) {
				throw new AppError(
					'Vertical preset not found',
					`El preset de rubro '${key}' no existe en master_db.vertical_presets.`,
					404
				);
			}

			res.status(200).json({
				success: true,
				data: updated,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/master/vertical-presets
	 */
	static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const parsed = UpsertVerticalPresetSchema.parse(req.body);
			const collection = this.getCollection();

			const existing = await collection.findOne({ key: parsed.key });
			if (existing) {
				throw new AppError(
					'Vertical preset already exists',
					`Ya existe un preset con la clave '${parsed.key}'.`,
					409
				);
			}

			const now = new Date();
			const doc = {
				key: parsed.key,
				label: parsed.label,
				icon: parsed.icon,
				variantMode: parsed.variantMode,
				labels: parsed.labels,
				addonLabels: parsed.addonLabels ?? {},
				addonSettings: parsed.addonSettings ?? {},
				variantColumns: parsed.variantColumns,
				defaultAspectRatios: parsed.defaultAspectRatios,
				recommendedAddons: normalizeActiveAddons(parsed.recommendedAddons),
				createdAt: now,
				updatedAt: now,
			};

			const insertRes = await collection.insertOne(doc);
			const created = await collection.findOne({ _id: insertRes.insertedId });

			res.status(201).json({
				success: true,
				data: created || doc,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /api/master/vertical-presets/:key
	 */
	static async deleteByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const key = String(req.params.key || '').trim().toLowerCase();
			if (!VERTICAL_PRESET_KEY_REGEX.test(key)) {
				throw new AppError('Invalid vertical preset key', `La clave '${key}' no es válida.`, 400);
			}

			const masterDb = connectionManager.getMasterDb();
			const TenantModel = masterDb.model('Tenant');
			const activeTenantsUsingIt = await TenantModel.countDocuments({
				businessType: key,
				isActive: true
			});

			if (activeTenantsUsingIt > 0) {
				throw new AppError(
					'Vertical preset in use',
					`No se puede eliminar el rubro '${key}' porque hay ${activeTenantsUsingIt} comercio(s) activos asignados a este rubro.`,
					409
				);
			}

			const deleted = await this.getCollection().findOneAndDelete({ key });
			if (!deleted) {
				throw new AppError(
					'Vertical preset not found',
					`El preset de rubro '${key}' no existe en master_db.vertical_presets.`,
					404
				);
			}

			res.status(200).json({
				success: true,
				message: `Preset de rubro '${key}' eliminado correctamente.`,
				data: { deletedKey: key }
			});
		} catch (error) {
			next(error);
		}
	}
}
