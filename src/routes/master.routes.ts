import { Router } from 'express';
import { MasterTenantController } from '@/controllers/masterTenant.controller';
import { AddonController } from '@/controllers/addon.controller';
import { VerticalPresetController } from '@/controllers/verticalPreset.controller';
import { StorefrontTemplateController } from '@/controllers/storefrontTemplate.controller';
import { SubscriptionPlanController } from '@/controllers/subscriptionPlan.controller';
import { MarketplaceService, PurchaseStatus } from '@/services/marketplace.service';
import { requireSuperAdmin } from '@/middleware/masterAuth.middleware';

const router: Router = Router();

// ============================================================================
// 1. AUTENTICACIÓN MASTER / ROOT (SuperAdmin de la Plataforma Vexx)
// ============================================================================
router.post('/auth/login', MasterTenantController.login);
router.get('/auth/me', requireSuperAdmin, MasterTenantController.getMe);
router.get('/addons', requireSuperAdmin, AddonController.getMasterCatalog);
router.get('/onboarding-config', requireSuperAdmin, AddonController.getMasterOnboardingConfig);

// ============================================================================
// 1.4 CATÁLOGO MAESTRO DE PLANES DE SUSCRIPCIÓN (master_db.subscription_plans)
// ============================================================================
router.get('/plans', requireSuperAdmin, SubscriptionPlanController.getAll.bind(SubscriptionPlanController));
router.get('/plans/:code', requireSuperAdmin, SubscriptionPlanController.getByCode.bind(SubscriptionPlanController));
router.post('/plans', requireSuperAdmin, SubscriptionPlanController.create.bind(SubscriptionPlanController));
router.put('/plans/:code', requireSuperAdmin, SubscriptionPlanController.updateByCode.bind(SubscriptionPlanController));
router.delete('/plans/:code', requireSuperAdmin, SubscriptionPlanController.deleteByCode.bind(SubscriptionPlanController));

// ============================================================================
// 1.5 PRESETS GLOBALES DE RUBROS (master_db.vertical_presets)
// ============================================================================
router.get('/vertical-presets', requireSuperAdmin, VerticalPresetController.getAll.bind(VerticalPresetController));
router.put('/vertical-presets/:key', requireSuperAdmin, VerticalPresetController.updateByKey.bind(VerticalPresetController));
router.post('/vertical-presets', requireSuperAdmin, VerticalPresetController.create.bind(VerticalPresetController));
router.delete('/vertical-presets/:key', requireSuperAdmin, VerticalPresetController.deleteByKey.bind(VerticalPresetController));

// ============================================================================
// 1.6 CATÁLOGO MAESTRO DE PLANTILLAS DE TIENDA (master_db.storefront_templates)
// ============================================================================
router.get('/storefront-templates', requireSuperAdmin, StorefrontTemplateController.getAll.bind(StorefrontTemplateController));
router.get('/storefront-templates/:key', requireSuperAdmin, StorefrontTemplateController.getByKey.bind(StorefrontTemplateController));
router.post('/storefront-templates', requireSuperAdmin, StorefrontTemplateController.create.bind(StorefrontTemplateController));
router.put('/storefront-templates/:key', requireSuperAdmin, StorefrontTemplateController.updateByKey.bind(StorefrontTemplateController));
router.delete('/storefront-templates/:key', requireSuperAdmin, StorefrontTemplateController.deleteByKey.bind(StorefrontTemplateController));

// ============================================================================
// 1.7 SOLICITUDES DE COMPRA DE COMPLEMENTOS / PLANTILLAS (master_db.purchase_requests)
// ============================================================================
router.get('/purchase-requests', requireSuperAdmin, async (req, res, next) => {
	try {
		const raw = String(req.query.status || '');
		const status = ['pending', 'approved', 'rejected'].includes(raw) ? (raw as PurchaseStatus) : undefined;
		const data = await MarketplaceService.listAllRequests(status);
		res.status(200).json({ success: true, count: data.length, data });
	} catch (error) {
		next(error);
	}
});
router.patch('/purchase-requests/:id', requireSuperAdmin, async (req, res, next) => {
	try {
		const data = await MarketplaceService.resolveRequest(req.params.id, req.body);
		res.status(200).json({ success: true, message: `Solicitud ${data.status}.`, data });
	} catch (error) {
		next(error);
	}
});

// ============================================================================
// 2. GESTIÓN INTEGRAL DE COMERCIOS (CRUD SuperAdmin / Root)
// ============================================================================
router.get('/tenants', requireSuperAdmin, MasterTenantController.getTenants);
router.get('/tenants/health-summary', requireSuperAdmin, MasterTenantController.getTenantsHealthSummary);
router.get('/tenants/:id', requireSuperAdmin, MasterTenantController.getTenantById);
router.get('/tenants/:id/health', requireSuperAdmin, MasterTenantController.getTenantHealth);
router.get('/tenants/:id/bootstrap-preview', requireSuperAdmin, MasterTenantController.getTenantBootstrapPreview);
router.post('/tenants/:id/repair-bootstrap', requireSuperAdmin, MasterTenantController.repairTenantBootstrap);
router.post('/tenants', requireSuperAdmin, MasterTenantController.createTenant);
router.put('/tenants/:id', requireSuperAdmin, MasterTenantController.updateTenant);
router.delete('/tenants/:id', requireSuperAdmin, MasterTenantController.deleteTenant);

// Modificadores de estado y capacidades (Ventas, Upgrades y Soporte)
router.patch('/tenants/:id/status', requireSuperAdmin, MasterTenantController.toggleStatus);
router.patch('/tenants/:id/subscription', requireSuperAdmin, MasterTenantController.updateSubscription);
router.patch('/tenants/:id/plan', requireSuperAdmin, MasterTenantController.updatePlan);
router.patch('/tenants/:id/business-type', requireSuperAdmin, MasterTenantController.updateBusinessType);
router.post('/tenants/:id/reset-password', requireSuperAdmin, MasterTenantController.resetOwnerPassword);
router.get('/tenants/:id/addons/:addonId/settings', requireSuperAdmin, AddonController.getMasterTenantAddonSettings);
router.put('/tenants/:id/addons/:addonId/settings', requireSuperAdmin, AddonController.updateMasterTenantAddonSettings);
router.patch('/tenants/:id/storefront', requireSuperAdmin, StorefrontTemplateController.updateTenantStorefront.bind(StorefrontTemplateController));
router.patch('/tenants/:id/template', requireSuperAdmin, StorefrontTemplateController.updateTenantStorefront.bind(StorefrontTemplateController));

export default router;
