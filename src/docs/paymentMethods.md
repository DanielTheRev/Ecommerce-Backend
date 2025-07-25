# API de Métodos de Pago - Electro Hub

## Endpoints disponibles

### Rutas públicas

#### GET /api/payment-methods/active
**Descripción:** Obtener todos los métodos de pago activos  
**Autenticación:** No requerida  
**Respuesta ejemplo:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f...",
      "type": "Efectivo",
      "name": "Efectivo",
      "description": "Pago en efectivo en punto de encuentro",
      "isActive": true,
      "processingFee": 0,
      "createdAt": "2023-...",
      "updatedAt": "2023-..."
    }
  ]
}
```

#### GET /api/payment-methods/:id
**Descripción:** Obtener un método de pago específico por ID  
**Autenticación:** No requerida  
**Parámetros:** ID del método de pago  

---

### Rutas protegidas (Solo administradores)

#### GET /api/payment-methods
**Descripción:** Obtener todos los métodos de pago (activos e inactivos)  
**Autenticación:** Token de administrador  

#### POST /api/payment-methods
**Descripción:** Crear un nuevo método de pago  
**Autenticación:** Token de administrador  
**Body ejemplo:**
```json
{
  "type": "Efectivo",
  "name": "Efectivo",
  "description": "Pago en efectivo en punto de encuentro",
  "isActive": true,
  "processingFee": 0
}
```

#### PUT /api/payment-methods/:id
**Descripción:** Actualizar completamente un método de pago  
**Autenticación:** Token de administrador  
**Parámetros:** ID del método de pago  
**Body:** Objeto completo del método de pago  

#### DELETE /api/payment-methods/:id
**Descripción:** Eliminar un método de pago  
**Autenticación:** Token de administrador  
**Parámetros:** ID del método de pago  

#### PATCH /api/payment-methods/:id/toggle
**Descripción:** Activar/desactivar un método de pago  
**Autenticación:** Token de administrador  
**Parámetros:** ID del método de pago  

---

## Tipos de pago disponibles

1. **Efectivo** (`"Efectivo"`)
2. **Transferencia bancaria** (`"Transferencia bancaria"`)
3. **Transferencia a alias** (`"Transferencia a alias"`)
4. **Tarjeta de crédito/débito** (`"Tarjeta de credito / debito"`)

---

## Estructura del modelo

```typescript
interface IPaymentMethod {
  type: PaymentType;           // Tipo de método de pago (enum)
  name: string;               // Nombre del método de pago
  description?: string;       // Descripción opcional
  isActive: boolean;          // Si está activo o no
  processingFee?: number;     // Comisión en porcentaje (0-100)
  createdAt: Date;           // Fecha de creación
  updatedAt: Date;           // Fecha de actualización
}
```

---

## Script de inicialización

Para inicializar los métodos de pago por defecto, ejecutar:

```bash
npm run ts-node src/scripts/initPaymentMethods.ts
```

Este script creará automáticamente los 4 métodos de pago básicos si no existen en la base de datos.
