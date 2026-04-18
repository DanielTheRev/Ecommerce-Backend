import { Document } from "mongoose";

export interface IProviderDocument extends Document {
  name: string;
  cuit?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    number?: string;
    city?: string;
    province?: string;
    zipCode?: string;
  };
  paymentData: {
    cvu?: string;
    alias: string;
    bank?: string;
    accountNumber?: string;
    accountType?: string;
    accountHolder: string;
  };
  active: boolean;
}

export interface IProvider {
  name: string;
  cuit?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    number?: string;
    city?: string;
    province?: string;
    zipCode?: string;
  };
  paymentData: {
    cvu?: string;
    alias: string;
    bank?: string;
    accountNumber?: string;
    accountType?: string;
    accountHolder: string;
  };
  active: boolean;
}