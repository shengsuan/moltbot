import {
  createOpenAiCompatibleImageGenerationProvider,
  type ImageGenerationProvider,
  type ImageGenerationSourceImage,
  toImageDataUrl,
} from "openclaw/plugin-sdk/image-generation";
import { SHENGSUANYUN_BASE_URL } from "./provider-catalog.js";

const DEFAULT_SIZE = "1024x1024";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const SUPPORTED_SIZES = [
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1024x1792",
  "1536x1024",
  "1792x1024",
] as const;

function imageToDataUrl(image: ImageGenerationSourceImage): string {
  return toImageDataUrl({ buffer: image.buffer, mimeType: image.mimeType });
}

export function buildShengSuanYunImageGenerationProvider(): ImageGenerationProvider {
  return createOpenAiCompatibleImageGenerationProvider({
    id: "shengsuanyun",
    label: "胜算云",
    defaultModel: DEFAULT_IMAGE_MODEL,
    models: [DEFAULT_IMAGE_MODEL],
    capabilities: {
      generate: {
        maxCount: 4,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      edit: {
        enabled: true,
        maxCount: 4,
        maxInputImages: 5,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      geometry: {
        sizes: [...SUPPORTED_SIZES],
      },
    },
    defaultBaseUrl: SHENGSUANYUN_BASE_URL,
    buildGenerateRequest: ({ req, model, count }) => ({
      kind: "json",
      body: {
        model,
        prompt: req.prompt,
        n: count,
        size: req.size ?? DEFAULT_SIZE,
      },
    }),
    buildEditRequest: ({ req, inputImages, model, count }) => ({
      kind: "json",
      body: {
        model,
        prompt: req.prompt,
        n: count,
        size: req.size ?? DEFAULT_SIZE,
        images: inputImages.map((image) => ({
          image_url: imageToDataUrl(image),
        })),
      },
    }),
    missingApiKeyError: "胜算云 API key missing",
    failureLabels: {
      generate: "胜算云 image generation failed",
      edit: "胜算云 image edit failed",
    },
  });
}
