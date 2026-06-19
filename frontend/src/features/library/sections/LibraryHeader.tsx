import { Flex, Heading, Text } from "@chakra-ui/react";

export default function LibraryHeader() {
  return (
    <Flex direction="column" gap={2} mb={6}>
      <Heading size="lg">My Library</Heading>

      <Text fontSize="sm" color="gray.500">
        Track your gaming progress and backlog.
      </Text>
    </Flex>
  );
}