# Vexx Backend

Backend API multi-tenant para la plataforma **Vexx** (Gestión Comercial, POS, Tienda Digital y Console Master), construido con Node.js, TypeScript, Express 5, MongoDB (Mongoose) y Socket.IO.

## 🚀 Características Principales

- **Arquitectura Multi-Tenant (`master_db` + DB por comercio):** Aislamiento de datos por tienda mediante `ConnectionManager` y resolución por dominio/subdominio o header `x-tenant-slug`.
- **Autenticación Aislada por Superficie:**
  - Dueños de tienda (`StoreOwner`) almacenados en `master_db.store_owners` (`aud: vexx_panel`).
  - Empleados y clientes almacenados por tenant (`aud: vexx_panel` / `vexx_storefront`).
  - Operadores de plataforma (`console.vexx`) con autenticación dedicada.
- **Motor Modular de Addons y Capacidades:** Sistema de planes (`LOCAL`, `POINT`, `PRO`), `price_builder`, POS, caja, cuentas corrientes, ARCA/AFIP, Mercado Pago / Getnet, favoritos, plantillas de storefront y bootstrap dinámico (`/api/tenant/bootstrap`).
- **Tiempo Real con Socket.IO + Expo Push:** Gateway WebSocket en `/api/socket.io` con salas aisladas por tenant (`admins_<slug>`, `pos_<slug>`, `terminal_<slug>_<id>`, `client_<slug>_<userId>`) y soporte de escáner móvil POS.
- **Seguridad y Producción:** Helmet, CORS dinámico multi-tenant, cookies `httpOnly`, validación con Zod y Graceful Shutdown (`SIGTERM` / `SIGINT`).

---

## 📁 Estructura del Proyecto

```text
src/
├── addons/         # Módulos activables, registry y motor de precios (price_builder)
├── config/         # Multitenancy (ConnectionManager), CORS, capacidades por plan, modelRegistry
├── controllers/    # Controladores HTTP por dominio
├── data/           # Presets y datos estáticos de vertical
├── domain/         # Lógica de dominio pura
├── errors/         # AppError y manejo centralizado de errores
├── interfaces/     # Contratos e interfaces TypeScript
├── middleware/     # tenant, auth (protect/authorize), planGuard, multer, rate limit
├── models/         # Esquemas Mongoose (master_db y modelos por tenant)
├── routes/         # Definición de rutas Express (/api/*)
├── scripts/        # Scripts CLI de mantenimiento y migración
├── services/       # Servicios de negocio (auth, orders, products, tenantBootstrap, etc.)
├── sockets/        # Gateway Socket.IO, auth WS, handler POS y RealtimeService
├── templates/      # Plantillas de emails / comprobantes PDF
├── utils/          # Utilidades compartidas
├── validators/     # Esquemas de validación Zod
└── index.ts        # Entrypoint HTTP + WebSocket Server + Graceful Shutdown
```

---

## 🛠️ Instalación y Entorno Local

1. Instalar dependencias con `pnpm` (gestor obligatorio):

```bash
pnpm install
```

2. Configurar el archivo `.env.development` (para local) o `.env.production` (para servidor) en la raíz del proyecto. **Nunca commitear archivos `.env*`**.

Variables principales:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/vexx_dev
JWT_SECRET=tu_jwt_secret_muy_seguro
JWT_EXPIRES_IN=7d
```

3. Compilar y ejecutar:

```bash
# Desarrollo con hot-reload
pnpm run dev

# Compilación TypeScript + path aliases
pnpm run build

# Producción
pnpm run start
```

---

## 🏃 Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `pnpm run dev` | Ejecuta el servidor en modo `development` con `nodemon` |
| `pnpm run build` | Compila TypeScript (`tsc && tsc-alias`) a `dist/` |
| `pnpm run build:watch` | Compila en modo watch |
| `pnpm run start` | Ejecuta `dist/index.js` en modo `production` |
| `pnpm exec tsc --noEmit` | Verifica tipos sin generar archivos |

---

## 🌐 Módulos de API Principales (`/api/*`)

- **Auth y Usuarios:** `/api/auth/*`, `/api/users/*`, `/api/role-profiles/*`
- **Multi-Tenant y Bootstrap:** `/api/tenant/bootstrap`, `/api/master/*`, `/api/addons/*`
- **Catálogo e Inventario:** `/api/products/*`, `/api/category-groups/*`, `/api/product-bundles/*`, `/api/master-catalog/*`, `/api/providers/*`
- **Ventas, POS y Caja:** `/api/orders/*`, `/api/pos/*`, `/api/cash-register/*`, `/api/account-movements/*`, `/api/arca/*`
- **Pagos y Envíos:** `/api/payment-methods/*`, `/api/getnet/*`, `/api/shipping/*`, `/api/coupons/*`
- **Storefront y Marketing:** `/api/ecommerce-config/*`, `/api/home/*`, `/api/hero/*`, `/api/menus/*`, `/api/bento/*`, `/api/shop-the-look/*`, `/api/favorites/*`, `/api/newsletter/*`, `/api/feed/*`
- **Notificaciones y WebSockets:** `/api/notifications/*` y Socket.IO en `/api/socket.io`

---

## ☁️ Despliegue en Producción (Ubuntu / AWS Lightsail + PM2 + Cloudflare Tunnel)

```bash
pnpm install --frozen-lockfile
pnpm run build
pm2 start dist/index.js --name vexx-backend
pm2 save
```

- Mantener **WebSockets** habilitado en Cloudflare Dashboard → **Network** para que `/api/socket.io` opere sobre `wss://`.
- Configurar `MONGODB_URI` y secretos únicamente en `.env.production` con permisos restringidos (`chmod 600 .env.production`).
