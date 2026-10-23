import type { Rule } from "./rate-limit";

// Budgets for the public demo. Per-IP limits stop one visitor from hogging
// the shared free-tier quota; global caps bound the worst case per day.

export const GENERATE_LIMITS: Rule[] = [
  { name: "generate", limit: 10, windowSec: 600, scope: "ip" },
  { name: "generate", limit: 300, windowSec: 86_400, scope: "global" },
];

// Creating a meeting costs no tokens, but every one is stored.
export const CREATE_LIMITS: Rule[] = [
  { name: "create", limit: 30, windowSec: 3600, scope: "ip" },
  { name: "create", limit: 1000, windowSec: 86_400, scope: "global" },
];
