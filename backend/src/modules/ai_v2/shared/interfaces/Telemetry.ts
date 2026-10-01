/**
 * Structure representing a telemetry or tracing log event.
 */
export interface TelemetryEvent {
  readonly eventName: string;
  readonly timestamp: number;
  readonly payload: Record<string, any>;
}
