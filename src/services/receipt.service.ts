import { AppError } from '@/errors/app.error';
import { IOrderDocument, PaymentStatus } from '@/interfaces/order.interface';
import { EcommerceService } from './ecommerce.service';
import PDFDocument from 'pdfkit';
import { TenantModels } from '@/config/modelRegistry';

export class ReceiptService {
	/**
	 * Genera un buffer PDF optimizado para ticketera térmica (80mm)
	 */
	static async generateThermalReceipt(models: TenantModels, order: IOrderDocument): Promise<Buffer> {
		try {
			// Obtener datos de la tienda para el membrete
			const config = await EcommerceService.getConfig(models);
			const storeName = config.name || 'NexoCommerce';
			const storeContact = config.contact || { address: '', phone: '', email: '' };

			return new Promise((resolve, reject) => {
				// Dimensiones para 80mm térmica (aprox 226 pts de ancho). Alto dinámico.
				const doc = new PDFDocument({
					margin: 15,
					size: [226, 800], // Alto se recortará o se ajustará en la impresión
					info: {
						Title: `Ticket de Compra #${order.orderNumber}`
					}
				});

				const buffers: Buffer[] = [];
				doc.on('data', buffers.push.bind(buffers));
				doc.on('end', () => {
					const pdfData = Buffer.concat(buffers);
					resolve(pdfData);
				});
				doc.on('error', reject);

				// === HEADER ===
				doc.font('Helvetica-Bold').fontSize(14).text(storeName, { align: 'center' });
				
				doc.font('Helvetica').fontSize(10);
				if (storeContact.address) doc.text(storeContact.address, { align: 'center' });
				if (storeContact.phone) doc.text(storeContact.phone, { align: 'center' });
				if (storeContact.email) doc.text(storeContact.email, { align: 'center' });
				
				doc.moveDown(0.5);
				doc.text('------------------------------------------', { align: 'center' });
				doc.moveDown(0.5);

				// === INFO TICKET ===
				doc.font('Helvetica-Bold').text(`Ticket #: ${order.orderNumber}`);
				doc.font('Helvetica').text(`Fecha: ${order.createdAt.toLocaleDateString('es-AR')} ${order.createdAt.toLocaleTimeString('es-AR')}`);
				
				let vendedorInfo = 'Sistema';
				if ((order as any).seller && (order as any).seller.name) {
					vendedorInfo = (order as any).seller.name;
				}
				doc.text(`Cajero/a: ${vendedorInfo}`);

				let clienteInfo = 'Consumidor Final';
				if ((order as any).user && (order as any).user.name) {
					clienteInfo = (order as any).user.name;
				}
				doc.text(`Cliente: ${clienteInfo}`);

				doc.moveDown(0.5);
				doc.text('------------------------------------------', { align: 'center' });
				doc.moveDown(0.5);

				// === ITEMS ===
				doc.font('Helvetica-Bold');
				doc.text('Cant  Descripción                            Total', { align: 'left' });
				doc.font('Helvetica');
				doc.moveDown(0.2);

				order.items.forEach(item => {
					// Format: 1x Producto Nombre (Variante) ... $Total
					// Recortamos la descripción si es muy larga
					const title = `${item.productSnapshot?.brand} ${item.productSnapshot?.model}`;
					const name = title.length > 20 ? title.substring(0, 18) + '..' : title.padEnd(20, ' ');
					const variantInfo = item.variantLabel ? ` (${item.variantLabel})` : '';
					const itemName = `${name}${variantInfo}`;
					
					const totalItem = (item.quantity * item.price).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
					
					// Fila del item
					doc.text(`${item.quantity}x ${itemName}`, { continued: true });
					doc.text(`${totalItem}`, { align: 'right' });
				});

				doc.moveDown(0.5);
				doc.text('------------------------------------------', { align: 'center' });
				doc.moveDown(0.5);

				// === TOTALES ===
				doc.font('Helvetica-Bold').fontSize(12);
				if (order.shippingCost > 0) {
					doc.text('Subtotal:', { continued: true });
					doc.text((order.total - order.shippingCost).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }), { align: 'right' });
					doc.text('Costo Envío:', { continued: true });
					doc.text(order.shippingCost.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }), { align: 'right' });
				}
				
				doc.text('TOTAL:', { continued: true });
				doc.text(order.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }), { align: 'right' });
				
				doc.moveDown(0.5);
				doc.font('Helvetica').fontSize(10);
				
				// === PAGOS ===
				doc.text('MÉTODOS DE PAGO:');
				if (order.splitPayments && order.splitPayments.length > 0) {
					order.splitPayments.forEach(sp => {
						doc.text(`- ${sp.method}: `, { continued: true });
						doc.text(sp.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }), { align: 'right' });
					});
				} else {
					doc.text(`- ${order.paymentInfo.method}: `, { continued: true });
					doc.text(order.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }), { align: 'right' });
				}

				if (order.paymentInfo.status !== PaymentStatus.APPROVED) {
					doc.moveDown(0.5);
					doc.font('Helvetica-Bold');
					doc.text(`ESTADO: ${order.paymentInfo.status}`, { align: 'center' });
				}

				doc.moveDown(1);
				doc.font('Helvetica');
				doc.text('¡Gracias por su compra!', { align: 'center' });
				doc.text('Conserve este ticket como comprobante.', { align: 'center' });

				// Finalizar doc
				doc.end();
			});

		} catch (error) {
			console.error('Error generating receipt:', error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to generate receipt', 'Error al generar comprobante', 500);
		}
	}
}
