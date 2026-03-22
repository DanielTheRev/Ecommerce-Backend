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

// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middlewares de seguridad
// CORS dinámico: los origins permitidos vienen de la config de cada tenant
const devOrigins = [
	'http://localhost:3000',
	'http://localhost:3001',
	'http://localhost:5173',
	'http://localhost:4200',
	'http://localhost:4300',
	'http://localhost:4000'
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
	const allOrigins = [...devOrigins];
	for (const origins of tenantOriginsCache.values()) {
		allOrigins.push(...origins);
	}
	return allOrigins;
}

app.use(helmet());
app.use(
	cors({
		origin: (origin, callback) => {
			if (process.env.NODE_ENV !== 'production') {
				return callback(null, true);
			}

			const allowed = getAllAllowedOrigins();
			if (!origin || allowed.includes(origin)) {
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

// ============================
// RUTAS MULTI-TENANT
// Todas las rutas de negocio pasan primero por resolveTenant
// que identifica el tenant y prepara req.models
// ============================
app.use('/api/products', resolveTenant, productRoutes);
app.use('/api/auth', resolveTenant, authRoutes);
app.use('/api/orders', resolveTenant, orderRoutes);
app.use('/api/shipping', resolveTenant, shippingRoutes);
app.use('/api/home', resolveTenant, homeRoutes);
app.use('/api/payment-methods', resolveTenant, paymentMethodRoutes);
app.use('/api/hero', resolveTenant, heroRoutes);
app.use('/api/bento', resolveTenant, bentoRoutes);
app.use('/api/config', resolveTenant, ecommerceConfigRoutes);
app.use('/api/cash-register', resolveTenant, cashRegisterRoutes);
app.use('/api/shop-the-look', resolveTenant, shopTheLookRoutes);

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
