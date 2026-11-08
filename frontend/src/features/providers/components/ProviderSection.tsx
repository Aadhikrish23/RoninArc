import { SettingsPanel, SettingsSection } from "../../settings/components/SettingsLayout";

interface Props {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export default function ProviderSection({ title = "Game sources", description, children }: Props) {
  return (
    <SettingsSection id="sources" title={title} description={description}>
      <SettingsPanel>{children}</SettingsPanel>
    </SettingsSection>
  );
}
