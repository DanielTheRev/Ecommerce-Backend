import 'dotenv/config';
import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection } from '@/config/modelRegistry';
import { ITenant } from '@/interfaces/tenant.interface';
import { Role } from '@/interfaces/user.interface';

async function migrateOwnersToMaster() {
	console.log('🚀 Iniciando migración de Dueños (Role.admin -> master_db.store_owners)...\n');

	await connectionManager.connect();
	const masterDb = connectionManager.getMasterDb();
	const TenantModel = masterDb.model<ITenant>('Tenant');
	const StoreOwnerModel = connectionManager.getStoreOwnerModel();

	const tenants = await TenantModel.find().lean();
	console.log(`📦 Comercios encontrados: ${tenants.length}\n`);

	let totalMigrated = 0;
	let totalAlreadyPresent = 0;
	let totalRemovedFromTenant = 0;

	for (const tenant of tenants) {
		const tenantDb = connectionManager.getTenantDb(tenant.dbName);
		const models = getModelsForConnection(tenantDb);

		const legacyAdmins = await models.User.find({ role: Role.admin })
			.select('+password +resetPasswordTokenHash +resetPasswordExpiresAt')
			.lean();

		if (legacyAdmins.length === 0) {
			const existingOwner = await StoreOwnerModel.findOne({ tenantId: tenant._id }).lean();
			console.log(
				`• [${tenant.slug}] Sin Role.admin en tenant DB (${existingOwner ? 'StoreOwner ya OK en master_db' : '⚠️ sin StoreOwner'})`
			);
			continue;
		}

		for (const admin of legacyAdmins as any[]) {
			const cleanEmail = String(admin.email || '').trim().toLowerCase();
			if (!cleanEmail) continue;

			const existing = await StoreOwnerModel.findOne({
				tenantId: tenant._id,
				email: cleanEmail
			});

			if (!existing) {
				if (!admin.password) {
					console.warn(`⚠️ [${tenant.slug}] Usuario ${cleanEmail} no tiene password hash; se omite.`);
					continue;
				}
				await StoreOwnerModel.create({
					tenantId: tenant._id,
					name: admin.name || tenant.name,
					lastName: admin.lastName,
					email: cleanEmail,
					phone: admin.phone,
					dni: admin.dni,
					profilePhoto: admin.profilePhoto,
					password: admin.password,
					isActive: admin.isActive !== false,
					isEmailVerified: admin.isEmailVerified !== false,
					tokenVersion: admin.tokenVersion ?? 0,
					resetPasswordTokenHash: admin.resetPasswordTokenHash,
					resetPasswordExpiresAt: admin.resetPasswordExpiresAt,
					lastLoginAt: admin.lastLoginAt
				});
				totalMigrated++;
				console.log(`✅ [${tenant.slug}] Migrado a StoreOwner: ${cleanEmail}`);
			} else {
				totalAlreadyPresent++;
				console.log(`ℹ️ [${tenant.slug}] StoreOwner ya existía en master_db: ${cleanEmail}`);
			}

			await models.User.deleteOne({ _id: admin._id });
			totalRemovedFromTenant++;
			console.log(`🧹 [${tenant.slug}] Eliminado registro legacy Role.admin de ${tenant.dbName}.users`);
		}
	}

	console.log('\n🏁 Migración finalizada:');
	console.log(`   - StoreOwners creados: ${totalMigrated}`);
	console.log(`   - StoreOwners ya existentes: ${totalAlreadyPresent}`);
	console.log(`   - Registros legacy eliminados de tenant.users: ${totalRemovedFromTenant}`);

	process.exit(0);
}

migrateOwnersToMaster().catch((err) => {
	console.error('❌ Error en migración:', err);
	process.exit(1);
});
