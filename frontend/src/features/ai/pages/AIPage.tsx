import {
  Box,
  Heading,
  Text,
  VStack,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  useColorModeValue,
  Flex,
  Icon,
} from "@chakra-ui/react";
import { FiSend as SendIcon } from "react-icons/fi";
import { IoSparklesOutline } from "react-icons/io5";

export default function AIPage() {
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("whiteAlpha.800", "whiteAlpha.50");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  return (
    <Box minH="calc(100vh - 73px)" bg={bg} display="flex" flexDirection="column">
      <Flex
        direction="column"
        align="center"
        justify="center"
        flex="1"
        maxW="800px"
        mx="auto"
        w="full"
        px={6}
        py={10}
      >
        {/* Welcome / Initial State */}
        <VStack spacing={6} textAlign="center" flex="1" justify="center" maxW="500px">
          <Box
            p={4}
            borderRadius="full"
            bgGradient="linear(to-tr, purple.500, blue.500)"
            color="white"
            shadow="lg"
            animation="pulse 2s infinite"
            style={{
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          >
            <Icon as={IoSparklesOutline} w={12} h={12} />
          </Box>
          <Heading size="xl" bgGradient="linear(to-r, purple.400, blue.500)" bgClip="text">
            RoninArc AI Assistant
          </Heading>
          <Text color={mutedText} fontSize="lg">
            I can help you manage your game library, search for reviews, organize collections, and launch your games.
          </Text>
        </VStack>

        {/* Input area */}
        <Box
          w="full"
          p={4}
          borderRadius="2xl"
          bg={cardBg}
          borderWidth="1px"
          borderColor={borderColor}
          backdropFilter="blur(20px)"
          shadow="2xl"
          mb={4}
          transition="all 0.3s ease"
          _hover={{ borderColor: "purple.400", shadow: "0 0 15px rgba(159, 122, 234, 0.2)" }}
        >
          <InputGroup size="lg">
            <Input
              pr="4.5rem"
              placeholder="Ask the AI Assistant anything..."
              variant="unstyled"
              py={3}
              px={4}
              fontSize="md"
              isDisabled={true}
              _disabled={{ opacity: 0.8, cursor: "not-allowed" }}
            />
            <InputRightElement h="full" pr={2}>
              <IconButton
                aria-label="Send message"
                icon={<SendIcon />}
                size="md"
                colorScheme="purple"
                borderRadius="xl"
                isDisabled={true}
              />
            </InputRightElement>
          </InputGroup>
        </Box>
        <Text fontSize="xs" color="gray.500">
          The AI core is currently initializing. Context and API configuration will be connected in subsequent phases.
        </Text>
      </Flex>
    </Box>
  );
}
