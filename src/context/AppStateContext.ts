import { createContext } from "react";

export type DetectedObject = {
  id: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AppState = {
  detectedObjects: DetectedObject[];
  setDetectedObjects: React.Dispatch<React.SetStateAction<DetectedObject[]>>;
  checked: string[];
  setChecked: React.Dispatch<React.SetStateAction<string[]>>;
};

export const AppStateContext = createContext<AppState | undefined>(undefined);
