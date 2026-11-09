/**
 * ============================================================================
 * UTILIDAD ADMINISTRATIVA DE MIGRACIÓN DE PLANES - VEXX
 * Directorio: src/scripts/migrateTenantPlan.ts
 * ============================================================================
 * 
 * Uso:
 *   Listar comercios y su estado de plan:
 *     pnpm exec ts-node -r tsconfig-paths/register src/scripts/migrateTenantPlan.ts --list
 * 
 *   Asignar plan oficial a un comercio:
 *     pnpm exec ts-node -r tsconfig-paths/register src/scripts/migrateTenantPlan.ts --slug leo-mariaangelica --tier local
 * ============================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectionManager } from '../config/multitenancy';
import { VexxPlanTier } from '../interfaces/plan.interface';

async function main() {
	const args = process.argv.slice(2);
	const listMode = args.includes('--list') || args.length === 0;
	const slugIndex = args.indexOf('--slug');
	const tierIndex = args.indexOf('--tier');

	console.log('🔌 Conectando a la base de datos central...');
	await connectionManager.connect();
	const masterDb = connectionManager.getMasterDb();
	const TenantModel = masterDb.model('Tenant');

	if (listMode && slugIndex === -1) {
		console.log('\n📋 LISTADO DE COMERCIOS REGISTRADOS:');
		console.log('─'.repeat(80));
		const tenants = await TenantModel.find().lean();
		for (const t of tenants as any[]) {
			const status = t.planTier ? `✅ ${t.planTier.toUpperCase()}` : `❌ LEGACY (${t.plan || 'sin plan'})`;
			console.log(`• [${t.slug}] "${t.name}" | Rubro: ${t.businessType || 'SIN RUBRO'} | PlanTier: ${status}`);
		}
		console.log('─'.repeat(80));
		console.log(`Total: ${tenants.length} comercios.\n`);
		process.exit(0);
	}

	if (slugIndex === -1 || tierIndex === -1) {
		console.error('❌ Parámetros inválidos. Usa: --slug <slug> --tier <local|point|pro>');
		process.exit(1);
	}

	const targetSlug = args[slugIndex + 1]?.trim().toLowerCase();
	const targetTier = args[tierIndex + 1]?.trim().toLowerCase() as VexxPlanTier;

	if (!Object.values(VexxPlanTier).includes(targetTier)) {
		console.error(`❌ Plan inválido: '${targetTier}'. Valores permitidos: ${Object.values(VexxPlanTier).join(', ')}`);
		process.exit(1);
	}

	const tenant = await TenantModel.findOne({ slug: targetSlug });
	if (!tenant) {
		console.error(`❌ No se encontró ningún comercio con slug '${targetSlug}'.`);
		process.exit(1);
	}

	const previousPlan = (tenant as any).planTier || (tenant as any).plan || 'ninguno';
	(tenant as any).planTier = targetTier;
	await tenant.save();

	console.log(`\n🎉 COMERCIO ACTUALIZADO EXITOSAMENTE:`);
	console.log(`   Slug:      ${tenant.slug}`);
	console.log(`   Nombre:    ${tenant.name}`);
	console.log(`   Rubro:     ${tenant.businessType}`);
	console.log(`   Plan Ant.: ${previousPlan}`);
	console.log(`   Plan Nvo.: ${targetTier.toUpperCase()} (${(tenant as any).planTier})`);
	console.log(`\nAhora este comercio puede iniciar sesión bajo las reglas del plan ${targetTier.toUpperCase()}.\n`);

	process.exit(0);
}

main().catch((err) => {
	console.error('❌ Error en script de migración:', err);
	process.exit(1);
});
