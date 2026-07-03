// TEMP DEBUG ONLY

import aiTraceLogger from "../debug/AITraceLogger";

export interface LearnedAlias {
  normalizedQuery: string;
  canonicalEntityName: string;
  usageCount: number;
  lastUsed: Date;
}

export class EntityLearningResolver {
  // In-memory store: Map<userId, Map<normalizedQuery, LearnedAlias>>
  private readonly store = new Map<string, Map<string, LearnedAlias>>();

  /**
   * Resolves a learned alias for a specific user and query.
   */
  async resolve(userId: string, query: string): Promise<string | null> {
    const userStore = this.store.get(userId);
    if (!userStore) {
      return null;
    }
    const alias = userStore.get(query);
    if (!alias) {
      return null;
    }
    
    // TODO: Implement trust policy based on usageCount.
    // E.g., only trust if usageCount >= 3.
    // For now, return canonicalEntityName as the resolved value.
    return alias.canonicalEntityName;
  }

  /**
   * Records a user's selection to learn/strengthen an alias mapping.
   */
  async recordSelection(userId: string, query: string, canonicalEntityName: string): Promise<void> {
    let userStore = this.store.get(userId);
    if (!userStore) {
      userStore = new Map<string, LearnedAlias>();
      this.store.set(userId, userStore);
    }

    const existing = userStore.get(query);
    if (existing) {
      existing.usageCount += 1;
      existing.lastUsed = new Date();
      existing.canonicalEntityName = canonicalEntityName;
    } else {
      userStore.set(query, {
        normalizedQuery: query,
        canonicalEntityName,
        usageCount: 1,
        lastUsed: new Date(),
      });
    }

    const trace = aiTraceLogger.current();
    if (trace) {
      trace.log("EntityLearningResolver", "Learning Updated", {
        userId,
        query,
        selectedCandidate: canonicalEntityName,
        usageCount: existing ? existing.usageCount : 1,
      });
    }
  }

  /**
   * Clears learned aliases for a specific user.
   */
  async clear(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}

export default new EntityLearningResolver();
