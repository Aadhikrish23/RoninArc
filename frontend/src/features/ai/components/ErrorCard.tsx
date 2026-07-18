import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  Icon,
  useColorModeValue,
  HStack,
} from "@chakra-ui/react";
import type { JSX } from "react";
import { FiAlertTriangle, FiRotateCw } from "react-icons/fi";

interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorCard({
  message,
  onRetry,
}: ErrorCardProps): JSX.Element {
  const bg = useColorModeValue("red.50", "red.950");
  const borderColor = useColorModeValue("red.200", "red.900");
  const textColor = useColorModeValue("red.800", "red.100");
  const iconColor = useColorModeValue("red.600", "red.400");

  return (
    <Box
      w="full"
      p={4}
      borderRadius="xl"
      bg={bg}
      borderWidth="1px"
      borderColor={borderColor}
      shadow="md"
      my={3}
      animation="slideDown 0.3s ease-out"
    >
      <VStack align="stretch" spacing={3}>
        <HStack spacing={3}>
          <Icon as={FiAlertTriangle} w={5} h={5} color={iconColor} />
          <Heading size="xs" color={textColor} textTransform="uppercase" letterSpacing="wider">
            Execution Failed
          </Heading>
        </HStack>
        <Text fontSize="sm" color={textColor}>
          {message || "An unexpected error occurred during execution."}
        </Text>
        {onRetry && (
          <Box pt={1}>
            <Button
              leftIcon={<FiRotateCw />}
              colorScheme="red"
              variant="outline"
              size="xs"
              onClick={onRetry}
              borderRadius="md"
              _hover={{
                bg: "red.800",
                color: "white",
              }}
            >
              Retry Action
            </Button>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
