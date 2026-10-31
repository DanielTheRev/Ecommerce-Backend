import { connectionManager } from './multitenancy';
import { ITenant } from '@/interfaces/tenant.interface';

// Orígenes por defecto permitidos en la plataforma
export const defaultOrigins = [
	'http://localhost:3000',
	'http://localhost:3001',
	'http://localhost:4000',
	'http://localhost:4200',
	'http://localhost:4300',
	'http://localhost:4500',
	'http://localhost:4900',
	'http://localhost:5000',
	'http://localhost:5173',
	'https://vura.com.ar',
	'https://www.vura.com.ar',
	'https://dashboard.vura.com.ar',
	'https://admin.vura.com.ar',
	'https://panel.vexx.com.ar',
	'https://www.panel.vexx.com.ar',
	'https://control-panel-50s.pages.dev'
];

// Cache de origins por tenant para no consultar la DB en cada request
export const tenantOriginsCache = new Map<string, string[]>();

/**
 * Carga los allowedOrigins configurados en cada Tenant desde la base de datos maestra
 */
export async function loadAllTenantOrigins(): Promise<void> {
	try {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenants = await TenantModel.find({ isActive: true }).lean();
		for (const tenant of tenants) {
			if (tenant.settings?.allowedOrigins && Array.isArray(tenant.settings.allowedOrigins)) {
				// Normalizar quitando trailing slashes si existieran
				const cleanOrigins = tenant.settings.allowedOrigins.map(o => o.trim().replace(/\/+$/, ''));
				tenantOriginsCache.set(tenant.slug, cleanOrigins);
			}
		}
		console.log(`🔒 CORS: ${tenantOriginsCache.size} tenants cargados`);
	} catch (error) {
		console.error('⚠️ No se pudieron cargar origins de tenants (se cargarán después)');
	}
}

/**
 * Devuelve todos los orígenes permitidos acumulando defaults y tenants
 */
export function getAllAllowedOrigins(): string[] {
	const allOrigins = [...defaultOrigins];
	for (const origins of tenantOriginsCache.values()) {
		allOrigins.push(...origins);
	}
	return allOrigins;
}

/**
 * Validador estricto de origen para CORS HTTP y WebSockets
 */
export function isOriginAllowed(origin: string | undefined): boolean {
	// Permitir llamadas sin cabecera Origin (apps móviles React Native/Android, server-to-server, curl)
	if (!origin) return true;

	// En desarrollo permitir cualquier origen local
	if (process.env.NODE_ENV !== 'production') return true;

	const cleanOrigin = origin.trim().replace(/\/+$/, '');
	const allowed = getAllAllowedOrigins();
	if (allowed.includes(cleanOrigin)) return true;

	// Permitir variantes y subdominios propios de la plataforma
	if (
		cleanOrigin === 'https://vura.com.ar' ||
		cleanOrigin === 'https://www.vura.com.ar' ||
		cleanOrigin.endsWith('.vura.com.ar') ||
		cleanOrigin === 'https://vexx.com.ar' ||
		cleanOrigin === 'https://panel.vexx.com.ar' ||
		cleanOrigin === 'https://www.vexx.com.ar' ||
		cleanOrigin === 'https://www.panel.vexx.com.ar' ||
		cleanOrigin.endsWith('.vexx.com.ar')
	) {
		return true;
	}

	return false;
}
