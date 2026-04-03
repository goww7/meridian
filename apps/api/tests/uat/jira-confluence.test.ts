import { describe, it, expect, beforeAll } from 'vitest';
import { login, get, post, del, type AuthContext } from './helpers.js';

/**
 * Jira & Confluence Integration UAT Tests
 *
 * These tests hit the running API server. They exercise:
 * - Jira connection CRUD, project linking, task sync, webhooks
 * - Confluence space linking, page listing, webhooks
 *
 * All test data uses unique timestamps to ensure idempotency across runs.
 */

let alice: AuthContext;
let bob: AuthContext;
let carol: AuthContext;
let eve: AuthContext;
let ts: number;

beforeAll(async () => {
  alice = await login('alice@meridian.dev');
  bob = await login('bob@meridian.dev');
  carol = await login('carol@meridian.dev');
  eve = await login('eve@meridian.dev');
  ts = Date.now();
}, 15000);

// ════════════════════════════════════════════
// JIRA CONNECTION MANAGEMENT
// ════════════════════════════════════════════
describe('UAT: Jira Connection Management', () => {
  let connectionId: string;

  it('admin can create a Jira connection', async () => {
    const { status, data } = await post('/jira/connections', {
      site_url: `https://acme-${ts}.atlassian.net`,
      site_name: 'Acme Test',
      access_token: 'mock-oauth-token-12345',
      refresh_token: 'mock-refresh-token',
    }, alice.token);
    expect(status).toBe(201);
    expect(data.site_url).toBe(`https://acme-${ts}.atlassian.net`);
    expect(data.site_name).toBe('Acme Test');
    expect(data.webhook_secret).toBeTruthy();
    expect(data.status).toBe('active');
    // access_token should NOT be returned in the response
    expect(data.access_token).toBeUndefined();
    connectionId = data.id;
  });

  it('should list Jira connections', async () => {
    const { status, data } = await get('/jira/connections', alice.token);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(1);
    const conn = data.find((c: any) => c.id === connectionId);
    expect(conn).toBeDefined();
    expect(conn.site_name).toBe('Acme Test');
  });

  it('viewer cannot create Jira connections', async () => {
    const { status } = await post('/jira/connections', {
      site_url: `https://evil-${ts}.atlassian.net`,
      site_name: 'Evil',
      access_token: 'stolen-token',
    }, eve.token);
    expect(status).toBe(403);
  });

  it('member cannot create Jira connections', async () => {
    const { status } = await post('/jira/connections', {
      site_url: `https://member-${ts}.atlassian.net`,
      site_name: 'Member',
      access_token: 'token',
    }, carol.token);
    expect(status).toBe(403);
  });

  it('should reject invalid connection input', async () => {
    const { status } = await post('/jira/connections', {
      site_url: 'not-a-url',
      site_name: '',
      access_token: '',
    }, alice.token);
    expect(status).toBe(422);
  });

  it('admin can delete a Jira connection', async () => {
    const { data: temp } = await post('/jira/connections', {
      site_url: `https://temp-${ts}.atlassian.net`,
      site_name: 'Temp',
      access_token: 'temp-token',
    }, alice.token);

    const { status } = await del(`/jira/connections/${temp.id}`, alice.token);
    expect(status).toBe(204);

    const { data: list } = await get('/jira/connections', alice.token);
    const found = list.find((c: any) => c.id === temp.id);
    expect(found).toBeUndefined();
  });
});

// ════════════════════════════════════════════
// JIRA PROJECT LINKING
// ════════════════════════════════════════════
describe('UAT: Jira Project Linking', () => {
  let connectionId: string;
  let flowId: string;

  beforeAll(async () => {
    const { data: conn } = await post('/jira/connections', {
      site_url: `https://link-${ts}.atlassian.net`,
      site_name: 'Link Test',
      access_token: 'link-test-token',
    }, alice.token);
    connectionId = conn.id;

    const { data: flow } = await post('/flows', {
      title: `Jira Link Test Flow ${ts}`,
      priority: 'medium',
    }, carol.token);
    flowId = flow.id;
  });

  it('member can link a Jira project to a flow', async () => {
    const { status, data } = await post(`/flows/${flowId}/jira/link`, {
      connection_id: connectionId,
      project_key: 'PROJ',
      project_name: 'Test Project',
    }, carol.token);
    expect(status).toBe(201);
    expect(data.project_key).toBe('PROJ');
    expect(data.project_name).toBe('Test Project');
    expect(data.sync_issues).toBe(true);
    expect(data.import_completed).toBe(false);
  });

  it('should list project links for a flow', async () => {
    const { status, data } = await get(`/flows/${flowId}/jira/links`, carol.token);
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].project_key).toBe('PROJ');
    expect(data[0].site_url).toBe(`https://link-${ts}.atlassian.net`);
  });

  it('should reject invalid project key format', async () => {
    const { status } = await post(`/flows/${flowId}/jira/link`, {
      connection_id: connectionId,
      project_key: 'invalid-lowercase',
      project_name: 'Bad Key',
    }, carol.token);
    expect(status).toBe(422);
  });

  it('should reject link with non-existent connection', async () => {
    const { status } = await post(`/flows/${flowId}/jira/link`, {
      connection_id: 'jrc_nonexistent',
      project_key: 'FAKE',
      project_name: 'Fake',
    }, carol.token);
    expect(status).toBe(404);
  });

  it('viewer cannot link projects', async () => {
    const { status } = await post(`/flows/${flowId}/jira/link`, {
      connection_id: connectionId,
      project_key: 'NOPE',
      project_name: 'Nope',
    }, eve.token);
    expect(status).toBe(403);
  });

  it('member can unlink a Jira project', async () => {
    const { data: link } = await post(`/flows/${flowId}/jira/link`, {
      connection_id: connectionId,
      project_key: 'DEL',
      project_name: 'Delete Me',
    }, carol.token);

    const { status } = await del(`/flows/${flowId}/jira/link/${link.id}`, carol.token);
    expect(status).toBe(204);

    const { data: links } = await get(`/flows/${flowId}/jira/links`, carol.token);
    const found = links.find((l: any) => l.id === link.id);
    expect(found).toBeUndefined();
  });
});

// ════════════════════════════════════════════
// JIRA TASK SYNC
// ════════════════════════════════════════════
describe('UAT: Jira Task Sync', () => {
  let flowId: string;
  let taskId: string;
  let projectLinkId: string;

  beforeAll(async () => {
    const { data: conn } = await post('/jira/connections', {
      site_url: `https://sync-${ts}.atlassian.net`,
      site_name: 'Sync Test',
      access_token: 'sync-test-token',
    }, alice.token);

    const { data: flow } = await post('/flows', {
      title: `Jira Sync Test Flow ${ts}`,
      priority: 'medium',
    }, carol.token);
    flowId = flow.id;

    const { data: link } = await post(`/flows/${flowId}/jira/link`, {
      connection_id: conn.id,
      project_key: 'SYNC',
      project_name: 'Sync Project',
    }, carol.token);
    projectLinkId = link.id;

    const { data: task } = await post(`/flows/${flowId}/tasks`, {
      title: 'Task to sync with Jira',
    }, carol.token);
    taskId = task.id;
  });

  it('should link a task to a Jira issue', async () => {
    const { status, data } = await post(`/flows/${flowId}/tasks/${taskId}/jira/sync`, {
      project_link_id: projectLinkId,
      issue_key: 'SYNC-42',
    }, carol.token);
    expect(status).toBe(201);
    expect(data.entity_id).toBe(taskId);
    expect(data.entity_type).toBe('task');
    expect(data.issue_key).toBe('SYNC-42');
    expect(data.issue_url).toContain(`sync-${ts}.atlassian.net`);
    expect(data.issue_url).toContain('SYNC-42');
  });

  it('should reject invalid issue key format', async () => {
    const { status } = await post(`/flows/${flowId}/tasks/${taskId}/jira/sync`, {
      project_link_id: projectLinkId,
      issue_key: 'invalid',
    }, carol.token);
    expect(status).toBe(422);
  });

  it('should reject sync for non-existent task', async () => {
    const { status } = await post(`/flows/${flowId}/tasks/task_nonexistent/jira/sync`, {
      project_link_id: projectLinkId,
      issue_key: 'SYNC-99',
    }, carol.token);
    expect(status).toBe(404);
  });
});

// ════════════════════════════════════════════
// JIRA WEBHOOK
// ════════════════════════════════════════════
describe('UAT: Jira Webhook', () => {
  it('should accept webhook and handle unknown events gracefully', async () => {
    const { status, data } = await post('/jira/webhook', {
      webhookEvent: 'unknown:event',
      timestamp: Date.now(),
    }, '');
    expect(status).toBe(200);
    expect(data.handled).toBe(false);
  });

  it('should handle issue_updated webhook for linked task', async () => {
    const { data: conn } = await post('/jira/connections', {
      site_url: `https://wh-${ts}.atlassian.net`,
      site_name: 'Webhook Test',
      access_token: 'webhook-token',
    }, alice.token);

    const { data: flow } = await post('/flows', { title: `Webhook Test Flow ${ts}` }, carol.token);
    const { data: link } = await post(`/flows/${flow.id}/jira/link`, {
      connection_id: conn.id,
      project_key: 'WH',
      project_name: 'Webhook Project',
    }, carol.token);

    const { data: task } = await post(`/flows/${flow.id}/tasks`, { title: 'Webhook Task' }, carol.token);

    await post(`/flows/${flow.id}/tasks/${task.id}/jira/sync`, {
      project_link_id: link.id,
      issue_key: `WH-${ts}`,
    }, carol.token);

    const { status, data: result } = await post('/jira/webhook', {
      webhookEvent: 'jira:issue_updated',
      issue: {
        key: `WH-${ts}`,
        fields: {
          summary: 'Updated issue',
          status: {
            name: 'Done',
            statusCategory: { key: 'done' },
          },
        },
      },
    }, '');
    expect(status).toBe(200);
    expect(result.handled).toBe(true);
    expect(result.issue_key).toBe(`WH-${ts}`);
  });

  it('should ignore issue_updated for unlinked issues', async () => {
    const { status, data } = await post('/jira/webhook', {
      webhookEvent: 'jira:issue_updated',
      issue: {
        key: 'UNKNOWN-999',
        fields: {
          status: { statusCategory: { key: 'done' } },
        },
      },
    }, '');
    expect(status).toBe(200);
    expect(data.handled).toBe(false);
  });
});

// ════════════════════════════════════════════
// CONFLUENCE SPACE LINKING
// ════════════════════════════════════════════
describe('UAT: Confluence Space Linking', () => {
  let connectionId: string;
  let flowId: string;

  beforeAll(async () => {
    const { data: conn } = await post('/jira/connections', {
      site_url: `https://conf-${ts}.atlassian.net`,
      site_name: 'Confluence Test',
      access_token: 'confluence-token',
    }, alice.token);
    connectionId = conn.id;

    const { data: flow } = await post('/flows', {
      title: `Confluence Test Flow ${ts}`,
      priority: 'medium',
    }, carol.token);
    flowId = flow.id;
  });

  it('member can link a Confluence space to a flow', async () => {
    const { status, data } = await post(`/flows/${flowId}/confluence/spaces`, {
      connection_id: connectionId,
      space_key: 'ENG',
      space_name: 'Engineering',
      sync_direction: 'publish',
    }, carol.token);
    expect(status).toBe(201);
    expect(data.space_key).toBe('ENG');
    expect(data.space_name).toBe('Engineering');
    expect(data.sync_direction).toBe('publish');
  });

  it('should list space links for a flow', async () => {
    const { status, data } = await get(`/flows/${flowId}/confluence/spaces`, carol.token);
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].space_key).toBe('ENG');
    expect(data[0].site_url).toBe(`https://conf-${ts}.atlassian.net`);
  });

  it('can link space with pull direction', async () => {
    const { status, data } = await post(`/flows/${flowId}/confluence/spaces`, {
      connection_id: connectionId,
      space_key: 'DOCS',
      space_name: 'Documentation',
      sync_direction: 'pull',
    }, carol.token);
    expect(status).toBe(201);
    expect(data.sync_direction).toBe('pull');
  });

  it('can link space with parent page', async () => {
    const { status, data } = await post(`/flows/${flowId}/confluence/spaces`, {
      connection_id: connectionId,
      space_key: 'SPECS',
      space_name: 'Specifications',
      parent_page_id: '12345',
      sync_direction: 'publish',
    }, carol.token);
    expect(status).toBe(201);
    expect(data.parent_page_id).toBe('12345');
  });

  it('should reject invalid sync direction', async () => {
    const { status } = await post(`/flows/${flowId}/confluence/spaces`, {
      connection_id: connectionId,
      space_key: 'BAD',
      space_name: 'Bad Direction',
      sync_direction: 'both',
    }, carol.token);
    expect(status).toBe(422);
  });

  it('should reject link with non-existent connection', async () => {
    const { status } = await post(`/flows/${flowId}/confluence/spaces`, {
      connection_id: 'jrc_nonexistent',
      space_key: 'FAKE',
      space_name: 'Fake',
    }, carol.token);
    expect(status).toBe(404);
  });

  it('viewer cannot link Confluence spaces', async () => {
    const { status } = await post(`/flows/${flowId}/confluence/spaces`, {
      connection_id: connectionId,
      space_key: 'NOPE',
      space_name: 'Nope',
    }, eve.token);
    expect(status).toBe(403);
  });

  it('member can unlink a Confluence space', async () => {
    const { data: link } = await post(`/flows/${flowId}/confluence/spaces`, {
      connection_id: connectionId,
      space_key: 'TMP',
      space_name: 'Temporary',
    }, carol.token);

    const { status } = await del(`/flows/${flowId}/confluence/spaces/${link.id}`, carol.token);
    expect(status).toBe(204);

    const { data: spaces } = await get(`/flows/${flowId}/confluence/spaces`, carol.token);
    const found = spaces.find((s: any) => s.id === link.id);
    expect(found).toBeUndefined();
  });
});

// ════════════════════════════════════════════
// CONFLUENCE PAGE LINKS
// ════════════════════════════════════════════
describe('UAT: Confluence Page Links', () => {
  let flowId: string;

  beforeAll(async () => {
    const { data: flow } = await post('/flows', {
      title: `Confluence Pages Test Flow ${ts}`,
      priority: 'low',
    }, carol.token);
    flowId = flow.id;
  });

  it('should list page links (initially empty)', async () => {
    const { status, data } = await get(`/flows/${flowId}/confluence/pages`, carol.token);
    expect(status).toBe(200);
    expect(data.length).toBe(0);
  });
});

// ════════════════════════════════════════════
// CONFLUENCE WEBHOOK
// ════════════════════════════════════════════
describe('UAT: Confluence Webhook', () => {
  it('should accept webhook and handle unknown events gracefully', async () => {
    const { status, data } = await post('/confluence/webhook', {
      event: 'unknown:event',
    }, '');
    expect(status).toBe(200);
    expect(data.handled).toBe(false);
  });

  it('should handle page_updated for unlinked pages gracefully', async () => {
    const { status, data } = await post('/confluence/webhook', {
      event: 'page_updated',
      page: { id: '99999', title: 'Unknown Page' },
    }, '');
    expect(status).toBe(200);
    expect(data.handled).toBe(false);
  });
});
