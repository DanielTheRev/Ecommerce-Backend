import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const customerAuthSettingsSchema = z.object({
	enableGoogleSignInOption: z.boolean().default(true),
	enableMagicCodeOption: z.boolean().default(true),
	enableEmailPasswordOption: z.boolean().default(true),
	defaultAuthMethod: z.enum(['google', 'magic_code', 'password']).default('google'),
	showGoogleClientIdInput: z.boolean().default(true)
});

export const customerAuthAddon: AddonModule = {
	manifest: {
		id: 'customer_auth',
		aliases: ['auth_config', 'storefront_auth', 'google_auth'],
		name: 'Autenticación de Clientes & Google Sign-In',
		shortDescription:
			'Unifica en una sola pestaña los métodos de acceso web (Google Sign-In + Client ID, Código Único por Email, Email/Contraseña) y el método principal a renderizar.',
		category: 'web_storefront',
		icon: 'passkey',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasCustomerAuthConfig'],
		requiresSetup: false,
		settingsRoute: '/settings/auth',
		settingsSchema: customerAuthSettingsSchema,
		configurableLabels: [
			{
				key: 'customerAuthTitle',
				label: 'Título de Autenticación de Clientes',
				description: 'Encabezado de la pestaña unificada de Login Web y Google Sign-In.',
				defaultValue: 'Autenticación de Clientes & Acceso Web',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableGoogleSignInOption',
				label: 'Habilitar inicio de sesión con Google (One-Tap / OAuth)',
				description: 'Activa Google Sign-In y muestra en esta misma pestaña el campo para pegar el Google Client ID (integrations.googleAuth.clientId).',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableMagicCodeOption',
				label: 'Habilitar inicio de sesión con Código Único (Magic Code)',
				description: 'Permite al comprador ingresar con un código de 6 dígitos enviado por correo sin recordar contraseña.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableEmailPasswordOption',
				label: 'Habilitar inicio de sesión con Email y Contraseña',
				description: 'Permite el registro e ingreso clásico con correo y clave.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'defaultAuthMethod',
				label: 'Método de autenticación renderizado por defecto',
				description: 'Define qué opción aparece seleccionada primero en el login de la tienda (google | magic_code | password).',
				type: 'string',
				defaultValue: 'google'
			},
			{
				key: 'showGoogleClientIdInput',
				label: 'Mostrar configuración de Google Client ID en la misma pantalla',
				description: 'Unifica la credencial de Google OAuth dentro de la pestaña de Autenticación sin requerir otra pestaña de Integraciones.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['checkout'],
			adminScreens: ['settings/auth'],
			storefrontBlocks: ['customer_login_modal', 'google_one_tap']
		}
	}
};
