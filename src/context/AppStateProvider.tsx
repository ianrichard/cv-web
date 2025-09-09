import { useState } from "react";
import { AppStateContext, type DetectedObject } from "./AppStateContext";

const DEFAULT_CHECKED = ["person", "cell phone"];

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [checked, setChecked] = useState<string[]>(DEFAULT_CHECKED);

  return (
    <AppStateContext.Provider value={{ detectedObjects, setDetectedObjects, checked, setChecked }}>
      {children}
    </AppStateContext.Provider>
  );
}
