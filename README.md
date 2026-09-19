# OpenGlass - Open Source Smart Glasses

Turn any glasses into hackable smart glasses with less than $25 of off-the-shelf components. Record your life, remember people you meet, identify objects, translate text, and more.

![OpenGlass](https://github.com/BasedHardware/OpenGlass/assets/43514161/2fdc9d9d-2206-455c-ba60-10dbd6fb3dfb)


## Video Demo

[![OpenGlass Demo](https://img.youtube.com/vi/DsM_-c2e1ew/0.jpg)](https://youtu.be/DsM_-c2e1ew)

## Want a Pre-built Version?

We will ship a limited number of pre-built kits. Fill out the [interest form](https://basedhardware.com/openglass) to get notified.

## Community

Join the [Based Hardware Discord](https://discord.com/invite/ZutWMTJnwA) for setup questions, contribution guide, and more.

## Getting Started

Follow these steps to set up OpenGlass:

### Hardware

1. Gather the required components:
   - [Seeed Studio XIAO ESP32 S3 Sense](https://www.amazon.com/dp/B0C69FFVHH/ref=dp_iou_view_item?ie=UTF8&psc=1)
   - [EEMB LP502030 3.7v 250mAH battery](https://www.amazon.com/EEMB-Battery-Rechargeable-Lithium-Connector/dp/B08VRZTHDL)
   - [3D printed glasses mount case](https://storage.googleapis.com/scott-misc/openglass_case.stl)

2. 3D print the glasses mount case using the provided STL file.

3. Open the [firmware folder](https://github.com/BasedHardware/openglass/tree/main/firmware) and open the `.ino` file in the Arduino IDE.
   - If you don't have the Arduino IDE installed, download and install it from the [official website](https://www.arduino.cc/en/software).
   - Alternatively, follow the steps in the [firmware readme](firmware/readme.md) to build using `arduino-cli`

4. Follow the software preparation steps to set up the Arduino IDE for the XIAO ESP32S3 board:
   - Add ESP32 board package to your Arduino IDE:
     - Navigate to File > Preferences, and fill "Additional Boards Manager URLs" with the URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
     - Navigate to Tools > Board > Boards Manager..., type the keyword `esp32` in the search box, select the latest version of `esp32`, and install it.
   - Select your board and port:
     - On top of the Arduino IDE, select the port (likely to be COM3 or higher).
     - Search for `xiao` in the development board on the left and select `XIAO_ESP32S3`.

5. Before you flash go to the "Tools" drop down in the Arduino IDE and make sure you set "PSRAM:" to be "PSRAM: "OPI PSRAM"

![Like this](image.png)

6. Upload the firmware to the XIAO ESP32S3 board.

### Software

1. Clone the OpenGlass repository and install the dependencies:
   ```
   git clone https://github.com/BasedHardware/openglass.git
   cd openglass
   npm install
   ```
   You can also use **yarn** to install, by doing
   ```
   yarn install
   ```

3. Create an API Key in the [Zhipu AI Open Platform](https://bigmodel.cn/usercenter/proj-mgmt/apikeys), then set it before starting Expo:
   ```bash
   export EXPO_PUBLIC_ZHIPU_API_KEY="your-zhipu-api-key"
   ```
   The default cloud AI pipeline uses Zhipu's free `glm-4.6v-flash` model to describe each photo and `glm-4.7-flash` to answer questions from those cached descriptions. `glm-4.7-flash` is configured without thinking mode for lower-latency glasses interactions. Free-model availability, quotas, and rate limits are governed by Zhipu's current platform policy.

   > **Privacy:** With the default configuration, captured photos are uploaded to Zhipu AI for image understanding. Do not use it for images you are not permitted to transmit to a third party.

4. The legacy providers remain available but are never selected automatically. Set a provider variable explicitly to use one:
   ```bash
   # Defaults: zhipu, zhipu, browser
   export EXPO_PUBLIC_VISION_PROVIDER=ollama  # valid values: zhipu, ollama
   export EXPO_PUBLIC_CHAT_PROVIDER=groq      # valid values: zhipu, groq, openai
   export EXPO_PUBLIC_TTS_PROVIDER=openai     # valid values: browser, openai
   ```
   `EXPO_PUBLIC_VISION_PROVIDER=ollama` also requires `EXPO_PUBLIC_OLLAMA_API_URL` (for example `http://localhost:11434/api/chat`) and a locally installed compatible model. `groq` requires `EXPO_PUBLIC_GROQ_API_KEY`; legacy OpenAI chat or speech requires `EXPO_PUBLIC_OPENAI_API_KEY`. The default `browser` speech provider uses the browser's local `speechSynthesis` voice and does not make a cloud speech request.


6. Start the application:
   ```
   npm start
   ```

   If using **yarn** start the application with
   ```
   yarn start
   ```

   Note: This is an Expo project. For now, open the localhost link (this will appear after completing step 5) to access the web version.

### Verification

Run the provider configuration, request-payload, browser-speech, and gateway tests together with strict TypeScript checking:

```
npm test
```

## Camera transport modes

The web app now starts with two explicit connection modes:

- **BLE glasses:** connect to the `OpenGlass` device in Chrome or Edge. A photo is requested only when **拍照识别** is pressed; the browser writes `0xFF` to the existing photo-control characteristic.
- **Wi-Fi camera:** enter the IP address printed by the ESP32 serial monitor. The browser previews `http://<ESP32-IP>:81/stream` and fetches one JPEG from `http://<ESP32-IP>/capture` when **拍照识别** is pressed.

Only the latest successfully recognized frame is retained for questions. The MJPEG stream itself is never uploaded to the AI provider.

### Configure firmware Wi-Fi

Create the local firmware secrets file from the example and replace both values:

```bash
cp firmware/secrets.example.h firmware/secrets.h
```

```cpp
#define OPENGLASS_WIFI_SSID "your-wifi-name"
#define OPENGLASS_WIFI_PASSWORD "your-wifi-password"
```

`firmware/secrets.h` is ignored by Git. After uploading the firmware, open the serial monitor at `921600` baud. A successful connection prints the camera IP and the two endpoints. The computer and glasses must be on the same LAN. If credentials are missing or the connection times out after 15 seconds, BLE still starts normally.

The AI API key remains a separate Expo environment variable. It is not stored on the ESP32 and does not need to be set again in the same terminal session. For persistent local development, keep it in the already ignored `.env.local` file rather than in source code.

For the Seeed XIAO ESP32S3 Sense, choose the actual PSRAM mode under
`Tools > PSRAM` in Arduino IDE. `OPI PSRAM` gives the larger SVGA/double-buffer
configuration. If the IDE currently shows `PSRAM=disabled`, the firmware
automatically falls back to one VGA frame buffer in internal DRAM, so camera
initialization does not require changing the board setting first.

## License

This project is licensed under the MIT License.
