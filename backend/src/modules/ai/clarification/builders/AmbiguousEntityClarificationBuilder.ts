import { PlanningResult } from "../../planning/PlanningResult";
import { ClarificationRequest } from "../../entity/ClarificationRequest";
import { ClarificationType } from "../ClarificationType";
import clarificationTemplateRegistry from "../ClarificationTemplateRegistry";
import clarificationOptionBuilder from "../ClarificationOptionBuilder";
import aiTraceLogger from "../../debug/AITraceLogger";
import crypto from "crypto";

export class AmbiguousEntityClarificationBuilder {
  /**
   * Builds clarification request for ambiguous entity resolutions.
   */
  build(planningResult: PlanningResult, userId: string): ClarificationRequest | null {
    if (!planningResult.clarificationRequest) return null;

    const origReq = planningResult.clarificationRequest;
    const type = ClarificationType.AMBIGUOUS_ENTITY;

    const question = clarificationTemplateRegistry.getQuestion(type, {
      originalQuery: origReq.originalQuery,
      entityType: origReq.entityType,
    });

    const options = (origReq.candidates || []).map((c) =>
      clarificationOptionBuilder.build(c, origReq.entityType)
    );

    const allowFreeText = true;
    const trace = aiTraceLogger.current();
    if (trace) {
      trace.log("ClarificationRuntime", "Template Selected", { type });
      trace.log("ClarificationRuntime", "Question Generated", { question });
      trace.log("ClarificationRuntime", "Option Count", { count: options.length });
    }

    const uuid = origReq.requestId || crypto.randomUUID();

    return {
      id: uuid,
      requestId: uuid,
      type,
      question,
      reason: origReq.reason || `Multiple matches found for "${origReq.originalQuery}"`,
      entityType: origReq.entityType,
      originalQuery: origReq.originalQuery,
      candidates: options,
      options,
      allowFreeText,
      metadata: { userId },
    };
  }
}

export default new AmbiguousEntityClarificationBuilder();
