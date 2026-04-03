import crypto from 'node:crypto';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import { evidenceService } from '../evidence/evidence.service.js';
import type { LinkRepoInput, SyncTaskInput } from '@meridian/shared';

const GITHUB_API = 'https://api.github.com';

// ─── GitHub API helpers ───

async function ghFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`GitHub API error (${res.status}): ${err.message}`);
  }
  return res.json() as Promise<T>;
}

async function ghFetchAll<T>(path: string, token: string, maxPages = 10): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (page <= maxPages) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${path}${sep}per_page=100&page=${page}`;
    const res = await fetch(`${GITHUB_API}${url}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) break;
    const data = (await res.json()) as T[];
    if (!Array.isArray(data) || data.length === 0) break;
    items.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return items;
}

// ─── Types ───

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  private: boolean;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  html_url: string;
}

interface GitHubOrg {
  login: string;
  avatar_url: string;
  description: string | null;
}

interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export const githubService = {
  // ─── Connection management ───

  async connect(orgId: string, accessToken: string) {
    // Verify the token by fetching the authenticated user
    const user = await ghFetch<GitHubUser>('/user', accessToken);

    // Check scopes
    const scopeRes = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const scopes = scopeRes.headers.get('x-oauth-scopes') || '';

    const id = generateId('ghc');
    const result = await db.query(
      `INSERT INTO github_connections (id, org_id, access_token, username, avatar_url, display_name, token_scopes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (org_id) DO UPDATE SET
         access_token = $3, username = $4, avatar_url = $5, display_name = $6,
         token_scopes = $7, status = 'active', updated_at = now()
       RETURNING *`,
      [id, orgId, accessToken, user.login, user.avatar_url, user.name || user.login, scopes],
    );

    const conn = result.rows[0];
    // Don't return the token to the client
    return { ...conn, access_token: undefined };
  },

  async disconnect(orgId: string) {
    await db.query(
      `UPDATE github_connections SET status = 'disconnected', access_token = '', updated_at = now() WHERE org_id = $1`,
      [orgId],
    );
  },

  async getConnection(orgId: string) {
    const result = await db.query(
      'SELECT id, org_id, username, avatar_url, display_name, token_scopes, status, created_at, updated_at FROM github_connections WHERE org_id = $1 AND status = $2',
      [orgId, 'active'],
    );
    return result.rows[0] || null;
  },

  async getConnectionWithToken(orgId: string) {
    const result = await db.query(
      'SELECT * FROM github_connections WHERE org_id = $1 AND status = $2',
      [orgId, 'active'],
    );
    return result.rows[0] || null;
  },

  // ─── Repo browsing ───

  async listRepos(orgId: string, query?: { type?: string; sort?: string; search?: string }) {
    const conn = await this.getConnectionWithToken(orgId);
    if (!conn) throw new NotFoundError('GitHub connection', orgId);

    let repos: GitHubRepo[];
    const type = query?.type || 'all';
    const sort = query?.sort || 'updated';

    if (type === 'org') {
      // Fetch orgs first, then repos from each
      const orgs = await ghFetchAll<GitHubOrg>('/user/orgs', conn.access_token, 3);
      repos = [];
      for (const org of orgs) {
        const orgRepos = await ghFetchAll<GitHubRepo>(`/orgs/${org.login}/repos?sort=${sort}`, conn.access_token, 3);
        repos.push(...orgRepos);
      }
    } else {
      repos = await ghFetchAll<GitHubRepo>(`/user/repos?sort=${sort}&affiliation=owner,collaborator,organization_member`, conn.access_token, 5);
    }

    // Filter by search if provided
    if (query?.search) {
      const s = query.search.toLowerCase();
      repos = repos.filter(r => r.full_name.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s));
    }

    // Sort by updated
    repos.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // Check which repos are already linked
    const linkedResult = await db.query(
      'SELECT repo_full_name, flow_id FROM github_repo_links WHERE org_id = $1',
      [orgId],
    );
    const linkedMap = new Map(linkedResult.rows.map((r: any) => [r.repo_full_name, r.flow_id]));

    return repos.map(r => ({
      id: r.id,
      full_name: r.full_name,
      name: r.name,
      owner: r.owner.login,
      owner_avatar: r.owner.avatar_url,
      description: r.description,
      private: r.private,
      default_branch: r.default_branch,
      language: r.language,
      stars: r.stargazers_count,
      updated_at: r.updated_at,
      html_url: r.html_url,
      linked_flow_id: linkedMap.get(r.full_name) || null,
    }));
  },

  async getRepo(orgId: string, owner: string, repo: string) {
    const conn = await this.getConnectionWithToken(orgId);
    if (!conn) throw new NotFoundError('GitHub connection', orgId);
    return ghFetch<GitHubRepo>(`/repos/${owner}/${repo}`, conn.access_token);
  },

  async listBranches(orgId: string, owner: string, repo: string) {
    const conn = await this.getConnectionWithToken(orgId);
    if (!conn) throw new NotFoundError('GitHub connection', orgId);
    return ghFetchAll<GitHubBranch>(`/repos/${owner}/${repo}/branches`, conn.access_token, 3);
  },

  async listOrgs(orgId: string) {
    const conn = await this.getConnectionWithToken(orgId);
    if (!conn) throw new NotFoundError('GitHub connection', orgId);
    return ghFetchAll<GitHubOrg>('/user/orgs', conn.access_token, 3);
  },

  // ─── Repo linking ───

  async linkRepo(orgId: string, flowId: string, repoFullName: string) {
    const conn = await this.getConnectionWithToken(orgId);
    if (!conn) throw new NotFoundError('GitHub connection', orgId);

    // Verify repo exists and is accessible
    const [repoOwner, repoName] = repoFullName.split('/');
    await ghFetch(`/repos/${repoOwner}/${repoName}`, conn.access_token);

    const id = generateId('grl');
    const result = await db.query(
      `INSERT INTO github_repo_links (id, org_id, flow_id, connection_id, repo_owner, repo_name, repo_full_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (flow_id, repo_full_name) DO UPDATE SET connection_id = $4, updated_at = now()
       RETURNING *`,
      [id, orgId, flowId, conn.id, repoOwner, repoName, repoFullName],
    );
    return result.rows[0];
  },

  async unlinkRepo(orgId: string, flowId: string, linkId: string) {
    await db.query('DELETE FROM github_repo_links WHERE id = $1 AND org_id = $2 AND flow_id = $3', [linkId, orgId, flowId]);
  },

  async listRepoLinks(orgId: string, flowId: string) {
    const result = await db.query(
      `SELECT rl.* FROM github_repo_links rl WHERE rl.org_id = $1 AND rl.flow_id = $2 ORDER BY rl.created_at DESC`,
      [orgId, flowId],
    );
    return result.rows;
  },

  async listAllRepoLinks(orgId: string) {
    const result = await db.query(
      `SELECT rl.*, f.title as flow_title FROM github_repo_links rl JOIN flows f ON f.id = rl.flow_id WHERE rl.org_id = $1 ORDER BY rl.created_at DESC`,
      [orgId],
    );
    return result.rows;
  },

  // ─── Task sync (create real GitHub issues) ───

  async syncTaskToIssue(orgId: string, flowId: string, taskId: string, repoLinkId: string) {
    const conn = await this.getConnectionWithToken(orgId);
    if (!conn) throw new NotFoundError('GitHub connection', orgId);

    const task = await db.query('SELECT * FROM tasks WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [taskId, orgId]);
    if (task.rows.length === 0) throw new NotFoundError('Task', taskId);

    const repoLink = await db.query('SELECT * FROM github_repo_links WHERE id = $1 AND org_id = $2', [repoLinkId, orgId]);
    if (repoLink.rows.length === 0) throw new NotFoundError('Repo Link', repoLinkId);

    const t = task.rows[0];
    const rl = repoLink.rows[0];

    // Create real GitHub issue
    const issue = await ghFetch<{ number: number; html_url: string }>(
      `/repos/${rl.repo_owner}/${rl.repo_name}/issues`,
      conn.access_token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t.title,
          body: `${t.description || ''}\n\n---\n*Synced from [Meridian](${process.env.WEB_URL || 'https://meridian.halalterminal.com'}) — Flow task \`${taskId}\`*`,
          labels: ['meridian-sync'],
        }),
      },
    );

    const id = generateId('gil');
    const result = await db.query(
      `INSERT INTO github_issue_links (id, task_id, repo_link_id, issue_number, issue_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [id, taskId, repoLinkId, issue.number, issue.html_url],
    );
    return result.rows[0] || { task_id: taskId, issue_number: issue.number, issue_url: issue.html_url };
  },

  // ─── Webhook handling (kept from before) ───

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  },

  async handleWebhook(event: string, payload: Record<string, unknown>) {
    switch (event) {
      case 'installation':
      case 'installation.created':
      case 'installation.deleted':
        return this.handleInstallation(payload);
      case 'issues':
        return this.handleIssues(payload);
      case 'check_run':
        return this.handleCheckRun(payload);
      case 'pull_request_review':
        return this.handlePullRequestReview(payload);
      case 'deployment_status':
        return this.handleDeploymentStatus(payload);
      default:
        return { handled: false, event };
    }
  },

  async handleInstallation(payload: Record<string, unknown>) {
    const action = payload.action as string;
    const installation = payload.installation as Record<string, unknown>;
    const installationId = installation.id as number;

    if (action === 'deleted') {
      await db.query('UPDATE github_installations SET status = $1, updated_at = now() WHERE installation_id = $2', ['deleted', installationId]);
      return { handled: true, action: 'deleted' };
    }
    return { handled: true, action, installation_id: installationId };
  },

  async handleIssues(payload: Record<string, unknown>) {
    const action = payload.action as string;
    const issue = payload.issue as Record<string, unknown>;
    const issueNumber = issue.number as number;

    if (!['closed', 'reopened'].includes(action)) return { handled: false };

    const linkResult = await db.query(
      'SELECT il.*, t.id as task_id, t.org_id, t.flow_id FROM github_issue_links il JOIN tasks t ON t.id = il.task_id WHERE il.issue_number = $1',
      [issueNumber],
    );
    if (linkResult.rows.length === 0) return { handled: false };

    const link = linkResult.rows[0];
    const newStatus = action === 'closed' ? 'done' : 'in_progress';
    await db.query('UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2', [newStatus, link.task_id]);
    await db.query('UPDATE github_issue_links SET last_synced_at = now() WHERE id = $1', [link.id]);

    return { handled: true, action, task_id: link.task_id };
  },

  async handleCheckRun(payload: Record<string, unknown>) {
    const action = payload.action as string;
    if (action !== 'completed') return { handled: false };

    const checkRun = payload.check_run as Record<string, unknown>;
    const repo = payload.repository as Record<string, unknown>;
    const repoFullName = repo.full_name as string;
    const conclusion = checkRun.conclusion as string;
    const name = checkRun.name as string;
    const url = (checkRun.html_url || checkRun.details_url || '') as string;

    const linkResult = await db.query('SELECT * FROM github_repo_links WHERE repo_full_name = $1', [repoFullName]);
    if (linkResult.rows.length === 0) return { handled: false };

    for (const link of linkResult.rows) {
      await evidenceService.create(link.org_id, link.flow_id, {
        type: 'test_result',
        source: 'ci_cd',
        status: conclusion === 'success' ? 'passing' : 'failing',
        data: { tool: name, conclusion, url, source: 'github_check_run' },
      });
    }
    return { handled: true, action: 'evidence_created' };
  },

  async handlePullRequestReview(payload: Record<string, unknown>) {
    const review = payload.review as Record<string, unknown>;
    const pr = payload.pull_request as Record<string, unknown>;
    const repo = payload.repository as Record<string, unknown>;
    const repoFullName = repo.full_name as string;
    const state = review.state as string;
    const reviewer = (review.user as Record<string, unknown>).login as string;
    const url = review.html_url as string;

    const linkResult = await db.query('SELECT * FROM github_repo_links WHERE repo_full_name = $1', [repoFullName]);
    if (linkResult.rows.length === 0) return { handled: false };

    for (const link of linkResult.rows) {
      await evidenceService.create(link.org_id, link.flow_id, {
        type: 'code_review',
        source: 'ci_cd',
        status: state === 'approved' ? 'passing' : 'pending',
        data: { reviewer, state, url, pr_title: pr.title, source: 'github_pr_review' },
      });
    }
    return { handled: true, action: 'evidence_created' };
  },

  async handleDeploymentStatus(payload: Record<string, unknown>) {
    const deploymentStatus = payload.deployment_status as Record<string, unknown>;
    const deployment = payload.deployment as Record<string, unknown>;
    const repo = payload.repository as Record<string, unknown>;
    const repoFullName = repo.full_name as string;
    const state = deploymentStatus.state as string;
    const environment = deployment.environment as string;
    const url = (deploymentStatus.target_url || '') as string;

    if (!['success', 'failure', 'error'].includes(state)) return { handled: false };

    const linkResult = await db.query('SELECT * FROM github_repo_links WHERE repo_full_name = $1', [repoFullName]);
    if (linkResult.rows.length === 0) return { handled: false };

    for (const link of linkResult.rows) {
      await evidenceService.create(link.org_id, link.flow_id, {
        type: 'deployment',
        source: 'ci_cd',
        status: state === 'success' ? 'passing' : 'failing',
        data: { environment, state, url, source: 'github_deployment' },
      });
    }
    return { handled: true, action: 'evidence_created' };
  },

  // Legacy — kept for backward compat
  async listInstallations(orgId: string) {
    const result = await db.query(
      'SELECT * FROM github_installations WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC',
      [orgId, 'active'],
    );
    return result.rows;
  },

  async setupInstallation(orgId: string, installationId: number, accountLogin: string, accountType: string, appId: number) {
    const id = generateId('ghi');
    const result = await db.query(
      `INSERT INTO github_installations (id, org_id, installation_id, account_login, account_type, app_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (installation_id) DO UPDATE SET org_id = $2, status = 'active', updated_at = now()
       RETURNING *`,
      [id, orgId, installationId, accountLogin, accountType, appId],
    );
    return result.rows[0];
  },

  async removeInstallation(orgId: string, installationId: string) {
    await db.query('UPDATE github_installations SET status = $1, updated_at = now() WHERE id = $2 AND org_id = $3', ['deleted', installationId, orgId]);
  },
};
