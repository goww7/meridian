import { describe, it, expect } from 'vitest';
import { toAdf, fromAdf } from './confluence.adf.js';
import type { AdfDocument } from './confluence.adf.js';
import type { ArtifactContent } from '@meridian/shared';

describe('ADF Converter: toAdf', () => {
  it('should convert a simple section to ADF', () => {
    const content: ArtifactContent = {
      sections: [
        { id: 's1', title: 'Overview', content: 'This is the overview.' },
      ],
    };

    const adf = toAdf(content);
    expect(adf.type).toBe('doc');
    expect(adf.version).toBe(1);
    expect(adf.content).toHaveLength(2); // heading + paragraph
    expect(adf.content[0]).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Overview' }],
    });
    expect(adf.content[1]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'This is the overview.' }],
    });
  });

  it('should split multi-paragraph content', () => {
    const content: ArtifactContent = {
      sections: [
        { id: 's1', title: 'Intro', content: 'First paragraph.\n\nSecond paragraph.' },
      ],
    };

    const adf = toAdf(content);
    // heading + 2 paragraphs
    expect(adf.content).toHaveLength(3);
    expect(adf.content[1]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'First paragraph.' }],
    });
    expect(adf.content[2]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Second paragraph.' }],
    });
  });

  it('should handle subsections as nested headings', () => {
    const content: ArtifactContent = {
      sections: [
        {
          id: 's1',
          title: 'Architecture',
          content: 'Overview of the architecture.',
          subsections: [
            { id: 's1_1', title: 'Frontend', content: 'React-based SPA.' },
            { id: 's1_2', title: 'Backend', content: 'Node.js with Fastify.' },
          ],
        },
      ],
    };

    const adf = toAdf(content);
    // h1 + para + h2 + para + h2 + para = 6 nodes
    expect(adf.content).toHaveLength(6);
    expect(adf.content[0].type).toBe('heading');
    expect((adf.content[0] as any).attrs.level).toBe(1);
    expect(adf.content[2].type).toBe('heading');
    expect((adf.content[2] as any).attrs.level).toBe(2);
    expect(adf.content[4].type).toBe('heading');
    expect((adf.content[4] as any).attrs.level).toBe(2);
  });

  it('should handle multiple top-level sections', () => {
    const content: ArtifactContent = {
      sections: [
        { id: 's1', title: 'Summary', content: 'The summary.' },
        { id: 's2', title: 'Details', content: 'The details.' },
        { id: 's3', title: 'Conclusion', content: 'The conclusion.' },
      ],
    };

    const adf = toAdf(content);
    // 3 headings + 3 paragraphs = 6
    expect(adf.content).toHaveLength(6);
  });

  it('should handle empty content gracefully', () => {
    const content: ArtifactContent = { sections: [] };
    const adf = toAdf(content);
    expect(adf.content).toHaveLength(1); // fallback empty paragraph
    expect(adf.content[0].type).toBe('paragraph');
  });

  it('should handle section with no content', () => {
    const content: ArtifactContent = {
      sections: [{ id: 's1', title: 'Empty Section', content: '' }],
    };
    const adf = toAdf(content);
    // Just the heading, no paragraph for empty content
    expect(adf.content).toHaveLength(1);
    expect(adf.content[0].type).toBe('heading');
  });

  it('should cap heading levels at 6', () => {
    const content: ArtifactContent = {
      sections: [{
        id: 's1', title: 'L1', content: '',
        subsections: [{
          id: 's1_1', title: 'L2', content: '',
          subsections: [{
            id: 's1_1_1', title: 'L3', content: '',
            subsections: [{
              id: 's1_1_1_1', title: 'L4', content: '',
              subsections: [{
                id: 's1_1_1_1_1', title: 'L5', content: '',
                subsections: [{
                  id: 's1_deep', title: 'L6+', content: 'Deep content.',
                }],
              }],
            }],
          }],
        }],
      }],
    };
    const adf = toAdf(content);
    const headings = adf.content.filter((n) => n.type === 'heading') as any[];
    const levels = headings.map((h) => h.attrs.level);
    // Should never exceed 6
    expect(Math.max(...levels)).toBeLessThanOrEqual(6);
  });
});

describe('ADF Converter: fromAdf', () => {
  it('should convert ADF with headings and paragraphs', () => {
    const adf: AdfDocument = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Overview' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
      ],
    };

    const content = fromAdf(adf);
    expect(content.sections).toHaveLength(1);
    expect(content.sections[0].title).toBe('Overview');
    expect(content.sections[0].content).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('should handle multiple h1 sections', () => {
    const adf: AdfDocument = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Intro' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Intro text.' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Details' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Detail text.' }] },
      ],
    };

    const content = fromAdf(adf);
    expect(content.sections).toHaveLength(2);
    expect(content.sections[0].title).toBe('Intro');
    expect(content.sections[0].content).toBe('Intro text.');
    expect(content.sections[1].title).toBe('Details');
    expect(content.sections[1].content).toBe('Detail text.');
  });

  it('should parse subsections from h2 headings', () => {
    const adf: AdfDocument = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Architecture' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Arch overview.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Frontend' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'React stuff.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Backend' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Node stuff.' }] },
      ],
    };

    const content = fromAdf(adf);
    expect(content.sections).toHaveLength(1);
    expect(content.sections[0].title).toBe('Architecture');
    expect(content.sections[0].content).toBe('Arch overview.');
    expect(content.sections[0].subsections).toHaveLength(2);
    expect(content.sections[0].subsections![0].title).toBe('Frontend');
    expect(content.sections[0].subsections![0].content).toBe('React stuff.');
    expect(content.sections[0].subsections![1].title).toBe('Backend');
    expect(content.sections[0].subsections![1].content).toBe('Node stuff.');
  });

  it('should handle content before any heading', () => {
    const adf: AdfDocument = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Some preamble text.' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Section' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Section content.' }] },
      ],
    };

    const content = fromAdf(adf);
    expect(content.sections).toHaveLength(2);
    expect(content.sections[0].title).toBe('Overview'); // auto-generated
    expect(content.sections[0].content).toBe('Some preamble text.');
    expect(content.sections[1].title).toBe('Section');
  });

  it('should handle empty ADF document', () => {
    const adf: AdfDocument = { type: 'doc', version: 1, content: [] };
    const content = fromAdf(adf);
    expect(content.sections).toHaveLength(0);
  });

  it('should skip rule nodes', () => {
    const adf: AdfDocument = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Test' }] },
        { type: 'rule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'After rule.' }] },
      ],
    };

    const content = fromAdf(adf);
    expect(content.sections).toHaveLength(1);
    expect(content.sections[0].content).toBe('After rule.');
  });

  it('should generate unique section IDs', () => {
    const adf: AdfDocument = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'B' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'C' }] },
      ],
    };

    const content = fromAdf(adf);
    const ids = content.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(3); // all unique
  });
});

describe('ADF Converter: roundtrip', () => {
  it('should preserve content through toAdf → fromAdf', () => {
    const original: ArtifactContent = {
      sections: [
        { id: 's1', title: 'Summary', content: 'Executive summary of the project.' },
        {
          id: 's2', title: 'Requirements', content: 'Top-level requirements.',
          subsections: [
            { id: 's2_1', title: 'Functional', content: 'Must do X and Y.' },
            { id: 's2_2', title: 'Non-Functional', content: 'Must be fast.' },
          ],
        },
        { id: 's3', title: 'Timeline', content: 'Q1 2026 delivery.' },
      ],
    };

    const adf = toAdf(original);
    const roundtripped = fromAdf(adf);

    // Titles and content should match (IDs will be regenerated)
    expect(roundtripped.sections).toHaveLength(3);
    expect(roundtripped.sections[0].title).toBe('Summary');
    expect(roundtripped.sections[0].content).toBe('Executive summary of the project.');
    expect(roundtripped.sections[1].title).toBe('Requirements');
    expect(roundtripped.sections[1].content).toBe('Top-level requirements.');
    expect(roundtripped.sections[1].subsections).toHaveLength(2);
    expect(roundtripped.sections[1].subsections![0].title).toBe('Functional');
    expect(roundtripped.sections[1].subsections![0].content).toBe('Must do X and Y.');
    expect(roundtripped.sections[1].subsections![1].title).toBe('Non-Functional');
    expect(roundtripped.sections[1].subsections![1].content).toBe('Must be fast.');
    expect(roundtripped.sections[2].title).toBe('Timeline');
    expect(roundtripped.sections[2].content).toBe('Q1 2026 delivery.');
  });
});
