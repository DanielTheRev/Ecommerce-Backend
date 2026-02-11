import { EcommercePaymentProviders, IEcommerceUalaCredentials } from "@/interfaces/ecommerce.interface";
import { EcommerceService } from "./ecommerce.service";
import { UalaTokenResponse } from "@/interfaces/ualaWebhook.interface";

export class UalaService {
  private token: string | null = null;
  private url = 'https://auth.stage.developers.ar.ua.la/v2/api';

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const credentials = await EcommerceService.getCredentials(EcommercePaymentProviders.UALA) as IEcommerceUalaCredentials;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...credentials, grant_type: 'client_credentials' })
      };

      const response = await fetch(`${this.url}/auth/token`, options);
      const data = await response.json() as UalaTokenResponse;
      this.token = data.access_token;
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
  }



}