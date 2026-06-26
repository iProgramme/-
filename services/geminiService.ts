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
  }
): Promise<string> => {
  const { useCustomApi, customBaseUrl, customApiKey, gptApiKey, model, imageSize, aspectRatio } = config;
  
  if (model === 'gpt-image-2') {
    // For pose transfer, gpt-image-2 might not support multiple images in 'edits' easily via the standard OpenAI-like API
    // but the user DEMO shows it can take multiple files? 
    // "currentUploadedFiles.forEach(file => formData.append("image", file));"
    // So let's try sending both.
    if (!gptApiKey) {
      throw new Error("gpt-image-2 API Key 缺失。请在设置中输入。");
    }

    const formData = new FormData();
    formData.append("image", base64ToBlob(baseImageBase64, baseImageMimeType), "base.png");
    formData.append("image", base64ToBlob(poseImageBase64, poseImageMimeType), "pose.png");
    formData.append("prompt", `Perform pose transfer from pose image to base image. Maintain identity. High quality.`);
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

  const prompt = `You are an expert AI photo editor. I am providing two images.

[Image 1]: The base image. This image defines the character's identity, face, hair, clothing, and the background scene/environment.
[Image 2]: The reference pose image. This image defines the target pose, body language, and camera angle.

Task: Generate a new image of the character from [Image 1] performing the exact pose and viewed from the exact camera angle shown in [Image 2].

CRITICAL CONSTRAINTS:
1. STRICTLY maintain the character's original identity, face, and clothing from [Image 1]. Do not change the person's appearance.
2. STRICTLY maintain the original background scene and environment from [Image 1]. Do not change or hallucinate a new background.
3. The character's pose, body language, and the camera's shooting angle MUST perfectly match [Image 2].
4. The final image should look like a natural photo of the person from [Image 1] striking the pose from [Image 2] in their original environment.

High quality, photorealistic.`;

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
  clothingImageBase64: string,
  clothingImageMimeType: string,
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
    formData.append("image", base64ToBlob(clothingImageBase64, clothingImageMimeType), "clothing.png");
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
    const parts: any[] = [
      {
        inlineData: {
          data: clothingImageBase64,
          mimeType: clothingImageMimeType,
        },
      },
      {
        inlineData: {
          data: modelImageBase64,
          mimeType: modelImageMimeType,
        },
      }
    ];

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