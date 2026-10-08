// Imported first by server.ts: loads env and starts logging/error tracking
// before any other module runs, so even startup failures are captured.
import dotenv from "dotenv";
dotenv.config();

import { bridgeConsole } from "./shared/logging/logger";
import { initSentry } from "./shared/logging/errorReporter";

initSentry();
bridgeConsole();
