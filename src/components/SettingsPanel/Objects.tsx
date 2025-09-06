import { useState } from "react";
import { Checkbox, Button, Group, SimpleGrid } from "@mantine/core";
import DetectButton from "./DetectButton";

const OBJECT_LABELS = [
  "person",
  "cell phone",
  "bottle",
  "cup",
  "fork",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "book",
  "clock",
  "scissors",
  "teddy bear",
  "toothbrush",
];

const DEFAULT_CHECKED = ["person", "cell phone"];

export default function Objects() {
  const [checked, setChecked] = useState<string[]>(DEFAULT_CHECKED);

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
