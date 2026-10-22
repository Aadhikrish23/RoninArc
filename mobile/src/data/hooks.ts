import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ChatResponse, type Collection, type DashboardOverview, type Game, type Note, type RawgResult, type Recommendation, type Review } from "@/api/client";
import type { ProgressStatus } from "@/ui/theme";

/** Everything that shows library data; refreshed after any change. */
const LIBRARY_KEYS = [["games"], ["game"], ["collections"], ["dashboard"], ["recommendations"], ["notes"], ["review"]];

export function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () => Promise.all(LIBRARY_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export const useGames = () => useQuery({ queryKey: ["games"], queryFn: () => api<Game[]>("/game") });

export const useGame = (id: string) => useQuery({ queryKey: ["game", id], queryFn: () => api<Game>(`/game/${id}`), enabled: !!id });

export const useNotes = (gameId: string) => useQuery({ queryKey: ["notes", gameId], queryFn: () => api<Note[]>(`/notes/${gameId}`), enabled: !!gameId });

export const useReview = (gameId: string) =>
  useQuery({
    queryKey: ["review", gameId],
    queryFn: () => api<Review | null>(`/review/${gameId}`).catch((e) => (e?.status === 404 ? null : Promise.reject(e))),
    enabled: !!gameId,
  });

export const useCollections = () => useQuery({ queryKey: ["collections"], queryFn: () => api<Collection[]>("/collection") });

export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardOverview>("/dashboard/overview") });

export const useRecommendations = (query?: string) =>
  useQuery({
    queryKey: ["recommendations", query ?? ""],
    queryFn: () => api<{ backlog: Recommendation[]; discover: Recommendation[]; discoverError?: string }>(`/recommendations${query ? `?q=${encodeURIComponent(query)}` : ""}`, { timeoutMs: 45_000 }),
  });

export const useRawgSearch = (query: string) =>
  useQuery({
    queryKey: ["rawg", query],
    queryFn: () => api<{ owned: RawgResult[]; discover: RawgResult[] }>(`/rawg/search?query=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

function useLibraryMutation<A, R = unknown>(fn: (args: A) => Promise<R>) {
  const invalidate = useInvalidateLibrary();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate() });
}

export const useSetStatus = () => useLibraryMutation(({ id, status }: { id: string; status: ProgressStatus }) => api(`/game/${id}`, { method: "PATCH", body: { progressStatus: status } }));

export const useAddGame = () =>
  useLibraryMutation((g: RawgResult) =>
    api<Game>("/game/add", {
      method: "POST",
      body: { rawgId: g.id, title: g.name, imageURL: g.imageURL ?? "", tags: g.genres ?? [], description: "", exePath: "", progressStatus: "plan" },
    }),
  );

export const useRemoveGame = () => useLibraryMutation((id: string) => api(`/game/${id}`, { method: "DELETE" }));

export const useSaveReview = () =>
  useLibraryMutation(({ gameId, rating, reviewText }: { gameId: string; rating: number; reviewText?: string }) =>
    api(`/review/${gameId}`, { method: "PUT", body: { rating, ...(reviewText !== undefined ? { reviewText } : {}) } }),
  );

export const useDeleteReview = () => useLibraryMutation((gameId: string) => api(`/review/${gameId}`, { method: "DELETE" }));

export const useAddNote = () => useLibraryMutation(({ gameId, content }: { gameId: string; content: string }) => api(`/notes/${gameId}`, { method: "POST", body: { content } }));

export const useDeleteNote = () => useLibraryMutation((noteId: string) => api(`/notes/${noteId}`, { method: "DELETE" }));

export const useCreateCollection = () => useLibraryMutation((name: string) => api<Collection>("/collection", { method: "POST", body: { name, description: "" } }));

export const useToggleInCollection = () =>
  useLibraryMutation(({ collectionId, gameId, add }: { collectionId: string; gameId: string; add: boolean }) =>
    add ? api(`/collection/${collectionId}/games`, { method: "POST", body: { gameId } }) : api(`/collection/${collectionId}/games/${gameId}`, { method: "DELETE" }),
  );

export const useDismissRecommendation = () => useLibraryMutation((rawgId: number) => api("/recommendations/dismiss", { method: "POST", body: { rawgId } }));

export async function sendChat(message: string): Promise<ChatResponse> {
  // The phone can't launch games; the assistant says so instead of trying.
  return api<ChatResponse>("/ai/chat", { method: "POST", body: { message, client: { canLaunchGames: false } }, timeoutMs: 90_000 });
}

export const resetChat = () => api("/ai/reset", { method: "POST" });

/** "4h 20m" */
export function formatMinutes(min: number): string {
  if (!min) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
