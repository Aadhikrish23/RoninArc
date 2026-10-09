/* eslint-disable react-refresh/only-export-components */
import { useToast } from "@chakra-ui/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import libraryApi from "../api/libraryApi";
import activityApi from "../../activity/api/activityApi";
import { usePlaySession } from "../../playSession/hooks/usePlaySession";
import { resolveLaunch } from "../utils/launch";
import { canLaunchGames } from "../../../shared/utils/runtime";
import { eventBus } from "../../../shared/events/EventBus";
import LaunchModal from "../components/LaunchModal";

import type { Game } from "../types/library";

/** Published by the AI assistant when the backend hands back a `launch_game` client action. */
export const AI_LAUNCH_EVENT = "ai.launchGame";

interface LaunchContextValue {
  /** Opens the launch dialog for a game (no-op outside the desktop app). */
  openLaunchModal: (game: Game) => void;
  /** Launches a library game by id: straight away when its executable is known, otherwise via the dialog. */
  launchById: (gameId: string) => Promise<void>;
  runningGames: Set<string>;
}

const LaunchContext = createContext<LaunchContextValue | undefined>(undefined);

/**
 * One launcher for the whole signed-in app. Running state and the game-exit
 * listener used to live in each page, so a game that exited while you were on
 * a page without launch buttons never had its play session ended, and the AI
 * assistant had no way to launch anything at all.
 */
export function LaunchProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { startSession, endSession } = usePlaySession();

  const [game, setGame] = useState<Game | null>(null);
  const [launchPath, setLaunchPath] = useState("");
  const [runningGames, setRunningGames] = useState<Set<string>>(new Set());
  const runningRef = useRef(runningGames);
  runningRef.current = runningGames;

  const setRunning = (gameId: string, running: boolean) =>
    setRunningGames((prev) => {
      const next = new Set(prev);
      if (running) next.add(gameId);
      else next.delete(gameId);
      return next;
    });

  useEffect(() => {
    if (!window.electronAPI?.onGameExited) return;

    const unsubscribe = window.electronAPI.onGameExited(async (gameId) => {
      try {
        await endSession(gameId);
        setRunning(gameId, false);
        toast({ title: "Play session ended", status: "success" });
        eventBus.publish("dashboard.updated");
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsubscribe();
  }, [endSession, toast]);

  const closeLaunchModal = () => {
    setGame(null);
    setLaunchPath("");
  };

  const openLaunchModal = useCallback((selectedGame: Game) => {
    if (!canLaunchGames()) return;
    setGame(selectedGame);
    setLaunchPath(resolveLaunch(selectedGame).path);
  }, []);

  /** Starts the session, asks Electron to run the executable, and undoes the session if that fails. */
  const startLaunch = useCallback(
    async (target: Game, path: string) => {
      await startSession(target._id);
      setRunning(target._id, true);
      try {
        await window.electronAPI?.launchGame(target._id, path);
      } catch (err) {
        await endSession(target._id).catch(() => {});
        setRunning(target._id, false);
        throw err;
      }
      await activityApi.recordLaunch(target._id);
      toast({ title: `Launching ${target.title}`, status: "success" });
      eventBus.publish("dashboard.updated");
    },
    [startSession, endSession, toast],
  );

  const launchById = useCallback(
    async (gameId: string) => {
      if (!canLaunchGames()) return;
      if (runningRef.current.has(gameId)) {
        toast({ title: "That game is already running", status: "info" });
        return;
      }
      try {
        const target = await libraryApi.getGameById(gameId);
        const resolved = resolveLaunch(target);
        if (resolved.path) {
          await startLaunch(target, resolved.path);
        } else {
          openLaunchModal(target);
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Failed to launch game", status: "error" });
      }
    },
    [openLaunchModal, startLaunch, toast],
  );

  useEffect(
    () =>
      eventBus.subscribe(AI_LAUNCH_EVENT, (data) => {
        const gameId = (data as { gameId?: string } | undefined)?.gameId;
        if (gameId) void launchById(gameId);
      }),
    [launchById],
  );

  const handlePickExePath = async () => {
    if (!game) return;
    const selected = await window.electronAPI?.selectExePath();
    if (!selected) return;
    await libraryApi.updateGame(game._id, { exePath: selected });
    setLaunchPath(selected);
    setGame({ ...game, exePath: selected });
    toast({ title: "Launch path updated", status: "success" });
  };

  const handleLaunchGame = async () => {
    if (!game) return;
    if (!launchPath) {
      toast({ title: "No executable selected", status: "warning" });
      return;
    }
    try {
      await startLaunch(game, launchPath);
      closeLaunchModal();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to launch game", status: "error" });
    }
  };

  const handleLaunchLauncher = (uri: string) => {
    window.open(uri);
    closeLaunchModal();
  };

  return (
    <LaunchContext.Provider value={{ openLaunchModal, launchById, runningGames }}>
      {children}
      <LaunchModal
        game={game}
        launchPath={launchPath}
        onClose={closeLaunchModal}
        onEditPath={handlePickExePath}
        onLaunch={handleLaunchGame}
        onLaunchLauncher={handleLaunchLauncher}
      />
    </LaunchContext.Provider>
  );
}

export function useLaunchGame(): LaunchContextValue {
  const ctx = useContext(LaunchContext);
  if (!ctx) throw new Error("useLaunchGame must be used inside LaunchProvider");
  return ctx;
}
