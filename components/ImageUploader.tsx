import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { UploadedImage } from '../types';

interface ImageUploaderProps {
  onImageSelected: (image: UploadedImage | null) => void;
  currentImage: UploadedImage | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, currentImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Extract base64 data and mime type
      const match = base64String.match(/^data:(.*);base64,(.*)$/);
      if (match) {
        onImageSelected({
          mimeType: match[1],
          base64: match[2]
        });
      }
    };
    reader.readAsDataURL(file);
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
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  if (currentImage) {
    return (
      <div className="relative group w-full max-w-md mx-auto aspect-square bg-slate-100 rounded-xl overflow-hidden shadow-md border border-slate-200">
        <img 
          src={`data:${currentImage.mimeType};base64,${currentImage.base64}`} 
          alt="Original" 
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button 
                onClick={() => onImageSelected(null)}
                className="bg-white/90 hover:bg-white text-red-600 px-4 py-2 rounded-full font-medium shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-2"
            >
                <X size={18} /> 移除图片
            </button>
        </div>
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
            原图
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full max-w-md mx-auto aspect-[4/3] rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden
        ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 bg-white'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
      
      <div className="p-8 text-center space-y-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
          <Upload size={32} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-700">上传人物图片</h3>
          <p className="text-slate-500 text-sm mt-1">点击或拖拽图片到这里</p>
        </div>
        <p className="text-xs text-slate-400">支持 JPG, PNG, WEBP</p>
      </div>
    </div>
  );
};