import { useState } from "react";
import { useToast } from "@chakra-ui/react";

import libraryApi from "../api/libraryApi";

import type {
  Game,
  Status,
  AddGamePayload,
  RawgGameResult,
} from "../../../types/library";

export function useLibrary() {
  const [games, setGames] = useState<Game[]>([]);

  const toast = useToast();

 const fetchLibrary = async (): Promise<void> => {
    const data =
      await libraryApi.getUserLibrary();

    setGames(data);
  };

 const addGame = async (
  rawgGame: RawgGameResult
): Promise<void> => {
    const payload: AddGamePayload = {
      title: rawgGame.name,
      description: "",
      imageURL: rawgGame.imageURL,
      exePath: "",
      tags: rawgGame.genres,
      status: "plan",
    };

    const created =
      await libraryApi.addGame(payload);

    setGames((prev) => [
      ...prev,
      created,
    ]);

    toast({
      title: "Game Added",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const deleteGame = async (
    id: string
  ) => {
    await libraryApi.deleteGame(id);

    setGames((prev) =>
      prev.filter((g) => g._id !== id)
    );
  };

  const updateStatus = async (
    id: string,
    status: Status
  ) => {
    await libraryApi.updateGame(id, {
      status,
    });

    setGames((prev) =>
      prev.map((g) =>
        g._id === id
          ? { ...g, status }
          : g
      )
    );
  };

  return {
    games,
    setGames,

    fetchLibrary,

    addGame,

    deleteGame,

    updateStatus,
  };
}