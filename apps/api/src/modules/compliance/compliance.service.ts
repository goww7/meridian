import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import type { CreateComplianceReportInput, ComplianceReportSummary, ComplianceFinding } from '@meridian/shared';

// SOC 2 Trust Service Criteria controls
const SOC2_CONTROLS = [
  { control_id: 'CC1.1', control_name: 'Control Environment', category: 'Common Criteria', evidence_types: ['manual'] },
  { control_id: 'CC2.1', control_name: 'Information and Communication', category: 'Common Criteria', evidence_types: ['manual'] },
  { control_id: 'CC3.1', control_name: 'Risk Assessment', category: 'Common Criteria', evidence_types: ['security_scan'] },
  { control_id: 'CC4.1', control_name: 'Monitoring Activities', category: 'Common Criteria', evidence_types: ['test_result', 'security_scan'] },
  { control_id: 'CC5.1', control_name: 'Control Activities', category: 'Common Criteria', evidence_types: ['code_review', 'approval'] },
  { control_id: 'CC6.1', control_name: 'Logical and Physical Access', category: 'Common Criteria', evidence_types: ['security_scan', 'manual'] },
  { control_id: 'CC6.6', control_name: 'System Boundaries', category: 'Common Criteria', evidence_types: ['security_scan'] },
  { control_id: 'CC7.1', control_name: 'System Operations', category: 'Common Criteria', evidence_types: ['deployment', 'test_result'] },
  { control_id: 'CC7.2', control_name: 'Change Management', category: 'Common Criteria', evidence_types: ['code_review', 'approval', 'deployment'] },
  { control_id: 'CC8.1', control_name: 'Change Management Process', category: 'Common Criteria', evidence_types: ['code_review', 'approval'] },
  { control_id: 'A1.1', control_name: 'Availability Commitments', category: 'Availability', evidence_types: ['deployment', 'test_result'] },
  { control_id: 'PI1.1', control_name: 'Processing Integrity', category: 'Processing Integrity', evidence_types: ['test_result'] },
];

export const complianceService = {
  async createReport(orgId: string, userId: string, input: CreateComplianceReportInput) {
    const id = generateId('crpt');

    const result = await db.query(
      `INSERT INTO compliance_reports (id, org_id, framework, title, status, period_start, period_end, generated_by)
       VALUES ($1, $2, $3, $4, 'generating', $5, $6, $7) RETURNING *`,
      [id, orgId, input.framework, input.title, input.period_start, input.period_end, userId],
    );

    // Generate the report asynchronously (but inline for simplicity)
    this.generateReport(orgId, id, input.framework, input.period_start, input.period_end).catch((err) => {
      console.error('Failed to generate compliance report:', err);
    });

    return result.rows[0];
  },

  async generateReport(orgId: string, reportId: string, framework: string, periodStart: string, periodEnd: string) {
    // Gather all evidence within the period
    const evidenceResult = await db.query(
      `SELECT e.*, f.title as flow_title FROM evidence e
       JOIN flows f ON f.id = e.flow_id
       WHERE e.org_id = $1 AND e.created_at >= $2 AND e.created_at <= $3`,
      [orgId, periodStart, periodEnd],
    );
    const evidence = evidenceResult.rows;

    // Gather policy evaluations
    const policyEvalsResult = await db.query(
      `SELECT pe.*, p.name as policy_name, p.stage, p.severity
       FROM policy_evaluations pe JOIN policies p ON p.id = pe.policy_id
       WHERE pe.org_id = $1 AND pe.evaluated_at >= $2 AND pe.evaluated_at <= $3`,
      [orgId, periodStart, periodEnd],
    );
    const policyEvals = policyEvalsResult.rows;

    // Gather approvals
    const approvalsResult = await db.query(
      `SELECT * FROM approvals WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [orgId, periodStart, periodEnd],
    );

    // Get controls for this framework
    const controls = framework === 'soc2' ? SOC2_CONTROLS : SOC2_CONTROLS; // extend for other frameworks

    // Evaluate each control
    const findings: ComplianceFinding[] = controls.map((control) => {
      const relevantEvidence = evidence.filter((e: { type: string }) =>
        control.evidence_types.includes(e.type),
      );
      const passingEvidence = relevantEvidence.filter((e: { status: string }) => e.status === 'passing');
      const hasEvidence = relevantEvidence.length > 0;
      const allPassing = relevantEvidence.length > 0 && passingEvidence.length === relevantEvidence.length;

      let status: 'met' | 'partial' | 'unmet';
      const gaps: string[] = [];

      if (allPassing) {
        status = 'met';
      } else if (hasEvidence) {
        status = 'partial';
        const failingTypes = control.evidence_types.filter(
          (t) => !relevantEvidence.some((e: { type: string; status: string }) => e.type === t && e.status === 'passing'),
        );
        gaps.push(...failingTypes.map((t) => `Missing passing ${t.replace(/_/g, ' ')} evidence`));
      } else {
        status = 'unmet';
        gaps.push(`No ${control.evidence_types.join(' or ').replace(/_/g, ' ')} evidence collected`);
      }

      return {
        control_id: control.control_id,
        control_name: control.control_name,
        status,
        evidence_refs: relevantEvidence.map((e: { id: string }) => e.id),
        gaps,
      };
    });

    const totalControls = findings.length;
    const controlsMet = findings.filter((f) => f.status === 'met').length;
    const controlsPartial = findings.filter((f) => f.status === 'partial').length;
    const controlsUnmet = findings.filter((f) => f.status === 'unmet').length;

    const totalPolicyEvals = policyEvals.length || 1;
    const passingPolicyEvals = policyEvals.filter((pe: { result: string }) => pe.result === 'pass').length;

    const summary: ComplianceReportSummary = {
      total_controls: totalControls,
      controls_met: controlsMet,
      controls_partial: controlsPartial,
      controls_unmet: controlsUnmet,
      evidence_count: evidence.length,
      policy_pass_rate: passingPolicyEvals / totalPolicyEvals,
      findings,
    };

    const reportData = {
      evidence_summary: {
        total: evidence.length,
        by_type: evidence.reduce((acc: Record<string, number>, e: { type: string }) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {}),
        by_status: evidence.reduce((acc: Record<string, number>, e: { status: string }) => {
          acc[e.status] = (acc[e.status] || 0) + 1;
          return acc;
        }, {}),
      },
      policy_evaluations: {
        total: policyEvals.length,
        pass: passingPolicyEvals,
        fail: policyEvals.filter((pe: { result: string }) => pe.result === 'fail').length,
      },
      approvals: {
        total: approvalsResult.rows.length,
        approved: approvalsResult.rows.filter((a: { status: string }) => a.status === 'approved').length,
        rejected: approvalsResult.rows.filter((a: { status: string }) => a.status === 'rejected').length,
      },
    };

    await db.query(
      `UPDATE compliance_reports SET status = 'complete', summary = $1, report_data = $2, updated_at = now()
       WHERE id = $3 AND org_id = $4`,
      [JSON.stringify(summary), JSON.stringify(reportData), reportId, orgId],
    );
  },

  async list(orgId: string, framework?: string) {
    const conditions = ['org_id = $1'];
    const values: unknown[] = [orgId];
    let idx = 2;
    if (framework) { conditions.push(`framework = $${idx++}`); values.push(framework); }

    const result = await db.query(
      `SELECT * FROM compliance_reports WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      values,
    );
    return result.rows;
  },

  async getById(orgId: string, reportId: string) {
    const result = await db.query(
      `SELECT * FROM compliance_reports WHERE id = $1 AND org_id = $2`,
      [reportId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('ComplianceReport', reportId);
    return result.rows[0];
  },

  async getComplianceScore(orgId: string): Promise<{ score: number; by_framework: Record<string, number> }> {
    const result = await db.query(
      `SELECT framework, summary FROM compliance_reports
       WHERE org_id = $1 AND status = 'complete'
       ORDER BY created_at DESC`,
      [orgId],
    );

    if (result.rows.length === 0) return { score: 0, by_framework: {} };

    const byFramework: Record<string, number> = {};
    const seen = new Set<string>();

    for (const row of result.rows) {
      if (seen.has(row.framework)) continue;
      seen.add(row.framework);
      const summary = typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary;
      if (summary && summary.total_controls > 0) {
        byFramework[row.framework] = summary.controls_met / summary.total_controls;
      }
    }

    const scores = Object.values(byFramework);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return { score: avgScore, by_framework: byFramework };
  },
};
