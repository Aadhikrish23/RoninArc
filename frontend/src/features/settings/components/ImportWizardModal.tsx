import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  Checkbox,
  Box,
  Spinner,
} from "@chakra-ui/react";

import { useState, useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

import { useGameImport } from "../hooks/useGameImport";
export default function ImportWizardModal({ isOpen, onClose }: Props) {
  const [epicSelected, setEpicSelected] = useState(true);

  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [steamSelected, setSteamSelected] = useState(true);

  const {
    scanning,
    importing,

    epicGames: games,
    steamGames,

    loadLibrary,

    scanLibraries,

    importGames,

    isAlreadyImported,
  } = useGameImport();
  useEffect(() => {
    if (isOpen) {
      loadLibrary();
    }
  }, [isOpen]);

  const handleScan = async () => {
    const result = await scanLibraries(epicSelected, steamSelected);

    setSelectedGames([
      ...result.epicResults
        .filter((g) => !isAlreadyImported(g.executable))
        .map((g) => g.epicId),

      ...result.steamResults
        .filter((g) => !isAlreadyImported(g.executable))
        .map((g) => g.appId),
    ]);
  };
  const handleImport = async () => {
    await importGames(selectedGames);

    onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay />

      <ModalContent borderRadius="2xl">
        <ModalHeader>Import Game Libraries</ModalHeader>

        <ModalBody>
          <VStack align="stretch" spacing={5}>
            <Text px={6} pb={4} color="gray.500" fontSize="sm">
              Scan installed launchers and import games directly into your
              RoninArc library.
            </Text>

            <Box borderWidth="1px" borderRadius="lg" p={4}>
              <Checkbox
                isChecked={epicSelected}
                onChange={(e) => setEpicSelected(e.target.checked)}
              >
                Epic Games
              </Checkbox>
            </Box>

            <Box borderWidth="1px" borderRadius="lg" p={4}>
              <Checkbox
                isChecked={steamSelected}
                onChange={(e) => setSteamSelected(e.target.checked)}
              >
                Steam Games
              </Checkbox>
            </Box>

            <Button
              colorScheme="purple"
              onClick={handleScan}
              isLoading={scanning}
            >
              Scan Libraries
            </Button>

            {scanning && <Spinner />}

            {(games.length > 0 || steamGames.length > 0) && (
              <Box>
                <Text fontWeight="bold" mb={2}>
                  Found {games.length + steamGames.length} game(s)
                </Text>

                {games.length > 0 && (
                  <>
                    <Text fontWeight="semibold" mb={2}>
                      Epic Games
                    </Text>

                    <VStack align="stretch" spacing={2} mb={4}>
                      {games.map((game) => (
                        <Checkbox
                          key={game.epicId}
                          isChecked={selectedGames.includes(game.epicId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGames((prev) => [
                                ...prev,
                                game.epicId,
                              ]);
                            } else {
                              setSelectedGames((prev) =>
                                prev.filter((id) => id !== game.epicId),
                              );
                            }
                          }}
                          isDisabled={isAlreadyImported(game.executable)}
                        >
                          <>
                            {game.name}

                            {isAlreadyImported(game.executable) && (
                              <Text
                                as="span"
                                ml={2}
                                color="green.400"
                                fontSize="sm"
                              >
                                (Already Imported)
                              </Text>
                            )}
                          </>
                        </Checkbox>
                      ))}
                    </VStack>
                  </>
                )}

                {steamGames.length > 0 && (
                  <>
                    <Text fontWeight="semibold" mb={2}>
                      Steam Games
                    </Text>

                    <VStack align="stretch" spacing={2} mb={4}>
                      {steamGames.map((game) => (
                        <Checkbox
                          key={game.appId}
                          isDisabled={isAlreadyImported(game.executable)}
                          isChecked={selectedGames.includes(game.appId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGames((prev) => [...prev, game.appId]);
                            } else {
                              setSelectedGames((prev) =>
                                prev.filter((id) => id !== game.appId),
                              );
                            }
                          }}
                        >
                          <>
                            {game.name}

                            {isAlreadyImported(game.executable) && (
                              <Text
                                as="span"
                                ml={2}
                                color="green.400"
                                fontSize="sm"
                              >
                                (Already Imported)
                              </Text>
                            )}
                          </>
                        </Checkbox>
                      ))}
                    </VStack>
                  </>
                )}

                <Button
                  colorScheme="green"
                  onClick={handleImport}
                  isLoading={importing}
                  isDisabled={selectedGames.length === 0}
                >
                  {selectedGames.length === 0
                    ? "No Games Selected"
                    : `Import ${selectedGames.length} Game${
                        selectedGames.length > 1 ? "s" : ""
                      }`}
                </Button>
              </Box>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
