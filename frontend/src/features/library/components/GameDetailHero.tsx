import { Box, Badge, Flex, Heading, Text } from "@chakra-ui/react";

import type { RawgGameDetails } from "../types/library";

interface Props {
  game: RawgGameDetails;
}

export default function GameDetailHero({ game }: Props) {
  return (
    <Box
      h="500px"
      borderRadius="xl"
      overflow="hidden"
      position="relative"
      backgroundImage={`url(${game.imageURL})`}
      backgroundSize="cover"
      backgroundPosition="center"
    >
      <Box
        position="absolute"
        inset={0}
        bgGradient="linear(to-t, blackAlpha.900 0%, blackAlpha.700 45%, blackAlpha.300 75%, transparent)"
      />

      <Flex position="absolute" bottom={0} p={8} direction="column" gap={3}>
        <Heading color="white" size="2xl" textShadow="0 2px 12px rgba(0,0,0,0.6)">
          {game.name}
        </Heading>

        <Flex gap={3}>
          {game.released && (
            <Badge colorScheme="whiteAlpha" variant="solid" borderRadius="full" px={2} bg="blackAlpha.600" color="white">{new Date(game.released).getFullYear()}</Badge>
          )}
        </Flex>

        <Text color="whiteAlpha.800">
          {game.platforms.join(" • ")}
        </Text>
      </Flex>
    </Box>
  );
}
