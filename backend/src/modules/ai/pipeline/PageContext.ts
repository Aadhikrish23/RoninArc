import { Types } from "mongoose";
import LibraryGame from "../../library/LibraryGame";
import CollectionModel from "../../collection/CollectionModel";
import type { AIClientCapabilities } from "../sdk/AIToolContext";

export interface PageContext {
  gameTitle?: string;
  collectionName?: string;
}

/** Titles for the page the user has open, if it's theirs ("this game" / "this collection"). */
export async function resolvePage(userId: string, client: AIClientCapabilities): Promise<PageContext> {
  const page: PageContext = {};
  try {
    const uid = new Types.ObjectId(userId);
    if (client.pageGameId) {
      const id = client.pageGameId;
      const or: any[] = [];
      if (Types.ObjectId.isValid(id) && id.length === 24) or.push({ _id: id });
      if (/^\d+$/.test(id)) or.push({ rawgId: Number(id) });
      const game = or.length ? await LibraryGame.findOne({ userId: uid, $or: or }).select("title").lean() : null;
      if (game) page.gameTitle = (game as any).title;
    }
    if (client.pageCollectionId && Types.ObjectId.isValid(client.pageCollectionId)) {
      const col = await CollectionModel.findOne({ _id: client.pageCollectionId, userId: uid }).select("name").lean();
      if (col) page.collectionName = (col as any).name;
    }
  } catch {
    // page context is a hint; never fail the request over it
  }
  return page;
}
