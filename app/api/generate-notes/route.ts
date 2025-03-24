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

// 为笔记生成定义新的积分类型和数量
// 这里假设CreditsAmount和CreditsTransType需要在相应的服务中更新
// CreditsAmount.NotesGenerationCost = 2;
// CreditsTransType.NotesGeneration = 'notes_generation';

export async function POST(req: Request) {
  try {
    // 1. 用户认证检查
    const user_uuid = await getUserUuid();
    if (!user_uuid) {
      return respErr("no auth");
    }

    // 2. 检查用户积分
    const userCredits = await getUserCredits(user_uuid);
    if (!userCredits || userCredits.left_credits < CreditsAmount.NotesGenerationCost) {
      console.log(`🚀 ~ POST ~ "credits_not_enough":`, "credits_not_enough")
      return respErr("credits_not_enough");
    }

    // 3. 获取转录文本
    const body = await req.json();
    const { text } = body;
    
    if (!text) {
      return respErr("no text provided");
    }

    // 4. 调用Claude 3.5 Sonnet生成笔记
    try {
      const res = await retryWithDelay(() => 
        fal.subscribe("fal-ai/any-llm", {
          input: {
            prompt: `You are an information organization expert.
            Please analyze the following text (from an audio transcription) and convert it into structured notes.
            Do not use Markdown format. Instead, use numbered hierarchy to indicate structure, for example:
            
            1. Main topic one
                1.1 Subtopic
                1.2 Subtopic
                   1.2.1 More detailed point
            2. Main topic two
                2.1 Subtopic
            
            Identify key topics and main points, keeping the notes concise and clear, with emphasis on logical flow.
            Content should be comprehensive yet concise, making it easy to review and understand.
            
            Here is the transcription:
            
            ${text}`,
            model: "anthropic/claude-3.5-sonnet"
          },
          logs: true
        })
      );
      console.log("🚀 ~ POST ~ res:", res)
      
      if (!res.data || !res.data.output) {
        return respErr("notes generation failed");
      }

      // 5. 扣除积分
      await decreaseCredits({
        user_uuid,
        trans_type: CreditsTransType.NotesGeneration,
        credits: CreditsAmount.NotesGenerationCost,
      });

      // 6. 返回生成的笔记
      return respData({
        notes: res.data.output
      });
    } catch (genError) {
      console.error("Notes generation error:", genError);
      return respErr("notes generation failed");
    }
    
  } catch (error) {
    console.error("Notes generation error:", error);
    return respErr("notes generation failed");
  }
} 