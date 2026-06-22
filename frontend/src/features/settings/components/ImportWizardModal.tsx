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

import { useEffect, useState } from "react";
import { useToast } from "@chakra-ui/react";
import { Navigate, useNavigate } from "react-router-dom";

interface EpicGame {
  name: string;
  installPath: string;
  executable: string;
  epicId: string;
}
interface SteamGame {
  appId: string;
  name: string;
  installPath: string;
  executable: string;
}
interface Props {
  isOpen: boolean;
  onClose: () => void;
}
import libraryApi from "../../library/api/libraryApi";
import { rankSearchResults } from "../../library/utils/searchRanking";

import type { Game, AddGamePayload } from "../../library/types/library";
export default function ImportWizardModal({ isOpen, onClose }: Props) {
  const [epicSelected, setEpicSelected] = useState(true);

  const [scanning, setScanning] = useState(false);

  const [games, setGames] = useState<EpicGame[]>([]);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [steamSelected, setSteamSelected] = useState(true);

  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [libraryGames, setLibraryGames] = useState<Game[]>([]);
  const navigate =useNavigate()
  
  const toast = useToast();
  const isAlreadyImported = (exePath: string) => {
    return libraryGames.some((game) => game.exePath === exePath);
  };
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const data = await libraryApi.getUserLibrary();

        setLibraryGames(data);
      } catch (err) {
        console.error(err);
      }
    };

    if (isOpen) {
      loadLibrary();
    }
  }, [isOpen]);
  const handleScan = async () => {
    setScanning(true);

    try {
      let epicResults: EpicGame[] = [];
      let steamResults: SteamGame[] = [];

      if (epicSelected) {
        epicResults = (await window.electronAPI?.scanEpicGames()) ?? [];
      }

      if (steamSelected) {
        steamResults = (await window.electronAPI?.scanSteamGames()) ?? [];
      }

      setGames(epicResults);

      setSteamGames(steamResults);

      setSelectedGames([
        ...epicResults
          .filter((g) => !isAlreadyImported(g.executable))
          .map((g) => g.epicId),

        ...steamResults
          .filter((g) => !isAlreadyImported(g.executable))
          .map((g) => g.appId),
      ]);
    } finally {
      setScanning(false);
    }
  };
  const handleImport = async () => {
    setImporting(true);

    try {
      const epicGamesToImport = games.filter((game) =>
        selectedGames.includes(game.epicId),
      );

      const steamGamesToImport = steamGames.filter((game) =>
        selectedGames.includes(game.appId),
      );
      let importedCount = 0;

      for (const epicGame of epicGamesToImport) {
        const results = await libraryApi.searchRawgGames(epicGame.name);

        const ranked = rankSearchResults(results, epicGame.name);

        const rawg = ranked[0];

        if (!rawg) {
          continue;
        }

        const payload: AddGamePayload = {
          rawgId: rawg.id,

          title: rawg.name,

          description: rawg.description ?? "",

          imageURL: rawg.imageURL,

          exePath: epicGame.executable,

          tags: rawg.genres,

          status: "plan",
        };

        await libraryApi.addGame(payload);
        importedCount++;
      }
      for (const steamGame of steamGamesToImport) {
        const results = await libraryApi.searchRawgGames(steamGame.name);

        const ranked = rankSearchResults(results, steamGame.name);

        const rawg = ranked[0];

        if (!rawg) {
          continue;
        }

        const payload: AddGamePayload = {
          rawgId: rawg.id,
          title: rawg.name,
          description: rawg.description ?? "",
          imageURL: rawg.imageURL,
          exePath: steamGame.executable,
          tags: rawg.genres,
          status: "plan",
        };

        await libraryApi.addGame(payload);
        importedCount++;

        console.log("Imported Steam:", steamGame.name);
      }

      toast({
        title: "Import Complete",
        description: `${importedCount} games imported`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
     
      onClose();
      navigate("/")
    } catch (error) {
      console.error(error);

      alert("Failed to import games.");
    } finally {
      setImporting(false);
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>Import Libraries</ModalHeader>

        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text>Select launchers to scan.</Text>

            <Checkbox
              isChecked={epicSelected}
              onChange={(e) => setEpicSelected(e.target.checked)}
            >
              Epic Games
            </Checkbox>

            <Checkbox
              isChecked={steamSelected}
              onChange={(e) => setSteamSelected(e.target.checked)}
            >
              Steam Games
            </Checkbox>

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
