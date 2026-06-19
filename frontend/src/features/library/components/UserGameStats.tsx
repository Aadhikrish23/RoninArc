import { Badge, Box, Button, Flex, Heading, Text } from "@chakra-ui/react";

import type { Game } from "../types/library";

interface Props {
  game: Game | null;
  openlibrary():void
}

export default function UserGameStats({ game ,openlibrary}: Props) {
  if (!game) {
    return (
      <Box p={6} borderWidth="1px" borderRadius="lg">
        <Heading size="md" mb={2}>
          Not In Library
        </Heading>

        <Text color="gray.500" mb={4}>
          Add this game to track progress.
        </Text>
      </Box>
    );
  }

  return (
    <Box p={6} borderWidth="1px" borderRadius="lg" mt={8}>
      <Heading size="md" mb={4}>
        Your Library
      </Heading>

      <Flex gap={3} wrap="wrap">
        <Button size="sm" colorScheme="purple" variant="outline" onClick={openlibrary}>
          Open In Library
        </Button>

        <Badge alignContent={"center"} colorScheme="purple">{game.status}</Badge>

        {game.rating && (
          <Badge colorScheme="yellow" alignContent={"center"}>Your Rating: {game.rating}/10</Badge>
        )}
      </Flex>
    </Box>
  );
}
