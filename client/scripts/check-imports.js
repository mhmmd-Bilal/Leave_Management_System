// Dependency-free static check: relative imports resolve, named imports are exported, and every
// bare import is declared in package.json. (Complements - does not replace - `npm run build`.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", "dist", "scripts"].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(p)) files.push(p);
  }
})(path.join(root, "src"));

const exportsOf = (src) => {
  const n = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/g)) n.add(m[1]);
  for (const m of src.matchAll(/export\s+const\s*\{([^}]*)\}/g)) m[1].split(",").forEach((x) => x.trim() && n.add(x.trim().split(":").pop().trim()));
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(",").forEach((x) => x.trim() && n.add(x.trim().split(/\s+as\s+/).pop()));
  if (/export\s+default\s/.test(src)) n.add("default");
  return n;
};

let problems = 0;
const bad = (f, m) => { problems += 1; console.log(`${path.relative(root, f)}: ${m}`); };
const pkgName = (s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0]);

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/^import\s+(?:([^"';]*?)\s+from\s+)?["']([^"']+)["']/gm)) {
    const [, clause = "", spec] = m;
    if (spec.startsWith(".")) {
      const target = path.resolve(path.dirname(file), spec);
      if (/\.(css|svg)$/.test(spec)) { if (!fs.existsSync(target)) bad(file, `missing asset ${spec}`); continue; }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { bad(file, `cannot resolve ${spec}`); continue; }
      const exp = exportsOf(fs.readFileSync(target, "utf8"));
      const named = clause.match(/\{([\s\S]*)\}/);
      if (named) named[1].split(",").forEach((x) => { const nm = x.trim().split(/\s+as\s+/)[0]; if (nm && !exp.has(nm)) bad(file, `'${nm}' is not exported by ${spec}`); });
      const def = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
      if (def && !def.startsWith("*") && !exp.has("default")) bad(file, `${spec} has no default export`);
    } else if (!declared.has(pkgName(spec))) bad(file, `package '${pkgName(spec)}' is not in package.json`);
  }
}
console.log(problems ? `${problems} problem(s)` : `OK - ${files.length} files checked`);
process.exit(problems ? 1 : 0);
