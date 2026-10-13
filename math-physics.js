// math-physics.js — Physics problem solver
// Extracts quantities with units, matches against known formulas,
// solves for the missing variable, shows the working.

// ═══════════════════════════════════════════
//  UNITS
// ═══════════════════════════════════════════

var PHYS_UNIT_ALIASES = {
    'kg':   ['kg', 'kgs', 'kilogram', 'kilograms'],
    'g':    ['g', 'gram', 'grams'],
    'mg':   ['mg', 'milligram', 'milligrams'],
    'm':    ['m', 'meter', 'meters', 'metre', 'metres'],
    'cm':   ['cm', 'centimeter', 'centimeters'],
    'mm':   ['mm', 'millimeter', 'millimeters'],
    'km':   ['km', 'kilometer', 'kilometers'],
    's':    ['s', 'sec', 'secs', 'second', 'seconds'],
    'min':  ['min', 'mins', 'minute', 'minutes'],
    'h':    ['h', 'hr', 'hrs', 'hour', 'hours'],
    'ms':   ['m/s', 'mps', 'ms-1', 'm s-1', 'meters/second', 'metres/second'],
    'kms':  ['km/s', 'kmph', 'kilometers/hour', 'kilometres/hour'],
    'ms2':  ['m/s²', 'm/s^2', 'm/s2', 'mps2', 'ms-2', 'm s-2'],
    'n':    ['n', 'newton', 'newtons'],
    'j':    ['j', 'joule', 'joules'],
    'w':    ['w', 'watt', 'watts'],
    'kw':   ['kw', 'kilowatt', 'kilowatts'],
    'v':    ['v', 'volt', 'volts'],
    'a':    ['a', 'amp', 'amps', 'ampere', 'amperes'],
    'ohm':  ['ohm', 'ohms', 'Ω', 'ω'],
    'c':    ['c', 'coulomb', 'coulombs'],
    'hz':   ['hz', 'hertz'],
    'pa':   ['pa', 'pascal', 'pascals'],
    'kpa':  ['kpa', 'kilopascal', 'kilopascals'],
    'm3':   ['m³', 'm3', 'm^3', 'cubic meter', 'cubic meters'],
    'm2':   ['m²', 'm2', 'm^2', 'square meter', 'square meters'],
    'kgs':  ['kg·m/s', 'kg.m/s', 'kg*m/s', 'kgm/s'],
};

// Conversion to SI base values
var PHYS_TO_SI = {
    'kg':  1,
    'g':   0.001,
    'mg':  1e-6,
    'm':   1,
    'cm':  0.01,
    'mm':  0.001,
    'km':  1000,
    's':   1,
    'min': 60,
    'h':   3600,
    'ms':  1,
    'kms': 1000 / 3600,
    'ms2': 1,
    'n':   1,
    'j':   1,
    'w':   1,
    'kw':  1000,
    'v':   1,
    'a':   1,
    'ohm': 1,
    'c':   1,
    'hz':  1,
    'pa':  1,
    'kpa': 1000,
    'm3':  1,
    'm2':  1,
    'kgs': 1,
};

// Canonical display unit for each
var PHYS_DISPLAY_UNIT = {
    'kg': 'kg', 'g': 'kg', 'mg': 'kg',
    'm': 'm', 'cm': 'm', 'mm': 'm', 'km': 'm',
    's': 's', 'min': 's', 'h': 's',
    'ms': 'm/s', 'kms': 'm/s',
    'ms2': 'm/s²',
    'n': 'N', 'j': 'J',
    'w': 'W', 'kw': 'W',
    'v': 'V', 'a': 'A', 'ohm': 'Ω', 'c': 'C',
    'hz': 'Hz',
    'pa': 'Pa', 'kpa': 'Pa',
    'm3': 'm³', 'm2': 'm²',
    'kgs': 'kg·m/s',
};

var PHYS_UNIT_LOOKUP = {};
for (var __pu in PHYS_UNIT_ALIASES) {
    var __arr = PHYS_UNIT_ALIASES[__pu];
    for (var __i = 0; __i < __arr.length; __i++) {
        PHYS_UNIT_LOOKUP[__arr[__i].toLowerCase()] = __pu;
    }
}

// ═══════════════════════════════════════════
//  FORMULA LIBRARY
// ═══════════════════════════════════════════
// Each formula declares its variables with the canonical SI unit,
// a human name, and word aliases. `keywords` is the text pattern
// that suggests this formula over the alternatives.

var PHYS_FORMULAS = [
    {
        id: 'newton2',
        title: "Newton's Second Law",
        expr: 'F = m * a',
        variables: {
            F: { unit: 'n',   names: ['force', 'net force'] },
            m: { unit: 'kg',  names: ['mass'] },
            a: { unit: 'ms2', names: ['acceleration'] },
        },
        keywords: /\b(?:force|newton'?s?\s+second|push|pull)\b/i,
        exclude:  /\bgravitat|between\s+two\s+mass|planet|earth\s+and|moon\s+and\b/i,
    },
    {
        id: 'kin1',
        title: 'First Equation of Motion',
        expr: 'v = u + a * t',
        variables: {
            v: { unit: 'ms',   names: ['final velocity', 'final speed'] },
            u: { unit: 'ms',   names: ['initial velocity', 'initial speed', 'starting velocity'] },
            a: { unit: 'ms2',  names: ['acceleration'] },
            t: { unit: 's',    names: ['time'] },
        },
        keywords: /\b(?:final velocity|final speed|initial velocity|initial speed|kinematic)\b/i,
    },
    {
        id: 'kin2',
        title: 'Second Equation of Motion',
        expr: 's = u * t + 0.5 * a * t * t',
        variables: {
            s: { unit: 'm',    names: ['displacement', 'distance', 'distance travelled', 'distance traveled'] },
            u: { unit: 'ms',   names: ['initial velocity', 'initial speed'] },
            a: { unit: 'ms2',  names: ['acceleration'] },
            t: { unit: 's',    names: ['time'] },
        },
        keywords: /\b(?:displacement|distance\s+travel|distance\s+travelled|second equation)\b/i,
    },
    {
        id: 'kin3',
        title: 'Third Equation of Motion',
        expr: 'v * v = u * u + 2 * a * s',
        variables: {
            v: { unit: 'ms',   names: ['final velocity', 'final speed'] },
            u: { unit: 'ms',   names: ['initial velocity', 'initial speed'] },
            a: { unit: 'ms2',  names: ['acceleration'] },
            s: { unit: 'm',    names: ['displacement', 'distance'] },
        },
        keywords: /\b(?:third equation|final velocity|final speed)\b/i,
    },
    {
        id: 'work',
        title: 'Work Done',
        expr: 'W = F * d',
        variables: {
            W: { unit: 'j',   names: ['work', 'work done'] },
            F: { unit: 'n',   names: ['force'] },
            d: { unit: 'm',   names: ['displacement', 'distance'] },
        },
        keywords: /\b(?:work\s+done|work)\b/i,
    },
    {
        id: 'ke',
        title: 'Kinetic Energy',
        expr: 'KE = 0.5 * m * v * v',
        variables: {
            KE: { unit: 'j',   names: ['kinetic energy', 'kinetic'] },
            m:  { unit: 'kg',  names: ['mass'] },
            v:  { unit: 'ms',  names: ['velocity', 'speed'] },
        },
        keywords: /\b(?:kinetic\s+energy|\bke\b)\b/i,
    },
    {
        id: 'pe',
        title: 'Potential Energy',
        expr: 'PE = m * g * h',
        variables: {
            PE: { unit: 'j',   names: ['potential energy', 'pe'] },
            m:  { unit: 'kg',  names: ['mass'] },
            h:  { unit: 'm',   names: ['height'] },
        },
        keywords: /\b(?:potential\s+energy|\bpe\b|gravitational\s+potential)\b/i,
        constants: { g: 9.8 },
    },
    {
        id: 'power',
        title: 'Power',
        expr: 'P = W / t',
        variables: {
            P: { unit: 'w',   names: ['power'] },
            W: { unit: 'j',   names: ['work', 'work done', 'energy'] },
            t: { unit: 's',   names: ['time'] },
        },
        keywords: /\b(?:power|watts?)\b/i,
        exclude: /\b(?:electrical|electric|ohm|voltage|current)\b/i,
    },
    {
        id: 'momentum',
        title: 'Linear Momentum',
        expr: 'p = m * v',
        variables: {
            p: { unit: 'kgs',  names: ['momentum'] },
            m: { unit: 'kg',   names: ['mass'] },
            v: { unit: 'ms',   names: ['velocity', 'speed'] },
        },
        keywords: /\bmomentum\b/i,
    },
    {
        id: 'ohm',
        title: "Ohm's Law",
        expr: 'V = I * R',
        variables: {
            V: { unit: 'v',   names: ['voltage', 'potential difference', 'pd'] },
            I: { unit: 'a',   names: ['current'] },
            R: { unit: 'ohm', names: ['resistance'] },
        },
        keywords: /\b(?:ohm|resistance|voltage|potential\s+difference|\bcurrent\b)\b/i,
        exclude: /\b(?:power|watt)\b/i,
    },
    {
        id: 'epower',
        title: 'Electrical Power',
        expr: 'P = V * I',
        variables: {
            P: { unit: 'w', names: ['power'] },
            V: { unit: 'v', names: ['voltage', 'potential difference'] },
            I: { unit: 'a', names: ['current'] },
        },
        keywords: /\b(?:electrical\s+power|electric\s+power)\b/i,
    },
    {
        id: 'density',
        title: 'Density',
        expr: 'rho = m / Vol',
        variables: {
            rho: { unit: 'kg/m3', names: ['density'] },
            m:   { unit: 'kg',    names: ['mass'] },
            Vol: { unit: 'm3',    names: ['volume'] },
        },
        keywords: /\bdensity\b/i,
    },
    {
        id: 'pressure',
        title: 'Pressure',
        expr: 'P = F / A',
        variables: {
            P: { unit: 'pa', names: ['pressure'] },
            F: { unit: 'n',  names: ['force'] },
            A: { unit: 'm2', names: ['area'] },
        },
        keywords: /\bpressure\b/i,
    },
    {
        id: 'wave',
        title: 'Wave Equation',
        expr: 'v = f * lambda',
        variables: {
            v:      { unit: 'ms', names: ['velocity', 'speed', 'wave speed'] },
            f:      { unit: 'hz', names: ['frequency'] },
            lambda: { unit: 'm',  names: ['wavelength'] },
        },
        keywords: /\b(?:wavelength|frequency|wave\s+speed)\b/i,
    },
    {
        id: 'grav',
        title: "Newton's Law of Gravitation",
        expr: 'F = G * M * m / (r * r)',
        variables: {
            F: { unit: 'n',  names: ['force', 'gravitational force'] },
            M: { unit: 'kg', names: ['mass 1', 'first mass', 'larger mass'] },
            m: { unit: 'kg', names: ['mass 2', 'second mass'] },
            r: { unit: 'm',  names: ['distance'] },
        },
        keywords: /\b(?:gravitat\w*|between\s+two\s+mass|planet|earth\s+and|moon\s+and)\b/i,
        constants: { G: 6.674e-11 },
    },
];

// ═══════════════════════════════════════════
//  QUANTITY EXTRACTION
// ═══════════════════════════════════════════

function physExtractQuantities(text) {
    var out = [];
    var re = /(-?\d+(?:\.\d+)?)\s*([a-zA-ZΩω°\/\^²³⁻·]+(?:\s*-?\d+)?)/g;
    var m;
    while ((m = re.exec(text)) !== null) {
        var val = parseFloat(m[1]);
        if (!isFinite(val)) continue;
        var unitRaw = m[2]
            .replace(/[.,;:!?]+$/, '')
            .replace(/\s+/g, '')
            .trim()
            .toLowerCase();

        var unitKey = PHYS_UNIT_LOOKUP[unitRaw];
        if (!unitKey) {
            if (PHYS_UNIT_LOOKUP[unitRaw + 's']) unitKey = PHYS_UNIT_LOOKUP[unitRaw + 's'];
            else continue;
        }

        var siValue = val * PHYS_TO_SI[unitKey];
        var dispUnit = PHYS_DISPLAY_UNIT[unitKey];
        out.push({
            value: siValue,
            originalValue: val,
            unit: unitKey,
            displayUnit: dispUnit,
            raw: m[0],
            idx: m.index,
        });
    }
    return out;
}

// ═══════════════════════════════════════════
//  FORMULA PICKING
// ═══════════════════════════════════════════

function physPickFormula(text, quantities) {
    var candidates = [];
    for (var i = 0; i < PHYS_FORMULAS.length; i++) {
        var f = PHYS_FORMULAS[i];
        if (f.exclude && f.exclude.test(text)) continue;

        var keywordHit = f.keywords.test(text);

        // Count how many of the formula's variables have a matching quantity
        var matched = 0;
        var usedUnits = {};
        var needed = Object.keys(f.variables).length;
        for (var vName in f.variables) {
            var vUnit = f.variables[vName].unit;
            var hit = false;
            for (var qi = 0; qi < quantities.length; qi++) {
                if (quantities[qi].unit === vUnit) { hit = true; break; }
            }
            if (hit) matched++;
        }

        if (!keywordHit && matched < needed - 1) continue;

        // Score: keyword hits + coverage
        var score = matched;
        if (keywordHit) score += 3;
        // Prefer formulas that leave exactly one unknown
        if (matched === needed - 1) score += 2;

        candidates.push({ formula: f, score: score, matched: matched });
    }

    candidates.sort(function(a, b) { return b.score - a.score; });
    return candidates.length ? candidates[0].formula : null;
}

// ═══════════════════════════════════════════
//  TARGET DETECTION
// ═══════════════════════════════════════════

function physFindTarget(text, formula) {
    var lower = text.toLowerCase();
    var asked = [];

    var askRe = /\b(?:find|calculate|determine|compute|what\s+is|what'?s|how\s+much|how\s+many|solve\s+for)\s+([a-z\s]+?)(?:\?|$|\.|,|\bin\b|\bif\b|\bwhen\b)/gi;
    var m;
    while ((m = askRe.exec(lower)) !== null) {
        asked.push(m[1].trim());
    }

    for (var vName in formula.variables) {
        var info = formula.variables[vName];
        var names = info.names || [];
        for (var ai = 0; ai < asked.length; ai++) {
            for (var ni = 0; ni < names.length; ni++) {
                if (asked[ai].indexOf(names[ni]) !== -1) {
                    return vName;
                }
            }
        }
    }

    for (var vName2 in formula.variables) {
        var info2 = formula.variables[vName2];
        for (var ni2 = 0; ni2 < (info2.names || []).length; ni2++) {
            if (lower.indexOf(info2.names[ni2]) !== -1) return vName2;
        }
    }

    return null;
}

// ═══════════════════════════════════════════
//  VARIABLE ASSIGNMENT
// ═══════════════════════════════════════════

function physAssignKnowns(formula, quantities, target) {
    var knowns = {};
    var used = {};
    var vNames = Object.keys(formula.variables);

    // Group by unit so we can assign same-unit quantities in order
    var byUnit = {};
    for (var qi = 0; qi < quantities.length; qi++) {
        var q = quantities[qi];
        if (!byUnit[q.unit]) byUnit[q.unit] = [];
        byUnit[q.unit].push(q);
    }

    // Pass 1: vars whose unit appears exactly once
    for (var vi = 0; vi < vNames.length; vi++) {
        var vName = vNames[vi];
        if (vName === target) continue;
        var vUnit = formula.variables[vName].unit;
        var pool = byUnit[vUnit] || [];
        if (pool.length === 1 && !pool[0]._used) {
            knowns[vName] = pool[0].value;
            pool[0]._used = true;
        }
    }

    // Pass 2: shared units — assign remaining quantities in text order
    for (var vi2 = 0; vi2 < vNames.length; vi2++) {
        var vName2 = vNames[vi2];
        if (vName2 === target || vName2 in knowns) continue;
        var vUnit2 = formula.variables[vName2].unit;
        var pool2 = byUnit[vUnit2] || [];
        for (var pi = 0; pi < pool2.length; pi++) {
            if (!pool2[pi]._used) {
                knowns[vName2] = pool2[pi].value;
                pool2[pi]._used = true;
                break;
            }
        }
    }

    return knowns;
}

// ═══════════════════════════════════════════
//  NUMERIC SOLVER
// ═══════════════════════════════════════════

function physCompileFormula(expr, varNames) {
    var eqIdx = expr.indexOf('=');
    var lhs = expr.slice(0, eqIdx).trim();
    var rhs = expr.slice(eqIdx + 1).trim();

    // Normalize
    function norm(s) {
        return s
            .replace(/½/g, '0.5')
            .replace(/²/g, '**2')
            .replace(/³/g, '**3')
            .replace(/\^/g, '**');
    }

    var body = '(' + norm(rhs) + ') - (' + norm(lhs) + ')';
    try {
        var fn = new Function(varNames.join(','), 'return ' + body + ';');
        return fn;
    } catch (e) {
        return null;
    }
}

function physFindRoots(f, lo, hi, N) {
    lo = lo === undefined ? 0 : lo;
    hi = hi === undefined ? 1e7 : hi;
    N = N || 500;

    var roots = [];
    var prevX = lo, prevY = f(lo);
    for (var i = 1; i <= N; i++) {
        var x = lo + (hi - lo) * i / N;
        var y = f(x);
        if (isFinite(prevY) && isFinite(y) && prevY * y <= 0) {
            var a = prevX, b = x, fa = prevY;
            for (var it = 0; it < 80; it++) {
                var mid = (a + b) / 2;
                var fm = f(mid);
                if (Math.abs(fm) < 1e-12 || (b - a) < 1e-14) break;
                if (fa * fm <= 0) { b = mid; } else { a = mid; fa = fm; }
            }
            var root = (a + b) / 2;
            var dup = false;
            for (var r = 0; r < roots.length; r++) {
                if (Math.abs(roots[r] - root) < Math.max(1e-6, Math.abs(root) * 1e-6)) {
                    dup = true; break;
                }
            }
            if (!dup) roots.push(root);
        }
        prevX = x; prevY = y;
    }
    return roots;
}

function physSolve(formula, knowns, target) {
    var varNames = Object.keys(formula.variables);
    var constants = formula.constants || {};
    var allNames = varNames.concat(Object.keys(constants));

    var fn = physCompileFormula(formula.expr, allNames);
    if (!fn) return null;

    var f = function(x) {
        var args = allNames.map(function(n) {
            if (n === target) return x;
            if (n in constants) return constants[n];
            if (n in knowns) return knowns[n];
            return 0;
        });
        try { return fn.apply(null, args); }
        catch (e) { return NaN; }
    };

    // Distance, time, mass, area — non-negative
    var nonNegOnly = /^(s|t|d|m|h|r|Vol|A|rho|lambda|KE|PE|W|P)$/.test(target);
    var lo = nonNegOnly ? 0 : -1e7;
    var hi = 1e7;

    var roots = physFindRoots(f, lo, hi, 800);
    if (!roots.length) return null;

    // Prefer positive roots
    var positive = roots.filter(function(r) { return r > 0; });
    if (positive.length) return positive;
    return roots;
}

// ═══════════════════════════════════════════
//  FORMATTING
// ═══════════════════════════════════════════

function physEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function physFmtNumber(n) {
    if (!isFinite(n)) return String(n);
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) {
        return n.toExponential(4).replace(/e([+-])(\d+)/, '×10$1$2');
    }
    var r = Math.round(n * 1e6) / 1e6;
    if (Number.isInteger(r)) return String(r);
    return String(r);
}

function physFormat(formula, knowns, target, roots) {
    var out = [];
    out.push('<div class="xetex-output">');
    out.push('<div class="xetex-equation">' + physEsc(formula.title) + '</div>');

    // Knowns
    out.push('<div class="xetex-step"><div class="xetex-step-num">1</div><div class="xetex-step-body">Known quantities</div></div>');
    for (var vName in knowns) {
        var info = formula.variables[vName];
        var du = info.unitDisplay || PHYS_DISPLAY_UNIT[info.unit] || '';
        out.push('<div class="xetex-indent">' + physEsc(vName) + ' = ' + physFmtNumber(knowns[vName]) + ' ' + physEsc(du) + '</div>');
    }

    // Formula
    out.push('<div class="xetex-step"><div class="xetex-step-num">2</div><div class="xetex-step-body">Formula</div></div>');
    out.push('<div class="xetex-indent">' + physEsc(formula.expr.replace(/\*/g, ' × ')) + '</div>');

    // Substitution
    out.push('<div class="xetex-step"><div class="xetex-step-num">3</div><div class="xetex-step-body">Substitute known values</div></div>');
    var subbed = formula.expr;
    var targetUnit = PHYS_DISPLAY_UNIT[formula.variables[target].unit] || '';
    for (var kName in knowns) {
        subbed = subbed.replace(new RegExp('\\b' + kName + '\\b', 'g'), physFmtNumber(knowns[kName]));
    }
    // Add constants for display
    for (var cName in (formula.constants || {})) {
        subbed = subbed.replace(new RegExp('\\b' + cName + '\\b', 'g'), physFmtNumber(formula.constants[cName]));
    }
    subbed = subbed.replace(new RegExp('\\b' + target + '\\b', 'g'), target);
    out.push('<div class="xetex-indent">' + physEsc(subbed.replace(/\*/g, ' × ')) + '</div>');

    // Solution
    out.push('<div class="xetex-step"><div class="xetex-step-num">4</div><div class="xetex-step-body">Solve for ' + physEsc(target) + '</div></div>');

    if (roots.length === 1) {
        out.push('<div class="xetex-indent">' + physEsc(target) + ' = ' + physFmtNumber(roots[0]) + ' ' + physEsc(targetUnit) + '</div>');
    } else {
        for (var ri = 0; ri < roots.length; ri++) {
            out.push('<div class="xetex-indent">' + physEsc(target) + ' = ' + physFmtNumber(roots[ri]) + ' ' + physEsc(targetUnit) + '</div>');
        }
    }

    // Answer
    var answerStr;
    if (roots.length === 1) {
        answerStr = target + ' = ' + physFmtNumber(roots[0]) + ' ' + targetUnit;
    } else {
        answerStr = roots.map(function(r) { return target + ' = ' + physFmtNumber(r) + ' ' + targetUnit; }).join('  or  ');
    }

    out.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">' + physEsc(answerStr) + '</span></div>');
    out.push('</div>');
    return out.join('');
}

// ═══════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════

function isPhysicsProblem(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    if (!t || t.length > 500) return false;

    // Must contain a number with a recognizable unit
    var quantities = physExtractQuantities(t);
    if (quantities.length < 2) return false;

    // Must mention at least one physics-ish keyword
    for (var i = 0; i < PHYS_FORMULAS.length; i++) {
        var f = PHYS_FORMULAS[i];
        if (f.exclude && f.exclude.test(t)) continue;
        if (f.keywords.test(t)) return true;
    }

    return false;
}

function physHandle(text) {
    var t = String(text).trim();

    var quantities = physExtractQuantities(t);
    if (quantities.length < 2) return null;

    var formula = physPickFormula(t, quantities);
    if (!formula) return null;

    var target = physFindTarget(t, formula);
    if (!target) {
        // Fall back: the one variable with no matching quantity
        var knownsTest = physAssignKnowns(formula, quantities, null);
        var missing = null;
        for (var v in formula.variables) {
            if (!(v in knownsTest)) {
                if (missing) return null;
                missing = v;
            }
        }
        target = missing;
        if (!target) return null;
    }

    var knowns = physAssignKnowns(formula, quantities, target);

    // Need all non-target variables filled
    for (var vN in formula.variables) {
        if (vN === target) continue;
        if (!(vN in knowns) && !(formula.constants && vN in formula.constants)) {
            return null;
        }
    }

    var roots = physSolve(formula, knowns, target);
    if (!roots || !roots.length) return null;

    var html = physFormat(formula, knowns, target, roots);
    return { __html: true, text: html };
}

window.isPhysicsProblem = isPhysicsProblem;
window.physHandle = physHandle;