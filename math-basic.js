const MATH_UNICODE_OPERATORS = [
    '+', '-', '−',
    '*', '×', '⋅',
    '/', '÷',
    '^',
    '%',
    '!',
    '±', '∓',
    '√', '∛', '∜',
    'π',
    '∞',
    '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹',
    '=', '≠',
    '<', '>',
    '≤', '≥',
    '≈', '≅',
];

const MATH_UNICODE_REGEX = new RegExp(
    '[' + MATH_UNICODE_OPERATORS.map(ch =>
        ch.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('') + ']'
);

const SCIENTIFIC_NUMBER_REGEX = /\d+(?:\.\d+)?[eE][+-]?\d+/g;
const SCIENTIFIC_PAREN_EXPONENT_REGEX = /\d+(?:\.\d+)?[eE]\([^()]*\)/g;

const MATH_FUNCTION_NAMES = (typeof mathKeywords !== 'undefined')
    ? mathKeywords
        .filter(k => k.key.endsWith('('))
        .map(k => k.key.slice(0, -1))
        .filter(name => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name))
    : [
        'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
        'asin', 'acos', 'atan',
        'log', 'ln', 'sqrt', 'exp', 'abs',
    ];
const MATH_FUNCTION_REGEX = new RegExp('\\b(' + MATH_FUNCTION_NAMES.join('|') + ')\\b', 'gi');

function isFunctionCall(text) {
    if (!MATH_FUNCTION_NAMES.length) return false;
    const fnRegex = new RegExp('\\b(' + MATH_FUNCTION_NAMES.join('|') + ')\\s*\\(', 'i');
    return fnRegex.test(text);
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-EXPRESSION SPLITTING
// Splits "A or B" / "A and B" into independent expressions.
// ═══════════════════════════════════════════════════════════════════

function mathSplitMultiExpression(text) {
    var t = String(text || '').trim();
    t = t.replace(/\b(sin|cos|tan|csc|sec|cot|asin|acos|atan|ln|log|sqrt|cbrt|abs|exp)\s*(-?\d+(?:\.\d+)?)/gi,
        function(_, fn, num) { return fn + '(' + num + ')'; });
    var parts = t.split(/\s+(?:or|and)\s+/i).map(function(p) { return p.trim(); }).filter(Boolean);
    if (parts.length < 2) return null;
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!/\d/.test(p)) return null;
        if (!/[\+\-\*\/\^\(]/.test(p) && !/\b(sin|cos|tan|ln|log|sqrt|abs|exp)\b/i.test(p)) return null;
    }
    return parts;
}

function isGeneralMath(text) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    if (isFunctionCall(trimmed)) return true;

    const withoutSciNotation = trimmed
        .replace(SCIENTIFIC_PAREN_EXPONENT_REGEX, ' ')
        .replace(SCIENTIFIC_NUMBER_REGEX, ' ');
    if (/[a-zA-Z]/.test(withoutSciNotation)) return false;

    const hasDigit = /\d/.test(trimmed);
    const hasOperator = MATH_UNICODE_REGEX.test(trimmed) || /\d[eE][+-]?\d/.test(trimmed) || /[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(trimmed);
    if (!hasDigit || !hasOperator) return false;

    return true;
}

// ═══════════════════════════════════════════════════════════════════
// QUESTION-WRAPPER STRIPPING
// ═══════════════════════════════════════════════════════════════════

// Strip a natural-language question wrapper so math engines see only
// the expression. Handles: "what is", "what's", "calculate", "solve",
// "how much is", trailing punctuation, etc.
function mathStripQuestionWrapper(text) {
    if (typeof text !== 'string') return text;
    return String(text)
        .replace(/^(?:what\s+is|what'?s|what\s+are|what\s+would\s+(?:be|give)|what\s+would|calculate|compute|evaluate|solve|find|tell\s+me|show\s+me|give\s+me|how\s+much\s+is|how\s+many\s+is|how\s+much\s+(?:does|do)|answer)\s+/i, '')
        .replace(/\s*=\s*\?\s*$/, '')
        .replace(/[?.!]+$/, '')
        .trim();
}
function mathIsMath(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    var stripped = mathStripQuestionWrapper(t);
    var candidate = (stripped && stripped !== t) ? stripped : t;
    return isGeneralMath(candidate) || (typeof isAlgebra === 'function' && isAlgebra(candidate));
}

function mathEngineHandle(text) {
    if (typeof isAlgebra === 'function' && isAlgebra(text)) {
        return window.mathAlgebraHandle ? window.mathAlgebraHandle(text) : null;
    }
    return mathBasicHandle(text);
}

function getFunctionSpec(name) {
    if (typeof mathKeywords === 'undefined') return null;
    const entry = mathKeywords.find(k => k.key.toLowerCase() === name.toLowerCase() + '(');
    if (!entry) return null;

    const variadic = /\.\.\./.test(entry.hint);
    const arity = entry.hint.split(',').length;
    return { name, desc: entry.desc, hint: entry.hint, arity, variadic };
}

function splitArgs(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    const parts = [];
    let depth = 0, current = '';
    for (const ch of trimmed) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    parts.push(current.trim());
    return parts;
}

const ARITHMETIC_EXPR_REGEX = /[0-9().\s+\-−*×⋅/÷^eE%!≥≤<>√∛π⁰¹²³⁴⁵⁶⁷⁸⁹]*[0-9][0-9().\s+\-−*×⋅/÷^eE%!≥≤<>√∛π⁰¹²³⁴⁵⁶⁷⁸⁹]*/;

const SUPERSCRIPT_DIGITS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const PI_VALUE  = String(Math.PI);
const E_VALUE   = String(Math.E);
const PHI_VALUE = String((1 + Math.sqrt(5)) / 2);
const TAU_VALUE = String(2 * Math.PI);

function normalizeSuperscripts(expr) {
    return expr.replace(/([0-9)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (m, base, sup) => {
        const digits = sup.split('').map(ch => SUPERSCRIPT_DIGITS[ch]).join('');
        return base + '^' + digits;
    });
}

function normalizePi(expr) {
    return expr
        .replace(/([0-9)])π/g, '$1*π')
        .replace(/π([0-9(])/g, 'π*$1')
        .replace(/π/g, PI_VALUE);
}

function normalizeOperators(expr) {
    return expr
        .replace(/×|⋅/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');
}

function normalizeScientificParenExponent(expr) {
    return expr.replace(/(\d+(?:\.\d+)?)[eE]\(/g, '$1*10^(');
}

// Swaps standalone named constants (tau, φ, and a lone "e") for their
// numeric values so function arguments like "ln(e)" or "tau/2" can be
// evaluated by the plain arithmetic parser. Digits that are part of
// scientific notation (e.g. "2e5") are left alone.
function normalizeConstants(expr) {
    return expr
        .replace(/\btau\b/gi, TAU_VALUE)
        .replace(/φ/g, PHI_VALUE)
        .replace(/(?<![0-9.])e(?![a-zA-Z0-9])/g, E_VALUE);
}

function checkNoAdjacentOperators(tokens) {
    const POSTFIX = new Set(['%', '!']);
    for (let i = 0; i < tokens.length - 1; i++) {
        const cur = tokens[i];
        const next = tokens[i + 1];
        if (cur.type !== 'operator' || next.type !== 'operator') continue;

        if (POSTFIX.has(cur.value) || POSTFIX.has(next.value)) continue;

        const curIsSign = (cur.value === '+' || cur.value === '-');
        const nextIsSign = (next.value === '+' || next.value === '-');

        if (next.value === '√' || next.value === '∛') continue;
        if (!curIsSign && nextIsSign) continue;

        throw new Error(`"${cur.value}${next.value}" isn't a valid operator sequence.`);
    }
}

function tokenizeArithmetic(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];

        if (/\s/.test(ch)) { i++; continue; }

        if (/[0-9.]/.test(ch)) {
            let numStr = ch;
            i++;
            while (i < expr.length && /[0-9.]/.test(expr[i])) {
                numStr += expr[i];
                i++;
            }
            if ((numStr.match(/\./g) || []).length > 1) {
                throw new Error(`"${numStr}" isn't a valid number — too many decimal points.`);
            }

            if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E')) {
                let j = i + 1;
                let suffix = expr[i];
                if (j < expr.length && (expr[j] === '+' || expr[j] === '-')) {
                    suffix += expr[j];
                    j++;
                }
                let expDigits = '';
                while (j < expr.length && /[0-9]/.test(expr[j])) {
                    expDigits += expr[j];
                    j++;
                }
                if (expDigits) {
                    numStr += suffix + expDigits;
                    i = j;
                }
            }

            tokens.push({ type: 'number', value: parseFloat(numStr) });
            continue;
        }

        if ('+-*/^%!≥≤<>√∛'.includes(ch)) {
            tokens.push({ type: 'operator', value: ch });
            i++;
            continue;
        }

        if (ch === '(' || ch === ')') {
            tokens.push({ type: 'paren', value: ch });
            i++;
            continue;
        }

        throw new Error(`"${ch}" isn't a character this calculator understands yet.`);
    }
    checkNoAdjacentOperators(tokens);
    return tokens;
}

function parseArithmetic(tokens) {
    let pos = 0;

    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }

    function parsePrimary() {
        const tok = peek();
        if (!tok) throw new Error('Expression ended unexpectedly — looks like an operand is missing.');

        if (tok.type === 'number') {
            consume();
            return tok.value;
        }
        if (tok.type === 'paren' && tok.value === '(') {
            consume();
            const value = parseExpression();
            const closing = peek();
            if (!closing || closing.type !== 'paren' || closing.value !== ')') {
                throw new Error('Missing a closing ")" somewhere in that expression.');
            }
            consume();
            return value;
        }
        throw new Error('Expected a number or "(" but found something else.');
    }

    function parseUnary() {
        const tok = peek();
        if (tok && tok.type === 'operator' && (tok.value === '-' || tok.value === '+')) {
            consume();
            return tok.value === '-' ? -parseUnary() : parseUnary();
        }
        if (tok && tok.type === 'operator' && tok.value === '√') {
            consume();
            const operand = parseUnary();
            if (operand < 0) throw new Error("Can't take the square root of a negative number.");
            return Math.sqrt(operand);
        }
        if (tok && tok.type === 'operator' && tok.value === '∛') {
            consume();
            const operand = parseUnary();
            return Math.cbrt(operand);
        }
        return parsePower();
    }

    function parsePower() {
        let base = parsePrimary();
        if (peek() && peek().type === 'operator' && peek().value === '^') {
            consume();
            const exponent = parseUnary();
            base = Math.pow(base, exponent);
        }
        while (peek() && peek().type === 'operator' && (peek().value === '!' || peek().value === '%')) {
            const op = consume().value;
            base = op === '!' ? factorial(base) : base / 100;
        }
        return base;
    }

    function factorial(n) {
        return factorialValue(n);
    }

    function parseTerm() {
        let value = parseUnary();
        while (peek() && peek().type === 'operator' && (peek().value === '*' || peek().value === '/')) {
            const op = consume().value;
            const rhs = parseUnary();
            if (op === '*') {
                value = value * rhs;
            } else {
                if (rhs === 0) throw new Error("Can't divide by zero.");
                value = value / rhs;
            }
        }
        return value;
    }

    function parseExpression() {
        let value = parseTerm();
        while (peek() && peek().type === 'operator' && (peek().value === '+' || peek().value === '-')) {
            const op = consume().value;
            const rhs = parseTerm();
            value = op === '+' ? value + rhs : value - rhs;
        }
        return value;
    }

    function parseComparison() {
        const left = parseExpression();
        if (peek() && peek().type === 'operator' && ['≥', '≤', '<', '>'].includes(peek().value)) {
            const op = consume().value;
            const right = parseExpression();
            if (op === '≥') return left >= right;
            if (op === '≤') return left <= right;
            if (op === '<') return left < right;
            return left > right;
        }
        return left;
    }

    const result = parseComparison();
    if (pos < tokens.length) {
        throw new Error('There\'s extra content after what looks like a complete expression.');
    }
    return result;
}

function cleanNumber(n) {
    if (n === 0 || !isFinite(n)) return n;
    return parseFloat(n.toPrecision(12));
}

function factorialValue(n) {
    if (n < 0 || !Number.isInteger(n)) throw new Error('factorial only works on non-negative whole numbers.');
    if (n > 170) throw new Error("that factorial is too large to compute.");
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

// Evaluates a plain numeric expression (a function argument, not a whole
// user message) — handles operators, superscripts, π/e/φ/tau, and
// scientific notation, then returns a finite number or throws.
function evalNumericArg(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) throw new Error("that argument is empty.");

    let expr = normalizeOperators(trimmed);
    expr = normalizeScientificParenExponent(expr);
    expr = normalizeSuperscripts(expr);
    expr = normalizeConstants(expr);
    expr = normalizePi(expr);

    const tokens = tokenizeArithmetic(expr);
    if (!tokens.length) throw new Error(`"${raw}" isn't a valid number.`);
    const value = parseArithmetic(tokens);
    if (typeof value !== 'number' || !isFinite(value)) {
        throw new Error(`"${raw}" isn't a usable number.`);
    }
    return value;
}

function requireInteger(value, raw, label) {
    if (!Number.isInteger(value)) {
        throw new Error(`${label} must be a whole number (got "${raw}").`);
    }
    return value;
}

// Runs `compute` and, if it throws, reformats the error into the same
// "Couldn't evaluate fn(args) — reason" shape used across the file.
function withArgs(fnName, args, compute) {
    try {
        return compute();
    } catch (err) {
        return `Couldn't evaluate "${fnName}(${args.join(', ')})" — ${err.message}`;
    }
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const TRIG_FUNCTIONS = {
    sin:  v => Math.sin(v * DEG_TO_RAD),
    cos:  v => Math.cos(v * DEG_TO_RAD),
    tan:  v => Math.tan(v * DEG_TO_RAD),
    csc:  v => 1 / Math.sin(v * DEG_TO_RAD),
    sec:  v => 1 / Math.cos(v * DEG_TO_RAD),
    cot:  v => 1 / Math.tan(v * DEG_TO_RAD),
    asin: v => Math.asin(v) * RAD_TO_DEG,
    acos: v => Math.acos(v) * RAD_TO_DEG,
    atan: v => Math.atan(v) * RAD_TO_DEG,
};

// Evaluates sin/cos/tan/csc/sec/cot/asin/acos/atan given already-split args.
// Returns null if fnName isn't a trig function (so the caller can fall
// through to its generic "not wired up yet" message), or an error/result
// string if it is.
function evaluateTrigFunction(fnName, args) {
    const fn = TRIG_FUNCTIONS[fnName.toLowerCase()];
    if (!fn) return null;

    const argRaw = args[0];
    let value;
    try {
        const tokens = tokenizeArithmetic(normalizeSuperscripts(normalizeOperators(normalizePi(argRaw))));
        value = parseArithmetic(tokens);
    } catch (err) {
        return `Couldn't evaluate "${fnName}(${argRaw})" — ${err.message}`;
    }

    if (typeof value !== 'number' || !isFinite(value)) {
        return `Couldn't evaluate "${fnName}(${argRaw})" — that isn't a usable number.`;
    }

    const isInverse = fnName.toLowerCase().startsWith('a');
    if (isInverse && (value < -1 || value > 1)) {
        return `${fnName}(${argRaw}) is undefined — inverse trig functions only accept inputs between -1 and 1.`;
    }
    if ((fnName.toLowerCase() === 'tan' && Math.abs(((value % 180) + 180) % 180 - 90) < 1e-9) ||
        (fnName.toLowerCase() === 'sec' && Math.abs(((value % 180) + 180) % 180 - 90) < 1e-9) ||
        ((fnName.toLowerCase() === 'csc' || fnName.toLowerCase() === 'cot') && Math.abs(((value % 180) + 180) % 180) < 1e-9)) {
        return `${fnName}(${argRaw}) is undefined at this angle.`;
    }

    const result = cleanNumber(fn(value));
    const suffix = isInverse ? '°' : '';
    return `${fnName}(${argRaw}) = ${result}${suffix}`;
}

// ─── Single-argument functions (sqrt, cbrt, abs, ln, log10, log, log2, factorial) ─

const SIMPLE_FUNCTIONS = {
    sqrt:      v => { if (v < 0) throw new Error("can't take the square root of a negative number."); return Math.sqrt(v); },
    cbrt:      v => Math.cbrt(v),
    abs:       v => Math.abs(v),
    ln:        v => { if (v <= 0) throw new Error('the input must be greater than 0.'); return Math.log(v); },
    log10:     v => { if (v <= 0) throw new Error('the input must be greater than 0.'); return Math.log10(v); },
    log:       v => { if (v <= 0) throw new Error('the input must be greater than 0.'); return Math.log10(v); },
    log2:      v => { if (v <= 0) throw new Error('the input must be greater than 0.'); return Math.log2(v); },
    factorial: v => factorialValue(v),
};

function evaluateSimpleFunction(fnName, args) {
    const fn = SIMPLE_FUNCTIONS[fnName.toLowerCase()];
    if (!fn) return null;
    return withArgs(fnName, args, () => {
        const value = evalNumericArg(args[0]);
        const result = cleanNumber(fn(value));
        return `${fnName}(${args[0]}) = ${result}`;
    });
}

// ─── log_base(value, base) ────────────────────────────────────────────────────

function evaluateLogBase(fnName, args) {
    if (fnName.toLowerCase() !== 'log_base') return null;
    return withArgs(fnName, args, () => {
        const value = evalNumericArg(args[0]);
        const base = evalNumericArg(args[1]);
        if (value <= 0) throw new Error('the value must be greater than 0.');
        if (base <= 0 || base === 1) throw new Error('the base must be positive and not equal to 1.');
        const result = cleanNumber(Math.log(value) / Math.log(base));
        return `log_base(${args[0]}, ${args[1]}) = ${result}`;
    });
}

// ─── Geometry ──────────────────────────────────────────────────────────────────

const GEOMETRY_FUNCTIONS = new Set([
    'dist', 'dist3d', 'midpoint', 'slope',
    'triangleArea', 'circleArea', 'rectangleArea', 'sphereVolume', 'cylinderVolume',
]);

function evaluateGeometryFunction(fnName, args) {
    const name = GEOMETRY_FUNCTIONS.has(fnName)
        ? fnName
        : [...GEOMETRY_FUNCTIONS].find(n => n.toLowerCase() === fnName.toLowerCase());
    if (!name) return null;

    return withArgs(fnName, args, () => {
        const nums = args.map(a => evalNumericArg(a));

        switch (name) {
            case 'dist': {
                const [x1, y1, x2, y2] = nums;
                const result = cleanNumber(Math.hypot(x2 - x1, y2 - y1));
                return `dist(${args.join(', ')}) = ${result}`;
            }
            case 'dist3d': {
                const [x1, y1, z1, x2, y2, z2] = nums;
                const result = cleanNumber(Math.hypot(x2 - x1, y2 - y1, z2 - z1));
                return `dist3d(${args.join(', ')}) = ${result}`;
            }
            case 'midpoint': {
                const [x1, y1, x2, y2] = nums;
                const mx = cleanNumber((x1 + x2) / 2);
                const my = cleanNumber((y1 + y2) / 2);
                return `midpoint(${args.join(', ')}) = (${mx}, ${my})`;
            }
            case 'slope': {
                const [x1, y1, x2, y2] = nums;
                if (x2 === x1) throw new Error('the line is vertical — slope is undefined.');
                const result = cleanNumber((y2 - y1) / (x2 - x1));
                return `slope(${args.join(', ')}) = ${result}`;
            }
            case 'triangleArea': {
                const [base, height] = nums;
                if (base <= 0 || height <= 0) throw new Error('base and height must be positive.');
                const result = cleanNumber(0.5 * base * height);
                return `triangleArea(${args.join(', ')}) = ${result}`;
            }
            case 'circleArea': {
                const [radius] = nums;
                if (radius < 0) throw new Error('radius must be non-negative.');
                const result = cleanNumber(Math.PI * radius * radius);
                return `circleArea(${args.join(', ')}) = ${result}`;
            }
            case 'rectangleArea': {
                const [length, width] = nums;
                if (length <= 0 || width <= 0) throw new Error('length and width must be positive.');
                const result = cleanNumber(length * width);
                return `rectangleArea(${args.join(', ')}) = ${result}`;
            }
            case 'sphereVolume': {
                const [radius] = nums;
                if (radius < 0) throw new Error('radius must be non-negative.');
                const result = cleanNumber((4 / 3) * Math.PI * Math.pow(radius, 3));
                return `sphereVolume(${args.join(', ')}) = ${result}`;
            }
            case 'cylinderVolume': {
                const [radius, height] = nums;
                if (radius < 0 || height < 0) throw new Error('radius and height must be non-negative.');
                const result = cleanNumber(Math.PI * radius * radius * height);
                return `cylinderVolume(${args.join(', ')}) = ${result}`;
            }
        }
    });
}

// ─── Combinatorics (nCr, nPr) ───────────────────────────────────────────────────

function evaluateCombinatoricsFunction(fnName, args) {
    const lower = fnName.toLowerCase();
    if (lower !== 'ncr' && lower !== 'npr') return null;

    return withArgs(fnName, args, () => {
        const n = requireInteger(evalNumericArg(args[0]), args[0], 'n');
        const r = requireInteger(evalNumericArg(args[1]), args[1], 'r');
        if (n < 0 || r < 0) throw new Error('n and r must be non-negative.');
        if (r > n) throw new Error('r cannot be greater than n.');

        const result = lower === 'ncr'
            ? cleanNumber(factorialValue(n) / (factorialValue(r) * factorialValue(n - r)))
            : cleanNumber(factorialValue(n) / factorialValue(n - r));
        return `${fnName}(${args.join(', ')}) = ${result}`;
    });
}

// ─── Number Theory (gcd, lcm, isPrime, primeFactors, fibonacci) ────────────────

function gcdInt(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
}

function isPrimeInt(n) {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (let i = 3; i * i <= n; i += 2) {
        if (n % i === 0) return false;
    }
    return true;
}

function primeFactorsOf(n) {
    let remaining = n;
    const factors = [];
    for (let p = 2; p * p <= remaining; p++) {
        while (remaining % p === 0) {
            factors.push(p);
            remaining /= p;
        }
    }
    if (remaining > 1) factors.push(remaining);
    return factors;
}

function fibonacciAt(n) {
    if (n === 0) return 0;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
}

function evaluateNumberTheoryFunction(fnName, args) {
    const lower = fnName.toLowerCase();
    if (!['gcd', 'lcm', 'isprime', 'primefactors', 'fibonacci'].includes(lower)) return null;

    return withArgs(fnName, args, () => {
        if (lower === 'gcd' || lower === 'lcm') {
            const a = requireInteger(evalNumericArg(args[0]), args[0], 'a');
            const b = requireInteger(evalNumericArg(args[1]), args[1], 'b');
            if (lower === 'gcd') {
                return `gcd(${args.join(', ')}) = ${gcdInt(a, b)}`;
            }
            const g = gcdInt(a, b);
            const result = g === 0 ? 0 : Math.abs(a * b) / g;
            return `lcm(${args.join(', ')}) = ${result}`;
        }

        const n = requireInteger(evalNumericArg(args[0]), args[0], 'the input');

        if (lower === 'isprime') {
            return `isPrime(${args[0]}) = ${isPrimeInt(n)}`;
        }
        if (lower === 'primefactors') {
            if (n < 2) throw new Error('prime factors are only defined for whole numbers 2 and up.');
            return `primeFactors(${args[0]}) = ${primeFactorsOf(n).join(',')}`;
        }
        if (lower === 'fibonacci') {
            if (n < 0) throw new Error('n must be 0 or a positive whole number.');
            return `fibonacci(${args[0]}) = ${fibonacciAt(n)}`;
        }
    });
}

// ─── AP/GP Series ────────────────────────────────────────────────────────────

function evaluateSeriesFunction(fnName, args) {
    const lower = fnName.toLowerCase();
    if (!['ap_sum', 'ap_term', 'gp_sum', 'gp_term', 'gp_infinite_sum'].includes(lower)) return null;

    return withArgs(fnName, args, () => {
        if (lower === 'ap_sum' || lower === 'ap_term') {
            const first = evalNumericArg(args[0]);
            const diff = evalNumericArg(args[1]);
            const n = requireInteger(evalNumericArg(args[2]), args[2], 'the term count');
            if (n <= 0) throw new Error('the term count must be a positive whole number.');

            if (lower === 'ap_term') {
                const result = cleanNumber(first + (n - 1) * diff);
                return `ap_term(${args.join(', ')}) = ${result}`;
            }
            const result = cleanNumber((n / 2) * (2 * first + (n - 1) * diff));
            return `ap_sum(${args.join(', ')}) = ${result}`;
        }

        if (lower === 'gp_sum' || lower === 'gp_term') {
            const first = evalNumericArg(args[0]);
            const ratio = evalNumericArg(args[1]);
            const n = requireInteger(evalNumericArg(args[2]), args[2], 'the term count');
            if (n <= 0) throw new Error('the term count must be a positive whole number.');

            if (lower === 'gp_term') {
                const result = cleanNumber(first * Math.pow(ratio, n - 1));
                return `gp_term(${args.join(', ')}) = ${result}`;
            }
            const result = cleanNumber(ratio === 1 ? first * n : first * (1 - Math.pow(ratio, n)) / (1 - ratio));
            return `gp_sum(${args.join(', ')}) = ${result}`;
        }

        // gp_infinite_sum
        const first = evalNumericArg(args[0]);
        const ratio = evalNumericArg(args[1]);
        if (Math.abs(ratio) >= 1) throw new Error('an infinite geometric series only converges when |ratio| < 1.');
        const result = cleanNumber(first / (1 - ratio));
        return `gp_infinite_sum(${args.join(', ')}) = ${result}`;
    });
}

// ─── Summation / Product series (sum, product) ─────────────────────────────────

const MAX_SERIES_TERMS = 100000;

// Substitutes a numeric value for every whole-word occurrence of `varName`
// in a raw expression string (also normalizing "**" to "^") and evaluates it.
function evaluateExpressionAt(exprRaw, varName, value) {
    const withCaret = exprRaw.replace(/\*\*/g, '^');
    const varRegex = new RegExp('\\b' + varName + '\\b', 'g');
    const substituted = withCaret.replace(varRegex, '(' + value + ')');
    return evalNumericArg(substituted);
}

function evaluateSumProduct(fnName, args) {
    const lower = fnName.toLowerCase();
    if (lower !== 'sum' && lower !== 'product') return null;

    return withArgs(fnName, args, () => {
        const exprRaw = args[0];
        const start = requireInteger(evalNumericArg(args[1]), args[1], 'the start index');
        const end = requireInteger(evalNumericArg(args[2]), args[2], 'the end index');
        if (end < start) throw new Error('the end index must be greater than or equal to the start index.');
        if (end - start + 1 > MAX_SERIES_TERMS) throw new Error('that range has too many terms to compute.');

        let total = lower === 'sum' ? 0 : 1;
        for (let n = start; n <= end; n++) {
            const term = evaluateExpressionAt(exprRaw, 'n', n);
            total = lower === 'sum' ? total + term : total * term;
        }
        const result = cleanNumber(total);
        return `${fnName}(${args.join(', ')}) = ${result}`;
    });
}

// ─── Statistics (mean, median, mode, variance, stdDev) ─────────────────────────

function evaluateStatsFunction(fnName, args) {
    const lower = fnName.toLowerCase();
    if (!['mean', 'median', 'mode', 'variance', 'stddev'].includes(lower)) return null;

    return withArgs(fnName, args, () => {
        const nums = args.map(a => evalNumericArg(a));
        const n = nums.length;

        if (lower === 'mean') {
            const result = cleanNumber(nums.reduce((a, b) => a + b, 0) / n);
            return `mean(${args.join(', ')}) = ${result}`;
        }

        if (lower === 'median') {
            const sorted = [...nums].sort((a, b) => a - b);
            const mid = Math.floor(n / 2);
            const result = cleanNumber(n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]);
            return `median(${args.join(', ')}) = ${result}`;
        }

        if (lower === 'mode') {
            const counts = new Map();
            nums.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
            const maxFreq = Math.max(...counts.values());
            if (maxFreq === 1) {
                return `mode(${args.join(', ')}) = no mode — every value is unique.`;
            }
            const modes = [...counts.entries()]
                .filter(([, freq]) => freq === maxFreq)
                .map(([v]) => cleanNumber(v))
                .sort((a, b) => a - b);
            return `mode(${args.join(', ')}) = ${modes.join(', ')}`;
        }

        const mean = nums.reduce((a, b) => a + b, 0) / n;
        const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;

        if (lower === 'variance') {
            return `variance(${args.join(', ')}) = ${cleanNumber(variance)}`;
        }
        return `stdDev(${args.join(', ')}) = ${cleanNumber(Math.sqrt(variance))}`;
    });
}

function evaluateArithmetic(text) {
    const match = text.match(ARITHMETIC_EXPR_REGEX);
    const exprRaw = match ? match[0].trim() : '';
    if (!exprRaw || !/\d/.test(exprRaw)) return null;

    let expr = normalizeOperators(exprRaw);
    expr = normalizeScientificParenExponent(expr);
    expr = normalizeSuperscripts(expr);
    expr = normalizePi(expr);

    try {
        const tokens = tokenizeArithmetic(expr);
        if (!tokens.length) return null;
        const raw = parseArithmetic(tokens);
        const result = typeof raw === 'boolean' ? raw : cleanNumber(raw);
        return `${exprRaw} = ${result}`;
    } catch (err) {
        return `Couldn't evaluate "${exprRaw}" — ${err.message}`;
    }
}

// Finds the first recognized function call in `text` and extracts its
// argument list, tracking paren depth so nested parens (e.g. inside a
// sum() expression) don't cut the match short the way a simple regex would.
function extractFunctionCall(text) {
    if (!MATH_FUNCTION_NAMES.length) return null;

    const nameRegex = new RegExp('\\b(' + MATH_FUNCTION_NAMES.join('|') + ')\\s*\\(', 'i');
    const nameMatch = nameRegex.exec(text);
    if (!nameMatch) return null;

    const fnName = nameMatch[1];
    let i = nameMatch.index + nameMatch[0].length;
    const start = i;
    let depth = 1;
    while (i < text.length && depth > 0) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') depth--;
        if (depth === 0) break;
        i++;
    }
    if (depth !== 0) return null; // no matching close paren

    return { fnName, argsRaw: text.slice(start, i) };
}

// ═══════════════════════════════════════════════════════════════════
// INLINE FUNCTION RESOLUTION
// Peels nested function calls from the inside out, substituting each
// result back into the expression as a number.
// ═══════════════════════════════════════════════════════════════════

// Find the innermost function call in `text` — a fn(...) whose argument
// list contains no other function call.
function mathFindInnermostCall(text) {
    if (!MATH_FUNCTION_NAMES.length) return null;
    var nameRe = new RegExp('\\b(' + MATH_FUNCTION_NAMES.join('|') + ')\\s*\\(', 'gi');
    var innerFnRe = new RegExp('\\b(' + MATH_FUNCTION_NAMES.join('|') + ')\\s*\\(', 'i');
    var m;
    while ((m = nameRe.exec(text)) !== null) {
        var openIdx = m.index + m[0].length - 1;
        var depth = 0;
        var i = openIdx;
        while (i < text.length) {
            if (text[i] === '(') depth++;
            else if (text[i] === ')') { depth--; if (depth === 0) break; }
            i++;
        }
        if (depth !== 0) continue;
        var argsRaw = text.slice(openIdx + 1, i);
        if (!innerFnRe.test(argsRaw)) {
            return { fnName: m[1], argsRaw: argsRaw, startIdx: m.index, endIdx: i };
        }
    }
    return null;
}

// Replace every function call in `text` with its numeric result, one at a
// time, until no calls remain. Returns the reduced arithmetic string.
// e.g. "cos(90)*sin(20)" → "(0)*(0.342)"
function mathResolveFunctions(text) {
    var current = String(text || '');
    var MAX_ITER = 40;
    for (var iter = 0; iter < MAX_ITER; iter++) {
        var call = mathFindInnermostCall(current);
        if (!call) return current;

        var args = splitArgs(call.argsRaw);
        var evalResult = null;
        for (var e = 0; e < FUNCTION_EVALUATORS.length; e++) {
            var r = FUNCTION_EVALUATORS[e](call.fnName, args);
            if (r !== null) { evalResult = r; break; }
        }
        if (evalResult === null) return current; // unknown function — bail

        var numMatch = evalResult.match(/=\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*$/i);
        if (!numMatch) return current; // boolean or non-numeric result — bail

        current = current.slice(0, call.startIdx) + '(' + numMatch[1] + ')' + current.slice(call.endIdx + 1);
    }
    return current;
}

// Handlers are tried in order; each returns null if fnName isn't in its
// group, so mathBasicHandle can fall through to the next.
const FUNCTION_EVALUATORS = [
    evaluateTrigFunction,
    evaluateSimpleFunction,
    evaluateLogBase,
    evaluateGeometryFunction,
    evaluateCombinatoricsFunction,
    evaluateNumberTheoryFunction,
    evaluateSeriesFunction,
    evaluateSumProduct,
    evaluateStatsFunction,
];

function mathBasicHandle(text) {
    console.log('math-basic.js received:', text);

    // 1. Multi-expression splitting — "A or B", "A and B"
    var multiParts = mathSplitMultiExpression(text);
    if (multiParts) {
        var results = [];
        for (var mi = 0; mi < multiParts.length; mi++) {
            var subResult = mathBasicHandle(multiParts[mi]);
            if (subResult && subResult !== 'math-basic') results.push(subResult);
        }
        if (results.length) return results.join('   ·   ');
    }

    // 2. Inline function resolution — handles multiple function calls inside
    //    a single expression ("cos(90)*sin(20)", "sqrt(16)+sqrt(9)").
    //    Only fires if there's more than one call, so single-call inputs
    //    keep their nicer per-function display format.
    var fnCount = (text.match(new RegExp('\\b(' + MATH_FUNCTION_NAMES.join('|') + ')\\s*\\(', 'gi')) || []).length;
    if (fnCount >= 2) {
        var resolved = mathResolveFunctions(text);
        if (resolved !== text) {
            var arithFromResolved = evaluateArithmetic(resolved);
            if (arithFromResolved !== null) {
                var eqIdx = arithFromResolved.lastIndexOf('=');
if (eqIdx > 0) {
    var valueStr = arithFromResolved.slice(eqIdx + 1).trim();
    // Snap tiny values to 0 at the display layer too, so a stale
    // cleanNumber elsewhere can't leak "2.09e-17" to the user.
    var numValue = parseFloat(valueStr);
    if (isFinite(numValue) && Math.abs(numValue) < 1e-10) {
        valueStr = '0';
    }
    var display = text
        .replace(/\b(sin|cos|tan|csc|sec|cot|asin|acos|atan|ln|log|sqrt|cbrt|abs|exp)\s*(-?\d+(?:\.\d+)?)/gi,
            function (_, fn, num) { return fn + '(' + num + ')'; });
    return display + ' = ' + valueStr;
}
            }
        }
    }

    // 3. Single function call
    const call = extractFunctionCall(text);
    if (call) {
        const { fnName, argsRaw } = call;
        const args = splitArgs(argsRaw);
        const providedCount = args.filter(a => a.length > 0).length;

        console.log('math-basic.js resolved function:', fnName, 'args:', args);

        const spec = getFunctionSpec(fnName);

        if (providedCount === 0) {
            return `${fnName}() is missing its input — it needs ${spec ? spec.hint : 'a value'}. Try something like: ${spec ? spec.desc + ', e.g. ' + fnName + '(' + spec.hint + ')' : fnName + '(...)'}`;
        }

        if (spec && !spec.variadic && providedCount < spec.arity) {
            return `${fnName}(...) needs ${spec.arity} value${spec.arity > 1 ? 's' : ''} (${spec.hint}), but only got ${providedCount}. Fill in the rest and try again.`;
        }

        for (const evaluate of FUNCTION_EVALUATORS) {
            const result = evaluate(fnName, args);
            if (result !== null) return result;
        }

        return `${fnName}(${args.join(', ')}) — got it, but full evaluation isn't wired up yet.`;
    }

    // 4. Plain arithmetic
    const arithmeticResult = evaluateArithmetic(text);
    if (arithmeticResult !== null) return arithmeticResult;

    return 'math-basic';
}

window.mathIsMath = mathIsMath;
window.mathEngineHandle = mathEngineHandle;
window.mathBasicHandle = mathBasicHandle;
window.getFunctionSpec = getFunctionSpec;
window.evaluateArithmetic = evaluateArithmetic;
window.evaluateTrigFunction = evaluateTrigFunction;
window.evaluateSimpleFunction = evaluateSimpleFunction;
window.evaluateLogBase = evaluateLogBase;
window.evaluateGeometryFunction = evaluateGeometryFunction;
window.evaluateCombinatoricsFunction = evaluateCombinatoricsFunction;
window.evaluateNumberTheoryFunction = evaluateNumberTheoryFunction;
window.evaluateSeriesFunction = evaluateSeriesFunction;
window.evaluateSumProduct = evaluateSumProduct;
window.evaluateStatsFunction = evaluateStatsFunction;
window.mathStripQuestionWrapper = mathStripQuestionWrapper;
window.mathSplitMultiExpression = mathSplitMultiExpression;
window.mathResolveFunctions = mathResolveFunctions;
