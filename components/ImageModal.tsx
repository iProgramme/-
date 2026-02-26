import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (imageUrl) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 transition-colors z-10"
      >
        <X size={32} />
      </button>
      
      <img 
        src={imageUrl} 
        alt="Full view" 
        className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()} 
      />
      
       <a 
          href={imageUrl} 
          download
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full backdrop-blur-md transition-all hover:scale-105 font-medium border border-white/10"
        >
          <Download size={20} />
          下载原图
       </a>
    </div>
  );
};