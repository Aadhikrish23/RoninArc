import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, HStack, Text, useToast } from "@chakra-ui/react";

import recommendationApi from "../api/recommendationApi";
import type { Recommendation, RecommendationResult } from "../types/recommendation";
import { useLibrary } from "../../library/hooks/useLibrary";
import { getErrorMessage } from "../../../shared/utils/error";

export function useRecommendations(options: { limit: number; q?: string }) {
  const toast = useToast();
  const { addGame, updateStatus } = useLibrary();
  const [data, setData] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await recommendationApi.getRecommendations({ limit: options.limit, q: options.q || undefined });
      // Ignore responses that arrive after a newer request (e.g. fast typing).
      if (requestId === requestRef.current) setData(result);
    } catch (err) {
      if (requestId === requestRef.current) setError(getErrorMessage(err));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [options.limit, options.q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const removeLocally = (rec: Recommendation) =>
    setData((prev) =>
      prev
        ? {
            ...prev,
            backlog: prev.backlog.filter((r) => r !== rec),
            discover: prev.discover.filter((r) => r !== rec),
          }
        : prev,
    );

  const dismiss = async (rec: Recommendation) => {
    if (!rec.rawgId) return;
    removeLocally(rec);
    try {
      await recommendationApi.dismiss(rec.rawgId, rec.title);
      toast({
        duration: 6000,
        render: ({ onClose }) => (
          <Box role="status" bg="gray.800" color="white" px={4} py={3} borderRadius="lg" boxShadow="lg">
            <HStack spacing={4} justify="space-between">
              <Text fontSize="sm">We won't suggest {rec.title} again.</Text>
              <Button
                size="sm"
                variant="outline"
                colorScheme="whiteAlpha"
                onClick={() => {
                  onClose();
                  undoDismiss(rec);
                }}
              >
                Undo
              </Button>
            </HStack>
          </Box>
        ),
      });
    } catch (err) {
      toast({ title: "Couldn't hide that game", description: getErrorMessage(err), status: "error" });
      refresh();
    }
  };

  const undoDismiss = async (rec: Recommendation) => {
    if (!rec.rawgId) return;
    await recommendationApi.undoDismiss(rec.rawgId);
    refresh();
  };

  const addToLibrary = async (rec: Recommendation) => {
    if (!rec.rawgId) return;
    try {
      await addGame({
        rawgId: rec.rawgId,
        title: rec.title,
        description: "",
        imageURL: rec.imageURL ?? "",
        exePath: "",
        tags: rec.genres,
        progressStatus: "plan",
      });
      refresh();
    } catch (err) {
      toast({ title: "Couldn't add game", description: getErrorMessage(err), status: "error" });
    }
  };

  const startPlaying = async (rec: Recommendation) => {
    if (!rec.gameId) return;
    try {
      await updateStatus(rec.gameId, "playing");
      removeLocally(rec);
      toast({ title: `Enjoy ${rec.title}!`, description: "Moved to Continue Playing.", status: "success", duration: 3000 });
    } catch (err) {
      toast({ title: "Couldn't update status", description: getErrorMessage(err), status: "error" });
    }
  };

  return { data, loading, error, refresh, dismiss, undoDismiss, addToLibrary, startPlaying };
}
