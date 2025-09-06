import {
  Affix,
  Burger,
  Drawer,
  Tabs,
  Box,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Face from './Face';
import Objects from './Objects';

export default function SettingsPanel() {
  const [opened, { toggle, close }] = useDisclosure(true);

  return (
    <>
      <Affix
        position={{
          right: 16,
          bottom: 16,
        }}
        zIndex={1000}
      >

          <Burger
            opened={opened}
            onClick={toggle}
            aria-label="Toggle navigation"
            style={{ background: "transparent" }}
          />

      </Affix>
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="md"
        withCloseButton={false}
      >
        <Flex direction="column" h="100%" style={{ minHeight: '100dvh' }}>
          <Box flex={1} miw={0} style={{ overflow: 'auto' }}>
            {(() => {
              const tabs = [
                { label: 'Objects', value: 'objects', component: <Objects /> },
                { label: 'Face', value: 'face', component: <Face /> },
              ];
              return (
                <Tabs defaultValue={tabs[0].value}>
                  <Tabs.List>
                    {tabs.map(tab => (
                      <Tabs.Tab key={tab.value} value={tab.value}>
                        {tab.label}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                  {tabs.map(tab => (
                    <Tabs.Panel key={tab.value} value={tab.value} py="lg">
                      {tab.component}
                    </Tabs.Panel>
                  ))}
                </Tabs>
              );
            })()}
          </Box>
        </Flex>
      </Drawer>
    </>
    );
}