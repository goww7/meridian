/**
 * update-repo-metadata.ts
 *
 * Updates descriptions and topics for all public repositories owned by `goww7`
 * using the GitHub REST API.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... npx tsx scripts/update-repo-metadata.ts
 *
 * Requirements:
 *   - Node.js 18+ (uses built-in fetch)
 *   - GITHUB_TOKEN env variable with `repo` scope
 */

const OWNER = "goww7";
const BASE_URL = "https://api.github.com";

interface RepoMeta {
  repo: string;
  description: string;
  topics: string[];
}

const repos: RepoMeta[] = [
  // Flagship / Public-facing
  {
    repo: "meridian",
    description:
      "Meridian — The Delivery Operating System for Software Teams",
    topics: [
      "project-management",
      "saas",
      "typescript",
      "nextjs",
      "developer-tools",
      "delivery-ops",
    ],
  },
  {
    repo: "yassir",
    description: "AI agent for deep financial research (Shariah-aware)",
    topics: [
      "ai-agent",
      "fintech",
      "halal-finance",
      "shariah",
      "typescript",
      "nextjs",
      "openai",
    ],
  },
  {
    repo: "halal-terminal-landing-page",
    description:
      "Halal Terminal — Shariah-compliant financial data platform landing page",
    topics: [
      "halal-finance",
      "fintech",
      "landing-page",
      "typescript",
      "nextjs",
      "islamic-finance",
    ],
  },
  {
    repo: "FinanceData2",
    description: "Financial data analysis tools and scripts",
    topics: [
      "finance",
      "python",
      "data-analysis",
      "stock-market",
      "fintech",
    ],
  },
  {
    repo: "Callify",
    description: "Callify — AI-powered intelligent calling platform",
    topics: ["ai", "voip", "saas", "typescript", "nextjs", "communications"],
  },
  {
    repo: "yb-consulting",
    description: "YB Consulting — Fire Safety & Audit website",
    topics: ["consulting", "typescript", "nextjs", "landing-page"],
  },

  // SaaS / Planiflex Series
  {
    repo: "planiflex-saas",
    description: "Planiflex — SaaS scheduling and planning platform",
    topics: ["saas", "typescript", "nextjs", "scheduling", "productivity"],
  },
  {
    repo: "planiflex-beta",
    description: "Planiflex beta — early access scheduling app",
    topics: ["saas", "typescript", "nextjs", "beta", "scheduling"],
  },
  {
    repo: "planiflex-dashboard",
    description: "Planiflex dashboard — analytics and management UI",
    topics: ["dashboard", "typescript", "nextjs", "saas", "analytics"],
  },
  {
    repo: "planiflex-dashboard-alpha",
    description: "Planiflex dashboard alpha version",
    topics: ["dashboard", "typescript", "nextjs", "alpha", "saas"],
  },
  {
    repo: "planiflex-saas-starter",
    description: "Planiflex SaaS boilerplate starter template",
    topics: [
      "saas",
      "starter-template",
      "typescript",
      "nextjs",
      "boilerplate",
    ],
  },

  // StockFlow Series
  {
    repo: "stockflowai-bot",
    description: "StockFlow AI — intelligent stock analysis bot",
    topics: [
      "ai",
      "fintech",
      "stock-market",
      "typescript",
      "nextjs",
      "trading",
    ],
  },
  {
    repo: "stockflow-ai-saas",
    description: "StockFlow AI SaaS platform",
    topics: ["saas", "fintech", "typescript", "nextjs", "ai", "trading"],
  },
  {
    repo: "stockflow-saas",
    description: "StockFlow — SaaS stock analysis platform",
    topics: ["saas", "fintech", "typescript", "stock-market"],
  },
  {
    repo: "stockflow-saas-starter",
    description: "StockFlow SaaS starter template",
    topics: ["saas", "starter-template", "fintech", "typescript"],
  },

  // BMS Series
  {
    repo: "bms-saas",
    description: "BMS — Business Management SaaS platform",
    topics: ["saas", "typescript", "nextjs", "business-management"],
  },
  {
    repo: "bms-saas-alpha",
    description: "BMS SaaS alpha version",
    topics: ["saas", "typescript", "alpha", "business-management"],
  },
  {
    repo: "bms-alpha-saas",
    description: "BMS alpha SaaS iteration",
    topics: ["saas", "typescript", "alpha", "business-management"],
  },

  // Community / Coalitions
  {
    repo: "Coalitions",
    description: "Coalitions — community collaboration platform",
    topics: ["community", "collaboration", "saas"],
  },
  {
    repo: "coalitions_MVP",
    description: "Coalitions MVP — minimum viable product build",
    topics: ["mvp", "community", "typescript", "nextjs"],
  },
  {
    repo: "Coalition_demo_trailer",
    description: "Coalitions demo trailer and landing page",
    topics: ["demo", "landing-page", "html", "community"],
  },

  // Tools / Misc
  {
    repo: "scrypt",
    description: "Scripting utilities and automation tools",
    topics: ["typescript", "automation", "utilities", "developer-tools"],
  },
  {
    repo: "Linkedin-Email-Finder",
    description: "LinkedIn email finder automation script",
    topics: ["javascript", "automation", "linkedin", "scraping"],
  },
  {
    repo: "morphic-ai-answer-engine-generative-ui",
    description: "Morphic AI — generative UI answer engine",
    topics: ["ai", "generative-ui", "typescript", "nextjs", "llm"],
  },
  {
    repo: "Regime-v2",
    description: "Regime v2 — dietary and health tracking app",
    topics: ["health", "nutrition", "typescript", "nextjs"],
  },
  {
    repo: "skincareday",
    description: "SkinCareDay — skincare routine tracking app",
    topics: ["skincare", "health", "typescript", "nextjs"],
  },
  {
    repo: "SZBarber",
    description: "SZBarber — barber shop booking platform",
    topics: ["booking", "typescript", "nextjs", "small-business"],
  },
  {
    repo: "seofranco",
    description: "SEOFranco — French SEO optimization tool",
    topics: ["seo", "typescript", "nextjs", "marketing"],
  },
  {
    repo: "auth0-saas-starter",
    description: "Auth0 SaaS authentication starter template",
    topics: ["auth0", "authentication", "saas", "starter-template"],
  },
  {
    repo: "DT",
    description: "DT — internal data tooling project",
    topics: ["typescript", "developer-tools", "internal"],
  },
  {
    repo: "DT-report",
    description: "DT reporting module",
    topics: ["reporting", "internal"],
  },
  {
    repo: "ectf",
    description: "ECTF project (StackBlitz)",
    topics: ["typescript", "prototype"],
  },
  {
    repo: "ectf-beta",
    description: "ECTF beta (StackBlitz)",
    topics: ["typescript", "beta", "prototype"],
  },
  {
    repo: "alpha",
    description: "Alpha exploration project",
    topics: ["alpha", "prototype"],
  },
  {
    repo: "alpha-app",
    description: "Alpha app experiment",
    topics: ["alpha", "prototype", "typescript"],
  },
  {
    repo: "project",
    description: "General project scaffold",
    topics: ["typescript", "prototype"],
  },
];

async function apiRequest(
  method: string,
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

function extractErrorMessage(data: unknown, status: number): string {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "string"
  ) {
    return (data as { message: string }).message;
  }
  return `HTTP ${status}`;
}

/** Returns true on full success, false if either API call failed. */
async function updateRepo(meta: RepoMeta, token: string): Promise<boolean> {
  const { repo, description, topics } = meta;

  // PATCH /repos/{owner}/{repo} — update description
  const patchResult = await apiRequest(
    "PATCH",
    `/repos/${OWNER}/${repo}`,
    { description },
    token,
  );

  if (!patchResult.ok) {
    console.error(
      `❌ ${repo} [description]: ${extractErrorMessage(patchResult.data, patchResult.status)}`,
    );
    return false;
  }

  // PUT /repos/{owner}/{repo}/topics — replace topics
  const topicsResult = await apiRequest(
    "PUT",
    `/repos/${OWNER}/${repo}/topics`,
    { names: topics },
    token,
  );

  if (!topicsResult.ok) {
    console.error(
      `❌ ${repo} [topics]: ${extractErrorMessage(topicsResult.data, topicsResult.status)}`,
    );
    return false;
  }

  console.log(`✅ ${repo}`);
  return true;
}

async function main(): Promise<void> {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    console.error(
      "Error: GITHUB_TOKEN environment variable is not set.\n" +
        "Usage: GITHUB_TOKEN=ghp_... npx tsx scripts/update-repo-metadata.ts",
    );
    process.exit(1);
  }

  console.log(`🚀 Updating ${repos.length} repositories for @${OWNER}...\n`);

  const results = await Promise.allSettled(
    repos.map((meta) => updateRepo(meta, token)),
  );

  const succeeded = results.filter(
    (r) => r.status === "fulfilled" && r.value,
  ).length;
  const failed = repos.length - succeeded;

  console.log(
    `\n✨ Done! ${succeeded}/${repos.length} succeeded${failed > 0 ? `, ${failed} failed` : ""}.`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
