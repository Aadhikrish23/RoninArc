import {
  Box,
  Heading,
  Text,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}

export default function SettingsCard({
  title,
  description,
  children,
  danger = false,
}: SettingsCardProps) {
  const bg = useColorModeValue(
    "white",
    "gray.800"
  );

  const darkBg = useColorModeValue(
    "white",
    "rgba(17,24,39,0.9)"
  );

  const borderColor = danger
    ? "red.500"
    : useColorModeValue(
        "gray.200",
        "whiteAlpha.100"
      );

  return (
    <Box
      bg={danger ? "rgba(127,29,29,0.15)" : darkBg}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="2xl"
      p={6}
      transition="all .2s"
      _hover={{
        transform: "translateY(-2px)",
        borderColor: danger
          ? "red.400"
          : "purple.400",
      }}
    >
      <VStack
        align="stretch"
        spacing={4}
      >
        <Box>
          <Heading
            size="md"
            mb={2}
          >
            {title}
          </Heading>

          {description && (
            <Text
              color="gray.400"
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