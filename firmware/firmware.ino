#define CAMERA_MODEL_XIAO_ESP32S3
#include <I2S.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <WiFi.h>
#include <freertos/semphr.h>
#include "esp_camera.h"
#include "camera_pins.h"
#include "mulaw.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#define OPENGLASS_WIFI_SSID ""
#define OPENGLASS_WIFI_PASSWORD ""
#endif

void startCameraServer();
SemaphoreHandle_t cameraMutex = nullptr;

// Audio

// Uncomment to switch the codec
// Opus is still under development
// Mulaw is used with the web app
// PCM is used with the Friend app

// To use with the web app, comment CODEC_PCM and
// uncomment CODEC_MULAW

// #define CODEC_OPUS
// #define CODEC_MULAW
#define CODEC_PCM

#ifdef CODEC_OPUS

#include <opus.h>

#define OPUS_APPLICATION OPUS_APPLICATION_VOIP
#define OPUS_BITRATE 16000

OpusEncoder *opus_encoder = nullptr;

#define CHANNELS 1
#define MAX_PACKET_SIZE 1000

#define SAMPLE_RATE 16000
#define SAMPLE_BITS 16

#else
#ifdef CODEC_MULAW

#define SAMPLE_RATE 8000
#define SAMPLE_BITS 16

#else

#define FRAME_SIZE 160
#define SAMPLE_RATE 16000
#define SAMPLE_BITS 16

#endif
#endif

//
// BLE
//

// Device Information Service
#define DEVICE_INFORMATION_SERVICE_UUID (uint16_t)0x180A
#define MANUFACTURER_NAME_STRING_CHAR_UUID (uint16_t)0x2A29
#define MODEL_NUMBER_STRING_CHAR_UUID (uint16_t)0x2A24
#define FIRMWARE_REVISION_STRING_CHAR_UUID (uint16_t)0x2A26
#define HARDWARE_REVISION_STRING_CHAR_UUID (uint16_t)0x2A27

// Battery Level Service
#define BATTERY_SERVICE_UUID (uint16_t)0x180F
#define BATTERY_LEVEL_CHAR_UUID (uint16_t)0x2A19

// Main Friend Service
static BLEUUID serviceUUID("19B10000-E8F2-537E-4F6C-D104768A1214");
static BLEUUID audioDataUUID("19B10001-E8F2-537E-4F6C-D104768A1214");
static BLEUUID audioCodecUUID("19B10002-E8F2-537E-4F6C-D104768A1214");
static BLEUUID photoDataUUID("19B10005-E8F2-537E-4F6C-D104768A1214");
static BLEUUID photoControlUUID("19B10006-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic *audioDataCharacteristic;
BLECharacteristic *photoDataCharacteristic;
BLECharacteristic *photoControlCharacteristic;

BLECharacteristic *batteryLevelCharacteristic;

// State

bool connected = false;

uint16_t audio_frame_count = 0;

bool isCapturingPhotos = false;
int captureInterval = 0;
unsigned long lastCaptureTime = 0;

size_t sent_photo_bytes = 0;
size_t sent_photo_frames = 0;
bool photoDataUploading = false;

uint8_t batteryLevel = 100;
unsigned long lastBatteryUpdate = 0;

void handlePhotoControl(int8_t controlValue);

class ServerHandler : public BLEServerCallbacks
{
  void onConnect(BLEServer *server)
  {
    connected = true;
  }

  void onDisconnect(BLEServer *server)
  {
    connected = false;
    BLEDevice::startAdvertising();
  }
};

class PhotoControlCallback : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *characteristic)
  {
    if (characteristic->getLength() == 1)
    {
      handlePhotoControl(characteristic->getData()[0]);
    }
  }
};

void configure_ble() {
  BLEDevice::init("OpenGlass");
  BLEServer *server = BLEDevice::createServer();

  // Main service

  BLEService *service = server->createService(serviceUUID);

  // Audio characteristics
  audioDataCharacteristic = service->createCharacteristic(
    audioDataUUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  BLE2902 *ccc = new BLE2902();
  ccc->setNotifications(true);
  audioDataCharacteristic->addDescriptor(ccc);

  BLECharacteristic *audioCodecCharacteristic = service->createCharacteristic(
    audioCodecUUID,
    BLECharacteristic::PROPERTY_READ);
#ifdef CODEC_OPUS
  uint8_t codecId = 20; // Opus 16khz
#else
#ifdef CODEC_MULAW
  uint8_t codecId = 11; // MuLaw 8khz
#else
  uint8_t codecId = 1; // PCM 8khz
#endif
#endif
  audioCodecCharacteristic->setValue(&codecId, 1);

  // Photo characteristics

  photoDataCharacteristic = service->createCharacteristic(
      photoDataUUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  ccc = new BLE2902();
  ccc->setNotifications(true);
  photoDataCharacteristic->addDescriptor(ccc);

  BLECharacteristic *photoControlCharacteristic = service->createCharacteristic(
      photoControlUUID,
      BLECharacteristic::PROPERTY_WRITE);
  photoControlCharacteristic->setCallbacks(new PhotoControlCallback());
  uint8_t controlValue = 0;
  photoControlCharacteristic->setValue(&controlValue, 1);

  // Device Information Service

  BLEService *deviceInfoService = server->createService(DEVICE_INFORMATION_SERVICE_UUID);
  BLECharacteristic *manufacturerNameCharacteristic = deviceInfoService->createCharacteristic(
      MANUFACTURER_NAME_STRING_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ);
  BLECharacteristic *modelNumberCharacteristic = deviceInfoService->createCharacteristic(
      MODEL_NUMBER_STRING_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ);
  BLECharacteristic *firmwareRevisionCharacteristic = deviceInfoService->createCharacteristic(
      FIRMWARE_REVISION_STRING_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ);
  BLECharacteristic *hardwareRevisionCharacteristic = deviceInfoService->createCharacteristic(
      HARDWARE_REVISION_STRING_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ);

  manufacturerNameCharacteristic->setValue("Based Hardware");
  modelNumberCharacteristic->setValue("OpenGlass");
  firmwareRevisionCharacteristic->setValue("1.0.1");
  hardwareRevisionCharacteristic->setValue("Seeed Xiao ESP32S3 Sense");

  // Battery Service
  BLEService *batteryService = server->createService(BATTERY_SERVICE_UUID);
  batteryLevelCharacteristic = batteryService->createCharacteristic(
      BATTERY_LEVEL_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  ccc = new BLE2902();
  ccc->setNotifications(true);
  batteryLevelCharacteristic->addDescriptor(ccc);
  batteryLevelCharacteristic->setValue(&batteryLevel, 1);

  // Start the services
  service->start();
  deviceInfoService->start();
  batteryService->start();

  server->setCallbacks(new ServerHandler());

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(BATTERY_SERVICE_UUID);
  advertising->addServiceUUID(DEVICE_INFORMATION_SERVICE_UUID);
  advertising->addServiceUUID(service->getUUID());
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMaxPreferred(0x12);
  BLEDevice::startAdvertising();
}

camera_fb_t *ble_fb;

bool take_photo() {
  // Release buffer
  if (ble_fb) {
    esp_camera_fb_return(ble_fb);
    ble_fb = nullptr;
  }

  if (!cameraMutex || xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(5000)) != pdTRUE) {
    Serial.println("Camera busy; failed to acquire camera lock");
    return false;
  }

  // Take a photo
  ble_fb = esp_camera_fb_get();
  if (!ble_fb) {
    xSemaphoreGive(cameraMutex);
    Serial.println("Failed to get camera frame buffer");
    return false;
  }

  // Only protect the camera driver call. The BLE transfer can take several
  // seconds and must not block HTTP capture/stream requests.
  xSemaphoreGive(cameraMutex);
  return true;
}

void handlePhotoControl(int8_t controlValue)
{
  if (controlValue == -1)
  {
    // Take a single photo
    isCapturingPhotos = true;
    captureInterval = 0;
  }
  else if (controlValue == 0)
  {
    // Stop taking photos
    isCapturingPhotos = false;
    captureInterval = 0;
  }
  else if (controlValue >= 5 && controlValue <= 300)
  {
    // Start taking photos at specified interval
    captureInterval = (controlValue / 5) * 5000; // Round to nearest 5 seconds and convert to milliseconds
    isCapturingPhotos = true;
    lastCaptureTime = millis() - captureInterval;
  }
}

//
// Microphone
//

#ifdef CODEC_OPUS

static size_t recording_buffer_size = FRAME_SIZE * 2; // 16-bit samples
static size_t compressed_buffer_size = MAX_PACKET_SIZE;
#define VOLUME_GAIN 2

#else
#ifdef CODEC_MULAW

static size_t recording_buffer_size = 400;
static size_t compressed_buffer_size = 400 + 3; /* header */
#define VOLUME_GAIN 2

#else

static size_t recording_buffer_size = FRAME_SIZE * 2; // 16-bit samples
static size_t compressed_buffer_size = recording_buffer_size + 3; /* header */
#define VOLUME_GAIN 2

#endif
#endif

static uint8_t *s_recording_buffer = nullptr;
static uint8_t *s_compressed_frame = nullptr;
static uint8_t *s_compressed_frame_2 = nullptr;

void configure_microphone() {

  // start I2S at 16 kHz with 16-bits per sample
  I2S.setAllPins(-1, 42, 41, -1, -1);
  if (!I2S.begin(PDM_MONO_MODE, SAMPLE_RATE, SAMPLE_BITS)) {
    Serial.println("Failed to initialize I2S!");
    while (1); // do nothing
  }

  // Allocate buffers
  s_recording_buffer = (uint8_t *) calloc(recording_buffer_size, sizeof(uint8_t));
  s_compressed_frame = (uint8_t *) calloc(compressed_buffer_size, sizeof(uint8_t));
  s_compressed_frame_2 = (uint8_t *) calloc(compressed_buffer_size, sizeof(uint8_t));
  if (!s_recording_buffer || !s_compressed_frame || !s_compressed_frame_2) {
    Serial.println("Failed to allocate microphone buffers");
    while (1) {
      delay(1000);
    }
  }
}

size_t read_microphone() {
  size_t bytes_recorded = 0;
  esp_i2s::i2s_read(esp_i2s::I2S_NUM_0, s_recording_buffer, recording_buffer_size, &bytes_recorded, portMAX_DELAY);
  return bytes_recorded;
}

//
// Camera
//

void configure_camera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG; // for streaming
  bool hasPsram = psramFound();
  Serial.printf("Camera memory: PSRAM=%s, free heap=%u\n", hasPsram ? "yes" : "no", ESP.getFreeHeap());
  if (hasPsram) {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    // The XIAO can be compiled with PSRAM disabled. Keep the fallback small
    // enough for internal DRAM so camera init does not fail.
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
  cameraMutex = xSemaphoreCreateMutex();
  if (!cameraMutex) {
    Serial.println("Failed to create camera mutex");
    esp_camera_deinit();
    return;
  }
}

void updateBatteryLevel()
{
  // TODO:
  batteryLevelCharacteristic->setValue(&batteryLevel, 1);
  batteryLevelCharacteristic->notify();
}

//
// Main
//

void setup() {
  Serial.begin(921600);
  Serial.setDebugOutput(true);
  Serial.println();
  configure_camera();
  // Wi-Fi-only camera mode: BLE remains compiled for later restoration but
  // is not initialized or advertised while the camera transport is being
  // validated.
  if (strlen(OPENGLASS_WIFI_SSID) > 0) {
    WiFi.mode(WIFI_STA);
    // ESP32-S3 requires modem sleep when Wi-Fi and Bluetooth coexist.
    WiFi.setSleep(true);
    WiFi.begin(OPENGLASS_WIFI_SSID, OPENGLASS_WIFI_PASSWORD);
    Serial.print("Connecting to WiFi");
    unsigned long wifiStart = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 15000) {
      delay(250);
      Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("Camera Ready! Use http://");
      Serial.print(WiFi.localIP());
      Serial.println(" (capture: /capture, stream: :81/stream)");
      startCameraServer();
    } else {
      Serial.println("WiFi unavailable; camera server not started.");
    }
  } else {
    Serial.println("WiFi credentials not configured; camera server not started.");
  }
}

void loop() {
  // CameraWebServer runs in its own HTTP task. Keep loop idle so no audio or
  // BLE work can contend with camera DMA.
  delay(10000);
}
