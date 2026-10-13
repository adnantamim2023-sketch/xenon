// logic.js — Boolean Logic Solver: expression parser, truth table, and
// logic-circuit diagram drawer.
//
// Triggers on things like:
//   x = A' or a'+b' or (a'b)' or A AND B or NOT(a) XOR b or a nand b
// but must NOT trigger on ordinary words/math like "abs(-5)", "absolutely",
// "sin(30)", "2+3", "x^2 + 3x + 2 = 0", plain sentences, etc.
//
// Output follows the same conventions as the rest of Xenon's math engine:
// a { __html: true, text: '<div class="xetex-output">…</div>' } payload,
// built from xetex-* CSS classes (see xetex.css) plus a handful of new
// xetex-logic-* classes for the truth table and circuit diagram.

// ── Recognized function-style math names, so we never mistake e.g.
//    "abs(x)" or "sin(x)" for a logic expression just because it has a
//    single-letter variable inside it. ─────────────────────────────────
const LOGIC_EXCLUDED_MATH_WORDS = [
    'sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'asin', 'acos', 'atan',
    'log', 'log2', 'log10', 'log_base', 'ln', 'sqrt', 'cbrt', 'abs',
    'exp', 'factorial', 'mean', 'median', 'mode', 'variance', 'stddev',
    'gcd', 'lcm', 'fibonacci', 'isprime', 'primefactors', 'sum', 'product',
    'ncr', 'npr', 'dist', 'dist3d', 'midpoint', 'slope', 'trianglearea',
    'circlearea', 'rectanglearea', 'spherevolume', 'cylindervolume',
    'ap_sum', 'ap_term', 'gp_sum', 'gp_term', 'gp_infinite_sum',
];
const LOGIC_EXCLUDED_MATH_REGEX = new RegExp('\\b(' + LOGIC_EXCLUDED_MATH_WORDS.join('|') + ')\\b', 'i');

// ── Gate-style directive extraction ──────────────────────────────────
// Recognizes phrases like "using nand gates", "with nor gate only",
// "simple gates", "basic gates", "universal nand gate" tacked onto a
// logic expression, and strips them out before the expression itself
// is validated/parsed. Deliberately narrow — only matches when
// "gate(s)" (or "only") appears together with a nand/nor/simple/basic
// keyword, so ordinary uses of "nand"/"nor" as boolean operators (e.g.
// "a nand b") are left alone and still parsed as operators.
const LOGIC_GATE_STYLE_PATTERNS = [
    { style: 'nand', re: /\b(?:using|with|via|in terms of)?\s*nand\s*(?:gates?|only)\b/i },
    { style: 'nor', re: /\b(?:using|with|via|in terms of)?\s*nor\s*(?:gates?|only)\b/i },
    { style: 'simple', re: /\b(?:using|with)?\s*(?:simple|basic|normal|regular|ordinary)\s*gates?\b/i },
    // Matches only the exact phrase the "No" button sends (not ordinary
    // uses of the word "no" elsewhere), so declining a circuit diagram
    // doesn't get confused with plain English.
    { style: 'none', re: /\bno\s*circuit\s*diagram\b/i },
];

// Pulls a gate-style directive out of raw text, if present. Returns
// { style: 'nand'|'nor'|'simple'|null, rest: <text with the directive
// phrase removed> }.
function logicExtractGateStyle(text) {
    for (const { style, re } of LOGIC_GATE_STYLE_PATTERNS) {
        const m = text.match(re);
        if (m) {
            const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length))
                .replace(/\s{2,}/g, ' ')
                .replace(/\s+([,.;:])/g, '$1')
                .trim();
            return { style, rest };
        }
    }
    return { style: null, rest: text };
}

// Whole-word boolean operator names (in addition to symbolic operators).
const LOGIC_WORD_OPERATORS = ['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor'];
const LOGIC_WORD_OPERATOR_REGEX = new RegExp('\\b(' + LOGIC_WORD_OPERATORS.join('|') + ')\\b', 'i');

// A "plain English" filter: if the text contains common words that would
// never appear in a logic expression, bail out. This is what keeps
// something like "not absolutely sure about this" from ever being
// considered, even though it contains the word "not".
// Deliberately excludes single-letter words like "a" / "i" — those are
// exactly the shape a boolean variable takes, so they can't be used to
// disqualify a candidate expression.
const LOGIC_ENGLISH_STOPWORDS = [
    'the', 'is', 'are', 'was', 'were', 'an', 'to', 'of', 'in', 'on',
    'for', 'with', 'this', 'that', 'these', 'those', 'absolutely', 'sure',
    'please', 'can', 'you', 'we', 'it', 'my', 'your', 'me', 'us',
    'what', 'when', 'where', 'why', 'how', 'do', 'does', 'did', 'have',
    'has', 'had', 'will', 'would', 'should', 'could', 'about', 'like',
    'want', 'need', 'help', 'explain', 'tell', 'show', 'make', 'get',
];
const LOGIC_ENGLISH_STOPWORD_REGEX = new RegExp('\\b(' + LOGIC_ENGLISH_STOPWORDS.join('|') + ')\\b', 'i');

// Matches a boolean variable token: a single letter, optionally followed
// by digits (A, b, X1, y2 …). Deliberately excludes the two reserved
// literal digits 0/1 which are treated as constants, not variables.
const LOGIC_VAR_TOKEN_REGEX = /\b[a-zA-Z](\d*)\b/;

function logicStripAssignment(text) {
    // Strips a leading "x =" / "f(a,b) =" / "out=" style assignment target
    // so the rest can be parsed as a pure boolean expression. Only strips
    // when the left side is a short identifier (not a full expression),
    // so real equations like "2x + 3 = 7" are left alone for the algebra
    // engine to handle.
    const m = text.match(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*(?:\([a-zA-Z0-9,\s]*\))?\s*=\s*(.+)$/);
    if (!m) return { lhs: null, rhs: text };
    return { lhs: m[1], rhs: m[2] };
}

// The only letters the engine ever treats as boolean variables — kept
// in sync with the allowedVars check in logicHandle below. Used here so
// detection itself never mistakes an ordinary short word (like "no",
// "ok", "hi") for an implicit-AND variable chain just because its
// letters happen to be distinct.
const LOGIC_ALLOWED_VAR_LETTERS = new Set(['a', 'b', 'c', 'x', 'y', 'z']);
function logicIsAllowedVarLetter(ch) { return LOGIC_ALLOWED_VAR_LETTERS.has(ch.toLowerCase()); }

// A short list of common English words that happen to be 2-5 letters
// with no repeated letters (so they'd otherwise slip through the
// implicit-AND-chain allowance below, e.g. "solve" -> s,o,l,v,e are all
// distinct) — catches typical command verbs/fillers that show up right
// alongside a real expression, like "solve a+b" or "draw a xor b".
const LOGIC_COMMON_WORDS = new Set([
    'solve', 'draw', 'show', 'plot', 'find', 'get', 'make', 'give',
    'the', 'for', 'me', 'us', 'try', 'use', 'do', 'go', 'set', 'run',
    'graph', 'chart', 'help', 'need', 'want', 'like', 'about', 'this',
    'that', 'with', 'from', 'into', 'onto', 'via', 'is', 'are', 'was',
]);

// Returns true only for text that reads as a genuine boolean/logic
// expression. Errs on the side of NOT triggering for ambiguous input.
function isLogicExpression(text) {
    if (typeof text !== 'string') return false;
    let trimmed = text.trim();
    if (!trimmed) return false;
    if (trimmed.length > 200) return false; // guard against huge prose blobs

    // Strip a trailing/leading gate-style directive ("using nand gates",
    // "with simple gates", etc.) before running any of the checks below,
    // so a style-qualified message is validated purely on the boolean
    // expression it wraps.
    trimmed = logicExtractGateStyle(trimmed).rest.trim();
    if (!trimmed) return false;

    if (LOGIC_EXCLUDED_MATH_REGEX.test(trimmed)) return false;
    if (LOGIC_ENGLISH_STOPWORD_REGEX.test(trimmed)) return false;

    const { rhs } = logicStripAssignment(trimmed);
    const body = rhs.trim();
    if (!body) return false;

    // Reject a decimal point only when it sits between digits (a real
    // decimal number) — a bare "." elsewhere is the AND operator.
    if (/\d\.\d/.test(body)) return false;
    if (/[2-9]/.test(body)) return false;

    // Reject comparison/inequality operators — those belong to algebra,
    // not boolean expressions.
    if (/[<>≤≥≠]/.test(body)) return false;

    // Must contain at least one letter (a candidate boolean variable).
    if (!/[a-zA-Z]/.test(body)) return false;

    // Must contain at least one recognizable boolean operator: prime/NOT
    // marks, AND/OR symbols, or a whole-word operator like "and"/"xor".
    const hasPrime = /'/.test(body);
    const hasBangOrTilde = /[!~¬]/.test(body);
    const hasPlusOr = /\+/.test(body);
    const hasDotAnd = /[.*·]/.test(body);
    const hasWordOp = LOGIC_WORD_OPERATOR_REGEX.test(body);
    const hasParenJuxtaposition = /\)\s*\(|[a-zA-Z]\s*\(|\)\s*[a-zA-Z]/.test(body) && /[a-zA-Z]{2,}/.test(body.replace(/\s+/g, ''));

    const hasAnyOperator = hasPrime || hasBangOrTilde || hasPlusOr || hasDotAnd || hasWordOp;
    if (!hasAnyOperator) {
        // Bare juxtaposition like "ab" (implicit AND) with no other
        // operator is only accepted when the whole expression is a short
        // run of single, distinct letters (2-5 of them) — the shape of an
        // implicit AND chain of variables — and NOT any longer run that
        // would instead read as an ordinary word like "hello".
        const compact = body.replace(/\s+/g, '');
        if (!/^[a-zA-Z]+$/.test(compact)) return false;
        if (compact.length < 2 || compact.length > 5) return false;
        if (LOGIC_COMMON_WORDS.has(compact.toLowerCase())) return false;
        if (![...compact.toLowerCase()].every(logicIsAllowedVarLetter)) return false;
        const distinctVars = new Set(compact.toLowerCase().split(''));
        if (distinctVars.size !== compact.length) return false; // no repeats
        return true;
    }

    // At this point we know there's a recognized operator. Do one more
    // sanity pass: the expression, with all boolean syntax stripped out,
    // should have nothing left but variable letters/digits and
    // whitespace — i.e. it isn't a sentence that happens to contain
    // "and"/"or" as normal English words alongside other prose.
    const stripped = body
        .replace(LOGIC_WORD_OPERATOR_REGEX, ' ')
        .replace(/[a-zA-Z](\d*)/g, ' ')
        .replace(/['!~¬+.*·()\s]/g, '');
    if (stripped.length > 0) return false;

    // Guard against things like "a and the cat" slipping through: walk
    // the text word-by-word (a "word" here is a maximal run of letters
    // optionally followed by digits) and require each one to be either a
    // recognized operator word, or split further into single-letter
    // (+digit) variable tokens sitting side by side with implicit AND
    // between them (e.g. "ab" -> "a","b"; "ab1" -> "a","b1" is NOT
    // supported and is instead read as a single multi-char token, which
    // fails and correctly rejects real words like "hello").
    const words = body.match(/[a-zA-Z]+\d*/g) || [];
    for (const w of words) {
        const lw = w.toLowerCase();
        if (LOGIC_WORD_OPERATORS.includes(lw)) continue;
        if (/^[a-zA-Z]\d*$/.test(w) && logicIsAllowedVarLetter(w[0])) continue; // single-letter (+digits) variable
        // A run of multiple bare letters (no digits) is allowed only if
        // every letter is a distinct, allowed variable, e.g. "ab", "abc"
        // — this is implicit AND with no operator glyph between them.
        if (/^[a-zA-Z]+$/.test(w) && w.length <= 5) {
            if (LOGIC_COMMON_WORDS.has(lw)) return false;
            const letters = lw.split('');
            if (new Set(letters).size === letters.length && letters.every(logicIsAllowedVarLetter)) continue;
        }
        return false; // some other word — not a logic expression
    }

    return true;
}

// ── Tokenizer / Parser for boolean expressions ──────────────────────
// Grammar (highest to lowest precedence):
//   primary   := VAR | '0' | '1' | '(' expr ')' | primary "'"
//   not       := '!' not | '~' not | NOT not | primary
//   and       := not (( '.' | '*' | '·' | '' | AND ) not)*
//   xorlevel  := and ((XOR|XNOR) and)*
//   expr      := xorlevel (('+' | OR | NOR | NAND) xorlevel)*
//
// NAND/NOR are treated as OR-level binary ops that get NOTed afterward.

function logicTokenize(raw) {
    const tokens = [];
    let i = 0;
    const s = raw;
    while (i < s.length) {
        const ch = s[i];
        if (/\s/.test(ch)) { i++; continue; }

        if (/[a-zA-Z]/.test(ch)) {
            // Peek ahead to see if this run of letters+digits spells out
            // a whole-word operator (and/or/not/nand/nor/xor/xnor). If it
            // does, consume the whole run as that operator token.
            let j = i, word = '';
            while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) { word += s[j]; j++; }
            const lw = word.toLowerCase();
            if (lw === 'and') { tokens.push({ type: 'and' }); i = j; continue; }
            if (lw === 'nand') { tokens.push({ type: 'nand' }); i = j; continue; }
            if (lw === 'or') { tokens.push({ type: 'or' }); i = j; continue; }
            if (lw === 'nor') { tokens.push({ type: 'nor' }); i = j; continue; }
            if (lw === 'xor') { tokens.push({ type: 'xor' }); i = j; continue; }
            if (lw === 'xnor') { tokens.push({ type: 'xnor' }); i = j; continue; }
            if (lw === 'not') { tokens.push({ type: 'not' }); i = j; continue; }

            // Otherwise it's NOT a keyword — read it as a single-letter
            // variable (with optional trailing digits, e.g. "x1"), and
            // leave any further letters in the run to be read as
            // separate variables on the next loop iteration. This is
            // what makes "ab" parse as two variables A and B joined by
            // an implicit AND, rather than one variable named "AB".
            let name = ch; i++;
            while (i < s.length && /[0-9]/.test(s[i])) { name += s[i]; i++; }
            tokens.push({ type: 'var', name: name });
            continue;
        }
        if (ch === '0' || ch === '1') { tokens.push({ type: 'lit', value: ch === '1' }); i++; continue; }
        if (ch === "'") { tokens.push({ type: 'prime' }); i++; continue; }
        if (ch === '!' || ch === '~' || ch === '¬') { tokens.push({ type: 'not' }); i++; continue; }
        if (ch === '+') { tokens.push({ type: 'or' }); i++; continue; }
        if (ch === '.' || ch === '*' || ch === '·') { tokens.push({ type: 'and' }); i++; continue; }
        if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
        if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
        throw new Error(`Unrecognized character "${ch}" in logic expression.`);
    }
    return tokens;
}

function logicParse(tokens) {
    let pos = 0;
    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }

    function canStartPrimary(tok) {
        return tok && (tok.type === 'var' || tok.type === 'lit' || tok.type === 'lparen' || tok.type === 'not');
    }

    function parsePrimary() {
        const tok = peek();
        if (!tok) throw new Error('Expression ended unexpectedly.');
        let node;
        if (tok.type === 'not') {
            consume();
            node = { op: 'not', a: parsePrimary() };
        } else if (tok.type === 'lparen') {
            consume();
            node = parseExpr();
            const close = peek();
            if (!close || close.type !== 'rparen') throw new Error('Missing closing ")".');
            consume();
        } else if (tok.type === 'var') {
            consume();
            node = { op: 'var', name: tok.name };
        } else if (tok.type === 'lit') {
            consume();
            node = { op: 'lit', value: tok.value };
        } else {
            throw new Error('Expected a variable, "(", or NOT.');
        }
        // Postfix primes: a', a'', (a+b)' etc.
        while (peek() && peek().type === 'prime') {
            consume();
            node = { op: 'not', a: node };
        }
        return node;
    }

    function parseAnd() {
        let node = parsePrimary();
        while (true) {
            const tok = peek();
            if (tok && (tok.type === 'and' || tok.type === 'nand')) {
                const isNand = tok.type === 'nand';
                consume();
                const rhs = parsePrimary();
                node = { op: 'and', a: node, b: rhs };
                if (isNand) node = { op: 'not', a: node };
            } else if (tok && canStartPrimary(tok)) {
                // Implicit AND via juxtaposition, e.g. "ab" or "a(b+c)".
                const rhs = parsePrimary();
                node = { op: 'and', a: node, b: rhs };
            } else {
                break;
            }
        }
        return node;
    }

    function parseXor() {
        let node = parseAnd();
        while (peek() && (peek().type === 'xor' || peek().type === 'xnor')) {
            const isXnor = peek().type === 'xnor';
            consume();
            const rhs = parseAnd();
            node = { op: 'xor', a: node, b: rhs };
            if (isXnor) node = { op: 'not', a: node };
        }
        return node;
    }

    function parseExpr() {
        let node = parseXor();
        while (peek() && (peek().type === 'or' || peek().type === 'nor')) {
            const isNor = peek().type === 'nor';
            consume();
            const rhs = parseXor();
            node = { op: 'or', a: node, b: rhs };
            if (isNor) node = { op: 'not', a: node };
        }
        return node;
    }

    const result = parseExpr();
    if (pos < tokens.length) throw new Error('Unexpected extra input in logic expression.');
    return result;
}

function logicCollectVars(node, out) {
    if (node.op === 'var') { out.add(node.name.toUpperCase()); return; }
    if (node.op === 'lit') return;
    if (node.op === 'not') { logicCollectVars(node.a, out); return; }
    logicCollectVars(node.a, out);
    logicCollectVars(node.b, out);
}

function logicEvaluate(node, values) {
    switch (node.op) {
        case 'var': return !!values[node.name.toUpperCase()];
        case 'lit': return node.value;
        case 'not': return !logicEvaluate(node.a, values);
        case 'and': return logicEvaluate(node.a, values) && logicEvaluate(node.b, values);
        case 'or': return logicEvaluate(node.a, values) || logicEvaluate(node.b, values);
        case 'xor': return logicEvaluate(node.a, values) !== logicEvaluate(node.b, values);
        default: throw new Error('Unknown operator in expression tree.');
    }
}

// Renders the AST back into a normalized display string like "A'+B·C".
function logicToDisplayString(node) {
    function rec(n, parentPrec) {
        let str, prec;
        switch (n.op) {
            case 'var': return n.name.toUpperCase();
            case 'lit': return n.value ? '1' : '0';
            case 'not': {
                const inner = rec(n.a, 3);
                return (n.a.op === 'var' || n.a.op === 'lit') ? inner + "'" : '(' + inner + ")'";
            }
            case 'and':
                prec = 2;
                str = rec(n.a, 2) + rec(n.b, 2);
                return parentPrec > prec ? '(' + str + ')' : str;
            case 'xor':
                prec = 1.5;
                str = rec(n.a, 1.5) + ' ⊕ ' + rec(n.b, 1.5);
                return parentPrec > prec ? '(' + str + ')' : str;
            case 'or':
                prec = 1;
                str = rec(n.a, 1) + ' + ' + rec(n.b, 1);
                return parentPrec > prec ? '(' + str + ')' : str;
        }
    }
    return rec(node, 0);
}

// ── Truth table HTML ─────────────────────────────────────────────────
function logicBuildTruthTable(node, varList) {
    const n = varList.length;
    let thead = '<thead><tr>';
    varList.forEach(v => thead += `<th>${v}</th>`);
    thead += '<th>Output</th></tr></thead>';

    let tbody = '<tbody>';
    const rows = [];
    for (let i = 0; i < (1 << n); i++) {
        const values = {};
        for (let b = 0; b < n; b++) {
            values[varList[b]] = !!((i >> (n - 1 - b)) & 1);
        }
        const out = logicEvaluate(node, values);
        rows.push({ values, out });
        tbody += '<tr>';
        varList.forEach(v => tbody += `<td>${values[v] ? 1 : 0}</td>`);
        tbody += `<td class="xetex-logic-out-${out ? '1' : '0'}">${out ? 1 : 0}</td>`;
        tbody += '</tr>';
    }
    tbody += '</tbody>';

    // Up to 3 variables (4 columns total including Output) comfortably
    // stretches to fill the bubble width. Beyond that, columns would get
    // squeezed unreadably thin if forced to fit — instead let the table
    // size itself naturally and let the wrapper scroll horizontally.
    const totalCols = n + 1;
    const wrapClass = totalCols > 4 ? 'xetex-table-wrap xetex-logic-table-wrap-scroll' : 'xetex-table-wrap';

    return {
        html: `<div class="${wrapClass}"><table class="xetex-table xetex-logic-table">${thead}${tbody}</table></div>`,
        rows,
    };
}

// ── Simplification (very small, well-known Boolean algebra identities) ──
// Not a full Quine–McCluskey minimizer — applies common identities
// repeatedly until nothing more changes, which is enough for typical
// student-level expressions (double negation, idempotence, identity,
// domination, complement, absorption, De Morgan).
function logicNodeEquals(a, b) {
    if (a.op !== b.op) return false;
    if (a.op === 'var') return a.name.toUpperCase() === b.name.toUpperCase();
    if (a.op === 'lit') return a.value === b.value;
    if (a.op === 'not') return logicNodeEquals(a.a, b.a);
    return (logicNodeEquals(a.a, b.a) && logicNodeEquals(a.b, b.b)) ||
           (logicNodeEquals(a.a, b.b) && logicNodeEquals(a.b, b.a));
}

function logicIsComplementOf(a, b) {
    if (a.op === 'not' && logicNodeEquals(a.a, b)) return true;
    if (b.op === 'not' && logicNodeEquals(b.a, a)) return true;
    return false;
}

function logicSimplifyOnce(node) {
    if (node.op === 'var' || node.op === 'lit') return node;

    if (node.op === 'not') {
        const a = logicSimplifyOnce(node.a);
        if (a.op === 'not') return a.a; // double negation: (A')' = A
        if (a.op === 'lit') return { op: 'lit', value: !a.value };
        // De Morgan: (A·B)' = A' + B'   and   (A+B)' = A'·B'
        if (a.op === 'and') return { op: 'or', a: { op: 'not', a: a.a }, b: { op: 'not', a: a.b } };
        if (a.op === 'or') return { op: 'and', a: { op: 'not', a: a.a }, b: { op: 'not', a: a.b } };
        return { op: 'not', a };
    }

    const a = logicSimplifyOnce(node.a);
    const b = logicSimplifyOnce(node.b);

    if (node.op === 'and') {
        if (a.op === 'lit') return a.value ? b : { op: 'lit', value: false };          // 1·B=B, 0·B=0
        if (b.op === 'lit') return b.value ? a : { op: 'lit', value: false };          // A·1=A, A·0=0
        if (logicNodeEquals(a, b)) return a;                                            // A·A=A
        if (logicIsComplementOf(a, b)) return { op: 'lit', value: false };              // A·A'=0
        // Absorption: A·(A+B) = A
        if (b.op === 'or' && (logicNodeEquals(a, b.a) || logicNodeEquals(a, b.b))) return a;
        if (a.op === 'or' && (logicNodeEquals(b, a.a) || logicNodeEquals(b, a.b))) return b;
        return { op: 'and', a, b };
    }

    if (node.op === 'or') {
        if (a.op === 'lit') return a.value ? { op: 'lit', value: true } : b;           // 1+B=1, 0+B=B
        if (b.op === 'lit') return b.value ? { op: 'lit', value: true } : a;           // A+1=1, A+0=A
        if (logicNodeEquals(a, b)) return a;                                            // A+A=A
        if (logicIsComplementOf(a, b)) return { op: 'lit', value: true };               // A+A'=1
        // Absorption: A+(A·B) = A
        if (b.op === 'and' && (logicNodeEquals(a, b.a) || logicNodeEquals(a, b.b))) return a;
        if (a.op === 'and' && (logicNodeEquals(b, a.a) || logicNodeEquals(b, a.b))) return b;
        return { op: 'or', a, b };
    }

    if (node.op === 'xor') {
        if (a.op === 'lit') return a.value ? { op: 'not', a: b } : b;
        if (b.op === 'lit') return b.value ? { op: 'not', a: a } : a;
        if (logicNodeEquals(a, b)) return { op: 'lit', value: false };
        return { op: 'xor', a, b };
    }

    return node;
}

function logicNodeSize(node) {
    if (node.op === 'var' || node.op === 'lit') return 1;
    if (node.op === 'not') return 1 + logicNodeSize(node.a);
    return 1 + logicNodeSize(node.a) + logicNodeSize(node.b);
}

function logicSimplify(node) {
    let current = node;
    for (let i = 0; i < 25; i++) {
        const next = logicSimplifyOnce(current);
        if (logicNodeEquals(next, current) && logicNodeSize(next) === logicNodeSize(current)) break;
        current = next;
    }
    return current;
}

// ── Circuit diagram (SVG) ────────────────────────────────────────────
// Lays gates out left-to-right by the AST's depth (inputs on the left,
// final output on the right), matching the visual convention of a
// standard logic-circuit schematic: AND = D-shaped body, OR = curved
// shield shape, NOT = triangle + bubble, XOR = OR shape with a double
// input curve.
//
// Each *occurrence* of a variable gets its own row (not one shared row
// per variable name) — e.g. in "AB + A'B'", A is used twice and each
// use gets its own horizontal lane, fed from a shared labeled input dot
// on the far left via a short branch wire. Without this, unrelated
// gates that happen to sit at the same column (like a bare AND next to
// another branch's NOT gates) would be forced onto the same row and
// drawn on top of each other.

const LOGIC_GATE_H = 34;     // gate body height
const LOGIC_COL_W = 90;      // horizontal spacing between logic-depth columns
const LOGIC_ROW_H = 40;      // vertical spacing between leaf lanes

function logicAssignLayout(node) {
    // Assigns each node a "column" = distance (in gate-stages) from the
    // leaves along the longest path to that node.
    function annotate(n) {
        if (n.op === 'var' || n.op === 'lit') { n._col = 0; return 0; }
        if (n.op === 'not') { const d = annotate(n.a); n._col = d + 1; return n._col; }
        const da = annotate(n.a), db = annotate(n.b);
        n._col = Math.max(da, db) + 1;
        return n._col;
    }
    annotate(node);
    return node;
}

// Evenly-spaced vertical offsets for a gate's input taps, scaling with
// how many inputs it has (2-input gates get the original ±8 spacing;
// 3+ input gates spread further apart but stay inside the gate body's
// height so the stubs land cleanly on the curved front edge).
function logicGateInputOffsets(n) {
    if (n <= 1) return [0];
    const spread = Math.min(26, 8 * n);
    const step = spread / (n - 1);
    const start = -spread / 2;
    return Array.from({ length: n }, (_, i) => start + i * step);
}

function logicGateSVG(x, y, kind, label) {
    // x,y = left-center anchor of the gate body (the point where the
    // input wires arrive). Returns { svg, outX, midY }.
    const w = 44, h = LOGIC_GATE_H;
    const top = y - h / 2, bot = y + h / 2;
    let body = '';
    let labelX = x + w / 2; // default centroid guess, refined per-shape below
    const bubR = 4;
    // NAND/NOR reserve a little extra room on the right for the small
    // output bubble that marks the inversion, same convention as NOT.
    const bodyW = (kind === 'nand' || kind === 'nor') ? w - bubR * 2 : w;

    if (kind === 'and' || kind === 'nand') {
        const straightEndX = x + bodyW * 0.55;
        body = `<path d="M ${x} ${top} L ${straightEndX} ${top} A ${h / 2} ${h / 2} 0 0 1 ${straightEndX} ${bot} L ${x} ${bot} Z" class="xetex-shape-line xetex-shape-fill" />`;
        // Visual mass sits between the flat back (x) and the curved
        // front's furthest point — centroid is roughly midway, slightly
        // biased toward the back since the rounded nose tapers.
        labelX = (x + x + bodyW) / 2 - 2;
        if (kind === 'nand') {
            body += `<circle cx="${x + bodyW + bubR}" cy="${y}" r="${bubR}" class="xetex-shape-line xetex-shape-fill" />`;
        }
    } else if (kind === 'or' || kind === 'xor' || kind === 'nor' || kind === 'xnor') {
        const bx = x - 10;
        body = `<path d="M ${bx} ${top} Q ${x + 14} ${top} ${x + bodyW} ${y} Q ${x + 14} ${bot} ${bx} ${bot} Q ${bx + 12} ${y} ${bx} ${top} Z" class="xetex-shape-line xetex-shape-fill" />`;
        if (kind === 'xor' || kind === 'xnor') {
            body += `<path d="M ${bx - 6} ${top} Q ${bx + 6} ${y} ${bx - 6} ${bot}" class="xetex-shape-line" fill="none" />`;
        }
        if (kind === 'nor' || kind === 'xnor') {
            body += `<circle cx="${x + bodyW + bubR}" cy="${y}" r="${bubR}" class="xetex-shape-line xetex-shape-fill" />`;
        }
        // The shield shape spans from its concave back (~bx+4) to its
        // pointed tip; its visual centroid sits left of the midpoint
        // since the shape tapers to a point on the right.
        labelX = (bx + 4 + x + bodyW) / 2 - 4;
    } else if (kind === 'not') {
        body = `<path d="M ${x} ${top} L ${x} ${bot} L ${x + w - bubR * 2} ${y} Z" class="xetex-shape-line xetex-shape-fill" />` +
               `<circle cx="${x + w - bubR}" cy="${y}" r="${bubR}" class="xetex-shape-line xetex-shape-fill" />`;
        // Triangle centroid (excluding the small output bubble) is 1/3
        // of the way from the flat back to the tip.
        const tipX = x + w - bubR * 2;
        labelX = x + (tipX - x) / 3;
    }

    return {
        svg: body + (label ? `<text x="${labelX}" y="${y}" class="xetex-shape-slabel xetex-logic-gate-label">${label}</text>` : ''),

        outX: x + w,
        midY: y,
    };
}

// ── Universal-gate (NAND-only / NOR-only) conversion ─────────────────
// Rewrites a simplified AND/OR/NOT/XOR tree into an equivalent tree
// built from a single gate type, following the standard textbook
// identities:
//
//   NOT(a)   = NAND(a, a)                  = NOR(a, a)
//   AND(a,b) = NAND(NAND(a,b), NAND(a,b))  = NOR(NOR(a,a), NOR(b,b))
//   OR(a,b)  = NAND(NAND(a,a), NAND(b,b))  = NOR(NOR(a,b), NOR(a,b))
//
// XOR/XNOR are first expanded into AND/OR/NOT (a⊕b = ab'+a'b) and then
// the same substitution is applied recursively, matching the way the
// source textbook builds XOR/XNOR out of NAND/NOR in multiple stages.
//
// The converted tree uses two new node kinds, 'nand2' and 'nor2', each
// with two child slots — a NOT emulation simply repeats the same child
// in both slots (so the circuit drawer can still treat every node
// uniformly as a 2-input gate).

function logicExpandXorNodes(node) {
    // Replaces every xor/xnor node with its AND/OR/NOT expansion so the
    // universal-gate substitution only ever has to handle and/or/not.
    if (node.op === 'var' || node.op === 'lit') return node;
    if (node.op === 'not') return { op: 'not', a: logicExpandXorNodes(node.a) };
    if (node.op === 'and' || node.op === 'or') {
        return { op: node.op, a: logicExpandXorNodes(node.a), b: logicExpandXorNodes(node.b) };
    }
    if (node.op === 'xor') {
        const a = logicExpandXorNodes(node.a);
        const b = logicExpandXorNodes(node.b);
        // a⊕b = a·b' + a'·b
        return {
            op: 'or',
            a: { op: 'and', a: a, b: { op: 'not', a: b } },
            b: { op: 'and', a: { op: 'not', a: a }, b: b },
        };
    }
    throw new Error('Unsupported operator in XOR expansion.');
}

function logicToUniversalGate(node, style) {
    const gateOp = style === 'nand' ? 'nand' : 'nor';

    function convert(n) {
        if (n.op === 'var' || n.op === 'lit') return n;

        if (n.op === 'not') {
            const a = convert(n.a);
            return { op: gateOp, args: [a, a] }; // NOT(a) = gate(a,a)
        }

        const a = convert(n.a);
        const b = convert(n.b);

        if (style === 'nand') {
            if (n.op === 'and') {
                const first = { op: 'nand', args: [a, b] };
                return { op: 'nand', args: [first, first] }; // AND = NAND(NAND(a,b)) twice
            }
            // OR(a,b) = NAND(NAND(a,a), NAND(b,b))
            const notA = { op: 'nand', args: [a, a] };
            const notB = { op: 'nand', args: [b, b] };
            return { op: 'nand', args: [notA, notB] };
        } else {
            if (n.op === 'or') {
                const first = { op: 'nor', args: [a, b] };
                return { op: 'nor', args: [first, first] }; // OR = NOR(NOR(a,b)) twice
            }
            // AND(a,b) = NOR(NOR(a,a), NOR(b,b))
            const notA = { op: 'nor', args: [a, a] };
            const notB = { op: 'nor', args: [b, b] };
            return { op: 'nor', args: [notA, notB] };
        }
    }

    return convert(node);
}

// Flattens a chain of the given binary op into a flat list of operands,
// e.g. flatten(OR(OR(a,b),c), 'or') -> [a,b,c]. Anything that isn't
// that same op is treated as a terminal term as-is (var, lit, or a
// whole subtree) — used to detect the clean multi-term SOP/POS shape
// the textbook's minimal 2-level NAND-NAND / NOR-NOR realization
// applies to.
function logicFlattenChain(node, op) {
    if (node.op === op) {
        return logicFlattenChain(node.a, op).concat(logicFlattenChain(node.b, op));
    }
    return [node];
}

// Detects the classic 2-level SOP shape (OR of AND-terms of plain
// literals — style 'nand') or the dual POS shape (AND of OR-terms —
// style 'nor'), and when it matches, builds the textbook-standard
// minimal circuit directly: one gate per term producing its complement,
// plus one final multi-input gate combining them — e.g.
// X = BC+AC+AB -> NAND(NAND(B,C), NAND(A,C), NAND(A,B)).
// This is what the source textbook actually draws; the generic
// recursive logicToUniversalGate above is logically correct for any
// expression but uses far more gates than this minimal form for a
// plain multi-term SOP/POS, so it's only used as a fallback when this
// shape doesn't apply (NOT/XOR present inside a term, etc.).
function logicMinimalUniversalGate(node, style) {
    const outerOp = style === 'nand' ? 'or' : 'and';
    const innerOp = style === 'nand' ? 'and' : 'or';
    const gateOp = style === 'nand' ? 'nand' : 'nor';

    if (node.op !== outerOp) return null;
    const terms = logicFlattenChain(node, outerOp);
    if (terms.length < 2) return null;

    const termLiterals = terms.map(t => {
        if (t.op === 'var' || t.op === 'lit') return [t];
        if (t.op === innerOp) {
            const lits = logicFlattenChain(t, innerOp);
            return lits.every(l => l.op === 'var' || l.op === 'lit') ? lits : null;
        }
        return null; // NOT, XOR, or other nesting inside a term — bail out
    });
    if (termLiterals.some(l => !l)) return null;

    const termGates = termLiterals.map(lits =>
        lits.length === 1 ? { op: gateOp, args: [lits[0], lits[0]] } : { op: gateOp, args: lits }
    );
    return { op: gateOp, args: termGates };
}

// Renders the algebraic step lines shown above the circuit — mirrors
// the textbook's habit of writing the double-complement / De Morgan
// substitution explicitly before drawing gates. Built directly from
// the AST (not string-mangled) so it's always structurally correct.
//
// For AND at the top level (NAND style) or OR at the top level (NOR
// style), the gate IS the node itself — a single double-complement
// line is enough: Y = AB -> Y = ((AB)')'.
//
// For OR at the top level (NAND style) or AND at the top level (NOR
// style), one more De Morgan step is needed to turn the outer bar into
// a NAND/NOR of the (still-barred) operands, since a NAND/NOR gate
// naturally produces a bar over its whole output:
//   Y = A+B -> Y = ((A+B)')' -> apply De Morgan inside: (A+B)' = A'B'
//            -> Y = (A'B')'   <- this literal form IS NAND(A',B')
function logicUniversalGateSteps(node, style) {
    const bar = (s) => `<span class="xetex-logic-overline">${s}</span>`;
    const disp = (n) => logicToDisplayString(n);

    // Only meaningful (and shown) for a top-level AND or OR node — a
    // bare variable, NOT, or single literal doesn't need a rewrite step
    // since it's already a single gate (or no gate at all).
    if (node.op !== 'and' && node.op !== 'or') return [];

    const original = disp(node);
    const lines = [bar(bar(`(${original})`))];

    const isDirectGate = (style === 'nand' && node.op === 'and') || (style === 'nor' && node.op === 'or');
    if (isDirectGate) {
        // The double-complemented form already reads as gate(gate(a,b)):
        // no further rewrite needed — the single line above is the
        // whole derivation.
        return lines;
    }

    // Otherwise: apply De Morgan to the inner single bar. Flatten the
    // OR/AND chain into its individual terms (any count, not just 2) and
    // bar each one — producing the complemented-operand form that is
    // literally NAND(t1',t2',...) or NOR(t1',t2',...).
    const terms = logicFlattenChain(node, node.op);
    const joiner = node.op === 'or' ? ' · ' : ' + ';
    const barredTerms = terms.map(t => bar(disp(t))).join(joiner);
    lines.push(bar(`(${barredTerms})`));

    return lines;
}

// Ties together the XOR-expansion, universal-gate substitution, and
// step-line rendering into the single call logicHandle needs.
function logicConvertToUniversalGate(node, style) {
    const expanded = logicExpandXorNodes(node);
    const steps = logicUniversalGateSteps(expanded, style);
    const ast = logicMinimalUniversalGate(expanded, style) || logicToUniversalGate(expanded, style);
    return { ast, steps };
}

// ── Circuit drawer for the NAND-only / NOR-only universal-gate tree ──
// Structurally similar to logicBuildCircuit, but every internal node is
// a uniform 2-input nand2/nor2 gate, and — importantly — the converted
// tree reuses the *same node object* in multiple places (e.g. a NOT
// emulation feeds the same subtree into both gate inputs, and the
// AND/OR substitutions reuse one sub-gate's output twice). This
// function draws each unique node only once and lets every consumer
// wire to that single output point, which naturally produces the
// fan-out branches seen in the textbook diagrams.
function logicBuildUniversalCircuit(node, varList, style) {
    const gateKind = style === 'nand' ? 'nand' : 'nor';
    const colW = LOGIC_COL_W;
    const topPad = 30;
    const rowH = LOGIC_ROW_H;

    // Vertical input rails (bus lines), staggered in x like a textbook
    // diagram: one per distinct variable, running the full height of
    // the circuit, spaced generously apart (not cramped), each capped
    // with a short T-tick at the top (the textbook's input-terminal
    // mark) and tapped into gates via plain line joins — no dots.
    const railGap = 45, railStartX = 45;
    const railX = {};
    varList.forEach((v, i) => { railX[v] = railStartX + i * railGap; });
    const leftPad = railStartX + Math.max(varList.length - 1, 0) * railGap + 45;

    // Column = distance from leaves, memoized per unique node object so
    // a shared subtree only gets computed once (and both references
    // agree on the same column).
    const colCache = new Map();
    function colOf(n) {
        if (colCache.has(n)) return colCache.get(n);
        let c;
        if (n.op === 'var' || n.op === 'lit') c = 0;
        else c = Math.max(...n.args.map(colOf)) + 1;
        colCache.set(n, c);
        return c;
    }
    const maxCol = colOf(node);

    // Row assignment: every leaf OCCURRENCE (not shared node) gets its
    // own lane. Since converted gate nodes can be shared/reused, we walk
    // with a memo keyed by node identity for internal nodes (their row
    // is the average of children, computed once and reused), but leaves
    // are walked per-occurrence in the original pre-conversion sense —
    // here, since var nodes from the original AST are copied by
    // reference into the converted tree without duplication, each var
    // node object IS one occurrence, so identity-based row assignment
    // naturally gives each occurrence its own lane too.
    let leafCount = 0;
    const leafOrder = [];
    const rowCache = new Map();
    function rowOf(n) {
        if (rowCache.has(n)) return rowCache.get(n);
        let r;
        if (n.op === 'var') {
            r = leafCount++;
            leafOrder.push(n.name.toUpperCase());
        } else if (n.op === 'lit') {
            r = leafCount++;
            leafOrder.push(null);
        } else {
            const rows = n.args.map(rowOf);
            r = rows.reduce((a, b) => a + b, 0) / rows.length;
        }
        rowCache.set(n, r);
        return r;
    }
    rowOf(node);

    const height = Math.max(leafCount * rowH + topPad * 2, 140);
    function rowY(row) { return topPad + row * rowH + rowH / 2; }

    // One labeled input dot per distinct variable name, positioned at
    // the average of that variable's occurrence rows, with short branch
    // wires out to each occurrence's own lane (same convention as the
    // simple-gate circuit drawer).
    const varOccurrenceRows = {};
    leafOrder.forEach((name, row) => {
        if (name === null) return;
        (varOccurrenceRows[name] = varOccurrenceRows[name] || []).push(row);
    });
    const varInputRow = {};
    varList.forEach(v => {
        const rows = varOccurrenceRows[v] || [];
        varInputRow[v] = rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : 0;
    });

    let svgParts = [];
    let wireParts = [];

    // All rails share the same top height (aligned labels, like the
    // book), even though each variable's first tap sits at a different
    // row — only the bottom end trails off at each variable's own last
    // use.
    const sharedRailTop = rowY(0) - 20;

    // Draw each variable's rail top-to-bottom, capped with a short T-tick
    // (the textbook's input-terminal mark), and tapped into the gate
    // area via plain horizontal stubs — no dot markers at the joins,
    // matching the book's clean line-only style.
    varList.forEach(v => {
        const x = railX[v];
        const rows = varOccurrenceRows[v] || [];
        const ys = rows.map(rowY);
        const railBottom = Math.max(...ys);
        wireParts.push(`<line x1="${x}" y1="${sharedRailTop}" x2="${x}" y2="${railBottom}" class="xetex-shape-line" />`);
        wireParts.push(`<line x1="${x - 8}" y1="${sharedRailTop}" x2="${x + 8}" y2="${sharedRailTop}" class="xetex-shape-line" />`);
        svgParts.push(`<text x="${x}" y="${sharedRailTop - 8}" class="xetex-shape-vlabel" style="font-size:12px;text-anchor:middle;">${v}</text>`);
        ys.forEach(y => {
            wireParts.push(`<line x1="${x}" y1="${y}" x2="${leftPad}" y2="${y}" class="xetex-shape-line" />`);
        });
    });

    // Memoized emit: a shared node is drawn once, and its output point
    // is cached so every consumer wires to the same spot (fan-out).
    const emitCache = new Map();
    function emit(n) {
        if (emitCache.has(n)) return emitCache.get(n);
        let out;
        if (n.op === 'var' || n.op === 'lit') {
            out = { x: leftPad, y: rowY(rowOf(n)) };
        } else {
            const x = leftPad + colOf(n) * colW - 30;
            const midY = rowY(rowOf(n));
            const isSelfNot = n.args.length === 2 && n.args[0] === n.args[1]; // NOT emulation: gate(a,a)

            if (isSelfNot) {
                // Single-input NOT-via-self-gate: one incoming wire, no
                // fan-in junction needed.
                const src = emit(n.args[0]);
                wireParts.push(`<line x1="${src.x}" y1="${src.y}" x2="${x}" y2="${midY}" class="xetex-shape-line" />`);
            } else {
                const offsets = logicGateInputOffsets(n.args.length);
                n.args.forEach((arg, i) => {
                    const src = emit(arg);
                    const tapY = midY + offsets[i];
                    wireParts.push(`<line x1="${src.x}" y1="${src.y}" x2="${x}" y2="${src.y}" class="xetex-shape-line" />`);
                    wireParts.push(`<line x1="${x}" y1="${src.y}" x2="${x}" y2="${tapY}" class="xetex-shape-line" />`);
                });
            }
            const g = logicGateSVG(x, midY, gateKind, gateKind.toUpperCase());
            svgParts.push(g.svg);
            out = { x: g.outX, y: g.midY };
        }
        emitCache.set(n, out);
        return out;
    }

    const finalOut = emit(node);
    const totalWidth = leftPad + (maxCol + 1) * colW + 40;
    wireParts.push(`<line x1="${finalOut.x}" y1="${finalOut.y}" x2="${totalWidth - 20}" y2="${finalOut.y}" class="xetex-shape-line" />`);
    svgParts.push(`<text x="${totalWidth - 6}" y="${finalOut.y + 4}" class="xetex-shape-vlabel" style="font-size:12px;">Y</text>`);

    const viewW = Math.max(totalWidth, 200);
    const viewH = Math.max(height, 120);

    return `<div class="xetex-shape-wrap xetex-logic-circuit-wrap"><svg class="xetex-shape-svg xetex-logic-circuit-svg" viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${wireParts.join('')}${svgParts.join('')}</svg></div>`;
}

function logicBuildCircuit(node, varList) {
    logicAssignLayout(node);
    const maxCol = node._col;
    const colW = LOGIC_COL_W;
    const topPad = 30;
    const rowH = LOGIC_ROW_H;
    const railGap = 45, railStartX = 45;
    const railX = {};
    varList.forEach((v, i) => { railX[v] = railStartX + i * railGap; });
    const leftPad = railStartX + Math.max(varList.length - 1, 0) * railGap + 45;

    // ── Pass 1: give every leaf OCCURRENCE its own row lane ───────────
    // (not one shared row per variable name), so two separate uses of
    // the same variable — e.g. both A's in "AB + A'B'" — never fight
    // over the same horizontal line once they diverge into different
    // gates.
    let leafCount = 0;
    const leafRows = []; // row index -> variable name, in left-to-right leaf order
    function assignRows(n) {
        if (n.op === 'var') {
            n._row = leafCount;
            leafRows.push(n.name.toUpperCase());
            leafCount++;
            return n._row;
        }
        if (n.op === 'lit') {
            n._row = leafCount;
            leafRows.push(null);
            leafCount++;
            return n._row;
        }
        if (n.op === 'not') {
            n._row = assignRows(n.a);
            return n._row;
        }
        const ra = assignRows(n.a), rb = assignRows(n.b);
        n._row = (ra + rb) / 2;
        return n._row;
    }
    assignRows(node);

    const height = Math.max(leafCount * rowH + topPad * 2, 140);

    // ── Pass 2: figure out each variable's single input-dot row (the
    // leftmost dot on the far left, one per distinct variable name) so
    // multiple occurrences can branch out from it. Placed at the
    // average of that variable's own leaf-occurrence rows, for a tidy
    // single branch point. ──────────────────────────────────────────
    const varOccurrenceRows = {};
    leafRows.forEach((name, row) => {
        if (name === null) return;
        (varOccurrenceRows[name] = varOccurrenceRows[name] || []).push(row);
    });
    const varInputRow = {};
    varList.forEach(v => {
        const rows = varOccurrenceRows[v] || [];
        varInputRow[v] = rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : 0;
    });

    function rowY(row) { return topPad + row * rowH + rowH / 2; }

    let svgParts = [];
    let wireParts = [];

    const sharedRailTop = rowY(0) - 20;

    // Draw each variable's rail top-to-bottom, capped with a short T-tick
    // above the topmost tap, tapped into the gate area via plain
    // horizontal stubs — no dot markers, matching the book's style.
    varList.forEach(v => {
        const x = railX[v];
        const rows = varOccurrenceRows[v] || [];
        const ys = rows.map(rowY);
        const railBottom = Math.max(...ys);
        wireParts.push(`<line x1="${x}" y1="${sharedRailTop}" x2="${x}" y2="${railBottom}" class="xetex-shape-line" />`);
        wireParts.push(`<line x1="${x - 8}" y1="${sharedRailTop}" x2="${x + 8}" y2="${sharedRailTop}" class="xetex-shape-line" />`);
        svgParts.push(`<text x="${x}" y="${sharedRailTop - 8}" class="xetex-shape-vlabel" style="font-size:12px;text-anchor:middle;">${v}</text>`);
        ys.forEach(y => {
            wireParts.push(`<line x1="${x}" y1="${y}" x2="${leftPad}" y2="${y}" class="xetex-shape-line" />`);
        });
    });

    let nextId = 0;
    // Recursively emits a node, returning { x, y } — the point where
    // this node's output wire begins.
    function emit(n) {
        if (n.op === 'var') {
            return { x: leftPad, y: rowY(n._row) };
        }
        if (n.op === 'lit') {
            return { x: leftPad, y: rowY(n._row), isLit: true, litVal: n.value };
        }

        if (n.op === 'not') {
            const src = emit(n.a);
            const x = leftPad + (n.a._col + 1) * colW - 30;
            const y = src.y;
            if (x > src.x) wireParts.push(`<line x1="${src.x}" y1="${src.y}" x2="${x}" y2="${y}" class="xetex-shape-line" />`);
            const g = logicGateSVG(x, y, 'not');
            svgParts.push(g.svg);
            return { x: g.outX, y: g.midY };
        }

        // binary and/or/xor
        const srcA = emit(n.a);
        const srcB = emit(n.b);
        const x = leftPad + n._col * colW - 30;
        const midY = rowY(n._row);
        wireParts.push(`<line x1="${srcA.x}" y1="${srcA.y}" x2="${x}" y2="${srcA.y}" class="xetex-shape-line" />`);
        wireParts.push(`<line x1="${x}" y1="${srcA.y}" x2="${x}" y2="${midY - 8}" class="xetex-shape-line" />`);
        wireParts.push(`<line x1="${srcB.x}" y1="${srcB.y}" x2="${x}" y2="${srcB.y}" class="xetex-shape-line" />`);
        wireParts.push(`<line x1="${x}" y1="${srcB.y}" x2="${x}" y2="${midY + 8}" class="xetex-shape-line" />`);
        const g = logicGateSVG(x, midY, n.op, n.op.toUpperCase());
        svgParts.push(g.svg);
        return { x: g.outX, y: g.midY };
    }

    const finalOut = emit(node);
    const totalWidth = leftPad + (maxCol + 1) * colW + 40;
    // Final output wire + label.
    wireParts.push(`<line x1="${finalOut.x}" y1="${finalOut.y}" x2="${totalWidth - 20}" y2="${finalOut.y}" class="xetex-shape-line" />`);
    svgParts.push(`<text x="${totalWidth - 6}" y="${finalOut.y + 4}" class="xetex-shape-vlabel" style="font-size:12px;">Y</text>`);

    const viewW = Math.max(totalWidth, 200);
    const viewH = Math.max(height, 120);

    return `<div class="xetex-shape-wrap xetex-logic-circuit-wrap"><svg class="xetex-shape-svg xetex-logic-circuit-svg" viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${wireParts.join('')}${svgParts.join('')}</svg></div>`;
}

// ── Main handler ─────────────────────────────────────────────────────
function logicHandle(rawText) {
    const { style, rest } = logicExtractGateStyle(rawText);
    const trimmed = rest.trim();

    if (!style) {
        return logicBuildGateStyleQuestion(trimmed);
    }

    const { lhs, rhs } = logicStripAssignment(trimmed);
    const outName = (lhs || 'Y').toUpperCase();

    let ast;
    try {
        const tokens = logicTokenize(rhs);
        ast = logicParse(tokens);
    } catch (err) {
        return { __html: true, text: `<div class="xetex-output"><div class="xetex-error">Couldn't parse that as a logic expression — ${err.message}</div></div>` };
    }

    const varSet = new Set();
    logicCollectVars(ast, varSet);
    const varList = Array.from(varSet).sort();

    if (varList.length === 0) {
        return { __html: true, text: `<div class="xetex-output"><div class="xetex-error">No boolean variables found to build a truth table from.</div></div>` };
    }

    // This solver is deliberately scoped to A, B, C, X, Y, Z (matching
    // the textbook-style problems it's built around) — anything else
    // (D, M, subscripted names, etc.) is rejected here with a clear
    // message rather than silently drawing something that doesn't match
    // the expected convention.
    const allowedVars = ['A', 'B', 'C', 'X', 'Y', 'Z'];
    const disallowed = varList.filter(v => !allowedVars.includes(v));
    if (disallowed.length > 0) {
        return { __html: true, text: `<div class="xetex-output"><div class="xetex-note">This solver only supports variables A, B, C, X, Y, and Z — found ${disallowed.join(', ')}. Try rewriting the expression using just those letters.</div></div>` };
    }
    if (varList.length > 5) {
        return { __html: true, text: `<div class="xetex-output"><div class="xetex-note">That expression uses ${varList.length} variables — truth tables are capped at 5 variables (32 rows) to stay readable. Try a smaller expression.</div></div>` };
    }

    const simplified = logicSimplify(ast);
    const originalDisplay = logicToDisplayString(ast);
    const simplifiedDisplay = logicToDisplayString(simplified);
    const wasSimplified = originalDisplay !== simplifiedDisplay;

    const { html: tableHTML } = logicBuildTruthTable(ast, varList);

    const parts = [];
    parts.push('<div class="xetex-output">');
    parts.push(`<div class="xetex-equation">${outName} = ${originalDisplay}</div>`);

    let stepN = 1;
    if (wasSimplified) {
        parts.push(`<div class="xetex-step"><div class="xetex-step-num">${stepN}</div><div class="xetex-step-body">Simplify using Boolean algebra</div></div>`);
        parts.push(`<div class="xetex-indent">${outName} = ${simplifiedDisplay}</div>`);
        stepN++;
    }

    // For NAND-only / NOR-only builds, show the universal-gate algebraic
    // rewrite (double-complement / De Morgan substitution) the same way
    // the textbook does, before drawing the circuit made only of that
    // one gate type.
    let circuitAst = simplified;
    if (style === 'nand' || style === 'nor') {
        const conversion = logicConvertToUniversalGate(simplified, style);
        parts.push(`<div class="xetex-step"><div class="xetex-step-num">${stepN}</div><div class="xetex-step-body">Rewrite using only ${style.toUpperCase()} gates</div></div>`);
        conversion.steps.forEach(line => {
            parts.push(`<div class="xetex-indent">${outName} = ${line}</div>`);
        });
        stepN++;
        circuitAst = conversion.ast;
    }

    parts.push(`<div class="xetex-step"><div class="xetex-step-num">${stepN}</div><div class="xetex-step-body">Truth table</div></div>`);
    parts.push(`<div class="xetex-logic-table-container">${tableHTML}</div>`);
    stepN++;

    if (style !== 'none') {
        const gateStyleLabel = style === 'nand' ? 'NAND gates only' : style === 'nor' ? 'NOR gates only' : 'simple gates';
        parts.push(`<div class="xetex-step"><div class="xetex-step-num">${stepN}</div><div class="xetex-step-body">Logic circuit — ${gateStyleLabel}</div></div>`);
        const circuitHTML = (style === 'nand' || style === 'nor')
            ? logicBuildUniversalCircuit(circuitAst, varList, style)
            : logicBuildCircuit(circuitAst, varList);
        parts.push(circuitHTML);
    }

    parts.push(`<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">${outName} = ${simplifiedDisplay}</span></div>`);
    parts.push('</div>');

    return { __html: true, text: parts.join('') };
}

// Renders the "which gate style?" question card shown when a logic
// expression is detected but no style was specified in the message.
// Buttons re-fill the input with the same expression plus the chosen
// style phrase and send it, so the next turn hits the style-aware path
// above directly.
function logicBuildGateStyleQuestion(expr) {
    const escaped = expr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const send = (suffix) => `var ta=document.getElementById('userInput'); if(ta){ ta.value = "/logic ${escaped} ${suffix}"; ta.dispatchEvent(new Event('input')); } if (typeof sendMessage === 'function') sendMessage();`;
    const html = `<div class="xetex-output"><div class="xetex-logic-question">` +
        `<div class="xetex-logic-question-prompt">Want me to solve <strong>${expr}</strong> as a logic circuit? If so, which gates should I build it with?</div>` +
        `<div class="xetex-logic-question-options">` +
        `<button type="button" class="xetex-logic-option-btn" onclick="${send('using simple gates').replace(/"/g, '&quot;')}">Simple gates<span class="xetex-logic-option-sub">AND / OR / NOT</span></button>` +
        `<button type="button" class="xetex-logic-option-btn" onclick="${send('using nand gates').replace(/"/g, '&quot;')}">NAND only</button>` +
        `<button type="button" class="xetex-logic-option-btn" onclick="${send('using nor gates').replace(/"/g, '&quot;')}">NOR only</button>` +
        `<button type="button" class="xetex-logic-option-btn xetex-logic-option-no" onclick="${send('no circuit diagram').replace(/"/g, '&quot;')}">No<span class="xetex-logic-option-sub">Just the truth table</span></button>` +
        `</div></div></div>`;
    return { __html: true, text: html };
}

window.isLogicExpression = isLogicExpression;
window.logicHandle = logicHandle;
