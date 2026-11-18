/**
 * ============================================================================
 * ARQUITECTURA DE CLASES DE DOMINIO: PRODUCTO X PLAN X RUBRO - VEXX
 * Directorio: src/domain/product/product.classes.ts
 * ============================================================================
 * 
 * Filosofía del Diseño:
 *   1. Herencia por Planes (La Escalera de Límites):
 *        LocalProduct -> PointProduct -> ProProduct
 *      Cada clase hereda de la anterior y agrega solo las propiedades y métodos
 *      que su nivel de suscripción le permite operar.
 * 
 *   2. Modularidad por Rubros (Composición sin explosión de clases):
 *      Los submódulos específicos de cada rubro (pesables en carnicería, talles
 *      en ropa, especificaciones en tecnología) se manejan como extensiones
 *      validadas dentro de los métodos de cada clase.
 * 
 *   3. Impenetrabilidad de Datos:
 *      Es imposible que un producto en Plan Local guarde datos de SEO o métricas
 *      en MongoDB, porque la clase LocalProduct físicamente carece de esos campos
 *      y métodos.
 * ============================================================================
 */

import {
	ClothingGender,
	ClothingSizeType,
	ICombineWithItem,
	ImageAspectRatio,
	IProductFinance,
	IProductImage,
	IProductPrices,
	IProductSeo,
	IProductSpec,
	ISizeGuide,
	ProductStatus,
	WeighableUnit
} from '@/interfaces/product.interface';
import { IVariant } from '@/interfaces/variant.interface';

// ============================================================================
// 1. TIPOS DE SOPORTE Y LÍMITES POR PLAN
// ============================================================================

/** Límites máximos de imágenes por producto según nivel de suscripción */
export const LOCAL_MAX_IMAGES = 20;
export const POINT_MAX_IMAGES = 50;
export const PRO_MAX_IMAGES = 100;

/** Lista exhaustiva de unidades de pesaje / fraccionamiento permitidas */
export const ALLOWED_WEIGHABLE_UNITS: readonly WeighableUnit[] = [
	'kg',
	'g',
	'docena',
	'un',
	'l',
	'ml'
] as const;

export interface IProductDescriptions {
	subtitle?: string;
	shortDescription?: string;
	largeDescription?: string;
}

export interface IWeighableExtensionProps {
	isSoldByWeight?: boolean;
	unit?: WeighableUnit;
	weight?: string;
}

export interface IApparelExtensionProps {
	gender?: ClothingGender;
	fit?: string;
	material?: string;
	composition?: { material: string; percentage: number }[];
	sizeType?: ClothingSizeType;
	sizeGuide?: ISizeGuide;
	careInstructions?: string[];
	season?: string;
}

// Props necesarias para instanciar un LocalProduct
export interface ILocalProductProps extends IWeighableExtensionProps {
	name?: string;
	brand?: string;
	model?: string;
	category: string;
	barcode?: string;
	netStock?: number;
	lowStockThreshold?: number;
	price: IProductPrices;
	finance: IProductFinance;
	/** Estado obligatorio: el cliente/front debe indicar explícitamente si es 'published', 'draft', etc. */
	status: ProductStatus;
	linkProductProvider?: string;
	/** Matriz de Variantes física (Talles, Colores, Capacidad, Sabores). Opcional. */
	variants?: IVariant[];
	/** Etiquetas de búsqueda rápida en mostrador / POS (ej. 'sin-tacc', 'oferta', 'invierno'). Opcional. */
	tags?: string[];
	/** Ficha técnica clave-valor (ej. 'Garantía': '12 meses', 'Presión': 'PN20'). Opcional. */
	specifications?: IProductSpec[];
	/** Fotos del producto para mostrador / POS / tablet (máx 20 en Plan Local). Opcional. */
	images?: IProductImage[];
}

// Props necesarias para instanciar un PointProduct (hereda Local y suma catálogo)
export interface IPointProductProps extends ILocalProductProps {
	descriptions?: IProductDescriptions;
	shortDescription?: string;
	largeDescription?: string;
	subtitle?: string;
	isFeatured?: boolean;
}

// Props necesarias para instanciar un ProProduct (hereda Point y suma e-commerce full)
export interface IProProductProps extends IPointProductProps {
	seo?: IProductSeo;
	combineWith?: ICombineWithItem[];
	apparel?: IApparelExtensionProps;
}

// ============================================================================
// 2. CLASE CAPA 1: PRODUCTO LOCAL (Común a Kiosco, Carnicería, Moda, etc.)
// ============================================================================
/**
 * Representa un artículo que se comercializa exclusivamente en local físico.
 * Enfocado en mostrador, lector láser, balanza, caja ciega y facturación ARCA.
 * Soporta tanto stock simple directo como matriz física de variantes (talles/colores).
 */
export class LocalProduct {
	public name: string;
	public brand?: string;
	public model?: string;
	public category: string;
	public barcode?: string;
	public netStock: number;
	public lowStockThreshold: number;
	public price: IProductPrices;
	public finance: IProductFinance;
	public status: ProductStatus;
	public linkProductProvider?: string;

	// Matriz de Variantes de Mostrador Físico (undefined si es producto simple sin variantes):
	public variants?: IVariant[];

	// Etiquetas de búsqueda rápida en mostrador / POS (undefined si no tiene):
	public tags?: string[];

	// Ficha técnica clave-valor (undefined si no tiene):
	public specifications?: IProductSpec[];

	// Fotos de identificación táctil para caja / mostrador (máximo 20 en Plan Local):
	public images?: IProductImage[];

	// Extensión pesables / balanza:
	public isSoldByWeight?: boolean;
	public unit?: WeighableUnit;
	public weight?: string;

	constructor(data: ILocalProductProps) {
		const rawName = data.name?.trim();
		const fallbackName = [data.brand, data.model].filter(Boolean).join(' ').trim();
		this.name = rawName || fallbackName || '';

		if (!this.name) {
			throw new Error('El producto debe tener un nombre comercial o una combinación válida de marca y modelo.');
		}

		if (data.brand && data.brand.trim()) {
			this.brand = data.brand.trim();
		}
		if (data.model && data.model.trim()) {
			this.model = data.model.trim();
		}
		this.category = data.category;
		this.barcode = data.barcode?.trim();
		this.lowStockThreshold = data.lowStockThreshold ?? 3;
		this.price = data.price;
		this.finance = data.finance;

		// Validación estricta de status: CERO fallbacks silenciosos
		if (!data.status) {
			throw new Error('El estado del producto (status: "published" | "draft" | "paused" | "archived") es obligatorio. Debe ser enviado explícitamente desde el cliente.');
		}
		this.status = data.status;

		this.linkProductProvider = data.linkProductProvider;

		// Si tiene matriz de variantes física (ropa/calzado/presentaciones), netStock se calcula sumando variantes.
		// Si NO tiene variantes, se deja en undefined para no ensuciar MongoDB con arrays vacíos [].
		if (data.variants && data.variants.length > 0) {
			this.variants = data.variants;
			this.netStock = this.recalculateNetStockFromVariants();
		} else {
			this.variants = undefined;
			this.netStock = Math.max(0, data.netStock ?? 0);
		}

		// Tags para POS / mostrador (limpios y normalizados en minúsculas)
		if (data.tags && data.tags.length > 0) {
			this.tags = data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
		}

		// Especificaciones técnicas clave-valor
		if (data.specifications && data.specifications.length > 0) {
			this.specifications = data.specifications.map((s) => {
				const key = s.key?.trim();
				const value = s.value?.trim();
				if (!key || !value) {
					throw new Error('Cada especificación técnica debe tener clave (key) y valor (value) obligatorios y no vacíos.');
				}
				return { key, value };
			});
		}

		// Imágenes de mostrador / POS (en Plan Local: máx 20 fotos)
		if (data.images && data.images.length > 0) {
			if (data.images.length > LOCAL_MAX_IMAGES) {
				throw new Error(
					`El Plan Local permite un máximo de ${LOCAL_MAX_IMAGES} imágenes por producto. Se recibieron ${data.images.length}.`
				);
			}
			this.images = [...data.images];
		}

		if (data.isSoldByWeight) {
			if (!data.unit) {
				throw new Error(`Si el producto se vende por peso/balanza (isSoldByWeight: true), la unidad de medida (unit) es obligatoria y debe ser elegida por el comerciante. Opciones válidas: ${ALLOWED_WEIGHABLE_UNITS.join(', ')}`);
			}
			if (!ALLOWED_WEIGHABLE_UNITS.includes(data.unit)) {
				throw new Error(`Unidad de medida inválida "${data.unit}". Unidades permitidas: ${ALLOWED_WEIGHABLE_UNITS.join(', ')}`);
			}
			this.isSoldByWeight = true;
			this.unit = data.unit;
			this.weight = data.weight;
		}
	}

	// --- Métodos de Negocio de Inventario y Mostrador ---

	/** Recalcula el stock neto total a partir de la matriz de variantes (si existen) */
	public recalculateNetStockFromVariants(): number {
		if (!this.variants || this.variants.length === 0) {
			return this.netStock;
		}
		this.netStock = this.variants.reduce((acc, v) => acc + Math.max(0, v.stock || 0), 0);
		return this.netStock;
	}

	/** Agrega o actualiza una variante física de talle/color/medida */
	public addVariant(variant: IVariant): void {
		if (!this.variants) {
			this.variants = [];
		}
		const index = this.variants.findIndex((v) => v.sku === variant.sku);
		if (index >= 0) {
			this.variants[index] = variant;
		} else {
			this.variants.push(variant);
		}
		this.recalculateNetStockFromVariants();
	}

	/** Ajusta el stock neto directo (solo para productos simples sin variantes) */
	public adjustNetStock(delta: number): number {
		if (this.variants && this.variants.length > 0) {
			throw new Error('No se puede ajustar netStock directamente en productos con variantes. Ajuste el stock de la variante correspondiente.');
		}
		this.netStock = Math.max(0, this.netStock + delta);
		return this.netStock;
	}

	/** Agrega una imagen para la grilla del POS / mostrador (máximo 20 en Plan Local) */
	public addImage(image: IProductImage): void {
		if (!image || !image.url || !image.url.trim()) {
			throw new Error('La imagen debe tener una URL válida no vacía.');
		}
		if (!this.images) {
			this.images = [];
		}
		if (this.images.length >= LOCAL_MAX_IMAGES) {
			throw new Error(
				`El Plan Local permite un máximo de ${LOCAL_MAX_IMAGES} imágenes por producto. Actualice a Plan Point para ampliar la galería hasta ${POINT_MAX_IMAGES} imágenes.`
			);
		}
		this.images.push(image);
	}

	/** Agrega una etiqueta para búsqueda rápida en caja o filtros */
	public addTag(tag: string): void {
		const clean = tag.trim().toLowerCase();
		if (!clean) return;
		if (!this.tags) {
			this.tags = [];
		}
		if (!this.tags.includes(clean)) {
			this.tags.push(clean);
		}
	}

	/** Agrega o actualiza una especificación técnica clave-valor (ambos obligatorios) */
	public addSpecification(key: string, value: string): void {
		const cleanKey = key.trim();
		const cleanValue = value.trim();
		if (!cleanKey || !cleanValue) {
			throw new Error('La especificación técnica requiere clave (key) y valor (value) obligatorios y no vacíos.');
		}
		if (!this.specifications) {
			this.specifications = [];
		}
		const index = this.specifications.findIndex((s) => s.key.toLowerCase() === cleanKey.toLowerCase());
		if (index >= 0) {
			this.specifications[index].value = cleanValue;
		} else {
			this.specifications.push({ key: cleanKey, value: cleanValue });
		}
	}

	/** Comprueba si el producto está en alerta de stock bajo */
	public isLowStock(): boolean {
		return this.netStock <= this.lowStockThreshold;
	}

	/** Asigna o actualiza el código de barras para la pistola láser */
	public setBarcode(barcode: string): void {
		this.barcode = barcode.trim();
	}

	/** Configura venta fraccionada por peso (balanza digital) */
	public setWeighable(unit: WeighableUnit): void {
		if (!ALLOWED_WEIGHABLE_UNITS.includes(unit)) {
			throw new Error(`Unidad de medida inválida "${unit}". Unidades permitidas: ${ALLOWED_WEIGHABLE_UNITS.join(', ')}`);
		}
		this.isSoldByWeight = true;
		this.unit = unit;
	}

	/** Convierte la entidad a un objeto limpio listo para MongoDB (cero campos basura ni arrays vacíos) */
	public toDatabaseObject(): Record<string, any> {
		const doc: Record<string, any> = {
			name: this.name,
			category: this.category,
			price: this.price,
			finance: this.finance,
			netStock: this.netStock,
			lowStockThreshold: this.lowStockThreshold,
			status: this.status
		};

		if (this.brand) doc.brand = this.brand;
		if (this.model) doc.model = this.model;
		if (this.barcode) doc.barcode = this.barcode;
		if (this.linkProductProvider) doc.linkProductProvider = this.linkProductProvider;
		if (this.variants && this.variants.length > 0) doc.variants = this.variants;
		if (this.tags && this.tags.length > 0) doc.tags = this.tags;
		if (this.specifications && this.specifications.length > 0) doc.specifications = this.specifications;
		if (this.images && this.images.length > 0) doc.images = this.images;
		if (this.isSoldByWeight) {
			doc.isSoldByWeight = this.isSoldByWeight;
			doc.unit = this.unit;
			if (this.weight) doc.weight = this.weight;
		}

		return doc;
	}
}

// ============================================================================
// 3. CLASE CAPA 2: PRODUCTO POINT (Hereda Local + Catálogo Web / WhatsApp)
// ============================================================================
/**
 * Artículos que además de venderse en mostrador se exhiben en el catálogo digital
 * interactivo (pedidos por WhatsApp o retiro en tienda).
 */
export class PointProduct extends LocalProduct {
	public descriptions: IProductDescriptions;
	public isFeatured: boolean;

	constructor(data: IPointProductProps) {
		super(data);
		// En Point la galería completa de catálogo admite hasta POINT_MAX_IMAGES (50)
		if (data.images && data.images.length > 0) {
			if (data.images.length > POINT_MAX_IMAGES) {
				throw new Error(
					`El Plan Point permite un máximo de ${POINT_MAX_IMAGES} imágenes por producto. Se recibieron ${data.images.length}.`
				);
			}
			this.images = [...data.images];
		}

		this.descriptions = data.descriptions || {
			subtitle: data.subtitle,
			shortDescription: data.shortDescription,
			largeDescription: data.largeDescription
		};
		this.isFeatured = data.isFeatured ?? false;
	}

	// --- Métodos de Negocio Exclusivos de Catálogo ---

	/**
	 * Agrega una imagen a la galería del catálogo.
	 * En Plan Point: Soporta 1 a N nativo por variante (elimina limitaciones de Shopify y Tiendanube)
	 * con límite de hasta 50 imágenes por producto.
	 */
	public override addImage(image: IProductImage): void {
		if (!image || !image.url || !image.url.trim()) {
			throw new Error('La imagen debe tener una URL válida no vacía.');
		}
		if (!this.images) {
			this.images = [];
		}
		if (this.images.length >= POINT_MAX_IMAGES) {
			throw new Error(
				`El Plan Point permite un máximo de ${POINT_MAX_IMAGES} imágenes por producto. Actualice a Plan Pro para ampliar hasta ${PRO_MAX_IMAGES} imágenes.`
			);
		}
		this.images.push(image);
	}

	/** Obtiene todas las imágenes asociadas a una variante específica o color (1 a N nativo de catálogo) */
	public getImagesForVariant(sku: string): IProductImage[] {
		if (!this.images || this.images.length === 0) return [];
		return this.images.filter((img) => img.variantSku === sku);
	}

	/** Define si el producto se destaca en la portada del catálogo */
	public setFeatured(featured: boolean): void {
		this.isFeatured = featured;
	}

	/** Actualiza descripciones comerciales */
	public setDescriptions(descriptions: IProductDescriptions): void {
		this.descriptions = { ...this.descriptions, ...descriptions };
	}

	public override toDatabaseObject(): Record<string, any> {
		const doc = super.toDatabaseObject();
		if (this.descriptions.subtitle || this.descriptions.shortDescription || this.descriptions.largeDescription) {
			doc.descriptions = this.descriptions;
			// Mapear también a los campos planos para vistas existentes
			if (this.descriptions.subtitle) doc.subtitle = this.descriptions.subtitle;
			if (this.descriptions.shortDescription) doc.shortDescription = this.descriptions.shortDescription;
			if (this.descriptions.largeDescription) doc.largeDescription = this.descriptions.largeDescription;
		}
		if (this.isFeatured) doc.isFeatured = this.isFeatured;
		return doc;
	}
}

// ============================================================================
// 4. CLASE CAPA 3: PRODUCTO PRO (Hereda Point + E-commerce Full, SEO y Envíos)
// ============================================================================
/**
 * Artículos que operan en e-commerce de alto nivel (dominio propio, pasarelas de pago,
 * envíos automatizados, SEO y posicionamiento en Google).
 */
export class ProProduct extends PointProduct {
	public seo?: IProductSeo;
	public combineWith: ICombineWithItem[];
	public apparel?: IApparelExtensionProps;

	constructor(data: IProProductProps) {
		super(data);
		// En Pro la galería permite hasta PRO_MAX_IMAGES (100)
		if (data.images && data.images.length > 0) {
			if (data.images.length > PRO_MAX_IMAGES) {
				throw new Error(
					`El Plan Pro permite un máximo de ${PRO_MAX_IMAGES} imágenes por producto. Se recibieron ${data.images.length}.`
				);
			}
			this.images = [...data.images];
		}
		this.seo = data.seo;
		this.combineWith = data.combineWith || [];
		this.apparel = data.apparel;
	}

	// --- Métodos de Negocio Exclusivos de E-commerce y Moda ---

	/**
	 * Agrega una imagen a la galería.
	 * En Plan Pro: Soporta multi-imagen 1 a N por variante y encuadres duales con límite de hasta 100 imágenes.
	 */
	public override addImage(image: IProductImage): void {
		if (!image || !image.url || !image.url.trim()) {
			throw new Error('La imagen debe tener una URL válida no vacía.');
		}
		if (!this.images) {
			this.images = [];
		}
		if (this.images.length >= PRO_MAX_IMAGES) {
			throw new Error(`El Plan Pro permite un máximo de ${PRO_MAX_IMAGES} imágenes por producto.`);
		}
		this.images.push(image);
	}

	/** Obtiene imágenes filtradas por relación de aspecto (ej: '1:1' para grilla o '9:16' para lookbook móvil) */
	public getImagesByAspectRatio(ratio: ImageAspectRatio): IProductImage[] {
		if (!this.images || this.images.length === 0) return [];
		return this.images.filter((img) => img.aspectRatio === ratio);
	}

	/** Configura metadatos SEO para Google y redes sociales */
	public setSeo(seoData: IProductSeo): void {
		this.seo = seoData;
	}

	/** Asocia productos sugeridos (Shop The Look en Moda o Adicionales en Combos) */
	public addCombineWith(item: ICombineWithItem): void {
		this.combineWith.push(item);
	}

	public override toDatabaseObject(): Record<string, any> {
		const doc = super.toDatabaseObject();
		if (this.seo?.metaTitle || this.seo?.metaDescription) doc.seo = this.seo;
		if (this.combineWith.length > 0) doc.combineWith = this.combineWith;
		if (this.apparel?.gender || this.apparel?.sizeGuide) {
			doc.apparel = this.apparel;
			// Mapear campos planos de apparel para mantener integridad de catálogo
			if (this.apparel.gender) doc.gender = this.apparel.gender;
			if (this.apparel.fit) doc.fit = this.apparel.fit;
			if (this.apparel.material) doc.material = this.apparel.material;
			if (this.apparel.composition) doc.composition = this.apparel.composition;
			if (this.apparel.sizeType) doc.sizeType = this.apparel.sizeType;
			if (this.apparel.sizeGuide) doc.sizeGuide = this.apparel.sizeGuide;
			if (this.apparel.careInstructions) doc.careInstructions = this.apparel.careInstructions;
			if (this.apparel.season) doc.season = this.apparel.season;
		}
		return doc;
	}
}

// ============================================================================
// 5. FACTORY DE DOMINIO: CREA LA CLASE EXACTA SEGÚN EL PLAN
// ============================================================================

export class ProductDomainFactory {
	/**
	 * Instancia la clase de dominio correcta garantizando que cada plan solo
	 * cargue y guarde lo que le corresponde por suscripción.
	 */
	public static createByPlan(planTier: string, payload: any): LocalProduct | PointProduct | ProProduct {
		const normalized = (planTier || 'local').toLowerCase();

		switch (normalized) {
			case 'pro':
				return new ProProduct(payload as IProProductProps);
			case 'point':
				return new PointProduct(payload as IPointProductProps);
			case 'local':
			default:
				return new LocalProduct(payload as ILocalProductProps);
		}
	}
}
