import assert from 'node:assert/strict';
import {
    createBleCaptureCommand,
    createWifiCameraUrls,
    normalizeCameraAddress,
} from '../sources/modules/cameraTransport';

assert.equal(normalizeCameraAddress('192.168.1.42'), 'http://192.168.1.42');
assert.equal(normalizeCameraAddress('http://192.168.1.42/'), 'http://192.168.1.42');
assert.equal(normalizeCameraAddress('http://192.168.1.42:8080/path'), 'http://192.168.1.42:8080/path');
assert.throws(() => normalizeCameraAddress('https://192.168.1.42'), /仅支持 HTTP/);
assert.throws(() => normalizeCameraAddress(''), /请输入/);

assert.deepEqual(createWifiCameraUrls('http://192.168.1.42'), {
    capture: 'http://192.168.1.42/capture',
    stream: 'http://192.168.1.42:81/stream',
});
assert.deepEqual(createBleCaptureCommand(), new Uint8Array([0xff]));

console.info('camera transport tests passed');
