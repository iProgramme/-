import React, { useState, useEffect } from 'react';
import { UploadedImage, PoseType, GenerationResult } from './types';
import { POSES, VARIATION_COUNT } from './constants';
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
import { Layers, Wand2, Sparkles, AlertTriangle, AlertCircle, Settings, X, Check, Globe, Key, Smartphone, ArrowRight, Download, ZoomIn, RefreshCw, Hash, Camera, Copy, Monitor, Zap, Box, Shirt } from 'lucide-react';

// Selfie Variations Templates (Single Image -> 8 Variations)
// 2 Sitting, 2 Kneeling, 2 Squatting, 2 Standing
import { historyDb, GenerationSession } from './db';
import { HistoryPanel } from './components/HistoryPanel';

const SELFIE_TEMPLATES = [
  { 
    label: "地板坐姿 1", 
    prompts: [
      "Sitting on the floor, legs crossed comfortably. Mirror selfie style, phone covering face.",
      "Sitting on the floor, one leg extended, one leg bent. Mirror selfie style, phone covering face.",
      "Sitting on the floor, hugging knees to chest. Mirror selfie style, phone covering face.",
      "Sitting on the floor, leaning forward with elbows on knees. Mirror selfie style, phone covering face.",
      "Sitting on the floor, butterfly stretch pose (soles of feet together). Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "地板坐姿 2", 
    prompts: [
      "Sitting on the floor, legs extended to the side, leaning on one hand. Mirror selfie style, phone covering face.",
      "Sitting on the floor, leaning back on hands, legs straight out. Mirror selfie style, phone covering face.",
      "Sitting on the floor, side saddle pose (legs to one side). Mirror selfie style, phone covering face.",
      "Sitting on the floor, legs wide apart in a V-shape, hands between legs. Mirror selfie style, phone covering face.",
      "Sitting on the floor, one leg tucked under, casual pose. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "地板跪姿 1", 
    prompts: [
      "Kneeling on the floor, sitting on heels, cute pose. Mirror selfie style, phone covering face.",
      "Kneeling on the floor, upright posture, hands on thighs. Mirror selfie style, phone covering face.",
      "Kneeling on the floor, leaning forward slightly toward the mirror. Mirror selfie style, phone covering face.",
      "Kneeling on the floor, hands on hips, confident pose. Mirror selfie style, phone covering face.",
      "Kneeling on the floor, sitting on heels, leaning back slightly on hands. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "地板跪姿 2", 
    prompts: [
      "Kneeling on one knee (proposing style but casual), fashion pose. Mirror selfie style, phone covering face.",
      "Kneeling on one knee, other leg extended to side. Mirror selfie style, phone covering face.",
      "High kneeling pose, engaging core, upright. Mirror selfie style, phone covering face.",
      "Kneeling on one knee, elbow resting on the raised knee. Mirror selfie style, phone covering face.",
      "Kneeling on one knee, body turned slightly to the side. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "地板蹲姿 1", 
    prompts: [
      "Squatting on the floor, cool street style vibe. Mirror selfie style, phone covering face.",
      "Squatting, resting elbows on knees. Mirror selfie style, phone covering face.",
      "Squatting with feet wide apart. Mirror selfie style, phone covering face.",
      "Squatting, one leg extended to the side (Cossack squat style). Mirror selfie style, phone covering face.",
      "Squatting, looking down at the phone, moody vibe. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "地板蹲姿 2", 
    prompts: [
      "Deep squat on the floor, casual and trendy. Mirror selfie style, phone covering face.",
      "Squatting on toes, balancing. Mirror selfie style, phone covering face.",
      "Side squat pose, angled to the mirror. Mirror selfie style, phone covering face.",
      "Full deep squat (Asian squat), comfortable and grounded. Mirror selfie style, phone covering face.",
      "Squatting, holding knees with free hand. Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "站姿 1", 
    prompts: [
      "Standing pose, slight turn to show outfit side profile. Mirror selfie style, phone covering face.",
      "Standing pose, one leg forward. Mirror selfie style, phone covering face.",
      "Standing pose, leaning weight on one hip (contrapposto). Mirror selfie style, phone covering face.",
      "Standing pose, looking back over shoulder slightly. Mirror selfie style, phone covering face.",
      "Standing pose, leaning against a wall (implied). Mirror selfie style, phone covering face."
    ]
  },
  { 
    label: "站姿 2", 
    prompts: [
      "Standing pose, facing forward, confident stance. Mirror selfie style, phone covering face.",
      "Standing pose, crossing legs at ankles. Mirror selfie style, phone covering face.",
      "Standing pose, walking motion (mid-stride). Mirror selfie style, phone covering face.",
      "Standing pose, hand on hip, power pose. Mirror selfie style, phone covering face.",
      "Standing pose, wide stance, fashion model vibe. Mirror selfie style, phone covering face."
    ]
  }
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
  const [samePoseSourceImage, setSamePoseSourceImage] = useState<UploadedImage | null>(null);
  const [samePoseResults, setSamePoseResults] = useState<GenerationResult[]>([]);
  const [samePoseCount, setSamePoseCount] = useState<number>(8);

  // Magic Edit State (Batch)
  const [magicImages, setMagicImages] = useState<UploadedImage[]>([]);
  const [magicResults, setMagicResults] = useState<{sourceIndex: number, result: GenerationResult}[]>([]);

  // Batch Try-on State (New Tab)
  const [batchClothingImages, setBatchClothingImages] = useState<UploadedImage[]>([]);
  const [batchPrompt, setBatchPrompt] = useState('一个人穿着参考图的所有服装站在镜子前自拍');
  const [batchResults, setBatchResults] = useState<{id: string, sourceIndex: number, result: GenerationResult}[]>([]);

  // Selfie Variation State (New Tab)
  const [selfieSourceImages, setSelfieSourceImages] = useState<UploadedImage[]>([]);
  const [selfieResults, setSelfieResults] = useState<{
    id: string;
    sourceIndex: number;
    templateLabel: string;
    prompts: string[];
    result: GenerationResult;
    prompt: string;
  }[]>([]);
  const [selfieVarOnlyStanding, setSelfieVarOnlyStanding] = useState(false);
  const [selfieVarBlockFace, setSelfieVarBlockFace] = useState(true);
  const [selfieVarCount, setSelfieVarCount] = useState(8);

  // Try-on State (New Tab)
  const [tryOnModelImage, setTryOnModelImage] = useState<UploadedImage | null>(null);
  const [tryOnClothingImages, setTryOnClothingImages] = useState<UploadedImage[]>([]);
  const [tryOnStockingImages, setTryOnStockingImages] = useState<UploadedImage[]>([]);
  const [tryOnResults, setTryOnResults] = useState<{sourceIndex: number, result: GenerationResult, stockingIndex?: number}[]>([]);

  // Pose Transfer State (New Tab)
  const [poseTransferBaseImage, setPoseTransferBaseImage] = useState<UploadedImage | null>(null);
  const [poseTransferRefImages, setPoseTransferRefImages] = useState<UploadedImage[]>([]);
  const [poseTransferResults, setPoseTransferResults] = useState<{sourceIndex: number, result: GenerationResult}[]>([]);
  
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
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [apiKeyError, setApiKeyError] = useState(false);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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

  // Auto-save history when a batch finishes or periodically during progress
  useEffect(() => {
    if (!isProcessing && progressTotal > 0 && progressCount === progressTotal) {
      saveToHistory();
    }
  }, [isProcessing, progressCount, progressTotal]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && progressTotal > 0) {
      interval = setInterval(() => {
        saveToHistory();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isProcessing, progressTotal]);

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
    if (!samePoseSourceImage) return;

    // AI Prompt to intelligently identify and keep the base posture while changing specifics
    const basePrompt = "Identify the character's current general posture category (e.g., standing, sitting on the floor, squatting, kneeling). Keep the character in this EXACT SAME general posture category, but change the specific pose, hand/leg placements, body language, and camera angle to create a completely new and dynamic variation. Maintain clothes and background identity. High quality photorealistic.";

    const newResults: GenerationResult[] = Array.from({ length: samePoseCount }).map((_, index) => ({
      id: `same-pose-${Date.now()}-${index}`,
      poseId: 'same-pose',
      status: 'loading'
    }));

    setSamePoseResults(newResults);
    setIsProcessing(true);

    try {
      await Promise.all(newResults.map(async (resultItem, index) => {
        try {
          const variedPrompt = `${basePrompt} (Variation ${index + 1}: make it highly unique and different from other variations).`;
          const imageUrl = await generateImageEdit(
            samePoseSourceImage.base64,
            samePoseSourceImage.mimeType,
            variedPrompt,
            commonApiConfig
          );

          setSamePoseResults(prev => prev.map(r => 
            r.id === resultItem.id ? { ...r, status: 'success', imageUrl } : r
          ));
        } catch (error: any) {
          setSamePoseResults(prev => prev.map(r => 
            r.id === resultItem.id ? { ...r, status: 'error', error: error.message || '生成失败' } : r
          ));
        }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const retrySamePose = async (resultId: string) => {
    if (!samePoseSourceImage) return;
    const basePrompt = "Identify the character's current general posture category (e.g., standing, sitting on the floor, squatting, kneeling). Keep the character in this EXACT SAME general posture category, but change the specific pose, hand/leg placements, body language, and camera angle to create a completely new and dynamic variation. Maintain clothes and background identity. High quality photorealistic.";

    setSamePoseResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'loading', error: undefined } : r));
    try {
      const variedPrompt = `${basePrompt} (Variation Retry ${Date.now()}).`;
      const imageUrl = await generateImageEdit(
        samePoseSourceImage.base64,
        samePoseSourceImage.mimeType,
        variedPrompt,
        commonApiConfig
      );
      setSamePoseResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'success', imageUrl } : r));
    } catch (error: any) {
      setSamePoseResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'error', error: error.message } : r));
    }
  };

  const handleSelfieVariationsGeneration = async () => {
    if (selfieSourceImages.length === 0) return;

    const availableTemplates = selfieVarOnlyStanding 
      ? SELFIE_TEMPLATES.filter(t => t.label.includes('站姿'))
      : SELFIE_TEMPLATES;

    const allNewResults: typeof selfieResults = [];

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
          result: {
            id,
            poseId: 'selfie-var',
            status: 'loading' as const
          }
        });
      });
    });

    setSelfieResults(allNewResults);
    setIsProcessing(true);
    setActiveSessionId(null);
    setProgressCount(0);
    setProgressTotal(allNewResults.length);

    try {
      // Process in small chunks to avoid overload
      const chunkSize = 50;
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
                
                if (selfieVarOnlyStanding) {
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
              } catch (error: any) {
                const errorMsg = error.message || '';
                const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                if (isQuotaError) {
                  setSelfieResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: '额度不足 (Quota exceeded)' } } 
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
      const newRandomPrompt = item.prompts[Math.floor(Math.random() * item.prompts.length)];

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
      
      if (selfieVarOnlyStanding) {
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
      const chunkSize = 50;
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
    setActiveSessionId(null);
    setProgressCount(0);
    setProgressTotal(newResults.length);

    try {
      // Process in chunks of 50 to balance speed and rate limits
      const chunkSize = 50;
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
      const chunkSize = 50;
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
    if (!poseTransferBaseImage || poseTransferRefImages.length === 0) return;

    const newResults = poseTransferRefImages.map((_, index) => ({
      sourceIndex: index,
      result: {
        id: `pose-transfer-${Date.now()}-${index}`,
        poseId: 'pose-transfer',
        status: 'loading' as const
      }
    }));

    setPoseTransferResults(newResults);
    setIsProcessing(true);

    try {
      // Calculate aspect ratio from base image
      const dims = await getImageDimensions(poseTransferBaseImage.base64, poseTransferBaseImage.mimeType);
      const aspectRatio = getClosestAspectRatio(dims.width, dims.height);

      await Promise.all(newResults.map(async (item, index) => {
        try {
          const refImage = poseTransferRefImages[index];
          
          const imageUrl = await generatePoseTransfer(
            poseTransferBaseImage.base64,
            poseTransferBaseImage.mimeType,
            refImage.base64,
            refImage.mimeType,
            { ...commonApiConfig, aspectRatio }
          );

          setPoseTransferResults(prev => prev.map(r => 
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
              : r
          ));
        } catch (error: any) {
           setPoseTransferResults(prev => prev.map(r => 
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } 
              : r
          ));
        }
      }));
    } catch (error) {
      console.error("Failed to get image dimensions", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegeneratePoseTransferItem = async (sourceIndex: number) => {
    if (!poseTransferBaseImage || !poseTransferRefImages[sourceIndex]) return;

    setPoseTransferResults(prev => prev.map(r => 
      r.sourceIndex === sourceIndex 
        ? { ...r, result: { ...r.result, status: 'loading', error: undefined } } 
        : r
    ));

    try {
      const dims = await getImageDimensions(poseTransferBaseImage.base64, poseTransferBaseImage.mimeType);
      const aspectRatio = getClosestAspectRatio(dims.width, dims.height);
      const refImage = poseTransferRefImages[sourceIndex];
      
      const imageUrl = await generatePoseTransfer(
        poseTransferBaseImage.base64,
        poseTransferBaseImage.mimeType,
        refImage.base64,
        refImage.mimeType,
        { ...commonApiConfig, aspectRatio }
      );

      setPoseTransferResults(prev => prev.map(r => 
        r.sourceIndex === sourceIndex 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
    } catch (error: any) {
      setPoseTransferResults(prev => prev.map(r => 
        r.sourceIndex === sourceIndex 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } 
          : r
      ));
    }
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
    setActiveSessionId(null);
    setProgressCount(0);
    setProgressTotal(newResults.length);

    try {
      const chunkSize = 2; // Process in small chunks for stability
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
              } catch (error: any) {
                const errorMsg = error.message || '';
                const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                if (isQuotaError) {
                  setTextToImageResults(prev => prev.map(r => 
                    r.id === item.id 
                      ? { ...r, result: { ...r.result, status: 'error', error: '额度不足 (Quota exceeded)' } } 
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
      const chunkSize = 2;
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
    if (!tryOnModelImage || tryOnClothingImages.length === 0) return;

    const newResults = tryOnClothingImages.map((_, index) => {
      let stockingIndex: number | undefined = undefined;
      if (tryOnStockingImages.length > 0) {
        const pool = [-1, ...Array.from({ length: tryOnStockingImages.length }, (_, i) => i)];
        const selected = pool[Math.floor(Math.random() * pool.length)];
        if (selected !== -1) {
          stockingIndex = selected;
        }
      }

      return {
        sourceIndex: index,
        stockingIndex: stockingIndex,
        result: {
          id: `tryon-${Date.now()}-${index}`,
          poseId: 'tryon',
          status: 'loading' as const
        }
      };
    });

    setTryOnResults(newResults);
    setIsProcessing(true);
    setActiveSessionId(null);
    setProgressCount(0);
    setProgressTotal(newResults.length);

    try {
      const chunkSize = 50;
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
              } catch (error: any) {
                const errorMsg = error.message || '';
                const isQuotaError = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('额度');

                if (isQuotaError) {
                  setTryOnResults(prev => prev.map(r => 
                    r.sourceIndex === item.sourceIndex 
                      ? { ...r, result: { ...r.result, status: 'error', error: '额度不足 (Quota exceeded)' } } 
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
      const chunkSize = 50;
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
    const clothingImg = tryOnClothingImages[index];
    if (!clothingImg) return;

    // Re-roll stocking selection on retry? Or keep same?
    // Let's re-roll to give user variety
    let stockingIndex: number | undefined = undefined;
    if (tryOnStockingImages.length > 0) {
      const pool = [-1, ...Array.from({ length: tryOnStockingImages.length }, (_, i) => i)];
      const selected = pool[Math.floor(Math.random() * pool.length)];
      if (selected !== -1) {
        stockingIndex = selected;
      }
    }

    setTryOnResults(prev => prev.map(r => 
      r.sourceIndex === index 
        ? { ...r, stockingIndex: stockingIndex, result: { ...r.result, status: 'loading', error: undefined } }
        : r
    ));

    try {
      const stockingImg = stockingIndex !== undefined ? tryOnStockingImages[stockingIndex] : undefined;
      
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
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
    } catch (error: any) {
      setTryOnResults(prev => prev.map(r => 
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Retry failed' } } 
          : r
      ));
    }
  };


  const saveToHistory = async (explicitName?: string) => {
    let data: any = {};
    let type = activeTab;
    let name = explicitName || '';

    if (activeTab === 'selfie_var') {
      data = {
        selfieSourceImages,
        results: selfieResults,
        selfieVarOnlyStanding,
        selfieVarBlockFace
      };
      if (!name) name = `自拍变身 - ${selfieResults.length}张图片`;
    } else if (activeTab === 'try_on') {
      data = {
        tryOnModelImage,
        tryOnClothingImages,
        tryOnStockingImages,
        results: tryOnResults
      };
      if (!name) name = `模特换装 - ${tryOnResults.length}组任务`;
    } else if (activeTab === 'batch_tryon') {
      data = {
        batchClothingImages,
        batchPrompt,
        results: batchResults
      };
      if (!name) name = `批量换装自拍 - ${batchResults.length}组任务`;
    } else if (activeTab === 'text_to_image') {
      data = {
        textToImagePrompt,
        textToImageRefImage,
        textToImageCount,
        results: textToImageResults
      };
      if (!name) name = `提示词生成 - ${textToImageResults.length}张图片`;
    } else {
      return;
    }

    try {
      if (activeSessionId && !explicitName) {
        await historyDb.sessions.update(activeSessionId, {
          timestamp: new Date(),
          data: JSON.parse(JSON.stringify(data))
        });
      } else {
        const id = await historyDb.sessions.add({
          timestamp: new Date(),
          type,
          name,
          data: JSON.parse(JSON.stringify(data))
        });
        if (!explicitName) setActiveSessionId(id as number);
      }
      if (explicitName) alert('已成功保存到历史记录');
    } catch (err) {
      console.error('History save failed:', err);
    }
  };

  const restoreFromHistory = (session: GenerationSession) => {
    setActiveTab(session.type as any);
    const { data } = session;
    
    if (session.type === 'selfie_var') {
      setSelfieSourceImages(data.selfieSourceImages || []);
      setSelfieResults(data.results || []);
      setSelfieVarOnlyStanding(data.selfieVarOnlyStanding ?? false);
      setSelfieVarBlockFace(data.selfieVarBlockFace ?? true);
    } else if (session.type === 'try_on') {
      setTryOnModelImage(data.tryOnModelImage || null);
      setTryOnClothingImages(data.tryOnClothingImages || []);
      setTryOnStockingImages(data.tryOnStockingImages || []);
      setTryOnResults(data.results || []);
    } else if (session.type === 'batch_tryon') {
      setBatchClothingImages(data.batchClothingImages || []);
      setBatchPrompt(data.batchPrompt || '');
      setBatchResults(data.results || []);
    } else if (session.type === 'text_to_image') {
      setTextToImagePrompt(data.textToImagePrompt || '');
      setTextToImageRefImage(data.textToImageRefImage || null);
      setTextToImageCount(data.textToImageCount || 4);
      setTextToImageResults(data.results || []);
    }
    
    setShowHistory(false);
  };


  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {showHistory && (
        <HistoryPanel 
          onClose={() => setShowHistory(false)} 
          onRestore={restoreFromHistory} 
        />
      )}
      {/* Global Progress Bar */}
      {isProcessing && progressTotal > 0 && (
        <div className="fixed top-0 left-0 w-full z-[100] animate-in fade-in slide-in-from-top-4">
          <div className="bg-white/90 backdrop-blur-md border-b border-indigo-100 p-3 shadow-md">
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
            <div className={`hidden sm:block text-xs font-medium px-3 py-1 rounded-full ${useCustomApi ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {useCustomApi ? '自定义 API' : '官方 Gemini'}
            </div>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
              title="历史记录"
            >
              <Box size={20} />
            </button>
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
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
                <Button onClick={() => setShowSettings(false)} className="px-8 bg-slate-900 hover:bg-black">
                  <Check size={16} /> 保存配置
                </Button>
              </div>
           </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        
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
                            <h2 className="text-xl font-bold text-slate-800">同姿势智能变体</h2>
                            <p className="text-slate-500 text-sm mt-1">自动识别原图基础姿势（如站立、坐地等），在保持姿势类别不变的前提下，生成具有不同肢体动作和角度的全新照片。</p>
                        </div>
                        
                        <ImageUploader 
                            currentImage={samePoseSourceImage} 
                            onImageSelected={(img) => {
                                setSamePoseSourceImage(img);
                                setSamePoseResults([]);
                            }} 
                        />
                        
                        {samePoseSourceImage && (
                             <div className="mt-6 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-2">
                                {/* Generation Count Selector for Same Pose */}
                                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                                    <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
                                        生成变体数量:
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

                                <Button 
                                    onClick={handleSamePoseGeneration} 
                                    isLoading={isProcessing}
                                    className="px-10 py-3 text-lg bg-teal-600 hover:bg-teal-700 shadow-lg hover:shadow-teal-200/50"
                                >
                                    <Sparkles size={20} />
                                    生成 {samePoseCount} 张同姿势变体
                                </Button>
                            </div>
                        )}
                    </section>

                    {/* Results for Same Pose Variations */}
                    {samePoseResults.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center mb-4 px-1">
                                <h3 className="text-lg font-bold text-slate-800">生成结果列表</h3>
                                <button 
                                    onClick={() => downloadAll(samePoseResults.map(r => r.imageUrl).filter(Boolean) as string[], 'same-pose')}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg font-medium hover:bg-teal-200 transition-colors text-sm"
                                >
                                    <Download size={16} />
                                    一键下载全部
                                </button>
                            </div>
                            <ResultGrid 
                                results={samePoseResults} 
                                onRetry={retrySamePose} 
                                onImageClick={setViewImageUrl}
                            />
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
                            <p className="text-slate-500 text-sm mt-1">上传多张图片（最多50张），AI 为每一张图自动生成 8张不同姿势变体，并全程保持手机挡脸。支持一次最多并行生成50个，效率翻倍。</p>
                        </div>
                        
                        <div className="space-y-6 text-left">
                           <BatchImageUploader 
                                currentImages={selfieSourceImages}
                                onImagesSelected={(imgs) => {
                                    setSelfieSourceImages(imgs);
                                    if (imgs.length === 0) setSelfieResults([]);
                                }}
                                maxImages={50}
                                title="上传自拍底图 (批量)"
                                subtitle="上传后，每一张图都会生成8个姿势变体"
                            />
                        </div>
                        
                        {selfieSourceImages.length > 0 && (
                            <div className="mt-6 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-700">生成选项</h3>
                                
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
                                    一键生成 {selfieSourceImages.length * 8} 张自拍变体
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
                                    <button 
                                        onClick={() => saveToHistory()}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm"
                                        title="保存当前结果到历史记录"
                                    >
                                        <Box size={16} />
                                        保存全部分类
                                    </button>
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
                                <div className="animate-in fade-in slide-in-from-bottom-4">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                        上传衣服平铺图 (批量)
                                    </h3>
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
                                </div>
                            )}

                            {tryOnModelImage && (
                                <div className="animate-in fade-in slide-in-from-bottom-4">
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                        上传丝袜平铺图 (可选/批量)
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-2">上传后，AI 将在生成时随机选择一款丝袜搭配，或随机不穿丝袜。</p>
                                    <BatchImageUploader 
                                        currentImages={tryOnStockingImages}
                                        onImagesSelected={(imgs) => {
                                            setTryOnStockingImages(imgs);
                                        }}
                                        maxImages={50}
                                        title="上传丝袜图 (可选/批量)"
                                        subtitle="AI 将从中随机挑选进行搭配"
                                    />
                                </div>
                            )}
                        </div>

                        {tryOnModelImage && tryOnClothingImages.length > 0 && (
                            <div className="mt-8 flex justify-center">
                                <Button 
                                    onClick={handleTryOnGeneration} 
                                    isLoading={isProcessing}
                                    className="px-10 py-3 text-lg bg-orange-600 hover:bg-orange-700 shadow-lg hover:shadow-orange-200/50"
                                >
                                    <Sparkles size={20} />
                                    一键生成 {tryOnClothingImages.length} 张换装图
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
                                    <button 
                                        onClick={() => saveToHistory()}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm"
                                        title="保存当前结果到历史记录"
                                    >
                                        <Box size={16} />
                                        保存记录
                                    </button>
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
                                    const clothingImg = tryOnClothingImages[item.sourceIndex];
                                    const stockingImg = item.stockingIndex !== undefined ? tryOnStockingImages[item.stockingIndex] : undefined;
                                    const { result } = item;
                                    
                                    return (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                <span className="font-medium text-slate-600 text-sm">衣服 #{idx + 1}</span>
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handleRetryTryOnImage(idx)}
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
                                                    <div className="relative h-1/3 rounded overflow-hidden">
                                                        <img 
                                                            src={`data:${clothingImg.mimeType};base64,${clothingImg.base64}`} 
                                                            className="w-full h-full object-cover opacity-80" 
                                                            alt="Clothing" 
                                                        />
                                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">衣服</div>
                                                    </div>
                                                    <div className="relative h-1/3 rounded overflow-hidden bg-slate-200 flex items-center justify-center">
                                                        {stockingImg ? (
                                                            <>
                                                                <img 
                                                                    src={`data:${stockingImg.mimeType};base64,${stockingImg.base64}`} 
                                                                    className="w-full h-full object-cover opacity-80" 
                                                                    alt="Stocking" 
                                                                />
                                                                <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">丝袜</div>
                                                            </>
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
                                上传底图 (保持人物)
                            </h2>
                            <p className="text-sm text-slate-500 mb-6">
                                上传一张包含人物的底图，AI 将保持该人物的身份、面部特征、服装和背景风格。
                            </p>
                            <ImageUploader 
                                onImageSelected={setPoseTransferBaseImage} 
                                currentImage={poseTransferBaseImage} 
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
                                上传包含目标姿势的参考图。底图中的人物将分别转换为这些参考图中的姿势。
                            </p>
                            <BatchImageUploader 
                                onImagesSelected={setPoseTransferRefImages}
                                currentImages={poseTransferRefImages}
                                maxImages={15}
                            />
                        </div>
                    </div>

                    <div className="flex justify-center pt-4">
                        <Button 
                            onClick={handlePoseTransferGeneration} 
                            disabled={isProcessing || !poseTransferBaseImage || poseTransferRefImages.length === 0}
                            size="lg"
                            className="px-12 py-4 text-lg bg-teal-600 hover:bg-teal-700 shadow-teal-200"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="animate-spin mr-2" size={24} />
                                    正在迁移姿势...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2" size={24} />
                                    一键迁移 ({poseTransferRefImages.length}张)
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
                                    onClick={() => downloadAll(poseTransferResults.map(r => r.result.imageUrl).filter(Boolean) as string[], 'pose-transfer')}
                                    variant="outline"
                                    size="sm"
                                    disabled={!poseTransferResults.some(r => r.result.status === 'success')}
                                    className="flex items-center gap-2"
                                >
                                    <Download size={16} />
                                    一键下载全部
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                                {poseTransferResults.map((item, idx) => {
                                    const refImg = poseTransferRefImages[item.sourceIndex];
                                    const { result } = item;
                                    
                                    return (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                <span className="font-medium text-slate-600 text-sm">姿势 #{idx + 1}</span>
                                                <button 
                                                    onClick={() => handleRegeneratePoseTransferItem(item.sourceIndex)}
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
                                                        <img 
                                                            src={`data:${poseTransferBaseImage!.mimeType};base64,${poseTransferBaseImage!.base64}`} 
                                                            className="w-full h-full object-cover opacity-80" 
                                                            alt="Base" 
                                                        />
                                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">底图</div>
                                                    </div>
                                                    <div className="relative h-1/2 rounded overflow-hidden">
                                                        <img 
                                                            src={`data:${refImg.mimeType};base64,${refImg.base64}`} 
                                                            className="w-full h-full object-cover opacity-80" 
                                                            alt="Reference Pose" 
                                                        />
                                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">姿势</div>
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
                                                                    download={`pose-transfer-${idx}.png`}
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
                                    <button 
                                        onClick={() => saveToHistory()}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm"
                                        title="保存当前结果到历史记录"
                                    >
                                        <Box size={16} />
                                        保存记录
                                    </button>
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
                                                    <button 
                                                        onClick={() => saveToHistory()}
                                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm"
                                                        title="保存当前结果到历史记录"
                                                    >
                                                        <Box size={16} />
                                                        保存记录
                                                    </button>
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