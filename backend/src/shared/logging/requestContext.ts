import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
  userId?: string;
}

// Carries the current request's id through async calls, so every log line
// written while handling a request can be correlated without passing it around.
export const requestContext = new AsyncLocalStorage<RequestContext>();

export const currentRequestId = () => requestContext.getStore()?.requestId;
