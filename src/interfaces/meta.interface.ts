export interface IMetaUserData {
  em?: string | string[]; // Hashed email SHA-256
  ph?: string | string[]; // Hashed phone SHA-256
  fn?: string | string[]; // Hashed first name SHA-256
  ln?: string | string[]; // Hashed last name SHA-256
  db?: string;            // Date of birth YYYYMMDD
  ge?: string;            // Gender 'm' or 'f'
  ct?: string;            // City hashed
  st?: string;            // State hashed
  zp?: string;            // Zip code hashed
  country?: string;       // Country code hashed (2-letter ISO)
  external_id?: string | string[]; // User ID in database
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;           // Click ID cookie (_fbc)
  fbp?: string;           // Browser ID cookie (_fbp)
}

export interface IMetaContentItem {
  id: string;
  quantity: number;
  item_price?: number;
  title?: string;
  category?: string;
}

export interface IMetaCustomData {
  value?: number;
  currency?: string;       // e.g. 'ARS', 'USD'
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  contents?: IMetaContentItem[];
  content_type?: 'product' | 'product_group';
  num_items?: number;
  order_id?: string;
  status?: string;
  search_string?: string;
  [key: string]: any;
}

export type MetaStandardEventName =
  | 'AddPaymentInfo'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'CompleteRegistration'
  | 'Contact'
  | 'CustomizeProduct'
  | 'Donate'
  | 'FindLocation'
  | 'InitiateCheckout'
  | 'Lead'
  | 'PageView'
  | 'Purchase'
  | 'Schedule'
  | 'Search'
  | 'StartTrial'
  | 'SubmitApplication'
  | 'Subscribe'
  | 'ViewContent';

export interface IMetaEvent {
  event_name: MetaStandardEventName | string;
  event_time: number; // Unix timestamp in seconds
  event_id?: string;  // For deduplication with frontend Meta Pixel
  event_source_url?: string;
  action_source: 'website' | 'app' | 'physical_store' | 'system_generated' | 'other';
  user_data: IMetaUserData;
  custom_data?: IMetaCustomData;
  opt_out?: boolean;
}

export interface IMetaEventPayload {
  data: IMetaEvent[];
  test_event_code?: string;
}

export interface ITrackEventInput {
  eventName: MetaStandardEventName | string;
  eventSourceUrl?: string;
  eventId?: string;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
    clientIp?: string;
    clientUserAgent?: string;
    fbc?: string;
    fbp?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  customData?: IMetaCustomData;
}
