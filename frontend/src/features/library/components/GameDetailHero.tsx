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
        bgGradient="
          linear(
            to-t,
            blackAlpha.900,
            transparent
          )
        "
      />

      <Flex position="absolute" bottom={0} p={8} direction="column" gap={3}>
        <Heading color="white" size="2xl">
          {game.name}
        </Heading>

        <Flex gap={3}>
          <Badge colorScheme="yellow">⭐ {game.rating}</Badge>

          {game.metacritic && (
            <Badge colorScheme="green">MC {game.metacritic}</Badge>
          )}

          <Badge>{new Date(game.released).getFullYear()}</Badge>
        </Flex>

        <Text color="whiteAlpha.800">
          {game.platforms.slice(0, 4).join(" • ")}
        </Text>
      </Flex>
    </Box>
  );
}
