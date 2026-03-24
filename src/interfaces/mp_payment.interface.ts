export interface Transactions {
  payments: PaymentElement[];
}

export interface PaymentElement {
  id: string;
  amount: string;
  paid_amount: string;
  reference_id: string;
  status: string;
  status_detail: string;
  payment_method: PaymentMethod;
}

export interface PaymentMethod {
  id: string;
  type: string;
  token: string;
  installments: number;
}
