import { PoseDefinition, PoseType } from './types';

export const POSES: PoseDefinition[] = [
  {
    id: PoseType.DANCE_STAND,
    label: '舞蹈站姿',
    prompt: 'Change the pose to a graceful dancing standing pose.',
    iconName: 'music'
  },
  {
    id: PoseType.FLOOR_SIT,
    label: '地板坐姿',
    prompt: 'Change the pose to sitting comfortably on the floor, casual and relaxed.',
    iconName: 'accessibility'
  },
  {
    id: PoseType.FLOOR_KNEEL,
    label: '地板跪姿',
    prompt: 'Change the pose to kneeling on the floor.',
    iconName: 'accessibility'
  },
  {
    id: PoseType.FLOOR_SQUAT,
    label: '地板蹲姿',
    prompt: 'Change the pose to squatting on the floor.',
    iconName: 'arrow-down-circle'
  },
  {
    id: PoseType.RUNNING,
    label: '奔跑姿势',
    prompt: 'Change the pose to running dynamically.',
    iconName: 'wind'
  },
  {
    id: PoseType.HERO_LANDING,
    label: '英雄落地',
    prompt: 'Change the pose to a superhero landing pose.',
    iconName: 'shield'
  },
  {
    id: PoseType.YOGA_SIT,
    label: '瑜伽盘坐',
    prompt: 'Change the pose to sitting in a yoga lotus position.',
    iconName: 'flower'
  },
  {
    id: PoseType.PHOTO_STAND,
    label: '拍照站姿',
    prompt: 'Change the pose to a stylish and confident standing pose for a photo shoot.',
    iconName: 'camera'
  },
  {
    id: PoseType.CHANGE_POSE,
    label: '随机改变',
    prompt: 'Change the pose to a creative, random, and different pose from the original. Surprise me with a new dynamic posture.',
    iconName: 'shuffle'
  },
  {
    id: PoseType.CUSTOM_INPUT,
    label: '自定义输入',
    prompt: '', // Will be replaced by user input
    iconName: 'pen-tool'
  }
];

export interface StockingPreset {
  id: string;
  label: string;
  prompt: string;
  color: string;
}

export const STOCKING_PRESETS: StockingPreset[] = [
  { id: '0d_black_pantyhose', label: '0D超薄黑丝连裤袜', prompt: '0D ultra-thin sheer black pantyhose', color: 'bg-neutral-900 text-neutral-100 border border-neutral-800' },
  { id: '0d_black_thigh_high', label: '0D超薄黑丝长筒袜', prompt: '0D ultra-thin sheer black thigh-high stockings', color: 'bg-neutral-800 text-neutral-100 border border-neutral-700' },
  { id: '15d_black_pantyhose', label: '15D微透黑丝连裤袜', prompt: '15D sheer black pantyhose', color: 'bg-neutral-700 text-neutral-100' },
  { id: '15d_black_thigh_high', label: '15D微透黑丝长筒袜', prompt: '15D sheer black thigh-high stockings', color: 'bg-neutral-600 text-neutral-100' },
  { id: '80d_black_pantyhose', label: '80D中厚黑丝连裤袜', prompt: '80D semi-opaque black pantyhose', color: 'bg-neutral-500 text-white' },
  { id: '80d_black_thigh_high', label: '80D中厚黑丝长筒袜', prompt: '80D semi-opaque black thigh-high stockings', color: 'bg-neutral-400 text-white' },
  { id: '0d_nude_pantyhose', label: '0D肤色超薄连裤袜(光腿)', prompt: '0D ultra-thin nude pantyhose for a realistic bare legs effect', color: 'bg-amber-100 text-amber-900 border border-amber-200' },
  { id: '15d_nude_thigh_high', label: '15D肤色微透长筒袜', prompt: '15D sheer nude thigh-high stockings', color: 'bg-amber-50 text-amber-800 border border-amber-100' },
  { id: 'white_lace_pantyhose', label: '白色日系蕾丝边连裤袜', prompt: 'white Japanese style lace-trimmed pantyhose', color: 'bg-slate-100 text-slate-800 border border-slate-200' },
  { id: 'black_fishnet', label: '黑色性感网眼渔网袜', prompt: 'black fishnet stockings with sexy open mesh pattern', color: 'bg-neutral-950 text-emerald-300 border border-neutral-900' },
  { id: 'grey_pantyhose', label: '灰色高级感连裤袜', prompt: 'elegant grey sheer pantyhose', color: 'bg-stone-500 text-white' },
  { id: 'suspender_lace_thigh_high', label: '吊带防滑蕾丝长筒袜', prompt: 'suspender lace thigh-high stockings with anti-slip silicone band', color: 'bg-rose-50 text-rose-800 border border-rose-100' }
];

export const MAX_CONCURRENT_GENERATIONS = 8;
export const VARIATION_COUNT = 8; // Default max, can be overridden by user selection