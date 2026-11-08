import { Avatar, Button } from "@chakra-ui/react";

import { SettingsPanel, SettingsRow, SettingsSection } from "./SettingsLayout";

interface Props {
  username: string;
  onLogout: () => void;
}

export default function AccountSection({ username, onLogout }: Props) {
  return (
    <SettingsSection id="account" title="Account">
      <SettingsPanel>
        <SettingsRow
          lead={<Avatar name={username} size="sm" bg="purple.500" color="white" />}
          label={username}
          detail="Signed in on this PC"
          actions={
            <Button size="sm" variant="outline" onClick={onLogout}>
              Log out
            </Button>
          }
        />
      </SettingsPanel>
    </SettingsSection>
  );
}
