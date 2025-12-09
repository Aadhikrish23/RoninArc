// frontend/src/routes/Dashboard.tsx
import {
  Box,
  Flex,
  Heading,
  Text,
  useColorModeValue,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
  Button,
  HStack,
  VStack,
} from "@chakra-ui/react";
import Navbar from "../components/Navbar";

function DashboardPage() {
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  return (
    <Box minH="100vh" bg={bg}>
        <Navbar/>
      {/* Navbar is rendered outside, same as Library/Settings */}

      <Box maxW="1200px" mx="auto" px={6} py={8}>
        {/* Page header */}
        <Box mb={6}>
          <Heading size="lg">Dashboard Module — Coming Soon</Heading>
          <Text fontSize="sm" color={mutedText} mt={1}>
            This section will display real-time statistics and analytics about your game library.
Current values are placeholders for UI demonstration.
          </Text>
        </Box>

        {/* Top row: stats */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Total Games</StatLabel>
              <StatNumber>12</StatNumber>
              <StatHelpText>In your library</StatHelpText>
            </Stat>
          </Box>

          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Currently Playing</StatLabel>
              <StatNumber>3</StatNumber>
              <StatHelpText>Don’t drop the streak 👀</StatHelpText>
            </Stat>
          </Box>

          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Completed</StatLabel>
              <StatNumber>5</StatNumber>
              <StatHelpText>Nice progress!</StatHelpText>
            </Stat>
          </Box>
        </SimpleGrid>

        {/* Bottom row: Featured / Continue playing / Recently played */}
        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
          {/* Featured game */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={2}>
              Featured Game
            </Heading>
            <Text fontSize="xs" color={mutedText} mb={3}>
              Hand-picked from your library.
            </Text>

            <VStack align="stretch" spacing={2}>
              <Text fontWeight="semibold" noOfLines={1}>
                Elden Ring
              </Text>
              <HStack spacing={2}>
                <Badge colorScheme="purple">Action</Badge>
                <Badge colorScheme="green">RPG</Badge>
              </HStack>
              <Button size="sm" mt={2} variant="outline">
                Jump back in
              </Button>
            </VStack>
          </Box>

          {/* Continue playing */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={2}>
              Continue Playing
            </Heading>
            <Text fontSize="xs" color={mutedText} mb={3}>
              Games you marked as “Playing”.
            </Text>

            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontSize="sm" noOfLines={1}>
                  Dark Souls III
                </Text>
                <Badge colorScheme="yellow">Playing</Badge>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" noOfLines={1}>
                  Batman: Arkham Knight
                </Text>
                <Badge colorScheme="yellow">Playing</Badge>
              </HStack>
            </VStack>
          </Box>

          {/* Recently played */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={2}>
              Recently Played
            </Heading>
            <Text fontSize="xs" color={mutedText} mb={3}>
              Last few games you launched.
            </Text>

            <VStack align="stretch" spacing={2}>
              <Text fontSize="sm">Elden Ring • 2 days ago</Text>
              <Text fontSize="sm">Dark Souls III • 4 days ago</Text>
              <Text fontSize="sm">Batman: Arkham Knight • 1 week ago</Text>
            </VStack>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
}

export default DashboardPage;
