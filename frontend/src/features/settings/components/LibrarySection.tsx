import {
  Button,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";

import SettingsCard from "./SettingsCard";

interface Props {
  onImport: () => void;
}

export default function LibrarySection({
  onImport,
}: Props) {
  return (
    <SettingsCard
      title="🎮 Library Import"
      description="Import games from supported launchers."
    >
      <VStack
        align="stretch"
        spacing={4}
      >
        <Text
          color="gray.400"
          fontSize="sm"
        >
          Supported Launchers:
          Steam & Epic Games
        </Text>

        <Button
          colorScheme="purple"
          onClick={onImport}
          alignSelf="start"
        >
          Open Import Wizard
        </Button>
      </VStack>
    </SettingsCard>
  );
}