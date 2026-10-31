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
import { loadAllTenantOrigins, isOriginAllowed } from './config/cors';
import authRoutes from './routes/auth.routes';
import ecommerceConfigRoutes from './routes/EcommerceConfig.routes';
import heroRoutes from './routes/hero.routes';
import menuRoutes from './routes/menu.routes';
import visualMenuRoutes from './routes/visualMenu.routes';
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
import categoryGroupRoutes from './routes/categoryGroup.routes';
import { getnetRoutes } from './routes/getnet.routes';
import arcaRoutes from './routes/arca.routes';
import { MasterCatalogService } from './services/masterCatalog.service';

// Cargar variables de entorno según el entorno (development vs production)
const currentEnv = process.env.NODE_ENV || 'development';
const envFile = currentEnv === 'production' ? '.env' : `.env.${currentEnv}`;
const envResult = dotenv.config({ path: envFile });
if (envResult.error) {
	console.warn(`⚠️ [ENV] No se encontró el archivo ${envFile}, intentando cargar .env base...`);
	dotenv.config();
}

console.log(`🌱 Entorno activo: [${currentEnv}] desde [${envFile}] | Puerto: [${process.env.PORT || 3000}]`);

// Crear aplicación Express
const app: Application = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

// Middlewares de seguridad
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

// Middleware para asegurar conexión a DB en entornos Serverless (Vercel)
app.use(async (req: Request, res: Response, next) => {
	try {
		await connectionManager.connect();
		next();
	} catch (error) {
		console.error('❌ Error asegurando conexión a MongoDB:', error);
		res.status(500).json({ success: false, message: 'Error de conexión a la base de datos' });
	}
});

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
import posRoutes from './routes/pos.routes';
import masterRoutes from './routes/master.routes';
import masterCatalogRoutes from './routes/masterCatalog.routes';
import feedRoutes from './routes/feed.routes';

// Rutas maestras de plataforma (SuperAdmin VEX — NO requieren resolveTenant)
app.use('/api/master', masterRoutes);
app.use('/master', masterRoutes);

// Catálogo Global Maestro de Kioscos y Productos Masivos (Global / Cross-Tenant)
app.use('/api/master-catalog', masterCatalogRoutes);
app.use('/master-catalog', masterCatalogRoutes);

const registerRoutes = (prefix: string) => {
	app.use(`${prefix}/products`, resolveTenant, productRoutes);
	app.use(`${prefix}/auth`, resolveTenant, authRoutes);
	app.use(`${prefix}/orders`, resolveTenant, orderRoutes);
	app.use(`${prefix}/shipping`, resolveTenant, shippingRoutes);
	app.use(`${prefix}/home`, resolveTenant, homeRoutes);
	app.use(`${prefix}/payment-methods`, resolveTenant, paymentMethodRoutes);
	app.use(`${prefix}/hero`, resolveTenant, heroRoutes);
	app.use(`${prefix}/menus`, resolveTenant, menuRoutes);
	app.use(`${prefix}/visual-menu`, resolveTenant, menuRoutes); // Alias retrocompatible
	app.use(`${prefix}/bento`, resolveTenant, menuRoutes); // Alias retrocompatible
	app.use(`${prefix}/category-groups`, resolveTenant, categoryGroupRoutes);
	app.use(`${prefix}/categories`, resolveTenant, categoryGroupRoutes); // Alias
	app.use(`${prefix}/config`, resolveTenant, ecommerceConfigRoutes);
	app.use(`${prefix}/cash-register`, resolveTenant, cashRegisterRoutes);
	app.use(`${prefix}/pos`, resolveTenant, posRoutes);
	app.use(`${prefix}/shop-the-look`, resolveTenant, shopTheLookRoutes);
	app.use(`${prefix}/provider`, resolveTenant, providerRoutes);
	app.use(`${prefix}/addresses`, resolveTenant, addressRoutes);
	app.use(`${prefix}/favorites`, resolveTenant, favoritesRoutes);
	app.use(`${prefix}/users`, resolveTenant, userRoutes);
	app.use(`${prefix}/cart`, resolveTenant, cartRoutes);
	app.use(`${prefix}/notifications`, resolveTenant, notificationRoutes);
	app.use(`${prefix}/coupons`, resolveTenant, couponRoutes);
	app.use(`${prefix}/newsletter`, resolveTenant, newsletterRoutes);
	app.use(`${prefix}/getnet`, resolveTenant, getnetRoutes);
	app.use(`${prefix}/webhooks/getnet`, resolveTenant, getnetRoutes);
	app.use(`${prefix}/arca`, resolveTenant, arcaRoutes);
	app.use(`${prefix}/master-catalog`, masterCatalogRoutes);
	app.use(`${prefix}/feeds`, feedRoutes);
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

		// Inicializar catálogo maestro global (kioscos / productos masivos)
		await MasterCatalogService.initCatalog();

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
if (!process.env.VERCEL) {
	startServer();
} else {
	// En Vercel Serverless inicializamos la conexión al arrancar el contenedor
	connectionManager.connect().then(() => {
		loadAllTenantOrigins().catch(console.error);
	}).catch((err) => {
		console.error('❌ Error conectando a MongoDB en Vercel:', err);
	});
}

export default app;
