import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const firmware = readFileSync('firmware/firmware.ino', 'utf8');
const httpd = readFileSync('firmware/app_httpd.cpp', 'utf8');

assert.match(firmware, /psramFound\(\)/);
assert.match(firmware, /CAMERA_FB_IN_DRAM/);
assert.match(firmware, /CAMERA_FB_IN_PSRAM/);
assert.match(firmware, /config\.fb_count = 1/);
assert.match(firmware, /config\.fb_count = 2/);
assert.doesNotMatch(firmware, /ps_calloc/);
assert.doesNotMatch(firmware, /WiFi\.setSleep\(false\)/);
assert.match(firmware, /WiFi\.setSleep\(true\)/);
assert.match(firmware, /cameraMutex/);
assert.match(firmware, /xSemaphoreTake\(cameraMutex/);
assert.match(firmware, /xSemaphoreGive\(cameraMutex\)/);
assert.match(httpd, /cameraMutex/);
assert.match(httpd, /xSemaphoreTake\(cameraMutex/);
assert.match(httpd, /xSemaphoreGive\(cameraMutex\)/);

const setupStart = firmware.indexOf('void setup()');
const bleSetup = firmware.indexOf('configure_ble();', setupStart);
const wifiSetup = firmware.indexOf('WiFi.mode', setupStart);
assert.ok(setupStart >= 0 && wifiSetup > setupStart);
assert.equal(bleSetup, -1);
assert.doesNotMatch(firmware, /configure_microphone\(\);/);
assert.match(firmware, /Wi-Fi-only camera mode/);

console.info('firmware camera config tests passed');
