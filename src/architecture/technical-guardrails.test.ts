import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type AllowlistEntry = {
  reason: string;
  removalCondition: string;
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const normalizePath = (path: string) => path.replaceAll("\\", "/");

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    return statSync(absolutePath).isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

function importsSupabaseClient(filePath: string) {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  let found = false;
  const visit = (node: ts.Node) => {
    const isStaticImport = ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text === "@/integrations/supabase/client";
    const isDynamicImport = ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === "@/integrations/supabase/client";

    if (isStaticImport || isDynamicImport) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

describe("technical architecture guardrails", () => {
  it("rejects new direct Supabase imports from production pages", () => {
    const allowlistPath = join(repositoryRoot, "architecture/allowlists/pages-direct-supabase.json");
    const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8")) as Record<string, AllowlistEntry>;
    const directImports = walk(join(repositoryRoot, "src/pages"))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\.(ts|tsx)$/.test(file))
      .filter(importsSupabaseClient)
      .map((file) => normalizePath(relative(repositoryRoot, file)))
      .sort();

    expect(directImports).toEqual(Object.keys(allowlist).sort());
    for (const entry of Object.values(allowlist)) {
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(entry.removalCondition.length).toBeGreaterThan(20);
    }
  });

  it("keeps the TypeScript dependency graph free of circular imports", () => {
    const require = createRequire(import.meta.url);
    const madgeApiPath = require.resolve("madge");
    const madgeCliPath = resolve(dirname(madgeApiPath), "../bin/cli.js");

    expect(() => execFileSync(process.execPath, [
      madgeCliPath,
      "--circular",
      "--extensions",
      "ts,tsx",
      "--ts-config",
      "tsconfig.app.json",
      "src",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: "pipe",
    })).not.toThrow();
  }, 20_000);
});
