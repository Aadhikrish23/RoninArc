import { Button, ButtonGroup, useColorMode, useColorModeValue } from "@chakra-ui/react";
import { FiMoon, FiSun } from "react-icons/fi";

import { SettingsPanel, SettingsRow, SettingsSection } from "./SettingsLayout";

export default function AppearanceSection() {
  const { colorMode, setColorMode } = useColorMode();
  const border = useColorModeValue("gray.200", "whiteAlpha.300");
  const muted = useColorModeValue("gray.600", "gray.400");
  const onBg = useColorModeValue("purple.50", "rgba(214,188,250,0.12)");
  const onText = useColorModeValue("purple.600", "purple.200");

  const option = (mode: "light" | "dark", label: string, icon: React.ReactElement) => {
    const on = colorMode === mode;
    return (
      <Button
        leftIcon={icon}
        aria-pressed={on}
        onClick={() => setColorMode(mode)}
        bg={on ? onBg : "transparent"}
        color={on ? onText : muted}
        borderColor={border}
        _hover={{ bg: on ? onBg : undefined }}
      >
        {label}
      </Button>
    );
  };

  return (
    <SettingsSection id="appearance" title="Appearance">
      <SettingsPanel>
        <SettingsRow
          label="Theme"
          detail="Applies to every screen in this app."
          actions={
            <ButtonGroup size="sm" variant="outline" isAttached role="group" aria-label="Theme">
              {option("light", "Light", <FiSun />)}
              {option("dark", "Dark", <FiMoon />)}
            </ButtonGroup>
          }
        />
      </SettingsPanel>
    </SettingsSection>
  );
}
