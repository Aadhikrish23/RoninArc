import {
  Button,
  VStack,
  Divider,
} from "@chakra-ui/react";

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
      title="🔒 Security"
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
          Change Password
        </Button>

        <Divider />

        <Button
          variant="outline"
          onClick={
            onLogoutAllDevices
          }
        >
          Logout All Devices
        </Button>
      </VStack>
    </SettingsCard>
  );
}