import { GoogleGenAI } from "@google/genai";

export const generateImageEdit = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  config: {
    useCustomApi: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    model: string;
    imageSize?: '1K' | '2K' | '4K';
  }
): Promise<string> => {
  const { useCustomApi, customBaseUrl, customApiKey, model, imageSize } = config;
  
  // Determine which key to use: User-provided custom key or system environment key
  const finalApiKey = (useCustomApi && customApiKey) ? customApiKey : process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key 缺失。请在设置中输入自定义 Key 或确保环境变量已配置。");
  }

  // Configure options
  const options: any = { apiKey: finalApiKey };
  if (useCustomApi && customBaseUrl) {
    options.httpOptions = { baseUrl: customBaseUrl };
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
    console.error("Gemini API Error:", error);
    // If we have a detailed error message from the API, use it
    const msg = error.message || "未知错误";
    throw new Error(`API 调用失败: ${msg}`);
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
    model: string;
    imageSize?: '1K' | '2K' | '4K';
  },
  stockingImageBase64?: string,
  stockingImageMimeType?: string
): Promise<string> => {
  const { useCustomApi, customBaseUrl, customApiKey, model, imageSize } = config;
  
  const finalApiKey = (useCustomApi && customApiKey) ? customApiKey : process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("API Key 缺失。请在设置中输入自定义 Key 或确保环境变量已配置。");
  }

  const options: any = { apiKey: finalApiKey };
  if (useCustomApi && customBaseUrl) {
    options.httpOptions = { baseUrl: customBaseUrl };
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
    console.error("Gemini API Error:", error);
    const msg = error.message || "未知错误";
    throw new Error(`API 调用失败: ${msg}`);
  }
};