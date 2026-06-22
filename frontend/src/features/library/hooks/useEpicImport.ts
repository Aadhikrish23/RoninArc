import libraryApi from "../api/libraryApi";
import type { AddGamePayload } from "../types/library";

export async function importEpicGames(
  epicGames: any[]
) {
  for (const epicGame of epicGames) {
    const results =
      await libraryApi.searchRawgGames(
        epicGame.name
      );

    if (!results.length) {
      continue;
    }

    const rawg = results[0];

    const payload: AddGamePayload = {
      rawgId: rawg.id,
      title: rawg.name,
      description: rawg.description,
      imageURL: rawg.imageURL,
      exePath: epicGame.executable,
      tags: rawg.genres,
      status: "plan",
    };

    try {
      await libraryApi.addGame(
        payload
      );
    } catch {
      console.log(
        `${rawg.name} already exists`
      );
    }
  }
}