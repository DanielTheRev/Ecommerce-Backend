import crypto from 'crypto';
import { domainToASCII } from 'url';
import { AppError } from '@/errors/app.error';

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRICT_ASCII_REGEX = /^[\x21-\x7E]+$/;
const STRICT_DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

interface RateLimitRecord {
	count: number;
	resetAt: number;
	lockedUntil?: number;
}

export class EmailSecurityUtil {
	private static readonly rateBuckets = new Map<string, RateLimitRecord>();

	/**
	 * Normaliza y valida un correo electrónico de forma estricta:
	 * - Rechaza espacios, caracteres de control y caracteres no-ASCII en la parte local o dominio
	 *   (previene ataques homógrafos como `vúra.com.ar` vs `vura.com.ar` o Unicode invisible).
	 * - Convierte el dominio con `domainToASCII` y verifica que no contenga Punycode engañoso (`xn--`).
	 */
	static normalizeAndValidateEmail(rawEmail: unknown): string {
		if (typeof rawEmail !== 'string') {
			throw new AppError('Invalid email', 'Ingresá un correo electrónico válido.', 400);
		}

		const trimmed = rawEmail.trim();
		if (!trimmed || trimmed.length > 254 || !BASIC_EMAIL_REGEX.test(trimmed)) {
			throw new AppError('Invalid email', 'Ingresá un correo electrónico válido.', 400);
		}

		if (!STRICT_ASCII_REGEX.test(trimmed)) {
			throw new AppError(
				'Invalid email characters',
				'El correo electrónico contiene tildes o caracteres no ASCII no permitidos.',
				400
			);
		}

		const atIndex = trimmed.lastIndexOf('@');
		const localPart = trimmed.slice(0, atIndex).toLowerCase();
		const rawDomain = trimmed.slice(atIndex + 1).toLowerCase();

		if (!localPart || localPart.length > 64 || !rawDomain) {
			throw new AppError('Invalid email', 'Ingresá un correo electrónico válido.', 400);
		}

		const asciiDomain = domainToASCII(rawDomain).toLowerCase();
		if (!asciiDomain || asciiDomain.startsWith('xn--') || asciiDomain.includes('.xn--') || !STRICT_DOMAIN_REGEX.test(asciiDomain)) {
			throw new AppError(
				'Invalid email domain',
				'El dominio del correo electrónico no es válido o contiene caracteres no permitidos.',
				400
			);
		}

		return `${localPart}@${asciiDomain}`;
	}

	/**
	 * Genera un token aleatorio de un solo uso (32 bytes hex) y su hash SHA-256 para guardar en DB.
	 */
	static generateResetToken(ttlMinutes = 15): { rawToken: string; tokenHash: string; expiresAt: Date } {
		const rawToken = crypto.randomBytes(32).toString('hex');
		const tokenHash = this.hashToken(rawToken);
		const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
		return { rawToken, tokenHash, expiresAt };
	}

	static hashToken(rawToken: string): string {
		return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
	}

	/**
	 * Limita intentos por clave (ej. `otp_send:<slug>:<ip>` o `forgot:<scope>:<email>`)
	 * para evitar abuso de cuota de Resend o fuerza bruta.
	 */
	static enforceRateLimit(
		bucketKey: string,
		maxAttempts: number,
		windowMs: number,
		lockDurationMs = windowMs,
		customMessage?: string
	): void {
		const now = Date.now();
		const current = this.rateBuckets.get(bucketKey);

		if (current?.lockedUntil && now < current.lockedUntil) {
			const remainingMin = Math.max(1, Math.ceil((current.lockedUntil - now) / 60000));
			throw new AppError(
				'Too many requests',
				customMessage || `Demasiados intentos. Esperá ${remainingMin} minuto(s) antes de volver a intentar.`,
				429
			);
		}

		if (!current || now > current.resetAt) {
			this.rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
			return;
		}

		current.count += 1;
		if (current.count > maxAttempts) {
			current.lockedUntil = now + lockDurationMs;
			this.rateBuckets.set(bucketKey, current);
			const remainingMin = Math.max(1, Math.ceil(lockDurationMs / 60000));
			throw new AppError(
				'Too many requests',
				customMessage || `Demasiados intentos. Esperá ${remainingMin} minuto(s) antes de volver a intentar.`,
				429
			);
		}

		this.rateBuckets.set(bucketKey, current);
	}

	static clearRateLimit(bucketKey: string): void {
		this.rateBuckets.delete(bucketKey);
	}
}
