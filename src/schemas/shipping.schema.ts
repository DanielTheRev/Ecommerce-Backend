import { ShippingType } from "@/interfaces/shippingMethods.interface";
import { z } from "zod";

export const CreateShippingOptionSchema = z.object({
  body: z.object({
    type: z.enum(ShippingType),
    name: z.string().min(1, 'Name is required'),
    pickupPoints: z.array(z.object({
      name: z.string().min(1, 'Name is required'),
      address: z.string().min(1, 'Address is required'),
    })).optional(),
    cost: z.string().or(z.number()).transform(v => Number(v)).refine(v => v > 0, 'Price must be positive'),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
    isDefaultForCash: z.boolean().default(false),
  })
});

export const UpdateShippingOptionSchema = z.object({
  body: z.object({
    type: z.enum(ShippingType).optional(),
    name: z.string().optional(),
    pickupPoints: z.array(z.object({
      name: z.string().min(1, 'Name is required'),
      address: z.string().min(1, 'Address is required'),
    })).optional(),
    cost: z.string().or(z.number()).transform(v => Number(v)).refine(v => v > 0, 'Price must be positive').optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    isDefaultForCash: z.boolean().optional(),
  })
});