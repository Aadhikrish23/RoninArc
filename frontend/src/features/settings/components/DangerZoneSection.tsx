import {
  Button,
  Text,
  VStack,
} from "@chakra-ui/react";

import SettingsCard from "./SettingsCard";

interface Props {
  onDeleteAccount: () => void;
}

export default function DangerZoneSection({
  onDeleteAccount,
}: Props) {
  return (
    <SettingsCard
      danger
      title="⚠ Danger Zone"
      description="Permanent actions."
    >
      <VStack
        align="stretch"
        spacing={4}
      >
        <Text
          color="red.300"
          fontSize="sm"
        >
          Deleting your account
          will remove all games,
          collections, reviews and
          activity history.
        </Text>

        <Button
          colorScheme="red"
          variant="solid"
          alignSelf="start"
          onClick={
            onDeleteAccount
          }
        >
          Delete Account
        </Button>
      </VStack>
    </SettingsCard>
  );
}