/**
 * ADF (Atlassian Document Format) ↔ Meridian ArtifactContent converter.
 *
 * Meridian stores: { sections: [{ id, title, content, subsections? }] }
 * Confluence uses ADF: { type: "doc", version: 1, content: [...nodes] }
 */

import type { ArtifactContent, ArtifactSection } from '@meridian/shared';

// ─── ADF Node Types ───

interface AdfTextNode {
  type: 'text';
  text: string;
  marks?: Array<{ type: string }>;
}

interface AdfHeadingNode {
  type: 'heading';
  attrs: { level: number };
  content: AdfTextNode[];
}

interface AdfParagraphNode {
  type: 'paragraph';
  content: AdfTextNode[];
}

interface AdfRuleNode {
  type: 'rule';
}

type AdfNode = AdfHeadingNode | AdfParagraphNode | AdfRuleNode;

export interface AdfDocument {
  type: 'doc';
  version: 1;
  content: AdfNode[];
}

// ─── Meridian → ADF ───

function sectionToAdf(section: ArtifactSection, level: number): AdfNode[] {
  const nodes: AdfNode[] = [];

  // Section heading
  nodes.push({
    type: 'heading',
    attrs: { level: Math.min(level, 6) },
    content: [{ type: 'text', text: section.title }],
  });

  // Section content — split by double newlines into paragraphs
  if (section.content) {
    const paragraphs = section.content.split(/\n\n+/).filter(Boolean);
    for (const para of paragraphs) {
      nodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: para.trim() }],
      });
    }
  }

  // Subsections at next heading level
  if (section.subsections) {
    for (const sub of section.subsections) {
      nodes.push(...sectionToAdf(sub, level + 1));
    }
  }

  return nodes;
}

export function toAdf(content: ArtifactContent): AdfDocument {
  const nodes: AdfNode[] = [];

  for (const section of content.sections) {
    nodes.push(...sectionToAdf(section, 1));
  }

  // Ensure at least one node (Confluence requires non-empty body)
  if (nodes.length === 0) {
    nodes.push({
      type: 'paragraph',
      content: [{ type: 'text', text: '' }],
    });
  }

  return { type: 'doc', version: 1, content: nodes };
}

// ─── ADF → Meridian ───

function extractText(node: AdfNode): string {
  if ('content' in node && Array.isArray(node.content)) {
    return node.content
      .filter((n): n is AdfTextNode => n.type === 'text')
      .map((n) => n.text)
      .join('');
  }
  return '';
}

export function fromAdf(adf: AdfDocument): ArtifactContent {
  const sections: ArtifactSection[] = [];
  let currentSection: ArtifactSection | null = null;
  let currentSubsection: ArtifactSection | null = null;
  let sectionCounter = 0;

  for (const node of adf.content) {
    if (node.type === 'heading') {
      const title = extractText(node);
      const level = node.attrs.level;

      if (level === 1) {
        // New top-level section
        sectionCounter++;
        currentSubsection = null;
        currentSection = {
          id: `s${sectionCounter}`,
          title,
          content: '',
          subsections: [],
        };
        sections.push(currentSection);
      } else if (currentSection) {
        // Subsection
        currentSubsection = {
          id: `${currentSection.id}_sub${(currentSection.subsections?.length || 0) + 1}`,
          title,
          content: '',
        };
        if (!currentSection.subsections) currentSection.subsections = [];
        currentSection.subsections.push(currentSubsection);
      }
    } else if (node.type === 'paragraph') {
      const text = extractText(node);
      if (!text) continue;

      // Append to the most specific active section
      const target = currentSubsection || currentSection;
      if (target) {
        target.content = target.content ? target.content + '\n\n' + text : text;
      } else {
        // Content before any heading — create an implicit section
        sectionCounter++;
        currentSection = {
          id: `s${sectionCounter}`,
          title: 'Overview',
          content: text,
          subsections: [],
        };
        sections.push(currentSection);
      }
    }
    // Skip rule nodes and other non-content nodes
  }

  return { sections };
}
