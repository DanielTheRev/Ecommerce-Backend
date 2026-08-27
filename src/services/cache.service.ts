/**
 * CacheService - Sistema de caché en memoria de ultra-alta velocidad (Sub-millisecond).
 * 
 * Diseñado para multi-tenant con invalidación reactiva instantánea (Purge on Mutation).
 * Permite que las lecturas públicas de la tienda (Config, Hero, Bento, Banners, Home)
 * se sirvan en ~1ms desde la memoria RAM, e invalida en 0ms cuando el admin edita en el panel.
 */
interface CacheEntry<T = any> {
	value: T;
	expiresAt: number;
}

export class CacheService {
	private static cache = new Map<string, CacheEntry>();
	private static defaultTtlMs = 10 * 60 * 1000; // 10 minutos por defecto

	/**
	 * Construye la clave única con prefijo de tenant
	 */
	private static buildKey(tenantSlug: string, key: string): string {
		return `${(tenantSlug || 'global').trim().toLowerCase()}:${key.trim().toLowerCase()}`;
	}

	/**
	 * Obtiene un valor del caché si existe y no expiró
	 */
	static get<T = any>(tenantSlug: string, key: string): T | null {
		const fullKey = this.buildKey(tenantSlug, key);
		const entry = this.cache.get(fullKey);

		if (!entry) return null;

		// Si ya expiró, lo eliminamos
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(fullKey);
			return null;
		}

		return entry.value as T;
	}

	/**
	 * Guarda un valor en el caché con TTL
	 */
	static set<T = any>(tenantSlug: string, key: string, value: T, ttlMs?: number): void {
		const fullKey = this.buildKey(tenantSlug, key);
		const duration = ttlMs ?? this.defaultTtlMs;
		this.cache.set(fullKey, {
			value,
			expiresAt: Date.now() + duration
		});
	}

	/**
	 * Invalida una clave exacta o todas las claves de un tenant
	 */
	static invalidate(tenantSlug: string, key?: string): void {
		const cleanSlug = (tenantSlug || 'global').trim().toLowerCase();

		if (key) {
			const fullKey = this.buildKey(tenantSlug, key);
			this.cache.delete(fullKey);
		} else {
			// Invalida todo el tenant
			const prefix = `${cleanSlug}:`;
			for (const k of this.cache.keys()) {
				if (k.startsWith(prefix)) {
					this.cache.delete(k);
				}
			}
		}
	}

	/**
	 * Invalida todas las claves que comiencen con un prefijo dentro de un tenant
	 * Ej: invalidatePrefix('vura', 'hero') o invalidatePrefix('vura', 'home')
	 */
	static invalidatePrefix(tenantSlug: string, prefix: string): void {
		const cleanSlug = (tenantSlug || 'global').trim().toLowerCase();
		const cleanPrefix = `${cleanSlug}:${prefix.trim().toLowerCase()}`;

		for (const k of this.cache.keys()) {
			if (k.startsWith(cleanPrefix)) {
				this.cache.delete(k);
			}
		}
	}

	/**
	 * Limpia todas las entradas expiradas (recolector periódico)
	 */
	static purgeExpired(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Vacía todo el caché del servidor
	 */
	static clearAll(): void {
		this.cache.clear();
	}
}

// Ejecutar recolección de expirados cada 5 minutos
setInterval(() => {
	CacheService.purgeExpired();
}, 5 * 60 * 1000).unref();
