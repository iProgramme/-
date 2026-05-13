import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';
import { UploadedImage } from '../types';

interface BatchImageUploaderProps {
  onImagesSelected: (images: UploadedImage[]) => void;
  currentImages: UploadedImage[];
  maxImages?: number;
  title?: string;
  subtitle?: string;
}

export const BatchImageUploader: React.FC<BatchImageUploaderProps> = ({ 
  onImagesSelected, 
  currentImages,
  maxImages = 30,
  title = "批量上传图片",
  subtitle
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: FileList | null) => {
    if (!files) return;

    const newImages: UploadedImage[] = [];
    const filesArray = Array.from(files);
    
    // Filter non-images and limit count
    const validFiles = filesArray.filter(f => f.type.startsWith('image/'));
    
    if (currentImages.length + validFiles.length > maxImages) {
      alert(`最多只能上传 ${maxImages} 张图片`);
      return;
    }

    let processedCount = 0;

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const match = base64String.match(/^data:(.*);base64,(.*)$/);
        if (match) {
          newImages.push({
            mimeType: match[1],
            base64: match[2]
          });
        }
        processedCount++;
        // When all files are processed, update parent
        if (processedCount === validFiles.length) {
            onImagesSelected([...currentImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    const newImages = [...currentImages];
    newImages.splice(index, 1);
    onImagesSelected(newImages);
  };

  return (
    <div className="space-y-4">
      <div 
        className={`relative w-full border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer min-h-[200px]
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 bg-white'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={(e) => processFiles(e.target.files)} 
          accept="image/*" 
          multiple
          className="hidden" 
        />
        
        <div className="text-center space-y-3 p-8">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Upload size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
            <p className="text-slate-500 text-sm">{subtitle || `支持多选，最多 ${maxImages} 张`}</p>
          </div>
        </div>
      </div>

      {currentImages.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 animate-in fade-in slide-in-from-bottom-4">
            {currentImages.map((img, idx) => (
                <div key={idx} className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <img 
                        src={`data:${img.mimeType};base64,${img.base64}`} 
                        className="w-full h-full object-cover" 
                        alt={`Upload ${idx}`}
                    />
                    <button 
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={12} />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {idx + 1}
                    </div>
                </div>
            ))}
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all"
             >
                <Plus size={24} />
             </button>
        </div>
      )}
    </div>
  );
};