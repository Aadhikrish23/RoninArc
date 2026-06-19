import {
  Box,
  Badge,
  Flex,
  Heading,
  Spinner,
  Stack,
  Tag,
  Text,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";

import { Button } from "@chakra-ui/react";

import { useNavigate } from "react-router-dom";

import { useParams } from "react-router-dom";

import { useGameDetails } from "../hooks/useGameDetails";

import GameDetailHero from "../components/GameDetailHero";
import GameStats from "../components/GameStats";
import GameScreenshots from "../components/GameScreenshots";
import { useLibrary } from "../hooks/useLibrary";
import UserGameStats from "../components/UserGameStats";
import { useEffect } from "react";

export default function GameDetailsPage() {
  const { rawgId } = useParams();

  const { game, loading, error } = useGameDetails(rawgId);
  const { games, fetchLibrary, addGame } = useLibrary();
  const navigate = useNavigate();
  const libraryGame = games.find((g) => g.rawgId === game?.id) ?? null;
  const handleAddGame = async () => {
    if (!game) return;

    await addGame({
      rawgId: game.id,
      title: game.name,
      description: game.description,
      imageURL: game.imageURL,
      exePath: "",
      tags: game.genres,
      status: "plan",
    });

    await fetchLibrary();
  };
 const handleOpenLibrary = () => {
  navigate(
    `/?game=${libraryGame?._id}`
  );
};
  useEffect(() => {
    fetchLibrary();
  }, []);

  if (loading) {
    return (
      <Flex minH="70vh" justify="center" align="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (error || !game) {
    return (
      <Box p={8}>
        <Text color="red.500">{error ?? "Game not found"}</Text>
      </Box>
    );
  }

  return (
    <Box maxW="1400px" mx="auto" px={6} py={8}>
      <Flex justify="space-between" mb={6}>
        <Button
          leftIcon={<ArrowBackIcon />}
          variant="ghost"
          onClick={() => navigate(-1)}
        >
          Back
        </Button>

        {!libraryGame && (
          <Button colorScheme="purple" onClick={handleAddGame}>
            Add To Library
          </Button>
        )}
      </Flex>
      {/* Hero */}
      <GameDetailHero game={game} />
      <UserGameStats game={libraryGame} openlibrary = {handleOpenLibrary} />

      {/* Stats */}
      <GameStats game={game} />

      {/* Description */}
      <Box mt={10}>
        <Heading size="md" mb={4}>
          About
        </Heading>

        <Text color="gray.500" lineHeight="1.8" whiteSpace="pre-wrap">
          {game.description}
        </Text>
      </Box>

      {/* Genres */}
      <Box mt={10}>
        <Heading size="md" mb={4}>
          Genres
        </Heading>

        <Flex wrap="wrap" gap={2}>
          {game.genres.map((genre) => (
            <Tag key={genre}>{genre}</Tag>
          ))}
        </Flex>
      </Box>

      {/* Developers */}
      {game.developers.length > 0 && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Developers
          </Heading>

          <Stack spacing={2}>
            {game.developers.map((developer) => (
              <Text key={developer}>{developer}</Text>
            ))}
          </Stack>
        </Box>
      )}

      {/* Publishers */}
      {game.publishers.length > 0 && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Publishers
          </Heading>

          <Stack spacing={2}>
            {game.publishers.map((publisher) => (
              <Text key={publisher}>{publisher}</Text>
            ))}
          </Stack>
        </Box>
      )}

      {/* Tags */}
      {game.tags.length > 0 && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Tags
          </Heading>

          <Flex wrap="wrap" gap={2}>
            {game.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Flex>
        </Box>
      )}

      {/* Website */}
      {game.website && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Official Website
          </Heading>

          <Text
            as="a"
            href={game.website}
            target="_blank"
            rel="noreferrer"
            color="purple.400"
          >
            {game.website}
          </Text>
        </Box>
      )}

      {/* Screenshots */}
      <GameScreenshots screenshots={game.screenshots} />
    </Box>
  );
}
