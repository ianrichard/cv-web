import { Button, Flex, Text, Title } from "@mantine/core";
import {
    IconLoader,
    IconPlayerPlay,
    IconPlayerStop,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import Stats from "./Stats";

type DetectButtonProps = {
  modelName: string;
};

function useAnimatedEllipsis(active: boolean) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (!active) {
      setDots("");
      return;
    }
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 400);
    return () => clearInterval(interval);
  }, [active]);
  return dots;
}

export default function DetectButton({ modelName }: DetectButtonProps) {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const ellipsis = useAnimatedEllipsis(started);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  let title = "";
  let buttonLabel = "";
  let buttonColor: string = "gray";
  let buttonIcon = <IconLoader size={20} />;
  let buttonDisabled = false;
  let buttonOnClick = undefined;

  if (loading) {
    title = `Loading ${modelName} model`;
    buttonLabel = "Start";
    buttonColor = "gray";
    buttonIcon = <IconLoader size={20} />;
    buttonDisabled = true;
  } else if (!started) {
    title = "Ready to detect.";
    buttonLabel = "Start";
    buttonColor = "green";
    buttonIcon = <IconPlayerPlay size={20} />;
    buttonDisabled = false;
    buttonOnClick = () => setStarted(true);
  } else {
    title = `Detecting ${modelName.toLowerCase()}${ellipsis}`;
    buttonLabel = "Stop";
    buttonColor = "red";
    buttonIcon = <IconPlayerStop size={20} />;
    buttonDisabled = false;
    buttonOnClick = () => setStarted(false);
  }

  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        gap="md"
        w="100%"
        mih={56}
        mb="xl"
      >
        <div>
          <Title order={3} fw={500}>
            {title}
          </Title>
          {started && (
            <Text size="sm">
              <Stats />
            </Text>
          )}
        </div>

        <Button
          size="md"
          leftSection={buttonIcon}
          color={buttonColor}
          radius="md"
          disabled={buttonDisabled}
          onClick={buttonOnClick}
        >
          {buttonLabel}
        </Button>
      </Flex>
    </>
  );
}
