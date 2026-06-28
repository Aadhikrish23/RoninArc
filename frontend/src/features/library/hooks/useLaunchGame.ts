import { useEffect, useState } from "react";
import { useToast } from "@chakra-ui/react";

import libraryApi from "../api/libraryApi";
import activityApi from "../../activity/api/activityApi";
import { usePlaySession } from "../../playSession/hooks/usePlaySession";
import { resolveLaunch } from "../utils/launch";

import type { Game } from "../types/library";

export function useLaunchGame() {
  const toast = useToast();

  const { startSession, endSession } = usePlaySession();

  const [game, setGame] = useState<Game | null>(null);

  const [launchPath, setLaunchPath] = useState("");

  const [runningGames, setRunningGames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!window.electronAPI?.onGameExited) return;

    const unsubscribe = window.electronAPI.onGameExited(async (gameId) => {
      try {
        await endSession(gameId);

        setRunningGames((prev) => {
          const next = new Set(prev);
          next.delete(gameId);
          return next;
        });

        toast({
          title: "Play session ended",
          status: "success",
        });
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsubscribe();
  }, [endSession, toast]);

  const openLaunchModal = (selectedGame: Game) => {
    const resolved = resolveLaunch(selectedGame);

    setGame(selectedGame);

    setLaunchPath(resolved.path);
  };

  const closeLaunchModal = () => {
    setGame(null);
    setLaunchPath("");
  };

  const handlePickExePath = async () => {
    if (!game) return;

    const selected = await window.electronAPI?.selectExePath();

    if (!selected) return;

    await libraryApi.updateGame(game._id, {
      exePath: selected,
    });

    setLaunchPath(selected);

    setGame({
      ...game,
      exePath: selected,
    });

    toast({
      title: "Launch path updated",
      status: "success",
    });
  };

  const handleLaunchGame = async () => {
    if (!game) return;

    if (!launchPath) {
      toast({
        title: "No executable selected",
        status: "warning",
      });

      return;
    }

    try {
      await startSession(game._id);

      setRunningGames((prev) => {
        const next = new Set(prev);
        next.add(game._id);
        return next;
      });

      await window.electronAPI?.launchGame(game._id, launchPath);

      await activityApi.recordLaunch(game._id);

      toast({
        title: `Launching ${game.title}`,
        status: "success",
      });

      closeLaunchModal();
    } catch (err) {
      console.error(err);

      toast({
        title: "Failed to launch game",
        status: "error",
      });
    }
  };

  const handleLaunchLauncher = (uri: string) => {
    window.open(uri);

    closeLaunchModal();
  };

  return {
    openLaunchModal,

    closeLaunchModal,

    runningGames,

    modalProps: {
      game,
      launchPath,
      onClose: closeLaunchModal,
      onEditPath: handlePickExePath,
      onLaunch: handleLaunchGame,
      onLaunchLauncher: handleLaunchLauncher,
    },
  };
}