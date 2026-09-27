import { Config } from "@remotion/cli/config";

// Qualité de diffusion : h264 à CRF 16, images intermédiaires en JPEG 95.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
