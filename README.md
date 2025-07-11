# Electro Hub Backend

Backend API para Electro Hub construido con Node.js, TypeScript, Express y MongoDB.

## 🚀 Características

- **Node.js** con **TypeScript** para desarrollo type-safe
- **Express.js** para el servidor web
- **MongoDB** con **Mongoose** para la base de datos
- **CORS** habilitado para desarrollo
- **Helmet** para seguridad
- **Morgan** para logging
- **dotenv** para variables de entorno
- **Nodemon** para desarrollo con hot reload

## 📁 Estructura del Proyecto

```
src/
├── config/
│   └── database.ts          # Configuración de MongoDB
├── controllers/
│   ├── productController.ts # Controladores CRUD de productos
│   ├── authController.ts    # Controladores de autenticación
│   └── orderController.ts   # Controladores de órdenes
├── models/
│   ├── Product.ts          # Modelo de productos
│   ├── User.ts             # Modelo de usuarios
│   └── Order.ts            # Modelo de órdenes
├── routes/
│   ├── productRoutes.ts    # Rutas de productos
│   ├── authRoutes.ts       # Rutas de autenticación
│   └── orderRoutes.ts      # Rutas de órdenes
├── middleware/
│   └── auth.ts             # Middleware de autenticación y autorización
├── types/
│   ├── product.types.ts    # Interfaces de productos
│   ├── user.types.ts       # Interfaces de usuarios
│   └── order.types.ts      # Interfaces de órdenes
└── index.ts                # Punto de entrada
```

## 🛠️ Instalación

1. Instala las dependencias:
```bash
pnpm install
```

2. Copia el archivo `.env` y configura tus variables:
```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/electro-hub
NODE_ENV=development
JWT_SECRET=tu_jwt_secret_muy_seguro
JWT_EXPIRES_IN=7d
```

3. Asegúrate de tener MongoDB corriendo localmente o configura una conexión remota.

## 🏃‍♂️ Comandos Disponibles

- `pnpm dev` - Ejecuta el servidor en modo desarrollo con hot reload
- `pnpm start` - Ejecuta el servidor en modo producción
- `pnpm build` - Compila TypeScript a JavaScript
- `pnpm build:watch` - Compila en modo watch

## 🌐 Endpoints de la API

### Autenticación

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Registrar nuevo usuario | No |
| POST | `/api/auth/login` | Iniciar sesión | No |
| POST | `/api/auth/logout` | Cerrar sesión | Sí |
| GET | `/api/auth/profile` | Obtener perfil del usuario | Sí |
| PUT | `/api/auth/profile` | Actualizar perfil del usuario | Sí |

### Productos

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| GET | `/api/products` | Obtener todos los productos (con paginación) | No |
| GET | `/api/products/:id` | Obtener un producto por ID | No |
| POST | `/api/products` | Crear un nuevo producto | Sí (Admin) |
| PUT | `/api/products/:id` | Actualizar un producto completo | Sí (Admin) |
| PATCH | `/api/products/:id` | Actualizar parcialmente un producto | Sí (Admin) |
| DELETE | `/api/products/:id` | Eliminar un producto | Sí (Admin) |
| GET | `/api/products/search` | Buscar productos con filtros | No |

### Órdenes

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/api/orders` | Crear nueva orden | Sí |
| GET | `/api/orders/my-orders` | Obtener órdenes del usuario | Sí |
| GET | `/api/orders/:id` | Obtener una orden específica | Sí |
| PUT | `/api/orders/:id/cancel` | Cancelar orden | Sí |
| GET | `/api/orders` | Obtener todas las órdenes | Sí (Admin) |
| PUT | `/api/orders/:id/status` | Actualizar estado de orden | Sí (Admin) |
| GET | `/api/orders/admin/stats` | Obtener estadísticas de órdenes | Sí (Admin) |

### Ejemplo de Registro/Login

```json
// Registro
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123",
  "phone": "+573001234567",
  "address": "Calle 123 #45-67, Bogotá"
}

// Login
{
  "email": "juan@example.com",
  "password": "password123"
}
```

### Ejemplo de Producto

```json
{
  "name": "Smartphone Samsung Galaxy S23",
  "price": 999.99,
  "discount": 10,
  "rating": 4.5,
  "reviews": 1250,
  "image": {
    "light": "https://example.com/galaxy-s23-light.jpg",
    "dark": "https://example.com/galaxy-s23-dark.jpg"
  },
  "features": [
    "Pantalla AMOLED 6.1\"",
    "Cámara 50MP",
    "Batería 3900mAh",
    "128GB Storage"
  ]
}
```

### Ejemplo de Orden

```json
{
  "items": [
    {
      "product": "product_id_here",
      "quantity": 2,
      "price": 999.99
    }
  ],
  "shippingAddress": {
    "street": "Calle 123 #45-67",
    "city": "Bogotá",
    "state": "Cundinamarca",
    "zipCode": "110111",
    "country": "Colombia"
  },
  "paymentMethod": "credit_card"
}
```

### Parámetros de Búsqueda

- `q`: Término de búsqueda (nombre o características)
- `minPrice`: Precio mínimo
- `maxPrice`: Precio máximo
- `minRating`: Rating mínimo
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10)

### Ejemplo de Búsqueda

```
GET /api/products/search?q=smartphone&minPrice=500&maxPrice=1500&minRating=4&page=1&limit=10
```

## 🔧 Configuración Adicional

### Variables de Entorno

- `PORT`: Puerto del servidor (default: 3000)
- `MONGODB_URI`: URI de conexión a MongoDB
- `NODE_ENV`: Ambiente de ejecución (development/production)
- `JWT_SECRET`: Clave secreta para JWT (requerido)
- `JWT_EXPIRES_IN`: Tiempo de expiración del token (default: 7d)

### CORS

Por defecto, CORS está configurado para aceptar conexiones desde:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:5173`

Para producción, actualiza la configuración en `src/index.ts`.

## 🧪 Testing

Para probar la API puedes usar herramientas como:
- **Postman**
- **Thunder Client** (VS Code)
- **curl**

Ejemplos con curl:

```bash
# Registrar usuario
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "password": "password123",
    "phone": "+573001234567",
    "address": "Calle 123 #45-67, Bogotá"
  }'

# Iniciar sesión
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "password123"
  }'

# Obtener todos los productos
curl http://localhost:3000/api/products

# Crear un producto (requiere autenticación como admin)
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Product",
    "price": 99.99,
    "discount": 5,
    "image": {
      "light": "test-light.jpg",
      "dark": "test-dark.jpg"
    },
    "features": ["Feature 1", "Feature 2"]
  }'

# Crear una orden (requiere autenticación)
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "items": [
      {
        "product": "product_id_here",
        "quantity": 2,
        "price": 999.99
      }
    ],
    "shippingAddress": {
      "street": "Calle 123 #45-67",
      "city": "Bogotá",
      "state": "Cundinamarca",
      "zipCode": "110111",
      "country": "Colombia"
    },
    "paymentMethod": "credit_card"
  }'
```

## 🔐 Autenticación y Autorización

### JWT (JSON Web Tokens)

- Los tokens JWT se usan para la autenticación
- Se incluyen en el header `Authorization: Bearer <token>`
- Los tokens expiran según la configuración `JWT_EXPIRES_IN`
- Se almacenan también como httpOnly cookies para mayor seguridad

### Roles de Usuario

- **user**: Usuario regular, puede hacer órdenes y gestionar su perfil
- **admin**: Administrador, puede gestionar productos y ver todas las órdenes

### Middleware de Protección

- `protect`: Verifica que el usuario esté autenticado
- `adminOnly`: Verifica que el usuario sea administrador
- `authorize(roles)`: Verifica que el usuario tenga uno de los roles especificados
- `ownerOrAdmin`: Verifica que el usuario sea propietario del recurso o administrador
- `optionalAuth`: Obtiene el usuario si está autenticado, pero no requiere autenticación

## 📦 Sistema de Órdenes

### Estados de Orden

- `pending`: Orden creada, esperando procesamiento
- `processing`: Orden en proceso
- `shipped`: Orden enviada
- `delivered`: Orden entregada
- `cancelled`: Orden cancelada

### Funcionalidades

- Creación de órdenes con múltiples productos
- Cálculo automático de totales
- Gestión de direcciones de envío
- Integración con sistema de pagos (próximamente)

## 📝 Notas de Desarrollo

1. El servidor incluye manejo de errores global
2. Todas las respuestas siguen un formato estándar con `success`, `message` y `data`
3. La paginación está implementada por defecto
4. Los productos incluyen timestamps automáticos
5. Se incluyen índices en MongoDB para optimización
6. Las contraseñas se hashean con bcrypt antes de almacenarse
7. Los tokens JWT se firman con una clave secreta configurable
8. Se implementa middleware de autorización por roles
9. **Todas las funciones de los controladores retornan valores correctamente**
10. **Los middlewares de autenticación están correctamente configurados**
11. **Las rutas de productos son públicas para visualización, protegidas para modificación**

## 🐛 Troubleshooting

### Error de conexión a MongoDB
- Asegúrate de que MongoDB esté corriendo
- Verifica la URI de conexión en `.env`
- Revisa los logs del servidor para más detalles

### Puerto ya en uso
- Cambia el puerto en `.env`
- Mata el proceso que usa el puerto: `netstat -ano | findstr :3000`
