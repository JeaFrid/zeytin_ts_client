import * as crypto from 'crypto';

export class ZeytinTokener {
  private readonly key: Buffer;

  constructor(passphrase: string) {
    this.key = ZeytinTokener._deriveKey(passphrase);
  }

  public encryptString(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return `${iv.toString('base64')}:${encrypted}`;
  }

  public decryptString(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error("Invalid format");
    }
    
    const [ivPart, encryptedPart] = parts as [string, string];
    const iv = Buffer.from(ivPart, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
    let decrypted: string = decipher.update(encryptedPart, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private static _deriveKey(passphrase: string): Buffer {
    return crypto.createHash('sha256').update(passphrase, 'utf8').digest();
  }

  public encryptMap(data: Record<string, any>): string {
    const iv = crypto.randomBytes(16);
    const plainText = JSON.stringify(data);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return `${iv.toString('base64')}:${encrypted}`;
  }

  public decryptMap(encryptedData: string): Record<string, any> {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted data format");
    }
    
    const [ivPart, encryptedPart] = parts as [string, string];
    const iv = Buffer.from(ivPart, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
    let decrypted: string = decipher.update(encryptedPart, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}