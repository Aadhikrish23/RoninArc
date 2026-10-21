import {
  Box,
  Heading,
  HStack,
  Icon,
  Text,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import type { IconType } from "react-icons";

interface SettingsCardProps {
  title: string;
  icon?: IconType;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}

export default function SettingsCard({
  title,
  icon,
  description,
  children,
  danger = false,
}: SettingsCardProps) {

  const darkBg = useColorModeValue(
    "white",
    "rgba(17,24,39,0.9)"
  );

  const borderColor = useColorModeValue(
    danger ? "red.300" : "gray.200",
    danger ? "red.500" : "whiteAlpha.100"
  );
  const descriptionColor = useColorModeValue("gray.600", "gray.400");
  const dangerBg = useColorModeValue("red.50", "rgba(127,29,29,0.15)");
  const iconColor = useColorModeValue(danger ? "red.500" : "purple.500", danger ? "red.300" : "purple.300");

  // Not clickable, so no hover lift: the controls inside are what you interact with.
  return (
    <Box
      bg={danger ? dangerBg : darkBg}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="2xl"
      p={6}
    >
      <VStack
        align="stretch"
        spacing={4}
      >
        <Box>
          <HStack spacing={2} mb={2}>
            {icon && <Icon as={icon} boxSize={5} color={iconColor} aria-hidden />}
            <Heading size="md">{title}</Heading>
          </HStack>

          {description && (
            <Text
              color={descriptionColor}
              fontSize="sm"
            >
              {description}
            </Text>
          )}
        </Box>

        {children}
      </VStack>
    </Box>
  );
}
