# Wi-Fi Only Camera Implementation Plan

> **For agentic workers:** Execute this plan inline with test checkpoints.

**Goal:** Temporarily disable BLE runtime connections and make the ESP32 Wi-Fi camera path the only active image transport.

**Architecture:** Keep the existing BLE source code for later restoration, but do not call `configure_ble()` in firmware startup and remove the BLE mode from the web entry screen. Keep the HTTP `/capture` and port-81 `/stream` endpoints, with camera access serialized by the existing mutex.

**Tech Stack:** ESP32-S3 Arduino firmware, `esp_http_server`, Expo React Native Web, TypeScript tests.

---

### Task 1: Lock the Wi-Fi-only behavior with tests

**Files:**
- Modify: `tests/firmwareCameraConfig.test.ts`
- Create: `tests/wifiOnly.test.ts`

- [ ] Assert firmware setup does not invoke `configure_ble()`.
- [ ] Assert the web entry screen no longer exposes BLE mode controls.
- [ ] Run the focused tests and observe failure before implementation.

### Task 2: Disable BLE runtime startup

**Files:**
- Modify: `firmware/firmware.ino`

- [ ] Remove the `configure_ble()` call from `setup()`.
- [ ] Keep Wi-Fi startup and HTTP server startup unchanged.
- [ ] Preserve the BLE implementation for later re-enablement.

### Task 3: Make the web entry Wi-Fi-only

**Files:**
- Modify: `sources/app/Main.tsx`

- [ ] Remove BLE device state and BLE mode rendering from the entry screen.
- [ ] Open `WifiCameraSource` directly from the Wi-Fi form.
- [ ] Keep saved IP address and validation behavior.

### Task 4: Verify

- [ ] Run `npm test`.
- [ ] Compile the ESP32-S3 OPI PSRAM firmware.
- [ ] Report the upload and `/capture` verification commands.
