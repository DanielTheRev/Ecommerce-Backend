import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, protect, staffOnly } from '@/middleware/auth';
import { requireAddon } from '@/middleware/addonGuard';
import { AppError } from '@/errors/app.error';
import {
	ECOMMERCE_NATIVE_LIST_KEYS,
	getEcommerceListValues,
	mergeUniqueOptionLists,
	parseEcommerceOptionsSource,
	ProductSpecFieldSchema
} from '@/config/formCapabilities';
import { CacheService } from '@/services/cache.service';

const router: Router = Router();

const addSpecOptionSchema = z.object({
	key: z.string().trim().min(1, 'El campo key es obligatorio.'),
	value: z.string().trim().min(1, 'El valor de la nueva opción es obligatorio.').max(120)
});

function parseFieldsFromSettings(settings: Record<string, unknown> | undefined): ProductSpecFieldSchema[] {
	const raw = settings?.specFieldsJson;
	if (typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as ProductSpecFieldSchema[]) : [];
	} catch {
		return [];
	}
}

/**
 * POST /api/addons/details-builder/spec-options
 * Agrega una nueva opción a un campo select con allowMerchantAddOption: true.
 * - Si el campo tiene optionsSource === 'ecommerce.clothingFits', persiste en EcommerceConfig.clothingFits ($addToSet).
 * - Si es un campo propio del addon, actualiza AddonInstallation.settings.specFieldsJson del tenant.
 */
router.post(
	'/spec-options',
	protect,
	requireAddon('details_builder', 'Details Builder — Atributos, Cuidados & Tags'),
	staffOnly,
	async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { key, value } = addSpecOptionSchema.parse(req.body || {});
			const models = req.models!;
			const tenantSlug = req.tenant?.slug;

			const installation = await models.AddonInstallation.findOne({
				addonId: { $in: ['details_builder', 'tech_specs', 'product_details'] }
			}).lean();

			const currentSettings = (installation?.settings || {}) as Record<string, unknown>;
			let fields = parseFieldsFromSettings(currentSettings);

			const targetIndex = fields.findIndex(
				(f) => String(f.key || '').trim().toLowerCase() === key.toLowerCase()
			);
			if (targetIndex === -1) {
				throw new AppError(
					'Spec field not found',
					`El campo '${key}' no está configurado en details_builder para este comercio.`,
					404
				);
			}

			const targetField = fields[targetIndex];
			if (targetField.inputType !== 'select' || !targetField.allowMerchantAddOption) {
				throw new AppError(
					'Option addition not allowed',
					`El campo '${targetField.key}' no permite agregar opciones desde el formulario.`,
					400
				);
			}

			let updatedOptions: string[];

			if (targetField.optionsSource) {
				const listKey = parseEcommerceOptionsSource(targetField.optionsSource);
				if (!listKey) {
					throw new AppError(
						'Invalid optionsSource',
						`El origen '${targetField.optionsSource}' no tiene un formato válido (esperado: ecommerce.<clave>).`,
						400
					);
				}
				const existingConfig = await models.EcommerceConfig.findOne({ key: 'global_config' }).lean();
				const existingValues = getEcommerceListValues(existingConfig, targetField.optionsSource);
				const alreadyExists = existingValues.some((o) => o.trim().toLowerCase() === value.toLowerCase());
				if (!alreadyExists) {
					const dbFieldPath = ECOMMERCE_NATIVE_LIST_KEYS.has(listKey) ? listKey : `customLists.${listKey}`;
					await models.EcommerceConfig.updateOne(
						{ key: 'global_config' },
						{ $addToSet: { [dbFieldPath]: value } }
					);
				}
				if (tenantSlug) {
					CacheService.invalidatePrefix(tenantSlug, 'config');
				}
				updatedOptions = mergeUniqueOptionLists(existingValues, targetField.options, [value]);
			} else {
				updatedOptions = mergeUniqueOptionLists(targetField.options, [value]);
				fields = fields.map((f, idx) =>
					idx === targetIndex ? { ...f, options: updatedOptions } : f
				);
				const targetAddonId = installation?.addonId || 'details_builder';
				await models.AddonInstallation.findOneAndUpdate(
					{ addonId: targetAddonId },
					{
						$set: {
							addonId: targetAddonId,
							isConfigured: true,
							settings: {
								...currentSettings,
								specFieldsJson: JSON.stringify(fields)
							}
						}
					},
					{ upsert: true }
				);
			}

			res.status(200).json({
				success: true,
				data: {
					key: targetField.key,
					options: updatedOptions
				}
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
