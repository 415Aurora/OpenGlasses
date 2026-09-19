import { rotateImage } from './imaging';

const SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214';
const PHOTO_DATA_UUID = '19b10005-e8f2-537e-4f6c-d104768a1214';
const PHOTO_CONTROL_UUID = '19b10006-e8f2-537e-4f6c-d104768a1214';

export type WifiCameraUrls = { capture: string; stream: string };
export type CameraSource = {
    name: string;
    previewUrl?: string;
    capture(): Promise<Uint8Array>;
    disconnect?(): void;
};

export function normalizeCameraAddress(value: string): string {
    const input = value.trim();
    if (!input) throw new Error('请输入 ESP32 摄像头地址');
    const url = new URL(input.includes('://') ? input : `http://${input}`);
    if (url.protocol !== 'http:') throw new Error('仅支持 HTTP 摄像头地址');
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/$/, '');
}

export function createWifiCameraUrls(address: string): WifiCameraUrls {
    const controlBase = normalizeCameraAddress(address);
    const base = new URL(controlBase);
    const stream = new URL(controlBase);
    stream.port = '81';
    const basePath = base.pathname.replace(/\/+$/, '');
    stream.pathname = `${basePath}/stream`.replace(/\/+/g, '/');
    stream.search = '';
    return { capture: `${controlBase}/capture`, stream: stream.toString() };
}

export function createBleCaptureCommand(): Uint8Array {
    return new Uint8Array([0xff]);
}

export class WifiCameraSource implements CameraSource {
    readonly name = 'Wi-Fi 摄像头';
    readonly previewUrl: string;
    #captureUrl: string;

    constructor(address: string) {
        const urls = createWifiCameraUrls(address);
        this.previewUrl = urls.stream;
        this.#captureUrl = urls.capture;
    }

    async capture(): Promise<Uint8Array> {
        const response = await fetch(`${this.#captureUrl}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`摄像头抓拍失败（HTTP ${response.status}）`);
        return new Uint8Array(await response.arrayBuffer());
    }
}

export class BleCameraSource implements CameraSource {
    readonly name = 'BLE 眼镜';
    #device: BluetoothDevice;
    #server: BluetoothRemoteGATTServer | null = null;
    #control: BluetoothRemoteGATTCharacteristic | null = null;
    #data: BluetoothRemoteGATTCharacteristic | null = null;
    #buffer = new Uint8Array(0);
    #previousChunk = -1;
    #pending: { resolve: (photo: Uint8Array) => void; reject: (error: Error) => void } | null = null;
    #timer: ReturnType<typeof setTimeout> | null = null;
    #listener: ((event: Event) => void) | null = null;

    constructor(device: BluetoothDevice) {
        this.#device = device;
    }

    async capture(): Promise<Uint8Array> {
        await this.#ensureReady();
        if (this.#pending) throw new Error('上一张照片仍在传输，请稍候');
        this.#buffer = new Uint8Array(0);
        this.#previousChunk = -1;
        return new Promise<Uint8Array>((resolve, reject) => {
            this.#pending = { resolve, reject };
            this.#timer = setTimeout(() => this.#finish(new Error('BLE 照片传输超时，请重新连接眼镜')), 20000);
            this.#control!.writeValue(createBleCaptureCommand()).catch((error) => {
                this.#finish(error instanceof Error ? error : new Error('BLE 拍照失败'));
            });
        });
    }

    disconnect(): void {
        this.#cleanup();
        if (this.#device.gatt?.connected) this.#device.gatt.disconnect();
    }

    async #ensureReady(): Promise<void> {
        if (!this.#device.gatt) throw new Error('当前浏览器不支持 Web Bluetooth');
        if (!this.#device.gatt.connected) await this.#device.gatt.connect();
        this.#server = this.#device.gatt;
        const service = await this.#server.getPrimaryService(SERVICE_UUID);
        this.#control = await service.getCharacteristic(PHOTO_CONTROL_UUID);
        this.#data = await service.getCharacteristic(PHOTO_DATA_UUID);
        if (!this.#listener) {
            this.#listener = (event: Event) => this.#onNotification(event);
            await this.#data.startNotifications();
            this.#data.addEventListener('characteristicvaluechanged', this.#listener);
        }
    }

    #onNotification(event: Event): void {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        const packet = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        if (packet.length >= 2 && packet[0] === 0xff && packet[1] === 0xff) {
            const photo = this.#buffer;
            this.#buffer = new Uint8Array(0);
            this.#previousChunk = -1;
            rotateImage(photo, '270').then((rotated) => this.#finish(undefined, rotated)).catch((error) => {
                this.#finish(error instanceof Error ? error : new Error('照片方向处理失败'));
            });
            return;
        }
        if (packet.length < 2 || !this.#pending) return;
        const chunkId = packet[0] | (packet[1] << 8);
        if (this.#previousChunk === -1) {
            if (chunkId !== 0) return;
        } else if (chunkId !== this.#previousChunk + 1) {
            this.#finish(new Error('BLE 照片数据包顺序错误，请重新拍照'));
            return;
        }
        this.#previousChunk = chunkId;
        const data = packet.slice(2);
        const next = new Uint8Array(this.#buffer.length + data.length);
        next.set(this.#buffer);
        next.set(data, this.#buffer.length);
        this.#buffer = next;
    }

    #finish(error?: Error, photo?: Uint8Array): void {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = null;
        const pending = this.#pending;
        this.#pending = null;
        if (!pending) return;
        if (error) pending.reject(error);
        else pending.resolve(photo!);
    }

    #cleanup(): void {
        if (this.#data && this.#listener) this.#data.removeEventListener('characteristicvaluechanged', this.#listener);
        this.#listener = null;
        this.#finish(new Error('BLE 连接已断开'));
        this.#data = null;
        this.#control = null;
        this.#server = null;
    }
}
