import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  Icon,
  useColorModeValue,
  SimpleGrid,
} from "@chakra-ui/react";
import type { JSX } from "react";
import type { ClarificationRequest, ClarificationOption } from "../types/conversation";
import { IoHelpCircleOutline } from "react-icons/io5";

interface ClarificationCardProps {
  request: ClarificationRequest;
  onSelectOption: (option: ClarificationOption) => void;
}

export default function ClarificationCard({
  request,
  onSelectOption,
}: ClarificationCardProps): JSX.Element {
  const bg = useColorModeValue("purple.900", "purple.950");
  const buttonBg = useColorModeValue("purple.700", "purple.800");
  const textColor = "purple.50";
  const mutedColor = "purple.200";

  return (
    <Box
      w="full"
      p={5}
      borderRadius="2xl"
      bg={bg}
      borderWidth="1px"
      borderColor="purple.600"
      shadow="xl"
      my={3}
      animation="slideDown 0.3s ease-out"
    >
      <VStack align="stretch" spacing={4}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={3}>
          <Icon as={IoHelpCircleOutline} w={6} h={6} color="purple.300" />
          <Heading size="xs" color={textColor} textTransform="uppercase" letterSpacing="wider">
            Clarification Required
          </Heading>
        </Box>

        {/* Reason / Prompt */}
        <Box>
          <Text fontSize="md" fontWeight="semibold" color={textColor}>
            {request.reason || "I need a bit more information to complete your request."}
          </Text>
          {request.originalQuery && (
            <Text fontSize="xs" color={mutedColor} mt={1} fontStyle="italic">
              Original request: "{request.originalQuery}"
            </Text>
          )}
        </Box>

        {/* Options / Candidates Grid */}
        {request.candidates && request.candidates.length > 0 && (
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3} mt={2}>
            {request.candidates.map((option) => (
              <Button
                key={option.id}
                onClick={() => onSelectOption(option)}
                variant="solid"
                bg={buttonBg}
                color="white"
                size="md"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="purple.500"
                _hover={{
                  bg: "purple.600",
                  transform: "translateY(-1px)",
                  boxShadow: "0px 4px 12px rgba(159, 122, 234, 0.3)",
                }}
                _active={{
                  bg: "purple.700",
                }}
                transition="all 0.2s"
                display="flex"
                flexDirection="column"
                alignItems="flex-start"
                py={6}
                px={4}
                textAlign="left"
                h="auto"
              >
                <Text fontSize="sm" fontWeight="bold">
                  {option.label}
                </Text>
                {option.subtitle && (
                  <Text fontSize="10px" color="purple.200" mt={0.5} fontWeight="normal">
                    {option.subtitle}
                  </Text>
                )}
              </Button>
            ))}
          </SimpleGrid>
        )}
      </VStack>
    </Box>
  );
}
