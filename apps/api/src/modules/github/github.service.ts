import crypto from 'node:crypto';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import { evidenceService } from '../evidence/evidence.service.js';
import type { LinkRepoInput, SyncTaskInput } from '@meridian/shared';

export const githubService = {
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
    const account = installation.account as Record<string, unknown>;

    if (action === 'deleted') {
      await db.query('UPDATE github_installations SET status = $1, updated_at = now() WHERE installation_id = $2', ['deleted', installationId]);
      return { handled: true, action: 'deleted' };
    }

    // For created/updated — we store it but can't link to org until setup callback
    return { handled: true, action, installation_id: installationId };
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

  async listInstallations(orgId: string) {
    const result = await db.query(
      'SELECT * FROM github_installations WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC',
      [orgId, 'active'],
    );
    return result.rows;
  },

  async removeInstallation(orgId: string, installationId: string) {
    await db.query('UPDATE github_installations SET status = $1, updated_at = now() WHERE id = $2 AND org_id = $3', ['deleted', installationId, orgId]);
  },

  async linkRepo(orgId: string, flowId: string, input: LinkRepoInput) {
    const installation = await db.query('SELECT * FROM github_installations WHERE id = $1 AND org_id = $2 AND status = $3', [input.installation_id, orgId, 'active']);
    if (installation.rows.length === 0) throw new NotFoundError('GitHub Installation', input.installation_id);

    const [repoOwner, repoName] = input.repo_full_name.split('/');
    const id = generateId('grl');
    const result = await db.query(
      `INSERT INTO github_repo_links (id, org_id, flow_id, installation_id, repo_owner, repo_name, repo_full_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, orgId, flowId, input.installation_id, repoOwner, repoName, input.repo_full_name],
    );
    return result.rows[0];
  },

  async unlinkRepo(orgId: string, flowId: string, linkId: string) {
    await db.query('DELETE FROM github_repo_links WHERE id = $1 AND org_id = $2 AND flow_id = $3', [linkId, orgId, flowId]);
  },

  async listRepoLinks(orgId: string, flowId: string) {
    const result = await db.query(
      'SELECT rl.*, gi.account_login FROM github_repo_links rl JOIN github_installations gi ON gi.id = rl.installation_id WHERE rl.org_id = $1 AND rl.flow_id = $2',
      [orgId, flowId],
    );
    return result.rows;
  },

  async syncTaskToIssue(orgId: string, taskId: string, repoLinkId: string) {
    const task = await db.query('SELECT * FROM tasks WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [taskId, orgId]);
    if (task.rows.length === 0) throw new NotFoundError('Task', taskId);

    const repoLink = await db.query('SELECT * FROM github_repo_links WHERE id = $1 AND org_id = $2', [repoLinkId, orgId]);
    if (repoLink.rows.length === 0) throw new NotFoundError('Repo Link', repoLinkId);

    const t = task.rows[0];
    const rl = repoLink.rows[0];

    // Store a placeholder issue link — actual GitHub API call would happen here with Octokit
    // For now, create the link record indicating it needs to be synced
    const id = generateId('gil');
    const issueNumber = 0; // Would be set by actual GitHub API response
    const issueUrl = `https://github.com/${rl.repo_full_name}/issues/new`;

    const result = await db.query(
      `INSERT INTO github_issue_links (id, task_id, repo_link_id, issue_number, issue_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, taskId, repoLinkId, issueNumber, issueUrl],
    );
    return result.rows[0];
  },
};
