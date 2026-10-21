import { Flex, Grid, Icon, Image, Text, useColorModeValue } from "@chakra-ui/react";
import { FiLayers } from "react-icons/fi";
import type { Game } from "../../library/types/library";

interface Props {
  games: Game[];
}

export default function CollectionCover({ games }: Props) {
  const covers = [...new Set(games.map((g) => g.imageURL).filter(Boolean))].slice(0, 4);
  const emptyBg = useColorModeValue("gray.100", "gray.700");
  const emptyText = useColorModeValue("gray.600", "gray.400");

  if (covers.length === 0) {
    return (
      <Flex h="180px" bg={emptyBg} borderTopRadius="xl" direction="column" align="center" justify="center" gap={2} color={emptyText}>
        <Icon as={FiLayers} boxSize={7} aria-hidden />
        <Text fontSize="sm">{games.length === 0 ? "No games yet" : "No cover art"}</Text>
      </Flex>
    );
  }

  if (covers.length === 1) {
    return (
      <Image
        src={covers[0]}
        h="180px"
        w="100%"
        objectFit="cover"
        borderTopRadius="xl"
      />
    );
  }

  if (covers.length < 4) {
    return (
      <Grid templateColumns={`repeat(${covers.length},1fr)`} h="180px" overflow="hidden" borderTopRadius="xl" gap="1px" bg="gray.800">
        {covers.map((src) => (
          <Image key={src} src={src} objectFit="cover" w="100%" h="100%" />
        ))}
      </Grid>
    );
  }

  return (
    <Grid
      templateColumns="repeat(2,1fr)"
      templateRows="repeat(2,1fr)"
      h="180px"
      overflow="hidden"
      borderTopRadius="xl"
      gap="1px"
      bg="gray.800"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Image
          key={i}
          src={covers[i]}
          objectFit="cover"
          w="100%"
          h="100%"
        />
      ))}
    </Grid>
  );
}