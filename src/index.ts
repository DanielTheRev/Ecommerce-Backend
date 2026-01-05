import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectDB } from './config/database';
import productRoutes from './routes/productRoutes.routes';
import authRoutes from './routes/auth.routes';
import orderRoutes from './routes/orderRoutes.routes';
import shippingRoutes from './routes/shippingRoutes.routes';
import paymentMethodRoutes from './routes/paymentMethodRoutes.routes';
import homeRoutes from './routes/home.routes';
import { initUalaCheckOut } from './config/ualabis';
import { socketManager } from './sockets/socketManager';
import cookie_parser from 'cookie-parser';
import { errorMiddleware } from './middleware/error.middleware';

// Cargar variables de entorno
dotenv.config();

// Inicializar Uala Checkout
initUalaCheckOut();

// Crear aplicación Express
const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middlewares de seguridad
const allowedOrigins =
	process.env.NODE_ENV === 'production'
		? ['https://www.electromix.com.ar', 'https://electromix.com.ar']
		: [
				'http://localhost:3000',
				'http://localhost:3001',
				'http://localhost:5173',
				'http://localhost:4200',
				'http://localhost:4300',
				'http://localhost:4000',
				'https://www.electromix.com.ar',
				'https://electromix.com.ar',
				'https://0rxf1t1jlv0j4ylas2rhatrnc8efqzeufyfvw0lggpthyb0r2m-h839267052.scf.usercontent.goog'
			];

app.use(helmet());
app.use(
	cors({
		origin: (origin, callback) => {
			if (process.env.NODE_ENV !== 'production') {
				// En desarrollo, permitir cualquier origen
				return callback(null, true);
			}

			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				console.log('El origen de la petición => ', origin);
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

// Ruta de salud
app.get('/health', (req: Request, res: Response) => {
	res.status(200).json({
		success: true,
		message: 'Servidor funcionando correctamente',
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV || 'development'
	});
});

// Rutas
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/home', homeRoutes);

// Error handler middleware
app.use(errorMiddleware);

// Root route
app.get('/', (req: Request, res: Response) => {
	res.status(200).json({
		success: true,
		message: 'Bienvenido a Electro Hub API',
		version: '1.0.0',
		documentation: '/api/products para ver los endpoints disponibles'
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

// Middleware global de manejo de errores
// app.use((error: any, req: Request, res: Response, next: any) => {
// 	console.error('❌ Error no capturado:', error);

// 	res.status(error.status || 500).json({
// 		success: false,
// 		message: error.message || 'Error interno del servidor',
// 		...(process.env.NODE_ENV === 'development' && { stack: error.stack })
// 	});
// });

// Crear servidor HTTP
const httpServer = createServer(app);

// Función para iniciar el servidor
const startServer = async (): Promise<void> => {
	try {
		// Conectar a la base de datos
		await connectDB();

		// Inicializar WebSockets
		socketManager.initialize(httpServer);

		// Iniciar el servidor
		httpServer.listen(PORT, () => {
			console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
			console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
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
