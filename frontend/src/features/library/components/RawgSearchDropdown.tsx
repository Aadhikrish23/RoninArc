import {
  Box,
  Flex,
  Image,
  Text,
  VStack,
  useColorModeValue,
  Badge,
} from "@chakra-ui/react";

import type { RawgGameResult, Game } from "../types/library";
import { useNavigate } from "react-router-dom";

interface Props {
  ownedResults: Game[];
  discoverResults: RawgGameResult[];
  onViewAll: () => void;
}

export default function RawgSearchDropdown({ ownedResults, discoverResults, onViewAll }: Props) {
  const bg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const sectionHeaderBg = useColorModeValue("gray.50", "gray.900");
  const navigate = useNavigate();

  return (
    <Box
      mt={2}
      borderWidth="1px"
      borderColor={border}
      borderRadius="lg"
      bg={bg}
      overflow="hidden"
      shadow="lg"
    >
      <VStack spacing={0} align="stretch">
        {/* Section 1: In Your Library */}
        {ownedResults.length > 0 && (
          <Box px={4} py={2} bg={sectionHeaderBg}>
            <Text fontSize="xs" fontWeight="bold" color="purple.400" letterSpacing="wider">
              IN YOUR LIBRARY
            </Text>
          </Box>
        )}
        {ownedResults.slice(0, 3).map((game) => (
          <Flex
            key={game._id}
            px={4}
            py={3}
            gap={3}
            align="center"
            cursor="pointer"
            onClick={() => navigate(`/library/game/${game._id}`)}
            _hover={{
              bg: hoverBg,
            }}
          >
            <Image
              src={game.imageURL ?? "https://placehold.co/120x80?text=No+Image"}
              alt={game.title}
              boxSize="60px"
              objectFit="cover"
              borderRadius="md"
            />

            <Box flex={1}>
              <Flex align="center" gap={2}>
                <Text fontWeight="semibold" noOfLines={1}>{game.title}</Text>
                <Badge colorScheme="purple" fontSize="0.7em" borderRadius="md" px={1.5}>
                  {game.provider ? game.provider.toUpperCase() : "OWNED"}
                </Badge>
              </Flex>
              <Text fontSize="xs" color="gray.500" mt={0.5}>
                {game.developer || "Unknown Developer"}
              </Text>
            </Box>
          </Flex>
        ))}

        {/* Section 2: Discover Games */}
        {discoverResults.length > 0 && (
          <Box
            px={4}
            py={2}
            bg={sectionHeaderBg}
            borderTopWidth={ownedResults.length > 0 ? "1px" : "0px"}
            borderColor={border}
          >
            <Text fontSize="xs" fontWeight="bold" color="gray.400" letterSpacing="wider">
              DISCOVER GAMES
            </Text>
          </Box>
        )}
        {discoverResults.slice(0, 5).map((game) => (
          <Flex
            key={game.id}
            px={4}
            py={3}
            gap={3}
            align="center"
            cursor="pointer"
            onClick={() => navigate(`/library/game/${game.id}`)}
            _hover={{
              bg: hoverBg,
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
              <Text fontWeight="semibold" noOfLines={1}>{game.name}</Text>
              <Text fontSize="sm" color="gray.500" mt={0.5}>
                ⭐ {game.rating} • {game.genres.slice(0, 2).join(", ") || "Unknown Genre"}
              </Text>
            </Box>
          </Flex>
        ))}

        {/* View all button */}
        <Box
          px={4}
          py={4}
          cursor="pointer"
          onClick={onViewAll}
          borderTopWidth="1px"
          borderColor={border}
          _hover={{
            bg: hoverBg,
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
