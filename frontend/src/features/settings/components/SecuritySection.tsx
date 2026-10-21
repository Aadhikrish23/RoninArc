import {
  Button,
  VStack,
  Divider,
} from "@chakra-ui/react";

import { FiLock } from "react-icons/fi";

import SettingsCard from "./SettingsCard";

interface Props {
  onChangePassword: () => void;
  onLogoutAllDevices: () => void;
}

export default function SecuritySection({
  onChangePassword,
  onLogoutAllDevices,
}: Props) {
  return (
    <SettingsCard
      title="Security"
      icon={FiLock}
      description="Manage passwords and active sessions."
    >
      <VStack
        align="stretch"
        spacing={4}
      >
        <Button
          variant="outline"
          onClick={
            onChangePassword
          }
        >
          Change password
        </Button>

        <Divider />

        <Button
          variant="outline"
          onClick={
            onLogoutAllDevices
          }
        >
          Log out of all devices
        </Button>
      </VStack>
    </SettingsCard>
  );
}