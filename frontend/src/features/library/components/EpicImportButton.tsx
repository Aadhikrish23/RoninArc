import { Button } from "@chakra-ui/react";

import libraryApi from "../api/libraryApi";
import type { AddGamePayload, EpicGame } from "../types/library";
import { rankSearchResults } from "../utils/searchRanking";

interface Props {
  onImportFinished?: () => void;
}

export default function EpicImportButton({ onImportFinished }: Props) {
  const handleImport = async () => {
    const epicGames = await window.electronAPI?.scanEpicGames();

    if (!epicGames?.length) {
      alert("No Epic Games found.");

      return;
    }

    for (const epicGame of epicGames) {
      try {
        const results = await libraryApi.searchRawgGames(epicGame.name);
        console.log("RAWG RESULTS", epicGame.name, results);

        if (!results.length) {
          continue;
        }

        const ranked = rankSearchResults(results, epicGame.name);
        console.log("ranked RESULTS", epicGame.name, ranked);

        const rawg = ranked[0];
        console.log("final game  RESULTS", epicGame.name, rawg);
        if (!rawg) {
          continue;
        }

        const normalizedEpic = epicGame.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        const normalizedRawg = rawg.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        if (normalizedEpic !== normalizedRawg) {
          console.log("Skipped bad match:", epicGame.name, "=>", rawg.name);

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

        console.log("Imported:", rawg.name);
      } catch (error) {
        console.log("Skipped:", epicGame.name, error);
      }
    }

    await onImportFinished?.();
  };

  return (
    <Button colorScheme="purple" onClick={handleImport}>
      Import Epic Library
    </Button>
  );
}
