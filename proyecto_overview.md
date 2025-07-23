# Proyecto Electro-Hub: Resumen

**1. Descripción del Proyecto:**
Electro-Hub es una tienda online especializada en productos tecnológicos que facilita la compra y gestión de productos para los usuarios, utilizando tecnologías modernas.

**2. Tecnologías Utilizadas:**

- **Frontend:**
  - Angular 20
  - Vite
  - Tailwind CSS
  - TypeScript
  - RxJS, Angular Signals

- **Backend:**
  - Node.js
  - Express.js
  - TypeScript
  - MongoDB (Mongoose)

**3. Estructura del Proyecto:**

- **Frontend:**
  - **Componentes:** Navbar, ProductCard, ShoppingCart, ShoppingCartItem
  - **Páginas:** Home, Checkout
  - **Manejo de Estado:** CartStoreService, ProductStoreService
  - **Routing:** Rutas principales para navegación

- **Backend:**
  - **Modelos:** Product, User, Order, ShippingOption
  - **Controladores:** productController, authController, orderController, shippingController
  - **Rutas:** Configuración de rutas para productos, autenticación, órdenes y envíos

- **Control Panel:**  
  - Proyectos en Angular para el panel administrativo con funcionalidades de gestión de productos y usuarios.

### Funcionalidades Clave del Backend:

- API REST completa con CRUD de productos, autenticación de usuarios, manejo de órdenes, análisis de pagos y gestión de opciones de envío.
- Autorización basada en roles para proteger rutas.  
- Autenticación basada en JWT con funcionalidades de inicio de sesión y registro.

### Estrategia de Despliegue:

- **Módulos de Orden:**  
Manejo de creación y seguimiento de órdenes, con integración planificada para MercadoPago y otras funcionalidades de pago.

- **Optimización y Seguridad:**
  - Implementación de CORS, middleware de seguridad y sanitización de datos.
  - Implementación de responsividad y accesibilidad en el frontend.

