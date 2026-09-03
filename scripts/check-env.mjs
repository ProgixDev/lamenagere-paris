/**
 * Prints the resolved environment matrix and fails on a tier mismatch.
 *
 * The mistake this guards is the one that has already happened twice here: a
 * publishable key and an API URL drifting apart, so the app talks to a live
 * server with a test key (payment sheet can never confirm) or to localhost
 * with a live key (real cards, from a laptop). The pairing is checkable —
 * both halves announce their tier, the URL by host and the key by prefix —
 * so nobody should have to hold it in their head.
 *
 * Reads the local .env plus every EAS environment (`eas env:list`), which is
 * why it is slow-ish and not wired into a build. Run it before an OTA or a
 * store build: `npm run env:check`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

/** Which tier a value belongs to, or null when it carries no tier marker. */
const keyTier = (v) =>
  v?.startsWith("pk_live_") ? "production" : v?.startsWith("pk_test_") ? "development" : null;
const urlTier = (v) =>
  !v ? null : /localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|^http:\/\/\d/.test(v) ? "development" : "production";

function parseEnvFile(path) {
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

function readEasEnv(name) {
  try {
    const raw = execFileSync("eas", ["env:list", "--environment", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseEnvFileFromLines(raw);
  } catch {
    return null;
  }
}

function parseEnvFileFromLines(raw) {
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^(EXPO_PUBLIC_[A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const abbrev = (v) =>
  !v ? "(unset)" : v.length > 44 ? `${v.slice(0, 30)}…${v.slice(-6)}` : v;

// `expected` is the tier each source is supposed to be; null means "no opinion"
// (preview intentionally mirrors production today — see ENVIRONMENTS.md).
const SOURCES = [
  { label: ".env (local Metro)", expected: "development", vars: parseEnvFile(new URL("../.env", import.meta.url).pathname) },
  { label: "EAS development", expected: "development", vars: readEasEnv("development") },
  { label: "EAS preview", expected: null, vars: readEasEnv("preview") },
  { label: "EAS production", expected: "production", vars: readEasEnv("production") },
];

const problems = [];

for (const { label, expected, vars } of SOURCES) {
  console.log(`\n\x1b[1m${label}\x1b[0m${expected ? `  → expects ${expected}` : ""}`);
  if (!vars) {
    console.log("  (unreadable — is the eas CLI logged in?)");
    continue;
  }
  const api = vars.EXPO_PUBLIC_API_URL;
  const pk = vars.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  console.log(`  API    ${abbrev(api)}   [${urlTier(api) ?? "?"}]`);
  console.log(`  Stripe ${abbrev(pk)}   [${keyTier(pk) ?? "?"}]`);
  console.log(`  Supabase ${abbrev(vars.EXPO_PUBLIC_SUPABASE_URL)}`);

  if (pk && !keyTier(pk)) problems.push(`${label}: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not a pk_test_/pk_live_ key (${abbrev(pk)})`);
  if (!pk) problems.push(`${label}: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is unset`);
  if (!api) problems.push(`${label}: EXPO_PUBLIC_API_URL is unset`);

  // The pairing check: a test key can only confirm intents against a test
  // server, and every deployment serves exactly one tier.
  if (keyTier(pk) && urlTier(api) && keyTier(pk) !== urlTier(api))
    problems.push(`${label}: ${urlTier(api)} API (${abbrev(api)}) paired with a ${keyTier(pk)} Stripe key — checkout cannot work`);

  if (expected && keyTier(pk) && keyTier(pk) !== expected)
    problems.push(`${label}: expected a ${expected} Stripe key, found ${keyTier(pk)}`);
}

if (problems.length) {
  console.error(`\n\x1b[31m✖ ${problems.length} problem(s)\x1b[0m`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\n\x1b[32m✔ every environment is internally consistent\x1b[0m");
