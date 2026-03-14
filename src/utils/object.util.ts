/**
 * Convierte un objeto anidado en uno plano con notación de puntos (dot notation).
 * Útil para actualizaciones parciales en MongoDB con $set.
 * Ejemplo: { a: { b: 1 } } -> { "a.b": 1 }
 * Note: Los arreglos no se aplanan para permitir la sobrescritura completa del array.
 */
export const flattenObject = (obj: any, prefix = ''): any => {
	return Object.keys(obj).reduce((acc: any, k: any) => {
		const pre = prefix.length ? prefix + '.' : '';
		if (
			typeof obj[k] === 'object' &&
			obj[k] !== null &&
			!Array.isArray(obj[k]) &&
			Object.keys(obj[k]).length > 0
		) {
			Object.assign(acc, flattenObject(obj[k], pre + k));
		} else {
			acc[pre + k] = obj[k];
		}
		return acc;
	}, {});
};
