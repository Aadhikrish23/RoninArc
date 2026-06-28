import { Box, Grid, Image } from "@chakra-ui/react";
import type { Game } from "../../library/types/library";

interface Props {
  games: Game[];
}

export default function CollectionCover({ games }: Props) {
  const covers = games
    .slice(0, 4)
    .map((g) => g.imageURL)
    .filter(Boolean);

  if (covers.length === 0) {
    return (
      <Box
        h="180px"
        bg="gray.700"
        borderTopRadius="xl"
      />
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
          src={covers[i] || covers[covers.length - 1]}
          objectFit="cover"
          w="100%"
          h="100%"
        />
      ))}
    </Grid>
  );
}