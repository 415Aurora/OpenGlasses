import * as React from 'react';

const SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214';

export function useDevice() {
    const [device, setDevice] = React.useState<BluetoothDevice | null>(null);
    const [connecting, setConnecting] = React.useState(false);
    const [error, setError] = React.useState<string | undefined>();

    const connect = React.useCallback(async () => {
        setError(undefined);
        if (typeof navigator === 'undefined' || !navigator.bluetooth) {
            setError('当前浏览器不支持 Web Bluetooth，请使用 Chrome 或 Edge，并通过 HTTPS/localhost 打开。');
            return;
        }
        setConnecting(true);
        try {
            const selected = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'OpenGlass' }],
                optionalServices: [SERVICE_UUID],
            });
            selected.ongattserverdisconnected = () => {
                setDevice(null);
                setError('BLE 眼镜已断开，请重新连接后再拍照。');
            };
            if (!selected.gatt) throw new Error('设备没有 GATT 服务');
            await selected.gatt.connect();
            setDevice(selected);
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            if (!/cancel|abort/i.test(message)) setError(`BLE 连接失败：${message}`);
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = React.useCallback(() => {
        if (device?.gatt?.connected) device.gatt.disconnect();
        setDevice(null);
    }, [device]);

    return { device, connect, disconnect, connecting, error };
}
