import React from 'react';
import { POSES } from '../constants';
import { PoseType } from '../types';
import { Bed, Armchair, Accessibility, ArrowDownCircle, Wind, Shield, Flower, Music, CheckCircle2, Camera, Shuffle, PenTool } from 'lucide-react';

interface PoseSelectorProps {
  selectedPose: PoseType | null;
  onSelectPose: (poseId: PoseType) => void;
  disabled?: boolean;
  customInput: string;
  onCustomInputChange: (value: string) => void;
}

const IconMap: Record<string, React.FC<any>> = {
  bed: Bed,
  armchair: Armchair,
  accessibility: Accessibility,
  'arrow-down-circle': ArrowDownCircle,
  wind: Wind,
  shield: Shield,
  flower: Flower,
  music: Music,
  camera: Camera,
  shuffle: Shuffle,
  'pen-tool': PenTool
};

export const PoseSelector: React.FC<PoseSelectorProps> = ({ 
  selectedPose, 
  onSelectPose, 
  disabled,
  customInput,
  onCustomInputChange
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {POSES.map((pose) => {
          const isSelected = selectedPose === pose.id;
          const Icon = IconMap[pose.iconName] || Accessibility;

          return (
            <button
              key={pose.id}
              onClick={() => onSelectPose(pose.id)}
              disabled={disabled}
              className={`
                relative p-4 rounded-xl border-2 text-left transition-all duration-200 flex flex-col gap-2
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-2 ring-blue-200 ring-offset-1' 
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex justify-between items-start w-full">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  <Icon size={20} />
                </div>
                {isSelected && (
                  <CheckCircle2 size={20} className="text-blue-500" />
                )}
              </div>
              <span className="font-medium text-sm">{pose.label}</span>
            </button>
          );
        })}
      </div>

      {selectedPose === PoseType.CUSTOM_INPUT && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <label htmlFor="custom-pose-input" className="block text-sm font-medium text-slate-700 mb-2">
            描述你想生成的姿势
          </label>
          <textarea
            id="custom-pose-input"
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            disabled={disabled}
            placeholder="例如：双手抱胸靠在墙上，或者单手举高欢呼..."
            className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-24 resize-none shadow-sm"
          />
        </div>
      )}
    </div>
  );
};