import { z } from 'zod';
import { connectionManager } from '@/config/multitenancy';
import { AppError } from '@/errors/app.error';
import { VexxPlanTier, PlanLimits } from '@/interfaces/plan.interface';
import { ITenant } from '@/interfaces/tenant.interface';
import { getSuggestedAddonsForSetup, normalizeActiveAddons, validateActiveAddonsForTenant } from '@/addons/registry';
import { getPlanLimits } from '@/config/planCapabilities';

const PLAN_CODE_REGEX = /^[a-z0-9_-]+$/;

export interface ISubscriptionPlan {
	_id?: string;
	code: string; // ej: 'local', 'point', 'pro', 'starter', 'enterprise'
	baseTier: VexxPlanTier; // 'local' | 'point' | 'pro' (nivel técnico base que hereda)
	name: string; // ej: 'Vexx Local'
	title: string; // ej: 'Operación física & mostrador'
	description: string;
	monthlyPriceARS: number;
	annualPriceARS?: number;
	includedAddonsLimit: number; // -1 para ilimitados
	limits: PlanLimits & {
		maxImagesPerProduct?: number;
	};
	defaultAddons: string[];
	badgeText?: string;
	isFeatured?: boolean;
	sortOrder: number;
	isActive: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export const UpsertSubscriptionPlanZodSchema = z.object({
	code: z
		.string()
		.trim()
		.toLowerCase()
		.regex(PLAN_CODE_REGEX, 'El código del plan debe contener solo minúsculas, números, guiones y guiones bajos.'),
	baseTier: z.nativeEnum(VexxPlanTier).default(VexxPlanTier.POINT),
	name: z.string().trim().min(1, 'El nombre del plan es obligatorio.'),
	title: z.string().trim().min(1, 'El título comercial del plan es obligatorio.'),
	description: z.string().trim().default(''),
	monthlyPriceARS: z.coerce.number().min(0, 'El precio mensual no puede ser negativo.'),
	annualPriceARS: z.coerce.number().min(0).optional(),
	includedAddonsLimit: z.coerce.number().int().min(-1).default(5),
	limits: z.object({
		baseEmployees: z.coerce.number().int().min(1).default(10),
		maxProducts: z.coerce.number().int().min(-1).default(-1),
		maxImagesPerProduct: z.coerce.number().int().min(1).max(100).optional()
	}),
	defaultAddons: z.array(z.string().trim().min(1)).default([]),
	badgeText: z.string().trim().optional(),
	isFeatured: z.boolean().default(false),
	sortOrder: z.coerce.number().int().default(10),
	isActive: z.boolean().default(true)
});

export const UpdateSubscriptionPlanZodSchema = UpsertSubscriptionPlanZodSchema.omit({ code: true }).partial();

export class SubscriptionPlanService {
	private static seededCheckDone = false;
	private static customPlansCache = new Map<string, ISubscriptionPlan>();

	private static getCollection() {
		return connectionManager.getMasterDb().collection<ISubscriptionPlan>('subscription_plans');
	}

	static getDefaultPlansSeed(): ISubscriptionPlan[] {
		return [
			{
				code: VexxPlanTier.LOCAL,
				baseTier: VexxPlanTier.LOCAL,
				name: 'Vexx Local',
				title: 'Operación física & mostrador',
				description: 'POS de mostrador, cobro en caja, control de stock y gestión local.',
				monthlyPriceARS: 30000,
				includedAddonsLimit: 3,
				limits: {
					...getPlanLimits(VexxPlanTier.LOCAL),
					maxImagesPerProduct: 10
				},
				defaultAddons: getSuggestedAddonsForSetup(VexxPlanTier.LOCAL),
				badgeText: 'Mostrador Físico',
				isFeatured: false,
				sortOrder: 10,
				isActive: true
			},
			{
				code: VexxPlanTier.POINT,
				baseTier: VexxPlanTier.POINT,
				name: 'Vexx Point',
				title: 'Local + Catálogo & Pedidos Online',
				description: 'Punto físico con catálogo interactivo, plantilla móvil, pedidos online y delivery local.',
				monthlyPriceARS: 48000,
				includedAddonsLimit: 5,
				limits: {
					...getPlanLimits(VexxPlanTier.POINT),
					maxImagesPerProduct: 25
				},
				defaultAddons: getSuggestedAddonsForSetup(VexxPlanTier.POINT),
				badgeText: 'Más Elegido',
				isFeatured: true,
				sortOrder: 20,
				isActive: true
			},
			{
				code: VexxPlanTier.PRO,
				baseTier: VexxPlanTier.PRO,
				name: 'Vexx Pro',
				title: 'Omnicanal & Escala',
				description: 'Tienda web completa, dominio propio, píxeles de marketing, emails transaccionales y facturación fiscal.',
				monthlyPriceARS: 85000,
				includedAddonsLimit: 10,
				limits: {
					...getPlanLimits(VexxPlanTier.PRO),
					maxImagesPerProduct: 50
				},
				defaultAddons: getSuggestedAddonsForSetup(VexxPlanTier.PRO),
				badgeText: 'Omnicanal Full',
				isFeatured: false,
				sortOrder: 30,
				isActive: true
			}
		];
	}

	static async ensureDefaultPlansSeeded(): Promise<void> {
		if (this.seededCheckDone) return;
		try {
			const coll = this.getCollection();
			const count = await coll.countDocuments();
			const defaults = this.getDefaultPlansSeed();
			if (count === 0) {
				const now = new Date();
				await coll.insertMany(
					defaults.map((p) => ({
						...p,
						createdAt: now,
						updatedAt: now
					}))
				);
			}
			const docs = await coll.find({}).toArray();
			this.customPlansCache.clear();
			for (const d of docs) {
				this.customPlansCache.set(d.code, d);
			}
			this.seededCheckDone = true;
		} catch {
			// Si masterDb no está conectado en tests unitarios en memoria, usar defaults en caché
			if (this.customPlansCache.size === 0) {
				for (const d of this.getDefaultPlansSeed()) {
					this.customPlansCache.set(d.code, d);
				}
			}
		}
	}

	static getCachedPlanOrFallback(code?: string): ISubscriptionPlan | undefined {
		if (!code) return undefined;
		const clean = code.trim().toLowerCase();
		return this.customPlansCache.get(clean) || this.getDefaultPlansSeed().find((p) => p.code === clean);
	}

	static async listAllPlans(includeInactive = true): Promise<ISubscriptionPlan[]> {
		await this.ensureDefaultPlansSeeded();
		try {
			const coll = this.getCollection();
			const filter = includeInactive ? {} : { isActive: true };
			const docs = await coll.find(filter).sort({ sortOrder: 1, monthlyPriceARS: 1 }).toArray();
			return docs;
		} catch {
			const defaults = this.getDefaultPlansSeed();
			return includeInactive ? defaults : defaults.filter((p) => p.isActive);
		}
	}

	static async getPlanByCode(code: string): Promise<ISubscriptionPlan> {
		await this.ensureDefaultPlansSeeded();
		const cleanCode = (code || '').trim().toLowerCase();
		const coll = this.getCollection();
		const doc = await coll.findOne({ code: cleanCode });
		if (!doc) {
			throw new AppError('Plan not found', `El plan '${cleanCode}' no existe en master_db.subscription_plans.`, 404);
		}
		return doc;
	}

	static async createPlan(rawBody: unknown): Promise<ISubscriptionPlan> {
		await this.ensureDefaultPlansSeeded();
		const parsed = UpsertSubscriptionPlanZodSchema.parse(rawBody);
		const validatedDefaultAddons =
			parsed.defaultAddons.length > 0
				? validateActiveAddonsForTenant(parsed.defaultAddons)
				: getSuggestedAddonsForSetup(parsed.baseTier);

		const coll = this.getCollection();
		const existing = await coll.findOne({ code: parsed.code });
		if (existing) {
			throw new AppError('Plan conflict', `Ya existe un plan con el código '${parsed.code}'.`, 409);
		}

		const now = new Date();
		const newDoc: ISubscriptionPlan = {
			...parsed,
			defaultAddons: validatedDefaultAddons,
			createdAt: now,
			updatedAt: now
		};

		await coll.insertOne(newDoc as any);
		this.customPlansCache.set(newDoc.code, newDoc);
		return newDoc;
	}

	static async updatePlan(code: string, rawBody: unknown): Promise<ISubscriptionPlan> {
		await this.ensureDefaultPlansSeeded();
		const cleanCode = (code || '').trim().toLowerCase();
		if (!PLAN_CODE_REGEX.test(cleanCode)) {
			throw new AppError('Invalid plan code', `El código de plan '${code}' no es válido.`, 400);
		}

		const parsed = UpdateSubscriptionPlanZodSchema.parse(rawBody);
		const updatePayload: Record<string, unknown> = {
			...parsed,
			updatedAt: new Date()
		};

		if (parsed.defaultAddons !== undefined) {
			updatePayload.defaultAddons = normalizeActiveAddons(validateActiveAddonsForTenant(parsed.defaultAddons));
		}

		const coll = this.getCollection();
		const updated = await coll.findOneAndUpdate(
			{ code: cleanCode },
			{ $set: updatePayload },
			{ returnDocument: 'after' }
		);

		if (!updated) {
			throw new AppError('Plan not found', `El plan '${cleanCode}' no existe en master_db.subscription_plans.`, 404);
		}

		this.customPlansCache.set(cleanCode, updated);
		return updated;
	}

	static async deletePlan(code: string): Promise<{ deletedCode: string }> {
		await this.ensureDefaultPlansSeeded();
		const cleanCode = (code || '').trim().toLowerCase();

		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenantsUsingPlan = await TenantModel.countDocuments({
			planTier: cleanCode as any,
			isActive: true
		});

		if (tenantsUsingPlan > 0) {
			throw new AppError(
				'Plan in use',
				`No se puede eliminar el plan '${cleanCode}' porque hay ${tenantsUsingPlan} comercio(s) activos usándolo. Migralos a otro plan o desactivalo con isActive: false.`,
				409
			);
		}

		const coll = this.getCollection();
		const deleted = await coll.findOneAndDelete({ code: cleanCode });
		if (!deleted) {
			throw new AppError('Plan not found', `El plan '${cleanCode}' no existe.`, 404);
		}

		this.customPlansCache.delete(cleanCode);
		return { deletedCode: cleanCode };
	}
}
