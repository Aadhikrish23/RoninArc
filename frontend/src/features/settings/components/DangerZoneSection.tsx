import { Button } from "@chakra-ui/react";

import { SettingsPanel, SettingsRow, SettingsSection } from "./SettingsLayout";

interface Props {
  onDeleteAccount: () => void;
}

/** Last on the page, and quiet until you mean it: the dialog asks for your password. */
export default function DangerZoneSection({ onDeleteAccount }: Props) {
  return (
    <SettingsSection id="delete" title="Delete account">
      <SettingsPanel danger>
        <SettingsRow
          label="Delete your RoninArc account"
          detail="Permanently removes your account, library, reviews, collections and activity history. This can't be undone."
          actions={
            <Button size="sm" variant="outline" colorScheme="red" onClick={onDeleteAccount}>
              Delete account…
            </Button>
          }
        />
      </SettingsPanel>
    </SettingsSection>
  );
}
