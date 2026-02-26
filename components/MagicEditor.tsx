import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from './Button';

interface MagicEditorProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export const MagicEditor: React.FC<MagicEditorProps> = ({ onGenerate, isGenerating, disabled }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt.trim());
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
          <Wand2 size={20} />
        </div>
        <h2 className="text-lg font-bold text-slate-800">AI 魔法编辑</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="custom-prompt" className="block text-sm font-medium text-slate-700 mb-1">
            描述你想如何修改图片
          </label>
          <div className="relative">
            <input
              id="custom-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：添加复古滤镜，移除背景，把衣服改成红色..."
              className="w-full pl-4 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
              disabled={disabled || isGenerating}
            />
          </div>
        </div>
        
        <div className="flex justify-end">
           <Button 
             type="submit" 
             disabled={!prompt.trim() || disabled} 
             isLoading={isGenerating}
             className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 text-white"
           >
             <Wand2 size={16} />
             开始生成
           </Button>
        </div>
      </form>
      
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">示例:</span>
        {['变成卡通风格', '添加下雨效果', '背景换成海滩', '戴上一顶帽子'].map(suggestion => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setPrompt(suggestion)}
            disabled={disabled || isGenerating}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-full transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};