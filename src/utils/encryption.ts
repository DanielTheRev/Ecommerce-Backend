import crypto from 'crypto';

// Algoritmo de encriptación
const ALGORITHM = 'aes-256-cbc';
// Longitud de la clave (32 bytes para aes-256)
const KEY_LENGTH = 32;
// Longitud del vector de inicialización (16 bytes para aes)
const IV_LENGTH = 16;

// Obtener clave desde variables de entorno o usar una por defecto para desarrollo
// NOTA: En producción, asegurar que JWT_SECRET tenga suficiente longitud o usar una variable específica ENCRYPTION_KEY
const getEncryptionKey = (): Buffer => {
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_secret_key_for_development_only_32_bytes';
    // Si la clave no tiene 32 bytes, la hasheamos para asegurar el tamaño correcto
    return crypto.createHash('sha256').update(secret).digest();
};

export interface EncryptedData {
    iv: string;
    content: string;
}

/**
 * Encripta un texto
 */
export const encrypt = (text: string): EncryptedData => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

/**
 * Desencripta un texto anteriormente encriptado
 */
export const decrypt = (hash: EncryptedData): string => {
    const iv = Buffer.from(hash.iv, 'hex');
    const encryptedText = Buffer.from(hash.content, 'hex');
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
};
