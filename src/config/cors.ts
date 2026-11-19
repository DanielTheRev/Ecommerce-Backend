import { connectionManager } from './multitenancy';
import { ITenant } from '@/interfaces/tenant.interface';

const DEV_LOCAL_ORIGINS = [
	'http://localhost:3000',
	'http://localhost:3001',
	'http://localhost:4000',
	'http://localhost:4200',
	'http://localhost:4300',
	'http://localhost:4500',
	'http://localhost:4900',
	'http://localhost:5000',
	'http://localhost:5173'
];

function normalizeOrigin(raw?: string): string | null {
	if (!raw) return null;
	const trimmed = raw.trim().replace(/\/+$/, '');
	if (!trimmed) return null;
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

function getBaseDomain(): string {
	return (process.env.VEXX_BASE_DOMAIN || 'vexx.com.ar')
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/\/.*$/, '');
}

/**
 * Orígenes propios de la plataforma Vexx (derivados de .env, sin dominios de clientes hardcodeados).
 */
export function getPlatformOrigins(): string[] {
	const origins = new Set<string>();
	const baseDomain = getBaseDomain();

	origins.add(`https://${baseDomain}`);
	origins.add(`https://www.${baseDomain}`);
	origins.add(`https://panel.${baseDomain}`);
	origins.add(`https://www.panel.${baseDomain}`);
	origins.add(`https://console.${baseDomain}`);
	origins.add(`https://www.console.${baseDomain}`);
	origins.add('https://control-panel-50s.pages.dev');

	for (const envUrl of [process.env.PANEL_URL, process.env.CONSOLE_URL]) {
		const normalized = normalizeOrigin(envUrl);
		if (normalized) origins.add(normalized);
	}

	if (process.env.CORS_EXTRA_ORIGINS) {
		for (const item of process.env.CORS_EXTRA_ORIGINS.split(',')) {
			const normalized = normalizeOrigin(item);
			if (normalized) origins.add(normalized);
		}
	}

	if (process.env.NODE_ENV !== 'production') {
		for (const devOrigin of DEV_LOCAL_ORIGINS) {
			origins.add(devOrigin);
		}
	}

	return Array.from(origins);
}

// Cache de origins por tenant para no consultar la DB en cada request
export const tenantOriginsCache = new Map<string, string[]>();

/**
 * Carga los allowedOrigins y custom domains configurados en cada Tenant desde la base de datos maestra.
 */
export async function loadAllTenantOrigins(): Promise<void> {
	try {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenants = await TenantModel.find({ isActive: true }).lean();

		tenantOriginsCache.clear();

		for (const tenant of tenants) {
			const cleanOrigins = new Set<string>();
			if (tenant.settings?.allowedOrigins && Array.isArray(tenant.settings.allowedOrigins)) {
				for (const o of tenant.settings.allowedOrigins) {
					const normalized = normalizeOrigin(o);
					if (normalized) cleanOrigins.add(normalized);
				}
			}
			if (tenant.domain && typeof tenant.domain === 'string') {
				const bare = tenant.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
				if (bare) {
					cleanOrigins.add(`https://${bare}`);
					if (!bare.startsWith('www.')) {
						cleanOrigins.add(`https://www.${bare}`);
					}
				}
			}
			if (cleanOrigins.size > 0) {
				tenantOriginsCache.set(tenant.slug, Array.from(cleanOrigins));
			}
		}
		console.log(`🔒 CORS: ${tenantOriginsCache.size} tenants cargados`);
	} catch {
		console.error('⚠️ No se pudieron cargar origins de tenants (se cargarán después)');
	}
}

/**
 * Devuelve todos los orígenes permitidos acumulando plataforma y tenants activos.
 */
export function getAllAllowedOrigins(): string[] {
	const allOrigins = new Set<string>(getPlatformOrigins());
	for (const origins of tenantOriginsCache.values()) {
		for (const origin of origins) {
			allOrigins.add(origin);
		}
	}
	return Array.from(allOrigins);
}

/**
 * Validador estricto de origen para CORS HTTP y WebSockets.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
	// Permitir llamadas sin cabecera Origin (apps móviles React Native/Android, server-to-server, curl)
	if (!origin) return true;

	// En desarrollo permitir cualquier origen local
	if (process.env.NODE_ENV !== 'production') return true;

	const cleanOrigin = origin.trim().replace(/\/+$/, '');
	if (getAllAllowedOrigins().includes(cleanOrigin)) return true;

	// Permitir subdominios propios de la plataforma (*.vexx.com.ar o VEXX_BASE_DOMAIN)
	const baseDomain = getBaseDomain();
	try {
		const hostname = new URL(cleanOrigin).hostname.toLowerCase();
		if (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)) {
			return true;
		}
	} catch {
		return false;
	}

	return false;
}
