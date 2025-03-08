// FAL.ai API客户端
import { fal } from "@fal-ai/client";
import { respData, respErr } from "@/lib/resp";
import { getUserUuid } from "@/services/user";
import { CreditsAmount, CreditsTransType, decreaseCredits } from "@/services/credit";
import { getUserCredits } from "@/services/credit";
// import { User } from "@/types/user";
// import { Wallpaper } from "@/models/wallpaper";
// import { currentUser } from "@clerk/nextjs";
// import { downloadAndUploadImage } from "@/lib/s3";
// import { getUserCredits } from "@/services/order";
 // 壁纸数据库操作
// import { insertWallpaper } from "@/models/wallpaper";
// import { saveUser } from "@/services/user";


export const maxDuration = 60;
// 环境变量中获取FAL.ai key
const fal_key = process.env.FAL_KEY
fal.config({
  credentials: fal_key, // 替换为你的FAL API密钥
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
    if (!userCredits || userCredits.left_credits < CreditsAmount.ImageGenCost) {
      return respErr("credits_not_enough");
    }

    // 3. 获取请求参数
    const { description, img_size, style } = await req.json();
    if (!description) {
      return respErr("invalid params");
    }

    // 4. 配置AI绘图参数
    const falai_params = {
      prompt: description,
      model: "fal-ai/recraft-v3",
      num_images: 1,
      image_size: img_size,
      guidance_scale: 3.5,
      enable_safety_checker: true,
      style: style || "realistic_image",
    };
    console.log("🚀 ~ POST ~ alai_params:", falai_params)
    const created_at = new Date().toISOString();

    // 5. 调用FAL.ai API生成图片
    const res = await retryWithDelay(() => 
      fal.subscribe("fal-ai/recraft-v3", {
        input: falai_params,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        },
      })
    );
    console.log("🚀 ~ POST ~ res.data.images[0].url:", res.data.images[0].url)
    
    const raw_img_url = res.data.images[0].url;
    if (!raw_img_url) {
      return respErr("generate wallpaper failed");
    }

    // 6. 扣除积分
    await decreaseCredits({
      user_uuid,
      trans_type: CreditsTransType.ImageGen,
      credits: CreditsAmount.ImageGenCost,
    });

    // 7. 保存图片到R2
    // const img_name = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    // try {
    //   await downloadAndUploadImage(
    //     raw_img_url,
    //     process.env.AWS_BUCKET || "trysai",
    //     `wallpapers/${img_name}.png`
    //   );
    // } catch (e) {
    //   console.log("Upload to R2 failed:", e);
    // }

    // 8. 保存壁纸信息到数据库
    const wallpaper = {
      img_description: description,
      img_size: img_size,
      img_url: raw_img_url,
      llm_name: "recraft-v3",
      llm_params: JSON.stringify(falai_params),
      created_at: created_at,
    };
    // await insertWallpaper(wallpaper);

    return respData(wallpaper);
  } catch (e) {
    console.log("generate cross design failed: ", e);
    return respErr("generate cross design failed");
  }
}