import React, { useState, useEffect } from 'react';
import { UploadedImage, PoseType, GenerationResult } from './types';
import { POSES, VARIATION_COUNT, STOCKING_PRESETS } from './constants';
import { generateImageEdit, generateTryOn, generatePoseTransfer, generateImageWithReference, generateTextToImage } from './services/geminiService';
import { ImageUploader } from './components/ImageUploader';
import { BatchImageUploader } from './components/BatchImageUploader'; // New Component
import { PoseSelector } from './components/PoseSelector';
import { ResultGrid } from './components/ResultGrid';
import { MagicEditor } from './components/MagicEditor';
import { ImageModal } from './components/ImageModal';
import { Button } from './components/Button';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Layers, Wand2, Sparkles, AlertTriangle, AlertCircle, Settings, X, Check, Globe, Key, Smartphone, ArrowRight, Download, ZoomIn, RefreshCw, Hash, Camera, Copy, Monitor, Zap, Box, Shirt, BookOpen, HelpCircle, CheckCircle2, PlayCircle, Video, Compass } from 'lucide-react';

// Selfie Variations Templates (Single Image -> 8 Variations)
// 3 Sitting, 3 Kneeling, 2 Standing

const SELFIE_TEMPLATES = [
  // 3 坐姿 (Sitting)
  { 
    label: "坐姿 1 (地板盘坐)", 
    prompts: [
      "Sitting on the floor, legs crossed comfortably. Mirror selfie style, phone covering face.",
      "Sitting on the floor, one leg extended, one leg bent. Mirror selfie style, phone covering face.",
      "Sitting on the floor, hugging knees to chest. Mirror selfie style, phone covering face.",
      "Sitting on the floor, leaning back on hands casually. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "坐姿 2 (椅子/椅靠)", 
    prompts: [
      "Sitting on a modern chair, legs crossed gracefully. Mirror selfie style, phone covering face.",
      "Sitting sideways on a stylish chair, casual relaxed posture. Mirror selfie style, phone covering face.",
      "Sitting on an armchair, leaning against the armrest. Mirror selfie style, phone covering face.",
      "Sitting on the edge of a chair, fashion pose. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "坐姿 3 (地板侧坐)", 
    prompts: [
      "Sitting on the floor, side saddle pose with legs folded to one side. Mirror selfie style, phone covering face.",
      "Sitting on the floor, legs in wide V-shape stretch posture. Mirror selfie style, phone covering face.",
      "Sitting on the floor, one leg tucked in, leaning sideways. Mirror selfie style, phone covering face.",
      "Sitting on a low sofa, legs curled up comfortably. Mirror selfie style, phone covering face."
    ]
  },

  // 3 跪姿 (Kneeling)
  { 
    label: "跪姿 1 (地板双膝跪坐)", 
    prompts: [
      "Kneeling on the floor, sitting back on heels, neat posture. Mirror selfie style, phone covering face.",
      "Kneeling on the floor, sitting on heels, hands resting on thighs. Mirror selfie style, phone covering face.",
      "Kneeling on the floor, sitting on heels, leaning back on hands. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "跪姿 2 (高跪姿/直立)", 
    prompts: [
      "High kneeling posture on the floor, body upright, core engaged. Mirror selfie style, phone covering face.",
      "High kneeling pose on the floor, hands on hips with confidence. Mirror selfie style, phone covering face.",
      "Kneeling upright on the floor, leaning slightly forward to the mirror. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "跪姿 3 (单膝跪姿)", 
    prompts: [
      "Kneeling on one knee on the floor, other leg bent at 90 degrees forward. Mirror selfie style, phone covering face.",
      "Kneeling on one knee, other leg extended outwards to the side. Mirror selfie style, phone covering face.",
      "Kneeling on one knee, body turned sideways to the mirror. Mirror selfie style, phone covering face."
    ]
  },

  // 2 站姿 (Standing)
  { 
    label: "站姿 1 (经典姿态)", 
    prompts: [
      "Standing pose, facing the mirror with a relaxed and stylish stance. Mirror selfie style, phone covering face.",
      "Standing pose with one leg slightly forward and weight shifted to back hip. Mirror selfie style, phone covering face.",
      "Standing pose, feet shoulder-width apart, fashion model posture. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "站姿 2 (交叉腿/侧向)", 
    prompts: [
      "Standing pose, crossing legs at ankles gracefully. Mirror selfie style, phone covering face.",
      "Standing pose, body turned 45 degrees to show outfit side profile. Mirror selfie style, phone covering face.",
      "Standing pose, one hand on hip, dynamic body angle. Mirror selfie style, phone covering face."
    ]
  }
];

const DEFAULT_CUSTOM_SELFIE_POSES = [
  "某姿势坐在椅子上",
  "地板坐姿 (V型延伸)",
  "地板跪坐 (并拢叠腿)",
  "沙发侧靠 (交叉翘腿)",
  "扶手椅坐姿 (透视延伸)"
];

const TRYON_PROMPT = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a clothing product (garment).
Input 2: An image of a model standing in a scene.

Task:
1. Generate a photorealistic image of the model from Input 2 wearing the clothing from Input 1.
2. The clothing from Input 1 must completely replace the model's original outfit.
3. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
4. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
5. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
6. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot. Ensure the feet are flat on the ground.
7. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
8. Ensure high fidelity for the clothing texture and fit.
9:16`;

const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  const supportedRatios = [
    { value: "1:1", ratio: 1 },
    { value: "3:4", ratio: 3 / 4 },
    { value: "4:3", ratio: 4 / 3 },
    { value: "9:16", ratio: 9 / 16 },
    { value: "16:9", ratio: 16 / 9 },
    { value: "1:4", ratio: 1 / 4 },
    { value: "1:8", ratio: 1 / 8 },
    { value: "4:1", ratio: 4 / 1 },
    { value: "8:1", ratio: 8 / 1 },
  ];

  let closest = supportedRatios[0];
  let minDiff = Math.abs(ratio - closest.ratio);

  for (let i = 1; i < supportedRatios.length; i++) {
    const diff = Math.abs(ratio - supportedRatios[i].ratio);
    if (diff < minDiff) {
      minDiff = diff;
      closest = supportedRatios[i];
    }
  }

  return closest.value;
};

const getImageDimensions = (base64: string, mimeType: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = `data:${mimeType};base64,${base64}`;
  });
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'poses' | 'same_pose' | 'selfie_var' | 'magic' | 'try_on' | 'pose_transfer' | 'batch_tryon' | 'text_to_image'>('selfie_var');
  
  // Single Image State (Pose)
  const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
  const [generationCount, setGenerationCount] = useState<number>(4); // Default to 4
  
  // Same Pose Variation State
  const [samePoseSourceImages, setSamePoseSourceImages] = useState<UploadedImage[]>([]);
  const [samePoseResults, setSamePoseResults] = useState<{
    id: string;
    sourceIndex: number;
    varIndex: number;
    result: GenerationResult;
  }[]>([]);
  const [samePoseCount, setSamePoseCount] = useState<number>(4);
  const [samePoseOnlyStanding, setSamePoseOnlyStanding] = useState(true);
  const [samePoseBlockFace, setSamePoseBlockFace] = useState(true);

  // Magic Edit State (Batch)
  const [magicImages, setMagicImages] = useState<UploadedImage[]>([]);
  const [magicResults, setMagicResults] = useState<{sourceIndex: number, result: GenerationResult}[]>([]);

  // Batch Try-on State (New Tab)
  const [batchClothingImages, setBatchClothingImages] = useState<UploadedImage[]>([]);
  const [batchPrompt, setBatchPrompt] = useState('一个人穿着参考图的所有服装站在镜子前自拍');
  const [batchResults, setBatchResults] = useState<{id: string, sourceIndex: number, result: GenerationResult}[]>([]);

  // Selfie Variation State (New Tab)
  const [selfieSourceImages, setSelfieSourceImages] = useState<UploadedImage[]>([]);
  const [selfieVarMode, setSelfieVarMode] = useState<'preset' | 'prompt'>('preset');
  const [selfieCustomPromptsText, setSelfieCustomPromptsText] = useState<string>(
    DEFAULT_CUSTOM_SELFIE_POSES.join('\n')
  );
  const [selfieResults, setSelfieResults] = useState<{
    id: string;
    sourceIndex: number;
    templateLabel: string;
    prompts: string[];
    result: GenerationResult;
    prompt: string;
    selfieMode?: 'preset' | 'prompt';
  }[]>([]);
  const [selfieVarOnlyStanding, setSelfieVarOnlyStanding] = useState(false);
  const [selfieVarBlockFace, setSelfieVarBlockFace] = useState(true);
  const [selfieVarCount, setSelfieVarCount] = useState(8);

  // Try-on State (New Tab)
  const [tryOnModelImage, setTryOnModelImage] = useState<UploadedImage | null>(null);
  const [tryOnClothingMode, setTryOnClothingMode] = useState<'image' | 'prompt'>('image');
  const [tryOnClothingImages, setTryOnClothingImages] = useState<UploadedImage[]>([]);
  const [tryOnClothingPrompt, setTryOnClothingPrompt] = useState<string>('中国风、吊带、超短、某款式，旗袍（超短款式，紧身，开叉设计）');
  const [tryOnPromptCount, setTryOnPromptCount] = useState<number>(4);
  const [tryOnStockingImages, setTryOnStockingImages] = useState<UploadedImage[]>([]);
  const [tryOnStockingSource, setTryOnStockingSource] = useState<'upload' | 'preset'>('upload');
  const [selectedPresetStockings, setSelectedPresetStockings] = useState<string[]>([]);
  const [tryOnStockingMatchStrategy, setTryOnStockingMatchStrategy] = useState<'random' | 'force'>('random');
  const [tryOnResults, setTryOnResults] = useState<{sourceIndex: number, clothingMode?: 'image' | 'prompt', clothingPrompt?: string, result: GenerationResult, stockingIndex?: number, stockingPreset?: string}[]>([]);

  // Pose Transfer State (New Tab)
  const [poseTransferBaseImages, setPoseTransferBaseImages] = useState<UploadedImage[]>([]);
  const [poseTransferRefImages, setPoseTransferRefImages] = useState<UploadedImage[]>([]);
  const [poseTransferResults, setPoseTransferResults] = useState<{
    id: string;
    baseIndex: number;
    poseIndex: number;
    result: GenerationResult;
  }[]>([]);
  
  // Text to Image States
  const [textToImagePrompt, setTextToImagePrompt] = useState('');
  const [textToImageRefImage, setTextToImageRefImage] = useState<UploadedImage | null>(null);
  const [textToImageCount, setTextToImageCount] = useState<number>(4);
  const [textToImageResults, setTextToImageResults] = useState<{id: string, result: GenerationResult}[]>([]);

  const [selectedPose, setSelectedPose] = useState<PoseType | null>(null);
  const [customPoseInput, setCustomPoseInput] = useState('');
  
  const [results, setResults] = useState<GenerationResult[]>([]); // For single image poses
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [apiKeyError, setApiKeyError] = useState(false);
  
  // Settings & Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useCustomApi, setUseCustomApi] = useState(() => {
    return localStorage.getItem('useCustomApi') === 'true';
  });
  const [customBaseUrl, setCustomBaseUrl] = useState(() => {
    return localStorage.getItem('customBaseUrl') || 'https://api.vectorengine.ai';
  });
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('customApiKey') || '';
  });

  const [gptApiKey, setGptApiKey] = useState(() => {
    return localStorage.getItem('gptApiKey') || '';
  });

  // Model Selection State
  // 'gemini-2.5-flash-image' = Nano Banana 1
  // 'gemini-3-pro-image-preview' = Nano Banana 2
  // 'gemini-3.1-flash-image-preview' = Nano Banana 3
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview');
  const [selectedResolution, setSelectedResolution] = useState<'1K' | '2K' | '4K'>('2K');

  const [balanceCheck, setBalanceCheck] = useState<{
    isLoading: boolean;
    error: string | null;
    success: boolean;
    totalAvailable: number | null;
    totalUsed: number | null;
    totalGranted: number | null;
    userName: string | null;
    keyQueried: 'custom' | 'gpt' | '';
  }>({
    isLoading: false,
    error: null,
    success: false,
    totalAvailable: null,
    totalUsed: null,
    totalGranted: null,
    userName: null,
    keyQueried: ''
  });

  const checkKeyUsage = async (token: string, keyType: 'custom' | 'gpt') => {
    if (!token) {
      setBalanceCheck({
        isLoading: false,
        error: '请输入密钥后再进行查询',
        success: false,
        totalAvailable: null,
        totalUsed: null,
        totalGranted: null,
        userName: null,
        keyQueried: keyType
      });
      return;
    }

    setBalanceCheck({
      isLoading: true,
      error: null,
      success: false,
      totalAvailable: null,
      totalUsed: null,
      totalGranted: null,
      userName: null,
      keyQueried: keyType
    });

    try {
      const response = await fetch("/api/balance", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        redirect: "follow"
      });

      let result: any;
      try {
        result = await response.json();
      } catch (e) {
        // Ignore JSON parse error if body isn't JSON
      }

      if (!response.ok) {
        const errMsg = result?.error?.message || result?.message || `请求失败 (HTTP ${response.status})`;
        throw new Error(errMsg);
      }

      if (result && result.success && result.data) {
        setBalanceCheck({
          isLoading: false,
          error: null,
          success: true,
          totalAvailable: result.data.total_available,
          totalUsed: result.data.total_used,
          totalGranted: result.data.total_granted,
          userName: result.data.name || 'Token',
          keyQueried: keyType
        });
      } else {
        const errMsg = result?.error?.message || result?.message || '查询失败，可能是无效密钥或接口出错';
        throw new Error(errMsg);
      }
    } catch (error: any) {
      console.error(error);
      setBalanceCheck({
        isLoading: false,
        error: error.message || '网络错误，请稍后重试',
        success: false,
        totalAvailable: null,
        totalUsed: null,
        totalGranted: null,
        userName: null,
        keyQueried: keyType
      });
    }
  };

  useEffect(() => {
    localStorage.setItem('useCustomApi', useCustomApi.toString());
    localStorage.setItem('customBaseUrl', customBaseUrl);
    localStorage.setItem('customApiKey', customApiKey);
    localStorage.setItem('gptApiKey', gptApiKey);
  }, [useCustomApi, customBaseUrl, customApiKey, gptApiKey]);

  useEffect(() => {
    if (!process.env.API_KEY && !useCustomApi) {
      setApiKeyError(true);
    } else {
      setApiKeyError(false);
    }
  }, [useCustomApi]);

  // Delete the database to completely free up IndexedDB space on startup
  useEffect(() => {
    const req = indexedDB.deleteDatabase('GenerationHistory');
    req.onsuccess = () => {
      console.log('Successfully cleared and deleted history database (GenerationHistory) to free up storage space.');
    };
    req.onerror = () => {
      console.error('Failed to clear history database.');
    };
  }, []);

  const handleSelectPose = (poseId: PoseType) => {
    setSelectedPose(poseId);
  };

  const commonApiConfig = {
    useCustomApi,
    customBaseUrl,
    customApiKey,
    gptApiKey,
    model: selectedModel,
    imageSize: selectedResolution
  };

  // --- Single Image Handlers ---

  // --- Zip Download Helper ---
  const downloadResultsAsZip = async (
    results: { imageUrl?: string; status: string; originalImage?: UploadedImage; groupName?: string; name: string }[],
    zipFileName: string
  ) => {
    const zip = new JSZip();
    
    // Group results if groupName is provided
    const groups: Record<string, typeof results> = {};
    results.forEach(r => {
      if (r.status === 'success' && r.imageUrl) {
        const group = r.groupName || 'images';
        if (!groups[group]) groups[group] = [];
        groups[group].push(r);
      }
    });

    const fetchImage = async (url: string) => {
      const response = await fetch(url);
      return await response.blob();
    };

    // Add original images to groups if available
    const processedGroups = new Set<string>();
    
    for (const r of results) {
       if (r.status === 'success' && r.imageUrl && r.groupName) {
         if (!processedGroups.has(r.groupName)) {
           processedGroups.add(r.groupName);
           // Find the first result in this group to get original image
           const original = results.find(item => item.groupName === r.groupName)?.originalImage;
           if (original) {
             const blob = await fetch(`data:${original.mimeType};base64,${original.base64}`).then(res => res.blob());
             zip.file(`${r.groupName}/original.png`, blob);
           }
         }
         
         const blob = await fetchImage(r.imageUrl);
         zip.file(`${r.groupName}/${r.name}.png`, blob);
       } else if (r.status === 'success' && r.imageUrl) {
         // Flat list if no grouping
         const blob = await fetchImage(r.imageUrl);
         zip.file(`${r.name}.png`, blob);
       }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${zipFileName}.zip`);
  };

  const handlePoseGeneration = async () => {
    if (!sourceImage || !selectedPose) return;
    
    let basePrompt = '';
    const poseDef = POSES.find(p => p.id === selectedPose);

    if (selectedPose === PoseType.CUSTOM_INPUT) {
      if (!customPoseInput.trim()) {
        alert("请输入姿势描述");
        return;
      }
      basePrompt = `Change the pose to: ${customPoseInput.trim()}.`;
    } else {
      if (!poseDef) return;
      basePrompt = poseDef.prompt;
    }
    
    // Use user selected generationCount instead of constant
    const newResults: GenerationResult[] = Array.from({ length: generationCount }).map((_, index) => ({
      id: `${selectedPose}-${Date.now()}-${index}`,
      poseId: selectedPose,
      status: 'loading'
    }));

    setResults(newResults);
    setIsProcessing(true);

    try {
      await Promise.all(newResults.map(async (resultItem, index) => {
        try {
          const variedPrompt = `${basePrompt} (Variation ${index + 1})`;
          const imageUrl = await generateImageEdit(
            sourceImage.base64,
            sourceImage.mimeType,
            variedPrompt,
            commonApiConfig
          );

          setResults(prev => prev.map(r => 
            r.id === resultItem.id ? { ...r, status: 'success', imageUrl } : r
          ));
        } catch (error: any) {
          setResults(prev => prev.map(r => 
            r.id === resultItem.id ? { ...r, status: 'error', error: error.message || '生成失败' } : r
          ));
        }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAll = (urls: string[], prefix: string) => {
    urls.forEach((url, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${prefix}-${i + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 200);
    });
  };

  const handleMagicEdit = async (prompt: string) => {
    if (magicImages.length === 0) return;

    const newResults = magicImages.map((_, index) => ({
      sourceIndex: index,
      result: {
        id: `magic-${Date.now()}-${index}`,
        poseId: 'magic',
        status: 'loading' as const
      }
    }));

    setMagicResults(newResults);
    setIsProcessing(true);

    try {
      await Promise.all(newResults.map(async (item, index) => {
        try {
          const sourceImg = magicImages[index];
          const imageUrl = await generateImageEdit(
            sourceImg.base64,
            sourceImg.mimeType,
            prompt,
            commonApiConfig
          );

          setMagicResults(prev => prev.map(r => 
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
              : r
          ));
        } catch (error: any) {
           setMagicResults(prev => prev.map(r => 
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'error', error: error.message || '魔法施放失败' } } 
              : r
          ));
        }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryMagicEdit = async (index: number, prompt: string) => {
    const sourceImg = magicImages[index];
    if (!sourceImg) return;

    setMagicResults(prev => prev.map(r => 
      r.sourceIndex === index 
        ? { ...r, result: { ...r.result, status: 'loading', error: undefined } }
        : r
    ));

    try {
      const imageUrl = await generateImageEdit(
        sourceImg.base64,
        sourceImg.mimeType,
        prompt,
        commonApiConfig
      );

      setMagicResults(prev => prev.map(r => 
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
    } catch (error: any) {
      setMagicResults(prev => prev.map(r => 
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || '重试失败' } } 
          : r
      ));
    }
  };

  const retryPose = async (resultId: string) => {
     if (!sourceImage) return;
     const resultToRetry = results.find(r => r.id === resultId);
     if (!resultToRetry) return;
     let promptToUse = '';
     if (resultToRetry.poseId === PoseType.CUSTOM_INPUT) {
        promptToUse = `Change the pose to: ${customPoseInput.trim()}`;
     } else {
         const poseDef = POSES.find(p => p.id === resultToRetry.poseId);
         if (poseDef) promptToUse = poseDef.prompt;
     }
     if (!promptToUse) return;
     setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'loading', error: undefined } : r));
     try {
       const imageUrl = await generateImageEdit(sourceImage.base64, sourceImage.mimeType, promptToUse, commonApiConfig);
       setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'success', imageUrl } : r));
     } catch (error: any) {
       setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'error', error: error.message } : r));
     }
  };

  // --- Same Pose Variations Handlers ---

  const handleSamePoseGeneration = async () => {
    if (samePoseSourceImages.length === 0) return;

    let basePrompt = "Identify the character's current general posture category (e.g., standing, sitting on the floor, squatting, kneeling). Keep the character in this EXACT SAME general posture category, but change the specific pose, hand/leg placements, body language, and camera angle to create a completely new and dynamic variation. Maintain clothes and background identity. High quality photorealistic.";
    
    if (samePoseOnlyStanding) {
      basePrompt += " Focus strictly on creating variations that are standing poses with different expressive hand gestures and subtle shifts in standing weight/angle.";
    }

    if (samePoseBlockFace) {
      basePrompt += " ENSURE the smartphone is ALWAYS covering the character's face in all variations. The face must be completely obscured by the phone as if taking a mirror selfie.";
    }

    const allNewResults: {
      id: string;
      sourceIndex: number;
      varIndex: number;
      result: GenerationResult;
    }[] = [];

    samePoseSourceImages.forEach((sourceImg, sourceIdx) => {
      Array.from({ length: samePoseCount }).forEach((_, vIdx) => {
        const id = `same-pose-${Date.now()}-${sourceIdx}-${vIdx}`;
        allNewResults.push({
          id,
          sourceIndex: sourceIdx,
          varIndex: vIdx,
          result: {
            id,
            poseId: 'same-pose',
            status: 'loading' as const
          }
        });
      });
    });

    setSamePoseResults(allNewResults);
    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(allNewResults.length);

    try {
      const chunkSize = 20;
      for (let i = 0; i < allNewResults.length; i += chunkSize) {
        const chunk = allNewResults.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          try {
            while (retryCount <= maxRetries && !success) {
              try {
                const sourceImg = samePoseSourceImages[item.sourceIndex];
                if (!sourceImg) break;

                const variedPrompt = `${basePrompt} (Variation ${item.varIndex + 1}: make it highly unique and different from other variations).`;
                const imageUrl = await generateImageEdit(
                  sourceImg.base64,
                  sourceImg.mimeType,
                  variedPrompt,
                  commonApiConfig
                );

                setSamePoseResults(prev => prev.map(r => 
                  r.id === item.id 
                    ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
                    : r
                ));
                success = true;
                if (useCustomApi && customApiKey) {
                  checkKeyUsage(customApiKey, 'custom').catch(() => {});
                }
              } catch (error: any) {
                const errorMsg = error.message || '';
                const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                if (isQuotaError) {
                  setSamePoseResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: `额度不足: ${errorMsg}` } } 
                      : r
                  ));
                  break;
                }

                retryCount++;
                if (retryCount > maxRetries) {
                  setSamePoseResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: errorMsg || '生成失败' } } 
                      : r
                  ));
                }
                if (!success && retryCount <= maxRetries) await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const retrySamePose = async (resultId: string) => {
    const item = samePoseResults.find(r => r.id === resultId);
    if (!item) return;

    const sourceImg = samePoseSourceImages[item.sourceIndex];
    if (!sourceImg) return;

    let basePrompt = "Identify the character's current general posture category (e.g., standing, sitting on the floor, squatting, kneeling). Keep the character in this EXACT SAME general posture category, but change the specific pose, hand/leg placements, body language, and camera angle to create a completely new and dynamic variation. Maintain clothes and background identity. High quality photorealistic.";

    if (samePoseOnlyStanding) {
      basePrompt += " Focus strictly on creating variations that are standing poses with different expressive hand gestures and subtle shifts in standing weight/angle.";
    }

    if (samePoseBlockFace) {
      basePrompt += " ENSURE the smartphone is ALWAYS covering the character's face in all variations. The face must be completely obscured by the phone as if taking a mirror selfie.";
    }

    setSamePoseResults(prev => prev.map(r => r.id === resultId ? { ...r, result: { ...r.result, status: 'loading', error: undefined } } : r));
    try {
      const variedPrompt = `${basePrompt} (Variation Retry ${Date.now()}).`;
      const imageUrl = await generateImageEdit(
        sourceImg.base64,
        sourceImg.mimeType,
        variedPrompt,
        commonApiConfig
      );
      setSamePoseResults(prev => prev.map(r => r.id === resultId ? { ...r, result: { ...r.result, status: 'success', imageUrl } } : r));
      if (useCustomApi && customApiKey) {
        checkKeyUsage(customApiKey, 'custom').catch(() => {});
      }
    } catch (error: any) {
      setSamePoseResults(prev => prev.map(r => r.id === resultId ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Retry failed' } } : r));
    }
  };

  const downloadAllSamePoseResults = async () => {
    const downloadData = samePoseResults
      .filter(r => r.result.status === 'success' && r.result.imageUrl)
      .map(r => ({
        imageUrl: r.result.imageUrl,
        status: r.result.status,
        originalImage: samePoseSourceImages[r.sourceIndex],
        groupName: `image_${r.sourceIndex + 1}`,
        name: `variation_${r.varIndex + 1}`
      }));
    
    if (downloadData.length === 0) return;
    await downloadResultsAsZip(downloadData, 'same_pose_variations');
  };

  const handleSelfieVariationsGeneration = async () => {
    if (selfieSourceImages.length === 0) return;

    const allNewResults: typeof selfieResults = [];

    if (selfieVarMode === 'preset') {
      const availableTemplates = selfieVarOnlyStanding 
        ? SELFIE_TEMPLATES.filter(t => t.label.includes('站姿'))
        : SELFIE_TEMPLATES;

      selfieSourceImages.forEach((sourceImg, sourceIdx) => {
        Array.from({ length: 8 }).forEach((_, index) => {
          const templateIndex = index % availableTemplates.length;
          const template = availableTemplates[templateIndex];
          const randomPrompt = template.prompts[Math.floor(Math.random() * template.prompts.length)];
          const id = `selfie-var-${Date.now()}-${sourceIdx}-${index}`;
          
          allNewResults.push({
            id,
            sourceIndex: sourceIdx,
            templateLabel: template.label,
            prompts: template.prompts,
            prompt: randomPrompt,
            selfieMode: 'preset',
            result: {
              id,
              poseId: 'selfie-var',
              status: 'loading' as const
            }
          });
        });
      });
    } else {
      const userPrompts = selfieCustomPromptsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      const finalPrompts = userPrompts.length > 0 ? userPrompts : DEFAULT_CUSTOM_SELFIE_POSES;

      selfieSourceImages.forEach((sourceImg, sourceIdx) => {
        finalPrompts.forEach((posePrompt, pIdx) => {
          const id = `selfie-var-${Date.now()}-${sourceIdx}-${pIdx}`;
          allNewResults.push({
            id,
            sourceIndex: sourceIdx,
            templateLabel: posePrompt,
            prompts: [posePrompt],
            prompt: posePrompt,
            selfieMode: 'prompt',
            result: {
              id,
              poseId: 'selfie-var',
              status: 'loading' as const
            }
          });
        });
      });
    }

    setSelfieResults(allNewResults);
    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(allNewResults.length);

    try {
      // Process in small chunks to avoid overload
      const chunkSize = 20;
      for (let i = 0; i < allNewResults.length; i += chunkSize) {
        const chunk = allNewResults.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;
          
          try {
            while (retryCount <= maxRetries && !success) {
              try {
                let promptText = item.prompt;
                if (!selfieVarBlockFace) {
                  promptText = promptText.replace(" Mirror selfie style, phone covering face.", "");
                }

                let finalPrompt = `Change pose to: ${promptText}. `;
                if (selfieVarBlockFace) {
                  finalPrompt += "Ensure the phone covers the face (mirror selfie style). ";
                } else {
                  finalPrompt += "Ensure the face is clearly visible, not blocked by the phone. ";
                }
                
                if (selfieVarOnlyStanding && item.selfieMode === 'preset') {
                  finalPrompt += "Focus on unique hand gestures and arm placements while standing. ";
                }

                finalPrompt += "Maintain clothes and background identity. High quality photorealistic.";
                
                const sourceImage = selfieSourceImages[item.sourceIndex];
                const imageUrl = await generateImageEdit(
                  sourceImage.base64,
                  sourceImage.mimeType,
                  finalPrompt,
                  commonApiConfig
                );

                setSelfieResults(prev => prev.map(r => 
                  r.id === item.id 
                    ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
                    : r
                ));
                success = true;
                if (useCustomApi && customApiKey) {
                  checkKeyUsage(customApiKey, 'custom').catch(() => {});
                }
              } catch (error: any) {
                const errorMsg = error.message || '';
                const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                if (isQuotaError) {
                  setSelfieResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: `额度不足: ${errorMsg}` } } 
                      : r
                  ));
                  break;
                }

                retryCount++;
                if (retryCount > maxRetries) {
                  setSelfieResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: errorMsg || 'Generation failed' } } 
                      : r
                  ));
                }
                if (!success && retryCount <= maxRetries) await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const retrySelfieVariation = async (id: string) => {
    const item = selfieResults.find(r => r.id === id);
    if (!item) return;

    setSelfieResults(prev => prev.map(r => 
      r.id === id 
        ? { ...r, result: { ...r.result, status: 'loading', error: undefined } }
        : r
    ));

    try {
      const sourceImage = selfieSourceImages[item.sourceIndex];
      const newRandomPrompt = (item.prompts && item.prompts.length > 0)
        ? item.prompts[Math.floor(Math.random() * item.prompts.length)]
        : item.prompt;

      let promptText = newRandomPrompt;
      if (!selfieVarBlockFace) {
        promptText = promptText.replace(" Mirror selfie style, phone covering face.", "");
      }

      let finalPrompt = `Change pose to: ${promptText}. `;
      if (selfieVarBlockFace) {
         finalPrompt += "Ensure the phone covers the face (mirror selfie style). ";
      } else {
         finalPrompt += "Ensure the face is clearly visible, not blocked by the phone. ";
      }
      
      if (selfieVarOnlyStanding && item.selfieMode === 'preset') {
         finalPrompt += "Focus on unique hand gestures and arm placements while standing. ";
      }

      finalPrompt += "Maintain clothes and background identity. High quality photorealistic.";

      const imageUrl = await generateImageEdit(
        sourceImage.base64,
        sourceImage.mimeType,
        finalPrompt,
        commonApiConfig
      );

      setSelfieResults(prev => prev.map(r => 
        r.id === id 
          ? { ...r, prompt: newRandomPrompt, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
      if (useCustomApi && customApiKey) {
        checkKeyUsage(customApiKey, 'custom').catch(() => {});
      }
    } catch (error: any) {
      setSelfieResults(prev => prev.map(r => 
        r.id === id 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Retry failed' } } 
          : r
      ));
    }
  };

  const downloadAllSelfieResults = async () => {
    const downloadData = selfieResults
      .filter(r => r.result.status === 'success' && r.result.imageUrl)
      .map(r => ({
        imageUrl: r.result.imageUrl,
        status: r.result.status,
        originalImage: selfieSourceImages[r.sourceIndex],
        groupName: `image_${r.sourceIndex + 1}`,
        name: `variation_${r.templateLabel.replace(/\s+/g, '_')}`
      }));
    
    if (downloadData.length === 0) return;
    await downloadResultsAsZip(downloadData, 'selfie_variations');
  };

  const retryAllFailedSelfie = async () => {
    const failedItems = selfieResults.filter(r => r.result.status === 'error');
    if (failedItems.length === 0) return;
    
    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(failedItems.length);
    try {
      // Process in chunks to be consistent with generation
      const chunkSize = 20;
      for (let i = 0; i < failedItems.length; i += chunkSize) {
        const chunk = failedItems.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          try {
            await retrySelfieVariation(item.id);
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Batch Try-on Handlers ---

  const handleBatchGeneration = async () => {
    if (batchClothingImages.length === 0 || !batchPrompt.trim()) return;

    const newResults = batchClothingImages.map((_, index) => ({
      id: `batch-tryon-${Date.now()}-${index}`,
      sourceIndex: index,
      result: {
        id: `batch-tryon-${Date.now()}-${index}`,
        poseId: 'batch-tryon',
        status: 'loading' as const
      }
    }));

    setBatchResults(newResults);
    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(newResults.length);

    try {
      // Process in chunks of 20 to balance speed and rate limits
      const chunkSize = 20;
      for (let i = 0; i < newResults.length; i += chunkSize) {
        const chunk = newResults.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          try {
            const clothingImage = batchClothingImages[item.sourceIndex];
            const imageUrl = await generateImageWithReference(
              clothingImage.base64,
              clothingImage.mimeType,
              batchPrompt,
              commonApiConfig
            );

            setBatchResults(prev => prev.map(r => 
              r.id === item.id 
                ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
                : r
            ));
            if (useCustomApi && customApiKey) {
              checkKeyUsage(customApiKey, 'custom').catch(() => {});
            }
          } catch (error: any) {
            setBatchResults(prev => prev.map(r => 
              r.id === item.id 
                ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } 
                : r
            ));
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const retryBatchGeneration = async (id: string) => {
    const item = batchResults.find(r => r.id === id);
    if (!item) return;

    setBatchResults(prev => prev.map(r => 
      r.id === id 
        ? { ...r, result: { ...r.result, status: 'loading', error: undefined } }
        : r
    ));

    try {
      const clothingImage = batchClothingImages[item.sourceIndex];
      const imageUrl = await generateImageWithReference(
        clothingImage.base64,
        clothingImage.mimeType,
        batchPrompt,
        commonApiConfig
      );

      setBatchResults(prev => prev.map(r => 
        r.id === id 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
      if (useCustomApi && customApiKey) {
        checkKeyUsage(customApiKey, 'custom').catch(() => {});
      }
    } catch (error: any) {
      setBatchResults(prev => prev.map(r => 
        r.id === id 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Retry failed' } } 
          : r
      ));
    }
  };

  const retryAllFailedBatchTryOn = async () => {
    const failedItems = batchResults.filter(r => r.result.status === 'error');
    if (failedItems.length === 0) return;

    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(failedItems.length);
    try {
      const chunkSize = 20;
      for (let i = 0; i < failedItems.length; i += chunkSize) {
        const chunk = failedItems.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          try {
            await retryBatchGeneration(item.id);
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Pose Transfer Handlers ---

  const handlePoseTransferGeneration = async () => {
    if (poseTransferBaseImages.length === 0 || poseTransferRefImages.length === 0) return;

    const newResults = poseTransferBaseImages.map((_, baseIdx) => {
      const randomPoseIdx = Math.floor(Math.random() * poseTransferRefImages.length);
      const id = `pose-transfer-${Date.now()}-${baseIdx}`;
      return {
        id,
        baseIndex: baseIdx,
        poseIndex: randomPoseIdx,
        result: {
          id,
          poseId: 'pose-transfer',
          status: 'loading' as const
        }
      };
    });

    setPoseTransferResults(newResults);
    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(newResults.length);

    try {
      const chunkSize = 20;
      for (let i = 0; i < newResults.length; i += chunkSize) {
        const chunk = newResults.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          try {
            while (retryCount <= maxRetries && !success) {
              try {
                const baseImg = poseTransferBaseImages[item.baseIndex];
                const refImg = poseTransferRefImages[item.poseIndex];
                if (!baseImg || !refImg) break;

                const dims = await getImageDimensions(baseImg.base64, baseImg.mimeType);
                const aspectRatio = getClosestAspectRatio(dims.width, dims.height);

                const imageUrl = await generatePoseTransfer(
                  baseImg.base64,
                  baseImg.mimeType,
                  refImg.base64,
                  refImg.mimeType,
                  { ...commonApiConfig, aspectRatio }
                );

                setPoseTransferResults(prev => prev.map(r => 
                  r.id === item.id 
                    ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
                    : r
                ));
                success = true;
                if (useCustomApi && customApiKey) {
                  checkKeyUsage(customApiKey, 'custom').catch(() => {});
                }
              } catch (error: any) {
                const errorMsg = error.message || '';
                const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                if (isQuotaError) {
                  setPoseTransferResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: `额度不足: ${errorMsg}` } } 
                      : r
                  ));
                  break;
                }

                retryCount++;
                if (retryCount > maxRetries) {
                  setPoseTransferResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: errorMsg || 'Generation failed' } } 
                      : r
                  ));
                }
                if (!success && retryCount <= maxRetries) await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } catch (error) {
      console.error("Failed pose transfer generation", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegeneratePoseTransferItem = async (id: string) => {
    const item = poseTransferResults.find(r => r.id === id);
    if (!item) return;

    setPoseTransferResults(prev => prev.map(r => 
      r.id === id 
        ? { ...r, result: { ...r.result, status: 'loading', error: undefined } } 
        : r
    ));

    try {
      const baseImg = poseTransferBaseImages[item.baseIndex];
      const refImg = poseTransferRefImages[item.poseIndex];
      if (!baseImg || !refImg) return;

      const dims = await getImageDimensions(baseImg.base64, baseImg.mimeType);
      const aspectRatio = getClosestAspectRatio(dims.width, dims.height);

      const imageUrl = await generatePoseTransfer(
        baseImg.base64,
        baseImg.mimeType,
        refImg.base64,
        refImg.mimeType,
        { ...commonApiConfig, aspectRatio }
      );

      setPoseTransferResults(prev => prev.map(r => 
        r.id === id 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
      if (useCustomApi && customApiKey) {
        checkKeyUsage(customApiKey, 'custom').catch(() => {});
      }
    } catch (error: any) {
      setPoseTransferResults(prev => prev.map(r => 
        r.id === id 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } 
          : r
      ));
    }
  };

  const downloadAllPoseTransferResults = async () => {
    const downloadData = poseTransferResults
      .filter(r => r.result.status === 'success' && r.result.imageUrl)
      .map(r => ({
        imageUrl: r.result.imageUrl,
        status: r.result.status,
        originalImage: poseTransferBaseImages[r.baseIndex],
        groupName: `base_${r.baseIndex + 1}`,
        name: `pose_${r.poseIndex + 1}`
      }));
    
    if (downloadData.length === 0) return;
    await downloadResultsAsZip(downloadData, 'pose_transfer_results');
  };

  // --- Text to Image Handlers ---

  const handleTextToImageGeneration = async () => {
    if (!textToImagePrompt.trim()) return;

    const newResults = Array.from({ length: textToImageCount }).map((_, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      result: { 
        id: i.toString(), 
        poseId: 'prompt', 
        status: 'loading' as const 
      }
    }));

    setTextToImageResults(newResults);
    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(newResults.length);

    try {
      const chunkSize = 8; // Process in larger parallel batches for high concurrency support
      for (let i = 0; i < newResults.length; i += chunkSize) {
        const chunk = newResults.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          try {
            while (retryCount <= maxRetries && !success) {
              try {
                const imageUrl = await generateTextToImage(
                  textToImagePrompt,
                  commonApiConfig,
                  textToImageRefImage ? { base64: textToImageRefImage.base64, mimeType: textToImageRefImage.mimeType } : undefined
                );

                setTextToImageResults(prev => prev.map(r => 
                  r.id === item.id 
                    ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
                    : r
                ));
                success = true;
                if (useCustomApi && customApiKey) {
                  checkKeyUsage(customApiKey, 'custom').catch(() => {});
                }
              } catch (error: any) {
                const errorMsg = error.message || '';
                const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                if (isQuotaError) {
                  setTextToImageResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: `额度不足: ${errorMsg}` } } 
                      : r
                  ));
                  break;
                }

                retryCount++;
                if (retryCount > maxRetries) {
                  setTextToImageResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: errorMsg || 'Generation failed' } } 
                      : r
                  ));
                }
                if (!success && retryCount <= maxRetries) await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } catch (error: any) {
      console.error("Text to Image process failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const retryTextToImage = async (id: string) => {
    const item = textToImageResults.find(r => r.id === id);
    if (!item) return;

    setTextToImageResults(prev => prev.map(r => 
      r.id === id ? { ...r, result: { ...r.result, status: 'loading', error: undefined } } : r
    ));

    try {
      const imageUrl = await generateTextToImage(
        textToImagePrompt,
        commonApiConfig,
        textToImageRefImage ? { base64: textToImageRefImage.base64, mimeType: textToImageRefImage.mimeType } : undefined
      );

      setTextToImageResults(prev => prev.map(r => 
        r.id === id ? { ...r, result: { ...r.result, status: 'success', imageUrl } } : r
      ));
      if (useCustomApi && customApiKey) {
        checkKeyUsage(customApiKey, 'custom').catch(() => {});
      }
    } catch (error: any) {
      setTextToImageResults(prev => prev.map(r => 
        r.id === id ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } : r
      ));
    }
  };

  const retryAllFailedTextToImage = async () => {
    const failedItems = textToImageResults.filter(r => r.result.status === 'error');
    if (failedItems.length === 0) return;

    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(failedItems.length);
    try {
      const chunkSize = 8;
      for (let i = 0; i < failedItems.length; i += chunkSize) {
        const chunk = failedItems.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          try {
            await retryTextToImage(item.id);
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAllTextToImage = async () => {
    const downloadData = textToImageResults
      .filter(r => r.result.status === 'success' && r.result.imageUrl)
      .map(r => ({
        url: r.result.imageUrl!,
        name: `text_to_image_${r.id}.png`
      }));
    
    if (downloadData.length === 0) return;
    await downloadResultsAsZip(downloadData, 'text_to_image_results');
  };

  // --- Try-On (New Tab) Handlers ---

  const handleTryOnGeneration = async () => {
    if (!tryOnModelImage) return;

    if (tryOnClothingMode === 'image') {
      if (tryOnClothingImages.length === 0) return;

      const newResults = tryOnClothingImages.map((_, index) => {
        let stockingIndex: number | undefined = undefined;
        let stockingPreset: string | undefined = undefined;

        if (tryOnStockingSource === 'upload') {
          if (tryOnStockingImages.length > 0) {
            if (tryOnStockingMatchStrategy === 'force') {
              const idx = Math.floor(Math.random() * tryOnStockingImages.length);
              stockingIndex = idx;
            } else {
              const pool = [-1, ...Array.from({ length: tryOnStockingImages.length }, (_, i) => i)];
              const selected = pool[Math.floor(Math.random() * pool.length)];
              if (selected !== -1) {
                stockingIndex = selected;
              }
            }
          }
        } else {
          if (selectedPresetStockings.length > 0) {
            if (tryOnStockingMatchStrategy === 'force') {
              const idx = Math.floor(Math.random() * selectedPresetStockings.length);
              stockingPreset = selectedPresetStockings[idx];
            } else {
              const pool = [null, ...selectedPresetStockings];
              const selected = pool[Math.floor(Math.random() * pool.length)];
              if (selected !== null) {
                stockingPreset = selected;
              }
            }
          }
        }

        return {
          sourceIndex: index,
          clothingMode: 'image' as const,
          stockingIndex: stockingIndex,
          stockingPreset: stockingPreset,
          result: {
            id: `tryon-${Date.now()}-${index}`,
            poseId: 'tryon',
            status: 'loading' as const
          }
        };
      });

      setTryOnResults(newResults);
      setIsProcessing(true);
      setProgressCount(0);
      setProgressTotal(newResults.length);

      try {
        const chunkSize = 20;
        for (let i = 0; i < newResults.length; i += chunkSize) {
          const chunk = newResults.slice(i, i + chunkSize);
          await Promise.all(chunk.map(async (item) => {
            let retryCount = 0;
            const maxRetries = 3;
            let success = false;

            try {
              while (retryCount <= maxRetries && !success) {
                try {
                  const clothingImg = tryOnClothingImages[item.sourceIndex];
                  const stockingImg = item.stockingIndex !== undefined ? tryOnStockingImages[item.stockingIndex] : undefined;
                  const activePreset = item.stockingPreset ? STOCKING_PRESETS.find(p => p.id === item.stockingPreset) : undefined;
                  
                  let prompt = TRYON_PROMPT;
                  if (stockingImg) {
                    prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a clothing product (garment).
Input 2: An image of a model standing in a scene.
Input 3: An image of stockings/hosiery.

Task:
1. Generate a photorealistic image of the model from Input 2 wearing the clothing from Input 1 AND the stockings from Input 3.
2. The clothing from Input 1 must completely replace the model's original outfit.
3. The stockings from Input 3 must be worn on the model's legs.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot (or wearing the stockings without shoes). Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
                  } else if (activePreset) {
                    prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a clothing product (garment).
Input 2: An image of a model standing in a scene.

Task:
1. Generate a photorealistic image of the model from Input 2 wearing the clothing from Input 1 AND wearing specific stockings/hosiery: ${activePreset.prompt}.
2. The clothing from Input 1 must completely replace the model's original outfit.
3. The model's legs MUST be dressed in the stockings: "${activePreset.prompt}". Render this naturally, photorealistically and smoothly.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot wearing the stockings/hosiery described. Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
                  }

                  const imageUrl = await generateTryOn(
                    tryOnModelImage.base64,
                    tryOnModelImage.mimeType,
                    clothingImg.base64,
                    clothingImg.mimeType,
                    prompt,
                    commonApiConfig,
                    stockingImg?.base64,
                    stockingImg?.mimeType
                  );

                  setTryOnResults(prev => prev.map(r => 
                    r.sourceIndex === item.sourceIndex 
                      ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
                      : r
                  ));
                  success = true;
                  if (useCustomApi && customApiKey) {
                    checkKeyUsage(customApiKey, 'custom').catch(() => {});
                  }
                } catch (error: any) {
                  const errorMsg = error.message || '';
                  const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                  if (isQuotaError) {
                    setTryOnResults(prev => prev.map(r => 
                      r.sourceIndex === item.sourceIndex 
                        ? { ...r, result: { ...r.result, status: 'error', error: `额度不足: ${errorMsg}` } } 
                        : r
                    ));
                    break;
                  }

                  retryCount++;
                  if (retryCount > maxRetries) {
                    setTryOnResults(prev => prev.map(r => 
                      r.sourceIndex === item.sourceIndex 
                        ? { ...r, result: { ...r.result, status: 'error', error: errorMsg || 'Generation failed' } } 
                        : r
                    ));
                  }
                  if (!success && retryCount <= maxRetries) await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            } finally {
              setProgressCount(prev => prev + 1);
            }
          }));
        }
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Prompt mode
      if (!tryOnClothingPrompt.trim()) return;

      const newResults = Array.from({ length: tryOnPromptCount }).map((_, index) => {
        let stockingIndex: number | undefined = undefined;
        let stockingPreset: string | undefined = undefined;

        if (tryOnStockingSource === 'upload') {
          if (tryOnStockingImages.length > 0) {
            if (tryOnStockingMatchStrategy === 'force') {
              const idx = Math.floor(Math.random() * tryOnStockingImages.length);
              stockingIndex = idx;
            } else {
              const pool = [-1, ...Array.from({ length: tryOnStockingImages.length }, (_, i) => i)];
              const selected = pool[Math.floor(Math.random() * pool.length)];
              if (selected !== -1) {
                stockingIndex = selected;
              }
            }
          }
        } else {
          if (selectedPresetStockings.length > 0) {
            if (tryOnStockingMatchStrategy === 'force') {
              const idx = Math.floor(Math.random() * selectedPresetStockings.length);
              stockingPreset = selectedPresetStockings[idx];
            } else {
              const pool = [null, ...selectedPresetStockings];
              const selected = pool[Math.floor(Math.random() * pool.length)];
              if (selected !== null) {
                stockingPreset = selected;
              }
            }
          }
        }

        return {
          sourceIndex: index,
          clothingMode: 'prompt' as const,
          clothingPrompt: tryOnClothingPrompt.trim(),
          stockingIndex: stockingIndex,
          stockingPreset: stockingPreset,
          result: {
            id: `tryon-prompt-${Date.now()}-${index}`,
            poseId: 'tryon',
            status: 'loading' as const
          }
        };
      });

      setTryOnResults(newResults);
      setIsProcessing(true);
      setProgressCount(0);
      setProgressTotal(newResults.length);

      try {
        const chunkSize = 20;
        for (let i = 0; i < newResults.length; i += chunkSize) {
          const chunk = newResults.slice(i, i + chunkSize);
          await Promise.all(chunk.map(async (item) => {
            let retryCount = 0;
            const maxRetries = 3;
            let success = false;

            try {
              while (retryCount <= maxRetries && !success) {
                try {
                  const stockingImg = item.stockingIndex !== undefined ? tryOnStockingImages[item.stockingIndex] : undefined;
                  const activePreset = item.stockingPreset ? STOCKING_PRESETS.find(p => p.id === item.stockingPreset) : undefined;
                  
                  let prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a model standing in a scene.
Target Clothing Description: ${item.clothingPrompt} (Variation ${item.sourceIndex + 1}).

Task:
1. Generate a photorealistic image of the model from Input 1 wearing the custom outfit described above: "${item.clothingPrompt}".
2. The described clothing must completely replace the model's original outfit.
3. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
4. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
5. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
6. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot. Ensure the feet are flat on the ground.
7. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
8. Ensure high fidelity for the clothing texture and fit.
9:16`;

                  if (stockingImg) {
                    prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a model standing in a scene.
Input 2: An image of stockings/hosiery.
Target Clothing Description: ${item.clothingPrompt} (Variation ${item.sourceIndex + 1}).

Task:
1. Generate a photorealistic image of the model from Input 1 wearing the custom outfit described: "${item.clothingPrompt}" AND the stockings from Input 2.
2. The described clothing must completely replace the model's original outfit.
3. The stockings from Input 2 must be worn on the model's legs.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot (or wearing the stockings without shoes). Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
                  } else if (activePreset) {
                    prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a model standing in a scene.
Target Clothing Description: ${item.clothingPrompt} (Variation ${item.sourceIndex + 1}).

Task:
1. Generate a photorealistic image of the model from Input 1 wearing the custom outfit described: "${item.clothingPrompt}" AND wearing specific stockings/hosiery: ${activePreset.prompt}.
2. The described clothing must completely replace the model's original outfit.
3. The model's legs MUST be dressed in the stockings: "${activePreset.prompt}". Render this naturally, photorealistically and smoothly.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot wearing the stockings/hosiery described. Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
                  }

                  const imageUrl = await generateTryOn(
                    tryOnModelImage.base64,
                    tryOnModelImage.mimeType,
                    null,
                    null,
                    prompt,
                    commonApiConfig,
                    stockingImg?.base64,
                    stockingImg?.mimeType
                  );

                  setTryOnResults(prev => prev.map(r => 
                    r.sourceIndex === item.sourceIndex 
                      ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
                      : r
                  ));
                  success = true;
                  if (useCustomApi && customApiKey) {
                    checkKeyUsage(customApiKey, 'custom').catch(() => {});
                  }
                } catch (error: any) {
                  const errorMsg = error.message || '';
                  const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                  if (isQuotaError) {
                    setTryOnResults(prev => prev.map(r => 
                      r.sourceIndex === item.sourceIndex 
                        ? { ...r, result: { ...r.result, status: 'error', error: `额度不足: ${errorMsg}` } } 
                        : r
                    ));
                    break;
                  }

                  retryCount++;
                  if (retryCount > maxRetries) {
                    setTryOnResults(prev => prev.map(r => 
                      r.sourceIndex === item.sourceIndex 
                        ? { ...r, result: { ...r.result, status: 'error', error: errorMsg || 'Generation failed' } } 
                        : r
                    ));
                  }
                  if (!success && retryCount <= maxRetries) await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            } finally {
              setProgressCount(prev => prev + 1);
            }
          }));
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const downloadAllTryOnResults = async () => {
    const downloadData = tryOnResults
      .filter(r => r.result.status === 'success' && r.result.imageUrl)
      .map((r, i) => ({
        imageUrl: r.result.imageUrl,
        status: r.result.status,
        name: `tryon_clothing_${r.sourceIndex + 1}`
      }));
    
    if (downloadData.length === 0) return;
    await downloadResultsAsZip(downloadData, 'try_on_results');
  };

  const retryAllFailedTryOn = async () => {
    const failedItems = tryOnResults.filter(r => r.result.status === 'error');
    if (failedItems.length === 0) return;

    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(failedItems.length);
    try {
      const chunkSize = 20;
      for (let i = 0; i < failedItems.length; i += chunkSize) {
        const chunk = failedItems.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          try {
            await handleRetryTryOnImage(item.sourceIndex);
          } finally {
            setProgressCount(prev => prev + 1);
          }
        }));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryTryOnImage = async (index: number) => {
    if (!tryOnModelImage) return;
    const currentResultItem = tryOnResults.find(r => r.sourceIndex === index);
    const isPromptMode = currentResultItem?.clothingMode === 'prompt';

    let clothingImg: UploadedImage | null = null;
    if (!isPromptMode) {
      clothingImg = tryOnClothingImages[index] || null;
      if (!clothingImg) return;
    }

    let stockingIndex: number | undefined = undefined;
    let stockingPreset: string | undefined = undefined;

    if (tryOnStockingSource === 'upload') {
      if (tryOnStockingImages.length > 0) {
        if (tryOnStockingMatchStrategy === 'force') {
          const idx = Math.floor(Math.random() * tryOnStockingImages.length);
          stockingIndex = idx;
        } else {
          const pool = [-1, ...Array.from({ length: tryOnStockingImages.length }, (_, i) => i)];
          const selected = pool[Math.floor(Math.random() * pool.length)];
          if (selected !== -1) {
            stockingIndex = selected;
          }
        }
      }
    } else {
      if (selectedPresetStockings.length > 0) {
        if (tryOnStockingMatchStrategy === 'force') {
          const idx = Math.floor(Math.random() * selectedPresetStockings.length);
          stockingPreset = selectedPresetStockings[idx];
        } else {
          const pool = [null, ...selectedPresetStockings];
          const selected = pool[Math.floor(Math.random() * pool.length)];
          if (selected !== null) {
            stockingPreset = selected;
          }
        }
      }
    }

    setTryOnResults(prev => prev.map(r => 
      r.sourceIndex === index 
        ? { ...r, stockingIndex: stockingIndex, stockingPreset: stockingPreset, result: { ...r.result, status: 'loading', error: undefined } }
        : r
    ));

    try {
      const stockingImg = stockingIndex !== undefined ? tryOnStockingImages[stockingIndex] : undefined;
      const activePreset = stockingPreset ? STOCKING_PRESETS.find(p => p.id === stockingPreset) : undefined;
      
      let prompt = '';
      if (isPromptMode) {
        const cPrompt = currentResultItem?.clothingPrompt || tryOnClothingPrompt;
        prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a model standing in a scene.
Target Clothing Description: ${cPrompt} (Variation ${index + 1}).

Task:
1. Generate a photorealistic image of the model from Input 1 wearing the custom outfit described above: "${cPrompt}".
2. The described clothing must completely replace the model's original outfit.
3. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
4. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
5. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
6. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot. Ensure the feet are flat on the ground.
7. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
8. Ensure high fidelity for the clothing texture and fit.
9:16`;

        if (stockingImg) {
          prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a model standing in a scene.
Input 2: An image of stockings/hosiery.
Target Clothing Description: ${cPrompt} (Variation ${index + 1}).

Task:
1. Generate a photorealistic image of the model from Input 1 wearing the custom outfit described: "${cPrompt}" AND the stockings from Input 2.
2. The described clothing must completely replace the model's original outfit.
3. The stockings from Input 2 must be worn on the model's legs.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot (or wearing the stockings without shoes). Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
        } else if (activePreset) {
          prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a model standing in a scene.
Target Clothing Description: ${cPrompt} (Variation ${index + 1}).

Task:
1. Generate a photorealistic image of the model from Input 1 wearing the custom outfit described: "${cPrompt}" AND wearing specific stockings/hosiery: ${activePreset.prompt}.
2. The described clothing must completely replace the model's original outfit.
3. The model's legs MUST be dressed in the stockings: "${activePreset.prompt}". Render this naturally, photorealistically and smoothly.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot wearing the stockings/hosiery described. Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
        }
      } else {
        prompt = TRYON_PROMPT;
        if (stockingImg) {
          prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a clothing product (garment).
Input 2: An image of a model standing in a scene.
Input 3: An image of stockings/hosiery.

Task:
1. Generate a photorealistic image of the model from Input 2 wearing the clothing from Input 1 AND the stockings from Input 3.
2. The clothing from Input 1 must completely replace the model's original outfit.
3. The stockings from Input 3 must be worn on the model's legs.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot (or wearing the stockings without shoes). Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
        } else if (activePreset) {
          prompt = `You are an expert AI fashion stylist and photographer.

Input 1: An image of a clothing product (garment).
Input 2: An image of a model standing in a scene.

Task:
1. Generate a photorealistic image of the model from Input 2 wearing the clothing from Input 1 AND wearing specific stockings/hosiery: ${activePreset.prompt}.
2. The clothing from Input 1 must completely replace the model's original outfit.
3. The model's legs MUST be dressed in the stockings: "${activePreset.prompt}". Render this naturally, photorealistically and smoothly.
4. CRITICAL: Change the model's pose to be different from the original image. Make it a natural, stylish standing pose.
5. CRITICAL REQUIREMENT: The model MUST be holding a smartphone in their hand, raised up to cover their face, simulating a "mirror selfie". The face must be obscured by the phone or the phone-holding hand.
6. HAIR MODIFICATION: Change the model's hairstyle to simple, straight long hair (or natural loose long hair).
7. FOOTWEAR MODIFICATION: The model must NOT wear high heels. Please remove any high heels and render the model barefoot wearing the stockings/hosiery described. Ensure the feet are flat on the ground.
8. Maintain the general vibe and background aesthetic of the original scene if possible, or place them in a clean, compatible fashion setting.
9. Ensure high fidelity for the clothing and stockings texture and fit.
9:16`;
        }
      }

      const imageUrl = await generateTryOn(
        tryOnModelImage.base64,
        tryOnModelImage.mimeType,
        clothingImg ? clothingImg.base64 : null,
        clothingImg ? clothingImg.mimeType : null,
        prompt,
        commonApiConfig,
        stockingImg?.base64,
        stockingImg?.mimeType
      );

      setTryOnResults(prev => prev.map(r => 
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
      if (useCustomApi && customApiKey) {
        checkKeyUsage(customApiKey, 'custom').catch(() => {});
      }
    } catch (error: any) {
      setTryOnResults(prev => prev.map(r => 
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Retry failed' } } 
          : r
      ));
    }
  };


  const saveToHistory = async (explicitName?: string) => {
    // History recording is disabled to save local storage/disk space
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Global Progress Bar */}
      {isProcessing && progressTotal > 0 && (
        <div className="fixed bottom-6 right-6 w-80 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-white/90 backdrop-blur-md border border-indigo-100 p-4 shadow-lg rounded-xl">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-indigo-600 flex items-center gap-2">
                  <RefreshCw className="animate-spin" size={14} />
                  批量生成中... 进度: {progressCount} / {progressTotal}
                </span>
                <span className="text-xs font-bold text-indigo-600">
                  {Math.round((progressCount / progressTotal) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200 shadow-inner">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                  style={{ width: `${(progressCount / progressTotal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              PoseGen AI
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* 外部查询余额组件 */}
            {selectedModel !== 'gpt-image-2' && useCustomApi && customApiKey ? (
              <div className="relative group/balance flex items-center gap-2 bg-slate-50 border border-slate-200/70 rounded-lg pl-3 pr-2 py-1.5 transition-all text-xs">
                <span className="text-slate-500 font-medium whitespace-nowrap">
                  自定义 API 余额:
                </span>
                <span className="font-bold text-teal-600 font-mono whitespace-nowrap text-center">
                  {balanceCheck.isLoading && balanceCheck.keyQueried === 'custom' ? (
                    <RefreshCw size={12} className="animate-spin text-teal-500 inline-block" />
                  ) : balanceCheck.error && balanceCheck.keyQueried === 'custom' ? (
                    <span className="text-red-500 font-medium">查询失败</span>
                  ) : balanceCheck.success && balanceCheck.totalAvailable !== null && balanceCheck.keyQueried === 'custom' ? (
                    `￥${(balanceCheck.totalAvailable / 500000).toFixed(4)}元`
                  ) : (
                    '未查询'
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    checkKeyUsage(customApiKey, 'custom');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-2.5 py-1 rounded-md transition-all text-xs shadow-sm flex items-center gap-1 cursor-pointer font-sans"
                  title="点击查询最新额度"
                >
                  <RefreshCw size={11} className={(balanceCheck.isLoading && balanceCheck.keyQueried === 'custom') ? "animate-spin" : ""} />
                  查询余额
                </button>

                {/* 悬浮余额详情 */}
                {balanceCheck.keyQueried === 'custom' && (balanceCheck.success || balanceCheck.error) && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl p-3 shadow-xl z-50 opacity-0 group-hover/balance:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                      额度账单详情
                    </div>
                    {balanceCheck.success && balanceCheck.totalAvailable !== null && (
                      <div className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                        <div className="flex justify-between">
                          <span>账户名称:</span>
                          <span className="font-semibold text-slate-800 font-mono">{balanceCheck.userName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>可用点数:</span>
                          <span className="font-semibold text-slate-800 font-mono">{balanceCheck.totalAvailable.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>已消耗额:</span>
                          <span className="text-slate-500 font-mono">{balanceCheck.totalUsed?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1.5 text-xs">
                          <span>可用余额:</span>
                          <span className="font-bold text-teal-600 font-mono">￥{(balanceCheck.totalAvailable / 500000).toFixed(4)}元</span>
                        </div>
                      </div>
                    )}
                    {balanceCheck.error && (
                      <div className="text-red-500 text-[11px] leading-relaxed">
                        查询出错: {balanceCheck.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <button
              onClick={() => setShowTutorial(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all hover:shadow hover:scale-105 cursor-pointer"
              title="查看抖音短视频3大出图工作流指南"
            >
              <BookOpen size={15} />
              <span>发抖音教程</span>
            </button>
            <div className={`hidden sm:block text-xs font-medium px-3 py-1 rounded-full ${useCustomApi ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {useCustomApi ? '自定义 API' : '官方 Gemini'}
            </div>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
              title="API 设置"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4 pointer-events-none">
           <div className="absolute inset-0 bg-black/10 pointer-events-auto" onClick={() => setShowSettings(false)}></div>
           <div className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl w-full max-w-md p-6 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">API 配置中心</h3>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <div className="font-semibold text-slate-800">启用自定义 API 节点</div>
                  </div>
                  <button 
                    onClick={() => setUseCustomApi(!useCustomApi)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${useCustomApi ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useCustomApi ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {useCustomApi && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <Key size={14} className="text-slate-400" /> API Key
                      </label>
                      <input 
                        type="password"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        placeholder="输入您的密钥"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedModel === 'gpt-image-2' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Key size={14} className="text-slate-400" /> GPT API Key (专用)
                    </label>
                    <input 
                      type="password"
                      value={gptApiKey}
                      onChange={(e) => setGptApiKey(e.target.value)}
                      placeholder="输入 gpt-image-2 专用密钥"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-mono"
                    />
                  </div>
                )}

                {/* Balance & Usage Display */}
                {balanceCheck.keyQueried === 'custom' && (balanceCheck.isLoading || balanceCheck.success || balanceCheck.error) && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <span>密钥状态汇总 (自定义 API)</span>
                      {balanceCheck.isLoading && <RefreshCw size={12} className="animate-spin text-blue-500" />}
                    </div>

                    {balanceCheck.isLoading && (
                      <div className="text-sm text-slate-500 py-1 flex items-center gap-2">
                        正在查询额度使用情况...
                      </div>
                    )}

                    {balanceCheck.error && (
                      <div className="text-xs text-red-500 font-medium py-1">
                        查询出错: {balanceCheck.error}
                      </div>
                    )}

                    {balanceCheck.success && balanceCheck.totalAvailable !== null && (
                      <div className="space-y-2 py-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-slate-600 text-sm">剩余额度：</span>
                          <span className="text-lg font-bold text-teal-600 font-mono">
                            ￥{(balanceCheck.totalAvailable / 500000).toFixed(4)} 元
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>租户名称: {balanceCheck.userName}</span>
                          <span>(剩余点数: {balanceCheck.totalAvailable.toLocaleString()})</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          {balanceCheck.totalGranted && balanceCheck.totalGranted > 0 ? (
                            <div 
                              className="bg-teal-500 h-1.5 rounded-full" 
                              style={{ width: `${Math.min(100, Math.max(0, (balanceCheck.totalAvailable / balanceCheck.totalGranted) * 100))}%` }}
                              title={`${((balanceCheck.totalAvailable / balanceCheck.totalGranted) * 100).toFixed(1)}%`}
                            ></div>
                          ) : (
                            <div className="bg-teal-500 h-1.5 rounded-full w-full"></div>
                          )}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>已用: {balanceCheck.totalUsed?.toLocaleString() || 0}</span>
                          <span>总额: {balanceCheck.totalGranted?.toLocaleString() || 0}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
                <Button 
                  onClick={() => {
                    setShowSettings(false);
                    if (useCustomApi && customApiKey) {
                      checkKeyUsage(customApiKey, 'custom');
                    }
                  }} 
                  className="px-8 bg-slate-900 hover:bg-black"
                >
                  <Check size={16} /> 保存配置
                </Button>
              </div>
           </div>
        </div>
      )}

       {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-3">
                <div className="p-3 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-2xl flex items-center justify-center">
                  <PlayCircle size={30} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-pink-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      抖音爆款指南
                    </span>
                    <h2 className="text-xl font-bold text-white">抖音出图发帖 3 大黄金工作流教程</h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    针对模特换装、保持沙发/椅子场景一致性、爆款姿势模仿等不同场景的完整出图步骤
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowTutorial(false)}
                className="relative z-10 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50 flex-1">
              {/* Flow 1 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[11px] font-bold px-4 py-1 rounded-bl-xl">
                  流程 1：极速秒发流
                </div>
                <div className="flex items-center gap-2 text-blue-600 font-bold text-lg mb-2">
                  <Zap size={20} />
                  <span>模特换装 ➔ 自拍变身 (预设8大姿势)</span>
                </div>
                <p className="text-slate-600 text-xs mb-4 leading-relaxed">
                  <strong className="text-slate-800">核心原理：</strong>无特殊场地与家具依赖，先换上新品服装，然后直接在【自拍变身】使用预设的 8 大姿势（3坐姿/3跪姿/2站姿）一键批量生成 8 张不同姿势着装照，直接发布抖音！
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  <div className="bg-blue-50/60 border border-blue-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">1</span>
                      模特换装
                    </div>
                    <p className="text-[12px] text-slate-600">在【模特换装】上传模特图与服装图，一键为模特穿上新品。</p>
                  </div>
                  <div className="bg-blue-50/60 border border-blue-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">2</span>
                      自拍变身 (预设8姿势)
                    </div>
                    <p className="text-[12px] text-slate-600">上传换装图至【自拍变身】，选择“预设8大姿势”（含3坐姿/3跪姿/2站姿）。</p>
                  </div>
                  <div className="bg-blue-50/60 border border-blue-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">3</span>
                      一键出图发抖音
                    </div>
                    <p className="text-[12px] text-slate-600">批量生成 8 张高质感不同角度美图，一键打包 ZIP 下载并发布！</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setActiveTab('try_on'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 立即前往【模特换装】</span>
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => { setActiveTab('selfie_var'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 立即前往【自拍变身】</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Flow 2 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-teal-600 text-white text-[11px] font-bold px-4 py-1 rounded-bl-xl">
                  流程 2：场景与道具一致性流
                </div>
                <div className="flex items-center gap-2 text-teal-700 font-bold text-lg mb-2">
                  <Box size={20} />
                  <span>模特换装 ➔ 自拍变身 (自定义姿势提示词) ➔ 同姿势变体</span>
                </div>
                <p className="text-slate-600 text-xs mb-4 leading-relaxed">
                  <strong className="text-slate-800">核心原理：</strong>当生成过程中涉及沙发、椅子、床铺等重要道具/背景时，先用自定义提示词生成一张包含该道具的理想样图。再把样图放入【同姿势变体】中，AI 将在锁定沙发/椅子一致的前提下，批量改变肢体动作与拍摄视角！
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  <div className="bg-teal-50/60 border border-teal-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-teal-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[11px]">1</span>
                      模特换装
                    </div>
                    <p className="text-[12px] text-slate-600">先在【模特换装】中为模特换上目标衣服，生成换装基础图。</p>
                  </div>
                  <div className="bg-teal-50/60 border border-teal-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-teal-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[11px]">2</span>
                      自定义场景与道具提示词
                    </div>
                    <p className="text-[12px] text-slate-600">在【自拍变身】切换至“自定义姿势提示词”，输入期望的场景道具（如“坐在复古真皮沙发上”），生成满意样图。</p>
                  </div>
                  <div className="bg-teal-50/60 border border-teal-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-teal-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[11px]">3</span>
                      同姿势变体 (锁死沙发/椅子)
                    </div>
                    <p className="text-[12px] text-slate-600">把样图批量放入【同姿势变体】，AI 将完美保持沙发/椅子形态一致，同时批量改变姿势和视角并导出发布！</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setActiveTab('try_on'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 去【模特换装】</span>
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => { setActiveTab('selfie_var'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 去【自拍变身】</span>
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => { setActiveTab('same_pose'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 去【同姿势变体】</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Flow 3 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-purple-600 text-white text-[11px] font-bold px-4 py-1 rounded-bl-xl">
                  流程 3：爆款姿势模仿与扩展流
                </div>
                <div className="flex items-center gap-2 text-purple-700 font-bold text-lg mb-2">
                  <Sparkles size={20} />
                  <span>模特换装 ➔ 姿势迁移 ➔ 同姿势变体</span>
                </div>
                <p className="text-slate-600 text-xs mb-4 leading-relaxed">
                  <strong className="text-slate-800">核心原理：</strong>精准模仿你指定的爆款参考图姿势，然后将迁移出的结果图批量导入【同姿势变体】，在锁定指定姿势和沙发/椅子道具的前提下，批量改变镜头细节与微动作！
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  <div className="bg-purple-50/60 border border-purple-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px]">1</span>
                      模特换装
                    </div>
                    <p className="text-[12px] text-slate-600">完成模特换装，生成包含目标服装的基础图。</p>
                  </div>
                  <div className="bg-purple-50/60 border border-purple-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px]">2</span>
                      姿势迁移
                    </div>
                    <p className="text-[12px] text-slate-600">在【姿势迁移】上传对标账号的爆款参考图，将换装图精准转化为指定的目标姿势。</p>
                  </div>
                  <div className="bg-purple-50/60 border border-purple-100 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px]">3</span>
                      同姿势变体 (批量丰富细节)
                    </div>
                    <p className="text-[12px] text-slate-600">把迁移后的图批量上传到【同姿势变体】，在锁死指定姿势和沙发/椅子道具的同时，衍生多角度变体并下载发抖音！</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setActiveTab('try_on'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 去【模特换装】</span>
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => { setActiveTab('pose_transfer'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 去【姿势迁移】</span>
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => { setActiveTab('same_pose'); setShowTutorial(false); }}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>👉 去【同姿势变体】</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <Button onClick={() => setShowTutorial(false)} className="px-8 bg-slate-900 hover:bg-black">
                <CheckCircle2 size={16} /> 我知道了，开始创作
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Banner with tutorial shortcut */}
        <div className="mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-xl hidden sm:flex items-center justify-center">
              <PlayCircle size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  抖音出图全流程
                </span>
                <h3 className="font-bold text-base text-white">发抖音 3 大黄金工作流教程指南</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                包含极速秒发流、沙发/椅子场景道具一致性流、以及爆款姿势模仿扩展流。一键查看详细玩法说明！
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowTutorial(true)}
            className="w-full sm:w-auto px-4 py-2 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white font-semibold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <BookOpen size={15} />
            查看教程与流程指南
          </button>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-col items-center gap-6 mb-8">
            <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm inline-flex gap-1 overflow-x-auto max-w-full">
                <button
                    onClick={() => setActiveTab('poses')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'poses' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Layers size={18} />
                    姿势生成
                </button>
                <button
                    onClick={() => setActiveTab('same_pose')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'same_pose' 
                        ? 'bg-teal-50 text-teal-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Copy size={18} />
                    同姿势变体
                </button>
                <button
                    onClick={() => setActiveTab('selfie_var')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'selfie_var' 
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Camera size={18} />
                    自拍变身
                </button>
                <button
                    onClick={() => setActiveTab('try_on')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'try_on' 
                        ? 'bg-orange-50 text-orange-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Shirt size={18} />
                    模特换装
                </button>
                <button
                    onClick={() => setActiveTab('pose_transfer')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'pose_transfer' 
                        ? 'bg-teal-50 text-teal-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <RefreshCw size={18} />
                    姿势迁移
                </button>
                <button
                    onClick={() => setActiveTab('magic')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'magic' 
                        ? 'bg-purple-50 text-purple-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Wand2 size={18} />
                    魔法编辑
                </button>
                <button
                    onClick={() => setActiveTab('batch_tryon')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'batch_tryon' 
                        ? 'bg-pink-50 text-pink-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Layers size={18} />
                    批量换装自拍
                </button>
                <button
                    onClick={() => setActiveTab('text_to_image')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'text_to_image' 
                        ? 'bg-amber-50 text-amber-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Sparkles size={18} />
                    提示词生成
                </button>
            </div>

            {/* Global Model Selector */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <Box size={16} className="text-slate-400" />
                        模型:
                    </span>
                    <div className="relative">
                        <select 
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-8 py-2 cursor-pointer font-medium hover:bg-slate-100 transition-colors"
                        >
                            <option value="gemini-2.5-flash-image">Nano Banana 1 (快速/Flash)</option>
                            <option value="gemini-3-pro-image-preview">Nano Banana 2 (高清/Pro)</option>
                            <option value="gemini-3.1-flash-image-preview">Nano Banana 3 (Flash Preview)</option>
                            <option value="gpt-image-2">GPT Image 2 (专用)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>
                
                {(selectedModel === 'gemini-3-pro-image-preview' || selectedModel === 'gemini-3.1-flash-image-preview') && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            <Monitor size={16} className="text-slate-400" />
                            分辨率:
                        </span>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {(['1K', '2K', '4K'] as const).map((res) => (
                                <button
                                    key={res}
                                    onClick={() => setSelectedResolution(res)}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                        selectedResolution === res 
                                            ? 'bg-white text-blue-600 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {res}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in-up">
            
            {/* 1. POSE GENERATION */}
            {activeTab === 'poses' && (
                <div className="space-y-8 max-w-4xl mx-auto">
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            上传原图
                        </h2>
                        <ImageUploader 
                            currentImage={sourceImage} 
                            onImageSelected={(img) => {
                                setSourceImage(img);
                                setResults([]);
                            }} 
                        />
                    </section>

                    {sourceImage && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <section>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                      <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                      选择目标姿势
                                  </h2>
                                  
                                  {/* Generation Count Selector */}
                                  <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                      <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
                                          <Hash size={14} /> 生成数量:
                                      </span>
                                      <div className="flex items-center gap-2">
                                          <input 
                                              type="range" 
                                              min="1" 
                                              max="8" 
                                              step="1"
                                              value={generationCount}
                                              onChange={(e) => setGenerationCount(parseInt(e.target.value))}
                                              className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                          />
                                          <span className="text-sm font-bold text-blue-600 w-4 text-center">{generationCount}</span>
                                      </div>
                                  </div>
                                </div>

                                <PoseSelector 
                                    selectedPose={selectedPose} 
                                    onSelectPose={handleSelectPose} 
                                    disabled={isProcessing}
                                    customInput={customPoseInput}
                                    onCustomInputChange={setCustomPoseInput}
                                />
                                <div className="mt-6 flex justify-center">
                                    <Button 
                                    onClick={handlePoseGeneration} 
                                    disabled={!selectedPose || isProcessing || (selectedPose === PoseType.CUSTOM_INPUT && !customPoseInput.trim())}
                                    isLoading={isProcessing}
                                    className="w-full sm:w-auto min-w-[200px]"
                                    >
                                    <Sparkles size={18} />
                                    生成 {generationCount} 张姿势变体
                                    </Button>
                                </div>
                            </section>
                            <ResultGrid 
                                results={results} 
                                onRetry={retryPose} 
                                onImageClick={setViewImageUrl}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 2. SAME POSE VARIATIONS (New Tab) */}
            {activeTab === 'same_pose' && (
                <div className="space-y-8 max-w-4xl mx-auto">
                    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-center mb-6">
                            <div className="inline-flex justify-center items-center w-12 h-12 bg-teal-100 text-teal-600 rounded-full mb-3">
                                <Copy size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">同姿势智能变体 (批量)</h2>
                            <p className="text-slate-500 text-sm mt-1">自动识别原图基础姿势（如站立、坐地等），在保持姿势类别不变的前提下，为每张图片生成具有不同肢体动作和角度的全新变体照片。</p>
                        </div>
                        
                        <BatchImageUploader 
                            currentImages={samePoseSourceImages} 
                            onImagesSelected={(imgs) => {
                                setSamePoseSourceImages(imgs);
                                setSamePoseResults([]);
                            }} 
                            maxImages={50}
                            title="上传原图 (批量)"
                            subtitle="支持多选上传最多50张图片，每张图都会独立生成姿势变体"
                        />
                        
                        {samePoseSourceImages.length > 0 && (
                             <div className="mt-6 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-2">
                                {/* Generation Count Selector for Same Pose */}
                                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                                    <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
                                        每张图生成变体数量:
                                    </span>
                                    <div className="flex items-center gap-3 ml-2">
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="8" 
                                            step="1"
                                            value={samePoseCount}
                                            onChange={(e) => setSamePoseCount(parseInt(e.target.value))}
                                            className="w-32 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                                        />
                                        <span className="text-sm font-bold text-teal-600 w-4 text-center">{samePoseCount}</span>
                                    </div>
                                </div>

                                <div className="w-full space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <h3 className="text-sm font-bold text-slate-700">生成选项</h3>
                                    
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={samePoseOnlyStanding}
                                                onChange={(e) => setSamePoseOnlyStanding(e.target.checked)}
                                                className="rounded text-teal-600 focus:ring-teal-500"
                                            />
                                            只生成不同的站姿和手势
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={samePoseBlockFace}
                                                onChange={(e) => setSamePoseBlockFace(e.target.checked)}
                                                className="rounded text-teal-600 focus:ring-teal-500"
                                            />
                                            手机全程挡脸
                                        </label>
                                    </div>
                                </div>

                                <Button 
                                    onClick={handleSamePoseGeneration} 
                                    isLoading={isProcessing}
                                    disabled={isProcessing || samePoseSourceImages.length === 0}
                                    className="px-10 py-3 text-lg bg-teal-600 hover:bg-teal-700 shadow-lg hover:shadow-teal-200/50"
                                >
                                    <Sparkles size={20} />
                                    {isProcessing ? `正在生成 (${progressCount}/${progressTotal})...` : `一键生成 ${samePoseSourceImages.length * samePoseCount} 张同姿势变体`}
                                </Button>
                            </div>
                        )}
                    </section>

                    {/* Results for Same Pose Variations */}
                    {samePoseResults.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-lg font-bold text-slate-800">生成结果列表</h3>
                                <button 
                                    onClick={downloadAllSamePoseResults}
                                    disabled={!samePoseResults.some(r => r.result.status === 'success')}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg font-medium hover:bg-teal-200 transition-colors text-sm disabled:opacity-50"
                                >
                                    <Download size={16} />
                                    一键下载全部 (ZIP)
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {samePoseResults.map((item) => {
                                    const sourceImg = samePoseSourceImages[item.sourceIndex];
                                    const { result } = item;
                                    
                                    return (
                                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                <span className="font-medium text-slate-600 text-sm">图片 #{item.sourceIndex + 1} - 变体 #{item.varIndex + 1}</span>
                                                <button 
                                                    onClick={() => retrySamePose(item.id)}
                                                    disabled={result.status === 'loading'}
                                                    className="text-slate-400 hover:text-teal-600 disabled:opacity-50 transition-colors flex items-center gap-1 text-xs"
                                                >
                                                    <RefreshCw size={14} className={result.status === 'loading' ? 'animate-spin' : ''} />
                                                    重新生成
                                                </button>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-2 h-64">
                                                {/* Source */}
                                                <div className="relative rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                                                    {sourceImg && (
                                                        <img 
                                                            src={`data:${sourceImg.mimeType};base64,${sourceImg.base64}`} 
                                                            className="w-full h-full object-cover" 
                                                            alt="Source" 
                                                        />
                                                    )}
                                                    <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">原图</div>
                                                </div>

                                                {/* Result */}
                                                <div className="relative rounded-lg overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center group">
                                                    {result.status === 'loading' && (
                                                        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                                    )}
                                                    {result.status === 'error' && (
                                                        <div className="text-red-400 text-xs text-center p-2">
                                                            <AlertCircle size={20} className="mx-auto mb-1" />
                                                            {result.error || '生成失败'}
                                                        </div>
                                                    )}
                                                    {result.status === 'success' && result.imageUrl && (
                                                        <>
                                                            <img 
                                                                src={result.imageUrl} 
                                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                                                alt="Result" 
                                                                onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                loading="lazy"
                                                            />
                                                            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                    onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                >
                                                                    <ZoomIn size={14} />
                                                                </button>
                                                                <a 
                                                                    href={result.imageUrl}
                                                                    download={`same-pose-${item.sourceIndex + 1}-${item.varIndex + 1}.png`}
                                                                    className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                >
                                                                    <Download size={14} />
                                                                </a>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. SELFIE VARIATIONS */}
            {activeTab === 'selfie_var' && (
                <div className="space-y-8 max-w-4xl mx-auto">
                    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-center mb-6">
                            <div className="inline-flex justify-center items-center w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full mb-3">
                                <Camera size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">自拍变身模式</h2>
                            <p className="text-slate-500 text-sm mt-1">上传多张图片（最多50张），AI 为每一张图自动生成姿势变体，并全程保持手机挡脸。支持并行高效生成。</p>
                        </div>

                        {/* Mode Toggle */}
                        <div className="flex bg-slate-100 p-1.5 rounded-xl max-w-md mx-auto mb-6 border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setSelfieVarMode('preset')}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    selfieVarMode === 'preset'
                                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Layers size={16} />
                                预设 8 大姿势 (3坐/3跪/2站)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelfieVarMode('prompt')}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    selfieVarMode === 'prompt'
                                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Wand2 size={16} />
                                自定义姿势提示词
                            </button>
                        </div>

                        {/* Custom Prompts Textarea */}
                        {selfieVarMode === 'prompt' && (
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 mb-6 text-left animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                            <Sparkles size={16} className="text-indigo-500" />
                                            自定义姿势提示词列表（每行一个姿势）：
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setSelfieCustomPromptsText(DEFAULT_CUSTOM_SELFIE_POSES.join('\n'))}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 underline font-medium"
                                        >
                                            恢复默认 5 个姿势提示词
                                        </button>
                                    </div>
                                    <textarea
                                        value={selfieCustomPromptsText}
                                        onChange={(e) => setSelfieCustomPromptsText(e.target.value)}
                                        rows={5}
                                        placeholder="请输入想要的姿势提示词，每行写一个姿势..."
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm text-slate-800 font-medium leading-relaxed shadow-sm"
                                    />
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs text-slate-500">
                                    <span>
                                        当前有效姿势数量：
                                        <strong className="text-indigo-600 font-bold ml-1">
                                            {selfieCustomPromptsText.split('\n').map(s => s.trim()).filter(Boolean).length || 5}
                                        </strong> 个
                                    </span>
                                    <span>
                                        每张底图生成 
                                        <strong className="text-indigo-600 font-bold mx-1">
                                            {selfieCustomPromptsText.split('\n').map(s => s.trim()).filter(Boolean).length || 5}
                                        </strong>
                                        张姿势变体
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-6 text-left">
                           <BatchImageUploader 
                                currentImages={selfieSourceImages}
                                onImagesSelected={(imgs) => {
                                    setSelfieSourceImages(imgs);
                                    if (imgs.length === 0) setSelfieResults([]);
                                }}
                                maxImages={50}
                                title="上传自拍底图 (批量)"
                                subtitle={selfieVarMode === 'preset' ? "上传后，每一张图都会生成 8 个姿势变体 (3坐姿/3跪姿/2站姿)" : "上传后，每一张图都会根据上述自定义姿势生成对应变体"}
                            />
                        </div>
                        
                        {selfieSourceImages.length > 0 && (
                            <div className="mt-6 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-700">生成选项</h3>
                                
                                {selfieVarMode === 'preset' && (
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selfieVarOnlyStanding}
                                                onChange={(e) => setSelfieVarOnlyStanding(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            只生成不同的站姿和手势
                                        </label>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={selfieVarBlockFace}
                                            onChange={(e) => setSelfieVarBlockFace(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        手机全程挡脸
                                    </label>
                                </div>
                            </div>
                        )}
                        
                        {selfieSourceImages.length > 0 && (
                             <div className="mt-6 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                                <Button 
                                    onClick={handleSelfieVariationsGeneration} 
                                    isLoading={isProcessing}
                                    className="px-10 py-3 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200/50"
                                >
                                    <Sparkles size={20} />
                                    {selfieVarMode === 'preset'
                                        ? `一键生成 ${selfieSourceImages.length * 8} 张自拍变体 (3坐/3跪/2站)`
                                        : `一键生成 ${selfieSourceImages.length * (selfieCustomPromptsText.split('\n').map(s => s.trim()).filter(Boolean).length || 5)} 张自拍变体 (自定义姿势)`
                                    }
                                </Button>
                            </div>
                        )}
                    </section>

                    {/* Results for Selfie Variations */}
                    {selfieResults.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    变身结果
                                </h3>
                                <div className="flex items-center gap-2">
                                    {selfieResults.some(r => r.result.status === 'error') && (
                                        <button 
                                            onClick={retryAllFailedSelfie}
                                            disabled={isProcessing}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors text-sm disabled:opacity-50"
                                        >
                                            <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} />
                                            一键失败重试
                                        </button>
                                    )}
                                    <button 
                                        onClick={downloadAllSelfieResults}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200 transition-colors text-sm"
                                    >
                                        <Download size={16} />
                                        一键下载全部 (含原图/文件夹分类)
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {selfieResults.map((item, idx) => {
                                    const { result, templateLabel, sourceIndex } = item;

                                    return (
                                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col group">
                                            {/* Header */}
                                            <div className="p-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">图 {sourceIndex + 1} - {templateLabel}</span>
                                                <button 
                                                    onClick={() => retrySelfieVariation(item.id)}
                                                    disabled={result.status === 'loading'}
                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors disabled:opacity-50"
                                                    title="重新生成这张"
                                                >
                                                    <RefreshCw size={14} className={result.status === 'loading' ? 'animate-spin' : ''} />
                                                </button>
                                            </div>

                                            {/* Image Area */}
                                            <div className="relative aspect-[3/4] bg-slate-50 flex items-center justify-center overflow-hidden">
                                                {result.status === 'loading' && (
                                                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                )}
                                                {result.status === 'error' && (
                                                    <div className="text-red-400 text-[10px] text-center p-2">
                                                        <AlertCircle size={16} className="mx-auto mb-1" />
                                                        生成失败
                                                    </div>
                                                )}
                                                {result.status === 'success' && result.imageUrl && (
                                                    <>
                                                        <img 
                                                            src={result.imageUrl} 
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                                            alt={templateLabel} 
                                                            onClick={() => setViewImageUrl(result.imageUrl!)}
                                                            loading="lazy"
                                                        />
                                                        {/* Hover Actions */}
                                                        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                onClick={() => setViewImageUrl(result.imageUrl!)}
                                                            >
                                                                <ZoomIn size={14} />
                                                            </button>
                                                            <a 
                                                                href={result.imageUrl}
                                                                download={`selfie-var-${sourceIndex}-${idx}.png`}
                                                                className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                            >
                                                                <Download size={14} />
                                                            </a>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 4. MAGIC EDITOR */}
            {activeTab === 'magic' && (
                <div className="space-y-8 max-w-4xl mx-auto">
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            上传原图 (批量)
                        </h2>
                        <BatchImageUploader 
                            currentImages={magicImages} 
                            onImagesSelected={(imgs) => {
                                setMagicImages(imgs);
                                setMagicResults([]);
                            }}
                            maxImages={30}
                        />
                    </section>

                    {magicImages.length > 0 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <MagicEditor 
                                onGenerate={handleMagicEdit} 
                                isGenerating={isProcessing} 
                                disabled={isProcessing}
                            />
                            
                            {magicResults.length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center px-4">
                                        <h3 className="text-xl font-bold text-slate-800">编辑结果列表</h3>
                                        <button 
                                            onClick={() => downloadAll(magicResults.map(r => r.result.imageUrl).filter(Boolean) as string[], 'magic-edit')}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors text-sm"
                                        >
                                            <Download size={16} />
                                            一键下载全部
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                                        {magicResults.map((item, idx) => {
                                            const sourceImg = magicImages[item.sourceIndex];
                                            const { result } = item;
                                            
                                            return (
                                                <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                        <span className="font-medium text-slate-600 text-sm">图片 #{idx + 1}</span>
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={() => handleRetryMagicEdit(idx, "Retry magic edit")} // Note: we might need to store the prompt if we want true retry, but for now we can just pass a generic or maybe we don't need retry here if prompt is lost. Actually MagicEditor has its own state. Let's just disable retry or pass a generic prompt. Wait, the user might want to retry with the same prompt. Let's just use a generic retry or remove the retry button for magic batch. Let's remove the retry button for simplicity since the prompt is in the MagicEditor component.
                                                                disabled={true}
                                                                className="hidden p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                                title="重新生成这张"
                                                            >
                                                                <RefreshCw size={14} className={result.status === 'loading' ? 'animate-spin' : ''} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="p-4 grid grid-cols-2 gap-2 h-64">
                                                        {/* Source */}
                                                        <div className="relative rounded-lg overflow-hidden bg-slate-100">
                                                            <img 
                                                                src={`data:${sourceImg.mimeType};base64,${sourceImg.base64}`} 
                                                                className="w-full h-full object-cover opacity-80" 
                                                                alt="Source" 
                                                            />
                                                            <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">原图</div>
                                                        </div>

                                                        {/* Result */}
                                                        <div className="relative rounded-lg overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center group">
                                                            {result.status === 'loading' && (
                                                                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                                            )}
                                                            {result.status === 'error' && (
                                                                <div className="text-red-400 text-xs text-center p-2">
                                                                    <AlertCircle size={20} className="mx-auto mb-1" />
                                                                    生成失败
                                                                </div>
                                                            )}
                                                            {result.status === 'success' && result.imageUrl && (
                                                                <>
                                                                    <img 
                                                                        src={result.imageUrl} 
                                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                                                        alt="Result" 
                                                                        onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                        loading="lazy"
                                                                    />
                                                                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button 
                                                                            className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                            onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                        >
                                                                            <ZoomIn size={14} />
                                                                        </button>
                                                                        <a 
                                                                            href={result.imageUrl}
                                                                            download={`magic-edit-${idx}.png`}
                                                                            className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                        >
                                                                            <Download size={14} />
                                                                        </a>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 6. TRY ON (NEW TAB) */}
            {activeTab === 'try_on' && (
                <div className="space-y-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center max-w-4xl mx-auto">
                        <div className="flex justify-center mb-4 text-orange-500">
                            <Shirt size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">模特换装</h2>
                        <p className="text-slate-500 mb-6">先上传一张模特图，再上传多张衣服平铺图（1-50张），AI 将自动把衣服穿到模特身上。系统支持一次最多并行生成50层任务。</p>
                        
                        <div className="space-y-6 text-left">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                    上传模特图
                                </h3>
                                <ImageUploader 
                                    currentImage={tryOnModelImage} 
                                    onImageSelected={(img) => {
                                        setTryOnModelImage(img);
                                    }} 
                                />
                            </div>

                            {tryOnModelImage && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                        换装衣服选择 / 提示词输入
                                    </h3>

                                    {/* Toggle button group */}
                                    <div className="flex bg-slate-100 p-1.5 rounded-xl max-w-md border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setTryOnClothingMode('image')}
                                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                                tryOnClothingMode === 'image'
                                                    ? 'bg-white text-orange-600 shadow-sm border border-slate-200/60'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <Shirt size={16} />
                                            上传衣服平铺图 (批量)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTryOnClothingMode('prompt')}
                                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                                tryOnClothingMode === 'prompt'
                                                    ? 'bg-white text-orange-600 shadow-sm border border-slate-200/60'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <Wand2 size={16} />
                                            自行输入提示词
                                        </button>
                                    </div>

                                    {tryOnClothingMode === 'image' ? (
                                        <BatchImageUploader 
                                            currentImages={tryOnClothingImages}
                                            onImagesSelected={(imgs) => {
                                                setTryOnClothingImages(imgs);
                                                if (imgs.length === 0) setTryOnResults([]);
                                            }}
                                            maxImages={50}
                                            title="上传衣服图 (批量)"
                                            subtitle="支持多选，建议使用平铺图"
                                        />
                                    ) : (
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                                        <Sparkles size={16} className="text-orange-500" />
                                                        服装外观提示词描述：
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTryOnClothingPrompt('中国风、吊带、超短、某款式，旗袍（超短款式，紧身，开叉设计）')}
                                                        className="text-xs text-orange-600 hover:text-orange-700 underline font-medium"
                                                    >
                                                        恢复默认提示词
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={tryOnClothingPrompt}
                                                    onChange={(e) => setTryOnClothingPrompt(e.target.value)}
                                                    rows={3}
                                                    placeholder="请输入想要为模特换上的服装细节描述..."
                                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm text-slate-800 font-normal leading-relaxed shadow-sm"
                                                />
                                            </div>

                                            {/* Generate Count for prompt mode */}
                                            <div className="space-y-2 border-t border-slate-200/60 pt-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-600">生成图片张数：</span>
                                                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                                        {tryOnPromptCount} 张
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400 font-medium">1</span>
                                                    <input 
                                                        type="range"
                                                        min={1}
                                                        max={15}
                                                        value={tryOnPromptCount}
                                                        onChange={(e) => setTryOnPromptCount(Number(e.target.value))}
                                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                                    />
                                                    <span className="text-xs text-slate-400 font-medium">15</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {tryOnModelImage && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/80 space-y-6 text-left">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                        丝袜搭配设置 (可选)
                                    </h3>

                                    {/* Tab toggle for Source */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">丝袜来源方式：</label>
                                        <div className="flex bg-slate-200/60 p-1 rounded-xl max-w-md">
                                            <button
                                                type="button"
                                                onClick={() => setTryOnStockingSource('upload')}
                                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                                    tryOnStockingSource === 'upload'
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                            >
                                                上传丝袜平铺图
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTryOnStockingSource('preset')}
                                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                                    tryOnStockingSource === 'preset'
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                            >
                                                选择系统内置丝袜 ({STOCKING_PRESETS.length}种)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Uploading source view */}
                                    {tryOnStockingSource === 'upload' && (
                                        <div className="space-y-2 animate-in fade-in duration-200">
                                            <p className="text-xs text-slate-500 mb-2">上传实物平铺图后，AI 将从中随机选择。建议使用干净的平铺图。</p>
                                            <BatchImageUploader 
                                                currentImages={tryOnStockingImages}
                                                onImagesSelected={(imgs) => {
                                                    setTryOnStockingImages(imgs);
                                                }}
                                                maxImages={50}
                                                title="上传丝袜图 (可选/批量)"
                                                subtitle="支持多选，建议使用平铺白底图"
                                            />
                                        </div>
                                    )}

                                    {/* Preset source view */}
                                    {tryOnStockingSource === 'preset' && (
                                        <div className="space-y-4 animate-in fade-in duration-200">
                                            <div className="flex justify-between items-center flex-wrap gap-2">
                                                <div>
                                                    <p className="text-xs text-slate-500">
                                                        请在下方勾选搭配库中支持的丝袜款式（支持多选）。
                                                    </p>
                                                    {selectedPresetStockings.length > 0 && (
                                                        <p className="text-xs font-semibold text-orange-600 mt-1">
                                                            已勾选 {selectedPresetStockings.length} 款内置丝袜样式
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedPresetStockings(STOCKING_PRESETS.map(p => p.id))}
                                                        className="text-xs px-2.5 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors rounded-lg font-medium"
                                                    >
                                                        全选
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedPresetStockings([])}
                                                        className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors rounded-lg font-medium"
                                                    >
                                                        清空
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Presets Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {STOCKING_PRESETS.map((preset) => {
                                                    const isSelected = selectedPresetStockings.includes(preset.id);
                                                    return (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setSelectedPresetStockings(prev => prev.filter(id => id !== preset.id));
                                                                } else {
                                                                    setSelectedPresetStockings(prev => [...prev, preset.id]);
                                                                }
                                                            }}
                                                            className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                                                                isSelected
                                                                    ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500/20 shadow-sm'
                                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col gap-0.5 pr-1 min-w-0 flex-1">
                                                                <span className="text-xs font-semibold text-slate-800 truncate">{preset.label}</span>
                                                                <span className="text-[9px] text-slate-400 truncate" title={preset.prompt}>
                                                                    {preset.prompt}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${preset.color.split(' ')[0] || 'bg-slate-400'}`}></span>
                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                                                    isSelected
                                                                        ? 'bg-orange-500 border-orange-500 text-white'
                                                                        : 'border-slate-300'
                                                                }`}>
                                                                    {isSelected && <Check size={10} strokeWidth={3} />}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Matching Strategy */}
                                    <div className="border-t border-slate-200/80 pt-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">丝袜匹配衣服机制：</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                                            <button
                                                type="button"
                                                onClick={() => setTryOnStockingMatchStrategy('random')}
                                                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                                    tryOnStockingMatchStrategy === 'random'
                                                        ? 'border-orange-500 bg-orange-50/30'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                                                    tryOnStockingMatchStrategy === 'random'
                                                        ? 'border-orange-500 text-orange-500'
                                                        : 'border-slate-300'
                                                }`}>
                                                    {tryOnStockingMatchStrategy === 'random' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold text-slate-800">随机匹配或不穿</span>
                                                    <span className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                                        随机给每件衣服匹配已勾选的随机一个丝袜或者不穿丝袜。
                                                    </span>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setTryOnStockingMatchStrategy('force')}
                                                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                                    tryOnStockingMatchStrategy === 'force'
                                                        ? 'border-orange-500 bg-orange-50/30'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                                                    tryOnStockingMatchStrategy === 'force'
                                                        ? 'border-orange-500 text-orange-500'
                                                        : 'border-slate-300'
                                                }`}>
                                                    {tryOnStockingMatchStrategy === 'force' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold text-slate-800">强制全匹配</span>
                                                    <span className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                                        所有生成的衣服都必须在已选丝袜中挑选一款（不允许不穿丝袜）。
                                                    </span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {tryOnModelImage && (tryOnClothingMode === 'image' ? tryOnClothingImages.length > 0 : tryOnClothingPrompt.trim().length > 0) && (
                            <div className="mt-8 flex justify-center">
                                <Button 
                                    onClick={handleTryOnGeneration} 
                                    isLoading={isProcessing}
                                    className="px-10 py-3 text-lg bg-orange-600 hover:bg-orange-700 shadow-lg hover:shadow-orange-200/50"
                                >
                                    <Sparkles size={20} />
                                    {tryOnClothingMode === 'image'
                                        ? `一键生成 ${tryOnClothingImages.length} 张换装图`
                                        : `一键生成 ${tryOnPromptCount} 张换装图 (根据提示词)`
                                    }
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Results Grid for Try On */}
                    {tryOnResults.length > 0 && (
                         <div className="space-y-6">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-xl font-bold text-slate-800">生成结果列表</h3>
                                <div className="flex items-center gap-2">
                                    {tryOnResults.some(r => r.result.status === 'error') && (
                                        <button 
                                            onClick={retryAllFailedTryOn}
                                            disabled={isProcessing}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors text-sm disabled:opacity-50"
                                        >
                                            <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} />
                                            一键失败重试
                                        </button>
                                    )}
                                    <button 
                                        onClick={downloadAllTryOnResults}
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors text-sm"
                                    >
                                        <Download size={16} />
                                        一键下载全部
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                                {tryOnResults.map((item, idx) => {
                                    const clothingImg = item.clothingMode === 'prompt' ? null : tryOnClothingImages[item.sourceIndex];
                                    const stockingImg = item.stockingIndex !== undefined ? tryOnStockingImages[item.stockingIndex] : undefined;
                                    const { result } = item;
                                    
                                    return (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                <span className="font-medium text-slate-600 text-sm">
                                                    {item.clothingMode === 'prompt' ? `提示词换装 #${idx + 1}` : `衣服 #${idx + 1}`}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handleRetryTryOnImage(item.sourceIndex)}
                                                        disabled={result.status === 'loading'}
                                                        className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                        title="重新生成这张"
                                                    >
                                                        <RefreshCw size={14} className={result.status === 'loading' ? 'animate-spin' : ''} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-2 h-64">
                                                {/* Source */}
                                                <div className="relative rounded-lg overflow-hidden bg-slate-100 flex flex-col gap-1">
                                                    <div className="relative h-1/3 rounded overflow-hidden">
                                                        <img 
                                                            src={`data:${tryOnModelImage!.mimeType};base64,${tryOnModelImage!.base64}`} 
                                                            className="w-full h-full object-cover opacity-80" 
                                                            alt="Model" 
                                                        />
                                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">模特</div>
                                                    </div>
                                                    <div className="relative h-1/3 rounded overflow-hidden bg-slate-200">
                                                        {item.clothingMode === 'prompt' || !clothingImg ? (
                                                            <div className="w-full h-full bg-orange-900/80 text-orange-100 p-1 flex flex-col justify-center items-center text-center overflow-hidden">
                                                                <span className="text-[8px] text-orange-300 font-bold block">提示词服装</span>
                                                                <span className="text-[9px] line-clamp-2 leading-tight px-1 font-normal text-white/90" title={item.clothingPrompt || tryOnClothingPrompt}>
                                                                    {item.clothingPrompt || tryOnClothingPrompt}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <img 
                                                                    src={`data:${clothingImg.mimeType};base64,${clothingImg.base64}`} 
                                                                    className="w-full h-full object-cover opacity-80" 
                                                                    alt="Clothing" 
                                                                />
                                                                <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">衣服</div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="relative h-1/3 rounded overflow-hidden bg-slate-200 flex items-center justify-center p-1 text-center">
                                                        {stockingImg ? (
                                                            <>
                                                                <img 
                                                                    src={`data:${stockingImg.mimeType};base64,${stockingImg.base64}`} 
                                                                    className="w-full h-full object-cover opacity-80" 
                                                                    alt="Stocking" 
                                                                />
                                                                <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">丝袜</div>
                                                            </>
                                                        ) : item.stockingPreset ? (
                                                            (() => {
                                                                const preset = STOCKING_PRESETS.find(p => p.id === item.stockingPreset);
                                                                return (
                                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white p-1 select-none rounded overflow-hidden">
                                                                        <span className="text-[9px] font-semibold block leading-tight text-orange-200 truncate max-w-full px-0.5">
                                                                            {preset?.label || item.stockingPreset}
                                                                        </span>
                                                                        <span className="text-[8px] text-slate-400 block scale-90">系统内置</span>
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400">无丝袜</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Result */}
                                                <div className="relative rounded-lg overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center group">
                                                    {result.status === 'loading' && (
                                                        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                                    )}
                                                    {result.status === 'error' && (
                                                        <div className="text-red-400 text-xs text-center p-2">
                                                            <AlertCircle size={20} className="mx-auto mb-1" />
                                                            生成失败
                                                        </div>
                                                    )}
                                                    {result.status === 'success' && result.imageUrl && (
                                                        <>
                                                            <img 
                                                                src={result.imageUrl} 
                                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                                                alt="Result" 
                                                                onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                loading="lazy"
                                                            />
                                                            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                    onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                >
                                                                    <ZoomIn size={14} />
                                                                </button>
                                                                <a 
                                                                    href={result.imageUrl}
                                                                    download={`tryon-${idx}.png`}
                                                                    className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                >
                                                                    <Download size={14} />
                                                                </a>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                         </div>
                    )}
                </div>
            )}
            {/* Pose Transfer Content */}
            {activeTab === 'pose_transfer' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Base Image Upload */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="bg-teal-100 text-teal-700 p-1.5 rounded-lg">
                                    <Camera size={20} />
                                </span>
                                上传底图 (批量，最多50张)
                            </h2>
                            <p className="text-sm text-slate-500 mb-6">
                                上传多张底图，AI 将保持各底图人物的身份和背景风格，并为每张底图随机匹配一个上传的姿势进行迁移。
                            </p>
                            <BatchImageUploader 
                                onImagesSelected={(imgs) => {
                                    setPoseTransferBaseImages(imgs);
                                    setPoseTransferResults([]);
                                }} 
                                currentImages={poseTransferBaseImages} 
                                maxImages={50}
                                title="上传底图 (批量)"
                                subtitle="支持多选上传最多50张底图"
                            />
                        </div>

                        {/* Reference Images Upload */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="bg-teal-100 text-teal-700 p-1.5 rounded-lg">
                                    <Layers size={20} />
                                </span>
                                上传姿势参考图 (最多15张)
                            </h2>
                            <p className="text-sm text-slate-500 mb-6">
                                上传包含目标姿势的参考图（最多15张）。生成的每张底图都会随机从这些姿势图中匹配一个姿势。
                            </p>
                            <BatchImageUploader 
                                onImagesSelected={(imgs) => {
                                    setPoseTransferRefImages(imgs);
                                    setPoseTransferResults([]);
                                }}
                                currentImages={poseTransferRefImages}
                                maxImages={15}
                                title="上传姿势参考图 (批量)"
                                subtitle="支持多选上传最多15张姿势图"
                            />
                        </div>
                    </div>

                    <div className="flex justify-center pt-4">
                        <Button 
                            onClick={handlePoseTransferGeneration} 
                            disabled={isProcessing || poseTransferBaseImages.length === 0 || poseTransferRefImages.length === 0}
                            size="lg"
                            className="px-12 py-4 text-lg bg-teal-600 hover:bg-teal-700 shadow-teal-200"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="animate-spin mr-2" size={24} />
                                    正在迁移姿势 ({progressCount}/{progressTotal})...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2" size={24} />
                                    一键迁移 ({poseTransferBaseImages.length}张底图，随机分配姿势)
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Results Grid for Pose Transfer */}
                    {poseTransferResults.length > 0 && (
                         <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-xl font-bold text-slate-800">生成结果列表</h3>
                                <Button 
                                    onClick={downloadAllPoseTransferResults}
                                    variant="outline"
                                    size="sm"
                                    disabled={!poseTransferResults.some(r => r.result.status === 'success')}
                                    className="flex items-center gap-2"
                                >
                                    <Download size={16} />
                                    一键下载全部 (ZIP)
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                                {poseTransferResults.map((item) => {
                                    const baseImg = poseTransferBaseImages[item.baseIndex];
                                    const refImg = poseTransferRefImages[item.poseIndex];
                                    const { result } = item;
                                    
                                    return (
                                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                <span className="font-medium text-slate-600 text-sm">
                                                    底图 #{item.baseIndex + 1} ➔ 姿势 #{item.poseIndex + 1}
                                                </span>
                                                <button 
                                                    onClick={() => handleRegeneratePoseTransferItem(item.id)}
                                                    disabled={result.status === 'loading'}
                                                    className="text-slate-400 hover:text-teal-600 disabled:opacity-50 transition-colors flex items-center gap-1 text-xs"
                                                >
                                                    <RefreshCw size={14} className={result.status === 'loading' ? 'animate-spin' : ''} />
                                                    重新生成
                                                </button>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-2 h-64">
                                                {/* Source */}
                                                <div className="relative rounded-lg overflow-hidden bg-slate-100 flex flex-col gap-1">
                                                    <div className="relative h-1/2 rounded overflow-hidden">
                                                        {baseImg && (
                                                            <img 
                                                                src={`data:${baseImg.mimeType};base64,${baseImg.base64}`} 
                                                                className="w-full h-full object-cover opacity-80" 
                                                                alt="Base" 
                                                            />
                                                        )}
                                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">底图 #{item.baseIndex + 1}</div>
                                                    </div>
                                                    <div className="relative h-1/2 rounded overflow-hidden">
                                                        {refImg && (
                                                            <img 
                                                                src={`data:${refImg.mimeType};base64,${refImg.base64}`} 
                                                                className="w-full h-full object-cover opacity-80" 
                                                                alt="Reference Pose" 
                                                            />
                                                        )}
                                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">姿势 #{item.poseIndex + 1}</div>
                                                    </div>
                                                </div>

                                                {/* Result */}
                                                <div className="relative rounded-lg overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center group">
                                                    {result.status === 'loading' && (
                                                        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                                    )}
                                                    {result.status === 'error' && (
                                                        <div className="text-red-400 text-xs text-center p-2">
                                                            <AlertCircle size={20} className="mx-auto mb-1" />
                                                            {result.error || '生成失败'}
                                                        </div>
                                                    )}
                                                    {result.status === 'success' && result.imageUrl && (
                                                        <>
                                                            <img 
                                                                src={result.imageUrl} 
                                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                                                alt="Result" 
                                                                onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                loading="lazy"
                                                            />
                                                            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                    onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                >
                                                                    <ZoomIn size={14} />
                                                                </button>
                                                                <a 
                                                                    href={result.imageUrl}
                                                                    download={`pose-transfer-base${item.baseIndex + 1}-pose${item.poseIndex + 1}.png`}
                                                                    className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                >
                                                                    <Download size={14} />
                                                                </a>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                         </div>
                    )}
                </div>
            )}
            {/* 7. BATCH TRY-ON */}
            {activeTab === 'batch_tryon' && (
                <div className="space-y-8 max-w-5xl mx-auto">
                    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-center mb-6">
                            <div className="inline-flex justify-center items-center w-12 h-12 bg-pink-100 text-pink-600 rounded-full mb-3">
                                <Layers size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">批量换装自拍</h2>
                            <p className="text-slate-500 text-sm mt-1">上传多张服装图片并输入提示词，一键生成多张自拍变体。支持一次最多并行生成50个结果。</p>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">生成提示词</label>
                            <textarea
                                value={batchPrompt}
                                onChange={(e) => setBatchPrompt(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-shadow resize-none"
                                rows={3}
                                placeholder="例如：一个人穿着参考图的所有服装站在镜子前自拍"
                            />
                        </div>

                        <BatchImageUploader 
                            currentImages={batchClothingImages} 
                            onImagesSelected={(imgs) => {
                                setBatchClothingImages(imgs);
                                setBatchResults([]);
                            }}
                            maxImages={20}
                            title="批量上传服装图片"
                            subtitle="支持多选，最多 20 张"
                        />
                        
                        {batchClothingImages.length > 0 && (
                             <div className="mt-6 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                                <Button 
                                    onClick={handleBatchGeneration} 
                                    isLoading={isProcessing}
                                    disabled={!batchPrompt.trim()}
                                    className="px-10 py-3 text-lg bg-pink-600 hover:bg-pink-700 shadow-lg hover:shadow-pink-200/50"
                                >
                                    <Sparkles size={20} />
                                    一键生成 {batchClothingImages.length} 张换装自拍
                                </Button>
                            </div>
                        )}
                    </section>

                    {/* Results for Batch Try-on */}
                    {batchResults.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    生成结果
                                </h3>
                                <div className="flex items-center gap-2">
                                    {batchResults.some(r => r.result.status === 'error') && (
                                        <button 
                                            onClick={retryAllFailedBatchTryOn}
                                            disabled={isProcessing}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors text-sm disabled:opacity-50"
                                        >
                                            <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} />
                                            一键失败重试
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => downloadAll(batchResults.map(r => r.result.imageUrl).filter(Boolean) as string[], 'batch-tryon')}
                                        className="flex items-center gap-2 px-4 py-2 bg-pink-100 text-pink-700 rounded-lg font-medium hover:bg-pink-200 transition-colors text-sm"
                                    >
                                        <Download size={16} />
                                        一键下载全部
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {batchResults.map((item, idx) => {
                                    const { result, sourceIndex } = item;
                                    const clothingImg = batchClothingImages[sourceIndex];

                                    return (
                                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col group">
                                            {/* Header */}
                                            <div className="p-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                                <span className="text-xs font-medium text-slate-600">服装 {sourceIndex + 1}</span>
                                                <button 
                                                    onClick={() => retryBatchGeneration(item.id)}
                                                    disabled={result.status === 'loading'}
                                                    className="p-1 text-slate-400 hover:text-pink-600 hover:bg-white rounded transition-colors disabled:opacity-50"
                                                    title="重新生成这张"
                                                >
                                                    <RefreshCw size={14} className={result.status === 'loading' ? 'animate-spin' : ''} />
                                                </button>
                                            </div>

                                            {/* Reference Clothing Image (Small Thumbnail) */}
                                            <div className="absolute top-10 left-2 w-12 h-16 rounded shadow-md border border-white overflow-hidden z-10 opacity-80 hover:opacity-100 transition-opacity">
                                                <img 
                                                    src={`data:${clothingImg.mimeType};base64,${clothingImg.base64}`} 
                                                    className="w-full h-full object-cover" 
                                                    alt="Clothing Ref" 
                                                />
                                            </div>

                                            {/* Image Area */}
                                            <div className="relative aspect-[3/4] bg-slate-50 flex items-center justify-center overflow-hidden">
                                                {result.status === 'loading' && (
                                                    <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                                                )}
                                                {result.status === 'error' && (
                                                    <div className="text-red-400 text-xs text-center p-2">
                                                        <AlertCircle size={16} className="mx-auto mb-1" />
                                                        失败
                                                    </div>
                                                )}
                                                {result.status === 'success' && result.imageUrl && (
                                                    <>
                                                        <img 
                                                            src={result.imageUrl} 
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                                            alt={`Try-on ${sourceIndex + 1}`} 
                                                            onClick={() => setViewImageUrl(result.imageUrl!)}
                                                            loading="lazy"
                                                        />
                                                        {/* Hover Actions */}
                                                        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setViewImageUrl(result.imageUrl!);
                                                                }}
                                                                title="放大查看"
                                                            >
                                                                <ZoomIn size={14} />
                                                            </button>
                                                            <button 
                                                                className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Send to Pose Transfer
                                                                    const dataUrl = result.imageUrl!;
                                                                    const mimeType = dataUrl.split(';')[0].split(':')[1] || 'image/png';
                                                                    const base64 = dataUrl.split(',')[1] || '';
                                                                    
                                                                    setPoseTransferBaseImage({
                                                                        mimeType,
                                                                        base64
                                                                    });
                                                                    setActiveTab('pose_transfer');
                                                                }}
                                                                title="发送到姿势迁移"
                                                            >
                                                                <ArrowRight size={14} />
                                                            </button>
                                                            <button 
                                                                className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Send to Same Pose
                                                                    const dataUrl = result.imageUrl!;
                                                                    const mimeType = dataUrl.split(';')[0].split(':')[1] || 'image/png';
                                                                    const base64 = dataUrl.split(',')[1] || '';
                                                                    
                                                                    setSamePoseSourceImage({
                                                                        mimeType,
                                                                        base64
                                                                    });
                                                                    setActiveTab('same_pose');
                                                                }}
                                                                title="发送到同姿势变体"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <a 
                                                                href={result.imageUrl}
                                                                download={`batch-tryon-${sourceIndex}.png`}
                                                                className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Download size={14} />
                                                            </a>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                         </div>
                    )}
                </div>
            )}

            {/* Text to Image Tab Content */}
            {activeTab === 'text_to_image' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Left: Configuration */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Sparkles className="text-amber-500" size={20} />
                                            生成参数
                                        </h3>
                                        
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">生成数量 (1-8)</label>
                                                <div className="flex gap-2 flex-wrap">
                                                    {[1, 2, 4, 8].map(num => (
                                                        <button
                                                            key={num}
                                                            onClick={() => setTextToImageCount(num)}
                                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                                textToImageCount === num 
                                                                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500' 
                                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {num} 张
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">参考图 (可选)</label>
                                                <ImageUploader 
                                                    onImageSelected={setTextToImageRefImage} 
                                                    currentImage={textToImageRefImage}
                                                />
                                                {textToImageRefImage && (
                                                    <button 
                                                        onClick={() => setTextToImageRefImage(null)}
                                                        className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1"
                                                    >
                                                        <X size={12} /> 移除参考图
                                                    </button>
                                                )}
                                            </div>

                                            <div className="pt-4">
                                                <Button 
                                                    variant="primary"
                                                    onClick={handleTextToImageGeneration}
                                                    disabled={!textToImagePrompt.trim() || isProcessing}
                                                    className="w-full bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                                                >
                                                    <Sparkles size={18} />
                                                    {isProcessing ? '生成中...' : '开始生成图片'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Prompt & Results */}
                                <div className="lg:col-span-8 space-y-6">
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Layers className="text-amber-500" size={20} />
                                            内容描述
                                        </h3>
                                        <textarea
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-h-[120px] focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                                            placeholder="输入详细的图片描述提示词 (支持中文和英文)..."
                                            value={textToImagePrompt}
                                            onChange={(e) => setTextToImagePrompt(e.target.value)}
                                        />
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button 
                                                onClick={() => setTextToImagePrompt(p => p + (p ? ', ' : '') + 'photorealistic, high quality, highly detailed')}
                                                className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] hover:bg-slate-200 transition-colors"
                                            >
                                                + 高清
                                            </button>
                                            <button 
                                                onClick={() => setTextToImagePrompt(p => p + (p ? ', ' : '') + 'anime style, 2d, hand drawn')}
                                                className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] hover:bg-slate-200 transition-colors"
                                            >
                                                + 动漫风
                                            </button>
                                            <button 
                                                onClick={() => setTextToImagePrompt(p => p + (p ? ', ' : '') + 'cyberpunk, futuristic, neon lights')}
                                                className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] hover:bg-slate-200 transition-colors"
                                            >
                                                + 赛博朋克
                                            </button>
                                        </div>
                                    </div>

                                    {/* Result area */}
                                    {textToImageResults.length > 0 && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center px-4">
                                                <h3 className="text-xl font-bold text-slate-800">生成结果</h3>
                                                <div className="flex items-center gap-2">
                                                    {textToImageResults.some(r => r.result.status === 'error') && (
                                                        <button 
                                                            onClick={retryAllFailedTextToImage}
                                                            disabled={isProcessing}
                                                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors text-sm disabled:opacity-50"
                                                        >
                                                            <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} />
                                                            一键失败重试
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={downloadAllTextToImage}
                                                        className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition-colors text-sm"
                                                    >
                                                        <Download size={16} />
                                                        一键下载全部
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                {textToImageResults.map((item) => {
                                                    const { result } = item;

                                                    return (
                                                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col group relative">
                                                            <div className="absolute top-2 right-2 z-10">
                                                                <button 
                                                                    onClick={() => retryTextToImage(item.id)}
                                                                    disabled={result.status === 'loading'}
                                                                    className="p-1.5 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-amber-600 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                                                    title="重新生成"
                                                                >
                                                                    <RefreshCw size={14} className={result.status === 'loading' ? 'animate-spin' : ''} />
                                                                </button>
                                                            </div>

                                                            <div className="relative aspect-[9/16] bg-slate-50 flex items-center justify-center overflow-hidden">
                                                                {result.status === 'loading' && (
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                                                        <span className="text-[10px] text-slate-400 font-medium">生成中...</span>
                                                                    </div>
                                                                )}
                                                                {result.status === 'error' && (
                                                                    <div className="text-red-400 text-xs text-center p-3">
                                                                        <AlertCircle size={20} className="mx-auto mb-2" />
                                                                        <p className="font-bold mb-1">生成失败</p>
                                                                        <p className="line-clamp-2 opacity-70">{result.error}</p>
                                                                    </div>
                                                                )}
                                                                {result.status === 'success' && result.imageUrl && (
                                                                    <>
                                                                        <img 
                                                                            src={result.imageUrl} 
                                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" 
                                                                            alt="Generated" 
                                                                            onClick={() => setViewImageUrl(result.imageUrl!)}
                                                                            loading="lazy"
                                                                        />
                                                                        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <a 
                                                                                href={result.imageUrl}
                                                                                download={`result_${item.id}.png`}
                                                                                className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white text-slate-700 transition-all hover:scale-110"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                title="下载图片"
                                                                            >
                                                                                <Download size={16} />
                                                                            </a>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

      {/* Lightbox Modal */}
      <ImageModal imageUrl={viewImageUrl} onClose={() => setViewImageUrl(null)} />
    </div>
  );
};

export default App;