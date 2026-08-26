import crypto from 'crypto';
import dotenv from 'dotenv';
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
   * Hashes data with SHA-256 according to Meta Conversions API specifications.
   */
  public static hashData(value: string): string {
    if (!value) return '';
    const cleanValue = value.trim().toLowerCase();
    return crypto.createHash('sha256').update(cleanValue).digest('hex');
  }

  /**
   * Normalizes and hashes phone numbers according to Meta specs (digits only).
   */
  public static hashPhone(phone: string): string {
    if (!phone) return '';
    const digitsOnly = phone.replace(/\D/g, '');
    return crypto.createHash('sha256').update(digitsOnly).digest('hex');
  }

  /**
   * Formats raw user details into Meta's required IMetaUserData schema with proper SHA-256 hashing.
   */
  public static prepareUserData(rawUserData: ITrackEventInput['userData']): IMetaUserData {
    if (!rawUserData) return {};

    const userData: IMetaUserData = {};

    if (rawUserData.email) {
      userData.em = this.hashData(rawUserData.email);
    }
    if (rawUserData.phone) {
      userData.ph = this.hashPhone(rawUserData.phone);
    }
    if (rawUserData.firstName) {
      userData.fn = this.hashData(rawUserData.firstName);
    }
    if (rawUserData.lastName) {
      userData.ln = this.hashData(rawUserData.lastName);
    }
    if (rawUserData.city) {
      userData.ct = this.hashData(rawUserData.city);
    }
    if (rawUserData.state) {
      userData.st = this.hashData(rawUserData.state);
    }
    if (rawUserData.zip) {
      userData.zp = this.hashData(rawUserData.zip);
    }
    if (rawUserData.country) {
      userData.country = this.hashData(rawUserData.country);
    }
    if (rawUserData.externalId) {
      userData.external_id = Array.isArray(rawUserData.externalId)
        ? rawUserData.externalId.map((id) => this.hashData(id))
        : this.hashData(rawUserData.externalId);
    }

    // Unhashed fields (Meta requires these unhashed)
    if (rawUserData.clientIp) userData.client_ip_address = rawUserData.clientIp;
    if (rawUserData.clientUserAgent) userData.client_user_agent = rawUserData.clientUserAgent;
    if (rawUserData.fbc) userData.fbc = rawUserData.fbc;
    if (rawUserData.fbp) userData.fbp = rawUserData.fbp;

    return userData;
  }

  /**
   * Helper to extract Meta UserData (IP, UserAgent, fbc, fbp, externalId) directly from Express Request
   */
  public static extractUserDataFromReq(req: any): ITrackEventInput['userData'] {
    if (!req) return {};

    // 1. IP extraction (Cloudflare Tunnel / reverse proxy friendly)
    const cfIp = req.headers ? req.headers['cf-connecting-ip'] : undefined;
    const realIp = req.headers ? req.headers['x-real-ip'] : undefined;
    const forwarded = req.headers ? req.headers['x-forwarded-for'] : undefined;
    let clientIp = (cfIp && typeof cfIp === 'string') ? cfIp.trim() : undefined;

    if (!clientIp && realIp && typeof realIp === 'string') {
      clientIp = realIp.trim();
    }

    if (!clientIp && forwarded) {
      const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
      if (ips.length > 0 && ips[0].trim()) {
        clientIp = ips[0].trim();
      }
    }
    if (!clientIp) {
      clientIp = req.ip || req.socket?.remoteAddress;
    }

    if (clientIp && clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.replace('::ffff:', '');
    }

    // 2. User Agent
    const clientUserAgent = req.get ? req.get('user-agent') : req.headers?.['user-agent'];

    // 3. fbc & fbp cookies / headers / query params
    const cookies = req.cookies || {};
    let fbc = cookies['_fbc'] || req.headers?.['x-fbc'] || (req.query ? req.query['fbc'] : undefined);
    const fbp = cookies['_fbp'] || req.headers?.['x-fbp'] || (req.query ? req.query['fbp'] : undefined);

    // If fbc isn't set, check if fbclid was in query or referer
    if (!fbc && req.query && req.query['fbclid']) {
      fbc = `fb.1.${Date.now()}.${req.query['fbclid']}`;
    }

    // 4. Auth User External ID & email if logged in or passed via custom headers
    const user = req.user;
    const externalId = (req.headers && req.headers['x-external-id'] && typeof req.headers['x-external-id'] === 'string')
      ? req.headers['x-external-id']
      : (user ? (user._id ? user._id.toString() : user.toString()) : undefined);

    const email = (req.headers && req.headers['x-user-email'] && typeof req.headers['x-user-email'] === 'string')
      ? req.headers['x-user-email']
      : user?.email;

    return {
      clientIp,
      clientUserAgent,
      fbc,
      fbp,
      externalId,
      email,
    };
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

    return {
      email: buyer.email,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      phone: addr.phone,
      city: addr.city,
      state: addr.state,
      zip: addr.zipCode,
      country: 'AR',
      externalId: order.user ? (order.user._id ? order.user._id.toString() : order.user.toString()) : undefined,
      clientIp: reqIp,
      clientUserAgent: reqUserAgent,
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
    customPixelId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const token = customAccessToken || this.accessToken;
    const pixel = customPixelId || this.pixelId;

    if (!token) {
      console.warn('[MetaService] Warning: META_ACCESS_TOKEN is missing. Meta event not sent.');
      return { success: false, error: 'META_ACCESS_TOKEN missing' };
    }

    if (!pixel) {
      console.warn('[MetaService] Warning: META_PIXEL_ID is missing. Meta event not sent.');
      return { success: false, error: 'META_PIXEL_ID missing' };
    }

    if (process.env.NODE_ENV !== 'production' && !this.testEventCode) {
      console.log('[MetaService] Skipping CAPI event in development mode (NODE_ENV !== production).');
      return { success: true, data: 'Skipped in development' };
    }

    // 🛡️ Skip sending events if event_source_url contains localhost or 127.0.0.1 (unless META_TEST_EVENT_CODE is set)
    const isLocalhostEvent = events.some(e =>
      e.event_source_url && (e.event_source_url.includes('localhost') || e.event_source_url.includes('127.0.0.1'))
    );

    if (isLocalhostEvent && !this.testEventCode) {
      console.log('[MetaService] Skipping CAPI event because event_source_url points to localhost / 127.0.0.1.');
      return { success: true, data: 'Skipped localhost event' };
    }

    const payload: IMetaEventPayload = {
      data: events,
    };

    const testCode = this.testEventCode;
    if (testCode) {
      payload.test_event_code = testCode;
    }

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
        console.error('[MetaService] Error response from Meta CAPI:', responseData);
        return { success: false, error: JSON.stringify(responseData) };
      }

      console.log(`[MetaService] Successfully sent ${events.length} event(s) to Meta CAPI:`, responseData);
      return { success: true, data: responseData };
    } catch (error: any) {
      console.error('[MetaService] Network or unexpected error sending events to Meta CAPI:', error?.message || error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Tracks a general event with normalized input.
   */
  public static async trackEvent(
    input: ITrackEventInput,
    customAccessToken?: string,
    customPixelId?: string
  ) {
    const event: IMetaEvent = {
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      event_source_url: input.eventSourceUrl,
      action_source: 'website',
      user_data: this.prepareUserData(input.userData),
      custom_data: input.customData,
    };

    return this.sendEvents([event], customAccessToken, customPixelId);
  }

  /**
   * Track Purchase Event
   */
  public static async trackPurchase(
    params: {
      orderId: string;
      value: number;
      currency?: string;
      contents?: Array<{ id: string; quantity: number; item_price?: number; title?: string }>;
      userData?: ITrackEventInput['userData'];
      eventSourceUrl?: string;
      eventId?: string;
    },
    customAccessToken?: string,
    customPixelId?: string
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
          content_type: 'product',
          content_ids: params.contents?.map((c) => c.id) || [],
          contents: params.contents,
          num_items: params.contents?.reduce((sum, item) => sum + item.quantity, 0),
        },
      },
      customAccessToken,
      customPixelId
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
          content_type: 'product',
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
      userData?: ITrackEventInput['userData'];
      eventSourceUrl?: string;
      eventId?: string;
    },
    customAccessToken?: string,
    customPixelId?: string
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
          content_type: 'product',
          content_ids: [params.productId],
        },
      },
      customAccessToken,
      customPixelId
    );
  }

  /**
   * Track InitiateCheckout Event
   */
  public static async trackInitiateCheckout(
    params: {
      value?: number;
      currency?: string;
      contents?: Array<{ id: string; quantity: number; item_price?: number }>;
      numItems?: number;
      userData?: ITrackEventInput['userData'];
      eventSourceUrl?: string;
      eventId?: string;
    },
    customAccessToken?: string,
    customPixelId?: string
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
          content_type: 'product',
          content_ids: params.contents?.map((c) => c.id) || [],
          contents: params.contents,
          num_items: params.numItems || params.contents?.reduce((sum, item) => sum + item.quantity, 0),
        },
      },
      customAccessToken,
      customPixelId
    );
  }

  /**
   * Track InitiateCheckout directly from an Order document
   */
  public static async trackInitiateCheckoutFromOrder(
    order: any,
    reqIp?: string,
    reqUserAgent?: string,
    eventSourceUrl?: string
  ) {
    try {
      const orderId = order._id ? order._id.toString() : order.id;
      const contents = this.extractContentsFromOrder(order);
      const userData = this.extractUserDataFromOrder(order, reqIp, reqUserAgent);
      const total = order.finance?.total || order.paymentInfo?.amount || 0;

      return await this.trackInitiateCheckout({
        eventId: `initiate_checkout_${orderId}`,
        eventSourceUrl,
        value: total,
        currency: 'ARS',
        contents,
        userData,
      });
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

      if (models) {
        try {
          const { EcommerceService } = await import('./ecommerce.service');
          const config = await EcommerceService.getConfig(models);
          if (config.integrations?.metaPixel?.active && config.integrations.metaPixel.pixelId && config.integrations.metaPixel.accessToken) {
            customPixelId = config.integrations.metaPixel.pixelId;
            customAccessToken = config.integrations.metaPixel.accessToken;
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

      return await this.trackPurchase(
        {
          orderId,
          eventId: `purchase_${orderId}`,
          eventSourceUrl,
          value: total,
          currency: 'ARS',
          contents,
          userData,
        },
        customAccessToken,
        customPixelId
      );
    } catch (err: any) {
      console.error('[MetaService] Error tracking Purchase from order:', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  }
}
