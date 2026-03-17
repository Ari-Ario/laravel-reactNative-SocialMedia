export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  id?: string;
  address?: string;
}

export interface FeelingData {
  emoji: string;
  text: string;
}

export interface Sticker {
  id: string;
  type: 'text';
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  rotation: number;
  scale: number;
  isDragging?: boolean;
  location?: LocationData;
  feeling?: FeelingData;
}

export interface GradientPreset {
  colors: string[];
  base64: string;
}
