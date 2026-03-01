import React, { useState, useEffect } from 'react';
import { UploadedImage, PoseType, GenerationResult } from './types';
import { POSES, VARIATION_COUNT } from './constants';
import { generateImageEdit, generateTryOn } from './services/geminiService';
import { ImageUploader } from './components/ImageUploader';
import { BatchImageUploader } from './components/BatchImageUploader'; // New Component
import { PoseSelector } from './components/PoseSelector';
import { ResultGrid } from './components/ResultGrid';
import { MagicEditor } from './components/MagicEditor';
import { ImageModal } from './components/ImageModal';
import { Button } from './components/Button';
import { Layers, Wand2, Sparkles, AlertTriangle, AlertCircle, Settings, X, Check, Globe, Key, Smartphone, ArrowRight, Download, ZoomIn, RefreshCw, Hash, Camera, Copy, Monitor, Zap, Box, Shirt } from 'lucide-react';

// Mirror Selfie Specific Poses to cycle through (Batch Mode)
const MIRROR_POSES = [
  "one hand on hip, standing confident",
  "peace sign with free hand, cute standing pose",
  "slightly leaning to the side, relaxed",
  "one leg crossed in front, fashion standing pose",
  "adjusting hair with free hand",
  "holding a coffee cup in free hand",
  "hand in pocket, cool standing pose",
  "waving slightly, friendly pose",
  "showing outfit details, slight side angle",
  "two hands holding phone (if possible), steady stance"
];

// Selfie Variations Templates (Single Image -> 8 Variations)
// 2 Sitting, 2 Kneeling, 2 Squatting, 2 Standing
const SELFIE_TEMPLATES = [
  { label: "地板坐姿 1", prompt: "Sitting on the floor, legs crossed comfortably. Mirror selfie style, phone covering face." },
  { label: "地板坐姿 2", prompt: "Sitting on the floor, legs extended to the side, leaning on one hand. Mirror selfie style, phone covering face." },
  { label: "地板跪姿 1", prompt: "Kneeling on the floor, sitting on heels, cute pose. Mirror selfie style, phone covering face." },
  { label: "地板跪姿 2", prompt: "Kneeling on one knee (proposing style but casual), fashion pose. Mirror selfie style, phone covering face." },
  { label: "地板蹲姿 1", prompt: "Squatting on the floor, cool street style vibe. Mirror selfie style, phone covering face." },
  { label: "地板蹲姿 2", prompt: "Deep squat on the floor, casual and trendy. Mirror selfie style, phone covering face." },
  { label: "站姿 1", prompt: "Standing pose, slight turn to show outfit side profile. Mirror selfie style, phone covering face." },
  { label: "站姿 2", prompt: "Standing pose, facing forward, confident stance. Mirror selfie style, phone covering face." }
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'poses' | 'same_pose' | 'selfie_var' | 'magic' | 'mirror' | 'try_on'>('poses');
  
  // Single Image State (Pose & Magic)
  const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
  const [generationCount, setGenerationCount] = useState<number>(4); // Default to 4
  
  // Same Pose Variation State
  const [samePoseSourceImage, setSamePoseSourceImage] = useState<UploadedImage | null>(null);
  const [samePoseResults, setSamePoseResults] = useState<GenerationResult[]>([]);
  const [samePoseCount, setSamePoseCount] = useState<number>(8);

  // Batch Image State (Mirror Selfie)
  const [mirrorImages, setMirrorImages] = useState<UploadedImage[]>([]);
  const [mirrorResults, setMirrorResults] = useState<{sourceIndex: number, result: GenerationResult}[]>([]);

  // Selfie Variation State (New Tab)
  const [selfieSourceImage, setSelfieSourceImage] = useState<UploadedImage | null>(null);
  const [selfieResults, setSelfieResults] = useState<{templateIndex: number, result: GenerationResult}[]>([]);

  // Try-on State (New Tab)
  const [tryOnModelImage, setTryOnModelImage] = useState<UploadedImage | null>(null);
  const [tryOnClothingImages, setTryOnClothingImages] = useState<UploadedImage[]>([]);
  const [tryOnStockingImages, setTryOnStockingImages] = useState<UploadedImage[]>([]);
  const [tryOnResults, setTryOnResults] = useState<{sourceIndex: number, result: GenerationResult, stockingIndex?: number}[]>([]);

  const [selectedPose, setSelectedPose] = useState<PoseType | null>(null);
  const [customPoseInput, setCustomPoseInput] = useState('');
  
  const [results, setResults] = useState<GenerationResult[]>([]); // For single image poses
  const [magicResult, setMagicResult] = useState<GenerationResult | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);
  
  // Settings state
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

  // Model Selection State
  // 'gemini-2.5-flash-image' = Nano Banana 1
  // 'gemini-3-pro-image-preview' = Nano Banana 2
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image');
  const [selectedResolution, setSelectedResolution] = useState<'1K' | '2K' | '4K'>('1K');

  useEffect(() => {
    localStorage.setItem('useCustomApi', useCustomApi.toString());
    localStorage.setItem('customBaseUrl', customBaseUrl);
    localStorage.setItem('customApiKey', customApiKey);
  }, [useCustomApi, customBaseUrl, customApiKey]);

  useEffect(() => {
    if (!process.env.API_KEY && !useCustomApi) {
      setApiKeyError(true);
    } else {
      setApiKeyError(false);
    }
  }, [useCustomApi]);

  const handleSelectPose = (poseId: PoseType) => {
    setSelectedPose(poseId);
  };

  const commonApiConfig = {
    useCustomApi,
    customBaseUrl,
    customApiKey,
    model: selectedModel,
    imageSize: selectedResolution
  };

  // --- Single Image Handlers ---

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

  const handleMagicEdit = async (prompt: string) => {
    if (!sourceImage) return;

    setMagicResult({ id: 'custom-magic', poseId: 'custom', status: 'loading' });
    setIsProcessing(true);

    try {
      const imageUrl = await generateImageEdit(
        sourceImage.base64,
        sourceImage.mimeType,
        prompt,
        commonApiConfig
      );
      setMagicResult({ id: 'custom-magic', poseId: 'custom', status: 'success', imageUrl });
    } catch (error: any) {
      setMagicResult({ id: 'custom-magic', poseId: 'custom', status: 'error', error: error.message || '魔法施放失败' });
    } finally {
      setIsProcessing(false);
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

  // --- Mirror Selfie (Batch) Handlers ---

  const handleMirrorGeneration = async () => {
    if (mirrorImages.length === 0) return;

    // Initialize results placeholders
    const newResults = mirrorImages.map((_, index) => ({
      sourceIndex: index,
      result: {
        id: `mirror-${Date.now()}-${index}`,
        poseId: 'mirror',
        status: 'loading' as const
      }
    }));

    setMirrorResults(newResults);
    setIsProcessing(true);

    try {
      // Process in parallel
      await Promise.all(newResults.map(async (item, index) => {
        try {
          // Cycle through prompts
          const poseDetail = MIRROR_POSES[index % MIRROR_POSES.length];
          const prompt = `Change pose to a standing mirror selfie. ${poseDetail}. Ensure the phone covers the face (mirror selfie style). Minor angle adjustment only. Maintain clothes and background identity. High quality photorealistic.`;
          
          const sourceImg = mirrorImages[index];
          const imageUrl = await generateImageEdit(
            sourceImg.base64,
            sourceImg.mimeType,
            prompt,
            commonApiConfig
          );

          setMirrorResults(prev => prev.map(r => 
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
              : r
          ));
        } catch (error: any) {
           setMirrorResults(prev => prev.map(r => 
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } 
              : r
          ));
        }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryMirrorImage = async (index: number) => {
    const sourceImg = mirrorImages[index];
    if (!sourceImg) return;

    setMirrorResults(prev => prev.map(r => 
      r.sourceIndex === index 
        ? { ...r, result: { ...r.result, status: 'loading', error: undefined } }
        : r
    ));

    try {
      const poseDetail = MIRROR_POSES[index % MIRROR_POSES.length];
      const prompt = `Change pose to a standing mirror selfie. ${poseDetail}. Ensure the phone covers the face (mirror selfie style). Minor angle adjustment only. Maintain clothes and background identity. High quality photorealistic.`;
      
      const imageUrl = await generateImageEdit(
        sourceImg.base64,
        sourceImg.mimeType,
        prompt,
        commonApiConfig
      );

      setMirrorResults(prev => prev.map(r => 
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
    } catch (error: any) {
      setMirrorResults(prev => prev.map(r => 
        r.sourceIndex === index 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Retry failed' } } 
          : r
      ));
    }
  };

  // --- Selfie Variations (New Tab) Handlers ---

  const handleSelfieVariationsGeneration = async () => {
    if (!selfieSourceImage) return;

    // Initialize 8 slots based on templates
    const newResults = SELFIE_TEMPLATES.map((_, index) => ({
      templateIndex: index,
      result: {
        id: `selfie-var-${Date.now()}-${index}`,
        poseId: 'selfie-var',
        status: 'loading' as const
      }
    }));

    setSelfieResults(newResults);
    setIsProcessing(true);

    try {
      await Promise.all(newResults.map(async (item, index) => {
        try {
          const template = SELFIE_TEMPLATES[index];
          const prompt = `Change pose to: ${template.prompt}. Ensure the phone covers the face (mirror selfie style). Maintain clothes and background identity. High quality photorealistic.`;
          
          const imageUrl = await generateImageEdit(
            selfieSourceImage.base64,
            selfieSourceImage.mimeType,
            prompt,
            commonApiConfig
          );

          setSelfieResults(prev => prev.map(r => 
            r.templateIndex === index 
              ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
              : r
          ));
        } catch (error: any) {
           setSelfieResults(prev => prev.map(r => 
            r.templateIndex === index 
              ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } 
              : r
          ));
        }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const retrySelfieVariation = async (index: number) => {
    if (!selfieSourceImage) return;

    setSelfieResults(prev => prev.map(r => 
      r.templateIndex === index 
        ? { ...r, result: { ...r.result, status: 'loading', error: undefined } }
        : r
    ));

    try {
      const template = SELFIE_TEMPLATES[index];
      const prompt = `Change pose to: ${template.prompt}. Ensure the phone covers the face (mirror selfie style). Maintain clothes and background identity. High quality photorealistic.`;
      
      const imageUrl = await generateImageEdit(
        selfieSourceImage.base64,
        selfieSourceImage.mimeType,
        prompt,
        commonApiConfig
      );

      setSelfieResults(prev => prev.map(r => 
        r.templateIndex === index 
          ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
          : r
      ));
    } catch (error: any) {
      setSelfieResults(prev => prev.map(r => 
        r.templateIndex === index 
          ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Retry failed' } } 
          : r
      ));
    }
  };

  // --- Try-On (New Tab) Handlers ---

  const handleTryOnGeneration = async () => {
    if (!tryOnModelImage || tryOnClothingImages.length === 0) return;

    const newResults = tryOnClothingImages.map((_, index) => {
      // Randomly select a stocking image if available
      // Logic: If stockings are uploaded, 50% chance to pick one, or pick one randomly from the list + 'none' option?
      // User requirement: "randomly select a stocking or not select one"
      let stockingIndex: number | undefined = undefined;
      if (tryOnStockingImages.length > 0) {
        // Create a pool of indices: -1 (none) and 0 to length-1
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

    try {
      await Promise.all(newResults.map(async (item, index) => {
        try {
          const clothingImg = tryOnClothingImages[index];
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
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'success', imageUrl } } 
              : r
          ));
        } catch (error: any) {
           setTryOnResults(prev => prev.map(r => 
            r.sourceIndex === index 
              ? { ...r, result: { ...r.result, status: 'error', error: error.message || 'Generation failed' } } 
              : r
          ));
        }
      }));
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


  return (
    <div className="min-h-screen bg-slate-50 pb-20">
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
                    <div className="text-xs text-slate-500 mt-0.5">使用 Vectorengine 或其他代理</div>
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
                        <Globe size={14} className="text-slate-400" /> Base URL
                      </label>
                      <input 
                        type="text"
                        value={customBaseUrl}
                        onChange={(e) => setCustomBaseUrl(e.target.value)}
                        placeholder="https://api.vectorengine.ai"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-mono"
                      />
                    </div>
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
                    onClick={() => setActiveTab('mirror')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === 'mirror' 
                        ? 'bg-pink-50 text-pink-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Smartphone size={18} />
                    对镜自拍 (批量)
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
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>

                {selectedModel === 'gemini-3-pro-image-preview' && (
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
                            <p className="text-slate-500 text-sm mt-1">上传一张图片，AI 自动生成 2张坐姿 + 2张跪姿 + 2张蹲姿 + 2张站姿（共8张），并全程保持手机挡脸。</p>
                        </div>
                        
                        <ImageUploader 
                            currentImage={selfieSourceImage} 
                            onImageSelected={(img) => {
                                setSelfieSourceImage(img);
                                setSelfieResults([]);
                            }} 
                        />
                        
                        {selfieSourceImage && (
                             <div className="mt-6 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                                <Button 
                                    onClick={handleSelfieVariationsGeneration} 
                                    isLoading={isProcessing}
                                    className="px-10 py-3 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200/50"
                                >
                                    <Sparkles size={20} />
                                    一键生成 8 张自拍变体
                                </Button>
                            </div>
                        )}
                    </section>

                    {/* Results for Selfie Variations */}
                    {selfieResults.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-1">
                                变身结果
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {selfieResults.map((item, idx) => {
                                    const { result, templateIndex } = item;
                                    const template = SELFIE_TEMPLATES[templateIndex];

                                    return (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col group">
                                            {/* Header */}
                                            <div className="p-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                                <span className="text-xs font-medium text-slate-600">{template.label}</span>
                                                <button 
                                                    onClick={() => retrySelfieVariation(idx)}
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
                                                            alt={template.label} 
                                                            onClick={() => setViewImageUrl(result.imageUrl!)}
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
                                                                download={`selfie-var-${templateIndex}.png`}
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
                            上传原图
                        </h2>
                        <ImageUploader 
                            currentImage={sourceImage} 
                            onImageSelected={(img) => {
                                setSourceImage(img);
                                setMagicResult(null);
                            }} 
                        />
                    </section>

                    {sourceImage && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <MagicEditor 
                                onGenerate={handleMagicEdit} 
                                isGenerating={isProcessing} 
                                disabled={isProcessing}
                            />
                            
                            {magicResult && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-slate-800">编辑结果</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                                            <div className="mb-2 text-sm font-medium text-slate-500">原图</div>
                                            <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} className="rounded-lg w-full" alt="Original" />
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                                            <div className="mb-2 text-sm font-medium text-purple-600">AI 编辑后</div>
                                            {magicResult.status === 'loading' && (
                                            <div className="aspect-[4/3] flex flex-col items-center justify-center bg-slate-50 rounded-lg">
                                                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                                <span className="text-purple-600 font-medium animate-pulse">魔法施放中...</span>
                                            </div>
                                            )}
                                            {magicResult.status === 'error' && (
                                            <div className="aspect-[4/3] flex flex-col items-center justify-center bg-red-50 rounded-lg text-red-500 p-4 text-center">
                                                <AlertCircle size={32} className="mb-2" />
                                                <p>{magicResult.error}</p>
                                            </div>
                                            )}
                                            {magicResult.status === 'success' && magicResult.imageUrl && (
                                            <div className="relative group cursor-pointer" onClick={() => setViewImageUrl(magicResult.imageUrl!)}>
                                                <img src={magicResult.imageUrl} className="rounded-lg w-full shadow-md" alt="Edited" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">查看大图</span>
                                                </div>
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 5. MIRROR SELFIE (BATCH) */}
            {activeTab === 'mirror' && (
                <div className="space-y-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center max-w-4xl mx-auto">
                        <div className="flex justify-center mb-4 text-pink-500">
                            <Smartphone size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">批量对镜自拍生成</h2>
                        <p className="text-slate-500 mb-6">上传多张照片（1-30张），AI 将自动为每一张生成不同的站姿，并保持手机挡脸风格。</p>
                        
                        <BatchImageUploader 
                            currentImages={mirrorImages}
                            onImagesSelected={(imgs) => {
                                setMirrorImages(imgs);
                                // Clear results if images change significantly (optional, but safer)
                                if (imgs.length === 0) setMirrorResults([]);
                            }}
                            maxImages={30}
                        />

                        {mirrorImages.length > 0 && (
                            <div className="mt-8 flex justify-center">
                                <Button 
                                    onClick={handleMirrorGeneration} 
                                    isLoading={isProcessing}
                                    className="px-10 py-3 text-lg bg-pink-600 hover:bg-pink-700 shadow-lg hover:shadow-pink-200/50"
                                >
                                    <Sparkles size={20} />
                                    一键生成 {mirrorImages.length} 张自拍
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Results Grid for Mirror Selfie */}
                    {mirrorResults.length > 0 && (
                         <div className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800 px-4">生成结果列表</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                                {mirrorResults.map((item, idx) => {
                                    const sourceImg = mirrorImages[item.sourceIndex];
                                    const { result } = item;
                                    
                                    return (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                <span className="font-medium text-slate-600 text-sm">图片 #{idx + 1}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400">姿势: {idx % MIRROR_POSES.length + 1}</span>
                                                    <button 
                                                        onClick={() => handleRetryMirrorImage(idx)}
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
                                                        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
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
                                                                    download={`mirror-selfie-${idx}.png`}
                                                                    className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white text-slate-700"
                                                                >
                                                                    <Download size={14} />
                                                                </a>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Pose description */}
                                            <div className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100 truncate">
                                                {MIRROR_POSES[idx % MIRROR_POSES.length]}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
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
                        <p className="text-slate-500 mb-6">先上传一张模特图，再上传多张衣服平铺图（1-30张），AI 将自动把衣服穿到模特身上。</p>
                        
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
                                        maxImages={30}
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
                                        maxImages={30}
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
                            <h3 className="text-xl font-bold text-slate-800 px-4">生成结果列表</h3>
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
        </div>
      </main>

      {/* Lightbox Modal */}
      <ImageModal imageUrl={viewImageUrl} onClose={() => setViewImageUrl(null)} />
    </div>
  );
};

export default App;