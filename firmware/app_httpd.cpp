#include "esp_camera.h"
#include "esp_http_server.h"
#include "freertos/semphr.h"
#include <cstring>

extern SemaphoreHandle_t cameraMutex;

static const char *STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=123456789000000000000987654321";
static const char *STREAM_BOUNDARY = "\r\n--123456789000000000000987654321\r\n";
static const char *STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static esp_err_t addCors(httpd_req_t *request, const char *contentType) {
  httpd_resp_set_type(request, contentType);
  httpd_resp_set_hdr(request, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(request, "Cache-Control", "no-store");
  return ESP_OK;
}

static esp_err_t indexHandler(httpd_req_t *request) {
  addCors(request, "text/plain");
  return httpd_resp_send(request, "OpenGlass camera is ready. Use /capture or /stream.", HTTPD_RESP_USE_STRLEN);
}

static esp_err_t captureHandler(httpd_req_t *request) {
  if (!cameraMutex || xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(5000)) != pdTRUE) {
    httpd_resp_send_500(request);
    return ESP_FAIL;
  }
  camera_fb_t *frame = esp_camera_fb_get();
  if (!frame) {
    xSemaphoreGive(cameraMutex);
    httpd_resp_send_500(request);
    return ESP_FAIL;
  }
  addCors(request, "image/jpeg");
  httpd_resp_set_hdr(request, "Content-Disposition", "inline; filename=capture.jpg");
  esp_err_t result = httpd_resp_send(request, reinterpret_cast<const char *>(frame->buf), frame->len);
  esp_camera_fb_return(frame);
  xSemaphoreGive(cameraMutex);
  return result;
}

static esp_err_t streamHandler(httpd_req_t *request) {
  addCors(request, STREAM_CONTENT_TYPE);
  httpd_resp_set_hdr(request, "X-Framerate", "20");
  char part[96];

  while (true) {
    if (!cameraMutex || xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(5000)) != pdTRUE) {
      break;
    }
    camera_fb_t *frame = esp_camera_fb_get();
    if (!frame) {
      xSemaphoreGive(cameraMutex);
      break;
    }

    esp_err_t result = httpd_resp_send_chunk(request, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (result == ESP_OK) {
      int headerLength = snprintf(part, sizeof(part), STREAM_PART, frame->len);
      result = httpd_resp_send_chunk(request, part, headerLength);
    }
    if (result == ESP_OK) {
      result = httpd_resp_send_chunk(request, reinterpret_cast<const char *>(frame->buf), frame->len);
    }
    esp_camera_fb_return(frame);
    xSemaphoreGive(cameraMutex);
    if (result != ESP_OK) break;
    vTaskDelay(pdMS_TO_TICKS(50));
  }

  httpd_resp_send_chunk(request, nullptr, 0);
  return ESP_OK;
}

void startCameraServer() {
  httpd_config_t cameraConfig = HTTPD_DEFAULT_CONFIG();
  cameraConfig.server_port = 80;
  cameraConfig.ctrl_port = 32768;

  httpd_uri_t indexUri = {
      .uri = "/",
      .method = HTTP_GET,
      .handler = indexHandler,
      .user_ctx = nullptr,
  };
  httpd_uri_t captureUri = {
      .uri = "/capture",
      .method = HTTP_GET,
      .handler = captureHandler,
      .user_ctx = nullptr,
  };

  httpd_handle_t cameraHttpd = nullptr;
  if (httpd_start(&cameraHttpd, &cameraConfig) == ESP_OK) {
    httpd_register_uri_handler(cameraHttpd, &indexUri);
    httpd_register_uri_handler(cameraHttpd, &captureUri);
  }

  httpd_config_t streamConfig = HTTPD_DEFAULT_CONFIG();
  streamConfig.server_port = 81;
  streamConfig.ctrl_port = 32769;
  httpd_uri_t streamUri = {
      .uri = "/stream",
      .method = HTTP_GET,
      .handler = streamHandler,
      .user_ctx = nullptr,
  };

  httpd_handle_t streamHttpd = nullptr;
  if (httpd_start(&streamHttpd, &streamConfig) == ESP_OK) {
    httpd_register_uri_handler(streamHttpd, &streamUri);
  }
}
