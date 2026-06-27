import { createContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useToast } from "@chakra-ui/react";
import { useAuth } from "../../auth/context/AuthContext";
import libraryApi from "../api/libraryApi";
import type { Game, Status, AddGamePayload, UpdateGamePayload } from "../types/library";

export interface LibraryContextType {
  games: Game[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  fetchLibrary: (force?: boolean) => Promise<void>;
  addGame: (payload: AddGamePayload) => Promise<Game>;
  updateGame: (id: string, payload: UpdateGamePayload) => Promise<Game>;
  updateStatus: (id: string, status: Status) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  refreshGame: (id: string) => Promise<void>;
  replaceGame: (updatedGame: Game) => void;
}

export const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  const toast = useToast();
  const { isAuthenticated } = useAuth();

const fetchLibrary = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    const games = await libraryApi.getUserLibrary();

    setGames(games);
    setInitialized(true);
  } catch (err: any) {
    setError(err.message || "Failed to load library");
  } finally {
    setLoading(false);
  }
}, []);

  // Clean state on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setGames([]);
      setInitialized(false);
      setLoading(false);
      setError(null);
    }
  }, [isAuthenticated]);

  const replaceGame = useCallback((updated: Game) => {
    setGames((prev) => prev.map((g) => (g._id === updated._id ? updated : g)));
  }, []);

  const addGame = async (payload: AddGamePayload): Promise<Game> => {
    const created = await libraryApi.addGame(payload);
    setGames((prev) => [...prev, created]);
    toast({
      title: "Game Added",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
    return created;
  };

  const updateGame = async (id: string, payload: UpdateGamePayload): Promise<Game> => {
    const updated = await libraryApi.updateGame(id, payload);
    replaceGame(updated);
    return updated;
  };

  const updateStatus = async (id: string, status: Status): Promise<void> => {
    const updated = await libraryApi.updateGame(id, {
      progressStatus: status,
    });
    replaceGame(updated);
  };

  const deleteGame = async (id: string): Promise<void> => {
    await libraryApi.deleteGame(id);
    setGames((prev) => prev.filter((g) => g._id !== id));
  };

  const refreshGame = async (id: string): Promise<void> => {
    try {
      const updated = await libraryApi.getGameById(id);
      replaceGame(updated);
    } catch (err: any) {
      console.error(`Failed to refresh game ${id}:`, err);
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        games,
        loading,
        error,
        initialized,
        fetchLibrary,
        addGame,
        updateGame,
        updateStatus,
        deleteGame,
        refreshGame,
        replaceGame,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}
export default LibraryContext;
