import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import { artifactService } from '../artifacts/artifacts.service.js';
import { toAdf, fromAdf } from './confluence.adf.js';
import type { AdfDocument } from './confluence.adf.js';
import type {
  LinkConfluenceSpaceInput,
  PublishToConfluenceInput,
  PullFromConfluenceInput,
  ImportConfluenceSpaceInput,
  ArtifactContent,
} from '@meridian/shared';

// ─── Helpers ───

async function getConnectionToken(connectionId: string, orgId: string) {
  const result = await db.query(
    'SELECT site_url, access_token, webhook_secret FROM jira_connections WHERE id = $1 AND org_id = $2 AND status = $3',
    [connectionId, orgId, 'active'],
  );
  if (result.rows.length === 0) throw new NotFoundError('Atlassian Connection', connectionId);
  return result.rows[0] as { site_url: string; access_token: string; webhook_secret: string };
}

async function confluenceApi(siteUrl: string, token: string, path: string, options?: RequestInit) {
  const baseUrl = `${siteUrl}/wiki/api/v2`;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Confluence API error (${response.status}): ${errBody}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const confluenceService = {
  // ─── Webhook Handling ───

  async handleWebhook(eventType: string, payload: Record<string, unknown>) {
    if (eventType !== 'page_updated' && eventType !== 'page_created') {
      return { handled: false, event: eventType };
    }

    const page = payload.page as Record<string, unknown> | undefined;
    if (!page) return { handled: false };

    const pageId = String(page.id);

    // Check if this page is linked to an artifact with 'pull' direction
    const linkResult = await db.query(
      `SELECT cpl.*, csl.connection_id, csl.org_id
       FROM confluence_page_links cpl
       JOIN confluence_space_links csl ON csl.id = cpl.space_link_id
       WHERE cpl.page_id = $1 AND cpl.sync_direction = 'pull'`,
      [pageId],
    );
    if (linkResult.rows.length === 0) return { handled: false };

    const link = linkResult.rows[0];
    const conn = await getConnectionToken(link.connection_id, link.org_id);

    // Fetch updated page content
    const pageData = await confluenceApi(conn.site_url, conn.access_token, `/pages/${pageId}?body-format=atlas_doc_format`);
    const adfBody = pageData.body?.atlas_doc_format?.value;
    if (!adfBody) return { handled: false };

    const adf: AdfDocument = typeof adfBody === 'string' ? JSON.parse(adfBody) : adfBody;
    const content = fromAdf(adf);
    const contentText = content.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');

    // Create new artifact version
    await artifactService.createVersion(link.org_id, link.artifact_id, 'confluence', {
      content,
      content_text: contentText,
    });

    await db.query('UPDATE confluence_page_links SET last_synced_at = now() WHERE id = $1', [link.id]);

    return { handled: true, action: 'version_created', artifact_id: link.artifact_id };
  },

  // ─── Space Link CRUD ───

  async createSpaceLink(orgId: string, flowId: string, input: LinkConfluenceSpaceInput) {
    // Verify the connection exists and belongs to org
    await getConnectionToken(input.connection_id, orgId);

    const id = generateId('csl');
    const result = await db.query(
      `INSERT INTO confluence_space_links (id, org_id, flow_id, connection_id, space_key, space_name, parent_page_id, sync_direction)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, orgId, flowId, input.connection_id, input.space_key, input.space_name, input.parent_page_id || null, input.sync_direction],
    );
    return result.rows[0];
  },

  async listSpaceLinks(orgId: string, flowId: string) {
    const result = await db.query(
      `SELECT csl.*, jc.site_url, jc.site_name
       FROM confluence_space_links csl
       JOIN jira_connections jc ON jc.id = csl.connection_id
       WHERE csl.org_id = $1 AND csl.flow_id = $2
       ORDER BY csl.created_at DESC`,
      [orgId, flowId],
    );
    return result.rows;
  },

  async removeSpaceLink(orgId: string, flowId: string, linkId: string) {
    // Delete page links first (FK constraint)
    await db.query('DELETE FROM confluence_page_links WHERE space_link_id = $1 AND org_id = $2', [linkId, orgId]);
    await db.query('DELETE FROM confluence_space_links WHERE id = $1 AND org_id = $2 AND flow_id = $3', [linkId, orgId, flowId]);
  },

  // ─── Page Links ───

  async listPageLinks(orgId: string, flowId: string) {
    const result = await db.query(
      `SELECT cpl.*, a.title as artifact_title, a.type as artifact_type
       FROM confluence_page_links cpl
       JOIN confluence_space_links csl ON csl.id = cpl.space_link_id
       JOIN artifacts a ON a.id = cpl.artifact_id
       WHERE cpl.org_id = $1 AND csl.flow_id = $2
       ORDER BY cpl.created_at DESC`,
      [orgId, flowId],
    );
    return result.rows;
  },

  // ─── Publish (Meridian → Confluence) ───

  async publishArtifact(orgId: string, artifactId: string, input: PublishToConfluenceInput) {
    // Get artifact with latest version
    const artifact = await artifactService.getWithLatestVersion(orgId, artifactId);
    if (!artifact.latest_version) throw new Error('Artifact has no versions to publish');

    // Get space link and connection
    const spaceLink = await db.query(
      'SELECT csl.*, jc.site_url, jc.access_token FROM confluence_space_links csl JOIN jira_connections jc ON jc.id = csl.connection_id WHERE csl.id = $1 AND csl.org_id = $2',
      [input.space_link_id, orgId],
    );
    if (spaceLink.rows.length === 0) throw new NotFoundError('Confluence Space Link', input.space_link_id);
    const sl = spaceLink.rows[0];

    const content: ArtifactContent = typeof artifact.latest_version.content === 'string'
      ? JSON.parse(artifact.latest_version.content)
      : artifact.latest_version.content;
    const adf = toAdf(content);

    // Check if page link already exists (update vs create)
    const existingLink = await db.query(
      'SELECT * FROM confluence_page_links WHERE artifact_id = $1 AND space_link_id = $2',
      [artifactId, input.space_link_id],
    );

    let pageId: string;
    let pageUrl: string;
    let pageTitle: string;

    if (existingLink.rows.length > 0) {
      // Update existing page
      const existing = existingLink.rows[0];
      pageId = existing.page_id;

      // Get current page version for update
      const currentPage = await confluenceApi(sl.site_url, sl.access_token, `/pages/${pageId}`);
      const pageVersion = currentPage.version?.number || 1;

      await confluenceApi(sl.site_url, sl.access_token, `/pages/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify({
          id: pageId,
          status: 'current',
          title: artifact.title,
          body: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(adf),
          },
          version: { number: pageVersion + 1, message: `Updated from Meridian v${artifact.latest_version.version}` },
        }),
      });

      pageUrl = existing.page_url;
      pageTitle = artifact.title;

      await db.query(
        'UPDATE confluence_page_links SET page_title = $1, last_synced_at = now(), last_synced_version = $2 WHERE id = $3',
        [pageTitle, artifact.latest_version.version, existing.id],
      );
    } else {
      // Create new page
      // Look up space ID from space key
      const spaceData = await confluenceApi(sl.site_url, sl.access_token, `/spaces?keys=${sl.space_key}`);
      const spaceId = spaceData.results?.[0]?.id;
      if (!spaceId) throw new Error(`Confluence space "${sl.space_key}" not found`);

      const createBody: Record<string, unknown> = {
        spaceId,
        status: 'current',
        title: artifact.title,
        body: {
          representation: 'atlas_doc_format',
          value: JSON.stringify(adf),
        },
      };
      if (sl.parent_page_id) {
        createBody.parentId = sl.parent_page_id;
      }

      const newPage = await confluenceApi(sl.site_url, sl.access_token, '/pages', {
        method: 'POST',
        body: JSON.stringify(createBody),
      });

      pageId = String(newPage.id);
      pageTitle = artifact.title;
      pageUrl = `${sl.site_url}/wiki/spaces/${sl.space_key}/pages/${pageId}`;

      // Create page link
      const cplId = generateId('cpl');
      await db.query(
        `INSERT INTO confluence_page_links (id, org_id, artifact_id, space_link_id, page_id, page_title, page_url, sync_direction, last_synced_at, last_synced_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'publish', now(), $8)`,
        [cplId, orgId, artifactId, input.space_link_id, pageId, pageTitle, pageUrl, artifact.latest_version.version],
      );
    }

    return { page_id: pageId, page_title: pageTitle, page_url: pageUrl, version_synced: artifact.latest_version.version };
  },

  // ─── Pull (Confluence → Meridian) ───

  async pullPage(orgId: string, artifactId: string, input: PullFromConfluenceInput) {
    const spaceLink = await db.query(
      'SELECT csl.*, jc.site_url, jc.access_token FROM confluence_space_links csl JOIN jira_connections jc ON jc.id = csl.connection_id WHERE csl.id = $1 AND csl.org_id = $2',
      [input.space_link_id, orgId],
    );
    if (spaceLink.rows.length === 0) throw new NotFoundError('Confluence Space Link', input.space_link_id);
    const sl = spaceLink.rows[0];

    // Fetch page content as ADF
    const pageData = await confluenceApi(sl.site_url, sl.access_token, `/pages/${input.page_id}?body-format=atlas_doc_format`);
    const adfBody = pageData.body?.atlas_doc_format?.value;
    if (!adfBody) throw new Error('Page has no content');

    const adf: AdfDocument = typeof adfBody === 'string' ? JSON.parse(adfBody) : adfBody;
    const content = fromAdf(adf);
    const contentText = content.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');

    // Create new artifact version from Confluence content
    const version = await artifactService.createVersion(orgId, artifactId, 'confluence', {
      content,
      content_text: contentText,
    });

    // Create or update page link
    const existingLink = await db.query(
      'SELECT * FROM confluence_page_links WHERE artifact_id = $1 AND space_link_id = $2',
      [artifactId, input.space_link_id],
    );

    const pageTitle = pageData.title || 'Untitled';
    const pageUrl = `${sl.site_url}/wiki/spaces/${sl.space_key}/pages/${input.page_id}`;

    if (existingLink.rows.length === 0) {
      const cplId = generateId('cpl');
      await db.query(
        `INSERT INTO confluence_page_links (id, org_id, artifact_id, space_link_id, page_id, page_title, page_url, sync_direction, last_synced_at, last_synced_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pull', now(), $8)`,
        [cplId, orgId, artifactId, input.space_link_id, input.page_id, pageTitle, pageUrl, version.version],
      );
    } else {
      await db.query(
        'UPDATE confluence_page_links SET last_synced_at = now(), last_synced_version = $1, page_title = $2 WHERE id = $3',
        [version.version, pageTitle, existingLink.rows[0].id],
      );
    }

    return { artifact_id: artifactId, version: version.version, page_title: pageTitle };
  },

  // ─── Bulk Import ───

  async importSpace(orgId: string, flowId: string, input: ImportConfluenceSpaceInput) {
    const spaceLink = await db.query(
      'SELECT csl.*, jc.site_url, jc.access_token FROM confluence_space_links csl JOIN jira_connections jc ON jc.id = csl.connection_id WHERE csl.id = $1 AND csl.org_id = $2',
      [input.space_link_id, orgId],
    );
    if (spaceLink.rows.length === 0) throw new NotFoundError('Confluence Space Link', input.space_link_id);
    const sl = spaceLink.rows[0];

    // Look up space ID
    const spaceData = await confluenceApi(sl.site_url, sl.access_token, `/spaces?keys=${sl.space_key}`);
    const spaceId = spaceData.results?.[0]?.id;
    if (!spaceId) throw new Error(`Confluence space "${sl.space_key}" not found`);

    // Fetch pages
    let statusFilter = 'status=current';
    if (input.include_archived) {
      statusFilter = 'status=current,archived';
    }
    const pagesData = await confluenceApi(sl.site_url, sl.access_token, `/pages?space-id=${spaceId}&${statusFilter}&limit=100&body-format=atlas_doc_format`);
    const pages = pagesData.results || [];

    const imported: Array<{ artifact_id: string; page_id: string; page_title: string }> = [];

    for (const page of pages) {
      const pageId = String(page.id);
      const pageTitle = page.title as string;

      // Skip if already linked
      const existingLink = await db.query(
        'SELECT id FROM confluence_page_links WHERE page_id = $1 AND space_link_id = $2',
        [pageId, input.space_link_id],
      );
      if (existingLink.rows.length > 0) continue;

      // Create artifact
      const artifactId = generateId('art');
      await db.query(
        `INSERT INTO artifacts (id, org_id, flow_id, type, title, status)
         VALUES ($1, $2, $3, 'custom', $4, 'draft')`,
        [artifactId, orgId, flowId, pageTitle],
      );

      // Parse ADF content
      const adfBody = page.body?.atlas_doc_format?.value;
      if (adfBody) {
        const adf: AdfDocument = typeof adfBody === 'string' ? JSON.parse(adfBody) : adfBody;
        const content = fromAdf(adf);
        const contentText = content.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');

        await artifactService.createVersion(orgId, artifactId, 'confluence', {
          content,
          content_text: contentText,
        });
      }

      // Create page link
      const cplId = generateId('cpl');
      const pageUrl = `${sl.site_url}/wiki/spaces/${sl.space_key}/pages/${pageId}`;
      await db.query(
        `INSERT INTO confluence_page_links (id, org_id, artifact_id, space_link_id, page_id, page_title, page_url, sync_direction, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pull', now())`,
        [cplId, orgId, artifactId, input.space_link_id, pageId, pageTitle, pageUrl],
      );

      imported.push({ artifact_id: artifactId, page_id: pageId, page_title: pageTitle });
    }

    return { imported: imported.length, pages: imported };
  },

  // ─── Event Listeners ───

  setupEventListeners() {
    // Auto-publish to Confluence when artifact is approved
    eventBus.on('artifact.approved', async (event) => {
      const { org_id: orgId, entity_id: artifactId } = event;

      // Find all publish-direction page links for this artifact
      const links = await db.query(
        `SELECT cpl.*, csl.connection_id
         FROM confluence_page_links cpl
         JOIN confluence_space_links csl ON csl.id = cpl.space_link_id
         WHERE cpl.artifact_id = $1 AND cpl.org_id = $2 AND cpl.sync_direction = 'publish'`,
        [artifactId, orgId],
      );

      for (const link of links.rows) {
        try {
          await this.publishArtifact(orgId, artifactId, { space_link_id: link.space_link_id });
        } catch (err) {
          // Log but don't fail the approval flow
          console.error(`Failed to auto-publish artifact ${artifactId} to Confluence:`, err);
        }
      }
    });
  },
};
