import { Affix, Burger, Drawer, Tabs, Box, Flex, Paper, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Face from "./Face";
import Objects from "./Objects";

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
        <Paper
          p="md"
          radius="50%"
          onClick={toggle}
          style={{ backgroundColor: "rgba(255,255,255,.2)", cursor: "pointer" }}
        >
          <Burger
            opened={opened}
            onClick={toggle}
            aria-label="Toggle navigation"
            style={{ background: "transparent" }}
          />
        </Paper>
      </Affix>
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="md"
        withCloseButton={false}
      >
        {(() => {
          const tabs = [
            { label: "Objects", value: "objects", component: <Objects /> },
            { label: "Face", value: "face", component: <Face /> },
          ];
          return (
            <Tabs defaultValue={tabs[0].value} px="md">
              <Tabs.List>
                {tabs.map((tab) => (
                  <Tabs.Tab key={tab.value} value={tab.value}>
                    <Text size="lg">{tab.label}</Text>
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Panel key={tab.value} value={tab.value} py="lg">
                  {tab.component}
                </Tabs.Panel>
              ))}
            </Tabs>
          );
        })()}
      </Drawer>
    </>
  );
}
