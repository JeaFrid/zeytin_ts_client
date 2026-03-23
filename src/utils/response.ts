import { ZeytinTokener } from './tokener.js';

const isDebug = process.env.NODE_ENV !== 'production';

export class ZeytinPrint {
  static success(data: string): void {
    if (isDebug) console.log(`\x1B[32m[✅]: ${data}\x1B[0m`);
  }

  static error(data: string): void {
    if (isDebug) console.log(`\x1B[31m[❌]: ${data}\x1B[0m`);
  }

  static warning(data: string): void {
    if (isDebug) console.log(`\x1B[33m[❗]: ${data}\x1B[0m`);
  }
}

export class ZeytinResponse {
  readonly isSuccess: boolean;
  readonly message: string;
  readonly error?: string;
  readonly data?: Record<string, unknown>;

 constructor(params: {
  isSuccess: boolean;
  message: string;
  error?: string;
  data?: Record<string, unknown>;
}) {
  this.isSuccess = params.isSuccess;
  this.message = params.message;
  if (params.error !== undefined) this.error = params.error;
  if (params.data !== undefined) this.data = params.data;
}

static fromMap(map: Record<string, unknown>, password?: string): ZeytinResponse {
  const rawData = map['data'];
  let processedData: Record<string, unknown> | undefined;

  if (rawData != null) {
    if (typeof rawData === 'object') {
      processedData = rawData as Record<string, unknown>;
    } else if (typeof rawData === 'string' && password != null) {
      try {
        processedData = new ZeytinTokener(password).decryptMap(rawData);
      } catch (e) {
        ZeytinPrint.error(`decryption error: ${e}`);
      }
    }
  }

  const errorVal = map['error'];

  return new ZeytinResponse({
    isSuccess: (map['isSuccess'] as boolean) ?? false,
    message: (map['message'] as string) ?? '',
    ...(errorVal != null && { error: String(errorVal) }),
    ...(processedData != null && { data: processedData }),
  });
}

  toMap(): Record<string, unknown> {
    return {
      isSuccess: this.isSuccess,
      message: this.message,
      ...(this.error != null && { error: this.error }),
      ...(this.data != null && { data: this.data }),
    };
  }
}