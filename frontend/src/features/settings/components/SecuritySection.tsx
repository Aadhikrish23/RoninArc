import { Button } from "@chakra-ui/react";

import { SettingsPanel, SettingsRow, SettingsSection } from "./SettingsLayout";

interface Props {
  onChangePassword: () => void;
  onLogoutAllDevices: () => void;
}

export default function SecuritySection({ onChangePassword, onLogoutAllDevices }: Props) {
  return (
    <SettingsSection id="security" title="Security">
      <SettingsPanel>
        <SettingsRow
          label="Password"
          detail="Changing it signs you out, so you sign in again with the new one."
          actions={
            <Button size="sm" variant="outline" onClick={onChangePassword}>
              Change password
            </Button>
          }
        />
        <SettingsRow
          label="Sessions"
          detail="Signs you out on every device, including this one."
          actions={
            <Button size="sm" variant="outline" onClick={onLogoutAllDevices}>
              Log out of all devices
            </Button>
          }
        />
      </SettingsPanel>
    </SettingsSection>
  );
}
