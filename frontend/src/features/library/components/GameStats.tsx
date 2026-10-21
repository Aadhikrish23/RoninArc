import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
} from "@chakra-ui/react";

import type { RawgGameDetails } from "../types/library";

interface Props {
  game: RawgGameDetails;
}

export default function GameStats({
  game,
}: Props) {
  const bg = useColorModeValue(
    "white",
    "gray.800"
  );

  const borderColor =
    useColorModeValue(
      "gray.200",
      "gray.700"
    );

  const stats = [
    {
      // RAWG rates out of 5; show it on the same /10 scale as the header and your own rating.
      label: "Player rating",
      value: game.rating ? `${(game.rating * 2).toFixed(1)}/10` : "-",
    },
    {
      label: "Player reviews",
      value: game.ratingsCount,
    },
    {
      label: "Metacritic",
      value: game.metacritic ?? "-",
    },
    {
      label: "Avg. playtime",
      value: game.playtime ? `${game.playtime}h` : "-",
    },
  ].filter((stat) => stat.label !== "Avg. playtime" || (game.playtime ?? 0) >= 15);

  return (
    <SimpleGrid
      mt={8}
      columns={{
        base: 2,
        md: stats.length,
      }}
      spacing={5}
    >
      {stats.map((stat) => (
        <Box
          key={stat.label}
          p={5}
          borderWidth="1px"
          borderRadius="xl"
          bg={bg}
          borderColor={borderColor}
        >
          <Stat>
            <StatLabel>
              {stat.label}
            </StatLabel>

            <StatNumber>
              {stat.value}
            </StatNumber>
          </Stat>
        </Box>
      ))}
    </SimpleGrid>
  );
}