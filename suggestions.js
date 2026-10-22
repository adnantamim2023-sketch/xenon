// ─── Math Keywords ───────────────────────────────────────────────────────────
const mathKeywords = [
    // Basic
    { key: "sqrt(",            desc: "Square Root",              example: "√(16) → 4",                   hint: "number" },
    { key: "cbrt(",            desc: "Cube Root",                example: "∛(27) → 3",                   hint: "number" },
    { key: "abs(",             desc: "Absolute Value",           example: "abs(-5) → 5",                 hint: "number" },
    { key: "factorial(",       desc: "Factorial",                example: "factorial(5) → 120",          hint: "n" },
    // AP/GP Series
    { key: "ap_sum(",          desc: "Arithmetic Sum",           example: "ap_sum(2,3,5) → 40",          hint: "first, diff, terms" },
    { key: "ap_term(",         desc: "Arithmetic Term",          example: "ap_term(2,3,5) → 14",         hint: "first, diff, n" },
    { key: "gp_sum(",          desc: "Geometric Sum",            example: "gp_sum(2,2,5) → 62",          hint: "first, ratio, terms" },
    { key: "gp_term(",         desc: "Geometric Term",           example: "gp_term(2,2,5) → 32",         hint: "first, ratio, n" },
    { key: "gp_infinite_sum(", desc: "Infinite Geometric Sum",   example: "gp_infinite_sum(1,0.5) → 2", hint: "first, ratio" },
    // Summation/Products
    { key: "sum(",             desc: "Summation",                example: "sum(n**2,1,5) → 55",          hint: "expr, start, end" },
    { key: "product(",         desc: "Product Series",           example: "product(n,1,5) → 120",        hint: "expr, start, end" },
    // Combinatorics
    { key: "nCr(",             desc: "Combinations",             example: "nCr(5,2) → 10",               hint: "n, r" },
    { key: "nPr(",             desc: "Permutations",             example: "nPr(5,2) → 20",               hint: "n, r" },
    // Logarithms
    { key: "log_base(",        desc: "Log with base",            example: "log_base(8,2) → 3",           hint: "value, base" },
    { key: "log2(",            desc: "Log base 2",               example: "log2(8) → 3",                 hint: "value" },
    { key: "log10(",           desc: "Log base 10",              example: "log10(100) → 2",              hint: "value" },
    { key: "log(",             desc: "Log base 10",              example: "log(100) → 2",                hint: "value" },
    { key: "ln(",              desc: "Natural Log",              example: "ln(e) → 1",                   hint: "value" },
    // Geometry
    { key: "dist(",            desc: "2D Distance",              example: "dist(0,0,3,4) → 5",           hint: "x1, y1, x2, y2" },
    { key: "dist3d(",          desc: "3D Distance",              example: "dist3d(0,0,0,1,2,2) → 3",    hint: "x1,y1,z1, x2,y2,z2" },
    { key: "midpoint(",        desc: "Midpoint",                 example: "midpoint(0,0,4,4) → (2,2)",  hint: "x1, y1, x2, y2" },
    { key: "slope(",           desc: "Slope of line",            example: "slope(0,0,4,8) → 2",          hint: "x1, y1, x2, y2" },
    // Area/Volume
    { key: "triangleArea(",    desc: "Triangle Area",            example: "triangleArea(5,10) → 25",     hint: "base, height" },
    { key: "circleArea(",      desc: "Circle Area",              example: "circleArea(5) → 78.54",       hint: "radius" },
    { key: "rectangleArea(",   desc: "Rectangle Area",           example: "rectangleArea(4,5) → 20",     hint: "length, width" },
    { key: "sphereVolume(",    desc: "Sphere Volume",            example: "sphereVolume(3) → 113.1",     hint: "radius" },
    { key: "cylinderVolume(",  desc: "Cylinder Volume",          example: "cylinderVolume(3,5) → 141.37",hint: "radius, height" },
    // Trigonometry
    { key: "sin(",             desc: "Sine (degrees)",           example: "sin(30) → 0.5",               hint: "degrees" },
    { key: "cos(",             desc: "Cosine (degrees)",         example: "cos(60) → 0.5",               hint: "degrees" },
    { key: "tan(",             desc: "Tangent (degrees)",        example: "tan(45) → 1",                 hint: "degrees" },
    { key: "asin(",            desc: "Arc Sine",                 example: "asin(0.5) → 30°",             hint: "value" },
    { key: "acos(",            desc: "Arc Cosine",               example: "acos(0.5) → 60°",             hint: "value" },
    { key: "atan(",            desc: "Arc Tangent",              example: "atan(1) → 45°",               hint: "value" },
    { key: "csc(",             desc: "Cosecant",                 example: "csc(30) → 2",                 hint: "degrees" },
    { key: "sec(",             desc: "Secant",                   example: "sec(60) → 2",                 hint: "degrees" },
    { key: "cot(",             desc: "Cotangent",                example: "cot(45) → 1",                 hint: "degrees" },
    // Statistics
    { key: "mean(",            desc: "Average",                  example: "mean(2,4,6,8) → 5",           hint: "n1, n2, ..." },
    { key: "median(",          desc: "Middle Value",             example: "median(1,3,5,7,9) → 5",       hint: "n1, n2, ..." },
    { key: "mode(",            desc: "Most Frequent",            example: "mode(1,2,2,3) → 2",           hint: "n1, n2, ..." },
    { key: "variance(",        desc: "Variance",                 example: "variance(1,2,3,4,5) → 2.5",  hint: "n1, n2, ..." },
    { key: "stdDev(",          desc: "Standard Deviation",       example: "stdDev(2,4,4,4,5,5,7,9)",     hint: "n1, n2, ..." },
    // Number Theory
    { key: "isPrime(",         desc: "Check Prime",              example: "isPrime(17) → true",          hint: "number" },
    { key: "primeFactors(",    desc: "Prime Factors",            example: "primeFactors(84) → 2,2,3,7",  hint: "number" },
    { key: "gcd(",             desc: "Greatest Common Divisor",  example: "gcd(48,18) → 6",              hint: "a, b" },
    { key: "lcm(",             desc: "Least Common Multiple",    example: "lcm(12,18) → 36",             hint: "a, b" },
    { key: "fibonacci(",       desc: "Fibonacci Number",         example: "fibonacci(10) → 55",          hint: "n" },
    // Constants
    { key: "π",                desc: "Pi (3.14159...)",          example: "2*π → 6.283",                 hint: "constant" },
    { key: "e",                desc: "Euler's Number",           example: "ln(e) → 1",                   hint: "constant" },
    { key: "φ",                desc: "Golden Ratio",             example: "φ → 1.618",                   hint: "constant" },
    { key: "tau",              desc: "Tau (2π)",                  example: "tau → 6.283",                 hint: "constant" },
];

// Note: derivative(, integral(, x², and x³ were removed from here on
// purpose — those are algebra/calculus-equation territory and will be
// handled by their own dedicated engines (see math-algebra.js /
// math-integration.js) instead of the generic function-call suggester.

// ─── Ghost Text Setup ────────────────────────────────────────────────────────

const inputField = document.getElementById('userInput');
const sugBox     = document.getElementById('suggestionBox');

// Keep the old sugBox in the DOM but permanently hidden
// (other code might reference it; this is the safest no-break approach)
sugBox.style.display = 'none';

let ghostSuffix  = '';   // the transparent completion after the cursor
let ghostMatch   = null; // the full keyword that matched

// Wrap the textarea in a relative container and inject the ghost layer
const ghostWrapper = document.createElement('div');
ghostWrapper.style.cssText = 'position:relative;flex:1;min-width:0;display:flex;align-items:flex-end;';

inputField.parentNode.insertBefore(ghostWrapper, inputField);
ghostWrapper.appendChild(inputField);

const ghostEl = document.createElement('div');
ghostEl.id = 'ghostLayer';
ghostEl.setAttribute('aria-hidden', 'true');
// Mirror every visual property of the textarea so text aligns pixel-perfectly
ghostEl.style.cssText = [
    'position:absolute',
    'inset:0',
    'pointer-events:none',
    'user-select:none',
    'font-size:1rem',
    'line-height:1.5rem',
    'padding:8px 0',
    'font-family:inherit',
    'white-space:pre-wrap',
    'word-break:break-word',
    'overflow:hidden',
    'z-index:0',
].join(';');
ghostWrapper.insertBefore(ghostEl, inputField);

// Make sure the textarea itself sits above the ghost layer
inputField.style.position = 'relative';
inputField.style.zIndex   = '1';
// Textarea background must be transparent (it already is, but be explicit)
inputField.style.background = 'transparent';

function renderGhost(typedText, suffix) {
    if (!suffix) {
        ghostEl.innerHTML = '';
        return;
    }
    // Escape HTML so special chars don't break the layout
    const esc = s => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Typed portion: invisible (transparent) so it pushes the ghost suffix
    // to exactly the right horizontal position.
    // Ghost suffix: dimmed accent colour.
    ghostEl.innerHTML =
        `<span style="color:transparent">${esc(typedText)}</span>` +
        `<span style="color:var(--accent);opacity:0.45;font-style:normal">${esc(suffix)}</span>`;
}

function clearGhost() {
    ghostSuffix = '';
    ghostMatch  = null;
    ghostEl.innerHTML = '';
}

// ─── Input Handler ───────────────────────────────────────────────────────────

inputField.addEventListener('input', () => {
    if (!suggestionsEnabled) { clearGhost(); return; }

    const val       = inputField.value;
    const cursor    = inputField.selectionStart;

    if (!val.length) { clearGhost(); return; }

    // Find the word token ending at the cursor
    let start = cursor - 1;
    while (start >= 0 && !/[\s+\-*/(),;]/.test(val[start])) start--;
    start++;

    const currentWord = val.substring(start, cursor).toLowerCase();
    const hasLetters  = /[a-zπφτ]/i.test(currentWord);

    if (!currentWord.length || !hasLetters) { clearGhost(); return; }

    // Best match: prefer key that starts with the typed word (first one wins)
    const match = mathKeywords.find(k =>
        k.key.toLowerCase().startsWith(currentWord)
    );

    if (match) {
        // Suffix = remainder of the key + full signature hint if it's a function
        const keyRemainder = match.key.substring(currentWord.length);
        const isFunc = match.key.endsWith('(');
        ghostSuffix = isFunc
            ? keyRemainder + match.hint + ')'
            : keyRemainder;
        ghostMatch  = match;
        // We pass val up to cursor so the transparent span aligns correctly
        renderGhost(val.substring(0, cursor), ghostSuffix);
    } else {
        clearGhost();
    }
});

// ─── Accept Ghost on Tab or → ────────────────────────────────────────────────

inputField.addEventListener('keydown', (e) => {
    if (!ghostSuffix) return;

    if (e.key === 'Tab' || e.key === 'ArrowRight') {
        e.preventDefault();
        const val    = inputField.value;
        const cursor = inputField.selectionStart;

        inputField.value = val.substring(0, cursor) + ghostSuffix + val.substring(cursor);
        const newPos = cursor + ghostSuffix.length;
        inputField.setSelectionRange(newPos, newPos);

        clearGhost();
        if (typeof autoExpand === 'function') autoExpand(inputField);
    }
});

// ─── Auto-Close Brackets/Parens ──────────────────────────────────────────────
// Typing an opening bracket inserts its closing partner and leaves the cursor
// between them (so `sqrt(` etc. become `sqrt()` with the cursor centred).
// Typing the closing character when it's already sitting right after the
// cursor just steps over it instead of inserting a duplicate. Backspacing
// inside an empty pair removes both characters. Typing an opener with text
// selected wraps the selection instead of replacing it.

const BRACKET_PAIRS = { '(': ')', '[': ']', '{': '}' };
const BRACKET_CLOSERS = { ')': '(', ']': '[', '}': '{' };

// Words that get swapped for a unicode symbol as soon as the user finishes
// typing them (triggered on the opening paren, e.g. "sqrt(" → "√(").
const UNICODE_WORD_REPLACEMENTS = {
    sqrt: '√',
    cbrt: '∛',
};

inputField.addEventListener('beforeinput', (e) => {
    if (e.isComposing) return;

    const val   = inputField.value;
    const start = inputField.selectionStart;
    const end   = inputField.selectionEnd;

    // "integrate" + space  →  ∫()dx  with the cursor left between the parens.
    // Covers plain typing (e.data === ' ') as well as mobile/keyboard word
    // suggestions, which typically insert the whole word plus a trailing
    // space in one shot via 'insertText' / 'insertReplacementText' /
    // 'insertCompositionText' with e.data like "integrate ".
    const isInsertion = typeof e.data === 'string' && e.data.length > 0 &&
        ['insertText', 'insertReplacementText', 'insertCompositionText', 'insertFromPaste'].includes(e.inputType);

    if (isInsertion && /\s$/.test(e.data)) {
        const predicted   = val.substring(0, start) + e.data + val.substring(end);
        const caretAfter  = start + e.data.length; // position right after the trailing space
        const spacePos    = caretAfter - 1;

        let wStart = spacePos;
        while (wStart > 0 && !/[\s+\-*/(),;]/.test(predicted[wStart - 1])) wStart--;
        const word = predicted.substring(wStart, spacePos);

        if (word.toLowerCase() === 'integrate') {
            e.preventDefault();
            const replacement = '∫()dx';
            inputField.value = predicted.substring(0, wStart) + replacement + predicted.substring(caretAfter);
            const caret = wStart + 2; // right after "∫("
            inputField.setSelectionRange(caret, caret);

            clearGhost();
            inputField.dispatchEvent(new Event('input'));
            if (typeof autoExpand === 'function') autoExpand(inputField);
            return;
        }
    }

    // "sqrt(" / "cbrt(" → "√(" / "∛(" the moment the opening paren is typed.
    if (e.inputType === 'insertText' && e.data === '(' && start === end) {
        let wStart = start;
        while (wStart > 0 && !/[\s+\-*/(),;]/.test(val[wStart - 1])) wStart--;
        const word = val.substring(wStart, start).toLowerCase();
        const symbol = UNICODE_WORD_REPLACEMENTS[word];

        if (symbol) {
            e.preventDefault();
            const replacement = symbol + '()';
            inputField.value = val.substring(0, wStart) + replacement + val.substring(start);
            const caret = wStart + symbol.length + 1; // right after the opening paren
            inputField.setSelectionRange(caret, caret);

            clearGhost();
            inputField.dispatchEvent(new Event('input'));
            if (typeof autoExpand === 'function') autoExpand(inputField);
            return;
        }
    }

    if (e.inputType === 'insertText' && Object.prototype.hasOwnProperty.call(BRACKET_PAIRS, e.data)) {
        e.preventDefault();
        const open  = e.data;
        const close = BRACKET_PAIRS[open];

        if (start !== end) {
            const selected = val.substring(start, end);
            inputField.value = val.substring(0, start) + open + selected + close + val.substring(end);
            inputField.setSelectionRange(start + 1, start + 1 + selected.length);
        } else {
            inputField.value = val.substring(0, start) + open + close + val.substring(end);
            inputField.setSelectionRange(start + 1, start + 1);
        }

        inputField.dispatchEvent(new Event('input'));
        if (typeof autoExpand === 'function') autoExpand(inputField);
        return;
    }

    if (e.inputType === 'insertText' && Object.prototype.hasOwnProperty.call(BRACKET_CLOSERS, e.data) && start === end && val[start] === e.data) {
        e.preventDefault();
        inputField.setSelectionRange(start + 1, start + 1);
        inputField.dispatchEvent(new Event('input'));
        return;
    }

    if (e.inputType === 'deleteContentBackward' && start === end && start > 0) {
        const before = val[start - 1];
        const after  = val[start];
        if (BRACKET_PAIRS[before] === after) {
            e.preventDefault();
            inputField.value = val.substring(0, start - 1) + val.substring(start + 1);
            inputField.setSelectionRange(start - 1, start - 1);
            inputField.dispatchEvent(new Event('input'));
            if (typeof autoExpand === 'function') autoExpand(inputField);
        }
    }
});

// Clear ghost when user moves away or clicks elsewhere
inputField.addEventListener('blur',  clearGhost);
inputField.addEventListener('click', () => {
    // Cursor may have jumped; recalculate
    inputField.dispatchEvent(new Event('input'));
});

// ─── Legacy applySug (kept for any external callers) ─────────────────────────

window.applySug = (match, lastWord) => {
    const val    = inputField.value;
    const cursor = inputField.selectionStart;
    let start    = cursor - 1;
    while (start >= 0 && !/[\s+\-*/(),;]/.test(val[start])) start--;
    start++;
    inputField.value = val.substring(0, start) + match + val.substring(cursor);
    const newPos = start + match.length;
    inputField.setSelectionRange(newPos, newPos);
    clearGhost();
    inputField.focus();
    if (typeof autoExpand === 'function') autoExpand(inputField);
};