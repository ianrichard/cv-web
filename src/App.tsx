import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import VideoStream from "./components/VideoStream/VideoStream";
import FrameOverlays from "./components/FrameOverlays/FrameOverlays";
import SettingsPanel from "./components/SettingsPanel/SettingsPanel";
import { AppStateProvider } from "./context/AppStateProvider";

function App() {
  return (
    <MantineProvider>
      <AppStateProvider>
        <VideoStream />
        <FrameOverlays />
        <SettingsPanel />
      </AppStateProvider>
    </MantineProvider>
  );
}

export default App;