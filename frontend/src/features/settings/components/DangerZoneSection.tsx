import {
  Button,
  VStack,
} from "@chakra-ui/react";

import { FiAlertTriangle } from "react-icons/fi";

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
      title="Danger Zone"
      icon={FiAlertTriangle}
      description="Permanent actions."
    >
      {/* What deleting removes is spelled out in the confirmation dialog. */}
      <VStack
        align="stretch"
        spacing={4}
      >
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