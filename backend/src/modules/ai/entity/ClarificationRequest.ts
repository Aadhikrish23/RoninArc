// TEMP DEBUG ONLY

import { ClarificationType } from "./ClarificationType";
import { ClarificationOption } from "./ClarificationOption";

export interface ClarificationRequest {
  requestId: string;
  type: ClarificationType;
  reason: string;
  entityType: string;
  originalQuery: string;
  candidates: ClarificationOption[];
}
