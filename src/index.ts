import cookie_parser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import { connectionManager } from './config/multitenancy';
import { errorMiddleware } from './middleware/error.middleware';
import { resolveTenant } from './middleware/tenant';
import { ITenant } from './interfaces/tenant.interface';
import authRoutes from './routes/auth.routes';
import ecommerceConfigRoutes from './routes/EcommerceConfig.routes';
import heroRoutes from './routes/hero.routes';
import bentoRoutes from './routes/bento.routes';
import homeRoutes from './routes/home.routes';
import orderRoutes from './routes/orderRoutes.routes';
import paymentMethodRoutes from './routes/paymentMethodRoutes.routes';
import productRoutes from './routes/productRoutes.routes';
import shippingRoutes from './routes/shippingRoutes.routes';
import shopTheLookRoutes from './routes/shopTheLook.routes';
import { socketManager } from './sockets/socketManager';
import providerRoutes from './routes/provider.routes';
import addressRoutes from './routes/address.routes';
import favoritesRoutes from './routes/favorites.routes';
import userRoutes from './routes/user.routes';
import cartRoutes from './routes/cart.routes';
import notificationRoutes from './routes/notification.routes';
import couponRoutes from './routes/coupon.routes';
import newsletterRoutes from './routes/newsletter.routes';

// Cargar variables de entorno según el entorno (development vs production)
const currentEnv = process.env.NODE_ENV || 'development';
dotenv.config(); // Base .env
dotenv.config({ path: `.env.${currentEnv}`, override: true });
dotenv.config({ path: `.env.${currentEnv}.local`, override: true });

console.log(`🌱 Entorno activo: [${currentEnv}] | Puerto: [${process.env.PORT || 3000}]`);

// Crear aplicación Express
const app: Application = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

// Middlewares de seguridad
// CORS dinámico: los origins permitidos vienen de la config de cada tenant y defaults de producción
const defaultOrigins = [
	'http://localhost:3000',
	'http://localhost:3001',
	'http://localhost:5173',
	'http://localhost:4200',
	'http://localhost:4300',
	'http://localhost:4000',
	'http://localhost:4900',
	'http://localhost:5000',
	'https://vura.com.ar',
	'https://www.vura.com.ar',
	'https://dashboard.vura.com.ar',
	'https://admin.vura.com.ar',
	"https://control-panel-50s.pages.dev/"
];

// Cache de origins por tenant para no consultar la DB en cada request
const tenantOriginsCache = new Map<string, string[]>();

async function loadAllTenantOrigins(): Promise<void> {
	try {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenants = await TenantModel.find({ isActive: true }).lean();
		for (const tenant of tenants) {
			if (tenant.settings?.allowedOrigins) {
				tenantOriginsCache.set(tenant.slug, tenant.settings.allowedOrigins);
			}
		}
		console.log(`🔒 CORS: ${tenantOriginsCache.size} tenants cargados`);
	} catch (error) {
		console.error('⚠️ No se pudieron cargar origins de tenants (se cargarán después)');
	}
}

function getAllAllowedOrigins(): string[] {
	const allOrigins = [...defaultOrigins];
	for (const origins of tenantOriginsCache.values()) {
		allOrigins.push(...origins);
	}
	return allOrigins;
}

function isOriginAllowed(origin: string | undefined): boolean {
	if (!origin) return true;
	if (process.env.NODE_ENV !== 'production') return true;

	const allowed = getAllAllowedOrigins();
	if (allowed.includes(origin)) return true;

	// Permitir automáticamente cualquier variante o subdominio de vura.com.ar o Cloudflare Pages
	if (
		origin === 'https://vura.com.ar' ||
		origin === 'https://www.vura.com.ar' ||
		origin.endsWith('.vura.com.ar') ||
		origin.endsWith('.pages.dev')
	) {
		return true;
	}

	return false;
}

app.use(helmet());
app.use(
	cors({
		origin: (origin, callback) => {
			if (isOriginAllowed(origin)) {
				callback(null, true);
			} else {
				console.log('CORS bloqueado:', origin);
				callback(new Error('ORIGEN NO PERMITIDO POR CORS'));
			}
		},
		credentials: true
	})
);

// Middlewares de logging y parsing
app.use(cookie_parser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ruta de salud (no necesita tenant)
app.get('/health', (req: Request, res: Response) => {
	res.status(200).json({
		success: true,
		message: 'Servidor funcionando correctamente',
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV || 'development'
	});
});

import cashRegisterRoutes from './routes/cashRegisterRoutes.routes';

const registerRoutes = (prefix: string) => {
	app.use(`${prefix}/products`, resolveTenant, productRoutes);
	app.use(`${prefix}/auth`, resolveTenant, authRoutes);
	app.use(`${prefix}/orders`, resolveTenant, orderRoutes);
	app.use(`${prefix}/shipping`, resolveTenant, shippingRoutes);
	app.use(`${prefix}/home`, resolveTenant, homeRoutes);
	app.use(`${prefix}/payment-methods`, resolveTenant, paymentMethodRoutes);
	app.use(`${prefix}/hero`, resolveTenant, heroRoutes);
	app.use(`${prefix}/bento`, resolveTenant, bentoRoutes);
	app.use(`${prefix}/config`, resolveTenant, ecommerceConfigRoutes);
	app.use(`${prefix}/cash-register`, resolveTenant, cashRegisterRoutes);
	app.use(`${prefix}/shop-the-look`, resolveTenant, shopTheLookRoutes);
	app.use(`${prefix}/provider`, resolveTenant, providerRoutes);
	app.use(`${prefix}/addresses`, resolveTenant, addressRoutes);
	app.use(`${prefix}/favorites`, resolveTenant, favoritesRoutes);
	app.use(`${prefix}/users`, resolveTenant, userRoutes);
	app.use(`${prefix}/cart`, resolveTenant, cartRoutes);
	app.use(`${prefix}/notifications`, resolveTenant, notificationRoutes);
	app.use(`${prefix}/coupons`, resolveTenant, couponRoutes);
	app.use(`${prefix}/newsletter`, resolveTenant, newsletterRoutes);
};

// Soportar tanto /api/... como /... (compatible con api.vura.com.ar)
registerRoutes('/api');
registerRoutes('');

// Error handler middleware
app.use(errorMiddleware);

// Root route (no necesita tenant)
app.get('/', (req: Request, res: Response) => {
	res.status(200).json({
		success: true,
		message: 'NexoCommerce API — Multi-Tenant',
		version: '2.0.0',
		documentation: 'Envía header x-tenant-id para acceder a los endpoints'
	});
});

// Middleware para rutas no encontradas
app.use((req: Request, res: Response) => {
	res.status(404).json({
		success: false,
		message: 'Ruta no encontrada',
		path: req.originalUrl
	});
});

// Crear servidor HTTP
const httpServer = createServer(app);

// Función para iniciar el servidor
const startServer = async (): Promise<void> => {
	try {
		// Conectar a MongoDB con el ConnectionManager multi-tenant
		await connectionManager.connect();

		// Cargar origins de todos los tenants para CORS dinámico
		await loadAllTenantOrigins();

		// Inicializar WebSockets
		socketManager.initialize(httpServer);

		// Iniciar el servidor
		httpServer.listen(PORT, () => {
			console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
			console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
			console.log(`🏢 Modo: Multi-Tenant (DB por cliente)`);
			console.log(`🔗 API Endpoints disponibles en http://localhost:${PORT}/api/products`);
			console.log(`🔌 WebSocket Server disponible en ws://localhost:${PORT}`);
		});
	} catch (error) {
		console.error('❌ Error al iniciar el servidor:', error);
		process.exit(1);
	}
};

// Iniciar el servidor

startServer();

export default app;
