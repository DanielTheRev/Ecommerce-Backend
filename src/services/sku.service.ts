import { TenantModels } from '@/config/modelRegistry';
import { ProductType } from '@/interfaces/product.interface';

const SEQUENCE_INCREMENT = 10;

/**
 * Servicio encargado de generar SKUs automáticos para variantes de productos.
 *
 * Formato resultante:
 *   - Clothing: {CAT}-{SEQ}-{SIZE}-{COLOR}        → BUZ-010-S-UVA
 *   - Tech:     {CAT}-{SEQ}-{ATTRS…}-{BRAND}-{COLOR} → CEL-010-128GB-SAM-NEG
 */
export class SkuService {
	private constructor() { }

	// ============ PUBLIC ============

	/**
	 * Genera SKUs para variantes que no tengan uno asignado.
	 * Todas las variantes de un mismo producto comparten el MISMO número de secuencia.
	 *
	 * @param existingSequence  Reutilizar esta secuencia (update de producto con variantes existentes).
	 */
	static async generateSkusForVariants(
		models: TenantModels,
		variants: any[],
		category: string,
		productType: ProductType,
		brand: string,
		existingSequence?: number
	): Promise<any[]> {
		if (!variants || variants.length === 0) return variants;

		// Si todas las variantes ya tienen SKU, no hacemos nada
		const needsSku = variants.some(v => !v.sku);
		if (!needsSku) return variants;

		const prefix = this.getCategoryPrefix(category);
		const sequence = existingSequence ?? await this.getNextSequence(models, category);
		const seqStr = String(sequence).padStart(3, '0');

		return variants.map(v => {
			if (v.sku) return v; // Mantener SKU existente

			const parts: string[] = [prefix, seqStr];

			if (productType === ProductType.CLOTHING) {
				// Clothing → PREFIX-SEQ-SIZE-COLOR
				if (v.size) parts.push(v.size.toUpperCase());
			} else if (productType === ProductType.TECH) {
				// Tech → PREFIX-SEQ-ATTRS…-BRAND-COLOR
				if (v.attributes && Array.isArray(v.attributes)) {
					const sorted = [...v.attributes].sort((a: any, b: any) =>
						a.key.localeCompare(b.key)
					);
					for (const attr of sorted) {
						parts.push(this.sanitizeForSku(attr.value));
					}
				}
				if (brand) parts.push(this.abbreviate(brand));
			}

			// Color (últimas 3 letras del nombre, sin acentos)
			if (v.color?.name) {
				parts.push(this.abbreviate(v.color.name));
			}

			v.sku = parts.join('-');
			return v;
		});
	}

	/**
	 * Incrementa atómicamente el contador de secuencia para una categoría
	 * y devuelve el nuevo valor.
	 */
	static async getNextSequence(models: TenantModels, category: string): Promise<number> {
		const normalizedCategory = this.normalizeText(category).toUpperCase();

		const counter = await models.SkuCounter.findOneAndUpdate(
			{ category: normalizedCategory },
			{ $inc: { lastSequence: SEQUENCE_INCREMENT } },
			{ new: true, upsert: true }
		);

		return counter!.lastSequence;
	}

	/**
	 * Extrae el número de secuencia de un SKU existente.
	 * Ej: "BUZ-010-S-UVA" → 10
	 */
	static extractSequenceFromSku(sku: string): number | null {
		if (!sku) return null;
		const parts = sku.split('-');
		if (parts.length >= 2) {
			const seq = parseInt(parts[1], 10);
			return isNaN(seq) ? null : seq;
		}
		return null;
	}

	// ============ PRIVATE HELPERS ============

	/**
	 * Obtiene el prefijo de 3 letras para una categoría.
	 * Primeras 3 letras, sin acentos, en mayúsculas.
	 */
	private static getCategoryPrefix(category: string): string {
		const normalized = this.normalizeText(category);
		return normalized.substring(0, 3).toUpperCase();
	}

	/**
	 * Abrevia un nombre a sus primeras N letras (default 3), sin acentos, en mayúsculas.
	 */
	private static abbreviate(name: string, maxLen: number = 3): string {
		const normalized = this.normalizeText(name);
		return normalized.substring(0, maxLen).toUpperCase();
	}

	/**
	 * Elimina acentos y diacríticos de un texto.
	 */
	private static normalizeText(text: string): string {
		return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	}

	/**
	 * Sanitiza un valor para uso en SKU: elimina caracteres especiales, uppercase.
	 */
	private static sanitizeForSku(value: string): string {
		return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
	}
}
