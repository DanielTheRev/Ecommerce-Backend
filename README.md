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
│   └── productController.ts # Controladores CRUD
├── models/
│   └── Product.ts          # Modelo de Mongoose
├── routes/
│   └── productRoutes.ts    # Rutas de la API
├── types/
│   └── product.types.ts    # Interfaces TypeScript
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
```

3. Asegúrate de tener MongoDB corriendo localmente o configura una conexión remota.

## 🏃‍♂️ Comandos Disponibles

- `pnpm dev` - Ejecuta el servidor en modo desarrollo con hot reload
- `pnpm start` - Ejecuta el servidor en modo producción
- `pnpm build` - Compila TypeScript a JavaScript
- `pnpm build:watch` - Compila en modo watch

## 🌐 Endpoints de la API

### Productos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/products` | Obtener todos los productos (con paginación) |
| GET | `/api/products/:id` | Obtener un producto por ID |
| POST | `/api/products` | Crear un nuevo producto |
| PUT | `/api/products/:id` | Actualizar un producto completo |
| PATCH | `/api/products/:id` | Actualizar parcialmente un producto |
| DELETE | `/api/products/:id` | Eliminar un producto |
| GET | `/api/products/search` | Buscar productos con filtros |

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

Ejemplo con curl:
```bash
# Obtener todos los productos
curl http://localhost:3000/api/products

# Crear un producto
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
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
```

## 📝 Notas de Desarrollo

1. El servidor incluye manejo de errores global
2. Todas las respuestas siguen un formato estándar con `success`, `message` y `data`
3. La paginación está implementada por defecto
4. Los productos incluyen timestamps automáticos
5. Se incluyen índices en MongoDB para optimización

## 🐛 Troubleshooting

### Error de conexión a MongoDB
- Asegúrate de que MongoDB esté corriendo
- Verifica la URI de conexión en `.env`
- Revisa los logs del servidor para más detalles

### Puerto ya en uso
- Cambia el puerto en `.env`
- Mata el proceso que usa el puerto: `netstat -ano | findstr :3000`
