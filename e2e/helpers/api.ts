import { APIRequestContext, APIResponse, expect } from "@playwright/test";
import { CATALOG } from "../fixtures/catalog.mjs";

export type CatalogGame = (typeof CATALOG)[number];

let counter = 0;

/** Unique, lowercase (the backend lowercases usernames), >= 3 chars. */
export function uniqueName(prefix = "user"): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}${Date.now().toString(36)}${counter}${rand}`.toLowerCase();
}

export const DEFAULT_PASSWORD = "Sup3rSecret!";

export interface RegisteredUser {
  username: string;
  password: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  userdata: { name: string; email: string; updatedAt: string };
}

export async function registerUser(
  request: APIRequestContext,
  baseURL: string,
  overrides: Partial<{ username: string; password: string; email: string }> = {},
): Promise<RegisteredUser> {
  const username = overrides.username ?? uniqueName();
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const email = overrides.email ?? `${username}@example.com`;
  const res = await request.post(`${baseURL}/auth/register`, { data: { username, password, email } });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  return { username, password, email, ...body.Data };
}

/** Thin wrapper that attaches the bearer token to every call. */
export class Api {
  constructor(
    readonly request: APIRequestContext,
    readonly baseURL: string,
    public token?: string,
  ) {}

  private headers(extra?: Record<string, string>) {
    return { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...extra };
  }

  get(path: string, params?: Record<string, string | number>) {
    return this.request.get(this.baseURL + path, { headers: this.headers(), params });
  }
  post(path: string, data?: unknown) {
    return this.request.post(this.baseURL + path, { headers: this.headers(), data });
  }
  put(path: string, data?: unknown) {
    return this.request.put(this.baseURL + path, { headers: this.headers(), data });
  }
  patch(path: string, data?: unknown) {
    return this.request.patch(this.baseURL + path, { headers: this.headers(), data });
  }
  delete(path: string, data?: unknown) {
    return this.request.delete(this.baseURL + path, { headers: this.headers(), data });
  }

  /** Adds a catalog game to the library and returns the created document. */
  async addGame(game: CatalogGame, overrides: Record<string, unknown> = {}) {
    const res = await this.post("/game/add", {
      rawgId: game.id,
      title: game.name,
      description: game.description,
      imageURL: game.image,
      exePath: "",
      tags: game.genres,
      progressStatus: "plan",
      ...overrides,
    });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).Data as { _id: string; title: string; rawgId: number; progressStatus: string; tags: string[] };
  }

  async createCollection(name: string, description = "") {
    const res = await this.post("/collection", { name, description });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).Data as { _id: string; name: string; gameIds: unknown[] };
  }
}

export async function json(res: APIResponse) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON, got ${res.status()}: ${text.slice(0, 200)}`);
  }
}

/** A syntactically valid ObjectId that will never exist. */
export const MISSING_ID = "64b000000000000000000000";
