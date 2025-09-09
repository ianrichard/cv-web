import { Checkbox, Button, Group, SimpleGrid } from "@mantine/core";
import DetectButton from "./DetectButton";
import { useAppState } from "../../context/useAppState";
import { OBJECT_LABELS } from "../../constants/objectLabels";

export default function Objects() {
  const { checked, setChecked } = useAppState();

  const selectAll = () => setChecked([...OBJECT_LABELS]);
  const clearAll = () => setChecked([]);

  return (
    <>
      <Group>
        <DetectButton modelName="objects" />
      </Group>
      <SimpleGrid cols={3} spacing="xs" mb="xl">
        {OBJECT_LABELS.map((label) => (
          <Checkbox
            key={label}
            label={label}
            checked={checked.includes(label)}
            onChange={(e) => {
              setChecked(
                e.target.checked
                  ? [...checked, label]
                  : checked.filter((l) => l !== label)
              );
            }}
          />
        ))}
      </SimpleGrid>
      <Group>
        <Button size="xs" variant="default" onClick={selectAll}>
          Select All
        </Button>
        <Button size="xs" variant="default" onClick={clearAll}>
          Clear All
        </Button>
      </Group>
    </>
  );
}
