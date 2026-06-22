import { useState } from "react";
import { useToast } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import libraryApi from "../../library/api/libraryApi";

import { rankSearchResults } from "../../library/utils/searchRanking";

import type {
  Game,
  AddGamePayload,
} from "../../library/types/library";

import type {
  EpicGame,
  SteamGame,
} from "../types/importTypes";

export function useGameImport() {
  const toast = useToast();

  const navigate = useNavigate();

  const [scanning, setScanning] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  const [epicGames, setEpicGames] =
    useState<EpicGame[]>([]);

  const [steamGames, setSteamGames] =
    useState<SteamGame[]>([]);

  const [libraryGames, setLibraryGames] =
    useState<Game[]>([]);

  const loadLibrary =
    async () => {
      const data =
        await libraryApi.getUserLibrary();

      setLibraryGames(data);
    };

  const isAlreadyImported = (
    exePath: string
  ) =>
    libraryGames.some(
      (game) =>
        game.exePath === exePath
    );

  const scanLibraries =
    async (
      scanEpic: boolean,
      scanSteam: boolean
    ) => {
      setScanning(true);

      try {
        let epicResults: EpicGame[] =
          [];

        let steamResults: SteamGame[] =
          [];

        if (scanEpic) {
          epicResults =
            (await window
              .electronAPI?.scanEpicGames()) ??
            [];
        }

        if (scanSteam) {
          steamResults =
            (await window
              .electronAPI?.scanSteamGames()) ??
            [];
        }

        setEpicGames(epicResults);

        setSteamGames(
          steamResults
        );

        return {
          epicResults,
          steamResults,
        };
      } finally {
        setScanning(false);
      }
    };

  const importGames =
    async (
      selectedIds: string[]
    ) => {
      setImporting(true);

      try {
        let importedCount = 0;

        const epicToImport =
          epicGames.filter((g) =>
            selectedIds.includes(
              g.epicId
            )
          );

        const steamToImport =
          steamGames.filter((g) =>
            selectedIds.includes(
              g.appId
            )
          );

        const allGames = [
          ...epicToImport,
          ...steamToImport,
        ];

        for (const game of allGames) {
          const results =
            await libraryApi.searchRawgGames(
              game.name
            );

          const ranked =
            rankSearchResults(
              results,
              game.name
            );

          const rawg =
            ranked[0];

          if (!rawg) continue;

          const payload: AddGamePayload =
            {
              rawgId: rawg.id,

              title:
                rawg.name,

              description:
                rawg.description ??
                "",

              imageURL:
                rawg.imageURL,

              exePath:
                game.executable,

              tags:
                rawg.genres,

              status:
                "plan",
            };

          await libraryApi.addGame(
            payload
          );

          importedCount++;
        }

        toast({
          title:
            "Import Complete",

          description: `${importedCount} games imported`,

          status:
            "success",
        });

        navigate("/");
      } finally {
        setImporting(false);
      }
    };

  return {
    scanning,
    importing,

    epicGames,
    steamGames,

    loadLibrary,

    scanLibraries,

    importGames,

    isAlreadyImported,
  };
}