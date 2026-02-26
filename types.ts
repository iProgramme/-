export enum PoseType {
  DANCE_STAND = 'DANCE_STAND',
  // BED_SLEEP removed
  FLOOR_SIT = 'FLOOR_SIT',
  FLOOR_KNEEL = 'FLOOR_KNEEL',
  FLOOR_SQUAT = 'FLOOR_SQUAT',
  RUNNING = 'RUNNING',
  HERO_LANDING = 'HERO_LANDING',
  YOGA_SIT = 'YOGA_SIT',
  PHOTO_STAND = 'PHOTO_STAND',
  CHANGE_POSE = 'CHANGE_POSE',
  CUSTOM_INPUT = 'CUSTOM_INPUT'
}

export interface PoseDefinition {
  id: PoseType;
  label: string;
  prompt: string;
  iconName: string;
}

export interface GenerationResult {
  id: string; // Unique ID for keying (e.g. uuid or index based)
  poseId: string; // The PoseType ID or 'custom'
  status: 'idle' | 'loading' | 'success' | 'error';
  imageUrl?: string;
  error?: string;
}

export interface UploadedImage {
  base64: string;
  mimeType: string;
}