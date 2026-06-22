import {
  Button,
  HStack,
  Icon,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";

import {
  MoonIcon,
  SunIcon,
} from "@chakra-ui/icons";

import { FiMonitor } from "react-icons/fi";

import SettingsCard from "./SettingsCard";

export default function AppearanceSection() {
  const {
    colorMode,
    toggleColorMode,
  } = useColorMode();

  return (
    <SettingsCard
      title="🎨 Appearance"
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
            Current Theme:
            {" "}
            <strong>
              {colorMode}
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
            ? "Dark Mode"
            : "Light Mode"}
        </Button>
      </HStack>
    </SettingsCard>
  );
}