import crypto from 'crypto';
import dotenv from 'dotenv';
import { ParamBuilder, PII_DATA_TYPE, CookieSettings } from 'capi-param-builder-nodejs';
import {
  IMetaEvent,
  IMetaEventPayload,
  IMetaUserData,
  ITrackEventInput,
  MetaStandardEventName,
} from '@/interfaces/meta.interface';

dotenv.config();

export class MetaService {
  /**
   * Meta official ParamBuilder instance for PII normalization and hashing
   */
  private static paramBuilder = new ParamBuilder();

  /**
   * Environment variable names used:
   * - META_ACCESS_TOKEN: Access token for Graph API (Conversions API)
   * - META_PIXEL_ID: Pixel / Dataset ID in Meta Business Manager
   * - META_TEST_EVENT_CODE: (Optional) Test code for Meta Event Manager real-time debugging
   * - META_GRAPH_API_VERSION: (Optional) Graph API version (default: 'v19.0')
   */
  private static get accessToken(): string {
    return process.env.META_ACCESS_TOKEN || '';
  }

  private static get pixelId(): string {
    return process.env.META_PIXEL_ID || '';
  }

  private static get testEventCode(): string | undefined {
    // En producción (NODE_ENV=production), NUNCA enviar test_event_code para que Meta registre los eventos como REALES.
    if (process.env.NODE_ENV === 'production') {
      return undefined;
    }
    return process.env.META_TEST_EVENT_CODE || undefined;
  }

  private static get apiVersion(): string {
    return process.env.META_GRAPH_API_VERSION || 'v19.0';
  }

  /**
   * Hashes data with Meta's official normalizer and SHA-256 according to Meta Conversions API specifications.
   */
  public static hashData(value: string, dataType?: string): string {
    if (!value) return '';
    if (dataType) {
      try {
        const hashed = this.paramBuilder.getNormalizedAndHashedPII(value, dataType);
        if (hashed) return hashed;
      } catch (e) {
        // Fallback to manual sha256 below
      }
    }
    const cleanValue = value.trim().toLowerCase();
    return crypto.createHash('sha256').update(cleanValue).digest('hex');
  }

  /**
   * Normalizes and hashes phone numbers according to Meta specs (official ParamBuilder or digits only SHA-256).
   */
  public static hashPhone(phone: string): string {
    if (!phone) return '';
    try {
      const hashed = this.paramBuilder.getNormalizedAndHashedPII(phone, PII_DATA_TYPE.PHONE);
      if (hashed) return hashed;
    } catch (e) {
      // Fallback
    }
    const digitsOnly = phone.replace(/\D/g, '');
    return crypto.createHash('sha256').update(digitsOnly).digest('hex');
  }

  /**
   * Strictly validates fbc format according to Meta Conversions API specifications:
   * Format: fb.<subdomainIndex>.<creationTimeInMs>.<fbclid>[.<appendixToken>]
   */
  public static isValidFbc(val?: string | null): boolean {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return false;
    const parts = trimmed.split('.');
    if ((parts.length !== 4 && parts.length !== 5) || parts[0] !== 'fb') return false;
    if (!/^\d+$/.test(parts[1])) return false;
    if (!/^\d{10,15}$/.test(parts[2])) return false;
    const clickId = parts[3];
    if (!clickId || clickId === 'undefined' || clickId === 'null' || /\s/.test(clickId)) return false;
    return true;
  }

  /**
   * Strictly validates fbp format according to Meta Conversions API specifications:
   * Format: fb.<subdomainIndex>.<creationTimeInMs>.<random>[.<appendixToken>]
   */
  public static isValidFbp(val?: string | null): boolean {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return false;
    const parts = trimmed.split('.');
    if ((parts.length !== 4 && parts.length !== 5) || parts[0] !== 'fb') return false;
    if (!/^\d+$/.test(parts[1])) return false;
    if (!/^\d{10,15}$/.test(parts[2])) return false;
    if (!/^\d+$/.test(parts[3])) return false;
    return true;
  }

  /**
   * Formats raw user details into Meta's required IMetaUserData schema with official Meta SDK normalization & hashing.
   */
  public static prepareUserData(rawUserData: ITrackEventInput['userData']): IMetaUserData {
    if (!rawUserData) return {};

    const userData: IMetaUserData = {};

    if (rawUserData.email) {
      userData.em = this.hashData(rawUserData.email, PII_DATA_TYPE.EMAIL);
    }
    if (rawUserData.phone) {
      userData.ph = this.hashPhone(rawUserData.phone);
    }
    if (rawUserData.firstName) {
      userData.fn = this.hashData(rawUserData.firstName, PII_DATA_TYPE.FIRST_NAME);
    }
    if (rawUserData.lastName) {
      userData.ln = this.hashData(rawUserData.lastName, PII_DATA_TYPE.LAST_NAME);
    }
    if (rawUserData.city) {
      userData.ct = this.hashData(rawUserData.city, PII_DATA_TYPE.CITY);
    }
    if (rawUserData.state) {
      userData.st = this.hashData(rawUserData.state, PII_DATA_TYPE.STATE);
    }
    if (rawUserData.zip) {
      userData.zp = this.hashData(rawUserData.zip, PII_DATA_TYPE.ZIP_CODE);
    }
    if (rawUserData.country) {
      userData.country = this.hashData(rawUserData.country, PII_DATA_TYPE.COUNTRY);
    }
    if (rawUserData.externalId) {
      userData.external_id = Array.isArray(rawUserData.externalId)
        ? rawUserData.externalId.map((id) => this.hashData(id, PII_DATA_TYPE.EXTERNAL_ID))
        : this.hashData(rawUserData.externalId, PII_DATA_TYPE.EXTERNAL_ID);
    }

    // Unhashed fields (Meta requires these unhashed, only when valid)
    if (rawUserData.clientIp) userData.client_ip_address = rawUserData.clientIp;
    if (rawUserData.clientUserAgent) userData.client_user_agent = rawUserData.clientUserAgent;
    if (rawUserData.fbc && this.isValidFbc(rawUserData.fbc)) {
      userData.fbc = rawUserData.fbc.trim();
    }
    if (rawUserData.fbp && this.isValidFbp(rawUserData.fbp)) {
      userData.fbp = rawUserData.fbp.trim();
    }

    return userData;
  }

  /**
   * Helper to extract Meta UserData (IP, UserAgent, fbc, fbp, externalId) directly from Express Request
   * using Meta's official capi-param-builder-nodejs SDK.
   */
  public static extractUserDataFromReq(req: any): ITrackEventInput['userData'] {
    if (!req) return {};

    // 1. IP extraction (Cloudflare Tunnel / reverse proxy friendly)
    const headers = req.headers || {};
    const cfIp = headers['cf-connecting-ip'];
    const realIp = headers['x-real-ip'];

    // If Cloudflare or reverse proxy provides real IP, ensure it's at the start of x-forwarded-for
    // so ParamBuilder picks it up accurately
    const priorityIp = (cfIp && typeof cfIp === 'string') ? cfIp.trim() : ((realIp && typeof realIp === 'string') ? realIp.trim() : undefined);
    if (priorityIp) {
      const existingXff = headers['x-forwarded-for'];
      if (!existingXff || !existingXff.includes(priorityIp)) {
        headers['x-forwarded-for'] = existingXff ? `${priorityIp}, ${existingXff}` : priorityIp;
      }
    }

    // In Express 5, req.query is a read-only getter on IncomingMessage, so mutating req.query directly throws:
    // "TypeError: Cannot set property query of #<IncomingMessage> which has only a getter"
    // We create safe shallow copies of cookies and query inheriting from Object.prototype and wrap the context safely for ParamBuilder.
    const safeCookies = (req.cookies && typeof req.cookies === 'object') ? Object.assign({}, req.cookies) : {};
    const safeQuery = (req.query && typeof req.query === 'object') ? Object.assign({}, req.query) : {};

    const reqContext = {
      ...req,
      headers,
      cookies: safeCookies,
      query: safeQuery,
      socket: req.socket,
      protocol: req.protocol,
      originalUrl: req.originalUrl || req.url,
      get: typeof req.get === 'function' ? req.get.bind(req) : (headerName: string) => headers[headerName.toLowerCase()],
    };

    // 2. Process with Meta's official ParamBuilder
    const builder = new ParamBuilder();
    let cookiesToSet: CookieSettings[] = [];
    try {
      cookiesToSet = builder.processRequestFromContext(reqContext) || [];
    } catch (err) {
      console.warn('[MetaService] ParamBuilder.processRequestFromContext warning:', err);
    }

    let fbc = builder.getFbc() || undefined;
    let fbp = builder.getFbp() || undefined;
    let clientIp = builder.getClientIpAddress() || undefined;
    const referrerUrl = builder.getReferrerUrl() || (typeof req.get === 'function' ? req.get('referer') : headers['referer']) || undefined;
    const eventSourceUrl = builder.getEventSourceUrl() || undefined;

    // 3. Fallbacks for fbc & fbp if not captured by ParamBuilder (headers/query/cookies)
    const cookies = safeCookies;
    if (!fbc) {
      const rawFbcHeader = headers['x-fbc'];
      const rawFbcQuery = safeQuery['fbc'];
      const rawFbc = cookies['_fbc'] || (Array.isArray(rawFbcHeader) ? rawFbcHeader[0] : rawFbcHeader) || (Array.isArray(rawFbcQuery) ? rawFbcQuery[0] : rawFbcQuery);
      if (typeof rawFbc === 'string' && rawFbc.trim() && this.isValidFbc(rawFbc)) {
        fbc = rawFbc.trim();
      }
    }

    if (!fbp) {
      const rawFbpHeader = headers['x-fbp'];
      const rawFbpQuery = safeQuery['fbp'];
      const rawFbp = cookies['_fbp'] || (Array.isArray(rawFbpHeader) ? rawFbpHeader[0] : rawFbpHeader) || (Array.isArray(rawFbpQuery) ? rawFbpQuery[0] : rawFbpQuery);
      if (typeof rawFbp === 'string' && rawFbp.trim() && this.isValidFbp(rawFbp)) {
        fbp = rawFbp.trim();
      }
    }

    // 4. Fallback for client IP if ParamBuilder did not resolve public IP
    if (!clientIp) {
      let rawIp = priorityIp;
      if (!rawIp && headers['x-forwarded-for']) {
        const forwarded = headers['x-forwarded-for'];
        const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
        if (ips.length > 0 && ips[0].trim()) rawIp = ips[0].trim();
      }
      if (!rawIp) {
        rawIp = req.ip || req.socket?.remoteAddress;
      }
      if (rawIp && rawIp.startsWith('::ffff:')) {
        rawIp = rawIp.replace('::ffff:', '');
      }
      if (rawIp && (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === 'localhost' || rawIp.startsWith('192.168.') || rawIp.startsWith('10.'))) {
        clientIp = undefined;
      } else {
        clientIp = rawIp;
      }
    }

    // 5. User Agent
    const clientUserAgent = req.get ? req.get('user-agent') : headers['user-agent'];

    // 6. Auth User External ID, Email, Name, Phone
    const user = req.user;
    const externalId = (headers['x-external-id'] && typeof headers['x-external-id'] === 'string')
      ? headers['x-external-id']
      : (user ? (user._id ? user._id.toString() : user.toString()) : undefined);

    const email = (headers['x-user-email'] && typeof headers['x-user-email'] === 'string')
      ? headers['x-user-email']
      : user?.email;

    const firstName = (headers['x-user-fn'] && typeof headers['x-user-fn'] === 'string')
      ? headers['x-user-fn']
      : (user?.firstName || (user?.name ? user.name.split(' ')[0] : undefined));

    const lastName = (headers['x-user-ln'] && typeof headers['x-user-ln'] === 'string')
      ? headers['x-user-ln']
      : (user?.lastName || (user?.name ? user.name.split(' ').slice(1).join(' ') : undefined));

    const phone = (headers['x-user-phone'] && typeof headers['x-user-phone'] === 'string')
      ? headers['x-user-phone']
      : user?.phone;

    return {
      clientIp,
      clientUserAgent,
      fbc,
      fbp,
      externalId,
      email,
      firstName,
      lastName,
      phone,
      referrerUrl,
      eventSourceUrl,
      cookiesToSet,
    };
  }

  /**
   * Helper to set first-party cookies recommended by Meta ParamBuilder on Express response
   */
  public static applyCookiesToRes(res: any, cookies: CookieSettings[]): void {
    if (!res || !res.cookie || !Array.isArray(cookies) || cookies.length === 0) return;
    for (const c of cookies) {
      try {
        res.cookie(c.name, c.value, {
          maxAge: c.maxAge * 1000,
          domain: c.domain || undefined,
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      } catch (err) {
        console.warn(`[MetaService] Could not set cookie ${c.name}:`, err);
      }
    }
  }

  /**
   * Extract User Data from Order document
   */
  public static extractUserDataFromOrder(
    order: any,
    reqIp?: string,
    reqUserAgent?: string
  ): ITrackEventInput['userData'] {
    if (!order) return {};
    const buyer = order.buyerData || {};
    const addr = order.shippingInfo?.shippingAddress || {};
    const tracking = order.metaTracking || {};

    return {
      email: buyer.email,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      phone: addr.phone,
      city: addr.city,
      state: addr.state,
      zip: addr.zipCode,
      country: 'AR',
      externalId: tracking.externalId || (order.user ? (order.user._id ? order.user._id.toString() : order.user.toString()) : undefined),
      clientIp: tracking.clientIp || reqIp,
      clientUserAgent: tracking.clientUserAgent || reqUserAgent,
      fbc: tracking.fbc,
      fbp: tracking.fbp,
    };
  }

  /**
   * Extract contents items from Order document
   */
  public static extractContentsFromOrder(order: any) {
    if (!order || !order.items || !Array.isArray(order.items)) return [];

    return order.items.map((item: any) => {
      const prod = item.productSnapshot || {};
      const prodId = prod._id ? prod._id.toString() : (item.variantSnapshot?.sku || 'item');
      const title = prod.model || prod.brand || 'Producto';

      return {
        id: prodId,
        quantity: item.quantity || 1,
        item_price: item.price || 0,
        title,
      };
    });
  }

  /**
   * Sends raw array of events to Meta Conversions API
   */
  public static async sendEvents(
    events: IMetaEvent[],
    customAccessToken?: string,
    customPixelId?: string,
    customTestEventCode?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const token = customAccessToken || this.accessToken;
    const pixel = customPixelId || this.pixelId;
    const testCode = customTestEventCode || this.testEventCode;

    if (!token) {
      console.warn('[MetaService] Warning: META_ACCESS_TOKEN is missing. Meta event not sent.');
      return { success: false, error: 'META_ACCESS_TOKEN missing' };
    }

    if (!pixel) {
      console.warn('[MetaService] Warning: META_PIXEL_ID is missing. Meta event not sent.');
      return { success: false, error: 'META_PIXEL_ID missing' };
    }

    // 🛡️ REGLA ABSOLUTA: Bloquear CAPI si estamos en desarrollo o si el evento proviene de localhost
    // El testCode de la DB NO debe puentear esta seguridad en local para no manchar el historial.
    const isLocalhostEvent = events.some(e => {
      const url = (e.event_source_url || '').toLowerCase();
      const ip = (e.user_data?.client_ip_address || '').trim();
      const isLocalUrl = !url || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0') || url.includes(':4200') || url.includes(':3000') || url.includes(':5173') || url.includes(':4000');
      const isLocalIp = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.');
      return isLocalUrl || isLocalIp;
    });

    const isForceDevEnabled = process.env.META_FORCE_LOCAL_TEST === 'true';

    if ((process.env.NODE_ENV !== 'production' || isLocalhostEvent) && !isForceDevEnabled) {
      console.log(`[MetaService] 🛡️ Evento bloqueado (origen local o entorno dev: ${isLocalhostEvent ? 'URL local detectada' : 'NODE_ENV dev'}). NO se envía a Meta.`);
      return { success: true, data: 'Skipped local/dev event' };
    }

    const payload: IMetaEventPayload = {
      data: events,
    };

    if (testCode) {
      payload.test_event_code = testCode;
    }

    const eventSummary = events.map((e) => ({
      evento: e.event_name,
      eventId: e.event_id || 'sin_id',
      modo: testCode ? `🧪 Test (${testCode})` : '🚀 Producción',
      url: e.event_source_url,
      datos: e.custom_data,
      usuario: {
        tieneEmail: !!e.user_data?.em,
        tieneTelefono: !!e.user_data?.ph,
        tieneNombre: !!e.user_data?.fn,
        ip: e.user_data?.client_ip_address,
        fbc: e.user_data?.fbc,
        fbp: e.user_data?.fbp,
        agente: e.user_data?.client_user_agent
          ? e.user_data.client_user_agent.substring(0, 35) + '...'
          : undefined,
      },
    }));

    console.log(
      `[Meta CAPI] 📡 Enviando ${events.length} evento(s) a Meta (${
        testCode ? `MODO PRUEBA: ${testCode}` : 'PRODUCCIÓN'
      }):`,
      JSON.stringify(eventSummary, null, 2)
    );

    const endpoint = `https://graph.facebook.com/${this.apiVersion}/${pixel}/events?access_token=${token}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[Meta CAPI] ❌ Error response from Meta CAPI:', responseData);
        return { success: false, error: JSON.stringify(responseData) };
      }

      console.log(
        `[Meta CAPI] ✅ Éxito: Meta procesó ${
          responseData.events_received || events.length
        } evento(s) [${events.map((e) => e.event_name).join(', ')}] | Trace ID: ${
          responseData.fbtrace_id
        }`
      );
      return { success: true, data: responseData };
    } catch (error: any) {
      console.error('[Meta CAPI] ❌ Error de red al enviar a Meta CAPI:', error?.message || error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Tracks a general event with normalized input.
   */
  public static async trackEvent(
    input: ITrackEventInput,
    customAccessToken?: string,
    customPixelId?: string,
    customTestEventCode?: string
  ) {
    const event: IMetaEvent = {
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      event_source_url: input.eventSourceUrl || input.userData?.eventSourceUrl,
      referrer_url: input.referrerUrl || input.userData?.referrerUrl,
      action_source: 'website',
      user_data: this.prepareUserData(input.userData),
      custom_data: input.customData,
    };

    return this.sendEvents([event], customAccessToken, customPixelId, customTestEventCode);
  }

  /**
   * Track Purchase Event
   */
  public static async trackPurchase(
    params: {
      orderId: string;
      value: number;
      currency?: string;
      contentType?: 'product' | 'product_group';
      contents?: Array<{ id: string; quantity: number; item_price?: number; title?: string }>;
      userData?: ITrackEventInput['userData'];
      eventSourceUrl?: string;
      eventId?: string;
    },
    customAccessToken?: string,
    customPixelId?: string,
    customTestEventCode?: string
  ) {
    return this.trackEvent(
      {
        eventName: 'Purchase',
        eventId: params.eventId || `purchase_${params.orderId}`,
        eventSourceUrl: params.eventSourceUrl,
        userData: params.userData,
        customData: {
          currency: params.currency || 'ARS',
          value: params.value,
          order_id: params.orderId,
          content_type: params.contentType || 'product',
          content_ids: params.contents?.map((c) => c.id) || [],
          contents: params.contents,
          num_items: params.contents?.reduce((sum, item) => sum + item.quantity, 0),
        },
      },
      customAccessToken,
      customPixelId,
      customTestEventCode
    );
  }

  /**
   * Track AddToCart Event
   */
  public static async trackAddToCart(
    params: {
      productId: string;
      productName?: string;
      value?: number;
      currency?: string;
      contentType?: 'product' | 'product_group';
      quantity?: number;
      userData?: ITrackEventInput['userData'];
      eventSourceUrl?: string;
      eventId?: string;
    },
    customAccessToken?: string,
    customPixelId?: string
  ) {
    const qty = params.quantity || 1;
    return this.trackEvent(
      {
        eventName: 'AddToCart',
        eventId: params.eventId,
        eventSourceUrl: params.eventSourceUrl,
        userData: params.userData,
        customData: {
          currency: params.currency || 'ARS',
          value: params.value,
          content_name: params.productName,
          content_type: params.contentType || 'product',
          content_ids: [params.productId],
          contents: [{ id: params.productId, quantity: qty, item_price: params.value }],
        },
      },
      customAccessToken,
      customPixelId
    );
  }

  /**
   * Track ViewContent Event
   */
  public static async trackViewContent(
    params: {
      productId: string;
      productName?: string;
      category?: string;
      value?: number;
      currency?: string;
      contentType?: 'product' | 'product_group';
      userData?: ITrackEventInput['userData'];
      eventSourceUrl?: string;
      eventId?: string;
    },
    customAccessToken?: string,
    customPixelId?: string,
    customTestEventCode?: string
  ) {
    return this.trackEvent(
      {
        eventName: 'ViewContent',
        eventId: params.eventId || (params.productId ? `vc_${params.productId}` : undefined),
        eventSourceUrl: params.eventSourceUrl,
        userData: params.userData,
        customData: {
          currency: params.currency || 'ARS',
          value: params.value,
          content_name: params.productName,
          content_category: params.category,
          content_type: params.contentType || 'product',
          content_ids: [params.productId],
        },
      },
      customAccessToken,
      customPixelId,
      customTestEventCode
    );
  }

  /**
   * Track InitiateCheckout Event
   */
  public static async trackInitiateCheckout(
    params: {
      value?: number;
      currency?: string;
      contentType?: 'product' | 'product_group';
      contents?: Array<{ id: string; quantity: number; item_price?: number }>;
      numItems?: number;
      userData?: ITrackEventInput['userData'];
      eventSourceUrl?: string;
      eventId?: string;
    },
    customAccessToken?: string,
    customPixelId?: string,
    customTestEventCode?: string
  ) {
    return this.trackEvent(
      {
        eventName: 'InitiateCheckout',
        eventId: params.eventId,
        eventSourceUrl: params.eventSourceUrl,
        userData: params.userData,
        customData: {
          currency: params.currency || 'ARS',
          value: params.value,
          content_type: params.contentType || 'product',
          content_ids: params.contents?.map((c) => c.id) || [],
          contents: params.contents,
          num_items: params.numItems || params.contents?.reduce((sum, item) => sum + item.quantity, 0),
        },
      },
      customAccessToken,
      customPixelId,
      customTestEventCode
    );
  }

  /**
   * Track InitiateCheckout directly from an Order document
   */
  public static async trackInitiateCheckoutFromOrder(
    order: any,
    reqIp?: string,
    reqUserAgent?: string,
    eventSourceUrl?: string,
    models?: any
  ) {
    try {
      let customAccessToken: string | undefined;
      let customPixelId: string | undefined;
      let customTestEventCode: string | undefined;

      if (models) {
        try {
          const { EcommerceService } = await import('./ecommerce.service');
          const config = await EcommerceService.getConfig(models);
          if (config.integrations?.metaPixel?.active && config.integrations.metaPixel.pixelId && config.integrations.metaPixel.accessToken) {
            customPixelId = config.integrations.metaPixel.pixelId;
            customAccessToken = config.integrations.metaPixel.accessToken;
            customTestEventCode = config.integrations.metaPixel.testEventCode;
          } else {
            // Si la tienda no tiene Meta Pixel activo o configurado, omitir silenciosamente (no usar .env global)
            return { success: true, skipped: true };
          }
        } catch (e) {
          console.error('[MetaService] Could not load tenant config for Meta Pixel InitiateCheckout:', e);
          return { success: false, error: 'Tenant config error' };
        }
      } else {
        // Sin contexto de tenant, omitir por seguridad
        return { success: true, skipped: true };
      }

      const orderId = order._id ? order._id.toString() : order.id;
      const contents = this.extractContentsFromOrder(order);
      const userData = this.extractUserDataFromOrder(order, reqIp, reqUserAgent);
      const total = order.finance?.total || order.paymentInfo?.amount || 0;

      const effectiveSourceUrl = eventSourceUrl || order.metaTracking?.eventSourceUrl;

      return await this.trackInitiateCheckout(
        {
          eventId: `initiate_checkout_${orderId}`,
          eventSourceUrl: effectiveSourceUrl,
          value: total,
          currency: 'ARS',
          contents,
          userData,
        },
        customAccessToken,
        customPixelId,
        customTestEventCode
      );
    } catch (err: any) {
      console.error('[MetaService] Error tracking InitiateCheckout from order:', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  }

  /**
   * Track Purchase directly from an Order document
   */
  public static async trackPurchaseFromOrder(
    order: any,
    reqIp?: string,
    reqUserAgent?: string,
    eventSourceUrl?: string,
    models?: any
  ) {
    try {
      let customAccessToken: string | undefined;
      let customPixelId: string | undefined;
      let customTestEventCode: string | undefined;

      if (models) {
        try {
          const { EcommerceService } = await import('./ecommerce.service');
          const config = await EcommerceService.getConfig(models);
          if (config.integrations?.metaPixel?.active && config.integrations.metaPixel.pixelId && config.integrations.metaPixel.accessToken) {
            customPixelId = config.integrations.metaPixel.pixelId;
            customAccessToken = config.integrations.metaPixel.accessToken;
            customTestEventCode = config.integrations.metaPixel.testEventCode;
          } else {
            // Si la tienda no tiene Meta Pixel activo o configurado, omitir silenciosamente (no usar .env global)
            return { success: true, skipped: true };
          }
        } catch (e) {
          console.error('[MetaService] Could not load tenant config for Meta Pixel:', e);
          return { success: false, error: 'Tenant config error' };
        }
      } else {
        // Sin contexto de tenant, omitir por seguridad
        return { success: true, skipped: true };
      }

      const orderId = order._id ? order._id.toString() : order.id;
      const contents = this.extractContentsFromOrder(order);
      const userData = this.extractUserDataFromOrder(order, reqIp, reqUserAgent);
      const total = order.finance?.total || order.paymentInfo?.amount || 0;

      const effectiveSourceUrl = eventSourceUrl || order.metaTracking?.eventSourceUrl;

      return await this.trackPurchase(
        {
          orderId,
          eventId: `purchase_${orderId}`,
          eventSourceUrl: effectiveSourceUrl,
          value: total,
          currency: 'ARS',
          contents,
          userData,
        },
        customAccessToken,
        customPixelId,
        customTestEventCode
      );
    } catch (err: any) {
      console.error('[MetaService] Error tracking Purchase from order:', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  }
}
