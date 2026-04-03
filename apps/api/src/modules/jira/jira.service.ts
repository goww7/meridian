import crypto from 'node:crypto';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import { evidenceService } from '../evidence/evidence.service.js';
import { initiativeService } from '../initiatives/initiatives.service.js';
import { objectiveService } from '../objectives/objectives.service.js';
import { taskService } from '../tasks/tasks.service.js';
import type { ConnectJiraInput, LinkJiraProjectInput, ImportJiraProjectInput, SyncJiraIssueInput } from '@meridian/shared';

// Jira status category → Meridian task status
const STATUS_MAP: Record<string, string> = {
  new: 'todo',
  indeterminate: 'in_progress',
  done: 'done',
};

function mapJiraStatus(statusCategory: string): string {
  return STATUS_MAP[statusCategory.toLowerCase()] || 'todo';
}

export const jiraService = {
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  },

  // ─── Webhook Handling ───

  async handleWebhook(eventType: string, payload: Record<string, unknown>) {
    switch (eventType) {
      case 'jira:issue_updated':
        return this.handleIssueUpdated(payload);
      case 'jira:issue_created':
        return this.handleIssueCreated(payload);
      case 'sprint_started':
      case 'sprint_closed':
        return this.handleSprintEvent(eventType, payload);
      default:
        return { handled: false, event: eventType };
    }
  },

  async handleIssueUpdated(payload: Record<string, unknown>) {
    const issue = payload.issue as Record<string, unknown>;
    if (!issue) return { handled: false };

    const issueKey = issue.key as string;
    const fields = issue.fields as Record<string, unknown>;
    const status = fields.status as Record<string, unknown>;
    const statusCategory = (status.statusCategory as Record<string, unknown>)?.key as string;

    // Find linked entity
    const linkResult = await db.query(
      'SELECT jil.*, jpl.org_id, jpl.flow_id FROM jira_issue_links jil JOIN jira_project_links jpl ON jpl.id = jil.project_link_id WHERE jil.issue_key = $1',
      [issueKey],
    );
    if (linkResult.rows.length === 0) return { handled: false };

    const link = linkResult.rows[0];

    // Only sync status for tasks
    if (link.entity_type === 'task' && statusCategory) {
      const newStatus = mapJiraStatus(statusCategory);
      await db.query('UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2', [newStatus, link.entity_id]);
      await db.query('UPDATE jira_issue_links SET last_synced_at = now() WHERE id = $1', [link.id]);

      eventBus.emit('task.status_changed', {
        org_id: link.org_id,
        entity_type: 'task',
        entity_id: link.entity_id,
        event_type: 'task.status_changed',
        actor_id: null,
        data: { status: newStatus, source: 'jira' },
      });
    }

    return { handled: true, action: 'issue_updated', issue_key: issueKey };
  },

  async handleIssueCreated(payload: Record<string, unknown>) {
    const issue = payload.issue as Record<string, unknown>;
    if (!issue) return { handled: false };

    const issueKey = issue.key as string;
    const fields = issue.fields as Record<string, unknown>;
    const project = fields.project as Record<string, unknown>;
    const projectKey = project.key as string;

    // Check if project is linked
    const linkResult = await db.query(
      'SELECT jpl.* FROM jira_project_links jpl JOIN jira_connections jc ON jc.id = jpl.connection_id WHERE jpl.project_key = $1 AND jc.status = $2 AND jpl.sync_issues = true',
      [projectKey, 'active'],
    );
    if (linkResult.rows.length === 0) return { handled: false };

    const projectLink = linkResult.rows[0];
    const issueType = ((fields.issuetype as Record<string, unknown>)?.name as string || '').toLowerCase();
    const summary = fields.summary as string;
    const description = (fields.description as string) || null;
    const siteUrl = (await db.query('SELECT site_url FROM jira_connections WHERE id = $1', [projectLink.connection_id])).rows[0]?.site_url || '';
    const issueUrl = `${siteUrl}/browse/${issueKey}`;

    // Create the appropriate Meridian entity based on issue type
    if (issueType === 'epic') {
      const initiative = await initiativeService.create(projectLink.org_id, projectLink.flow_id, { title: summary, description: description || undefined });
      await this.createIssueLink(initiative.id, 'initiative', projectLink.id, issueKey, issueType, issueUrl);
      return { handled: true, action: 'initiative_created', entity_id: initiative.id };
    }

    if (issueType === 'story') {
      const task = await taskService.create(projectLink.org_id, projectLink.flow_id, { title: summary, description: description || undefined });
      await this.createIssueLink(task.id, 'task', projectLink.id, issueKey, issueType, issueUrl);
      return { handled: true, action: 'task_created', entity_id: task.id };
    }

    // task, subtask, bug → task
    const task = await taskService.create(projectLink.org_id, projectLink.flow_id, { title: summary, description: description || undefined });
    await this.createIssueLink(task.id, 'task', projectLink.id, issueKey, issueType, issueUrl);
    return { handled: true, action: 'task_created', entity_id: task.id };
  },

  async handleSprintEvent(eventType: string, payload: Record<string, unknown>) {
    const sprint = payload.sprint as Record<string, unknown>;
    if (!sprint) return { handled: false };

    const sprintName = sprint.name as string;
    const boardId = (sprint.originBoardId as number)?.toString();

    // Find project links associated with this board (via connection)
    // Sprint events create evidence for tracking
    const connections = await db.query('SELECT jc.id, jc.org_id FROM jira_connections jc WHERE jc.status = $1', ['active']);

    for (const conn of connections.rows) {
      const links = await db.query('SELECT * FROM jira_project_links WHERE connection_id = $1', [conn.id]);
      for (const link of links.rows) {
        await evidenceService.create(link.org_id, link.flow_id, {
          type: 'test_result',
          source: 'ci_cd',
          status: eventType === 'sprint_closed' ? 'passing' : 'pending',
          data: { sprint_name: sprintName, board_id: boardId, event: eventType, source: 'jira_sprint' },
        });
      }
    }

    return { handled: true, action: eventType };
  },

  // ─── Connection CRUD ───

  async createConnection(orgId: string, input: ConnectJiraInput) {
    const id = generateId('jrc');
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const result = await db.query(
      `INSERT INTO jira_connections (id, org_id, site_url, site_name, access_token, refresh_token, token_expires_at, webhook_secret)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, org_id, site_url, site_name, webhook_secret, status, created_at, updated_at`,
      [id, orgId, input.site_url, input.site_name, input.access_token, input.refresh_token || null, input.token_expires_at || null, webhookSecret],
    );
    return result.rows[0];
  },

  async listConnections(orgId: string) {
    const result = await db.query(
      'SELECT id, org_id, site_url, site_name, webhook_secret, status, created_at, updated_at FROM jira_connections WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC',
      [orgId, 'active'],
    );
    return result.rows;
  },

  async removeConnection(orgId: string, connectionId: string) {
    await db.query(
      'UPDATE jira_connections SET status = $1, updated_at = now() WHERE id = $2 AND org_id = $3',
      ['deleted', connectionId, orgId],
    );
  },

  // ─── Project Link CRUD ───

  async linkProject(orgId: string, flowId: string, input: LinkJiraProjectInput) {
    const connection = await db.query(
      'SELECT * FROM jira_connections WHERE id = $1 AND org_id = $2 AND status = $3',
      [input.connection_id, orgId, 'active'],
    );
    if (connection.rows.length === 0) throw new NotFoundError('Jira Connection', input.connection_id);

    const id = generateId('jpl');
    const result = await db.query(
      `INSERT INTO jira_project_links (id, org_id, flow_id, connection_id, project_key, project_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, orgId, flowId, input.connection_id, input.project_key, input.project_name],
    );
    return result.rows[0];
  },

  async unlinkProject(orgId: string, flowId: string, linkId: string) {
    await db.query(
      'DELETE FROM jira_project_links WHERE id = $1 AND org_id = $2 AND flow_id = $3',
      [linkId, orgId, flowId],
    );
  },

  async listProjectLinks(orgId: string, flowId: string) {
    const result = await db.query(
      `SELECT jpl.*, jc.site_url, jc.site_name
       FROM jira_project_links jpl
       JOIN jira_connections jc ON jc.id = jpl.connection_id
       WHERE jpl.org_id = $1 AND jpl.flow_id = $2
       ORDER BY jpl.created_at DESC`,
      [orgId, flowId],
    );
    return result.rows;
  },

  // ─── Import ───

  async importProject(orgId: string, flowId: string, input: ImportJiraProjectInput) {
    const projectLink = await db.query(
      'SELECT jpl.*, jc.site_url, jc.access_token FROM jira_project_links jpl JOIN jira_connections jc ON jc.id = jpl.connection_id WHERE jpl.id = $1 AND jpl.org_id = $2',
      [input.project_link_id, orgId],
    );
    if (projectLink.rows.length === 0) throw new NotFoundError('Jira Project Link', input.project_link_id);

    const link = projectLink.rows[0];
    const baseUrl = `${link.site_url}/rest/api/3/search`;
    let jql = `project = ${link.project_key}`;
    if (!input.include_done) {
      jql += ' AND statusCategory != Done';
    }
    jql += ' ORDER BY issuetype ASC, created ASC';

    // Fetch issues from Jira REST API
    const response = await fetch(`${baseUrl}?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,description,issuetype,status,parent`, {
      headers: {
        'Authorization': `Bearer ${link.access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Jira API error (${response.status}): ${errBody}`);
    }

    const data = await response.json() as { issues: Array<Record<string, unknown>> };
    const issues = data.issues || [];

    // Track created entities for parent→child linking
    const epicMap = new Map<string, string>(); // issueKey → initiativeId
    const objectiveMap = new Map<string, string>(); // initiativeId → objectiveId (auto-created)
    const imported = { initiatives: 0, requirements: 0, tasks: 0 };

    // First pass: epics → initiatives
    for (const issue of issues) {
      const fields = issue.fields as Record<string, unknown>;
      const issueType = ((fields.issuetype as Record<string, unknown>)?.name as string || '').toLowerCase();
      const key = issue.key as string;

      if (issueType === 'epic') {
        const summary = fields.summary as string;
        const description = (fields.description as string) || undefined;
        const initiative = await initiativeService.create(orgId, flowId, { title: summary, description });
        epicMap.set(key, initiative.id);

        // Auto-create a default objective for each epic so stories can become requirements
        const objective = await objectiveService.create(orgId, initiative.id, { title: `${summary} — Objectives` });
        objectiveMap.set(initiative.id, objective.id);

        await this.createIssueLink(initiative.id, 'initiative', input.project_link_id, key, 'epic', `${link.site_url}/browse/${key}`);
        imported.initiatives++;
      }
    }

    // Second pass: stories/tasks/bugs
    for (const issue of issues) {
      const fields = issue.fields as Record<string, unknown>;
      const issueType = ((fields.issuetype as Record<string, unknown>)?.name as string || '').toLowerCase();
      const key = issue.key as string;

      if (issueType === 'epic') continue; // already handled

      const summary = fields.summary as string;
      const description = (fields.description as string) || undefined;
      const parentKey = (fields.parent as Record<string, unknown>)?.key as string | undefined;

      if (issueType === 'story' && parentKey && epicMap.has(parentKey)) {
        // Story with epic parent → requirement under that epic's objective
        const initiativeId = epicMap.get(parentKey)!;
        const objectiveId = objectiveMap.get(initiativeId)!;
        const req = await db.query(
          `INSERT INTO requirements (id, org_id, flow_id, objective_id, title, description, type, priority, acceptance_criteria)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [generateId('req'), orgId, flowId, objectiveId, summary, description || null, 'functional', 'should', '[]'],
        );
        eventBus.emit('requirement.created', { org_id: orgId, entity_type: 'requirement', entity_id: req.rows[0].id, event_type: 'requirement.created', actor_id: null, data: {} });
        await this.createIssueLink(req.rows[0].id, 'requirement', input.project_link_id, key, issueType, `${link.site_url}/browse/${key}`);
        imported.requirements++;
      } else {
        // task, subtask, bug, or unparented story → task
        const task = await taskService.create(orgId, flowId, { title: summary, description });
        await this.createIssueLink(task.id, 'task', input.project_link_id, key, issueType, `${link.site_url}/browse/${key}`);
        imported.tasks++;
      }
    }

    // Mark import as completed
    await db.query('UPDATE jira_project_links SET import_completed = true WHERE id = $1', [input.project_link_id]);

    return { imported, total: issues.length };
  },

  // ─── Task ↔ Issue Sync ───

  async syncTaskToIssue(orgId: string, taskId: string, input: SyncJiraIssueInput) {
    const task = await db.query('SELECT * FROM tasks WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [taskId, orgId]);
    if (task.rows.length === 0) throw new NotFoundError('Task', taskId);

    const projectLink = await db.query(
      'SELECT jpl.*, jc.site_url FROM jira_project_links jpl JOIN jira_connections jc ON jc.id = jpl.connection_id WHERE jpl.id = $1 AND jpl.org_id = $2',
      [input.project_link_id, orgId],
    );
    if (projectLink.rows.length === 0) throw new NotFoundError('Jira Project Link', input.project_link_id);

    const link = projectLink.rows[0];
    const issueUrl = `${link.site_url}/browse/${input.issue_key}`;

    return this.createIssueLink(taskId, 'task', input.project_link_id, input.issue_key, 'task', issueUrl);
  },

  // ─── Helpers ───

  async createIssueLink(entityId: string, entityType: string, projectLinkId: string, issueKey: string, issueType: string, issueUrl: string) {
    const id = generateId('jil');
    const result = await db.query(
      `INSERT INTO jira_issue_links (id, entity_id, entity_type, project_link_id, issue_key, issue_type, issue_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, entityId, entityType, projectLinkId, issueKey, issueType, issueUrl],
    );
    return result.rows[0];
  },

  // ─── Event Listeners ───

  setupEventListeners() {
    eventBus.on('task.status_changed', async (event) => {
      // If the status change came from Jira, don't echo it back
      if (event.data.source === 'jira') return;

      // Check if this task is linked to a Jira issue
      const linkResult = await db.query(
        `SELECT jil.*, jpl.connection_id, jc.site_url, jc.access_token
         FROM jira_issue_links jil
         JOIN jira_project_links jpl ON jpl.id = jil.project_link_id
         JOIN jira_connections jc ON jc.id = jpl.connection_id
         WHERE jil.entity_id = $1 AND jil.entity_type = 'task' AND jil.sync_direction IN ('outbound', 'bidirectional') AND jc.status = 'active'`,
        [event.entity_id],
      );
      if (linkResult.rows.length === 0) return;

      // Future: push status update to Jira via REST API
      // For now, just update the last_synced_at timestamp
      for (const link of linkResult.rows) {
        await db.query('UPDATE jira_issue_links SET last_synced_at = now() WHERE id = $1', [link.id]);
      }
    });
  },
};
