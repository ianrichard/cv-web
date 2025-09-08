import { MantineProvider } from "@mantine/core";

import "@mantine/core/styles.css";
// import FrameOverlays from "./components/FrameOverlays/FrameOverlays";
import SettingsPanel from "./components/SettingsPanel/SettingsPanel";
// import VideoStream from "./components/VideoStream/VideoStream";
import ModelLoader from "./components/ModelLoader/ModelLoader";

function App() {
  return (
    <MantineProvider>
      <ModelLoader />
      {/* <VideoStream /> */}
      {/* <FrameOverlays /> */}
      <SettingsPanel />
    </MantineProvider>
  );
}

export default App;
