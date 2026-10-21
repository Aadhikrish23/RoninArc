import {
  Button,
  HStack,
  Icon,
  Text,
  
  useColorMode,
} from "@chakra-ui/react";

import {
  MoonIcon,
  SunIcon,
} from "@chakra-ui/icons";

import { FiDroplet, FiMonitor } from "react-icons/fi";

import SettingsCard from "./SettingsCard";

export default function AppearanceSection() {
  const {
    colorMode,
    toggleColorMode,
  } = useColorMode();

  return (
    <SettingsCard
      title="Appearance"
      icon={FiDroplet}
      description="Customize RoninArc theme and display."
    >
      <HStack
        justify="space-between"
      >
        <HStack>
          <Icon
            as={FiMonitor}
          />
          <Text>
            Current theme:
            {" "}
            <strong>
              {colorMode === "light" ? "Light" : "Dark"}
            </strong>
          </Text>
        </HStack>

        <Button
          onClick={toggleColorMode}
          leftIcon={
            colorMode === "light"
              ? <MoonIcon />
              : <SunIcon />
          }
        >
          {colorMode === "light"
            ? "Dark mode"
            : "Light mode"}
        </Button>
      </HStack>
    </SettingsCard>
  );
}