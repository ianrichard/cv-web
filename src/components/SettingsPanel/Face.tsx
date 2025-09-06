import { useRef, useState } from 'react';
import { Button, Image, Flex, Box, Group } from '@mantine/core';
import DetectButton from './DetectButton';

const DEFAULT_SRC = '/default.jpg';

export default function Face() {
  const [src, setSrc] = useState(DEFAULT_SRC);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setSrc(DEFAULT_SRC);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <Group mb="sm">
        <DetectButton modelName="faces" />
      </Group>
      <Flex w="100%" align="center" gap="lg">
        <Box w={128} h={128}>
          <Image
            src={src}
            radius="sm"
            style={{ objectFit: 'cover' }}
          />
        </Box>
        <Flex direction="column" align="center" gap="sm" w={120}>
          <Button
            size="xs"
            onClick={() => inputRef.current?.click()}
            w={110}
          >
            Upload
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <Button
            size="xs"
            variant="default"
            onClick={handleReset}
            w={110}
          >
            Reset
          </Button>
        </Flex>
      </Flex>
    </>
  );
}
