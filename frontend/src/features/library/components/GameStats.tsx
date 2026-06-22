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
      label: "Rating",
      value: game.rating,
    },
    {
      label: "Reviews",
      value: game.ratingsCount,
    },
    {
      label: "Metacritic",
      value: game.metacritic ?? "-",
    },
    {
      label: "Playtime",
      value: `${game.playtime}h`,
    },
  ];

  return (
    <SimpleGrid
      mt={8}
      columns={{
        base: 2,
        md: 4,
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