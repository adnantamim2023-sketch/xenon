// math-algebra.js — Quadratic and Cubic solver
// (Integration solver lives in math-integration.js)

const GREEK_LETTER_NAMES = [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho',
    'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
];
const GREEK_LETTER_REGEX = new RegExp('\\b(' + GREEK_LETTER_NAMES.join('|') + ')\\b', 'i');
const RAD_TO_DEG_ALGEBRA = 180 / Math.PI;

const SINGLE_LETTER_VAR_REGEX = /\d*[a-zA-Z](?:_?\d+)?\b/;

function isIsolatedVariableToken(text) {
    let searchFrom = 0;
    while (searchFrom < text.length) {
        const remainder = text.slice(searchFrom);
        const match = SINGLE_LETTER_VAR_REGEX.exec(remainder);
        if (!match) return false;
        const startIndex = searchFrom + match.index;
        const endIndex = startIndex + match[0].length;
        const beforeChar = text[startIndex - 1];
        const afterChar = text[endIndex];
        const precededByLetter = beforeChar && /[a-zA-Z]/.test(beforeChar);
        const followedByLetter = afterChar && /[a-zA-Z]/.test(afterChar);
        if (!precededByLetter && !followedByLetter) return true;
        searchFrom = endIndex;
    }
    return false;
}

function containsVariable(text) {
    const withoutFunctions = text
        .replace(MATH_FUNCTION_REGEX, ' ')
        .replace(SCIENTIFIC_PAREN_EXPONENT_REGEX, ' ')
        .replace(SCIENTIFIC_NUMBER_REGEX, ' ');
    if (GREEK_LETTER_REGEX.test(withoutFunctions)) return true;
    return isIsolatedVariableToken(withoutFunctions);
}

function isAlgebra(text) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (trimmed.length > 80) return false;
    if (!containsVariable(trimmed)) return false;

    const hasEquals = /=/.test(trimmed);
    const hasDigit = /\d/.test(trimmed);
    const hasOperator = MATH_UNICODE_REGEX.test(trimmed);
    if (!hasEquals && !(hasDigit && hasOperator)) return false;

    const residue = trimmed
    .replace(MATH_FUNCTION_REGEX, ' ')
    .replace(/\b\w+\b/g, function (word) {
        if (/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(word)) return ' ';
        if (/^[a-zA-Z]\d*$/.test(word)) return ' ';
        if (/^\d+[a-zA-Z]\d*$/.test(word)) return ' ';
        return word;
    })
    .replace(/[^a-zA-Z]/g, '');

    if (residue.length > 0) return false;
    return true;
}

function maGcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = b; b = a % b; a = t; }
    return a;
}

function maParseCoeff(s) {
    if (s === '' || s === '+') return 1;
    if (s === '-') return -1;
    var v = parseFloat(s);
    return isNaN(v) ? null : v;
}

function maParsePolySide(side, v) {
    side = side.trim();
    if (!side) return { p3: 0, p2: 0, p1: 0, p0: 0 };

    var vEsc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    var tokens = [];
    var current = '';
    var depth = 0;
    for (var i = 0; i < side.length; i++) {
        var ch = side[i];
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if ((ch === '+' || ch === '-') && depth === 0 && i > 0) {
            tokens.push(current);
            current = ch;
        } else {
            current += ch;
        }
    }
    if (current) tokens.push(current);

    var p3 = 0, p2 = 0, p1 = 0, p0 = 0;

    for (var ti = 0; ti < tokens.length; ti++) {
        var t = tokens[ti].replace(/\s+/g, '').trim();
        if (!t) continue;

        var m, c;

        m = t.match(new RegExp('^([+-]?\\d*\\.?\\d*)' + vEsc + '\\^\\(?3\\)?$', 'i'));
        if (m) { c = maParseCoeff(m[1]); if (c === null) return null; p3 += c; continue; }

        m = t.match(new RegExp('^([+-]?\\d*\\.?\\d*)' + vEsc + '³$', 'i'));
        if (m) { c = maParseCoeff(m[1]); if (c === null) return null; p3 += c; continue; }

        m = t.match(new RegExp('^([+-]?\\d*\\.?\\d*)' + vEsc + '\\^\\(?2\\)?$', 'i'));
        if (m) { c = maParseCoeff(m[1]); if (c === null) return null; p2 += c; continue; }

        m = t.match(new RegExp('^([+-]?\\d*\\.?\\d*)' + vEsc + '²$', 'i'));
        if (m) { c = maParseCoeff(m[1]); if (c === null) return null; p2 += c; continue; }

        m = t.match(new RegExp('^([+-]?\\d*\\.?\\d*)' + vEsc + '$', 'i'));
        if (m) { c = maParseCoeff(m[1]); if (c === null) return null; p1 += c; continue; }

        if (/^[+-]?\d+(\.\d+)?$/.test(t)) { p0 += parseFloat(t); continue; }

        return null;
    }

    return { p3: p3, p2: p2, p1: p1, p0: p0 };
}

function maFormatPoly(coeffs, v) {
    var parts = [];
    for (var i = 3; i >= 0; i--) {
        var c = coeffs[i];
        if (c === 0) continue;
        var absC = Math.abs(c);
        var varPart = i === 0 ? '' : (i === 1 ? v : (i === 2 ? v + '²' : v + '³'));
        var piece;
        if (varPart === '') piece = String(absC);
        else if (absC === 1) piece = varPart;
        else piece = absC + varPart;
        if (parts.length === 0) parts.push((c < 0 ? '-' : '') + piece);
        else parts.push((c < 0 ? ' - ' : ' + ') + piece);
    }
    return parts.length ? parts.join('') : '0';
}

function maSolveLinearEq(a, b, v) {
    var steps = [];
    steps.push('<div class="xetex-output">');
    steps.push('<div class="xetex-equation">' + maFormatPoly([b, a, 0, 0], v) + ' = 0</div>');

    var stepN = 1;

    if (b !== 0) {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepN + '</div><div class="xetex-step-body">Move the constant to the right side</div></div>');
        var action = b > 0 ? 'Subtract' : 'Add';
        steps.push('<div class="xetex-indent">' + action + ' ' + Math.abs(b) + ' ' + (b > 0 ? 'from' : 'to') + ' both sides</div>');
        steps.push('<div class="xetex-indent">' + maFormatPoly([0, a, 0, 0], v) + ' = ' + (-b) + '</div>');
        stepN++;
    }

    var solution = -b / a;
    var answerStr;

    if (Number.isInteger(solution)) {
        answerStr = v + ' = ' + solution;
    } else {
        var g = maGcd(Math.abs(-b), Math.abs(a));
        var sn = -b / g, sd = a / g;
        if (sd < 0) { sn = -sn; sd = -sd; }
        if (sd === 1) answerStr = v + ' = ' + sn;
        else answerStr = v + ' = ' + sn + '/' + sd + ' ≈ ' + parseFloat(solution.toPrecision(6));
    }

    if (a !== 1) {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepN + '</div><div class="xetex-step-body">Divide both sides by ' + a + '</div></div>');
        steps.push('<div class="xetex-indent">' + answerStr + '</div>');
    }

    steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">' + answerStr + '</span></div>');
    steps.push('</div>');
    return steps.join('');
}

function maTrySolvePolynomial(eqStr, v) {
    var eqIdx = eqStr.indexOf('=');
    if (eqIdx === -1) return null;

    var lhs = eqStr.slice(0, eqIdx).trim();
    var rhs = eqStr.slice(eqIdx + 1).trim();
    if (!lhs || !rhs) return null;

    var L = maParsePolySide(lhs, v);
    if (!L) return null;
    var R = maParsePolySide(rhs, v);
    if (!R) return null;

    var c0 = L.p0 - R.p0;
    var c1 = L.p1 - R.p1;
    var c2 = L.p2 - R.p2;
    var c3 = L.p3 - R.p3;

    if (c3 !== 0) return null;
    if (c2 !== 0) return { kind: 'quadratic', a: c2, b: c1, c: c0 };
    if (c1 !== 0) return { kind: 'linear', a: c1, b: c0 };
    return { kind: 'degenerate', c0: c0 };
}

function maExtractVarLetter(text) {
    var cleaned = text
        .replace(MATH_FUNCTION_REGEX, '')
        .replace(/[^a-zA-Z]/g, '');
    var uniq = Array.from(new Set(cleaned.toLowerCase().split('')));
    return (uniq.length === 1) ? uniq[0] : null;
}

function maQuickSendButton(label, sublabel, newText) {
    var t = String(newText).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    var handler = "var ta=document.getElementById('userInput'); " +
                  "if(ta){ ta.value = \"" + t + "\"; ta.dispatchEvent(new Event('input')); } " +
                  "if (typeof sendMessage === 'function') sendMessage();";
    handler = handler.replace(/"/g, '&quot;');
    return '<button type="button" class="xetex-logic-option-btn" onclick="' + handler + '">' +
        label +
        (sublabel ? '<span class="xetex-logic-option-sub">' + sublabel + '</span>' : '') +
        '</button>';
}

function maEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function maAskAboutExpression(expr, varLetter) {
    var v = varLetter || 'x';
    var out = [];
    out.push('<div class="xetex-output">');
    out.push('<div class="xetex-equation">' + maEsc(expr) + '</div>');
    out.push('<div class="xetex-logic-question">');
    out.push('<div class="xetex-logic-question-prompt">' +
        'That\'s an expression, not an equation. What should I do with it?' +
        '</div>');
    out.push('<div class="xetex-logic-question-options">');
    out.push(maQuickSendButton('Solve = 0', 'Find the root', '/algebra ' + expr + ' = 0'));
    out.push(maQuickSendButton('Integrate', '∫ ' + v + ' d' + v, '/integrate ' + expr + ' d' + v));
    out.push(maQuickSendButton('Solve = 10', 'Custom target', '/algebra ' + expr + ' = 10'));
    out.push('</div>');
    out.push('<div class="xetex-note">Or type your own — e.g. <b>/algebra ' +
        maEsc(expr) + ' = 10</b>, or <b>/algebra ' + v + ' = 3</b> to evaluate.</div>');
    out.push('</div>');
    out.push('</div>');
    return out.join('');
}

function mathAlgebraHandle(text) {
    console.log('math-algebra.js received:', text);
    var trimmed = text.trim();

    if (trimmed.toLowerCase().startsWith('integrate') || trimmed.toLowerCase().startsWith('∫')) {
        var expr = trimmed.replace(/^integrate\s+/i, '').replace(/^∫\s*/, '').replace(/\s*dx$/i, '');
        return { __html: true, text: solveIntegration(expr) };
    }

    trimmed = trimmed.replace(/\^3/g, '³').replace(/\^2/g, '²');

    // ── Bare expression (no equals sign) ──
    if (!/=/.test(trimmed)) {
        var bareVar = maExtractVarLetter(trimmed);
        if (bareVar && /[\d\+\-\*\/\^²³]/.test(trimmed)) {
            return { __html: true, text: maAskAboutExpression(trimmed, bareVar) };
        }
    }

    // ── Unknown target "= ?" ──
    if (/=\s*\?\s*$/.test(trimmed)) {
        var lhsOnly = trimmed.replace(/=\s*\?\s*$/, '').trim();
        var qVar = maExtractVarLetter(lhsOnly);
        if (qVar) {
            return { __html: true, text: maAskAboutExpression(lhsOnly, qVar) };
        }
    }

    // ── Equation solving ──
    if (/=/.test(trimmed) && !/x³/.test(trimmed)) {
        var varLetter = maExtractVarLetter(trimmed);

        if (varLetter) {
            var parsed = maTrySolvePolynomial(trimmed, varLetter);
            if (parsed) {
                if (parsed.kind === 'linear') {
                    return { __html: true, text: maSolveLinearEq(parsed.a, parsed.b, varLetter) };
                }
                if (parsed.kind === 'quadratic') {
                    return { __html: true, text: solveQuadratic(parsed.a, parsed.b, parsed.c) };
                }
                if (parsed.kind === 'degenerate') {
                    var out = ['<div class="xetex-output">'];
                    out.push('<div class="xetex-equation">' + trimmed + '</div>');
                    if (parsed.c0 === 0) {
                        out.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">Infinitely many solutions</span></div>');
                        out.push('<div class="xetex-note">Both sides are identical — every value of ' + varLetter + ' works.</div>');
                    } else {
                        out.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">No solution</span></div>');
                        out.push('<div class="xetex-note">The equation reduces to ' + parsed.c0 + ' = 0, which is false.</div>');
                    }
                    out.push('</div>');
                    return { __html: true, text: out.join('') };
                }
            }
        }
    }

    var cubicMatch = trimmed.match(/(-?\d*)x³\s*([+-]\s*\d*)x²\s*([+-]\s*\d*)x\s*([+-]\s*\d*)\s*=\s*0/);
    if (cubicMatch) {
        var a = parseInt(cubicMatch[1]) || (cubicMatch[1] === '-' ? -1 : 1);
        var b = parseInt(cubicMatch[2].replace(/\s/g, '')) || (cubicMatch[2].includes('-') ? -1 : 1);
        var c = parseInt(cubicMatch[3].replace(/\s/g, '')) || (cubicMatch[3].includes('-') ? -1 : 1);
        var d = parseInt(cubicMatch[4].replace(/\s/g, '')) || 0;
        return { __html: true, text: solveCubic(a, b, c, d) };
    }

    var quadraticMatch = trimmed.match(/(-?\d*)x²\s*([+-]\s*\d*)x\s*([+-]\s*\d*)\s*=\s*0/);
    if (quadraticMatch) {
        var a = parseInt(quadraticMatch[1]) || (quadraticMatch[1] === '-' ? -1 : 1);
        var b = parseInt(quadraticMatch[2].replace(/\s/g, '')) || (quadraticMatch[2].includes('-') ? -1 : 1);
        var c = parseInt(quadraticMatch[3].replace(/\s/g, '')) || 0;
        return { __html: true, text: solveQuadratic(a, b, c) };
    }

    var trigMatch = trimmed.match(/^(sin|cos|tan|csc|sec|cot)\s*\(\s*x\s*\)\s*=\s*(.+)$/i);
    if (trigMatch) {
        var trigFn = trigMatch[1].toLowerCase();
        var rhsRaw = trigMatch[2].trim();
        var rhsResult = (typeof evaluateArithmetic === 'function') ? evaluateArithmetic(rhsRaw) : null;
        var rhsVal = rhsResult ? parseFloat(rhsResult.split('=').pop()) : parseFloat(rhsRaw);
        if (isNaN(rhsVal)) {
            return `Couldn't read "${rhsRaw}" as a number to solve ${trigFn}(x) = ${rhsRaw}.`;
        }
        return { __html: true, text: solveTrigEquation(trigFn, rhsVal) };
    }

    return 'math-algebra';
}

function solveTrigEquation(fnName, k) {
    var steps = [];
    steps.push('<div class="xetex-output">');
    steps.push('<div class="xetex-equation">' + fnName + '(x) = ' + k + '</div>');

    function clean(n) { if (Number.isInteger(n)) return n; return parseFloat(n.toPrecision(10)); }

    var reciprocalOf = { csc: 'sin', sec: 'cos', cot: 'tan' };
    var usedReciprocalStep = false;
    if (reciprocalOf[fnName]) {
        if (k === 0) {
            steps.push('<div class="xetex-note">' + fnName + '(x) can never equal 0 — no solutions.</div>');
            steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span>No solution</div>');
            steps.push('</div>'); return steps.join('');
        }
        var baseFn = reciprocalOf[fnName];
        var baseK = 1 / k;
        steps.push('<div class="xetex-step"><div class="xetex-step-num">1</div><div class="xetex-step-body">Rewrite using the reciprocal identity</div></div>');
        steps.push('<div class="xetex-indent">' + baseFn + '(x) = 1/' + k + ' = ' + clean(baseK) + '</div>');
        fnName = baseFn;
        k = baseK;
        usedReciprocalStep = true;
    }

    var domainOk = (fnName === 'tan') || (k >= -1 && k <= 1);
    if (!domainOk) {
        steps.push('<div class="xetex-note">' + fnName + '(x) only ranges from -1 to 1, so ' + fnName + '(x) = ' + k + ' has no solution.</div>');
        steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span>No solution</div>');
        steps.push('</div>'); return steps.join('');
    }

    var principalDeg, n = usedReciprocalStep ? 2 : 1;
    if (fnName === 'sin') principalDeg = Math.asin(k) * RAD_TO_DEG_ALGEBRA;
    else if (fnName === 'cos') principalDeg = Math.acos(k) * RAD_TO_DEG_ALGEBRA;
    else principalDeg = Math.atan(k) * RAD_TO_DEG_ALGEBRA;

    principalDeg = clean(principalDeg);
    steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Take the inverse ' + fnName + '</div></div>');
    steps.push('<div class="xetex-indent">x = ' + fnName + '⁻¹(' + k + ') = ' + principalDeg + '°</div>');
    n++;

    var general;
    if (fnName === 'sin') {
        var secondDeg = clean(180 - principalDeg);
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Find all solutions in one period (0°–360°)</div></div>');
        steps.push('<div class="xetex-indent">x = ' + principalDeg + '° or x = ' + secondDeg + '°</div>');
        general = 'x = ' + principalDeg + '° + 360°n  or  x = ' + secondDeg + '° + 360°n';
    } else if (fnName === 'cos') {
        var secondDeg = clean(-principalDeg);
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Cosine is symmetric — include the negative angle</div></div>');
        steps.push('<div class="xetex-indent">x = ±' + principalDeg + '°</div>');
        general = 'x = ±' + principalDeg + '° + 360°n';
    } else {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Tangent repeats every 180°</div></div>');
        steps.push('<div class="xetex-indent">x = ' + principalDeg + '°</div>');
        general = 'x = ' + principalDeg + '° + 180°n';
    }

    steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">' + general + '</span></div>');
    steps.push('<div class="xetex-note">n is any integer (...,-1, 0, 1, 2,...)</div>');
    steps.push('</div>');
    return steps.join('');
}

function solveQuadratic(a, b, c) {
    var steps = [];
    var aDisp = (a === 1) ? '' : (a === -1 ? '-' : a + '');
    steps.push('<div class="xetex-output">');
    steps.push('<div class="xetex-equation">' + aDisp + 'x² ' + (b >= 0 ? '+ ' + b : '- ' + Math.abs(b)) + 'x ' + (c >= 0 ? '+ ' + c : '- ' + Math.abs(c)) + ' = 0</div>');
    var origA = a;
    if (a !== 1) {
        b = b / a; c = c / a;
        steps.push('<div class="xetex-step"><div class="xetex-step-num">1</div><div class="xetex-step-body">Divide by ' + origA + '</div></div>');
        steps.push('<div class="xetex-indent">x² ' + (b >= 0 ? '+ ' + b : '- ' + Math.abs(b)) + 'x ' + (c >= 0 ? '+ ' + c : '- ' + Math.abs(c)) + ' = 0</div>');
    }
    var halfB = b / 2, halfBSq = halfB * halfB, constantTerm = c - halfBSq;
    var n = (a !== 1) ? 2 : 1;
    steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Add and subtract (b/2)²</div></div>');
    steps.push('<div class="xetex-indent">(b/2)² = (' + b + '/2)² = ' + halfB + '² = ' + halfBSq + '</div>');
    steps.push('<div class="xetex-indent">x² ' + (b >= 0 ? '+ ' + b : '- ' + Math.abs(b)) + 'x ' + (halfBSq >= 0 ? '+ ' + halfBSq : '- ' + Math.abs(halfBSq)) + ' ' + (constantTerm >= 0 ? '+ ' + constantTerm : '- ' + Math.abs(constantTerm)) + ' = 0</div>');
    n++;
    steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Rewrite as perfect square</div></div>');
    steps.push('<div class="xetex-indent">(x ' + (halfB >= 0 ? '+ ' + halfB : '- ' + Math.abs(halfB)) + ')² ' + (constantTerm >= 0 ? '+ ' + constantTerm : '- ' + Math.abs(constantTerm)) + ' = 0</div>');
    var rightSide = halfBSq - c;
    n++;
    steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Move constant to right side</div></div>');
    steps.push('<div class="xetex-indent">(x ' + (halfB >= 0 ? '+ ' + halfB : '- ' + Math.abs(halfB)) + ')² = ' + rightSide + '</div>');
    if (rightSide < 0) {
        steps.push('<div class="xetex-note">Right side is negative, no real roots.</div>');
        steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span>No real roots</div>');
        steps.push('</div>');
        return steps.join('');
    }
    var sqrtVal = Math.sqrt(rightSide), sqrtIsInteger = Number.isInteger(sqrtVal);
    var sqrtDisplay = sqrtIsInteger ? sqrtVal : '√' + rightSide;
    n++;
    steps.push('<div class="xetex-step"><div class="xetex-step-num">' + n + '</div><div class="xetex-step-body">Take square root</div></div>');
    steps.push('<div class="xetex-indent">x ' + (halfB >= 0 ? '+ ' + halfB : '- ' + Math.abs(halfB)) + ' = ±' + sqrtDisplay + '</div>');
    var signStr = halfB >= 0 ? '+' : '-', absHalfB = Math.abs(halfB);
    var root1 = -halfB + sqrtVal, root2 = -halfB - sqrtVal;
    function clean(num) { if (Number.isInteger(num)) return num; return parseFloat(num.toPrecision(10)); }
    if (rightSide === 0) {
        steps.push('<div class="xetex-indent">x ' + signStr + ' ' + absHalfB + ' = 0</div>');
        steps.push('<div class="xetex-indent">x = ' + clean(root1) + '</div>');
        steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">x = ' + clean(root1) + '</span></div>');
        steps.push('</div>');
        return steps.join('');
    }

    var left1 = 'x ' + signStr + ' ' + absHalfB + ' = ' + sqrtDisplay;
    var right1 = 'x ' + signStr + ' ' + absHalfB + ' = -' + sqrtDisplay;
    var left2, right2, left3, right3;
    var rootsAreIntegers = Number.isInteger(root1) && Number.isInteger(root2);

    if (sqrtIsInteger) {
        left2 = 'x = ' + (-halfB) + ' + ' + sqrtVal;
        right2 = 'x = ' + (-halfB) + ' - ' + sqrtVal;
    } else {
        left2 = 'x = ' + (-halfB) + ' + ' + sqrtDisplay;
        right2 = 'x = ' + (-halfB) + ' - ' + sqrtDisplay;
    }
    if (rootsAreIntegers) {
        left3 = 'x = ' + clean(root1);
        right3 = 'x = ' + clean(root2);
    } else {
        left3 = 'x ≈ ' + clean(root1);
        right3 = 'x ≈ ' + clean(root2);
    }

    steps.push(
        '<div class="xetex-table-wrap xetex-branch-table">' +
            '<table class="xetex-table">' +
                '<thead><tr>' +
                    '<th>+ branch</th>' +
                    '<th>\u2212 branch</th>' +
                '</tr></thead>' +
                '<tbody>' +
                    '<tr><td>' + left1 + '</td><td>' + right1 + '</td></tr>' +
                    '<tr><td>' + left2 + '</td><td>' + right2 + '</td></tr>' +
                    '<tr class="xetex-branch-result"><td>' + left3 + '</td><td>' + right3 + '</td></tr>' +
                '</tbody>' +
            '</table>' +
        '</div>'
    );
    steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">x = ' + clean(root1) + '</span><span class="xetex-answer-val">x = ' + clean(root2) + '</span></div>');
    steps.push('</div>');
    return steps.join('');
}

function solveCubic(a, b, c, d) {
    var steps = [];
    steps.push('<div class="xetex-output">');
    steps.push('<div class="xetex-equation">Solve: ' + a + 'x³ ' + (b >= 0 ? '+ ' + b : '- ' + Math.abs(b)) + 'x² ' + (c >= 0 ? '+ ' + c : '- ' + Math.abs(c)) + 'x ' + (d >= 0 ? '+ ' + d : '- ' + Math.abs(d)) + ' = 0</div>');
    function clean(n) { if (Number.isInteger(n)) return n; return parseFloat(n.toPrecision(10)); }
    var factorsD = getFactors(Math.abs(d)), factorsA = getFactors(Math.abs(a));
    var possible = [];
    for (var i = 0; i < factorsD.length; i++) {
        for (var j = 0; j < factorsA.length; j++) {
            var r = factorsD[i] / factorsA[j];
            if (possible.indexOf(r) === -1) possible.push(r);
            if (possible.indexOf(-r) === -1) possible.push(-r);
        }
    }
    possible.sort(function(x, y) { return Math.abs(x) - Math.abs(y) || x - y; });
    steps.push('<div class="xetex-step"><div class="xetex-step-num">1</div><div class="xetex-step-body">Guess a root by trying simple numbers</div></div>');
    steps.push('<div class="xetex-indent">Try: ' + possible.join(', ') + '</div>');
    var found = null;
    for (var i = 0; i < possible.length; i++) {
        var r = possible[i], val = a * r * r * r + b * r * r + c * r + d;
        if (Math.abs(val) < 0.0001) { found = r; break; }
    }
    if (found === null) {
        steps.push('<div class="xetex-note">Sorry, this one cannot be solved with simple numbers.</div>');
        steps.push('</div>'); return steps.join('');
    }
    steps.push('<div class="xetex-step"><div class="xetex-step-num">2</div><div class="xetex-step-body">We found! x = ' + clean(found) + ' is a root</div></div>');
    steps.push('<div class="xetex-indent">Put x = ' + clean(found) + ' into the equation:</div>');
    steps.push('<div class="xetex-indent">' + a + '(' + clean(found) + ')³ + ' + b + '(' + clean(found) + ')² + ' + c + '(' + clean(found) + ') + ' + d + ' = 0 ✓</div>');
    steps.push('<div class="xetex-indent">So (x ' + (found >= 0 ? '- ' + found : '+ ' + Math.abs(found)) + ') is a factor</div>');
    var newB = b + a * found, newC = c + newB * found;
    steps.push('<div class="xetex-step"><div class="xetex-step-num">3</div><div class="xetex-step-body">Divide the cubic by (x ' + (found >= 0 ? '- ' + found : '+ ' + Math.abs(found)) + ')</div></div>');
    steps.push('<div class="xetex-indent">' + a + 'x³ ' + (b >= 0 ? '+ ' + b : '- ' + Math.abs(b)) + 'x² ' + (c >= 0 ? '+ ' + c : '- ' + Math.abs(c)) + 'x ' + (d >= 0 ? '+ ' + d : '- ' + Math.abs(d)) + ' ÷ (x ' + (found >= 0 ? '- ' + found : '+ ' + Math.abs(found)) + ')</div>');
    steps.push('<div class="xetex-indent">' + a + 'x³ ÷ x = ' + a + 'x²</div>');
    steps.push('<div class="xetex-indent">' + a + 'x² · (x ' + (found >= 0 ? '- ' + found : '+ ' + Math.abs(found)) + ') = ' + a + 'x³ ' + (found*a >= 0 ? '+ ' + found*a : '- ' + Math.abs(found*a)) + 'x²</div>');
    steps.push('<div class="xetex-indent">Subtract: ' + newB + 'x² remains</div>');
    steps.push('<div class="xetex-indent">Bring down ' + c + 'x: ' + newB + 'x² ' + (c >= 0 ? '+ ' + c : '- ' + Math.abs(c)) + 'x</div>');
    steps.push('<div class="xetex-indent">' + newB + 'x² ÷ x = ' + newB + 'x</div>');
    steps.push('<div class="xetex-indent">' + newB + 'x · (x ' + (found >= 0 ? '- ' + found : '+ ' + Math.abs(found)) + ') = ' + newB + 'x² ' + (found*newB >= 0 ? '+ ' + found*newB : '- ' + Math.abs(found*newB)) + 'x</div>');
    steps.push('<div class="xetex-indent">Subtract: ' + newC + 'x remains</div>');
    steps.push('<div class="xetex-indent">Bring down ' + d + ': ' + newC + 'x ' + (d >= 0 ? '+ ' + d : '- ' + Math.abs(d)) + '</div>');
    steps.push('<div class="xetex-indent">' + newC + 'x ÷ x = ' + newC + '</div>');
    steps.push('<div class="xetex-indent">' + newC + ' · (x ' + (found >= 0 ? '- ' + found : '+ ' + Math.abs(found)) + ') = ' + newC + 'x ' + (found*newC >= 0 ? '+ ' + found*newC : '- ' + Math.abs(found*newC)) + '</div>');
    steps.push('<div class="xetex-indent">Subtract: remainder = 0 ✓</div>');
    steps.push('<div class="xetex-indent">Quotient: ' + a + 'x² ' + (newB >= 0 ? '+ ' + newB : '- ' + Math.abs(newB)) + 'x ' + (newC >= 0 ? '+ ' + newC : '- ' + Math.abs(newC)) + '</div>');
    steps.push('<div class="xetex-step"><div class="xetex-step-num">4</div><div class="xetex-step-body">Factor the quadratic</div></div>');
    var disc = newB * newB - 4 * a * newC;
    if (disc < 0) {
        steps.push('<div class="xetex-indent">Cannot be factored with real numbers.</div>');
        steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">x = ' + clean(found) + '</span></div>');
    } else if (Math.abs(disc) < 0.0001) {
        var root2 = -newB / (2 * a);
        steps.push('<div class="xetex-indent">It is a perfect square!</div>');
        steps.push('<div class="xetex-indent">(x ' + (root2 >= 0 ? '- ' + root2 : '+ ' + Math.abs(root2)) + ')² = 0</div>');
        steps.push('<div class="xetex-indent">x = ' + clean(root2) + ' (twice)</div>');
        steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">x = ' + clean(found) + '</span><span class="xetex-answer-val">x = ' + clean(root2) + '</span></div>');
    } else {
        var factored = factorQuadraticNice(a, newB, newC);
        if (factored) {
            steps.push('<div class="xetex-indent">' + factored.f1 + factored.f2 + ' = 0</div>');
            steps.push('<div class="xetex-indent">' + factored.f1 + ' = 0 → x = ' + clean(factored.r1) + '</div>');
            steps.push('<div class="xetex-indent">' + factored.f2 + ' = 0 → x = ' + clean(factored.r2) + '</div>');
            steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">x = ' + clean(found) + '</span><span class="xetex-answer-val">x = ' + clean(factored.r1) + '</span><span class="xetex-answer-val">x = ' + clean(factored.r2) + '</span></div>');
        } else {
            steps.push('<div class="xetex-indent">Use the quadratic formula:</div>');
            var sqrtDisc = Math.sqrt(disc), r1 = (-newB + sqrtDisc) / (2 * a), r2 = (-newB - sqrtDisc) / (2 * a);
            steps.push('<div class="xetex-indent">x = ' + clean(r1) + '</div>');
            steps.push('<div class="xetex-indent">x = ' + clean(r2) + '</div>');
            steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">x = ' + clean(found) + '</span><span class="xetex-answer-val">x = ' + clean(r1) + '</span><span class="xetex-answer-val">x = ' + clean(r2) + '</span></div>');
        }
    }
    steps.push('</div>'); return steps.join('');
}

function factorQuadraticNice(a, b, c) {
    for (var p = 1; p <= Math.abs(a); p++) {
        if (a % p !== 0) continue;
        var r = a / p;
        for (var q = 1; q <= Math.abs(c); q++) {
            if (c % q !== 0) continue;
            var s = c / q;
            if (p * s + r * q === b) {
                var px = p === 1 ? 'x' : p + 'x', rx = r === 1 ? 'x' : r + 'x';
                return { f1: '(' + px + ' ' + (q >= 0 ? '+ ' + q : '- ' + Math.abs(q)) + ')', f2: '(' + rx + ' ' + (s >= 0 ? '+ ' + s : '- ' + Math.abs(s)) + ')', r1: -q / p, r2: -s / r };
            }
            if (p * (-s) + r * (-q) === b) {
                var px = p === 1 ? 'x' : p + 'x', rx = r === 1 ? 'x' : r + 'x';
                return { f1: '(' + px + ' ' + (-q >= 0 ? '+ ' + (-q) : '- ' + Math.abs(-q)) + ')', f2: '(' + rx + ' ' + (-s >= 0 ? '+ ' + (-s) : '- ' + Math.abs(-s)) + ')', r1: q / p, r2: s / r };
            }
        }
    }
    return null;
}

function getFactors(n) {
    var factors = [];
    for (var i = 1; i <= n; i++) { if (n % i === 0) factors.push(i); }
    return factors;
}

window.mathAlgebraHandle = mathAlgebraHandle;
window.isAlgebra = isAlgebra;