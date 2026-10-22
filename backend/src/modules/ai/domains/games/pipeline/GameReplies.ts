import { IntentType } from "../intent/IntentType";
import { IntentTargetType } from "../../../intent/IntentTargetType";
import { IntentPlan } from "../../../intent/IntentPlan";
import pendingConfirmations from "../../../conversation/PendingConfirmationStore";
import { confirmationResponse, type RuntimeResponse } from "../../../pipeline/Replies";
import { writtenFor } from "../conversation/DirectActions";
import { OFFER_ADD } from "./Patterns";

/** "Added X as Plan to Play. I've marked X as Completed." reads as one step: "Added X as Completed." */
export function tidyReply(message: string): string {
  if (typeof message !== "string") return message;
  return message.replace(
    /I've added (.+?) to your library as Plan to Play\. I've marked \1 as ([A-Za-z ]+?)\.( Congrats on finishing it!)?/g,
    (_m, title, status, congrats) => `I've added ${title} to your library as ${status}.${congrats ?? ""}`,
  );
}

/** "I can add Silksong to your library if you like" -- make "ok" work by remembering the offer. */
export function rememberOfferedAdd(userId: string, requestId: string, message: string) {
  const offered = typeof message === "string" ? message.match(OFFER_ADD) : null;
  if (!offered || pendingConfirmations.has(userId)) return;
  const title = offered[1].replace(/^"|"$/g, "").trim();
  pendingConfirmations.put(userId, {
    plan: { id: requestId, requestId, intents: [{ type: IntentType.AddGame, targets: [{ type: IntentTargetType.Library, name: title }], parameters: [] } as any] },
    label: title,
    cancelMessage: `Okay, I won't add ${title}.`,
  });
}

/** A confirmation card for removals, with the exact titles so "yes" removes exactly what was named. */
export async function askBeforeRemoving(
  intentPlan: IntentPlan,
  resolvedIntentPlan: any,
  { userId, requestId, message }: { userId: string; requestId: string; message: string },
): Promise<RuntimeResponse | undefined> {
  const removals = resolvedIntentPlan.intents.filter((i: any) => i.type === IntentType.RemoveGame);
  const titles: string[] = removals.flatMap((i: any) =>
    i.resolvedTargets.map((t: any) => t.resolution?.entity?.title).filter((title: unknown): title is string => !!title),
  );
  if (titles.length === 0) return undefined;

  const titleByName = new Map<string, string>();
  for (const removal of removals) {
    for (const rt of removal.resolvedTargets) {
      const title = rt.resolution?.entity?.title;
      if (title) titleByName.set(rt.originalTarget.name, title);
    }
  }
  const exactPlan: IntentPlan = JSON.parse(JSON.stringify(intentPlan));
  for (const intent of exactPlan.intents) {
    if (intent.type !== IntentType.RemoveGame) continue;
    intent.targets = intent.targets.map((t) => ({ ...t, name: titleByName.get(t.name) ?? t.name }));
  }
  const label = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  pendingConfirmations.put(userId, { plan: exactPlan, label });
  // Only warn about a review or notes that actually exist.
  const written = await writtenFor(userId, titles);
  const question = `Remove ${label} from your library?${written ? ` ${titles.length === 1 ? "Its" : "Their"} ${written} will be deleted too.` : ""}`;
  // Re-adding a game is easy; what can't come back is what the user wrote about it.
  const reason = written ? `You can add it back later, but the ${written} can't be recovered.` : "You can add it back any time.";
  return confirmationResponse(requestId, message, question, "Yes, remove it", reason);
}
