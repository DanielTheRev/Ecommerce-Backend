export interface IProduct {
  id: number;
  name: string;
  price: number | null;
  discount: number;
  rating: number | null;
  reviews: number | null;
  image: {
    light: string;
    dark: string;
  };
  features: string[];
}

export interface IProductCreate {
  _id?: string;
  name: string;
  price: number | null;
  discount: number;
  rating: number | null;
  reviews: number | null;
  image: {
    light: string;
    dark: string;
  };
  features: string[];
}

export interface IProductUpdate extends Partial<IProductCreate> {}
