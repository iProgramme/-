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

export const MAX_CONCURRENT_GENERATIONS = 8;
export const VARIATION_COUNT = 8; // Default max, can be overridden by user selection