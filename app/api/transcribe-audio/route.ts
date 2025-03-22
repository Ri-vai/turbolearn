import { fal } from "@fal-ai/client";
import { respData, respErr } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { CreditsAmount, CreditsTransType, decreaseCredits } from "@/services/credit";
import { getUserCredits } from "@/services/credit";

export const maxDuration = 60;
// 环境变量中获取FAL.ai key
const fal_key = process.env.FAL_KEY
fal.config({
  credentials: fal_key,
});

// 增加重试逻辑
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithDelay(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    // 1. 用户认证检查
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respErr("no auth");
    }

    // 2. 检查用户积分
    const userCredits = await getUserCredits(user_uuid);
    if (!userCredits || userCredits.left_credits < CreditsAmount.AudioTranscribeCost) {
      return respErr("credits_not_enough");
    }

    // 3. 获取音频文件
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return respErr("no audio file");
    }

    // 4. 使用FAL.ai的文件上传API，而不是base64
    try {
      // 直接上传文件，而不是转换为base64
      const audioUrl = await fal.storage.upload(audioFile);
      
      // 5. 调用FAL.ai Whisper API进行转录
      const res = await retryWithDelay(() => 
        fal.subscribe("fal-ai/whisper", {
          input: {
            // 使用上传后的URL
            audio_url: audioUrl,
            task: "transcribe",
            language: null,
            diarize: false,
            chunk_level: "segment",
            version: "3",
            prompt: "",
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              update.logs.map((log) => log.message).forEach(console.log);
            }
          },
        })
      );
      
      if (!res.data || !res.data.text) {
        return respErr("transcription failed");
      }

      // 6. 扣除积分
      await decreaseCredits({
        user_uuid,
        trans_type: CreditsTransType.AudioTranscribe,
        credits: CreditsAmount.AudioTranscribeCost,
      });

      // 7. 返回转录结果，包括更丰富的信息
      return respData({
        text: res.data.text,
        chunks: res.data.chunks || [],
        inferred_languages: res.data.inferred_languages || [],
      });
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      return respErr("file upload failed");
    }
    
  } catch (error) {
    console.error("Transcription error:", error);
    return respErr("transcription failed");
  }
} 