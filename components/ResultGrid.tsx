import React from 'react';
import { GenerationResult } from '../types';
import { Download, AlertCircle, RefreshCw, ZoomIn } from 'lucide-react';
import { POSES } from '../constants';

interface ResultGridProps {
  results: GenerationResult[];
  onRetry: (id: string) => void;
  onImageClick: (imageUrl: string) => void;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ results, onRetry, onImageClick }) => {
  if (results.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        生成结果 
        <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {results.filter(r => r.status === 'success').length}/{results.length}
        </span>
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {results.map((result, index) => {
          const poseDef = POSES.find(p => p.id === result.poseId);
          
          let variationLabel = poseDef ? `${poseDef.label} ${index + 1}` : '未知';
          if (result.poseId === 'custom') variationLabel = '自定义编辑';
          if (result.poseId === 'same-pose') variationLabel = `智能变体 ${index + 1}`;

          return (
            <div 
              key={result.id} 
              className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 aspect-square flex flex-col"
            >
              
              {/* Overlay Actions */}
              <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                 <div className="flex gap-2 ml-auto">
                    {result.status === 'success' && result.imageUrl && (
                      <>
                        <button
                          onClick={() => onImageClick(result.imageUrl!)}
                          className="p-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-lg transition-colors"
                          title="查看大图"
                        >
                          <ZoomIn size={16} />
                        </button>
                        <a 
                          href={result.imageUrl} 
                          download={`pose-${variationLabel}.png`}
                          className="p-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-lg transition-colors"
                          title="下载图片"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download size={16} />
                        </a>
                      </>
                    )}
                 </div>
              </div>

              {/* Content */}
              <div 
                className={`flex-1 w-full h-full relative bg-slate-50 flex items-center justify-center ${result.status === 'success' ? 'cursor-pointer' : ''}`}
                onClick={() => result.status === 'success' && result.imageUrl && onImageClick(result.imageUrl)}
              >
                
                {result.status === 'idle' && (
                  <div className="text-slate-400 text-sm">等待开始...</div>
                )}

                {result.status === 'loading' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-blue-500 font-medium animate-pulse">生成中...</span>
                  </div>
                )}

                {result.status === 'error' && (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <AlertCircle className="text-red-400" size={24} />
                    <p className="text-xs text-red-500 line-clamp-3">{result.error || "生成失败"}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetry(result.id);
                      }}
                      className="mt-2 text-xs flex items-center gap-1 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm hover:shadow transition-all"
                    >
                      <RefreshCw size={12} /> 重试
                    </button>
                  </div>
                )}

                {result.status === 'success' && result.imageUrl && (
                  <img 
                    src={result.imageUrl} 
                    alt={variationLabel} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-6 pointer-events-none">
                 <span className="text-white text-xs font-medium px-2 py-0.5 rounded bg-black/30 backdrop-blur-sm">
                   {variationLabel}
                 </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};