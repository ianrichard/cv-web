import { MantineProvider } from '@mantine/core';

import '@mantine/core/styles.css';
import SettingsPanel from './components/SettingsPanel/SettingsPanel';

function App() {
  return (
    <MantineProvider>
      <SettingsPanel />
    </MantineProvider>
  );
}

export default App;
