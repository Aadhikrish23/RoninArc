import { IntentTargetType } from "./IntentTargetType";

export interface IntentTarget {
  type: IntentTargetType;
  name: string;
  /**
   * The exact item, when the plan already knows it. Two owned games can share a title (God of War
   * from 2005 and from 2018), and a name alone can only ever reach one of them.
   */
  id?: string;
}
