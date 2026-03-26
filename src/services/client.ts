import axios, { type AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { ZeytinTokener } from '../utils/tokener.js';
import { ZeytinPrint, ZeytinResponse } from '../utils/response.js';

export class ZeytinClient {
  private _host: string = '';
  private _email: string = '';
  private _password: string = '';
  private _token: string = '';
  private _truckID: string = '';
  private _axiosInstance: AxiosInstance | null = null;

  get host(): string { return this._host; }
  get email(): string { return this._email; }
  get token(): string { return this._token; }
  get truck(): string { return this._truckID; }
  get password(): string { return this._password; }

  private get _axios(): AxiosInstance {
    if (this._axiosInstance === null) {
      this._axiosInstance = axios.create({
        baseURL: this._host,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    }
    return this._axiosInstance;
  }

  private _parseResponse(data: unknown): Record<string, unknown> {
    if (typeof data === 'string') return JSON.parse(data) as Record<string, unknown>;
    return data as Record<string, unknown>;
  }

  private _errorResponse(message: string, error?: string): ZeytinResponse {
    return new ZeytinResponse({ isSuccess: false, message, ...(error != null && { error }) });
  }

  async postRaw(path: string, data: Record<string, unknown>): Promise<ZeytinResponse> {
    try {
      const res = await this._axios.post<unknown>(path, data);
      return ZeytinResponse.fromMap(this._parseResponse(res.data), this._password);
    } catch (e) {
      return this._errorResponse('Opss...', String(e));
    }
  }

  private async _getHandshakeKey(): Promise<string | null> {
    try {
      const res = await this._axios.post<Record<string, unknown>>('/token/handshake');
      if (res.data['isSuccess'] === true) {
        return res.data['tempKey'] as string;
      }
      ZeytinPrint.error(String(res.status));
      ZeytinPrint.error(JSON.stringify(res.data));
    } catch (e) {
      ZeytinPrint.error(`Handshake failed: ${e}`);
    }
    return null;
  }

  private _prepareSecurePayload(key: string, email: string, password: string): string {
    return new ZeytinTokener(key).encryptString(`${email}|${password}`);
  }

  async init(params: { host: string; email: string; password: string }): Promise<void> {
    const { host, email, password } = params;
    this._host = host;
    this._email = email;
    this._password = password;
    this._axiosInstance = null;

    const l = await this._login({ email, password });

    if (l.isSuccess) {
      this._truckID = (l.data?.['id'] as string | undefined) ?? '';
      ZeytinPrint.success('Hello developer! Connected to Zeytin.');
      setInterval(() => { void this.getToken(); }, 35000);
    } else {
      if (l.message === 'Account not found' || l.error?.includes('Account not found')) {
        ZeytinPrint.warning('Account not found. Creating a new truck...');
        const c = await this.createAccount({ email, password });

        if (c.isSuccess) {
          await this._login({ email, password });
          this._truckID = (c.data?.['id'] as string | undefined) ?? '';
          ZeytinPrint.success('New truck created and connected.');
          setInterval(() => { void this.getToken(); }, 35000);
        } else {
          ZeytinPrint.error(`Truck creation failed: ${c.error ?? c.message}`);
        }
      } else {
        ZeytinPrint.error(`Init Error: ${l.message} - ${l.error ?? ''}`);
      }
    }
  }

  async createAccount(params: { email: string; password: string }): Promise<ZeytinResponse> {
    try {
      const tempKey = await this._getHandshakeKey();
      if (tempKey === null) throw new Error('Could not get handshake key');
      const secureData = this._prepareSecurePayload(tempKey, params.email, params.password);
      const res = await this._axios.post<unknown>('/truck/create', { data: secureData });
      return ZeytinResponse.fromMap(this._parseResponse(res.data));
    } catch (e) {
      return this._errorResponse('Opss...', String(e));
    }
  }

  private async _login(params: { email: string; password: string }): Promise<ZeytinResponse> {
    try {
      const tempKey = await this._getHandshakeKey();
      if (tempKey === null) return this._errorResponse('Handshake error', 'Connection refused');

      const secureData = this._prepareSecurePayload(tempKey, params.email, params.password);
      const res = await this._axios.post<unknown>('/truck/id', { data: secureData });
      const zResponse = ZeytinResponse.fromMap(this._parseResponse(res.data));

      if (zResponse.isSuccess) {
        this._email = params.email;
        this._password = params.password;
        await this.getToken();
      }
      return zResponse;
    } catch (e) {
      return this._errorResponse('Login failed', String(e));
    }
  }

  getFileUrl(params: { fileId: string }): string {
    const base = this._axios.defaults.baseURL ?? '';
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${normalized}/${this._truckID}/${params.fileId}`;
  }

  async getToken(): Promise<string | null> {
    try {
      const tempKey = await this._getHandshakeKey();
      if (tempKey === null) return null;

      const secureData = this._prepareSecurePayload(tempKey, this._email, this._password);
      const res = await this._axios.post<unknown>('/token/create', { data: secureData });
      const data = ZeytinResponse.fromMap(this._parseResponse(res.data));

      if (data.isSuccess && data.data?.['token'] != null) {
        this._token = data.data['token'] as string;
        return this._token;
      }
    } catch (e) {
      ZeytinPrint.error(`Token renewal error: ${e}`);
    }
    return null;
  }

  private _encryptedPost = async (
    path: string,
    payload: Record<string, unknown>,
    withPassword = true,
  ): Promise<ZeytinResponse> => {
    try {
      const tokener = new ZeytinTokener(this._password);
      const encryptedData = tokener.encryptMap(payload);
      const res = await this._axios.post<unknown>(path, { token: this._token, data: encryptedData });
      const parsed = this._parseResponse(res.data);
      return ZeytinResponse.fromMap(parsed, withPassword ? this._password : undefined);
    } catch (e) {
      return this._errorResponse('Opss...', String(e));
    }
  };

  async existsBox(params: { box: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/existsBox', { box: params.box });
  }

  async existsTag(params: { box: string; tag: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/existsTag', { box: params.box, tag: params.tag });
  }

  async contains(params: { box: string; tag: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/contains', { box: params.box, tag: params.tag });
  }

  async search(params: { box: string; field: string; prefix: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/search', { box: params.box, field: params.field, prefix: params.prefix });
  }

  async filter(params: { box: string; field: string; value: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/filter', { box: params.box, field: params.field, value: params.value });
  }

  async addData(params: { box: string; tag: string; value: Record<string, unknown> }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/add', { box: params.box, tag: params.tag, value: params.value }, false);
  }

  async getData(params: { box: string; tag: string }): Promise<ZeytinResponse> {
    const zResponse = await this._encryptedPost('/data/get', { box: params.box, tag: params.tag });
    if (zResponse.isSuccess && zResponse.data != null) {
      return new ZeytinResponse({ isSuccess: true, message: 'Oki doki!', data: zResponse.data });
    }
    return zResponse;
  }

  async deleteData(params: { box: string; tag: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/delete', { box: params.box, tag: params.tag }, false);
  }

  async deleteBox(params: { box: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/deleteBox', { box: params.box }, false);
  }

  async addBatch(params: { box: string; entries: Record<string, Record<string, unknown>> }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/addBatch', { box: params.box, entries: params.entries }, false);
  }

  async getBox(params: { box: string }): Promise<ZeytinResponse> {
    const zResponse = await this._encryptedPost('/data/getBox', { box: params.box });
    if (zResponse.isSuccess && zResponse.data != null) {
      return new ZeytinResponse({ isSuccess: true, message: 'Oki doki!', data: zResponse.data });
    }
    return zResponse;
  }

  async uploadFile(filePath: string, fileName: string, bytes?: Buffer): Promise<ZeytinResponse> {
    try {
      const { default: FormData } = await import('form-data');
      const form = new FormData();
      form.append('token', this._token);

      if (bytes != null) {
        form.append('file', bytes, { filename: fileName });
      } else {
        const { createReadStream } = await import('fs');
        form.append('file', createReadStream(filePath), { filename: fileName });
      }

      const res = await this._axios.post<unknown>('/storage/upload', form, {
        headers: form.getHeaders(),
      });
      return ZeytinResponse.fromMap(this._parseResponse(res.data));
    } catch (e) {
      return this._errorResponse('Opss...', String(e));
    }
  }

  async deleteToken(params: { email: string; password: string }): Promise<ZeytinResponse> {
    try {
      const res = await this._axios.delete<unknown>('/token/delete', {
        data: { email: params.email, password: params.password },
      });
      return ZeytinResponse.fromMap(this._parseResponse(res.data));
    } catch (e) {
      return this._errorResponse('Opss...', String(e));
    }
  }

  async *watchBox(params: { box: string }): AsyncGenerator<Record<string, unknown>> {
    const tokener = new ZeytinTokener(this._password);
    const { box } = params;
    let retryCount = 0;
    const maxDelay = 60;

    while (true) {
      const cleanHost = this._host.trim().replace(/\/$/, '');
      const protocol = cleanHost.startsWith('https') ? 'wss' : 'ws';
      const domain = cleanHost.replace(/^https?:\/\//, '');
      const wsUrl = `${protocol}://${domain}/data/watch/${this._token}/${box}`;

      if (this._token === '') {
        ZeytinPrint.error('Token is empty, stopping watchBox.');
        break;
      }

      ZeytinPrint.warning(`Connecting to WebSocket: ${wsUrl} (Attempt: ${retryCount + 1})`);

      const messages: Array<Record<string, unknown>> = [];
      let resolve: (() => void) | null = null;
      let done = false;

      const ws = new WebSocket(wsUrl);

      ws.on('message', (raw) => {
        try {
          const decoded = JSON.parse(raw.toString()) as Record<string, unknown>;

          const errVal = decoded['error'];
          if (typeof errVal === 'string' && (errVal.includes('Unauthorized') || errVal.includes('Invalid token'))) {
            ZeytinPrint.error(`Critical Auth Error in Stream: ${errVal}`);
            ws.close();
            done = true;
            resolve?.();
            return;
          }

          if (typeof decoded['data'] === 'string') {
            decoded['data'] = tokener.decryptMap(decoded['data']);
          }
          if (typeof decoded['entries'] === 'string') {
            decoded['entries'] = tokener.decryptMap(decoded['entries']);
          }

          messages.push(decoded);
          resolve?.();
        } catch (e) {
          ZeytinPrint.error(`Data parse error: ${e}`);
        }
      });

      ws.on('close', () => { done = true; resolve?.(); });
      ws.on('error', (e) => { ZeytinPrint.error(`WebSocket connection error: ${e}`); done = true; resolve?.(); });

      while (!done || messages.length > 0) {
        if (messages.length === 0) {
          await new Promise<void>((r) => { resolve = r; });
          resolve = null;
        }
        const msg = messages.shift();
        if (msg != null) yield msg;
      }

      if (this._token === '') break;

      ZeytinPrint.warning('WebSocket closed by server.');
      retryCount++;
      const delay = Math.min(retryCount * 3, maxDelay);
      ZeytinPrint.warning(`Reconnecting in ${delay} seconds...`);
      await new Promise<void>((r) => setTimeout(r, delay * 1000));
    }
  }

  async joinLiveCall(params: { roomName: string; userUID: string }): Promise<ZeytinResponse> {
    if (this._token === '') return this._errorResponse('Auth token required.');
    const zResponse = await this._encryptedPost('/call/join', { roomName: params.roomName, uid: params.userUID });
    if (zResponse.isSuccess && zResponse.data != null) {
      return new ZeytinResponse({ isSuccess: true, message: 'Ready', data: zResponse.data });
    }
    return zResponse;
  }

  async *watchLiveCall(params: { roomName: string }): AsyncGenerator<boolean> {
    const cleanHost = this._host.trim().replace(/\/$/, '');
    const protocol = cleanHost.startsWith('https') ? 'wss' : 'ws';
    const domain = cleanHost.replace(/^https?:\/\//, '');
    const tokener = new ZeytinTokener(this._password);
    const encryptedData = tokener.encryptMap({ roomName: params.roomName });
    const encodedData = encodeURIComponent(encryptedData);

    let retryCount = 0;

    while (true) {
      if (this._token === '') break;
      const wsUrl = `${protocol}://${domain}/call/stream/${this._token}?data=${encodedData}`;

      const messages: boolean[] = [];
      let resolve: (() => void) | null = null;
      let done = false;

      const ws = new WebSocket(wsUrl);

      ws.on('message', (raw) => {
        try {
          const decoded = JSON.parse(raw.toString()) as Record<string, unknown>;
          messages.push(decoded['isActive'] === true);
        } catch {
          messages.push(false);
        }
        resolve?.();
      });

      ws.on('close', () => { done = true; resolve?.(); });
      ws.on('error', (e) => { ZeytinPrint.error(`Live call socket error: ${e}`); done = true; resolve?.(); });

      while (!done || messages.length > 0) {
        if (messages.length === 0) {
          await new Promise<void>((r) => { resolve = r; });
          resolve = null;
        }
        const msg = messages.shift();
        if (msg != null) yield msg;
      }

      ZeytinPrint.warning('LiveCall Stream closed.');
      retryCount++;
      const delay = Math.min(retryCount * 3, 60);
      await new Promise<void>((r) => setTimeout(r, delay * 1000));
    }
  }
  async getAllBoxes(): Promise<ZeytinResponse> {
    try {
      const res = await this._axios.post<unknown>('/data/getAllBoxes', { token: this._token });
      const parsed = this._parseResponse(res.data);
      const zResponse = ZeytinResponse.fromMap(parsed, this._password);
      if (zResponse.isSuccess && zResponse.data != null) {
        return new ZeytinResponse({ isSuccess: true, message: 'Oki doki!', data: zResponse.data });
      }
      return zResponse;
    } catch (e) {
      return this._errorResponse('Opss...', String(e));
    }
  }

  async getAllTags(params: { box: string }): Promise<ZeytinResponse> {
    return this._encryptedPost('/data/getAllTags', { box: params.box });
  }
  async checkLiveCall(params: { roomName: string }): Promise<ZeytinResponse> {
    if (this._token === '') return this._errorResponse('Auth token required.');
    try {
      return await this._encryptedPost('/call/check', { roomName: params.roomName });
    } catch (e) {
      return this._errorResponse(String(e));
    }
  }
}