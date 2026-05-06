
export interface Layer {
  id: number;
  type: 'video' | 'image' | 'text' | 'drawing' | 'audio';
  name: string;
  active: boolean;
  visible: boolean;
  blendMode?: string;
  // Enhanced properties
  content?: string;
  x?: number;
  y?: number;
  color?: string;
  fontSize?: number;
  src?: string;
  volume?: number;
  pan?: number; // -1 (Left) to 1 (Right)
  opacity?: number;
  scale?: number; // Added property
  
  // New Features
  startTime?: number; // in seconds
  duration?: number; // in seconds
  keyframes?: { time: number; value: number; property?: 'opacity' | 'scale' | 'x' | 'y' }[]; // Enhanced keyframes
  animation?: 'none' | 'pulse' | 'float' | 'shake' | 'spin' | 'wiggle'; // For Image Studio
}

export interface VideoTransition {
    id: number;
    layerId: number;
    type: 'fade_in' | 'fade_out' | 'crossfade';
    duration: number;
    startTime?: number; // Relative to layer start or absolute
}

export interface VideoAdjustments {
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
  blur: number;
}

export interface VideoVFX {
  vignette: number;
  keyframeEnabled: boolean;
  chromaKey: boolean;
  chromaKeyColor?: string;
  stabilizer: boolean;
  stabilizerIntensity?: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  pixelate: number;
  noise: number;
  scanlines: boolean;
  glitch: number;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
  blur: number;
  pixelate: number;
  blendMode: string;
  // RGB Channels
  red?: number;
  green?: number;
  blue?: number;
}

export interface DrawSettings {
  color: string;
  size: number;
  tool: 'brush' | 'erase' | 'text' | 'select';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  textInput?: string;
  textOutline?: boolean;
  textOutlineColor?: string;
  textShadow?: boolean;
  textShadowColor?: string;
  textShadowBlur?: number;
  textGlow?: boolean;
  textGlowColor?: string;
  textGlowBlur?: number;
  // New Features
  brushShape?: 'circle' | 'square' | 'star' | 'heart';
  brushTexture?: 'none' | 'canvas' | 'paper' | 'wood' | 'custom';
  brushBlendMode?: string;
  smoothing?: number;
  opacity?: number;
  jitter?: number;
}

export interface AudioEQ {
  frequency?: number;
  Q?: number;
  type?: BiquadFilterType;
  gains?: number[]; // Added for Graphic EQ support
}

export interface AudioCompressor {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}

export interface AudioTrack {
  id: number;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
}

export interface StoryboardPanel {
  timestamp: string;
  description: string;
  visual_notes: string;
}

export interface VideoCut {
  timestamp: string;
  seconds: number;
  reason: string;
}

export interface VideoExportSettings {
  resolution: string;
  fps: number;
  codec: string;
  preset: string;
}

export interface Project {
    id: string;
    name: string;
    type: 'video' | 'image' | 'audio' | 'pdf';
    createdAt: number;
    data: any; // Serialized state
}

export interface AudioProjectState {
  volume: number;
  eq: AudioEQ;
  compressor: AudioCompressor;
  reverbMix: number;
  delayTime: number;
  delayFeedback: number;
  playbackRate: number;
  bassBoost: number;
  loudness: number;
  virtualizer: number;
  vizMode?: 'spectrum' | 'waveform';
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}