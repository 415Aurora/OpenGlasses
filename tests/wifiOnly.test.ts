import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('sources/app/Main.tsx', 'utf8');

assert.doesNotMatch(main, /useDevice/);
assert.doesNotMatch(main, /BleCameraSource/);
assert.doesNotMatch(main, /BLE 眼镜/);
assert.match(main, /WifiCameraSource/);

console.info('wifi-only tests passed');
