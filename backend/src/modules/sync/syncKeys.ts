/** How sync decides two documents are the same thing. No models here, so it can be tested alone. */

/** One filter per natural key this document has, in the order to try them. */
export const naturalFilters = (coll: { naturalKeys?: string[] }, doc: any): Record<string, unknown>[] =>
  (coll.naturalKeys ?? []).filter((k) => doc[k] !== undefined && doc[k] !== null).map((k) => ({ [k]: doc[k] }));

/** The same game found by one id may only know the other: the merged version keeps both. */
export const keepGameDbIds = (winner: any, loser: any) => ({
  ...winner,
  ...(winner.igdbId == null && loser.igdbId != null ? { igdbId: loser.igdbId } : {}),
  ...(winner.rawgId == null && loser.rawgId != null ? { rawgId: loser.rawgId } : {}),
});
