import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection, TenantModels } from '@/config/modelRegistry';
import { Role } from '@/interfaces/user.interface';

export interface IPushNotificationPayload {
	tenantSlug?: string;
	models?: TenantModels;
	title: string;
	body: string;
	channelId?: 'store_orders' | 'store_alerts';
	data?: Record<string, any>;
}

export class PushNotificationService {
	/**
	 * Envía una notificación push a todos los administradores (y dispositivos autorizados)
	 * del tenant a través de la API oficial de Expo Push.
	 */
	static async sendAdminPushNotification(payload: IPushNotificationPayload): Promise<void> {
		try {
			const { tenantSlug, title, body, channelId = 'store_orders', data = {} } = payload;

			let models = payload.models;
			if (!models && tenantSlug) {
				try {
					const tenant = await connectionManager.getTenantBySlug(tenantSlug);
					if (tenant?.dbName) {
						const tenantDb = connectionManager.getTenantDb(tenant.dbName);
						models = getModelsForConnection(tenantDb);
					}
				} catch (connErr) {
					console.warn(`[PushNotification] No se pudo obtener conexión para tenant '${tenantSlug}':`, connErr);
					return;
				}
			}

			if (!models) {
				console.warn(`⚠️ [Notificación Push Android] Faltan models o tenantSlug ('${tenantSlug}') para resolver destinatarios`);
				return;
			}

			// Buscar admins activos que tengan pushTokens registrados
			const admins = await models.User.find({
				role: { $in: [Role.admin, Role.employee] },
				isActive: true,
				pushTokens: { $exists: true, $ne: [] }
			})
				.select('name lastName email pushTokens role')
				.lean();

			if (!admins || admins.length === 0) {
				console.log(`⚠️ [Notificación Push Android] [Tenant: ${tenantSlug || 'resolved'}] Notificación NO enviada a celulares: No hay administradores ni cajeros con pushToken registrado en el dispositivo.`);
				console.log(`ℹ️ [Notificación Push Android] Para recibir notificaciones en Android, iniciá sesión en la app móvil y confirmá que se llame a POST /api/users/push-token.`);
				return;
			}

			// Aplanar y deduplicar tokens válidos
			const tokens: string[] = [];
			const adminSummaries: string[] = [];

			admins.forEach((admin: any) => {
				const adminName = `${admin.name || ''} ${admin.lastName || ''}`.trim() || admin.email || 'Admin';
				const adminTokens: string[] = [];

				if (Array.isArray(admin.pushTokens)) {
					admin.pushTokens.forEach((token: string) => {
						if (typeof token === 'string') {
							const trimmed = token.trim();
							if (trimmed.startsWith('ExponentPushToken[') || trimmed.startsWith('ExpoPushToken[')) {
								tokens.push(trimmed);
								adminTokens.push(trimmed);
							}
						}
					});
				}

				if (adminTokens.length > 0) {
					adminSummaries.push(`"${adminName}" (${admin.email}, rol: ${admin.role}) [${adminTokens.length} dispositivo(s)]`);
				}
			});

			const uniqueTokens = [...new Set(tokens)];
			if (uniqueTokens.length === 0) {
				console.log(`⚠️ [Notificación Push Android] [Tenant: ${tenantSlug || 'resolved'}] Se encontraron admins pero ninguno tiene un formato de token válido (ExponentPushToken[...]).`);
				return;
			}

			console.log(`📱 [Notificación Push Android] 🚀 Despachando notificación a ${adminSummaries.length} admin(s) / ${uniqueTokens.length} dispositivo(s) móvil(es):`);
			adminSummaries.forEach(s => console.log(`   └─ Destinatario: ${s}`));
			console.log(`   └─ Contenido: "${title}" | "${body}" | Canal: ${channelId}`);

			// Expo Push API permite un máximo de 100 mensajes por lote
			const CHUNK_SIZE = 100;
			for (let i = 0; i < uniqueTokens.length; i += CHUNK_SIZE) {
				const chunk = uniqueTokens.slice(i, i + CHUNK_SIZE);
				const messages = chunk.map((to) => ({
					to,
					title,
					body,
					sound: 'default',
					priority: 'high',
					channelId,
					data
				}));

				const response = await fetch('https://exp.host/--/api/v2/push/send', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json'
					},
					body: JSON.stringify(messages)
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`❌ [Notificación Push Android] Error HTTP de Expo Push API (${response.status}):`, errorText);
				} else {
					const result = await response.json().catch(() => null);
					console.log(`📱 [Notificación Push Android] ✅ Notificación enviada con éxito a ${chunk.length} dispositivo(s) móvil(es) (Tenant: ${tenantSlug || 'resolved'}).`);
					if (result?.data && Array.isArray(result.data)) {
						result.data.forEach((ticket: any, idx: number) => {
							if (ticket.status === 'error') {
								console.error(`   ⚠️ Dispositivo #${idx + 1} (${chunk[idx]?.slice(0, 25)}...): Error -> ${ticket.message} (${ticket.details?.error})`);
							} else {
								console.log(`   ✅ Dispositivo #${idx + 1} (${chunk[idx]?.slice(0, 25)}...): Ticket OK (ID: ${ticket.id})`);
							}
						});
					}
				}
			}
		} catch (error) {
			console.error('❌ [Notificación Push Android] Error inesperado enviando notificación push:', error);
		}
	}
}

