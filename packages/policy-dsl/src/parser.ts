/**
 * Policy DSL Parser
 *
 * Parses human-readable policy definitions into an AST.
 *
 * Syntax:
 *   policy "policy-name" {
 *     stage: release
 *     severity: blocking
 *     description: "Require security scan for high sensitivity flows"
 *     when flow.sensitivity in ["high", "critical"] {
 *       require evidence.types_passing contains "security_scan"
 *       require artifacts.approved contains "test_plan"
 *       require tasks.completion_ratio >= 0.9
 *     }
 *   }
 */

export interface PolicyAST {
  name: string;
  stage: string;
  severity: string;
  description?: string;
  when?: ConditionNode[];
  require: ConditionNode[];
}

export interface ConditionNode {
  field: string;
  operator: string;
  value: unknown;
}

interface Token {
  type: 'keyword' | 'string' | 'number' | 'ident' | 'operator' | 'brace' | 'bracket' | 'colon' | 'comma' | 'eof';
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set(['policy', 'stage', 'severity', 'description', 'when', 'require']);
const OPERATORS = new Set(['==', '!=', '>=', '<=', '>', '<', 'in', 'not_in', 'contains', 'exists']);

class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(private source: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos]!;

      // Skip comments
      if (ch === '/' && this.source[this.pos + 1] === '/') {
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') this.pos++;
        continue;
      }

      if (ch === '{' || ch === '}') {
        tokens.push({ type: 'brace', value: ch, line: this.line, col: this.col });
        this.advance();
      } else if (ch === '[' || ch === ']') {
        tokens.push({ type: 'bracket', value: ch, line: this.line, col: this.col });
        this.advance();
      } else if (ch === ':') {
        tokens.push({ type: 'colon', value: ':', line: this.line, col: this.col });
        this.advance();
      } else if (ch === ',') {
        tokens.push({ type: 'comma', value: ',', line: this.line, col: this.col });
        this.advance();
      } else if (ch === '"') {
        tokens.push(this.readString());
      } else if (ch === '>' || ch === '<' || ch === '!' || ch === '=') {
        tokens.push(this.readOperator());
      } else if (this.isDigit(ch) || (ch === '-' && this.pos + 1 < this.source.length && this.isDigit(this.source[this.pos + 1]!))) {
        tokens.push(this.readNumber());
      } else if (this.isIdentStart(ch)) {
        tokens.push(this.readIdentOrKeyword());
      } else {
        throw new ParseError(`Unexpected character '${ch}'`, this.line, this.col);
      }
    }
    tokens.push({ type: 'eof', value: '', line: this.line, col: this.col });
    return tokens;
  }

  private advance() { this.pos++; this.col++; }

  private skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === '\n') { this.pos++; this.line++; this.col = 1; }
      else if (ch === ' ' || ch === '\t' || ch === '\r') { this.pos++; this.col++; }
      else break;
    }
  }

  private readString(): Token {
    const startCol = this.col;
    this.advance(); // skip opening "
    let value = '';
    while (this.pos < this.source.length && this.source[this.pos]! !== '"') {
      if (this.source[this.pos]! === '\\') { this.advance(); value += this.source[this.pos] || ''; }
      else { value += this.source[this.pos]!; }
      this.advance();
    }
    if (this.pos >= this.source.length) throw new ParseError('Unterminated string', this.line, startCol);
    this.advance(); // skip closing "
    return { type: 'string', value, line: this.line, col: startCol };
  }

  private readNumber(): Token {
    const startCol = this.col;
    let value = '';
    if (this.source[this.pos] === '-') { value += '-'; this.advance(); }
    while (this.pos < this.source.length && (this.isDigit(this.source[this.pos]!) || this.source[this.pos] === '.')) {
      value += this.source[this.pos]!;
      this.advance();
    }
    return { type: 'number', value, line: this.line, col: startCol };
  }

  private readOperator(): Token {
    const startCol = this.col;
    let value: string = this.source[this.pos]!;
    this.advance();
    if (this.pos < this.source.length && this.source[this.pos] === '=') {
      value += '=';
      this.advance();
    }
    return { type: 'operator', value, line: this.line, col: startCol };
  }

  private readIdentOrKeyword(): Token {
    const startCol = this.col;
    let value = '';
    while (this.pos < this.source.length && this.isIdentChar(this.source[this.pos]!)) {
      value += this.source[this.pos]!;
      this.advance();
    }
    if (KEYWORDS.has(value)) return { type: 'keyword', value, line: this.line, col: startCol };
    if (OPERATORS.has(value)) return { type: 'operator', value, line: this.line, col: startCol };
    if (value === 'true' || value === 'false') return { type: 'number', value, line: this.line, col: startCol };
    return { type: 'ident', value, line: this.line, col: startCol };
  }

  private isDigit(ch: string) { return ch >= '0' && ch <= '9'; }
  private isIdentStart(ch: string) { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'; }
  private isIdentChar(ch: string) { return this.isIdentStart(ch) || this.isDigit(ch) || ch === '.' || ch === '-'; }
}

export class ParseError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`Parse error at line ${line}, col ${col}: ${message}`);
  }
}

class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  parse(): PolicyAST {
    this.expect('keyword', 'policy');
    const name = this.expect('string').value;
    this.expect('brace', '{');

    let stage = '';
    let severity = 'blocking';
    let description: string | undefined;
    const whenConditions: ConditionNode[] = [];
    const requireConditions: ConditionNode[] = [];

    while (!this.check('brace', '}') && !this.check('eof')) {
      const token = this.peek();

      if (token.type === 'keyword' && token.value === 'stage') {
        this.advance();
        this.expect('colon');
        stage = this.expectIdent().value;
      } else if (token.type === 'keyword' && token.value === 'severity') {
        this.advance();
        this.expect('colon');
        severity = this.expectIdent().value;
      } else if (token.type === 'keyword' && token.value === 'description') {
        this.advance();
        this.expect('colon');
        description = this.expect('string').value;
      } else if (token.type === 'keyword' && token.value === 'when') {
        this.advance();
        // Parse when conditions until {
        while (!this.check('brace', '{')) {
          whenConditions.push(this.parseCondition());
        }
        this.expect('brace', '{');
        // Parse require conditions inside when block
        while (!this.check('brace', '}')) {
          if (this.check('keyword', 'require')) {
            this.advance();
            requireConditions.push(this.parseCondition());
          } else {
            throw new ParseError(`Expected 'require', got '${this.peek().value}'`, this.peek().line, this.peek().col);
          }
        }
        this.expect('brace', '}');
      } else if (token.type === 'keyword' && token.value === 'require') {
        this.advance();
        requireConditions.push(this.parseCondition());
      } else {
        throw new ParseError(`Unexpected token '${token.value}'`, token.line, token.col);
      }
    }

    this.expect('brace', '}');

    if (!stage) throw new ParseError('Missing required field: stage', 0, 0);
    if (requireConditions.length === 0) throw new ParseError('Policy must have at least one require condition', 0, 0);

    return {
      name,
      stage,
      severity,
      description,
      when: whenConditions.length > 0 ? whenConditions : undefined,
      require: requireConditions,
    };
  }

  parseMultiple(): PolicyAST[] {
    const policies: PolicyAST[] = [];
    while (!this.check('eof')) {
      policies.push(this.parse());
    }
    return policies;
  }

  private parseCondition(): ConditionNode {
    const field = this.expectIdent().value;
    const operatorToken = this.expect('operator');
    const value = this.parseValue();
    return { field, operator: operatorToken.value, value };
  }

  private parseValue(): unknown {
    const token = this.peek();
    if (token.type === 'string') { this.advance(); return token.value; }
    if (token.type === 'number') {
      this.advance();
      if (token.value === 'true') return true;
      if (token.value === 'false') return false;
      return token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value, 10);
    }
    if (token.type === 'ident') { this.advance(); return token.value; }
    if (token.type === 'bracket' && token.value === '[') return this.parseArray();
    throw new ParseError(`Expected value, got '${token.value}'`, token.line, token.col);
  }

  private parseArray(): unknown[] {
    this.expect('bracket', '[');
    const values: unknown[] = [];
    while (!this.check('bracket', ']')) {
      values.push(this.parseValue());
      if (this.check('comma')) this.advance();
    }
    this.expect('bracket', ']');
    return values;
  }

  private peek(): Token { return this.tokens[this.pos]!; }
  private advance(): Token { return this.tokens[this.pos++]!; }

  private check(type: string, value?: string): boolean {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }

  private expect(type: string, value?: string): Token {
    const t = this.advance();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new ParseError(`Expected ${type}${value ? ` '${value}'` : ''}, got ${t.type} '${t.value}'`, t.line, t.col);
    }
    return t;
  }

  private expectIdent(): Token {
    const t = this.advance();
    if (t.type !== 'ident' && t.type !== 'keyword') {
      throw new ParseError(`Expected identifier, got ${t.type} '${t.value}'`, t.line, t.col);
    }
    return t;
  }
}

export function parsePolicy(source: string): PolicyAST {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

export function parsePolicies(source: string): PolicyAST[] {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseMultiple();
}
