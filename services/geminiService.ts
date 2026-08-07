import { GoogleGenAI } from "@google/genai";
import axios from "axios";

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

const normalizeImageUrl = (url: string): string => {
  if (!url) return '';
  // Some APIs return base64 strings instead of URLs
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:')) {
    return url;
  }
  // If it's a raw base64 string without data: prefix
  if (url.length > 1000) {
    return `data:image/png;base64,${url}`;
  }
  return url;
};

const handleServiceError = (error: any, fallbackMessage: string): never => {
  console.error("Gemini API Error Details:", error);
  
  // Extract error message from axios/fetch/GoogleGenAI responses
  let msg = error?.response?.data?.error?.message || error?.message || "未知错误";
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    } catch (_) {
      msg = "未知错误";
    }
  }

  const errorStr = msg.toLowerCase();
  if (
    errorStr.includes("exhausted") ||
    errorStr.includes("quota") ||
    errorStr.includes("balance") ||
    errorStr.includes("insufficient") ||
    errorStr.includes("额度") ||
    errorStr.includes("用尽") ||
    errorStr.includes("402") ||
    errorStr.includes("403") ||
    errorStr.includes("429") ||
    errorStr.includes("point") ||
    errorStr.includes("credit")
  ) {
    throw new Error("该令牌额度已用尽 (request id: 20260622164054695403138c96lrRzi)");
  }
  
  throw new Error(`${fallbackMessage}: ${msg}`);
};

export const generateImageEdit = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  config: {
    useCustomApi: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    gptApiKey?: string;
    model: string;
    imageSize?: '1K' | '2K' | '4K';
  }
): Promise<string> => {
  const { useCustomApi, customBaseUrl, customApiKey, gptApiKey, model, imageSize } = config;
  
  if (model === 'gpt-image-2') {
    if (!gptApiKey) {
      throw new Error("gpt-image-2 API Key 缺失。请在设置中输入。");
    }

    const formData = new FormData();
    const blob = base64ToBlob(base64Image, mimeType);
    formData.append("image", blob, "image.png");
    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-2");
    formData.append("n", "1");

    const response = await axios.post('https://magic666.top/v1/images/edits', formData, {
      headers: {
        'Authorization': `Bearer ${gptApiKey}`,
        'Accept': 'application/json'
      }
    });

    const urls = response.data.data
      .map((img: any) => normalizeImageUrl(img.url || img.b64_json || ''))
      .filter((src: string): src is string => !!src);

    if (urls.length > 0) return urls[0];
    throw new Error("响应中未找到图片数据");
  }

  // Determine which key to use: User-provided custom key or system environment key
  const finalApiKey = (useCustomApi && customApiKey) ? customApiKey : process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key 缺失。请在设置中输入自定义 Key 或确保环境变量已配置。");
  }

  // Configure options
  const options: any = { apiKey: finalApiKey };
  if (useCustomApi) {
    options.httpOptions = { baseUrl: "https://api.vectorengine.cn" };
  }

  const ai = new GoogleGenAI(options);

  // Prepare generation config
  const generationConfig: any = {};
  
  // Only apply imageConfig (resolution) for the Pro model (Nano Banana 2 / gemini-3-pro-image-preview) or Flash Preview
  if ((model === 'gemini-3-pro-image-preview' || model === 'gemini-3.1-flash-image-preview') && imageSize) {
    generationConfig.imageConfig = {
      imageSize: imageSize
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: `${prompt} Maintain the character's visual identity and style as much as possible. High quality, photorealistic.`,
          },
        ],
      },
      config: generationConfig,
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
        const parts = candidates[0].content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
    }
    
    throw new Error("响应中未找到图片数据");

  } catch (error: any) {
    handleServiceError(error, "API 调用失败");
  }
};

export const generatePoseTransfer = async (
  baseImageBase64: string,
  baseImageMimeType: string,
  poseImageBase64: string,
  poseImageMimeType: string,
  config: {
    useCustomApi: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    gptApiKey?: string;
    model: string;
    imageSize?: '1K' | '2K' | '4K';
    aspectRatio?: string;
    transferPose?: boolean;
    transferClothing?: boolean;
    transferBackground?: boolean;
    transferHairStyle?: boolean;
    transferFace?: boolean;
  }
): Promise<string> => {
  const { 
    useCustomApi, customBaseUrl, customApiKey, gptApiKey, model, imageSize, aspectRatio,
    transferPose: shouldTransferPose = true,
    transferClothing = false,
    transferBackground = false,
    transferHairStyle = false,
    transferFace = false
  } = config;
  
  if (model === 'gpt-image-2') {
    if (!gptApiKey) {
      throw new Error("gpt-image-2 API Key 缺失。请在设置中输入。");
    }

    let gptPrompt = `Perform visual element transfer between base image [Image 1] and reference image [Image 2].`;
    if (transferFace) gptPrompt += ` Adopt person face and identity from reference image [Image 2].`;
    else gptPrompt += ` Keep person face and identity from base image [Image 1].`;

    if (shouldTransferPose) gptPrompt += ` Adopt pose and body posture from reference image [Image 2].`;
    else gptPrompt += ` Keep posture from base image [Image 1].`;

    if (transferClothing) gptPrompt += ` Adopt clothing and outfit from reference image [Image 2].`;
    else gptPrompt += ` Keep clothing from base image [Image 1].`;

    if (transferBackground) gptPrompt += ` Adopt background and scene environment from reference image [Image 2].`;
    else gptPrompt += ` Keep background from base image [Image 1].`;

    if (transferHairStyle) gptPrompt += ` Adopt hair style and makeup from reference image [Image 2].`;
    else gptPrompt += ` Keep hair style from base image [Image 1].`;

    const formData = new FormData();
    formData.append("image", base64ToBlob(baseImageBase64, baseImageMimeType), "base.png");
    formData.append("image", base64ToBlob(poseImageBase64, poseImageMimeType), "pose.png");
    formData.append("prompt", gptPrompt);
    formData.append("model", "gpt-image-2");
    formData.append("n", "1");

    const response = await axios.post('https://magic666.top/v1/images/edits', formData, {
      headers: {
        'Authorization': `Bearer ${gptApiKey}`,
        'Accept': 'application/json'
      }
    });

    const urls = response.data.data
      .map((img: any) => normalizeImageUrl(img.url || img.b64_json || ''))
      .filter((src: string): src is string => !!src);

    if (urls.length > 0) return urls[0];
    throw new Error("响应中未找到图片数据");
  }

  const finalApiKey = (useCustomApi && customApiKey) ? customApiKey : process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key 缺失。请在设置中输入自定义 Key 或确保环境变量已配置。");
  }

  const options: any = { apiKey: finalApiKey };
  if (useCustomApi) {
    options.httpOptions = { baseUrl: "https://api.vectorengine.cn" };
  }

  const ai = new GoogleGenAI(options);

  const generationConfig: any = {};
  
  if (model === 'gemini-3-pro-image-preview' || model === 'gemini-3.1-flash-image-preview') {
    generationConfig.imageConfig = {};
    if (imageSize) {
      generationConfig.imageConfig.imageSize = imageSize;
    }
    if (aspectRatio) {
      generationConfig.imageConfig.aspectRatio = aspectRatio;
    }
  }

  const faceInstruction = transferFace
    ? "1. FACE & IDENTITY (换脸模式): Adopt and replicate the facial features, face, and person identity from [Image 2] (Reference Image) onto the target."
    : "1. FACE & IDENTITY (保持底图人脸): STRICTLY maintain the character's facial features, face, eyes, and person identity from [Image 1] (Base Image).";

  const poseInstruction = shouldTransferPose
    ? "2. POSE & BODY POSTURE: Adopt and replicate the exact posture, body angle, arm/leg placement, and camera shot angle from [Image 2] (Reference Image)."
    : "2. POSE & BODY POSTURE: Maintain the original body posture and camera angle from [Image 1] (Base Image).";

  const clothingInstruction = transferClothing
    ? "3. CLOTHING & OUTFIT: Adopt and replicate the clothing, outfit, style, garments, and accessories from [Image 2] (Reference Image)."
    : "3. CLOTHING & OUTFIT: Maintain the original clothing, outfit, and style from [Image 1] (Base Image).";

  const backgroundInstruction = transferBackground
    ? "4. BACKGROUND & SCENE: Adopt and replicate the background, indoor/outdoor scene, furniture, lighting, and environment from [Image 2] (Reference Image)."
    : "4. BACKGROUND & SCENE: STRICTLY maintain the original background scene and room environment from [Image 1] (Base Image).";

  const hairInstruction = transferHairStyle
    ? "5. HAIR & MAKEUP: Adopt the hairstyle, hair color, and makeup style from [Image 2] (Reference Image)."
    : "5. HAIR & MAKEUP: Maintain the hairstyle and hair color from [Image 1] (Base Image).";

  const prompt = `You are an expert AI photo compositor and editor. I am providing two images.

[Image 1]: Base Image (底图).
[Image 2]: Reference Image (参考图).

Task: Generate a seamless, photorealistic new photograph combining elements according to these EXACT rules:

${faceInstruction}
${poseInstruction}
${clothingInstruction}
${backgroundInstruction}
${hairInstruction}

The final image must look like a high-quality photorealistic photograph with natural lighting, realistic shadows, perfect blending, and sharp details.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: baseImageBase64,
              mimeType: baseImageMimeType,
            },
          },
          {
            inlineData: {
              data: poseImageBase64,
              mimeType: poseImageMimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: generationConfig,
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
        const parts = candidates[0].content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
    }
    
    throw new Error("响应中未找到图片数据");

  } catch (error: any) {
    handleServiceError(error, "API 调用失败");
  }
};

export const generateImageWithReference = async (
  referenceImageBase64: string,
  referenceImageMimeType: string,
  prompt: string,
  config: {
    useCustomApi: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    gptApiKey?: string;
    model: string;
    imageSize?: '1K' | '2K' | '4K';
  }
): Promise<string> => {
  const { useCustomApi, customBaseUrl, customApiKey, gptApiKey, model, imageSize } = config;
  
  if (model === 'gpt-image-2') {
    if (!gptApiKey) {
      throw new Error("gpt-image-2 API Key 缺失。请在设置中输入。");
    }

    const formData = new FormData();
    formData.append("image", base64ToBlob(referenceImageBase64, referenceImageMimeType), "ref.png");
    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-2");
    formData.append("n", "1");

    const response = await axios.post('https://magic666.top/v1/images/edits', formData, {
      headers: {
        'Authorization': `Bearer ${gptApiKey}`,
        'Accept': 'application/json'
      }
    });

    const urls = response.data.data
      .map((img: any) => normalizeImageUrl(img.url || img.b64_json || ''))
      .filter((src: string): src is string => !!src);

    if (urls.length > 0) return urls[0];
    throw new Error("响应中未找到图片数据");
  }

  const finalApiKey = (useCustomApi && customApiKey) ? customApiKey : process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key 缺失。请在设置中输入自定义 Key 或确保环境变量已配置。");
  }

  const options: any = { apiKey: finalApiKey };
  if (useCustomApi) {
    options.httpOptions = { baseUrl: "https://api.vectorengine.cn" };
  }

  const ai = new GoogleGenAI(options);

  const generationConfig: any = {};
  
  if ((model === 'gemini-3-pro-image-preview' || model === 'gemini-3.1-flash-image-preview')) {
    generationConfig.imageConfig = {
      aspectRatio: '9:16'
    };
    if (imageSize) {
      generationConfig.imageConfig.imageSize = imageSize;
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: referenceImageBase64,
              mimeType: referenceImageMimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: generationConfig,
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
        const parts = candidates[0].content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
    }
    
    throw new Error("响应中未找到图片数据");

  } catch (error: any) {
    handleServiceError(error, "API 调用失败");
  }
};

export const generateTextToImage = async (
  prompt: string,
  config: {
    useCustomApi: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    gptApiKey?: string;
    model: string;
    imageSize?: '1K' | '2K' | '4K';
    aspectRatio?: string;
  },
  referenceImage?: { base64: string, mimeType: string }
): Promise<string> => {
  const { useCustomApi, customBaseUrl, customApiKey, gptApiKey, model, imageSize, aspectRatio } = config;
  
  if (model === 'gpt-image-2') {
    if (!gptApiKey) {
      throw new Error("gpt-image-2 API Key 缺失。请在设置中输入。");
    }

    let response;
    if (referenceImage) {
      const formData = new FormData();
      formData.append("image", base64ToBlob(referenceImage.base64, referenceImage.mimeType), "ref.png");
      formData.append("prompt", prompt);
      formData.append("model", "gpt-image-2");
      formData.append("n", "1");

      response = await axios.post('https://magic666.top/v1/images/edits', formData, {
        headers: {
          'Authorization': `Bearer ${gptApiKey}`,
          'Accept': 'application/json'
        }
      });
    } else {
      response = await axios.post('https://magic666.top/v1/images/generations', {
        prompt: prompt,
        model: "gpt-image-2",
        n: 1
      }, {
        headers: {
          'Authorization': `Bearer ${gptApiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    }

    const urls = response.data.data
      .map((img: any) => normalizeImageUrl(img.url || img.b64_json || ''))
      .filter((src: string): src is string => !!src);

    if (urls.length > 0) return urls[0];
    throw new Error("响应中未找到图片数据");
  }

  const finalApiKey = (useCustomApi && customApiKey) ? customApiKey : process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key 缺失。请在设置中输入自定义 Key 或确保环境变量已配置。");
  }

  const options: any = { apiKey: finalApiKey };
  if (useCustomApi) {
    options.httpOptions = { baseUrl: "https://api.vectorengine.cn" };
  }

  const ai = new GoogleGenAI(options);

  const generationConfig: any = {
    imageConfig: {
      aspectRatio: aspectRatio || '9:16'
    }
  };
  
  if (imageSize) {
    generationConfig.imageConfig.imageSize = imageSize;
  }

  try {
    const parts: any[] = [];
    
    if (referenceImage) {
      parts.push({
        inlineData: {
          data: referenceImage.base64,
          mimeType: referenceImage.mimeType,
        },
      });
    }

    parts.push({
      text: prompt,
    });

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      config: generationConfig,
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
        const partsList = candidates[0].content?.parts;
        if (partsList) {
            for (const part of partsList) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
    }
    
    throw new Error("响应中未找到图片数据");

  } catch (error: any) {
    handleServiceError(error, "API 调用失败");
  }
};

export const generateTryOn = async (
  modelImageBase64: string,
  modelImageMimeType: string,
  clothingImageBase64: string | null | undefined,
  clothingImageMimeType: string | null | undefined,
  prompt: string,
  config: {
    useCustomApi: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    gptApiKey?: string;
    model: string;
    imageSize?: '1K' | '2K' | '4K';
  },
  stockingImageBase64?: string,
  stockingImageMimeType?: string
): Promise<string> => {
  const { useCustomApi, customBaseUrl, customApiKey, gptApiKey, model, imageSize } = config;
  
  if (model === 'gpt-image-2') {
    if (!gptApiKey) {
      throw new Error("gpt-image-2 API Key 缺失。请在设置中输入。");
    }

    const formData = new FormData();
    formData.append("image", base64ToBlob(modelImageBase64, modelImageMimeType), "model.png");
    if (clothingImageBase64 && clothingImageMimeType) {
      formData.append("image", base64ToBlob(clothingImageBase64, clothingImageMimeType), "clothing.png");
    }
    if (stockingImageBase64 && stockingImageMimeType) {
      formData.append("image", base64ToBlob(stockingImageBase64, stockingImageMimeType), "stocking.png");
    }
    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-2");
    formData.append("n", "1");

    const response = await axios.post('https://magic666.top/v1/images/edits', formData, {
      headers: {
        'Authorization': `Bearer ${gptApiKey}`,
        'Accept': 'application/json'
      }
    });

    const urls = response.data.data
      .map((img: any) => normalizeImageUrl(img.url || img.b64_json || ''))
      .filter((src: string): src is string => !!src);

    if (urls.length > 0) return urls[0];
    throw new Error("响应中未找到图片数据");
  }

  const finalApiKey = (useCustomApi && customApiKey) ? customApiKey : process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key 缺失。请在设置中输入自定义 Key 或确保环境变量已配置。");
  }

  const options: any = { apiKey: finalApiKey };
  if (useCustomApi) {
    options.httpOptions = { baseUrl: "https://api.vectorengine.cn" };
  }

  const ai = new GoogleGenAI(options);

  const generationConfig: any = {
    imageConfig: {
      aspectRatio: '9:16'
    }
  };
  
  if ((model === 'gemini-3-pro-image-preview' || model === 'gemini-3.1-flash-image-preview') && imageSize) {
    generationConfig.imageConfig.imageSize = imageSize;
  }

  try {
    const parts: any[] = [];

    if (clothingImageBase64 && clothingImageMimeType) {
      parts.push({
        inlineData: {
          data: clothingImageBase64,
          mimeType: clothingImageMimeType,
        },
      });
    }

    parts.push({
      inlineData: {
        data: modelImageBase64,
        mimeType: modelImageMimeType,
      },
    });

    if (stockingImageBase64 && stockingImageMimeType) {
      parts.push({
        inlineData: {
          data: stockingImageBase64,
          mimeType: stockingImageMimeType,
        },
      });
    }

    parts.push({
      text: prompt,
    });

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      config: generationConfig,
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
        const parts = candidates[0].content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }
    }
    
    throw new Error("响应中未找到图片数据");

  } catch (error: any) {
    handleServiceError(error, "API 调用失败");
  }
};