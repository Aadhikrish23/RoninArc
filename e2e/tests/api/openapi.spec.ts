import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import { test, expect } from "../../fixtures/test";
import { json } from "../../helpers/api";
import { createAjv, schemaFor } from "../../helpers/contract";
import { API_URL, LOG_DIR } from "../../env";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

async function loadSpec(): Promise<any> {
  return (await fetch(`${API_URL}/api/docs.json`)).json();
}

/** Every `METHOD /path` the Express app actually serves (params normalised to `{}`). */
function appRoutes(specPrefixes: string[]): { routes: Set<string>; unmounted: string[] } {
  process.env.LOG_DIR ??= LOG_DIR;
  // The compiled backend (built by the webServer step) -- importing the app
  // builds its routers without connecting to a database or listening.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const app = require(path.resolve(__dirname, "../../../backend/dist/app.js")).default;
  const norm = (p: string) => p.replace(/:[A-Za-z0-9_]+/g, "{}").replace(/\/$/, "") || "/";
  const routes = new Set<string>();
  const unmounted: string[] = [];

  for (const layer of app.router.stack) {
    if (layer.route) {
      for (const m of Object.keys(layer.route.methods)) routes.add(`${m.toUpperCase()} ${norm(layer.route.path)}`);
      continue;
    }
    const inner = layer.handle?.stack;
    if (!inner) continue;
    // Express 5 doesn't keep a router's mount path; find which documented prefix it answers to.
    const prefix = specPrefixes.find((p) => layer.match(p));
    const innerRoutes = inner.filter((l: any) => l.route);
    if (!prefix) {
      if (innerRoutes.length) unmounted.push(innerRoutes.map((l: any) => l.route.path).join(", "));
      continue;
    }
    for (const l of innerRoutes) {
      for (const m of Object.keys(l.route.methods)) routes.add(`${m.toUpperCase()} ${norm(prefix + l.route.path)}`);
    }
  }
  return { routes, unmounted };
}

test.describe("OpenAPI documentation (/api/docs)", () => {
  test("serves a valid OpenAPI 3.1 document @positive", async ({ anon }) => {
    const res = await anon.get("/api/docs.json");
    expect(res.status()).toBe(200);
    const spec = await json(res);
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.servers).toEqual([{ url: "/", description: "This server" }]);
    await SwaggerParser.validate(structuredClone(spec));
  });

  test("the interactive Swagger UI is served @positive", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/docs/`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("swagger-ui");
    expect(html).toContain("RoninArc API");
  });

  test("every route the server exposes is documented, and every documented route exists @positive", async () => {
    const spec = await loadSpec();
    const documented = new Set<string>();
    for (const [p, ops] of Object.entries<any>(spec.paths)) {
      for (const m of METHODS) if (ops[m]) documented.add(`${m.toUpperCase()} ${p.replace(/\{[^}]+\}/g, "{}")}`);
    }
    const prefixes = Array.from(new Set(Object.keys(spec.paths).map((p) => `/${p.split("/")[1]}`)));
    const { routes, unmounted } = appRoutes(prefixes);

    expect(unmounted, "routers mounted under a prefix with no documented paths").toEqual([]);
    expect([...routes].filter((r) => !documented.has(r)).sort(), "served but undocumented").toEqual([]);
    expect([...documented].filter((r) => !routes.has(r)).sort(), "documented but not served").toEqual([]);
  });

  test("every operation is fully described @positive", async () => {
    const spec = await loadSpec();
    const problems: string[] = [];
    for (const [p, ops] of Object.entries<any>(spec.paths)) {
      for (const m of METHODS) {
        const op = ops[m];
        if (!op) continue;
        const where = `${m.toUpperCase()} ${p}`;
        if (!op.summary) problems.push(`${where}: no summary`);
        if (!op.tags?.length) problems.push(`${where}: no tag`);
        const codes = Object.keys(op.responses ?? {});
        if (!codes.some((c) => c.startsWith("2"))) problems.push(`${where}: no success response`);
        const secured = (op.security ?? []).some((s: any) => "BearerAuth" in s);
        const optionalAuth = (op.security ?? []).some((s: any) => Object.keys(s).length === 0);
        if (secured && !optionalAuth && !codes.includes("401")) problems.push(`${where}: secured but no 401`);
        for (const pathParamName of p.match(/\{([^}]+)\}/g) ?? []) {
          const name = pathParamName.slice(1, -1);
          if (!(op.parameters ?? []).some((x: any) => x.in === "path" && x.name === name)) problems.push(`${where}: path param ${name} undeclared`);
        }
        for (const [code, r] of Object.entries<any>(op.responses ?? {})) {
          if (!r.description) problems.push(`${where} ${code}: no description`);
          if (!r.content) problems.push(`${where} ${code}: no content`);
        }
        if (["post", "put", "patch"].includes(m) && op.requestBody && !op.requestBody.content?.["application/json"]?.schema) {
          problems.push(`${where}: request body without a schema`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("every documented example matches its own schema @negative", async () => {
    const spec = await loadSpec();
    const ajv = createAjv(spec);
    const problems: string[] = [];
    for (const [p, ops] of Object.entries<any>(spec.paths)) {
      for (const m of METHODS) {
        const op = ops[m];
        if (!op) continue;
        const media = [
          ...Object.entries<any>(op.responses ?? {}).map(([code, r]) => [`${code}`, r.content?.["application/json"]] as const),
          ["request", op.requestBody?.content?.["application/json"]] as const,
        ];
        for (const [label, content] of media) {
          if (!content?.schema) continue;
          const examples = [content.example, ...Object.values<any>(content.examples ?? {}).map((e) => e.value)].filter((e) => e !== undefined);
          if (examples.length === 0) continue;
          const validate = schemaFor(ajv, content.schema);
          for (const ex of examples) {
            if (!validate(ex)) problems.push(`${m.toUpperCase()} ${p} ${label}: ${ajv.errorsText(validate.errors)}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("documents the three error envelopes and bearer auth @positive", async () => {
    const spec = await loadSpec();
    expect(Object.keys(spec.components.schemas)).toEqual(expect.arrayContaining(["AppError", "FailedResponse", "AIChatInvalid"]));
    expect(spec.components.securitySchemes.BearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
  });
});
