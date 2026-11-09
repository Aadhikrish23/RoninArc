import { useState } from "react";
import { Avatar, Button } from "@chakra-ui/react";

import { SettingsPanel, SettingsRow, SettingsSection, StatusDot } from "./SettingsLayout";
import AddEmailModal from "../../auth/components/AddEmailModal";

interface Props {
  /** The display name. */
  name: string;
  email?: string | null;
  onLogout: () => void;
}

export default function AccountSection({ name, email, onLogout }: Props) {
  const [addEmail, setAddEmail] = useState(false);
  return (
    <SettingsSection id="account" title="Account">
      <SettingsPanel>
        <SettingsRow
          lead={<Avatar name={name} size="sm" bg="purple.500" color="white" />}
          label={name}
          detail={email ? `${email} · Signed in on this PC` : "Signed in on this PC"}
          actions={
            <Button size="sm" variant="outline" onClick={onLogout}>
              Log out
            </Button>
          }
        />
        {!email && (
          <SettingsRow
            label="Add your email"
            status={<StatusDot tone="warn">Needed to sign in</StatusDot>}
            detail="RoninArc signs in with your email now. Add it to sign in again, to sync with your phone, and to reset a forgotten password."
            actions={
              <Button size="sm" colorScheme="purple" onClick={() => setAddEmail(true)}>
                Add email
              </Button>
            }
          />
        )}
      </SettingsPanel>
      <AddEmailModal isOpen={addEmail} onClose={() => setAddEmail(false)} />
    </SettingsSection>
  );
}
