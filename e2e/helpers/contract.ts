import type { APIResponse } from "@playwright/test";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { API_URL } from "../env";

// Every API response made through the `Api` helper is checked against the
// OpenAPI document the backend serves: an undocumented status code or a body
// that doesn't match its schema fails the test. This keeps /api/docs honest.

type Operation = { responses: Record<string, { content?: Record<string, { schema?: unknown }> }> };
interface Route {
  template: string;
  regex: RegExp;
  staticSegments: number;
  methods: Record<string, Operation>;
}

let loaded: Promise<{ routes: Route[]; ajv: Ajv2020 }> | null = null;
const validators = new Map<string, ValidateFunction>();

export const SPEC_ID = "roninarc-openapi";

function rewriteRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) =>
        k === "$ref" && typeof v === "string" && v.startsWith("#/") ? [k, `${SPEC_ID}${v}`] : [k, rewriteRefs(v)],
      ),
    );
  }
  return node;
}

export function compileTemplate(template: string): RegExp {
  const pattern = template
    .split("/")
    .map((seg) => (/^\{.+\}$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${pattern}/?$`);
}

export function createAjv(spec: any): Ajv2020 {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema({ $id: SPEC_ID, components: rewriteRefs(spec.components) });
  return ajv;
}

export function schemaFor(ajv: Ajv2020, schema: unknown): ValidateFunction {
  return ajv.compile(rewriteRefs(schema) as object);
}

async function load() {
  if (!loaded) {
    loaded = (async () => {
      const res = await fetch(`${API_URL}/api/docs.json`);
      const spec = await res.json();
      const routes: Route[] = Object.entries(spec.paths as Record<string, Record<string, Operation>>).map(([template, methods]) => ({
        template,
        regex: compileTemplate(template),
        staticSegments: template.split("/").filter((s) => s && !s.startsWith("{")).length,
        methods,
      }));
      // Most specific first, so /game/filter/search wins over /game/{gameid}.
      routes.sort((a, b) => b.staticSegments - a.staticSegments);
      return { routes, ajv: createAjv(spec) };
    })();
  }
  return loaded;
}

export async function verifyResponse(method: string, url: string, res: APIResponse): Promise<void> {
  const { routes, ajv } = await load();
  const path = new URL(url).pathname;
  const route = routes.find((r) => r.regex.test(path));
  if (!route) return; // Not an API route (e.g. a deliberate 404 probe); coverage is tested separately.

  const m = method.toLowerCase();
  const operation = route.methods[m];
  const where = `${method.toUpperCase()} ${route.template}`;
  if (!operation) throw new Error(`[contract] ${where} is not documented (called ${path}).`);

  const status = String(res.status());
  const documented = operation.responses[status] ?? operation.responses.default;
  if (!documented) {
    throw new Error(
      `[contract] ${where} returned ${status}, which isn't documented (documented: ${Object.keys(operation.responses).join(", ")}). Body: ${(await res.text()).slice(0, 300)}`,
    );
  }

  const contentType = res.headers()["content-type"] ?? "";
  if (!documented.content) return;
  if (contentType.includes("text/html")) {
    if (!documented.content["text/html"]) throw new Error(`[contract] ${where} ${status} returned HTML, but only ${Object.keys(documented.content)} is documented.`);
    return;
  }
  const schema = documented.content["application/json"]?.schema;
  if (!schema) return;

  const key = `${where} ${status}`;
  let validate = validators.get(key);
  if (!validate) {
    validate = schemaFor(ajv, schema);
    validators.set(key, validate);
  }
  const body = JSON.parse(await res.text());
  if (!validate(body)) {
    const errors = (validate.errors ?? []).slice(0, 5).map((e) => `${e.instancePath || "(root)"} ${e.message}`).join("; ");
    throw new Error(`[contract] ${where} ${status} body doesn't match the documented schema: ${errors}. Body: ${JSON.stringify(body).slice(0, 400)}`);
  }
}
