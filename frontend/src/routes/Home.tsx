import {
  Box,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  HStack,
  Button,
  Text,
  SimpleGrid,
  Tag,
  TagLabel,
  useColorModeValue,
  Avatar,
  Spacer,
  Badge,
  VStack,
  Spinner,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";

import { SearchIcon } from "@chakra-ui/icons";
import { FiPlay, FiTrash2 } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@chakra-ui/react";
import { getCurrentUser } from "../utils/auth";
import {  useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

import type {
  RawgGameResult,
  Game,
  AddGamePayload,
  Status,
} from "../types/library";
import libraryApi from "../api/libraryApi";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Plan to Play", value: "plan" },
  { label: "Playing", value: "playing" },
  { label: "Completed", value: "completed" },
  { label: "Dropped", value: "dropped" },
];

function LibraryPage() {
  
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [rawgResults, setRawgResults] = useState<RawgGameResult[]>([]);
  const [rawgLoading, setRawgLoading] = useState<boolean>(true);
  const [rawgError, setRawgError] = useState<string | null>(null);

  const [launchModalGame, setLaunchModalGame] = useState<Game | null>(null);
  const [launchPath, setLaunchPath] = useState<string>("");
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const toast = useToast();
  const openLaunchModal = (game: Game) => {
    setLaunchModalGame(game);
    setLaunchPath(game.exePath || "");
  };
  const currentUser = getCurrentUser();
  const displayName = currentUser?.username.toUpperCase() || "Ronin";

  console.log("currentUser::"+currentUser+
    "::displayName::"+displayName
  )

  const closeLaunchModal = () => {
    setLaunchModalGame(null);
    setLaunchPath("");
  };

  useEffect(() => {
    async function fetchLibrary() {
      try {
        setLoading(true);
        setError(null);
        const data = await libraryApi.getUserLibrary();
        setGames(data);
      } catch (error: any) {
        setError(error.toString());
      } finally {
        setLoading(false);
      }
    }
    fetchLibrary();
  }, []);
  useEffect(() => {
    if (searchText.trim().length < 3) {
      setRawgResults([]);
      setRawgError(null);
      setRawgLoading(false);
      return;
    } else {
      const timer = setTimeout(async () => {
        try {
          setRawgLoading(true);
          setRawgError(null);

          const rawgdata = await libraryApi.searchRawgGames(searchText, 1);
          if (!rawgdata) {
            setRawgError("Failed to search RAWG, Try again");
          } else {
            setRawgResults(rawgdata);
          }
        } catch (error: any) {
          setRawgError(error.toString());
        } finally {
          setRawgLoading(false);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchText]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchStatus =
        selectedStatus === "all" || game.status === selectedStatus;

      const matchSearch = game.title
        .toLowerCase()
        .includes(searchText.toLowerCase());

      return matchStatus && matchSearch;
    });
  }, [games, selectedStatus, searchText]);

  const handleaddgame = async (rawgGame: RawgGameResult) => {
    try {
      const payload: AddGamePayload = {
        title: rawgGame.name,
        description: "", 
        imageURL: rawgGame.imageURL,
        exePath: "",
        tags: rawgGame.genres,
        status: "plan",
      };

      const createdGame = await libraryApi.addGame(payload);
      setGames((prev) => [...prev, createdGame]);

      toast({
        title: "Game Added",
        description: `${rawgGame.name} added to your library`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });

      setSearchText("");
      setRawgError(null);
      setRawgLoading(false);
    } catch (error: any) {
      console.error("Failed to add game from RAWG", error);
      setError(error.toString());
    }
  };
  const handledeletegame = async (id: string) => {
    try {
      await libraryApi.deleteGame(id);

      setGames((prev) => prev.filter((g) => g._id !== id));
      const data = await libraryApi.getUserLibrary();
      setGames(data);
      toast({
        title: "Game Deleted",
        description: "Game Deleted Sucessfully",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error: any) {
      setError(error.toString());
    }
  };
  const handleUpdateStatus = async (id: string, newStatus: Status) => {
    try {
      // Update backend
      await libraryApi.updateGame(id, { status: newStatus });

      // Update UI instantly
      setGames((prev) =>
        prev.map((g) => (g._id === id ? { ...g, status: newStatus } : g))
      );
      toast({
        title: "Status updated",
        description: `Game moved to ${newStatus}`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to update status", error);
      setError(error.toString());
    }
  };
  const handlePickExePath = async () => {
    if (!window.electronAPI?.selectExePath) {
      toast({
        title: "Desktop only",
        description: "EXE path editing works only inside the Electron app.",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    try {
      const selectedPath = await window.electronAPI.selectExePath();
      if (!selectedPath) return; // user cancelled

      if (!launchModalGame) return;

      await libraryApi.updateGame(launchModalGame._id, {
        exePath: selectedPath,
      });

      setLaunchPath(selectedPath);
      setGames((prev) =>
        prev.map((g) =>
          g._id === launchModalGame._id ? { ...g, exePath: selectedPath } : g
        )
      );

      toast({
        title: "EXE path updated",
        description: "Launch path saved successfully.",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to update exe path", error);
      setError(error.toString());
      toast({
        title: "Update failed",
        description: "Could not update EXE path.",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleLaunchGame = async () => {
    if (!launchModalGame) return;

    if (!launchPath) {
      toast({
        title: "No EXE path set",
        description: "Please choose an EXE path before launching.",
        status: "warning",
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    if (!window.electronAPI?.launchGame) {
      toast({
        title: "Desktop only",
        description: "Launching is only available inside the Electron app.",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    try {
      await window.electronAPI.launchGame(launchPath);

      toast({
        title: `Launching ${launchModalGame.title}`,
        description: launchPath,
        status: "info",
        duration: 2000,
        isClosable: true,
      });

      closeLaunchModal();
    } catch (error: any) {
      console.error("Failed to launch game", error);
      toast({
        title: "Launch failed",
        description: "Could not start the game.",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <Box minH="100vh" bg={bg}>
      
      <Navbar/>
      {/* ---------------- MAIN CONTENT ---------------- */}
      <Box maxW="1200px" mx="auto" px={6} py={8}>
        {/* Header */}
        <Flex direction="column" gap={2} mb={6}>
          <Heading size="lg">My Library</Heading>
          <Text fontSize="sm" color="gray.500">
            Track your gaming progress and backlog.
          </Text>
        </Flex>

        {/* ---------------- RAWG Search Bar ---------------- */}
        <Box mb={6}>
          <InputGroup size="lg">
            <InputLeftElement>
              <Icon as={SearchIcon} color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search games to add from RAWG..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              borderRadius="xl"
              bg={cardBg}
              borderColor={subtleBorder}
            />
          </InputGroup>
        </Box>
        {/* ---------------- RAWG SEARCH RESULTS ---------------- */}
        <Box mb={6}>
          {rawgLoading ? (
            <HStack
              spacing={2}
              p={3}
              borderWidth="1px"
              borderRadius="md"
              borderColor={subtleBorder}
              bg={cardBg}
            >
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.500">
                Searching RAWG...
              </Text>
            </HStack>
          ) : rawgError ? (
            <Box
              p={3}
              borderWidth="1px"
              borderRadius="md"
              borderColor="red.300"
              bg="red.50"
              _dark={{ bg: "red.900", borderColor: "red.700" }}
            >
              <Text fontSize="sm" color="red.500">
                {rawgError}
              </Text>
            </Box>
          ) : rawgResults.length > 0 ? (
            <Box
              p={3}
              borderWidth="1px"
              borderRadius="md"
              borderColor={subtleBorder}
              bg={cardBg}
              maxH="260px"
              overflowY="auto"
            >
              <Text fontSize="sm" mb={2} color="gray.500">
                RAWG results:
              </Text>

              <VStack align="stretch" spacing={2}>
                {rawgResults.map((game) => (
                  <Flex
                    key={game.id}
                    align="center"
                    justify="space-between"
                    p={2}
                    borderRadius="md"
                    _hover={{ bg: useColorModeValue("gray.100", "gray.700") }}
                    transition="background 0.15s ease-out"
                  >
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                        {game.name}
                      </Text>
                      <Text fontSize="xs" color="gray.500" noOfLines={1}>
                        {game.genres.join(", ")}
                      </Text>
                    </Box>

                    <Button
                      size="xs"
                      colorScheme="purple"
                      variant="outline"
                      // TODO: wire this later to addGame()
                      onClick={() => handleaddgame(game)}
                    >
                      Add
                    </Button>
                  </Flex>
                ))}
              </VStack>
            </Box>
          ) : null}
        </Box>

        {/* ---------------- STATUS FILTERS ---------------- */}
        <HStack spacing={3} mb={6} wrap="wrap">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={selectedStatus === s.value ? "solid" : "outline"}
              colorScheme={selectedStatus === s.value ? "purple" : undefined}
              borderRadius="full"
              onClick={() => setSelectedStatus(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </HStack>

        {/* ---------------- GAME GRID ---------------- */}
        {loading ? (
          <Box
            w="100%"
            py={10}
            textAlign="center"
            color="gray.500"
            fontSize="lg"
          >
            <Spinner size="xl" thickness="4px" speed="0.6s" />
            <Text mt={4}>Loading your library...</Text>
          </Box>
        ) : error ? (
          <Box
            w="100%"
            py={10}
            textAlign="center"
            color="red.400"
            fontSize="md"
            borderWidth="1px"
            borderColor="red.300"
            borderRadius="lg"
            bg="red.50"
            _dark={{
              bg: "red.900",
              borderColor: "red.700",
              color: "red.200",
            }}
          >
            <Text fontWeight="semibold">Something went wrong!</Text>
            <Text>{error}</Text>
          </Box>
        ) : filteredGames.length === 0 ? (
          <Box
            p={6}
            borderWidth="1px"
            borderStyle="dashed"
            borderRadius="lg"
            textAlign="center"
          >
            <Text>No games found.</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={5}>
            {filteredGames.map((game) => (
              <GameCard
                key={game._id}
                game={game}
                onRemove={(id) => handledeletegame(id)}
                onStatusChange={(id, newStatus) =>
                  handleUpdateStatus(id, newStatus)
                }
                onLaunch={(g) => openLaunchModal(g)}
              />
            ))}
          </SimpleGrid>
        )}
        {/* -------- Launch Modal -------- */}
        {launchModalGame && (
          <Modal
            isOpen={!!launchModalGame}
            onClose={closeLaunchModal}
            isCentered
          >
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Launch {launchModalGame.title}</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" color="gray.500">
                    Choose the executable file for this game. You can change it
                    anytime.
                  </Text>

                  <HStack align="center" spacing={2}>
                    <Input
                      placeholder="No path selected"
                      value={launchPath}
                      isReadOnly
                      size="sm"
                    />
                    <Button size="sm" onClick={handlePickExePath}>
                      Edit
                    </Button>
                  </HStack>

                  {launchPath && (
                    <Text fontSize="xs" color="gray.500">
                      Path will be saved for future launches.
                    </Text>
                  )}
                </VStack>
              </ModalBody>

              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={closeLaunchModal}>
                  Cancel
                </Button>
                <Button
                  colorScheme="purple"
                  onClick={handleLaunchGame}
                  isDisabled={!launchPath}
                >
                  Launch
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
      </Box>
    </Box>
  );
}

// -------------------- GAME CARD COMPONENT --------------------
function GameCard({
  game,
  onRemove,
  onStatusChange,
  onLaunch,
}: {
  game: Game;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, newStatus: Status) => void;
  onLaunch: (game: Game) => void;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");

  const STATUS_COLOR = {
    plan: "yellow",
    playing: "purple",
    completed: "green",
    dropped: "red",
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      // overflow="hidden"
      bg={cardBg}
      borderColor={subtleBorder}
      _hover={{ transform: "translateY(-3px)", boxShadow: "lg" }}
      transition="all 0.15s ease-out"
    >
      <Box
        h="140px"
        borderTopLeftRadius="xl"
        borderTopRightRadius="xl"
        backgroundImage={`url(${game.imageURL})`}
        backgroundSize="cover"
        backgroundPosition="center"
      />

      <VStack align="stretch" spacing={2} p={3}>
        <Flex align="center">
          <Text fontWeight="semibold" noOfLines={1} mr={2}>
            {game.title}
          </Text>
          <Menu>
            <MenuButton
              as={Badge}
              cursor="pointer"
              colorScheme={STATUS_COLOR[game.status]}
              borderRadius="full"
              textTransform="capitalize"
              px={3}
              py={1}
            >
              {game.status} ▼
            </MenuButton>

            <MenuList>
              <MenuItem onClick={() => onStatusChange(game._id, "plan")}>
                Plan to Play
              </MenuItem>
              <MenuItem onClick={() => onStatusChange(game._id, "playing")}>
                Playing
              </MenuItem>
              <MenuItem onClick={() => onStatusChange(game._id, "completed")}>
                Completed
              </MenuItem>
              <MenuItem onClick={() => onStatusChange(game._id, "dropped")}>
                Dropped
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>

        <HStack spacing={1} wrap="wrap">
          {game.tags.map((tag) => (
            <Tag key={tag} size="sm" variant="subtle" borderRadius="full">
              <TagLabel>{tag}</TagLabel>
            </Tag>
          ))}
        </HStack>

        <Flex justify="space-between" mt={2}>
          <Button
            size="sm"
            leftIcon={<FiPlay />}
            variant="outline"
            onClick={() => onLaunch(game)}
          >
            Launch
          </Button>

          <Button
            size="sm"
            leftIcon={<FiTrash2 />}
            colorScheme="red"
            variant="ghost"
            onClick={() => onRemove(game._id)}
          >
            Remove
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
}

export default LibraryPage;
