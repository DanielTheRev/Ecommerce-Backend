import Afip from '@afipsdk/afip.js';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { EcommerceService } from './ecommerce.service';
import { IInvoiceDocument } from '@/models/Invoice.model';

export class ArcaService {
	/**
	 * Inicializa el cliente oficial de AfipSDK configurado con los datos fiscales del tenant.
	 */
	static async initClient(models: TenantModels) {
		const config = await EcommerceService.getConfig(models);
		const arcaConfig = config.integrations?.arca;
		const fiscalProfile = config.fiscalProfile;

		const rawCuit = arcaConfig?.cuit || fiscalProfile?.cuit;
		if (!rawCuit) {
			throw new AppError(
				'ARCA CUIT is not configured in store settings',
				'El CUIT no está configurado en los ajustes fiscales de la tienda (ARCA / AFIP)',
				400
			);
		}

		const cleanedCuit = rawCuit.replace(/\D/g, '');
		const cuitNumber = Number(cleanedCuit);
		if (isNaN(cuitNumber) || cleanedCuit.length !== 11) {
			throw new AppError(
				'Invalid CUIT format. Must be 11 digits.',
				'El CUIT configurado es inválido. Debe tener 11 dígitos.',
				400
			);
		}

		const isProduction = arcaConfig?.isProduction ?? false;
		const cert = arcaConfig?.cert || process.env.AFIP_CERT;
		const key = arcaConfig?.key || process.env.AFIP_KEY;

		const afip = new (Afip as any)({
			CUIT: cuitNumber,
			cert,
			key,
			production: isProduction
		});

		return {
			afip,
			config,
			arcaConfig,
			fiscalProfile,
			cuitNumber,
			cleanedCuit,
			isProduction
		};
	}

	/**
	 * Verifica el estado de los servidores de ARCA / AFIP (WSAA y WSFE).
	 */
	static async checkServerStatus(models: TenantModels) {
		try {
			const { afip, isProduction } = await this.initClient(models);
			const status = await afip.ElectronicBilling.getServerStatus();
			return {
				success: true,
				environment: isProduction ? 'production' : 'homologation (testing)',
				servers: status
			};
		} catch (error: any) {
			console.error('Error checking ARCA server status:', error);
			throw new AppError(
				'Failed to connect with ARCA servers',
				error.message || 'Error al conectar con los servidores de ARCA / AFIP',
				502
			);
		}
	}

	/**
	 * Consulta los datos de un contribuyente en el padrón de ARCA / AFIP por CUIT o DNI.
	 */
	static async getTaxpayerDetails(models: TenantModels, cuit: string) {
		try {
			const cleaned = cuit.replace(/\D/g, '');
			if (!cleaned || cleaned.length < 10 || cleaned.length > 11) {
				throw new AppError('Invalid identification number', 'Número de CUIT inválido (debe tener 11 dígitos)', 400);
			}

			let afipClient: any;
			try {
				const { afip } = await this.initClient(models);
				afipClient = afip;
			} catch {
				const config = await EcommerceService.getConfig(models);
				const isProduction = config.integrations?.arca?.isProduction ?? false;
				const cert = config.integrations?.arca?.cert || process.env.AFIP_CERT;
				const key = config.integrations?.arca?.key || process.env.AFIP_KEY;
				afipClient = new (Afip as any)({
					CUIT: Number(cleaned),
					cert,
					key,
					production: isProduction
				});
			}

			let details: any = null;
			try {
				details = await afipClient.RegisterScopeFive.getTaxpayerDetails(Number(cleaned));
			} catch {
				try {
					details = await afipClient.RegisterScopeFour.getTaxpayerDetails(Number(cleaned));
				} catch (err: any) {
					const isAuthError =
						err?.message?.includes('401') ||
						err?.status === 401 ||
						err?.response?.status === 401;

					if (isAuthError) {
						throw new AppError(
							'ARCA certificate required',
							'Para consultar el padrón oficial en tiempo real se requiere tener configurado el Certificado Digital de ARCA/AFIP. Podés ingresar tu categoría y datos manualmente en el formulario.',
							400
						);
					}

					throw new AppError(
						'Taxpayer not found in ARCA records',
						err.message || 'No se encontraron datos para el CUIT en el padrón de ARCA',
						404
					);
				}
			}

			// Parsear datos de forma normalizada para el frontend
			const dg = details?.datosGenerales || {};
			const dm = details?.datosMonotributo;
			const drg = details?.datosRegimenGeneral;

			let legalName = dg.razonSocial || '';
			if (!legalName && (dg.apellido || dg.nombre)) {
				legalName = `${dg.apellido || ''} ${dg.nombre || ''}`.trim();
			}

			let taxRegime: 'monotributo' | 'responsable_inscripto' | 'exento' = 'monotributo';
			let monotributoCategory: string | undefined = undefined;

			if (dm) {
				taxRegime = 'monotributo';
				const catDesc = dm.categoriaMonotributo?.descripcionCategoria || dm.categoriaMonotributo || '';
				const match = String(catDesc).match(/\b([A-K])\b/i);
				if (match) {
					monotributoCategory = match[1].toUpperCase();
				}
			} else if (drg) {
				taxRegime = 'responsable_inscripto';
			}

			return {
				success: true,
				taxpayer: {
					cuit: cleaned,
					legalName,
					taxRegime,
					monotributoCategory,
					tipoPersona: dg.tipoPersona || (cleaned.startsWith('30') || cleaned.startsWith('33') ? 'JURIDICA' : 'FISICA'),
					raw: details
				}
			};
		} catch (error: any) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error querying ARCA taxpayer database',
				error.message || 'Error al consultar el padrón de ARCA',
				500
			);
		}
	}

	/**
	 * Emite la Factura Electrónica en ARCA para una orden de compra,
	 * obtiene el CAE y la fecha de vencimiento, y guarda el registro en la base de datos.
	 */
	static async createInvoiceForOrder(models: TenantModels, orderId: string) {
		const order = await models.Order.findById(orderId);
		if (!order) {
			throw new AppError('Order not found', 'Orden no encontrada', 404);
		}

		// Si ya está facturada, devolver la factura existente
		if (order.isFacturado && order.invoice) {
			const existingInvoice = await models.Invoice.findById(order.invoice);
			if (existingInvoice) {
				return {
					success: true,
					alreadyInvoiced: true,
					invoice: existingInvoice
				};
			}
		}

		const { afip, arcaConfig, fiscalProfile, cuitNumber, cleanedCuit } = await this.initClient(models);

		const ptoVta = Number(arcaConfig?.ptoVta || 1);
		const taxRegime = arcaConfig?.taxRegime || fiscalProfile?.taxRegime || 'monotributo';

		// Determinación del tipo de comprobante:
		// 11 = Factura C (Monotributistas)
		// 6 = Factura B (Responsables Inscriptos a Consumidores Finales o Monotributistas)
		// 1 = Factura A (Responsables Inscriptos a otros Responsables Inscriptos con CUIT)
		let voucherType = 11;
		let voucherTypeName = 'Factura C';

		const buyerIdentType = (order.buyerData?.identificationType || '').toUpperCase();
		const buyerIdentNum = (order.buyerData?.identificationNumber || '').replace(/\D/g, '');

		if (taxRegime === 'monotributo') {
			voucherType = 11;
			voucherTypeName = 'Factura C';
		} else if (taxRegime === 'responsable_inscripto') {
			if (buyerIdentType.includes('CUIT') && buyerIdentNum.length === 11) {
				voucherType = 1;
				voucherTypeName = 'Factura A';
			} else {
				voucherType = 6;
				voucherTypeName = 'Factura B';
			}
		}

		// Tipo de documento del comprador
		// 80: CUIT | 96: DNI | 99: Consumidor Final sin identificar
		let buyerDocType = 99;
		let buyerDocNum = 0;

		if (buyerIdentType.includes('CUIT') && buyerIdentNum.length === 11) {
			buyerDocType = 80;
			buyerDocNum = Number(buyerIdentNum);
		} else if (buyerIdentNum.length >= 7) {
			buyerDocType = 96;
			buyerDocNum = Number(buyerIdentNum);
		}

		// Obtener próximo número de comprobante de ARCA
		let lastVoucher = 0;
		try {
			lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, voucherType);
		} catch (err: any) {
			console.error('Error fetching last voucher from ARCA:', err);
			throw new AppError(
				'Failed to fetch last voucher number from ARCA',
				err.message || 'Error al obtener el último número de comprobante desde ARCA',
				502
			);
		}

		const nextVoucher = (Number(lastVoucher) || 0) + 1;
		const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

		// Importes
		const amountTotal = Math.round(Number(order.finance.total) * 100) / 100;
		let amountNet = amountTotal;
		let amountTax = 0;
		let ivaArray: any[] = [];

		if (voucherType === 11) {
			// Factura C: no discrimina IVA
			amountNet = amountTotal;
			amountTax = 0;
		} else {
			// Factura A o B: discrimina IVA (21%)
			amountNet = Math.round((amountTotal / 1.21) * 100) / 100;
			amountTax = Math.round((amountTotal - amountNet) * 100) / 100;
			ivaArray = [
				{
					Id: 5, // 21%
					BaseImp: amountNet,
					Importe: amountTax
				}
			];
		}

		const voucherPayload: any = {
			CantReg: 1,
			PtoVta: ptoVta,
			CbteTipo: voucherType,
			Concepto: 1, // 1 = Productos
			DocTipo: buyerDocType,
			DocNro: buyerDocNum,
			CbteDesde: nextVoucher,
			CbteHasta: nextVoucher,
			CbteFch: today,
			ImpTotal: amountTotal,
			ImpTotConc: 0,
			ImpNeto: amountNet,
			ImpOpEx: 0,
			ImpTrib: 0,
			ImpIVA: amountTax,
			MonId: 'PES',
			MonCotiz: 1
		};

		if (ivaArray.length > 0) {
			voucherPayload.Iva = ivaArray;
		}

		// Solicitar CAE a ARCA
		let afipRes: any;
		try {
			afipRes = await afip.ElectronicBilling.createVoucher(voucherPayload);
		} catch (err: any) {
			console.error('Error creating voucher in ARCA:', err);
			throw new AppError(
				'ARCA voucher authorization failed',
				err.message || 'Error al autorizar el comprobante en ARCA / AFIP',
				502
			);
		}

		const cae = afipRes.CAE;
		const caeFchVtoStr = String(afipRes.CAEFchVto);
		// Parse fecha vencimiento YYYYMMDD
		const caeYear = parseInt(caeFchVtoStr.slice(0, 4), 10);
		const caeMonth = parseInt(caeFchVtoStr.slice(4, 6), 10) - 1;
		const caeDay = parseInt(caeFchVtoStr.slice(6, 8), 10);
		const caeExpiration = new Date(caeYear, caeMonth, caeDay);

		// Construcción de la URL de QR oficial reglamentario de ARCA
		const qrObject = {
			ver: 1,
			fecha: `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}`,
			cuit: cuitNumber,
			ptoVta: ptoVta,
			tipoCmp: voucherType,
			nroCmp: nextVoucher,
			importe: amountTotal,
			moneda: 'PES',
			ctz: 1,
			tipoDocRec: buyerDocType,
			nroDocRec: buyerDocNum,
			tipoCodAut: 'E',
			codAut: Number(cae)
		};
		const qrBase64 = Buffer.from(JSON.stringify(qrObject)).toString('base64');
		const qrData = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;

		// Crear documento de factura
		const invoice = await models.Invoice.create({
			order: order._id,
			cae,
			caeExpiration,
			voucherType,
			voucherTypeName,
			ptoVta,
			voucherNumber: nextVoucher,
			voucherDate: today,
			docType: buyerDocType,
			docNumber: String(buyerDocNum),
			amountTotal,
			amountNet,
			amountTax,
			qrData,
			status: 'authorized',
			clientSnapshot: {
				name: `${order.buyerData.firstName} ${order.buyerData.lastName}`.trim(),
				email: order.buyerData.email,
				identificationType: order.buyerData.identificationType,
				identificationNumber: order.buyerData.identificationNumber,
				address: order.shippingInfo?.shippingAddress?.street
					? `${order.shippingInfo.shippingAddress.street} ${order.shippingInfo.shippingAddress.number || ''}`.trim()
					: ''
			},
			afipResponse: afipRes
		});

		// Vincular a la orden
		order.isFacturado = true;
		order.invoice = invoice._id as any;
		await order.save();

		return {
			success: true,
			invoice
		};
	}

	/**
	 * Genera un PDF profesional en formato A4 con el formato reglamentario oficial de Factura Electrónica ARCA.
	 */
	static async generateInvoicePdf(models: TenantModels, invoiceId: string): Promise<Buffer> {
		const invoice = await models.Invoice.findById(invoiceId);
		if (!invoice) {
			throw new AppError('Invoice not found', 'Comprobante no encontrado', 404);
		}

		const order = await models.Order.findById(invoice.order);
		const config = await EcommerceService.getConfig(models);
		const arcaConfig = config.integrations?.arca;
		const fiscalProfile = config.fiscalProfile;

		const storeName = arcaConfig?.businessName || fiscalProfile?.businessName || config.name || 'NexoCommerce Store';
		const storeCuit = arcaConfig?.cuit || fiscalProfile?.cuit || '00-00000000-0';
		const storeTaxRegime = (arcaConfig?.taxRegime || fiscalProfile?.taxRegime || 'Monotributo').toUpperCase();
		const storeIIBB = arcaConfig?.grossIncomeNumber || fiscalProfile?.grossIncomeNumber || storeCuit;
		const storeAddress = config.contact?.address || 'Argentina';

		// Generar buffer del código QR oficial
		const qrBuffer = await QRCode.toBuffer(invoice.qrData || 'https://www.afip.gob.ar', {
			width: 110,
			margin: 1
		});

		return new Promise((resolve, reject) => {
			const doc = new PDFDocument({
				size: 'A4',
				margin: 35,
				info: {
					Title: `${invoice.voucherTypeName} #${String(invoice.ptoVta).padStart(4, '0')}-${String(invoice.voucherNumber).padStart(8, '0')}`
				}
			});

			const buffers: Buffer[] = [];
			doc.on('data', buffers.push.bind(buffers));
			doc.on('end', () => resolve(Buffer.concat(buffers)));
			doc.on('error', reject);

			const formattedPtoVta = String(invoice.ptoVta).padStart(5, '0');
			const formattedCbteNro = String(invoice.voucherNumber).padStart(8, '0');
			const dateStr = `${invoice.voucherDate.slice(6, 8)}/${invoice.voucherDate.slice(4, 6)}/${invoice.voucherDate.slice(0, 4)}`;

			// === 1. RECUADRO SUPERIOR (ENCABEZADO OFICIAL) ===
			doc.rect(35, 35, 525, 140).lineWidth(1).stroke('#1e293b');

			// Letra del comprobante central (C / B / A)
			const letter = invoice.voucherTypeName.includes('C') ? 'C' : (invoice.voucherTypeName.includes('A') ? 'A' : 'B');
			const cod = invoice.voucherType === 11 ? '011' : (invoice.voucherType === 1 ? '001' : '006');
			doc.rect(275, 35, 45, 40).fillAndStroke('#f8fafc', '#1e293b');
			doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(24).text(letter, 275, 40, { width: 45, align: 'center' });
			doc.font('Helvetica-Bold').fontSize(8).text(`COD. ${cod}`, 275, 64, { width: 45, align: 'center' });

			// Línea divisoria central vertical
			doc.moveTo(297, 75).lineTo(297, 175).stroke('#cbd5e1');

			// Lado Izquierdo (Datos del Emisor)
			doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(storeName, 45, 45, { width: 220 });
			doc.font('Helvetica').fontSize(9).fillColor('#334155');
			doc.text(`Razón Social: ${storeName}`, 45, 80);
			doc.text(`Domicilio Comercial: ${storeAddress}`, 45, 95, { width: 220 });
			doc.text(`Condición frente al IVA: ${storeTaxRegime}`, 45, 125);

			// Lado Derecho (Datos del Comprobante)
			doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text(invoice.voucherTypeName.toUpperCase(), 315, 45);
			doc.font('Helvetica-Bold').fontSize(11).text(`Punto de Venta: ${formattedPtoVta}   Comp. Nro: ${formattedCbteNro}`, 315, 68);
			doc.font('Helvetica').fontSize(9).fillColor('#334155');
			doc.text(`Fecha de Emisión: ${dateStr}`, 315, 88);
			doc.text(`CUIT: ${storeCuit}`, 315, 105);
			doc.text(`Ingresos Brutos: ${storeIIBB}`, 315, 120);
			doc.text(`Fecha de Inicio de Actividades: 01/01/2024`, 315, 135);

			// === 2. DATOS DEL CLIENTE / RECEPTOR ===
			doc.rect(35, 182, 525, 60).lineWidth(0.5).stroke('#cbd5e1');
			const client = invoice.clientSnapshot || { name: 'Consumidor Final', email: '', identificationNumber: '0', address: '' };

			doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8).text('DATOS DEL RECEPTOR / CLIENTE', 45, 187);
			doc.font('Helvetica').fontSize(9).fillColor('#1e293b');
			doc.text(`Nombre / Razón Social: ${client.name || 'Consumidor Final'}`, 45, 200);
			doc.text(`Doc / CUIT: ${client.identificationNumber || '0'} (${invoice.docType === 80 ? 'CUIT' : (invoice.docType === 96 ? 'DNI' : 'S/D')})`, 45, 215);
			doc.text(`Condición IVA: ${invoice.docType === 80 ? 'IVA Responsable Inscripto / Monotributo' : 'Consumidor Final'}`, 315, 200);
			doc.text(`Domicilio: ${client.address || 'Argentina'}`, 315, 215);

			// === 3. TABLA DE ÍTEMS / PRODUCTOS ===
			const tableTop = 250;
			doc.rect(35, tableTop, 525, 22).fillAndStroke('#0f172a', '#0f172a');
			doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
			doc.text('CÓDIGO / DETALLE', 45, tableTop + 7);
			doc.text('CANTIDAD', 320, tableTop + 7, { width: 50, align: 'center' });
			doc.text('PRECIO UNIT.', 380, tableTop + 7, { width: 70, align: 'right' });
			doc.text('SUBTOTAL', 460, tableTop + 7, { width: 90, align: 'right' });

			let yPos = tableTop + 26;
			const items = order?.items || [];

			doc.fillColor('#1e293b').font('Helvetica').fontSize(8.5);
			for (const item of items) {
				const desc = `${item.productSnapshot?.brand || ''} ${item.productSnapshot?.model || 'Producto'}`.trim();
				const unitPrice = item.price || 0;
				const subtotal = unitPrice * item.quantity;

				doc.text(desc, 45, yPos, { width: 270 });
				doc.text(String(item.quantity), 320, yPos, { width: 50, align: 'center' });
				doc.text(`$${unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 380, yPos, { width: 70, align: 'right' });
				doc.text(`$${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 460, yPos, { width: 90, align: 'right' });

				yPos += 18;
				doc.moveTo(35, yPos - 2).lineTo(560, yPos - 2).lineWidth(0.3).stroke('#e2e8f0');
			}

			// Envío si aplica
			if (order?.shippingInfo?.cost && order.shippingInfo.cost > 0) {
				doc.text('Servicio de Envío a Domicilio', 45, yPos, { width: 270 });
				doc.text('1', 320, yPos, { width: 50, align: 'center' });
				doc.text(`$${order.shippingInfo.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 380, yPos, { width: 70, align: 'right' });
				doc.text(`$${order.shippingInfo.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 460, yPos, { width: 90, align: 'right' });
				yPos += 18;
			}

			// === 4. TOTALES ===
			const totalBoxY = Math.max(yPos + 15, 620);
			doc.rect(35, totalBoxY, 525, 60).lineWidth(0.5).stroke('#cbd5e1');

			doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569');
			doc.text('Subtotal Neto:', 350, totalBoxY + 12);
			doc.font('Helvetica').text(`$${invoice.amountNet.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 450, totalBoxY + 12, { width: 100, align: 'right' });

			if (invoice.amountTax > 0) {
				doc.font('Helvetica-Bold').text('IVA (21%):', 350, totalBoxY + 26);
				doc.font('Helvetica').text(`$${invoice.amountTax.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 450, totalBoxY + 26, { width: 100, align: 'right' });
			}

			doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a');
			doc.text('Importe Total:', 350, totalBoxY + 40);
			doc.text(`$${invoice.amountTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 450, totalBoxY + 40, { width: 100, align: 'right' });

			// === 5. PIE FISCAL (QR, CAE Y VENCIMIENTO REGLAMENTARIO DE ARCA) ===
			const footerY = totalBoxY + 70;
			doc.rect(35, footerY, 525, 90).fillAndStroke('#f8fafc', '#1e293b');

			// Render QR Code
			doc.image(qrBuffer, 45, footerY + 8, { width: 74, height: 74 });

			// Logo y Leyenda ARCA / AFIP
			doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
			doc.text('ARCA', 130, footerY + 14);
			doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
			doc.text('Agencia de Recaudación y Control Aduanero', 130, footerY + 28);
			doc.text('Comprobante Autorizado Electrónicamente', 130, footerY + 39);
			doc.text('Esta administración no se responsabiliza por los datos ingresados en el comprobante.', 130, footerY + 50, { width: 220 });

			// Cuadro de CAE
			doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
			doc.text(`CAE N°: ${invoice.cae}`, 360, footerY + 20);
			const expDate = invoice.caeExpiration ? invoice.caeExpiration.toLocaleDateString('es-AR') : dateStr;
			doc.text(`Fecha de Vto. de CAE: ${expDate}`, 360, footerY + 38);

			doc.end();
		});
	}

	/**
	 * Obtiene el reporte analítico completo del Monotributo para los últimos 12 meses móviles.
	 */
	static async getMonotributoReport(models: TenantModels) {
		const config = await EcommerceService.getConfig(models);
		const declaredCategory = (config.fiscalProfile?.monotributoCategory as any) || 'C';

		const scales = MONOTRIBUTO_SCALES_COMERCIO;
		const declaredScale = scales.find(s => s.category === declaredCategory) || scales[2];
		const exclusionLimit = scales[scales.length - 1].annualLimit; // 68.000.000 (Cat K)

		// 1. Rango de los últimos 12 meses móviles (inicio de hace 11 meses hasta hoy)
		const now = new Date();
		const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

		// 2. Agregación de pedidos aprobados (ventas totales)
		const ordersAggregation = await models.Order.aggregate([
			{
				$match: {
					'paymentInfo.status': 'APPROVED',
					status: { $ne: 'CANCELLED' },
					createdAt: { $gte: startDate }
				}
			},
			{
				$group: {
					_id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
					totalBilled: { $sum: '$total' },
					ordersCount: { $sum: 1 }
				}
			}
		]);

		const ordersMap = new Map<string, { totalBilled: number; ordersCount: number }>();
		for (const row of ordersAggregation) {
			ordersMap.set(row._id, { totalBilled: row.totalBilled || 0, ordersCount: row.ordersCount || 0 });
		}

		// 3. Agregación de comprobantes oficiales con CAE
		const invoicesAggregation = await models.Invoice.aggregate([
			{
				$match: {
					status: 'APPROVED',
					createdAt: { $gte: startDate }
				}
			},
			{
				$group: {
					_id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
					totalInvoiced: { $sum: '$amountTotal' },
					invoicesCount: { $sum: 1 }
				}
			}
		]);

		const invoicesMap = new Map<string, { totalInvoiced: number; invoicesCount: number }>();
		for (const row of invoicesAggregation) {
			invoicesMap.set(row._id, { totalInvoiced: row.totalInvoiced || 0, invoicesCount: row.invoicesCount || 0 });
		}

		// 4. Generar secuencia mensual cronológica continua de 12 meses
		const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
		const monthlyBreakdown: Array<{
			monthKey: string;
			label: string;
			year: number;
			monthNumber: number;
			totalBilled: number;
			totalInvoiced: number;
			ordersCount: number;
			invoicesCount: number;
		}> = [];

		let systemBilledRolling12Months = 0;
		let totalInvoicedRolling12Months = 0;

		for (let i = 11; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			const year = d.getFullYear();
			const monthNumber = d.getMonth() + 1;
			const monthKey = `${year}-${monthNumber.toString().padStart(2, '0')}`;
			const label = `${monthNames[d.getMonth()]} ${year}`;

			const orderData = ordersMap.get(monthKey) || { totalBilled: 0, ordersCount: 0 };
			const invoiceData = invoicesMap.get(monthKey) || { totalInvoiced: 0, invoicesCount: 0 };

			systemBilledRolling12Months += orderData.totalBilled;
			totalInvoicedRolling12Months += invoiceData.totalInvoiced;

			monthlyBreakdown.push({
				monthKey,
				label,
				year,
				monthNumber,
				totalBilled: orderData.totalBilled,
				totalInvoiced: invoiceData.totalInvoiced,
				ordersCount: orderData.ordersCount,
				invoicesCount: invoiceData.invoicesCount
			});
		}

		const previousExternalBilling = Number(config.fiscalProfile?.previousExternalBilling) || 0;
		const totalBilledRolling12Months = systemBilledRolling12Months + previousExternalBilling;

		// 5. Categoría calculada según facturación acumulada
		let calculatedCategory = 'K';
		let isExceededMonotributo = false;
		const matchingScale = scales.find(s => s.annualLimit >= totalBilledRolling12Months);
		if (matchingScale) {
			calculatedCategory = matchingScale.category;
		} else {
			calculatedCategory = 'EXCLUIDO';
			isExceededMonotributo = true;
		}

		// 6. Márgenes y porcentajes consumidos
		const remainingForDeclaredCategory = Math.max(0, declaredScale.annualLimit - totalBilledRolling12Months);
		const percentDeclaredCategoryUsed = Math.min(100, Math.round((totalBilledRolling12Months / declaredScale.annualLimit) * 100));
		const remainingForExclusion = Math.max(0, exclusionLimit - totalBilledRolling12Months);
		const percentExclusionUsed = Math.min(100, Math.round((totalBilledRolling12Months / exclusionLimit) * 100));

		// 7. Estado del semáforo y diagnóstico en lenguaje amigable
		let healthStatus: 'ok' | 'warning' | 'danger' = 'ok';
		let statusMessage = 'Tu facturación se encuentra dentro de los parámetros de tu categoría declarada.';

		if (isExceededMonotributo) {
			healthStatus = 'danger';
			statusMessage = '¡ALERTA CRÍTICA! Superaste el tope máximo de Monotributo (Categoría K). Estás en riesgo inminente de exclusión de pleno derecho a Responsable Inscripto.';
		} else if (totalBilledRolling12Months > declaredScale.annualLimit) {
			healthStatus = 'danger';
			statusMessage = `Superaste el tope de tu Categoría ${declaredCategory}. En la próxima recategorización de ARCA deberás recategorizarte a Categoría ${calculatedCategory}.`;
		} else if (percentExclusionUsed >= 80) {
			healthStatus = 'warning';
			statusMessage = `Atención: Estás al ${percentExclusionUsed}% del límite máximo absoluto de Monotributo. Planificá tus ventas o consultá con tu contador.`;
		} else if (percentDeclaredCategoryUsed >= 80) {
			healthStatus = 'warning';
			statusMessage = `Estás al ${percentDeclaredCategoryUsed}% del tope de tu Categoría ${declaredCategory}. Te quedan $${remainingForDeclaredCategory.toLocaleString('es-AR')} de margen antes de subir a la siguiente categoría.`;
		}

		// 8. Próxima ventana de recategorización (Enero o Julio)
		const currentMonth = now.getMonth() + 1; // 1 to 12
		let nextRecatDate: Date;
		let nextRecatLabel = '';

		if (currentMonth <= 1) {
			nextRecatDate = new Date(now.getFullYear(), 0, 20); // 20 Ene actual
			nextRecatLabel = `Enero ${now.getFullYear()}`;
		} else if (currentMonth <= 7) {
			nextRecatDate = new Date(now.getFullYear(), 6, 20); // 20 Jul actual
			nextRecatLabel = `Julio ${now.getFullYear()}`;
		} else {
			nextRecatDate = new Date(now.getFullYear() + 1, 0, 20); // 20 Ene próximo año
			nextRecatLabel = `Enero ${now.getFullYear() + 1}`;
		}

		const diffTime = nextRecatDate.getTime() - now.getTime();
		const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

		return {
			success: true,
			declaredCategory,
			declaredScale,
			calculatedCategory,
			isExceededMonotributo,
			previousExternalBilling,
			systemBilledRolling12Months,
			totalBilledRolling12Months,
			totalInvoicedRolling12Months,
			remainingForDeclaredCategory,
			percentDeclaredCategoryUsed,
			exclusionLimit,
			remainingForExclusion,
			percentExclusionUsed,
			estimatedMonthlyQuota: declaredScale.monthlyQuota,
			nextRecategorization: {
				window: nextRecatLabel,
				daysRemaining,
				dueDate: nextRecatDate.toISOString().split('T')[0],
				description: 'Período oficial de recategorización semestral de ARCA / AFIP.'
			},
			healthStatus,
			statusMessage,
			monthlyBreakdown,
			scales
		};
	}
}

export interface IMonotributoCategoryScale {
	category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K';
	annualLimit: number;
	monthlyQuota: number;
	taxOnlyQuota: number;
}

export const MONOTRIBUTO_SCALES_COMERCIO: IMonotributoCategoryScale[] = [
	{ category: 'A', annualLimit: 6450000, monthlyQuota: 26600, taxOnlyQuota: 3000 },
	{ category: 'B', annualLimit: 9450000, monthlyQuota: 30280, taxOnlyQuota: 5700 },
	{ category: 'C', annualLimit: 13250000, monthlyQuota: 35458, taxOnlyQuota: 9800 },
	{ category: 'D', annualLimit: 16450000, monthlyQuota: 45443, taxOnlyQuota: 16000 },
	{ category: 'E', annualLimit: 19350000, monthlyQuota: 58348, taxOnlyQuota: 24000 },
	{ category: 'F', annualLimit: 24250000, monthlyQuota: 69808, taxOnlyQuota: 33000 },
	{ category: 'G', annualLimit: 29000000, monthlyQuota: 85296, taxOnlyQuota: 43000 },
	{ category: 'H', annualLimit: 44000000, monthlyQuota: 170738, taxOnlyQuota: 110000 },
	{ category: 'I', annualLimit: 49250000, monthlyQuota: 255108, taxOnlyQuota: 175000 },
	{ category: 'J', annualLimit: 56400000, monthlyQuota: 311931, taxOnlyQuota: 210000 },
	{ category: 'K', annualLimit: 68000000, monthlyQuota: 377084, taxOnlyQuota: 245000 }
];

