import { Request } from 'express';

export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'bot';

export interface IVisitorInfo {
	device: DeviceType;
	browser: string;
	os: string;
	ip: string;
	referrer: string;
	fullUrl: string;
	isBot: boolean;
	botName?: string;
	userAgent?: string;
	rejectionReason?: string;
}

const KNOWN_BOTS: { pattern: RegExp; name: string }[] = [
	{ pattern: /Google-InspectionTool/i, name: 'Google Inspection Tool' },
	{ pattern: /AdsBot-Google/i, name: 'Google AdsBot' },
	{ pattern: /Mediapartners-Google/i, name: 'Google AdSense' },
	{ pattern: /Googlebot/i, name: 'Googlebot' },
	{ pattern: /FeedFetcher-Google/i, name: 'Google Feedfetcher' },
	{ pattern: /bingbot/i, name: 'Bingbot' },
	{ pattern: /BingPreview/i, name: 'Bing Preview' },
	{ pattern: /msnbot/i, name: 'MSN Bot' },
	{ pattern: /facebookexternalhit|facebot|meta-externalagent/i, name: 'Meta Crawler' },
	{ pattern: /WhatsApp/i, name: 'WhatsApp Preview' },
	{ pattern: /TelegramBot/i, name: 'Telegram Bot' },
	{ pattern: /Twitterbot/i, name: 'Twitter Bot' },
	{ pattern: /LinkedInBot/i, name: 'LinkedIn Bot' },
	{ pattern: /Discordbot/i, name: 'Discord Bot' },
	{ pattern: /Slackbot/i, name: 'Slack Bot' },
	{ pattern: /AhrefsBot/i, name: 'Ahrefs Bot' },
	{ pattern: /SemrushBot/i, name: 'Semrush Bot' },
	{ pattern: /DotBot/i, name: 'DotBot' },
	{ pattern: /MJ12bot/i, name: 'Majestic 12 Bot' },
	{ pattern: /PetalBot/i, name: 'PetalBot (Huawei)' },
	{ pattern: /Bytespider/i, name: 'ByteDance (TikTok) Spider' },
	{ pattern: /YandexBot/i, name: 'Yandex Bot' },
	{ pattern: /Baiduspider/i, name: 'Baidu Spider' },
	{ pattern: /DuckDuckBot/i, name: 'DuckDuckGo Bot' },
	{ pattern: /Lighthouse|Google-PageSpeed/i, name: 'Google Lighthouse / PageSpeed' },
	{ pattern: /HeadlessChrome/i, name: 'Headless Chrome' },
	{ pattern: /PhantomJS|Selenium|Puppeteer|Playwright/i, name: 'Automated Headless Browser' },
	{ pattern: /node-fetch|undici|axios|curl|wget|python-requests|aiohttp|httpx|postmanruntime/i, name: 'Automated Script / Fetch' },
	{ pattern: /bot|crawler|spider|scraper|archiver/i, name: 'Generic Crawler / Bot' },
];

/**
 * Detecta si el User-Agent corresponde a un bot, crawler, araña de búsqueda o script
 */
export function detectBot(userAgent: string): { isBot: boolean; botName?: string } {
	if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
		return { isBot: true, botName: 'Empty User-Agent (Suspicious)' };
	}

	const trimmed = userAgent.trim();

	// Si el User-Agent es un runtime de node interno o SSR
	if (/^node|^undici|^axios/i.test(trimmed)) {
		return { isBot: true, botName: 'Internal Server / SSR' };
	}

	for (const { pattern, name } of KNOWN_BOTS) {
		if (pattern.test(trimmed)) {
			return { isBot: true, botName: name };
		}
	}

	return { isBot: false };
}

/**
 * Clasifica el dispositivo del usuario
 */
export function detectDeviceType(userAgent: string, isBot: boolean): DeviceType {
	if (isBot) return 'bot';
	if (!userAgent) return 'desktop';

	const ua = userAgent.toLowerCase();

	// Tablets
	if (/ipad|tablet|(android(?!.*mobile))|playbook|silk/i.test(ua)) {
		return 'tablet';
	}

	// Mobile phones
	if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
		return 'mobile';
	}

	return 'desktop';
}

/**
 * Identifica el navegador principal o WebView de app social
 */
export function detectBrowser(userAgent: string, isBot: boolean, botName?: string): string {
	if (isBot) return botName || 'Bot';
	if (!userAgent) return 'Desconocido';

	if (/Instagram/i.test(userAgent)) return 'Instagram App';
	if (/FBAV|FBAN/i.test(userAgent)) return 'Facebook App';
	if (/WhatsApp/i.test(userAgent)) return 'WhatsApp Web/App';
	if (/TikTok/i.test(userAgent)) return 'TikTok App';
	if (/Edg\//i.test(userAgent)) return 'Microsoft Edge';
	if (/OPR\/|Opera/i.test(userAgent)) return 'Opera';
	if (/Chrome\/|CriOS\//i.test(userAgent)) return 'Chrome';
	if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari';
	if (/Firefox\/|FxiOS\//i.test(userAgent)) return 'Firefox';

	return 'Navegador Web';
}

/**
 * Identifica el sistema operativo
 */
export function detectOS(userAgent: string): string {
	if (!userAgent) return 'Desconocido';

	if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
	if (/Android/i.test(userAgent)) return 'Android';
	if (/Windows NT 10.0/i.test(userAgent)) return 'Windows 10/11';
	if (/Windows NT/i.test(userAgent)) return 'Windows';
	if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
	if (/Linux/i.test(userAgent)) return 'Linux';

	return 'Otro';
}

/**
 * Extrae toda la información analítica de un visitante a partir de la Request de Express
 */
export function extractVisitorInfo(req: Request, fallbackSlug?: string): IVisitorInfo {
	const headers = req.headers || {};
	const userAgent = (headers['user-agent'] as string) || '';

	const { isBot, botName } = detectBot(userAgent);
	const device = detectDeviceType(userAgent, isBot);
	const browser = detectBrowser(userAgent, isBot, botName);
	const os = detectOS(userAgent);

	// IP Real (Cloudflare Tunnel friendly)
	const cfIp = headers['cf-connecting-ip'] as string;
	const realIp = headers['x-real-ip'] as string;
	const xff = headers['x-forwarded-for'] as string;
	const ip = (cfIp || realIp || (xff ? xff.split(',')[0].trim() : req.ip) || '0.0.0.0').trim();

	// Referrer (origen del visitante)
	const clientReferrer = (req.query && req.query['referrer']) ? String(req.query['referrer']) : '';
	const headerReferrer = (headers['referer'] as string) || '';
	const referrer = clientReferrer || headerReferrer || 'Directo / Ninguno';

	// URL Completa (incluyendo query parameters como utm_source, fbclid, etc.)
	const clientSourceUrl = (req.query && req.query['source_url']) ? String(req.query['source_url']) : '';
	let fullUrl = clientSourceUrl;

	if (!fullUrl) {
		const host = (headers['x-forwarded-host'] as string) || headers.host || 'vura.com.ar';
		const protocol = (headers['x-forwarded-proto'] as string) || (req.protocol || 'https');
		const path = req.originalUrl || req.url || (fallbackSlug ? `/products/${fallbackSlug}` : '/');
		
		// Si es una llamada directa a la API `/api/products/slug`, transformarla a la URL real de la tienda web
		if (path.startsWith('/api/products/') && fallbackSlug) {
			const queryIndex = path.indexOf('?');
			const queryPart = queryIndex !== -1 ? path.substring(queryIndex) : '';
			fullUrl = `https://${host.replace('api.', '')}/products/${fallbackSlug}${queryPart}`;
		} else {
			fullUrl = `${protocol}://${host}${path}`;
		}
	}

	const rejectionReason = isBot
		? `Detectado como bot/crawler (${botName || 'Bot'}). No sumó puntos al ranking ELO.`
		: undefined;

	return {
		device,
		browser,
		os,
		ip,
		referrer,
		fullUrl,
		isBot,
		botName,
		userAgent,
		rejectionReason,
	};
}
