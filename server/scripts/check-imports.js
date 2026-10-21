// Static sanity check that needs no installed packages: every relative import must resolve to a
// file and every named import must be exported by that file. (Does not replace running the tests.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skip = new Set(["node_modules", "uploads", "coverage", ".git"]);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".js")) files.push(p);
  }
})(root);

const exportsOf = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const n = part.trim().split(/\s+as\s+/).pop();
      if (n) names.add(n);
    }
  }
  if (/export\s+default\s/.test(src)) names.add("default");
  return names;
};

let problems = 0;
const report = (f, msg) => { problems += 1; console.log(`${path.relative(root, f)}: ${msg}`); };

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const importRe = /^import\s+([^"';]*?)\s+from\s+["'](\.[^"']+)["']/gm;
  for (const m of src.matchAll(importRe)) {
    const [, clause, spec] = m;
    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { report(file, `cannot resolve ${spec}`); continue; }
    const exp = exportsOf(fs.readFileSync(target, "utf8"));
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      for (const part of named[1].split(",")) {
        const n = part.trim().split(/\s+as\s+/)[0];
        if (n && !exp.has(n)) report(file, `'${n}' is not exported by ${spec}`);
      }
    }
    const def = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
    if (def && !def.startsWith("*") && !exp.has("default")) report(file, `${spec} has no default export`);
  }
}
console.log(problems ? `${problems} problem(s) found` : `OK - checked ${files.length} files`);
process.exit(problems ? 1 : 0);
