import type { ImageModelV1, ImageModelV1CallWarning } from "@ai-sdk/provider";
import { KlingImageModelId, KlingImageSettings } from "./kling-image-settings";

import { FetchFunction } from "@ai-sdk/provider-utils";
import type { Resolvable } from "@ai-sdk/provider-utils";
import { newClient } from "./image-generation";

interface KlingImageModelConfig {
  accessKey: string;
  secretKey: string;
  provider: string;
  baseURL: string;
  headers: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
}

export class KlingImageModel implements ImageModelV1 {
  readonly specificationVersion = "v1";

  readonly modelId: KlingImageModelId;
  readonly settings: KlingImageSettings;

  private readonly config: KlingImageModelConfig;

  get provider(): string {
    return this.config.provider;
  }

  get maxImagesPerCall(): number {
    return this.settings.maxImagesPerCall ?? 1;
  }

  constructor(
    modelId: KlingImageModelId,
    settings: KlingImageSettings,
    config: KlingImageModelConfig
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doGenerate({
    prompt,
    n,
    aspectRatio,
    size,
    seed,
    providerOptions,
    headers,
    abortSignal,
  }: Parameters<ImageModelV1["doGenerate"]>[0]): Promise<
    Awaited<ReturnType<ImageModelV1["doGenerate"]>>
  > {
    const warnings: Array<ImageModelV1CallWarning> = [];
    let images: Array<Uint8Array> = [];

    const imgUrls: Array<string> = [];

    if (!this.config.accessKey || !this.config.secretKey) {
      warnings.push({
        type: "other",
        message: "Kling access key or secret key is not set",
      });
      return { images, warnings };
    }

    try {
      const client = await newClient({
        accessKey: this.config.accessKey,
        secretKey: this.config.secretKey,
      });

      const task = await client.createTask({
        model: this.modelId,
        prompt,
        n,
        size,
        aspect_ratio: aspectRatio,
        ...(providerOptions.kling ?? {}),
      });

      if (!task.data || !task.data.task_id) {
        warnings.push({
          type: "other",
          message: task.message,
        });
        return { images, warnings };
      }

      const taskId = task.data.task_id;

      const maxAttempts = 20;
      const pollingInterval = 3000;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const result = await client.queryTask({ task_id: taskId });
        console.log("kling gen images result:", JSON.stringify(result));

        if (!result.data || !result.data.task_status) {
          continue;
        }

        if (result.data.task_status === "succeed") {
          if (result.data.task_result && result.data.task_result.images) {
            result.data.task_result.images.forEach((img: any) => {
              imgUrls.push(img.url);
            });
          }
          break;
        } else if (result.data.task_status === "failed") {
          warnings.push({
            type: "other",
            message: result.data.task_status_msg || "Task failed",
          });
          break;
        }

        if (abortSignal?.aborted) {
          throw new Error("Operation aborted");
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }

      if (attempts >= maxAttempts) {
        warnings.push({
          type: "other",
          message: "Task timed out",
        });
      }
    } catch (error: any) {
      console.error("Kling generate image failed:", error);
      warnings.push({
        type: "other",
        message: error.message,
      });
    }

    if (imgUrls.length === 0) {
      warnings.push({
        type: "other",
        message: "No images generated",
      });
      return { images, warnings };
    }

    images = await Promise.all(
      imgUrls.map(async (url) => {
        const response = await fetch(url);
        return new Uint8Array(await response.arrayBuffer());
      })
    );

    return { images, warnings };
  }
}
