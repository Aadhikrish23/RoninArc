import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
} from "@chakra-ui/react";

import type {
  RawgGameDetails,
} from "../types/library";

interface Props {
  game: RawgGameDetails;
}

export default function GameStats({
  game,
}: Props) {
  return (
    <SimpleGrid
      mt={8}
      columns={{
        base: 2,
        md: 4,
      }}
      spacing={5}
    >
      <Stat>
        <StatLabel>
          Rating
        </StatLabel>

        <StatNumber>
          {game.rating}
        </StatNumber>
      </Stat>

      <Stat>
        <StatLabel>
          Reviews
        </StatLabel>

        <StatNumber>
          {game.ratingsCount}
        </StatNumber>
      </Stat>

      <Stat>
        <StatLabel>
          Metacritic
        </StatLabel>

        <StatNumber>
          {game.metacritic ?? "-"}
        </StatNumber>
      </Stat>

      <Stat>
        <StatLabel>
          Community Playtime
        </StatLabel>

        <StatNumber>
          {game.playtime}h
        </StatNumber>
      </Stat>
    </SimpleGrid>
  );
}