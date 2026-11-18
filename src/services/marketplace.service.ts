import { Types } from 'mongoose';
import { z } from 'zod';
import { connectionManager } from '@/config/multitenancy';
import { AppError } from '@/errors/app.error';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { ITenant } from '@/interfaces/tenant.interface';
import { getAddonModule, getTenantAddonStoreItems, normalizeActiveAddons } from '@/addons/registry';
import { StorefrontTemplateService } from './storefrontTemplate.service';
import { SubscriptionPlanService } from './subscriptionPlan.service';

export type PurchaseKind = 'addon' | 'template';
export type PurchaseStatus = 'pending' | 'approved' | 'rejected';

export interface IPurchaseRequest {
	_id?: Types.ObjectId;
	tenantId: string;
	tenantSlug: string;
	tenantName: string;
	kind: PurchaseKind;
	itemId: string;
	itemName: string;
	priceARS: number;
	billingCycle: 'monthly' | 'one_time' | 'quote';
	status: PurchaseStatus;
	resolutionNote?: string;
	createdAt: Date;
	resolvedAt?: Date;
}

export const CreatePurchaseRequestSchema = z.object({
	kind: z.enum(['addon', 'template']),
	itemId: z.string().trim().min(1, 'itemId es obligatorio.')
});

export const ResolvePurchaseRequestSchema = z.object({
	action: z.enum(['approve', 'reject']),
	note: z.string().trim().max(300).optional()
});

export class MarketplaceService {
	private static getCollection() {
		return connectionManager.getMasterDb().collection<IPurchaseRequest>('purchase_requests');
	}

	private static resolveBaseTier(tenant: ITenant): VexxPlanTier {
		const code = (tenant.planTier || '').trim().toLowerCase();
		if (Object.values(VexxPlanTier).includes(code as VexxPlanTier)) {
			return code as VexxPlanTier;
		}
		const custom = SubscriptionPlanService.getCachedPlanOrFallback(code);
		if (!custom) {
			throw new AppError('Invalid plan tier', `El plan '${tenant.planTier}' del comercio no es válido.`, 403);
		}
		return custom.baseTier;
	}

	/**
	 * Resumen unificado de la Tienda Vexx: tenencias, complementos y plantillas del comercio.
	 */
	static async getMarketplaceForTenant(
		tenant: ITenant,
		installedMap: Record<string, { isConfigured?: boolean; settings?: Record<string, unknown> }>
	) {
		const baseTier = this.resolveBaseTier(tenant);
		const activeAddonIds = new Set(normalizeActiveAddons(tenant.activeAddons || []));

		const addons = getTenantAddonStoreItems(tenant.activeAddons || [], installedMap)
			.filter((a) => a.implementationStatus === 'ready')
			.map((a) => {
				const isOwned = a.isActive;
				const isIncludedInPlan = a.includedInPlans.includes(baseTier);
				return {
					...a,
					isOwned,
					isIncludedInPlan,
					canActivateDirectly: !isOwned && isIncludedInPlan,
					canRequestPurchase: !isOwned && !isIncludedInPlan && a.isPurchasable
				};
			});

		const catalog = await StorefrontTemplateService.getCatalogForTenant(tenant);
		const templates = catalog.templates.map((t) => ({
			...t,
			canRequestPurchase: !t.isUnlocked && t.isPurchasable
		}));

		const pendingRequests = await this.listRequestsForTenant(tenant);

		return {
			summary: {
				planTier: baseTier,
				planCode: tenant.planTier,
				ownedAddonsCount: activeAddonIds.size,
				ownedTemplatesCount: templates.filter((t) => t.isUnlocked).length,
				activeTemplateKey: catalog.storefront.activeTemplateKey ?? null,
				publicUrl: catalog.storefront.primaryStorefrontUrl,
				vexxSubdomainUrl: catalog.storefront.vexxSubdomainUrl,
				customDomain: catalog.storefront.customDomain ?? null,
				pendingRequestsCount: pendingRequests.filter((r) => r.status === 'pending').length
			},
			storefront: catalog.storefront,
			addons,
			templates,
			requests: pendingRequests
		};
	}

	static async listRequestsForTenant(tenant: ITenant): Promise<IPurchaseRequest[]> {
		return this.getCollection()
			.find({ tenantId: String(tenant._id) })
			.sort({ createdAt: -1 })
			.limit(50)
			.toArray();
	}

	/**
	 * Un comercio pide un complemento o plantilla.
	 * - Si el ítem ya viene incluido en su plan: se activa directo (status 'approved').
	 * - Si es comprable: queda 'pending' hasta que el SuperAdmin lo apruebe en console.vexx.
	 */
	static async createRequest(tenant: ITenant, rawBody: unknown) {
		const parsedBody = CreatePurchaseRequestSchema.parse(rawBody);
		const kind = parsedBody.kind;
		let itemId = parsedBody.itemId;
		const baseTier = this.resolveBaseTier(tenant);
		const coll = this.getCollection();

		const existingPending = await coll.findOne({
			tenantId: String(tenant._id),
			kind,
			itemId,
			status: 'pending'
		});
		if (existingPending) {
			throw new AppError('Request already pending', 'Ya tenés una solicitud pendiente para este ítem.', 409);
		}

		let itemName: string;
		let priceARS = 0;
		let billingCycle: IPurchaseRequest['billingCycle'] = 'monthly';
		let includedInPlan = false;

		if (kind === 'addon') {
			const mod = getAddonModule(itemId);
			if (!mod) throw new AppError('Addon not found', `El complemento '${itemId}' no existe.`, 404);
			if (mod.manifest.implementationStatus === 'draft') {
				throw new AppError('Addon in draft', `'${mod.manifest.name}' todavía no está disponible.`, 400);
			}
			if (normalizeActiveAddons(tenant.activeAddons || []).includes(mod.manifest.id)) {
				throw new AppError('Already owned', `Ya tenés activo '${mod.manifest.name}'.`, 409);
			}
			includedInPlan = mod.manifest.includedInPlans.includes(baseTier);
			if (!includedInPlan && !mod.manifest.isPurchasable) {
				throw new AppError('Not purchasable', `'${mod.manifest.name}' no se puede comprar por separado.`, 403);
			}
			itemId = mod.manifest.id;
			itemName = mod.manifest.name;
			priceARS = mod.manifest.monthlyPriceARS;
		} else {
			const tpl = await StorefrontTemplateService.getTemplateByKey(itemId);
			if (!tpl.isActive) throw new AppError('Template inactive', `'${tpl.name}' no está disponible.`, 400);
			if (StorefrontTemplateService.isTemplateUnlockedForTenant(tpl, tenant)) {
				throw new AppError('Already owned', `Ya tenés desbloqueada '${tpl.name}'.`, 409);
			}
			if (!StorefrontTemplateService.isTemplateCompatibleWithBusinessType(tpl, tenant.businessType)) {
				throw new AppError('Incompatible template', `'${tpl.name}' no es compatible con tu rubro.`, 400);
			}
			itemId = tpl.key;
			itemName = tpl.name;
			if (tpl.pricingType === 'one_time_purchase') {
				billingCycle = 'one_time';
				priceARS = tpl.oneTimePriceARS ?? tpl.priceARS;
			} else if (tpl.pricingType === 'custom_quote') {
				billingCycle = 'quote';
				priceARS = tpl.priceARS;
			} else {
				priceARS = tpl.monthlyPriceARS ?? tpl.priceARS;
			}
		}

		const now = new Date();
		const doc: IPurchaseRequest = {
			tenantId: String(tenant._id),
			tenantSlug: tenant.slug,
			tenantName: tenant.name,
			kind,
			itemId,
			itemName,
			priceARS,
			billingCycle,
			status: includedInPlan ? 'approved' : 'pending',
			createdAt: now,
			...(includedInPlan ? { resolvedAt: now, resolutionNote: 'Incluido en el plan: activación automática.' } : {})
		};

		const inserted = await coll.insertOne(doc);
		if (includedInPlan) {
			await this.grantToTenant(String(tenant._id), kind, itemId);
		}

		return { ...doc, _id: inserted.insertedId };
	}

	/**
	 * Acredita el ítem al comercio (activa addon o desbloquea plantilla) e invalida cachés.
	 */
	private static async grantToTenant(tenantId: string, kind: PurchaseKind, itemId: string): Promise<void> {
		const TenantModel = connectionManager.getMasterDb().model<ITenant>('Tenant');
		const update =
			kind === 'addon'
				? { $addToSet: { activeAddons: itemId } }
				: { $addToSet: { unlockedTemplates: itemId } };
		const tenant = (await TenantModel.findByIdAndUpdate(tenantId, update, { new: true }).lean()) as ITenant | null;
		if (!tenant) throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		StorefrontTemplateService.invalidateTenantStorefrontCaches(tenant);
	}

	// ======================= SUPERADMIN (console.vexx) =======================

	static async listAllRequests(status?: PurchaseStatus): Promise<IPurchaseRequest[]> {
		const filter = status ? { status } : {};
		return this.getCollection().find(filter).sort({ createdAt: -1 }).limit(200).toArray();
	}

	static async resolveRequest(requestId: string, rawBody: unknown) {
		if (!Types.ObjectId.isValid(requestId)) {
			throw new AppError('Invalid id', 'El id de solicitud no es válido.', 400);
		}
		const { action, note } = ResolvePurchaseRequestSchema.parse(rawBody);
		const coll = this.getCollection();
		const request = await coll.findOne({ _id: new Types.ObjectId(requestId) });
		if (!request) throw new AppError('Request not found', 'Solicitud no encontrada.', 404);
		if (request.status !== 'pending') {
			throw new AppError('Request already resolved', `La solicitud ya fue ${request.status}.`, 409);
		}

		if (action === 'approve') {
			await this.grantToTenant(request.tenantId, request.kind, request.itemId);
		}

		const status: PurchaseStatus = action === 'approve' ? 'approved' : 'rejected';
		const resolvedAt = new Date();
		await coll.updateOne(
			{ _id: request._id },
			{ $set: { status, resolvedAt, ...(note ? { resolutionNote: note } : {}) } }
		);
		return { ...request, status, resolvedAt, ...(note ? { resolutionNote: note } : {}) };
	}
}
