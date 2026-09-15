import { Router } from 'express';
import { ArcaController } from '../controllers/arca.controller';
import { protect, staffOnly } from '../middleware/auth';

const router: Router = Router();

// Estado de servidores ARCA / AFIP (homologación o producción)
router.get('/status', protect, staffOnly, ArcaController.checkStatus);

// Consulta al padrón de ARCA por CUIT o DNI
router.get('/taxpayer/:cuit', protect, staffOnly, ArcaController.getTaxpayer);

// Emisión de factura electrónica para una orden
router.post('/invoice/order/:orderId', protect, staffOnly, ArcaController.createInvoiceForOrder);

// Obtener factura por ID
router.get('/invoice/:id', protect, staffOnly, ArcaController.getInvoice);

// Descargar o ver PDF oficial de la factura
router.get('/invoice/:id/pdf', protect, staffOnly, ArcaController.getInvoicePdf);

// Reporte y termómetro fiscal de Monotributo (12 meses móviles)
router.get('/monotributo/report', protect, staffOnly, ArcaController.getMonotributoReport);

export default router;
