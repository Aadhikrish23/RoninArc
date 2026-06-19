import {
  Box,
  Flex,
  Image,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";

import type { RawgGameResult } from "../types/library";
import { useNavigate } from "react-router-dom";

interface Props {
  results: RawgGameResult[];
  onViewAll: () => void;
}

export default function RawgSearchDropdown({ results, onViewAll }: Props) {
  const bg = useColorModeValue("white", "gray.800");

  const border = useColorModeValue("gray.200", "gray.700");
  const navigate = useNavigate();
  const topResults = results;

  return (
    <Box
      mt={2}
      borderWidth="1px"
      borderColor={border}
      borderRadius="lg"
      bg={bg}
      overflow="hidden"
    >
      <Box px={4} py={3}>
        <Text fontSize="sm" fontWeight="bold" color="gray.500">
          TOP RESULTS
        </Text>
      </Box>

      <VStack spacing={0} align="stretch">
        {topResults.map((game) => (
          <Flex
            key={game.id}
            px={4}
            py={3}
            gap={3}
            align="center"
            cursor="pointer"
            onClick={() => navigate(`/library/game/${game.id}`)}
            _hover={{
              bg: "whiteAlpha.100",
            }}
          >
            <Image
              src={game.imageURL ?? "https://placehold.co/120x80?text=No+Image"}
              alt={game.name}
              boxSize="60px"
              objectFit="cover"
              borderRadius="md"
            />

            <Box>
              <Text fontWeight="semibold">{game.name}</Text>

              <Text fontSize="sm" color="gray.500">
                ⭐ {game.rating}
              </Text>
            </Box>
          </Flex>
        ))}

        <Box
          px={4}
          py={4}
          cursor="pointer"
          onClick={onViewAll}
          _hover={{
            bg: "whiteAlpha.100",
          }}
        >
          <Text fontWeight="bold" color="purple.300">
            View all results →
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}
