/**
 * Escapa caracteres especiales de expresiones regulares para prevenir
 * ataques de denegación de servicio por expresiones regulares (ReDoS)
 * e inyecciones en consultas de MongoDB ($regex / new RegExp).
 */
export function escapeRegex(str: string): string {
	if (!str || typeof str !== 'string') return '';
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
