import { z } from 'zod';

enum PaymentType {
	CASH = 'Efectivo',
	BANK_TRANSFER = 'Transferencia bancaria',
	ALIAS_TRANSFER = 'Transferencia a alias',
	CARD = 'Tarjeta de crédito / débito'
}

try {
    const schema = z.enum(PaymentType as any);
    console.log('Schema created successfully');
    console.log('Parse "Efectivo":', schema.safeParse('Efectivo').success);
} catch (e) {
    console.error('Error with z.enum(PaymentType):', e);
}

const nativeSchema = z.nativeEnum(PaymentType);
console.log('NativeEnum schema created successfully');
console.log('Parse "Efectivo":', nativeSchema.safeParse('Efectivo').success);
