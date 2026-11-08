import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
} from "@chakra-ui/react";

import type { GameDbDetails } from "../types/library";

interface Props {
  game: GameDbDetails;
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
      // Stored out of 5; show it on the same /10 scale as the header.
      label: "Player rating",
      value: game.rating ? `${(game.rating * 2).toFixed(1)}/10` : "-",
    },
    {
      label: "Player ratings",
      value: game.ratingsCount,
    },
    {
      label: "Critic score",
      value: game.criticScore ?? "-",
    },
    {
      label: "Time to finish",
      value: game.playtime ? `${game.playtime}h` : "-",
    },
  ].filter((stat) => stat.label !== "Time to finish" || (game.playtime ?? 0) > 0);

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