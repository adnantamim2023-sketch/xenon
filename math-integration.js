function toSuperscript(n) {
    var digits = String(n);
    var map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
    var result = '';
    for (var i = 0; i < digits.length; i++) {
        result += map[digits[i]] || digits[i];
    }
    return result;
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSymbolCoeff(c) {
    return typeof c === 'string';
}

function mulSymbolByFrac(sym, frac) {
    var neg = sym.startsWith('-');
    var rest = neg ? sym.slice(1) : sym;
    var prefixMatch = rest.match(/^(\d+)([a-zA-Z])$/);
    var numPrefix = prefixMatch ? parseInt(prefixMatch[1]) : 1;
    var base = prefixMatch ? prefixMatch[2] : rest;

    var num = frac.num * numPrefix, den = frac.den;
    if (den < 0) { num = -num; den = -den; }
    if (neg) num = -num;
    var g = gcdPoly(Math.abs(num), den);
    if (g) { num /= g; den /= g; }
    if (den === 1) {
        if (num === 1) return base;
        if (num === -1) return '-' + base;
        return num + base;
    }
    if (num === 1) return '(' + base + '/' + den + ')';
    if (num === -1) return '-(' + base + '/' + den + ')';
    return '(' + num + base + '/' + den + ')';
}

function divSymbolByFrac(sym, frac) {
    return mulSymbolByFrac(sym, { num: frac.den, den: frac.num });
}

function symbolCoeffToDisplay(sym) {
    return sym;
}

function intToFraction(coeff) {
    if (coeff === null || coeff === undefined) return null;
    if (typeof coeff === 'string') return null;
    if (typeof coeff === 'object' && typeof coeff.num === 'number' && typeof coeff.den === 'number') {
        return { num: coeff.num, den: coeff.den };
    }
    if (typeof coeff === 'number') {
        if (Number.isInteger(coeff)) return { num: coeff, den: 1 };
        var s = String(coeff);
        var dotIdx = s.indexOf('.');
        if (dotIdx !== -1) {
            var den = Math.pow(10, s.length - dotIdx - 1);
            var num = Math.round(coeff * den);
            var g = gcdPoly(Math.abs(num), den) || 1;
            return { num: num / g, den: den / g };
        }
        return { num: coeff, den: 1 };
    }
    return null;
}

function intTermShapeKey(p) {
    if (!p || typeof p !== 'object') return null;
    var t = p.type;
    if (t === 'constant') return 'constant';
    if (t === 'power') {
        var pw = p.power;
        return 'power:' + (typeof pw === 'object' ? pw.num + '/' + pw.den : String(pw));
    }
    if (t === 'trig') return 'trig:' + p.fn + ':' + p.power;
    if (t === 'trigProd') return 'trigProd:' + p.fn;
    if (t === 'secCscHalfSq') return 'secCscHalfSq:' + p.fn;
    if (t === 'trigLinear') {
        var ak = typeof p.a === 'object' ? p.a.num + '/' + p.a.den : String(p.a);
        return 'trigLin:' + p.fn + ':' + ak + ':' + p.b + ':' + (p.degrees ? 1 : 0);
    }
    if (t === 'exp') {
        var ae = typeof p.a === 'object' ? p.a.num + '/' + p.a.den : String(p.a);
        return 'exp:' + ae + ':' + p.b;
    }
    if (t === 'ln') {
        var al = typeof p.a === 'object' ? p.a.num + '/' + p.a.den : String(p.a);
        return 'ln:' + al + ':' + p.b;
    }
    if (t === 'linearPower') {
        var lpk = typeof p.a === 'object' ? p.a.num + '/' + p.a.den : String(p.a);
        var lpp = typeof p.power === 'object' ? p.power.num + '/' + p.power.den : String(p.power);
        return 'linPower:' + lpk + ':' + p.b + ':' + lpp;
    }
    return null;
}

function intReplaceLeadingCoeff(rawTerm, newCoeff) {
    var t = rawTerm.trim();
    if (t.startsWith('+') || t.startsWith('-')) t = t.substring(1).trim();

    var structure;
    var m = t.match(/^\((\d+\.?\d*)\/(\d+\.?\d*)\)(.*)$/);
    if (m) {
        structure = m[3];
    } else {
        m = t.match(/^(\d+\.?\d*)(.*)$/);
        if (m) structure = m[2];
        else structure = t;
    }

    var num = newCoeff.num, den = newCoeff.den;

    if (structure === '') {
        if (den === 1) return String(num);
        return num + '/' + den;
    }

    var coeffStr;
    if (den === 1) {
        if (num === 1) coeffStr = '';
        else if (num === -1) coeffStr = '-';
        else coeffStr = String(num);
    } else {
        if (num === 1) coeffStr = '(1/' + den + ')';
        else if (num === -1) coeffStr = '-(1/' + den + ')';
        else coeffStr = '(' + num + '/' + den + ')';
    }
    return coeffStr + structure;
}

function intFormatCombinedTerms(terms) {
    if (!terms.length) return '0';
    var s = '';
    for (var i = 0; i < terms.length; i++) {
        var t = terms[i].trim();
        if (i === 0) {
            s += t;
        } else if (t.startsWith('-')) {
            s += ' - ' + t.substring(1).trim();
        } else {
            s += ' + ' + t.replace(/^\+/, '').trim();
        }
    }
    return s;
}

function intCombineLikeTerms(terms, v, parseTermFn) {
    var parsed = terms.map(function(t) { return parseTermFn(t); });

    var groups = {};
    var keyCounts = {};
    for (var i = 0; i < terms.length; i++) {
        var p = parsed[i];
        if (!p) continue;
        var key = intTermShapeKey(p);
        if (!key) continue;
        var cf = intToFraction(p.coeff);
        if (!cf) continue;
        keyCounts[key] = (keyCounts[key] || 0) + 1;
        if (!(key in groups)) groups[key] = { num: 0, den: 1, firstIdx: i };
        var g = groups[key];
        g.num = g.num * cf.den + cf.num * g.den;
        g.den = g.den * cf.den;
        var gg = gcdPoly(Math.abs(g.num), g.den);
        if (gg && gg > 1) { g.num /= gg; g.den /= gg; }
    }

    var out = [];
    var emitted = {};
    for (var i = 0; i < terms.length; i++) {
        var p = parsed[i];
        var key = p ? intTermShapeKey(p) : null;
        var cf = p ? intToFraction(p.coeff) : null;

        if (!key || !cf) { out.push(terms[i]); continue; }
        if (emitted[key]) continue;
        emitted[key] = true;

        var g = groups[key];
        if (g.num === 0) continue;
        if (keyCounts[key] === 1) { out.push(terms[i]); continue; }

        var newRaw = intReplaceLeadingCoeff(terms[g.firstIdx], { num: g.num, den: g.den });
        out.push(newRaw || terms[i]);
    }

    return out;
}

function solveIntegration(expr, variable) {
    var v = (variable && /^[a-zA-Zα-ωΑ-Ω]$/.test(variable)) ? variable : 'x';
    var vEsc = escapeRegExp(v);

    var steps = [];
    steps.push('<div class="xetex-output">');
    steps.push('<div class="xetex-equation">∫ ' + expr + ' d' + v + '</div>');

    expr = expr.trim();
    if (expr.startsWith('(') && expr.endsWith(')')) {
        var inner = expr.slice(1, -1), depth = 0, valid = true;
        for (var i = 0; i < inner.length; i++) {
            if (inner[i] === '(') depth++;
            if (inner[i] === ')') depth--;
            if (depth < 0) { valid = false; break; }
        }
        if (valid && depth === 0) expr = inner;
    }

    (function normalizeDecimalPowers() {
        function decimalToFrac(decStr) {
            var neg = decStr.startsWith('-');
            if (neg) decStr = decStr.slice(1);
            var parts = decStr.split('.');
            var den = Math.pow(10, parts[1] ? parts[1].length : 0);
            var num = parseInt(parts.join(''), 10);
            var g = gcdLocal(num, den);
            num /= g; den /= g;
            return (neg ? -num : num) + '/' + den;
        }
        function gcdLocal(a, b) { return b === 0 ? a : gcdLocal(b, a % b); }

        var reParen = new RegExp(vEsc + '\\^\\((-?\\d+\\.\\d+)\\)', 'g');
        expr = expr.replace(reParen, function(m, dec) { return v + '^(' + decimalToFrac(dec) + ')'; });

        var reBare = new RegExp(vEsc + '\\^(-?\\d+\\.\\d+)(?![\\d])', 'g');
        expr = expr.replace(reBare, function(m, dec) { return v + '^(' + decimalToFrac(dec) + ')'; });
    })();

    var conjugateStep = null;
    (function normalizeConjugateRadical() {
        function parseRadicand(inner) {
            inner = inner.trim();
            var m = inner.match(new RegExp('^(-?\\d*)' + vEsc + '\\s*([+\\-]\\s*(?:\\d+|[a-zA-Zα-ωΑ-Ω]))?$'));
            if (!m) return null;
            var p = m[1] === '' ? 1 : (m[1] === '-' ? -1 : parseInt(m[1]));
            var kRaw = m[2] ? m[2].replace(/\s/g, '') : '+0';
            var kSign = kRaw[0] === '-' ? -1 : 1;
            var kBody = kRaw.slice(1);
            var isNumeric = /^\d+$/.test(kBody);
            var k = isNumeric ? kSign * parseInt(kBody) : (kSign === -1 ? '-' + kBody : kBody);
            return { p: p, k: k, kIsNumeric: isNumeric };
        }

        var radToken = '√(?:\\(([^()]+)\\)|(' + vEsc + '))';
        var re = new RegExp('1\\s*/\\s*\\(\\s*' + radToken + '\\s*([+\\-])\\s*' + radToken + '\\s*\\)', 'g');
        expr = expr.replace(re, function(m, r1p, r1b, op, r2p, r2b) {
            var r1 = r1p !== undefined ? r1p : r1b;
            var r2 = r2p !== undefined ? r2p : r2b;
            var rad1 = parseRadicand(r1), rad2 = parseRadicand(r2);
            if (!rad1 || !rad2) return m;
            if (rad1.p !== rad2.p) return m;
            if (!rad1.kIsNumeric || !rad2.kIsNumeric) return m;

            var diff = rad1.k - rad2.k;
            if (diff === 0) return m;

            var term1 = '√(' + r1.trim() + ')';
            var term2 = '√(' + r2.trim() + ')';
            var numerator = op === '-' ? (term1 + '+' + term2) : (term1 + '-' + term2);

            conjugateStep = {
                original: '1/(' + term1 + (op === '-' ? '-' : '+') + term2 + ')',
                rationalized: '(' + numerator + ')/(' + diff + ')',
                diff: diff
            };

            var coeffDisplay = diff === 1 ? '' : (diff === -1 ? '-' : '(1/' + diff + ')');
            return coeffDisplay + '(' + numerator + ')';
        });
    })();

    expr = expr.replace(new RegExp('√' + vEsc, 'g'), v + '^(1/2)');
    expr = expr.replace(new RegExp('√\\(' + vEsc + '\\)', 'g'), v + '^(1/2)');
    expr = expr.replace(new RegExp('∛' + vEsc, 'g'), v + '^(1/3)');
    expr = expr.replace(new RegExp('∛\\(' + vEsc + '\\)', 'g'), v + '^(1/3)');
    expr = expr.replace(/(\d+)\/(\d+)([a-zA-Z])/g, '($1/$2)$3');

    expr = expr.replace(/cosec/g, 'csc');

    expr = expr.replace(new RegExp('(\\d*)sin\\(?' + vEsc + '\\)?/cos(\\^2|²)\\(?' + vEsc + '\\)?', 'g'),
        function(m, c) { return (c || '') + 'sec' + v + 'tan' + v; });
    expr = expr.replace(new RegExp('(\\d*)cos\\(?' + vEsc + '\\)?/sin(\\^2|²)\\(?' + vEsc + '\\)?', 'g'),
        function(m, c) { return '-' + (c || '') + 'csc' + v + 'cot' + v; });

    var identitySteps = [];
    (function normalizeDoubleAngle() {
        var cos2v = 'cos(?:\\^2|²)?\\(?' + '2\\(?' + vEsc + '\\)?' + '\\)?|cos2' + vEsc;
        var sin2v = 'sin(?:\\^2|²)?\\(?' + '2\\(?' + vEsc + '\\)?' + '\\)?|sin2' + vEsc;

        function apply(re, replacement, label) {
            if (re.test(expr)) {
                re.lastIndex = 0;
                expr = expr.replace(re, replacement);
                identitySteps.push(label);
            }
        }

        apply(new RegExp('√\\(\\s*1\\s*-\\s*(?:' + cos2v + ')\\s*\\)', 'g'), '√2sin' + v,
            '1 - cos2' + v + ' = 2sin²' + v + ',  so √(1-cos2' + v + ') = √2·sin' + v);
        apply(new RegExp('1\\s*/\\s*\\(\\s*1\\s*\\+\\s*(?:' + cos2v + ')\\s*\\)', 'g'), '(1/2)sec^2' + v,
            '1 + cos2' + v + ' = 2cos²' + v + ',  so 1/(1+cos2' + v + ') = (1/2)sec²' + v);
        apply(new RegExp('1\\s*/\\s*\\(\\s*1\\s*-\\s*(?:' + cos2v + ')\\s*\\)', 'g'), '(1/2)csc^2' + v,
            '1 - cos2' + v + ' = 2sin²' + v + ',  so 1/(1-cos2' + v + ') = (1/2)csc²' + v);
        apply(new RegExp('cos(?:\\^2|²)\\(?\\s*' + vEsc + '\\s*/\\s*2\\s*\\)?', 'g'), '((1/2)+(1/2)cos' + v + ')',
            'cos²(' + v + '/2) = (1 + cos' + v + ')/2   (half-angle identity)');
        apply(new RegExp('sin(?:\\^2|²)\\(?\\s*' + vEsc + '\\s*/\\s*2\\s*\\)?', 'g'), '((1/2)-(1/2)cos' + v + ')',
            'sin²(' + v + '/2) = (1 - cos' + v + ')/2   (half-angle identity)');
        apply(new RegExp('\\(?\\s*1\\s*-\\s*(?:' + cos2v + ')\\s*\\)?\\s*/\\s*\\(\\s*1\\s*\\+\\s*(?:' + cos2v + ')\\s*\\)', 'g'), '(sec^2' + v + '-1)',
            '(1-cos2' + v + ')/(1+cos2' + v + ') = (2sin²' + v + ')/(2cos²' + v + ') = tan²' + v + ' = sec²' + v + ' - 1');
        apply(new RegExp('cot(?:\\^2|²)\\(?' + vEsc + '\\)?(?![\\w/^])', 'g'), '(csc^2' + v + '-1)',
            'cot²' + v + ' = csc²' + v + ' - 1   (Pythagorean identity)');
        apply(new RegExp('tan(?:\\^2|²)\\(?' + vEsc + '\\)?(?![\\w/^])', 'g'), '(sec^2' + v + '-1)',
            'tan²' + v + ' = sec²' + v + ' - 1   (Pythagorean identity)');
        apply(new RegExp('tan(?:\\^2|²)\\(?\\s*' + vEsc + '\\s*/\\s*2\\s*\\)?', 'g'), '(sec^2(' + v + '/2)-1)',
            'tan²(' + v + '/2) = sec²(' + v + '/2) - 1   (Pythagorean identity)');
        apply(new RegExp('cot(?:\\^2|²)\\(?\\s*' + vEsc + '\\s*/\\s*2\\s*\\)?', 'g'), '(csc^2(' + v + '/2)-1)',
            'cot²(' + v + '/2) = csc²(' + v + '/2) - 1   (Pythagorean identity)');
        apply(new RegExp('sec(?:\\^2|²)\\(?' + vEsc + '\\)?csc(?:\\^2|²)\\(?' + vEsc + '\\)?', 'g'), '(sec^2' + v + '+csc^2' + v + ')',
            'sec²' + v + '·csc²' + v + ' = 1/(sin²' + v + 'cos²' + v + ') = sec²' + v + ' + csc²' + v);
        apply(new RegExp('√\\(\\s*1\\s*-\\s*(?:' + sin2v + ')\\s*\\)', 'g'), '(cos' + v + '-sin' + v + ')',
            '1 - sin2' + v + ' = (sin' + v + ' - cos' + v + ')²,  so √(1-sin2' + v + ') = cos' + v + ' - sin' + v);
        apply(new RegExp('\\(?\\s*sin\\(?' + vEsc + '\\)?\\s*\\+\\s*cos\\(?' + vEsc + '\\)?\\s*\\)?\\s*/\\s*√\\(\\s*1\\s*\\+\\s*(?:' + sin2v + ')\\s*\\)', 'g'), '1',
            '1 + sin2' + v + ' = (sin' + v + ' + cos' + v + ')²,  so (sin' + v + '+cos' + v + ')/√(1+sin2' + v + ') = 1');

        (function applyProductToSum() {
            var re = new RegExp(
                '(\\d*)(sin|cos)\\(?\\s*(\\d*)' + vEsc + '\\s*\\)?\\s*(sin|cos)\\(?\\s*(\\d*)' + vEsc + '\\s*\\)?', 'g'
            );
            function argDisplay(k) { return k === 0 ? '0' : (k === 1 ? v : k + v); }
            expr = expr.replace(re, function(m, coeffRaw, fn1, p1, fn2, p2) {
                var p = p1 === '' ? 1 : parseInt(p1), q = p2 === '' ? 1 : parseInt(p2);
                if (p === q) return m;
                var coeff = coeffRaw === '' ? 1 : parseInt(coeffRaw);
                var sum = p + q, diff = p - q;
                var diffAbs = Math.abs(diff);
                var diffSign = diff < 0 ? -1 : 1;
                var sumArg = argDisplay(sum), diffAbsArg = argDisplay(diffAbs), diffArg = argDisplay(diff);
                var replacement;
                var label;
                if (fn1 === 'sin' && fn2 === 'sin') {
                    replacement = '((1/2)cos(' + diffAbsArg + ')-(1/2)cos(' + sumArg + '))';
                    label = 'sin(' + argDisplay(p) + ')sin(' + argDisplay(q) + ') = (1/2)[cos(' + diffAbsArg + ') - cos(' + sumArg + ')]';
                } else if (fn1 === 'cos' && fn2 === 'cos') {
                    replacement = '((1/2)cos(' + diffAbsArg + ')+(1/2)cos(' + sumArg + '))';
                    label = 'cos(' + argDisplay(p) + ')cos(' + argDisplay(q) + ') = (1/2)[cos(' + diffAbsArg + ') + cos(' + sumArg + ')]';
                } else if (fn1 === 'sin' && fn2 === 'cos') {
                    var diffTermSin = diffSign === -1
                        ? '-(1/2)sin(' + diffAbsArg + ')'
                        : '+(1/2)sin(' + diffAbsArg + ')';
                    replacement = '((1/2)sin(' + sumArg + ')' + diffTermSin + ')';
                    label = 'sin(' + argDisplay(p) + ')cos(' + argDisplay(q) + ') = (1/2)[sin(' + sumArg + ') + sin(' + diffArg + ')]';
                } else {
                    var diffTermSin2 = diffSign === -1
                        ? '+(1/2)sin(' + diffAbsArg + ')'
                        : '-(1/2)sin(' + diffAbsArg + ')';
                    replacement = '((1/2)sin(' + sumArg + ')' + diffTermSin2 + ')';
                    label = 'cos(' + argDisplay(p) + ')sin(' + argDisplay(q) + ') = (1/2)[sin(' + sumArg + ') - sin(' + diffArg + ')]';
                }
                if (coeff !== 1) {
                    replacement = replacement.replace(/\(1\/2\)/g, '(' + coeff + '/2)');
                    label = coeff + '·' + label;
                }
                identitySteps.push(label);
                return replacement;
            });
        })();
    })();

    if (identitySteps.length > 0) {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">1</div><div class="xetex-step-body">Apply a trig identity</div></div>');
        for (var isi = 0; isi < identitySteps.length; isi++) {
            steps.push('<div class="xetex-indent">' + identitySteps[isi] + '</div>');
        }
        var earlyDisplay = expr
            .replace(/\^2/g, '²')
            .replace(/\(1\/2\)/g, '<span class="xetex-exp"><span class="xetex-exp-num">1</span><span class="xetex-exp-den">2</span></span>');
        steps.push('<div class="xetex-indent">= ∫ ' + earlyDisplay + ' d' + v + '</div>');
    }

    (function normalizeTrigDistribute() {
        var re = new RegExp('sec\\(?' + vEsc + '\\)?\\(\\s*sec\\(?' + vEsc + '\\)?\\s*([+\\-])\\s*tan\\(?' + vEsc + '\\)?\\s*\\)', 'g');
        expr = expr.replace(re, function(m, op) {
            return 'sec^2' + v + (op === '+' ? '+' : '-') + 'sec' + v + 'tan' + v;
        });
        var re2 = new RegExp('csc\\(?' + vEsc + '\\)?\\(\\s*csc\\(?' + vEsc + '\\)?\\s*([+\\-])\\s*cot\\(?' + vEsc + '\\)?\\s*\\)', 'g');
        expr = expr.replace(re2, function(m, op) {
            return 'csc^2' + v + (op === '+' ? '+' : '-') + 'csc' + v + 'cot' + v;
        });
    })();

    expr = expr.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4').replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7').replace(/⁸/g, '^8').replace(/⁹/g, '^9').replace(/⅓/g, '^(1/3)').replace(/½/g, '^(1/2)').replace(/⅔/g, '^(2/3)');

    (function normalizeVariableDenominators() {
        function invertPower(powerStr) {
            var fracP = powerStr.match(/^\(?(-?\d+)\/(\d+)\)?$/);
            if (fracP) return '(' + (-parseInt(fracP[1])) + '/' + fracP[2] + ')';
            var intP = powerStr.match(/^\(?(-?\d+)\)?$/);
            if (intP) return '(' + (-parseInt(intP[1])) + ')';
            return null;
        }

        var numTok = '(\\d+[a-zA-Z]|[a-zA-Z]|\\d+)';
        var powerGroup = '(\\^(?:\\((-?\\d+(?:/\\d+)?)\\)|(-?\\d+)))?';
        var reParen = new RegExp('(^|[+\\-(])\\s*' + numTok + '\\s*/\\s*\\(\\s*(\\d*)' + vEsc + powerGroup + '\\s*\\)', 'g');
        expr = expr.replace(reParen, function(m, lead, numC, denC, fullPow, parenPow, barePow) {
            var isSym = /[a-zA-Z]/.test(numC) && numC.replace(/\d+/, '') !== v ? true : false;
            var symLetter = numC.match(/[a-zA-Z]/);
            if (symLetter && symLetter[0] === v) return m;
            var coeffDen = denC === '' ? 1 : parseInt(denC);
            var power = parenPow || barePow || '1';
            var negPower = invertPower(power);
            if (negPower === null) return m;
            var coeffStr;
            if (isSym) {
                coeffStr = coeffDen === 1 ? numC : '(' + numC + '/' + coeffDen + ')';
            } else {
                var coeffNum = parseInt(numC);
                coeffStr = (coeffNum === 1 && coeffDen === 1) ? '' :
                    (coeffDen === 1 ? coeffNum : '(' + coeffNum + '/' + coeffDen + ')');
            }
            return lead + coeffStr + v + '^' + negPower;
        });

        var reBare = new RegExp('(^|[+\\-(])\\s*' + numTok + '\\s*/\\s*' + vEsc + powerGroup + '(?![a-zA-Z0-9(])', 'g');
        expr = expr.replace(reBare, function(m, lead, numC, fullPow, parenPow, barePow) {
            var isSym = /[a-zA-Z]/.test(numC);
            var symLetter = numC.match(/[a-zA-Z]/);
            if (symLetter && symLetter[0] === v) return m;
            var power = parenPow || barePow || '1';
            var negPower = invertPower(power);
            if (negPower === null) return m;
            var coeffStr = isSym ? numC : (numC === '1' ? '' : numC);
            return lead + coeffStr + v + '^' + negPower;
        });
    })();

    function fracHTML(num, den) {
        return '<span class="xetex-frac"><span class="xetex-frac-num">' + num + '</span><span class="xetex-frac-den">' + den + '</span></span>';
    }

    function expHTML(numFrac) {
        if (numFrac.den === 1) return toSuperscript(numFrac.num);
        return '<span class="xetex-exp"><span class="xetex-exp-num">' + numFrac.num + '</span><span class="xetex-exp-den">' + numFrac.den + '</span></span>';
    }

    function fmtDisplay(s) {
        s = s.replace(new RegExp(vEsc + '\\^\\(1\\/2\\)', 'g'), '√' + v);
        s = s.replace(new RegExp(vEsc + '\\^\\(1\\/3\\)', 'g'), '∛' + v);
        s = s.replace(/\^\((-?\d+)\/(\d+)\)/g, function(m, p, q) {
            return '<span class="xetex-exp"><span class="xetex-exp-num">' + p + '</span><span class="xetex-exp-den">' + q + '</span></span>';
        });
        s = s.replace(/\^\((-?\d+)\)/g, function(m, p) { return toSuperscript(parseInt(p)); });
        s = s.replace(/\^(-?\d+)/g, function(m, p) { return toSuperscript(parseInt(p)); });
        s = s.replace(/\((\d+)\/(\d+)\)/g, function(m, p, q) {
            return fracHTML(p, q);
        });
        return s;
    }

    var stepNum = identitySteps.length > 0 ? 2 : 1;

    var powMatch = expr.match(/^\((.+)\)\^\(?(\d+)\)?$/);
    if (powMatch && parseInt(powMatch[2]) >= 2 && parseInt(powMatch[2]) <= 4) {
        var base = powMatch[1].trim(), n = parseInt(powMatch[2]);
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">Expand the power</div></div>');
        steps.push('<div class="xetex-indent">(' + fmtDisplay(base) + ')' + toSuperscript(n) + '</div>');
        var acc = base;
        var ok = true;
        for (var p = 1; p < n; p++) {
            var next = expandBinomials(acc, base, v);
            if (!next) { ok = false; break; }
            acc = next;
        }
        if (ok) {
            steps.push('<div class="xetex-indent">= ' + fmtDisplay(acc) + '</div>');
            expr = acc; stepNum++;
        } else {
            steps.push('<div class="xetex-note">Cannot expand this yet.</div>');
            steps.push('</div>'); return steps.join('');
        }
    }

    var expandMatch = expr.match(/^\((.+)\)\((.+)\)$/);
    if (expandMatch && /^-?\d+\/\d+$/.test(expandMatch[1].trim()) && /√|∛/.test(expandMatch[2])) {
        expandMatch = null;
    }
    if (expandMatch) {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">Expand the product</div></div>');
        var left = expandMatch[1].trim(), right = expandMatch[2].trim();
        steps.push('<div class="xetex-indent">(' + fmtDisplay(left) + ')(' + fmtDisplay(right) + ')</div>');
        var expanded = expandBinomials(left, right, v);
        if (expanded) {
            steps.push('<div class="xetex-indent">= ' + fmtDisplay(expanded) + '</div>');
            expr = expanded; stepNum++;
        } else {
            steps.push('<div class="xetex-note">Cannot expand this yet.</div>');
            steps.push('</div>'); return steps.join('');
        }
    }

    var distMatch = expr.match(/^([a-zA-Z0-9]+(?:\^\(?-?\d+(?:\/\d+)?\)?)?)\((.+)\)$/);
    if (distMatch && /^\d*(sin|cos|tan|sec|csc|cot)(\^?[²2])?$/.test(distMatch[1])) {
        distMatch = null;
    }
    if (distMatch && !expandMatch) {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">Expand</div></div>');
        var outer = distMatch[1].trim(), inner2 = distMatch[2].trim();
        steps.push('<div class="xetex-indent">' + fmtDisplay(outer) + '(' + fmtDisplay(inner2) + ')</div>');
        var expanded2 = distribute(outer, inner2, v);
        if (expanded2) {
            steps.push('<div class="xetex-indent">= ' + fmtDisplay(expanded2) + '</div>');
            expr = expanded2; stepNum++;
        }
    }

    if (expr.indexOf('/') !== -1 && expr.indexOf('^(') === -1) {
        var fracMatch = expr.match(/^\((.+)\)\s*\/\s*\((.+)\)$/);
        if (fracMatch) {
            steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">Simplify the fraction</div></div>');
            var num = fracMatch[1].trim(), den = fracMatch[2].trim();
            steps.push('<div class="xetex-indent">(' + fmtDisplay(num) + ') ÷ (' + fmtDisplay(den) + ')</div>');
            var simplified = tryDividePolynomials(num, den, v);
            if (simplified) {
                steps.push('<div class="xetex-indent">= ' + fmtDisplay(simplified) + '</div>');
                expr = simplified; stepNum++;
            } else {
                steps.push('<div class="xetex-note">Cannot simplify this fraction.</div>');
                steps.push('</div>'); return steps.join('');
            }
        }
    }

function parseTerm(term) {
    term = term.trim();
    var sign = 1;
    if (term.startsWith('+')) { term = term.substring(1).trim(); }
    else if (term.startsWith('-')) { sign = -1; term = term.substring(1).trim(); }

    function matchLinear(inner) {
        inner = inner.trim();
        var m1 = inner.match(new RegExp('^(-?\\d*)' + vEsc + '\\s*([+\\-]\\s*\\d+)?$'));
        if (m1) {
            var a1 = m1[1] === '' ? 1 : (m1[1] === '-' ? -1 : parseInt(m1[1]));
            var b1 = m1[2] ? parseInt(m1[2].replace(/\s/g, '')) : 0;
            return { a: { num: a1, den: 1 }, b: b1 };
        }
        var m2 = inner.match(new RegExp('^(-?\\d+)\\s*([+\\-])\\s*(\\d*)' + vEsc + '$'));
        if (m2) {
            var b2 = parseInt(m2[1]);
            var aMag = m2[3] === '' ? 1 : parseInt(m2[3]);
            var a2 = m2[2] === '+' ? aMag : -aMag;
            return { a: { num: a2, den: 1 }, b: b2 };
        }
        var m3 = inner.match(new RegExp('^(-?\\d+)\\s*([+\\-])\\s*' + vEsc + '\\s*/\\s*(\\d+)$'));
        if (m3) {
            var b3 = parseInt(m3[1]);
            var den3 = parseInt(m3[3]);
            var a3 = m3[2] === '+' ? 1 : -1;
            return { a: { num: a3, den: den3 }, b: b3 };
        }
        var m4 = inner.match(new RegExp('^' + vEsc + '\\s*/\\s*(\\d+)\\s*([+\\-]\\s*\\d+)?$'));
        if (m4) {
            var den4 = parseInt(m4[1]);
            var b4 = m4[2] ? parseInt(m4[2].replace(/\s/g, '')) : 0;
            return { a: { num: 1, den: den4 }, b: b4 };
        }
        return null;
    }

    function parseLinearArg(inner) {
        inner = inner.trim();
        function parseConst(s) {
            s = s.trim();
            if (s === '') return '0';
            var pFrac = s.match(/^π\s*\/\s*(\d+)$/);
            if (pFrac) return 'π/' + pFrac[1];
            if (s === 'π') return 'π';
            if (/^-?\d+$/.test(s)) return s;
            if (/^[a-zA-Zα-ωΑ-Ω]$/.test(s)) return s;
            return null;
        }
        var pieces = [], cur = '', signs = [];
        for (var i = 0; i < inner.length; i++) {
            var ch = inner[i];
            if ((ch === '+' || ch === '-') && i > 0) { pieces.push(cur); signs.push(ch); cur = ''; }
            else cur += ch;
        }
        pieces.push(cur);
        if (pieces.length === 1) {
            var p = pieces[0].trim();
            var mv = p.match(new RegExp('^(-?[a-zA-Zα-ωΑ-Ω]?\\d*)' + vEsc + '$'));
            if (mv) {
                var coefStr = mv[1];
                if (coefStr === '' || coefStr === '-') {
                    return { a: { num: coefStr === '-' ? -1 : 1, den: 1 }, b: '0' };
                }
                if (/^-?\d+$/.test(coefStr)) return { a: { num: parseInt(coefStr), den: 1 }, b: '0' };
                return null;
            }
            var mvd = p.match(new RegExp('^' + vEsc + '\\s*/\\s*(\\d+)$'));
            if (mvd) return { a: { num: 1, den: parseInt(mvd[1]) }, b: '0' };
            return null;
        }
        if (pieces.length !== 2) return null;
        var first = pieces[0].trim(), secondSign = signs[0], second = pieces[1].trim();
        function tryOrder(vPiece, constPiece, vPieceIsNegated) {
            var av = null;
            var mv = vPiece.match(new RegExp('^(\\d*)' + vEsc + '$'));
            if (mv) av = { num: mv[1] === '' ? 1 : parseInt(mv[1]), den: 1 };
            if (!av) {
                var mvd = vPiece.match(new RegExp('^(\\d*)' + vEsc + '\\s*/\\s*(\\d+)$'));
                if (mvd) av = { num: mvd[1] === '' ? 1 : parseInt(mvd[1]), den: parseInt(mvd[2]) };
            }
            if (!av) {
                var msym = vPiece.match(new RegExp('^([a-zA-Zα-ωΑ-Ω])' + vEsc + '$'));
                if (msym) av = msym[1];
            }
            if (av === null) return null;
            if (vPieceIsNegated) {
                av = (typeof av === 'string') ? '-' + av : { num: -av.num, den: av.den };
            }
            var bConst = parseConst(constPiece);
            if (bConst === null) return null;
            return { a: av, b: bConst };
        }
        var rA = tryOrder(first, second, false);
        if (rA) {
            if (secondSign === '-') {
                rA.b = rA.b.startsWith('-') ? rA.b.slice(1) : '-' + rA.b;
                if (rA.b === '-0') rA.b = '0';
            }
            rA.constFirst = false;
            return rA;
        }
        var rB = tryOrder(second, first, secondSign === '-');
        if (rB) { rB.constFirst = true; rB.constFirstSign = secondSign; return rB; }
        return null;
    }

    var adv = (function() {
        var vm = vEsc;

        function parseASquared(raw) {
            raw = raw.trim();
            var symM = raw.match(/^([a-zA-Zα-ωΑ-Ω])(?:\^2|²)$/);
            if (symM) return { aDisp: symM[1], aSym: true, aNum: null, aSqDisp: symM[1] + '²', aSqNum: null };
            var numM = raw.match(/^(\d+)$/);
            if (numM) {
                var c = parseInt(numM[1]);
                if (c <= 0) return null;
                var sq = Math.sqrt(c), isInt = Number.isInteger(sq);
                return { aDisp: isInt ? String(sq) : '√' + c, aSym: false, aNum: sq, aSqDisp: String(c), aSqNum: c };
            }
            var numSqM = raw.match(/^(\d+)(?:\^2|²)$/);
            if (numSqM) {
                var b = parseInt(numSqM[1]);
                return { aDisp: String(b), aSym: false, aNum: b, aSqDisp: String(b * b), aSqNum: b * b };
            }
            var sqrtM = raw.match(/^√(\d+)$/);
            if (sqrtM) {
                var c2 = parseInt(sqrtM[1]);
                return { aDisp: '√' + c2, aSym: false, aNum: Math.sqrt(c2), aSqDisp: String(c2), aSqNum: c2 };
            }
            return null;
        }

        var re, m, a, c;

        re = new RegExp('^1\\s*/\\s*\\(\\s*' + vm + '\\^2\\s*\\+\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'recipQuad', form: 'x2plusA2', a: a, coeff: sign }; }
        re = new RegExp('^1\\s*/\\s*\\(\\s*' + vm + '\\^2\\s*-\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'recipQuad', form: 'x2minusA2', a: a, coeff: sign }; }
        re = new RegExp('^1\\s*/\\s*\\(\\s*(.+?)\\s*-\\s*' + vm + '\\^2\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'recipQuad', form: 'a2minusX2', a: a, coeff: sign }; }

        re = new RegExp('^1\\s*/\\s*√\\(\\s*' + vm + '\\^2\\s*\\+\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'recipSqrtQuad', form: 'x2plusA2', a: a, coeff: sign }; }
        re = new RegExp('^1\\s*/\\s*√\\(\\s*' + vm + '\\^2\\s*-\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'recipSqrtQuad', form: 'x2minusA2', a: a, coeff: sign }; }
        re = new RegExp('^1\\s*/\\s*√\\(\\s*(.+?)\\s*-\\s*' + vm + '\\^2\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'recipSqrtQuad', form: 'a2minusX2', a: a, coeff: sign }; }

        re = new RegExp('^√\\(\\s*' + vm + '\\^2\\s*\\+\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'sqrtQuad', form: 'x2plusA2', a: a, coeff: sign }; }
        re = new RegExp('^√\\(\\s*' + vm + '\\^2\\s*-\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'sqrtQuad', form: 'x2minusA2', a: a, coeff: sign }; }
        re = new RegExp('^√\\(\\s*(.+?)\\s*-\\s*' + vm + '\\^2\\s*\\)$');
        m = term.match(re); if (m) { a = parseASquared(m[1]); if (a) return { type: 'sqrtQuad', form: 'a2minusX2', a: a, coeff: sign }; }

        re = new RegExp('^(\\d*)' + vm + '\\s*[\\*·]?\\s*sin\\(?' + vm + '(?:\\^2|²)\\)?$');
        m = term.match(re); if (m) { c = m[1] === '' ? 1 : parseInt(m[1]); return { type: 'xTimesFnX2', fn: 'sin', coeff: sign * c }; }
        re = new RegExp('^(\\d*)' + vm + '\\s*[\\*·]?\\s*cos\\(?' + vm + '(?:\\^2|²)\\)?$');
        m = term.match(re); if (m) { c = m[1] === '' ? 1 : parseInt(m[1]); return { type: 'xTimesFnX2', fn: 'cos', coeff: sign * c }; }

        re = new RegExp('^(\\d*)' + vm + '\\s*[\\*·]?\\s*e\\^\\(?(-?)' + vm + '(?:\\^2|²)\\)?$');
        m = term.match(re); if (m) { c = m[1] === '' ? 1 : parseInt(m[1]); return { type: 'xTimesExpX2', coeff: sign * c, neg: m[2] === '-' }; }

        re = new RegExp('^1\\s*/\\s*\\(\\s*' + vm + '\\s*[\\*·]?\\s*ln\\(?' + vm + '\\)?\\s*\\)$');
        if (re.test(term)) return { type: 'recipXLnX', coeff: sign };

        re = new RegExp('^(\\d*)' + vm + '\\s*/\\s*\\(\\s*' + vm + '\\^2\\s*\\+\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { c = m[1] === '' ? 1 : parseInt(m[1]); a = parseASquared(m[2]); if (a) return { type: 'xOverX2PlusA', coeff: sign * c, a: a }; }

        re = new RegExp('^(\\d*)' + vm + '\\s*/\\s*√\\(\\s*' + vm + '\\^2\\s*\\+\\s*(.+?)\\s*\\)$');
        m = term.match(re); if (m) { c = m[1] === '' ? 1 : parseInt(m[1]); a = parseASquared(m[2]); if (a) return { type: 'xOverSqrtX2PlusA', coeff: sign * c, a: a }; }

        return null;
    })();
    if (adv) return adv;

    var lrRecipRoot = term.match(new RegExp('^1\\s*/\\s*(√|∛)\\(\\s*(.+?)\\s*\\)$'));
    if (lrRecipRoot) {
        var lrrLin = matchLinear(lrRecipRoot[2]);
        if (lrrLin) {
            var lrrPower = lrRecipRoot[1] === '√' ? { num: -1, den: 2 } : { num: -1, den: 3 };
            return { type: 'linearPower', coeff: sign, a: lrrLin.a, b: lrrLin.b, power: lrrPower };
        }
    }

    var lrRoot = term.match(new RegExp('^(√|∛)\\(\\s*(.+?)\\s*\\)$'));
    if (lrRoot) {
        var lrLin = matchLinear(lrRoot[2]);
        if (lrLin) {
            var lrPower = lrRoot[1] === '√' ? { num: 1, den: 2 } : { num: 1, den: 3 };
            return { type: 'linearPower', coeff: sign, a: lrLin.a, b: lrLin.b, power: lrPower };
        }
    }

    var lrRecipLin = term.match(new RegExp('^1\\s*/\\s*\\(\\s*(.+?)\\s*\\)$'));
    if (lrRecipLin) {
        var lrlLin = matchLinear(lrRecipLin[1]);
        if (lrlLin && !(lrlLin.a.num === lrlLin.a.den && lrlLin.b === 0)) {
            return { type: 'linearPower', coeff: sign, a: lrlLin.a, b: lrlLin.b, power: { num: -1, den: 1 } };
        }
    }

    var lrPow = term.match(new RegExp('^\\(\\s*(.+?)\\s*\\)\\^\\(?(-?\\d+(?:/\\d+)?)\\)?$'));
    if (lrPow) {
        var lpLin = matchLinear(lrPow[1]);
        if (lpLin && !(lpLin.a.num === lpLin.a.den && lpLin.b === 0)) {
            var lpFracM = lrPow[2].match(/^(-?\d+)\/(\d+)$/);
            var lpPower = lpFracM ? { num: parseInt(lpFracM[1]), den: parseInt(lpFracM[2]) } : parseInt(lrPow[2]);
            return { type: 'linearPower', coeff: sign, a: lpLin.a, b: lpLin.b, power: lpPower };
        }
    }

    var fracSumMatch = term.match(/^\((-?\d+)\/(\d+)\)\((.+)\)$/);
    if (fracSumMatch) {
        var fsNum = parseInt(fracSumMatch[1]), fsDen = parseInt(fracSumMatch[2]);
        var fsInner = fracSumMatch[3];
        var fsDepth = 0, fsWraps = true;
        for (var fi = 0; fi < fsInner.length; fi++) {
            if (fsInner[fi] === '(') fsDepth++;
            if (fsInner[fi] === ')') { fsDepth--; if (fsDepth < 0) { fsWraps = false; break; } }
        }
        if (fsWraps && fsDepth === 0) {
            var fsSubTerms = [], fsCur = '', fsD = 0;
            for (var fj = 0; fj < fsInner.length; fj++) {
                var fch = fsInner[fj];
                if (fch === '(') fsD++;
                if (fch === ')') fsD--;
                if ((fch === '+' || fch === '-') && fsD === 0 && fj > 0 && fsCur.length > 0) {
                    fsSubTerms.push(fsCur.trim()); fsCur = fch;
                } else { fsCur += fch; }
            }
            if (fsCur.trim()) fsSubTerms.push(fsCur.trim());
            if (fsSubTerms.length >= 1) {
                var fsSubParsed = fsSubTerms.map(function(st) { return parseTerm(st); });
                if (fsSubParsed.every(function(sp) { return sp !== null; })) {
                    var fsScaled = fsSubParsed.map(function(sp) {
                        var spCopy = Object.assign({}, sp);
                        var spCoeffFrac = (typeof spCopy.coeff === 'object') ? spCopy.coeff : { num: spCopy.coeff, den: 1 };
                        var newNum = spCoeffFrac.num * fsNum, newDen = spCoeffFrac.den * fsDen;
                        var g = gcdPoly(Math.abs(newNum), Math.abs(newDen));
                        if (g) { newNum /= g; newDen /= g; }
                        if (newDen < 0) { newNum = -newNum; newDen = -newDen; }
                        spCopy.coeff = newDen === 1 ? newNum : { num: newNum, den: newDen };
                        return spCopy;
                    });
                    return { type: 'sum', parts: fsScaled, sign: sign, rawParts: fsSubTerms, scaledDisplay: fracSumMatch[1] + '/' + fracSumMatch[2] };
                }
            }
        }
    }

    if (term.startsWith('(') && term.endsWith(')')) {
        var innerT = term.slice(1, -1), depthT = 0, wraps = true;
        for (var ti = 0; ti < innerT.length; ti++) {
            if (innerT[ti] === '(') depthT++;
            if (innerT[ti] === ')') { depthT--; if (depthT < 0) { wraps = false; break; } }
        }
        if (wraps && depthT === 0) {
            var recur = parseTerm((sign === -1 ? '-' : '') + innerT);
            if (recur) return recur;
            var subTerms = [], subCur = '', subDepth = 0;
            for (var si = 0; si < innerT.length; si++) {
                var sch = innerT[si];
                if (sch === '(') subDepth++;
                if (sch === ')') subDepth--;
                if ((sch === '+' || sch === '-') && subDepth === 0 && si > 0 && subCur.length > 0) {
                    subTerms.push(subCur.trim()); subCur = sch;
                } else { subCur += sch; }
            }
            if (subCur.trim()) subTerms.push(subCur.trim());
            if (subTerms.length > 1) {
                var subParsed = subTerms.map(function(st) { return parseTerm(st); });
                if (subParsed.every(function(sp) { return sp !== null; })) {
                    return { type: 'sum', parts: subParsed, sign: sign, rawParts: subTerms };
                }
            }
            term = innerT;
        }
    }

    var trigProdMatch = term.match(new RegExp(
        '^(\\d*)(sec|csc)\\(?' + vEsc + '\\)?(tan|cot)\\(?' + vEsc + '\\)?$'
    ));
    if (trigProdMatch) {
        var ppc = trigProdMatch[1] === '' ? 1 : parseInt(trigProdMatch[1]);
        var ppFn1 = trigProdMatch[2], ppFn2 = trigProdMatch[3];
        var validPair = (ppFn1 === 'sec' && ppFn2 === 'tan') || (ppFn1 === 'csc' && ppFn2 === 'cot');
        if (validPair) {
            return { type: 'trigProd', coeff: sign * ppc, fn: ppFn1 };
        }
    }

    var halfSqMatch = term.match(new RegExp('^(\\d*)(sec|csc)(?:\\^2|²)\\(?\\s*' + vEsc + '\\s*/\\s*2\\s*\\)?$'));
    if (halfSqMatch) {
        var hsc = halfSqMatch[1] === '' ? 1 : parseInt(halfSqMatch[1]);
        var hsFn = halfSqMatch[2];
        return { type: 'secCscHalfSq', coeff: sign * hsc, fn: hsFn };
    }

    var trigLinResult = (function() {
        var termForTrig = term, fracCoeffOnTrig = null;
        var leadFrac = term.match(/^\((-?\d+)\/(\d+)\)(sin|cos)/);
        if (leadFrac) {
            fracCoeffOnTrig = { num: parseInt(leadFrac[1]), den: parseInt(leadFrac[2]) };
            termForTrig = term.slice(leadFrac[1].length + leadFrac[2].length + 3);
        }
        var fnArgMatch = termForTrig.match(/^(sin|cos)\(?(.+?)\)?$/);
        if (!fnArgMatch) return null;
        var tlFn = fnArgMatch[1];
        var argRaw = (termForTrig.startsWith(tlFn + '(') && termForTrig.endsWith(')'))
            ? termForTrig.slice(tlFn.length + 1, -1)
            : termForTrig.slice(tlFn.length);
        argRaw = argRaw.trim();
        if (argRaw === '') return null;
        var isDegrees = /°$/.test(argRaw);
        if (isDegrees) argRaw = argRaw.slice(0, -1).trim();
        var lin = parseLinearArg(argRaw);
        if (!lin) return null;
        var aIsTrivialOne = (typeof lin.a === 'object' && lin.a.num === lin.a.den);
        if (!fracCoeffOnTrig && !isDegrees && aIsTrivialOne && lin.b === '0') return null;
        var finalCoeff = fracCoeffOnTrig
            ? { num: sign * fracCoeffOnTrig.num, den: fracCoeffOnTrig.den }
            : sign;
        return { type: 'trigLinear', coeff: finalCoeff, fn: tlFn, a: lin.a, b: lin.b, degrees: isDegrees, constFirst: !!lin.constFirst };
    })();
    if (trigLinResult) return trigLinResult;

    var trigMatchIrr = term.match(new RegExp('^(√2)(sin|cos|tan|sec|csc|cot)(\\^?[²2])?\\(?' + vEsc + '\\)?$'));
    if (trigMatchIrr) {
        var itfn = trigMatchIrr[2];
        var itpow = trigMatchIrr[3] ? 2 : 1;
        if (itpow === 2 && itfn !== 'sec' && itfn !== 'csc') return null;
        if (itpow === 1 && itfn !== 'sin' && itfn !== 'cos') return null;
        return { type: 'trig', coeff: (sign === -1 ? '-√2' : '√2'), fn: itfn, power: itpow };
    }

    var trigMatch = term.match(new RegExp('^(\\d*)(sin|cos|tan|sec|csc|cot)(\\^?[²2])?\\(?' + vEsc + '\\)?$'));
    if (trigMatch) {
        var tc = trigMatch[1] === '' ? 1 : parseInt(trigMatch[1]);
        var tfn = trigMatch[2];
        var tpow = trigMatch[3] ? 2 : 1;
        if (tpow === 2 && tfn !== 'sec' && tfn !== 'csc') return null;
        return { type: 'trig', coeff: sign * tc, fn: tfn, power: tpow };
    }

    var trigFracMatch = term.match(new RegExp('^\\((\\d+)\\/(\\d+)\\)(sin|cos|tan|sec|csc|cot)(\\^?[²2])?\\(?' + vEsc + '\\)?$'));
    if (trigFracMatch) {
        var tfNum = parseInt(trigFracMatch[1]), tfDen = parseInt(trigFracMatch[2]);
        var tfFn = trigFracMatch[3];
        var tfPow = trigFracMatch[4] ? 2 : 1;
        if (tfPow === 2 && tfFn !== 'sec' && tfFn !== 'csc') return null;
        return { type: 'trig', coeff: { num: sign * tfNum, den: tfDen }, fn: tfFn, power: tfPow };
    }

    var fracCoMatch = term.match(/^\((\d+)\/(\d+)\)(.*)$/);
    if (fracCoMatch) {
        var num = parseInt(fracCoMatch[1]), den = parseInt(fracCoMatch[2]);
        var rest = fracCoMatch[3];
        if (rest === '') return { type: 'constant', coeff: { num: sign * num, den: den } };
        if (rest === v) return { type: 'power', coeff: { num: sign * num, den: den }, power: 1 };
        var pMatch = rest.match(new RegExp('^' + vEsc + '\\^\\((-?\\d+)\\/(\\d+)\\)$'));
        if (pMatch) return { type: 'power', coeff: { num: sign * num, den: den }, power: { num: parseInt(pMatch[1]), den: parseInt(pMatch[2]) } };
        pMatch = rest.match(new RegExp('^' + vEsc + '\\^\\(?(-?\\d+)\\)?$'));
        if (pMatch) return { type: 'power', coeff: { num: sign * num, den: den }, power: parseInt(pMatch[1]) };
    }

    var symFracCoMatch = term.match(/^\(([a-zA-Z])\/(\d+)\)(.*)$/);
    if (symFracCoMatch && symFracCoMatch[1] !== v) {
        var symC = symFracCoMatch[1], symDen = parseInt(symFracCoMatch[2]);
        var symRest = symFracCoMatch[3];
        var coeffSym = (sign === -1 ? '-' : '') + '(' + symC + '/' + symDen + ')';
        if (symRest === '') return { type: 'constant', coeff: coeffSym };
        if (symRest === v) return { type: 'power', coeff: coeffSym, power: 1 };
        var sp = symRest.match(new RegExp('^' + vEsc + '\\^\\((-?\\d+)\\/(\\d+)\\)$'));
        if (sp) return { type: 'power', coeff: coeffSym, power: { num: parseInt(sp[1]), den: parseInt(sp[2]) } };
        sp = symRest.match(new RegExp('^' + vEsc + '\\^\\(?(-?\\d+)\\)?$'));
        if (sp) return { type: 'power', coeff: coeffSym, power: parseInt(sp[1]) };
    }

    function negateA_(av) {
        if (typeof av === 'string') return av.startsWith('-') ? av.slice(1) : '-' + av;
        return { num: -av.num, den: av.den };
    }
    function negateB_(bv) {
        if (bv === '0') return '0';
        return bv.startsWith('-') ? bv.slice(1) : '-' + bv;
    }
    var expSimple = term.match(new RegExp('^(\\d*)e\\^' + vEsc + '$'));
    if (expSimple) {
        var esc_ = expSimple[1] === '' ? 1 : parseInt(expSimple[1]);
        return { type: 'exp', coeff: sign * esc_, a: { num: 1, den: 1 }, b: '0' };
    }
    var expParen = term.match(/^(\d*)e\^\((.+)\)$/);
    if (expParen) {
        var epc_ = expParen[1] === '' ? 1 : parseInt(expParen[1]);
        var epInner_ = expParen[2];
        var epLin_ = parseLinearArg(epInner_);
        var epSign_ = 1;
        if (!epLin_ && epInner_.startsWith('-')) {
            epLin_ = parseLinearArg(epInner_.slice(1));
            if (epLin_) epSign_ = -1;
        }
        if (epLin_) {
            return {
                type: 'exp',
                coeff: sign * epc_,
                a: epSign_ === -1 ? negateA_(epLin_.a) : epLin_.a,
                b: epSign_ === -1 ? negateB_(epLin_.b) : epLin_.b
            };
        }
    }
    var expFrac_ = term.match(new RegExp('^(\\d*)e\\^((-?)' + vEsc + '\\/(\\d+))$'));
    if (expFrac_) {
        var efc_ = expFrac_[1] === '' ? 1 : parseInt(expFrac_[1]);
        var efNeg_ = expFrac_[3] === '-';
        var efDen_ = parseInt(expFrac_[4]);
        return { type: 'exp', coeff: sign * efc_, a: { num: efNeg_ ? -1 : 1, den: efDen_ }, b: '0' };
    }

    var lnSimple = term.match(new RegExp('^(\\d*)ln\\(?' + vEsc + '\\)?$'));
    if (lnSimple) {
        var lc_ = lnSimple[1] === '' ? 1 : parseInt(lnSimple[1]);
        return { type: 'ln', coeff: sign * lc_, a: { num: 1, den: 1 }, b: '0' };
    }
    var lnParen = term.match(/^(\d*)ln\((.+)\)$/);
    if (lnParen) {
        var lpc_ = lnParen[1] === '' ? 1 : parseInt(lnParen[1]);
        var lpLin_ = parseLinearArg(lnParen[2]);
        if (lpLin_) {
            return { type: 'ln', coeff: sign * lpc_, a: lpLin_.a, b: lpLin_.b };
        }
    }

    if (/^\d+$/.test(term)) return { type: 'constant', coeff: sign * parseInt(term) };
    if (term === v) return { type: 'power', coeff: sign * 1, power: 1 };

    var vOverN = term.match(new RegExp('^' + vEsc + '\\s*/\\s*(\\d+)$'));
    if (vOverN) return { type: 'power', coeff: { num: sign * 1, den: parseInt(vOverN[1]) }, power: 1 };

    var cvOverN = term.match(new RegExp('^(\\d+)' + vEsc + '\\s*/\\s*(\\d+)$'));
    if (cvOverN) return { type: 'power', coeff: { num: sign * parseInt(cvOverN[1]), den: parseInt(cvOverN[2]) }, power: 1 };

    if (/^[a-zA-Z]$/.test(term) && term !== v) {
        return { type: 'constant', coeff: (sign === -1 ? '-' : '') + term };
    }

    var plainFracMatch = term.match(/^(\d+)\/(\d+)$/);
    if (plainFracMatch) {
        return { type: 'constant', coeff: { num: sign * parseInt(plainFracMatch[1]), den: parseInt(plainFracMatch[2]) } };
    }

    var fracMatch = term.match(new RegExp('^(\\d*)' + vEsc + '\\^\\((-?\\d+)\\/(\\d+)\\)$'));
    if (fracMatch) {
        var c = fracMatch[1] === '' ? 1 : parseInt(fracMatch[1]);
        return { type: 'power', coeff: sign * c, power: { num: parseInt(fracMatch[2]), den: parseInt(fracMatch[3]) } };
    }
    var match = term.match(new RegExp('^(\\d*)' + vEsc + '\\^\\(?(-?\\d+)\\)?$'));
    if (match) return { type: 'power', coeff: sign * (match[1] === '' ? 1 : parseInt(match[1])), power: parseInt(match[2]) };
    match = term.match(new RegExp('^(\\d*)' + vEsc + '$'));
    if (match) return { type: 'power', coeff: sign * (match[1] === '' ? 1 : parseInt(match[1])), power: 1 };

    var symFrac = term.match(new RegExp('^([a-zA-Z])' + vEsc + '\\^\\((-?\\d+)\\/(\\d+)\\)$'));
    if (symFrac && symFrac[1] !== v) {
        return { type: 'power', coeff: (sign === -1 ? '-' : '') + symFrac[1], power: { num: parseInt(symFrac[2]), den: parseInt(symFrac[3]) } };
    }
    var symPow = term.match(new RegExp('^([a-zA-Z])' + vEsc + '\\^\\(?(-?\\d+)\\)?$'));
    if (symPow && symPow[1] !== v) {
        return { type: 'power', coeff: (sign === -1 ? '-' : '') + symPow[1], power: parseInt(symPow[2]) };
    }
    var symLin = term.match(new RegExp('^([a-zA-Z])' + vEsc + '$'));
    if (symLin && symLin[1] !== v) {
        return { type: 'power', coeff: (sign === -1 ? '-' : '') + symLin[1], power: 1 };
    }

    var numSymFrac = term.match(new RegExp('^(\\d+)([a-zA-Z])' + vEsc + '\\^\\((-?\\d+)\\/(\\d+)\\)$'));
    if (numSymFrac && numSymFrac[2] !== v) {
        var nsCoeff = (sign === -1 ? '-' : '') + numSymFrac[1] + numSymFrac[2];
        return { type: 'power', coeff: nsCoeff, power: { num: parseInt(numSymFrac[3]), den: parseInt(numSymFrac[4]) } };
    }
    var numSymPow = term.match(new RegExp('^(\\d+)([a-zA-Z])' + vEsc + '\\^\\(?(-?\\d+)\\)?$'));
    if (numSymPow && numSymPow[2] !== v) {
        var nsCoeff2 = (sign === -1 ? '-' : '') + numSymPow[1] + numSymPow[2];
        return { type: 'power', coeff: nsCoeff2, power: parseInt(numSymPow[3]) };
    }
    var numSymLin = term.match(new RegExp('^(\\d+)([a-zA-Z])' + vEsc + '$'));
    if (numSymLin && numSymLin[2] !== v) {
        var nsCoeff3 = (sign === -1 ? '-' : '') + numSymLin[1] + numSymLin[2];
        return { type: 'power', coeff: nsCoeff3, power: 1 };
    }
    return null;
}

function integrateTerm(termObj, originalTerm) {
    if (termObj.type === 'sum') {
        var subResults = [];
        for (var spi = 0; spi < termObj.parts.length; spi++) {
            var subRes = integrateTerm(termObj.parts[spi], fmtDisplay(termObj.rawParts[spi]));
            if (!subRes) return null;
            subResults.push(subRes.result);
        }
        var combined = subResults.join(' + ').replace(/\+\s+-/g, '- ');
        if (termObj.sign === -1) {
            combined = subResults.map(function(r) {
                return r.startsWith('-') ? r.slice(1) : '-' + r;
            }).join(' + ').replace(/\+\s+-/g, '- ');
        }
        var sSum = ['∫ ' + originalTerm + ' d' + v];
        sSum.push('= ' + combined);
        return { result: combined, steps: sSum };
    }

    function toFrac(val) {
        if (typeof val === 'object' && val.num !== undefined) return { num: val.num, den: val.den };
        if (Number.isInteger(val)) return { num: val, den: 1 };
        var s = val.toString();
        if (s.indexOf('.') !== -1) {
            var dec = s.split('.')[1];
            var d = Math.pow(10, dec.length);
            return simpFrac({ num: Math.round(val * d), den: d });
        }
        return { num: val, den: 1 };
    }
    function multFrac(a, b) { return simpFrac({ num: a.num * b.num, den: a.den * b.den }); }
    function divFrac(a, b) { return simpFrac({ num: a.num * b.den, den: a.den * b.num }); }
    function simpFrac(f) {
        if (f.den < 0) { f.num = -f.num; f.den = -f.den; }
        var g = gcd(Math.abs(f.num), f.den);
        return { num: f.num / g, den: f.den / g };
    }
    function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
    function fracStr(f) {
        if (f.den === 1) return '' + f.num;
        if (f.num < 0) return '-' + fracHTML(Math.abs(f.num), f.den);
        return fracHTML(f.num, f.den);
    }
    function foldCoeff(coeffFrac, expr) {
        if (coeffFrac.num === 1 && coeffFrac.den === 1) return expr;
        if (coeffFrac.num === -1 && coeffFrac.den === 1) return '-' + expr;
        if (coeffFrac.den === 1) return coeffFrac.num + '·' + expr;
        if (coeffFrac.num < 0) return '-' + fracHTML(Math.abs(coeffFrac.num), coeffFrac.den) + '·' + expr;
        return fracHTML(coeffFrac.num, coeffFrac.den) + '·' + expr;
    }

    var TRIG_ANTIDERIVATIVES = {
        cos: { name: 'sin', flip: false },
        sin: { name: 'cos', flip: true },
        sec2: { name: 'tan', flip: false },
        csc2: { name: 'cot', flip: true }
    };

    if (termObj.type === 'recipQuad') {
        var rq = termObj.a;
        var rqCoeff = toFrac(termObj.coeff);
        var aD = rq.aDisp;
        var resultStr;
        var noteLines = [];

        if (termObj.form === 'x2plusA2') {
            resultStr = '(1/' + aD + ')·arctan(' + v + '/' + aD + ')';
            noteLines.push('Standard form: ∫ dv/(v²+a²) = (1/a)·arctan(v/a)');
        } else if (termObj.form === 'x2minusA2') {
            var lnArg = 'ln|(' + v + ' - ' + aD + ')/(' + v + ' + ' + aD + ')|';
            var factor2a;
            if (rq.aSym) factor2a = '(1/2' + aD + ')';
            else if (Number.isInteger(rq.aNum)) factor2a = '(1/' + (2 * rq.aNum) + ')';
            else factor2a = '(1/(2·' + aD + '))';
            resultStr = factor2a + '·' + lnArg;
            noteLines.push('Standard form: ∫ dv/(v²-a²) = (1/2a)·ln|(v-a)/(v+a)|');
        } else {
            var lnArg2 = 'ln|(' + aD + ' + ' + v + ')/(' + aD + ' - ' + v + ')|';
            var factor2b;
            if (rq.aSym) factor2b = '(1/2' + aD + ')';
            else if (Number.isInteger(rq.aNum)) factor2b = '(1/' + (2 * rq.aNum) + ')';
            else factor2b = '(1/(2·' + aD + '))';
            resultStr = factor2b + '·' + lnArg2;
            noteLines.push('Standard form: ∫ dv/(a²-v²) = (1/2a)·ln|(a+v)/(a-v)|');
        }

        if (!(rqCoeff.num === 1 && rqCoeff.den === 1)) {
            resultStr = foldCoeff(rqCoeff, resultStr);
        }

        var rqS = ['∫ ' + originalTerm + ' d' + v];
        noteLines.forEach(function(L) { rqS.push(L); });
        rqS.push('= ' + resultStr);
        return { result: resultStr, steps: rqS };
    }

    if (termObj.type === 'recipSqrtQuad') {
        var rsq = termObj.a;
        var rsqCoeff = toFrac(termObj.coeff);
        var aD2 = rsq.aDisp;
        var resultStr2;
        var noteLines2 = [];

        if (termObj.form === 'x2plusA2') {
            var aSqDisp1 = rsq.aSqDisp;
            resultStr2 = 'ln|' + v + ' + √(' + v + '² + ' + aSqDisp1 + ')|';
            noteLines2.push('Standard form: ∫ dv/√(v²+a²) = ln|v + √(v²+a²)|');
        } else if (termObj.form === 'x2minusA2') {
            var aSqDisp2 = rsq.aSqDisp;
            resultStr2 = 'ln|' + v + ' + √(' + v + '² - ' + aSqDisp2 + ')|';
            noteLines2.push('Standard form: ∫ dv/√(v²-a²) = ln|v + √(v²-a²)|');
        } else {
            resultStr2 = 'arcsin(' + v + '/' + aD2 + ')';
            noteLines2.push('Standard form: ∫ dv/√(a²-v²) = arcsin(v/a)');
        }

        if (!(rsqCoeff.num === 1 && rsqCoeff.den === 1)) {
            resultStr2 = foldCoeff(rsqCoeff, resultStr2);
        }

        var rsqS = ['∫ ' + originalTerm + ' d' + v];
        noteLines2.forEach(function(L) { rsqS.push(L); });
        rsqS.push('= ' + resultStr2);
        return { result: resultStr2, steps: rsqS };
    }

    if (termObj.type === 'sqrtQuad') {
        var sq = termObj.a;
        var sqCoeff = toFrac(termObj.coeff);
        var aD3 = sq.aDisp;
        var aSqDisp3 = sq.aSqDisp;

        var halfASqDisp;
        if (sq.aSym) {
            halfASqDisp = aSqDisp3 + '/2';
        } else if (sq.aSqNum % 2 === 0) {
            halfASqDisp = String(sq.aSqNum / 2);
        } else {
            halfASqDisp = fracHTML(sq.aSqNum, 2);
        }

        var innerRoot, arcLnTerm, sign2, note3;
        if (termObj.form === 'a2minusX2') {
            innerRoot = '√(' + aSqDisp3 + ' - ' + v + '²)';
            arcLnTerm = 'arcsin(' + v + '/' + aD3 + ')';
            sign2 = '+';
            note3 = 'Trig sub: x = a·sin θ  →  ∫√(a²-v²) = (v/2)√(a²-v²) + (a²/2)arcsin(v/a)';
        } else if (termObj.form === 'x2plusA2') {
            innerRoot = '√(' + v + '² + ' + aSqDisp3 + ')';
            arcLnTerm = 'ln|' + v + ' + ' + innerRoot + '|';
            sign2 = '+';
            note3 = 'Trig sub: x = a·tan θ  →  ∫√(v²+a²) = (v/2)√(v²+a²) + (a²/2)ln|v+√(v²+a²)|';
        } else {
            innerRoot = '√(' + v + '² - ' + aSqDisp3 + ')';
            arcLnTerm = 'ln|' + v + ' + ' + innerRoot + '|';
            sign2 = '-';
            note3 = 'Trig sub: x = a·sec θ  →  ∫√(v²-a²) = (v/2)√(v²-a²) - (a²/2)ln|v+√(v²-a²)|';
        }

        var termA = '(' + v + '/2)·' + innerRoot;
        var termB = halfASqDisp + '·' + arcLnTerm;
        var result3 = termA + ' ' + sign2 + ' ' + termB;

        if (!(sqCoeff.num === 1 && sqCoeff.den === 1)) {
            result3 = foldCoeff(sqCoeff, result3);
        }

        var sqS = ['∫ ' + originalTerm + ' d' + v];
        sqS.push(note3);
        sqS.push('= ' + result3);
        return { result: result3, steps: sqS };
    }

    if (termObj.type === 'xTimesFnX2') {
        var xfCoeff = toFrac(termObj.coeff);
        var halfFrac = { num: 1, den: 2 };
        if (termObj.fn === 'sin') halfFrac.num = -1;
        var combinedXF = multFrac(xfCoeff, halfFrac);
        var baseFn = termObj.fn === 'sin' ? 'cos' : 'sin';
        var xfBody = baseFn + '(' + v + '²)';
        var resultXf = foldCoeff(combinedXF, xfBody);

        var xfS = ['∫ ' + originalTerm + ' d' + v];
        xfS.push('u = ' + v + '²,  du = 2' + v + ' d' + v);
        xfS.push('= ' + resultXf);
        return { result: resultXf, steps: xfS };
    }

    if (termObj.type === 'xTimesExpX2') {
        var xeCoeff = toFrac(termObj.coeff);
        var xeSign = termObj.neg ? -1 : 1;
        var halfXe = multFrac(xeCoeff, { num: xeSign, den: 2 });
        var expArg = termObj.neg ? '-' + v + '²' : v + '²';
        var xeBody = 'e^(' + expArg + ')';
        var resultXe = foldCoeff(halfXe, xeBody);

        var xeS = ['∫ ' + originalTerm + ' d' + v];
        xeS.push('u = ' + expArg + ',  du = ' + (termObj.neg ? '-' : '') + '2' + v + ' d' + v);
        xeS.push('= ' + resultXe);
        return { result: resultXe, steps: xeS };
    }

    if (termObj.type === 'recipXLnX') {
        var rxlCoeff = toFrac(termObj.coeff);
        var rxlBody = 'ln|ln(' + v + ')|';
        var resultRxl = foldCoeff(rxlCoeff, rxlBody);

        var rxlS = ['∫ ' + originalTerm + ' d' + v];
        rxlS.push('u = ln(' + v + '),  du = (1/' + v + ') d' + v);
        rxlS.push('= ' + resultRxl);
        return { result: resultRxl, steps: rxlS };
    }

    if (termObj.type === 'xOverX2PlusA') {
        var xoa = termObj.a;
        var xoaCoeff = toFrac(termObj.coeff);
        var xoaASq = xoa.aSqDisp;
        var halfXoa = multFrac(xoaCoeff, { num: 1, den: 2 });
        var xoaBody = 'ln|' + v + '² + ' + xoaASq + '|';
        var resultXoa = foldCoeff(halfXoa, xoaBody);

        var xoaS = ['∫ ' + originalTerm + ' d' + v];
        xoaS.push('u = ' + v + '² + ' + xoaASq + ',  du = 2' + v + ' d' + v);
        xoaS.push('= ' + resultXoa);
        return { result: resultXoa, steps: xoaS };
    }

    if (termObj.type === 'xOverSqrtX2PlusA') {
        var xos = termObj.a;
        var xosCoeff = toFrac(termObj.coeff);
        var xosASq = xos.aSqDisp;
        var xosBody = '√(' + v + '² + ' + xosASq + ')';
        var resultXos = foldCoeff(xosCoeff, xosBody);

        var xosS = ['∫ ' + originalTerm + ' d' + v];
        xosS.push('u = ' + v + '² + ' + xosASq + ',  du = 2' + v + ' d' + v);
        xosS.push('= ' + resultXos);
        return { result: resultXos, steps: xosS };
    }

    if (termObj.type === 'trig') {
        var trigKey = termObj.power === 2 ? termObj.fn + '2' : termObj.fn;
        var rule = TRIG_ANTIDERIVATIVES[trigKey];

        if (!rule) {
            if (termObj.power === 1) {
                var LOG_TRIG = {
                    tan: 'ln|sec(' + v + ')|',
                    cot: 'ln|sin(' + v + ')|',
                    sec: 'ln|sec(' + v + ')+tan(' + v + ')|',
                    csc: 'ln|csc(' + v + ')-cot(' + v + ')|'
                };
                var logBody = LOG_TRIG[termObj.fn];
                if (logBody) {
                    var ltCoeff = toFrac(termObj.coeff);
                    var ltCoeffStr = fracStr(ltCoeff);
                    var ltResult;
                    if (ltCoeff.num === 1 && ltCoeff.den === 1) ltResult = logBody;
                    else if (ltCoeff.num === -1 && ltCoeff.den === 1) ltResult = '-' + logBody;
                    else ltResult = ltCoeffStr + logBody;
                    var ltS = ['∫ ' + originalTerm + ' d' + v];
                    ltS.push('= ' + ltResult);
                    return { result: ltResult, steps: ltS };
                }
            }
            return null;
        }

        var isSym = isSymbolCoeff(termObj.coeff);
        var tCoeffFrac = isSym ? null : toFrac(termObj.coeff);
        var tCoeffStr = isSym ? termObj.coeff : fracStr(tCoeffFrac);
        var outCoeffStr, outSign = rule.flip ? -1 : 1;
        if (isSym) {
            outCoeffStr = outSign === -1 ? mulSymbolByFrac(termObj.coeff, { num: -1, den: 1 }) : termObj.coeff;
        } else {
            var outFrac = outSign === -1 ? multFrac(tCoeffFrac, { num: -1, den: 1 }) : tCoeffFrac;
            outCoeffStr = fracStr(outFrac);
        }
        var resultBody = rule.name + v;
        var isOne = outCoeffStr === '1' || outCoeffStr === '';
        var isNegOne = outCoeffStr === '-1';
        var resultStr = isOne ? resultBody : (isNegOne ? '-' + resultBody : outCoeffStr + resultBody);
        var s = ['∫ ' + originalTerm + ' d' + v];
        s.push('= ' + resultStr);
        return { result: resultStr, steps: s };
    }

    if (termObj.type === 'exp') {
        var eA_ = termObj.a, eB_ = termObj.b;
        var eCoeff_ = toFrac(termObj.coeff);
        var eAIsSym_ = typeof eA_ === 'string';
        var eArgDisplay_;
        if (eAIsSym_) {
            var eSymNeg_ = eA_.startsWith('-');
            var eSymBase_ = eA_.replace(/^-/, '');
            eArgDisplay_ = (eSymNeg_ ? '-' : '') + eSymBase_ + v;
            if (eB_ !== '0') eArgDisplay_ += (eB_.startsWith('-') ? eB_ : '+' + eB_);
        } else {
            var eANum_ = eA_.num, eADen_ = eA_.den;
            var eVAbs_ = Math.abs(eANum_);
            var eNeg_ = eANum_ < 0;
            var eVPart_;
            if (eVAbs_ === 1 && eADen_ === 1) eVPart_ = v;
            else if (eADen_ === 1) eVPart_ = eVAbs_ + v;
            else if (eVAbs_ === 1) eVPart_ = v + '/' + eADen_;
            else eVPart_ = fracHTML(eVAbs_, eADen_) + v;
            eArgDisplay_ = (eNeg_ ? '-' : '') + eVPart_;
            if (eB_ !== '0') eArgDisplay_ += (eB_.startsWith('-') ? eB_ : '+' + eB_);
        }
        var eDisplay_ = (eArgDisplay_ === v) ? 'e^' + v : 'e^(' + eArgDisplay_ + ')';
        if (eAIsSym_) {
            var eSymNeg2_ = eA_.startsWith('-');
            var eSymBase2_ = eA_.replace(/^-/, '');
            var eSymPrefix_;
            if (eSymNeg2_) {
                if (eCoeff_.num === 1 && eCoeff_.den === 1) eSymPrefix_ = '-(1/' + eSymBase2_ + ')';
                else if (eCoeff_.num === -1 && eCoeff_.den === 1) eSymPrefix_ = '(1/' + eSymBase2_ + ')';
                else eSymPrefix_ = '-' + fracStr(eCoeff_) + '(1/' + eSymBase2_ + ')';
            } else {
                if (eCoeff_.num === 1 && eCoeff_.den === 1) eSymPrefix_ = '(1/' + eSymBase2_ + ')';
                else eSymPrefix_ = fracStr(eCoeff_) + '(1/' + eSymBase2_ + ')';
            }
            var eSymResult_ = eSymPrefix_ + eDisplay_;
            var eSymS_ = ['∫ ' + originalTerm + ' d' + v];
            eSymS_.push('= ' + eSymResult_);
            return { result: eSymResult_, steps: eSymS_ };
        }
        var eResultCoeffFrac_ = divFrac(eCoeff_, eA_);
        var eCoeffStr_ = fracStr(eResultCoeffFrac_);
        var eResultStr_;
        if (eResultCoeffFrac_.num === 1 && eResultCoeffFrac_.den === 1) eResultStr_ = eDisplay_;
        else if (eResultCoeffFrac_.num === -1 && eResultCoeffFrac_.den === 1) eResultStr_ = '-' + eDisplay_;
        else eResultStr_ = eCoeffStr_ + '·' + eDisplay_;
        var eS_ = ['∫ ' + originalTerm + ' d' + v];
        eS_.push('= ' + eResultStr_);
        return { result: eResultStr_, steps: eS_ };
    }

    if (termObj.type === 'trigProd') {
        var ppCoeffFrac = toFrac(termObj.coeff);
        var ppFlip = termObj.fn === 'csc';
        var ppOutFrac = ppFlip ? multFrac(ppCoeffFrac, { num: -1, den: 1 }) : ppCoeffFrac;
        var ppCoeffStr = fracStr(ppOutFrac);
        var ppBody = termObj.fn + v;
        var ppIsOne = ppCoeffStr === '1';
        var ppIsNegOne = ppCoeffStr === '-1';
        var ppResult = ppIsOne ? ppBody : (ppIsNegOne ? '-' + ppBody : ppCoeffStr + ppBody);
        var sp = ['∫ ' + originalTerm + ' d' + v];
        sp.push('= ' + ppResult);
        return { result: ppResult, steps: sp };
    }

    if (termObj.type === 'secCscHalfSq') {
        var hsFlip = termObj.fn === 'csc';
        var hsResultFn = termObj.fn === 'sec' ? 'tan' : 'cot';
        var hsCoeffFrac = toFrac(termObj.coeff);
        var hsOutFrac = multFrac(hsCoeffFrac, { num: hsFlip ? -2 : 2, den: 1 });
        var hsCoeffStr = fracStr(hsOutFrac);
        var hsBody = hsResultFn + '(' + v + '/2)';
        var hsResult = (hsOutFrac.num === 1 && hsOutFrac.den === 1) ? hsBody :
            (hsOutFrac.num === -1 && hsOutFrac.den === 1) ? '-' + hsBody :
            hsCoeffStr + hsBody;
        var hsS = ['∫ ' + originalTerm + ' d' + v];
        hsS.push('u = ' + v + '/2,  du = (1/2) d' + v);
        hsS.push('= ' + hsResult);
        return { result: hsResult, steps: hsS };
    }

    if (termObj.type === 'ln') {
        var lA_ = termObj.a, lB_ = termObj.b;
        var lCoeff_ = toFrac(termObj.coeff);
        var lAIsSym_ = typeof lA_ === 'string';
        var lArgDisplay_;
        if (lAIsSym_) {
            var lSymNeg_ = lA_.startsWith('-');
            var lSymBase_ = lA_.replace(/^-/, '');
            lArgDisplay_ = (lSymNeg_ ? '-' : '') + lSymBase_ + v;
            if (lB_ !== '0') lArgDisplay_ += (lB_.startsWith('-') ? lB_ : '+' + lB_);
        } else {
            var lANum_ = lA_.num, lADen_ = lA_.den;
            var lVAbs_ = Math.abs(lANum_);
            var lNeg_ = lANum_ < 0;
            var lVPart_;
            if (lVAbs_ === 1 && lADen_ === 1) lVPart_ = v;
            else if (lADen_ === 1) lVPart_ = lVAbs_ + v;
            else if (lVAbs_ === 1) lVPart_ = v + '/' + lADen_;
            else lVPart_ = fracHTML(lVAbs_, lADen_) + v;
            lArgDisplay_ = (lNeg_ ? '-' : '') + lVPart_;
            if (lB_ !== '0') lArgDisplay_ += (lB_.startsWith('-') ? lB_ : '+' + lB_);
        }
        var lArgParen_ = '(' + lArgDisplay_ + ')';
        var lLnTerm_ = 'ln(' + lArgDisplay_ + ')';
        var lInner_ = lArgParen_ + '·' + lLnTerm_ + ' - ' + lArgParen_;
        if (lAIsSym_) {
            var lSymBase2_ = lA_.replace(/^-/, '');
            var lSymNeg2_ = lA_.startsWith('-');
            var lSymPrefix_;
            if (lSymNeg2_) {
                if (lCoeff_.num === 1 && lCoeff_.den === 1) lSymPrefix_ = '-(1/' + lSymBase2_ + ')';
                else if (lCoeff_.num === -1 && lCoeff_.den === 1) lSymPrefix_ = '(1/' + lSymBase2_ + ')';
                else lSymPrefix_ = '-' + fracStr(lCoeff_) + '(1/' + lSymBase2_ + ')';
            } else {
                if (lCoeff_.num === 1 && lCoeff_.den === 1) lSymPrefix_ = '(1/' + lSymBase2_ + ')';
                else lSymPrefix_ = fracStr(lCoeff_) + '(1/' + lSymBase2_ + ')';
            }
            var lResultSym_ = lSymPrefix_ + '(' + lInner_ + ')';
            var lSymS_ = ['∫ ' + originalTerm + ' d' + v];
            lSymS_.push('= ' + lResultSym_);
            return { result: lResultSym_, steps: lSymS_ };
        }
        var lOneOverA_ = { num: lA_.den, den: lA_.num };
        var lTotalFrac_ = multFrac(lCoeff_, lOneOverA_);
        var lTotalStr_ = fracStr(lTotalFrac_);
        var lResult_;
        if (lTotalFrac_.num === 1 && lTotalFrac_.den === 1) lResult_ = lInner_;
        else if (lTotalFrac_.num === -1 && lTotalFrac_.den === 1) lResult_ = '-' + lInner_;
        else lResult_ = lTotalStr_ + '(' + lInner_ + ')';
        var lS_ = ['∫ ' + originalTerm + ' d' + v];
        lS_.push('= ' + lResult_);
        return { result: lResult_, steps: lS_ };
    }

    if (termObj.type === 'constant') {
        if (isSymbolCoeff(termObj.coeff)) {
            var symC = termObj.coeff;
            var sC = ['∫ ' + originalTerm + ' d' + v];
            var resC = symC + v;
            sC.push('= ' + resC);
            return { result: resC, steps: sC };
        }
        var c = toFrac(termObj.coeff);
        var s = ['∫ ' + originalTerm + ' d' + v];
        var cStr = fracStr(c);
        if (c.num === 1 && c.den === 1) s.push('= ' + v);
        else if (c.num === -1 && c.den === 1) s.push('= -' + v);
        else s.push('= ' + cStr + v);
        var res = (c.num === 1 && c.den === 1 ? v : (c.num === -1 && c.den === 1 ? '-' + v : cStr + v));
        return { result: res, steps: s };
    }

    if (termObj.type === 'trigLinear') {
        var tlA = termObj.a, tlB = termObj.b, tlFn = termObj.fn, tlCoeffFrac = toFrac(termObj.coeff);
        var tlAIsSym = typeof tlA === 'string';
        var tlAAbs = tlAIsSym ? tlA.replace(/^-/, '') : { num: Math.abs(tlA.num), den: tlA.den };
        var tlANeg = tlAIsSym ? tlA.startsWith('-') : tlA.num < 0;
        var tlVPart;
        if (tlAIsSym) tlVPart = tlAAbs + v;
        else if (tlAAbs.num === tlAAbs.den) tlVPart = v;
        else if (tlAAbs.den === 1) tlVPart = tlAAbs.num + v;
        else if (tlAAbs.num === 1) tlVPart = v + '/' + tlAAbs.den;
        else tlVPart = fracHTML(tlAAbs.num, tlAAbs.den) + v;
        var tlBDisplay = tlB === '0' ? '' : (tlB.startsWith('-') ? tlB : '+' + tlB);
        var tlVPartSigned = (tlANeg ? '-' + tlVPart : tlVPart);
        var tlArgDisplay;
        if (termObj.constFirst) {
            var tlConstPart = tlB === '0' ? '' : tlB.replace(/^-/, '');
            var tlJoinSign = tlANeg ? '-' : '+';
            tlArgDisplay = tlConstPart + tlJoinSign + tlVPart + (termObj.degrees ? '°' : '');
        } else {
            tlArgDisplay = termObj.degrees
                ? tlVPartSigned + '°' + tlBDisplay
                : tlVPartSigned + tlBDisplay;
        }
        tlArgDisplay = tlArgDisplay.replace(/\+-/g, '-');
        var tlDivCoeffStr;
        if (tlAIsSym) tlDivCoeffStr = tlA;
        else if (termObj.degrees) tlDivCoeffStr = (tlA.num === tlA.den ? '' : fracStr(tlA)) + 'π/180';
        else tlDivCoeffStr = fracStr(tlA);
        var tlResultFn = tlFn === 'sin' ? 'cos' : 'sin';
        var tlFlip = tlFn === 'sin';
        var tlBaseTerm = tlResultFn + '(' + tlArgDisplay + ')';
        var tlS = ['∫ ' + originalTerm + ' d' + v];
        if (tlAIsSym) {
            var tlAIsNegSym = tlA.startsWith('-');
            var tlABase = tlA.replace(/^-/, '');
            var tlOverallNeg = tlFlip !== tlAIsNegSym;
            var tlSymCoeffPrefix = (tlCoeffFrac.num === 1 && tlCoeffFrac.den === 1) ? '' :
                (tlCoeffFrac.num === -1 && tlCoeffFrac.den === 1 ? '-' : fracStr(tlCoeffFrac));
            var tlResultSym = (tlOverallNeg ? '-' : '') + tlSymCoeffPrefix + '(1/' + tlABase + ')' + tlBaseTerm;
            tlS.push('u = ' + tlArgDisplay + ',  du = ' + tlA + ' d' + v);
            tlS.push('= ' + tlResultSym);
            return { result: tlResultSym, steps: tlS };
        }
        tlS.push('u = ' + tlArgDisplay + ',  du = ' + tlDivCoeffStr + ' d' + v);
        var tlResultStr;
        if (termObj.degrees) {
            var tlDegCoeffPart = (tlA.num === tlA.den ? '' : fracStr(tlA));
            var tlOutCoeff = tlCoeffFrac.num === 1 && tlCoeffFrac.den === 1 ? '' : fracStr(tlCoeffFrac);
            var tlDegFactor = '(180' + (tlDegCoeffPart ? '/' + tlDegCoeffPart : '') + '/π)';
            tlResultStr = (tlFlip ? '-' : '') + (tlOutCoeff || '') + tlDegFactor + tlBaseTerm;
        } else {
            var tlNewCoeffFrac = divFrac(tlCoeffFrac, tlA);
            if (tlFlip) tlNewCoeffFrac = multFrac(tlNewCoeffFrac, { num: -1, den: 1 });
            var tlNewCoeffStr = fracStr(tlNewCoeffFrac);
            if (tlNewCoeffFrac.num === 1 && tlNewCoeffFrac.den === 1) tlResultStr = tlBaseTerm;
            else if (tlNewCoeffFrac.num === -1 && tlNewCoeffFrac.den === 1) tlResultStr = '-' + tlBaseTerm;
            else tlResultStr = tlNewCoeffStr + tlBaseTerm;
        }
        tlS.push('= ' + tlResultStr);
        return { result: tlResultStr, steps: tlS };
    }

    if (termObj.type === 'linearPower') {
        var lAFrac = toFrac(termObj.a), lB = termObj.b, lPowerFrac = toFrac(termObj.power);
        var lAIsNeg = lAFrac.num < 0;
        var lAAbsNum = Math.abs(lAFrac.num), lAAbsDen = lAFrac.den;
        var lVPart;
        if (lAAbsNum === lAAbsDen) lVPart = v;
        else if (lAAbsNum === 1) lVPart = v + '/' + lAAbsDen;
        else if (lAAbsDen === 1) lVPart = lAAbsNum + v;
        else lVPart = fracHTML(lAAbsNum, lAAbsDen) + v;
        var lLinDisplay = lAIsNeg
            ? (lB === 0 ? '-' + lVPart : lB + '-' + lVPart)
            : lVPart + (lB === 0 ? '' : (lB > 0 ? '+' + lB : lB));
        var lCoeff = toFrac(termObj.coeff);
        var lDuStr = (lAFrac.den === 1 ? lAFrac.num : fracStr(lAFrac)) + ' d' + v;
        if (lPowerFrac.num + lPowerFrac.den === 0) {
            var lnLinTerm = 'ln|' + lLinDisplay + '|';
            var lnCoeffFrac = divFrac(lCoeff, lAFrac);
            var lnCoeffStr = fracStr(lnCoeffFrac);
            var lnResultStr = (lnCoeffFrac.num === 1 && lnCoeffFrac.den === 1) ? lnLinTerm :
                (lnCoeffFrac.num === -1 && lnCoeffFrac.den === 1) ? '-' + lnLinTerm :
                lnCoeffStr + lnLinTerm;
            var lnS = ['∫ ' + originalTerm + ' d' + v];
            lnS.push('u = ' + lLinDisplay + ',  du = ' + lDuStr);
            lnS.push('= ' + lnResultStr);
            return { result: lnResultStr, steps: lnS };
        }
        var lNewPowerFrac = simpFrac({ num: lPowerFrac.num + lPowerFrac.den, den: lPowerFrac.den });
        var lDivisorFrac = multFrac(lNewPowerFrac, lAFrac);
        var lNewCoeffFrac = divFrac(lCoeff, lDivisorFrac);
        var lNewPowerDisplay = expHTML(lNewPowerFrac);
        var lNewCoeffStr = fracStr(lNewCoeffFrac);
        var lBaseDisplay = '(' + lLinDisplay + ')';
        var lS = ['∫ ' + originalTerm + ' d' + v];
        lS.push('u = ' + lLinDisplay + ',  du = ' + lDuStr);
        var lResultStr;
        if (lNewCoeffFrac.num === 1 && lNewCoeffFrac.den === 1) lResultStr = lBaseDisplay + lNewPowerDisplay;
        else if (lNewCoeffFrac.num === -1 && lNewCoeffFrac.den === 1) lResultStr = '-' + lBaseDisplay + lNewPowerDisplay;
        else lResultStr = lNewCoeffStr + lBaseDisplay + lNewPowerDisplay;
        lS.push('= ' + lResultStr);
        return { result: lResultStr, steps: lS };
    }

    if (termObj.type === 'power') {
        var power = termObj.power;
        var powerFrac = toFrac(power);
        if (isSymbolCoeff(termObj.coeff)) {
            var symCoeff = termObj.coeff;
            var s2 = ['∫ ' + originalTerm + ' d' + v];
            if (powerFrac.num + powerFrac.den === 0) {
                var lnTerm2 = 'ln|' + v + '|';
                var resultStr2 = symCoeff + lnTerm2;
                s2.push('= ' + resultStr2);
                return { result: resultStr2, steps: s2 };
            }
            var newPowerFrac2 = simpFrac({ num: powerFrac.num + powerFrac.den, den: powerFrac.den });
            var newSymCoeff = divSymbolByFrac(symCoeff, newPowerFrac2);
            var newPowerDisplay2 = expHTML(newPowerFrac2);
            var newPowerDivisor2 = fracHTML(newPowerFrac2.num, newPowerFrac2.den);
            s2.push('= ' + symCoeff + ' · ' + v + newPowerDisplay2 + '/' + newPowerDivisor2);
            var resultStr3 = newSymCoeff + v + newPowerDisplay2;
            s2.push('= ' + resultStr3);
            return { result: resultStr3, steps: s2 };
        }
        var coeff = toFrac(termObj.coeff);
        if (powerFrac.num + powerFrac.den === 0) {
            var s0 = ['∫ ' + originalTerm + ' d' + v];
            var coeffStr0 = fracStr(coeff);
            var lnTerm = 'ln|' + v + '|';
            var resultStr0 = (coeff.num === 1 && coeff.den === 1) ? lnTerm :
                (coeff.num === -1 && coeff.den === 1) ? '-' + lnTerm :
                coeffStr0 + lnTerm;
            s0.push('= ' + resultStr0);
            return { result: resultStr0, steps: s0 };
        }
        var newPowerFrac = simpFrac({ num: powerFrac.num + powerFrac.den, den: powerFrac.den });
        var newCoeff = divFrac(coeff, newPowerFrac);
        var s = ['∫ ' + originalTerm + ' d' + v];
        var coeffStr = fracStr(coeff);
        var newPowerDisplay = expHTML(newPowerFrac);
        var newPowerDivisor = fracHTML(newPowerFrac.num, newPowerFrac.den);
        var newCoeffStr = fracStr(newCoeff);
        if (newCoeff.num === 1 && newCoeff.den === 1) s.push('= ' + v + newPowerDisplay + '/' + newPowerDivisor);
        else {
            s.push('= ' + coeffStr + ' · ' + v + newPowerDisplay + '/' + newPowerDivisor);
            s.push('= ' + newCoeffStr + v + newPowerDisplay);
        }
        var resultStr = newCoeffStr + v + newPowerDisplay;
        if (newCoeff.num === 1 && newCoeff.den === 1) resultStr = v + newPowerDisplay;
        if (newCoeff.num === -1 && newCoeff.den === 1) resultStr = '-' + v + newPowerDisplay;
        return { result: resultStr, steps: s };
    }
    return null;
}

    var terms = [], current = '', depth = 0;
    for (var i = 0; i < expr.length; i++) {
        var ch = expr[i];
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if ((ch === '+' || ch === '-') && depth === 0 && i > 0 && current.length > 0) { terms.push(current.trim()); current = ch; }
        else { current += ch; }
    }
    if (current.trim()) terms.push(current.trim());

    if (terms.length > 1) {
        var combinedTerms = intCombineLikeTerms(terms, v, parseTerm);
        if (combinedTerms.length < terms.length) {
            steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">Combine like terms</div></div>');
            var combinedDisplay = combinedTerms.length === 0 ? '0' : fmtDisplay(intFormatCombinedTerms(combinedTerms));
            steps.push('<div class="xetex-indent">= ' + combinedDisplay + '</div>');
            stepNum++;
            terms = combinedTerms;
        }
    }

    if (terms.length === 0) {
        steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">C</span></div>');
        steps.push('<div class="xetex-note">∫ 0 dx = C</div>');
        steps.push('</div>');
        return steps.join('');
    }

    var allResults = [];

    if (terms.length > 1) {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">Split the integral</div></div>');
        var splitLine = '';
        for (var i = 0; i < terms.length; i++) {
            if (i > 0) splitLine += ' + ';
            splitLine += '∫ ' + fmtDisplay(terms[i].replace(/^\+\s*/, '')) + ' d' + v;
        }
        steps.push('<div class="xetex-indent">= ' + splitLine + '</div>');
        stepNum++;
    }

    for (var i = 0; i < terms.length; i++) {
        var term = terms[i], parsed = parseTerm(term);
        if (!parsed) { steps.push('<div class="xetex-note">Cannot understand: ' + term + '</div>'); continue; }
        var displayTerm = fmtDisplay(term.replace(/^\+\s*/, ''));
        var integrated = integrateTerm(parsed, displayTerm);
        if (integrated) {
            steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">' + integrated.steps[0] + '</div></div>');
            for (var j = 1; j < integrated.steps.length; j++) {
                steps.push('<div class="xetex-indent">' + integrated.steps[j] + '</div>');
            }
            stepNum++; allResults.push(integrated.result);
        } else {
            steps.push('<div class="xetex-note">Cannot integrate this term yet: ' + displayTerm + '</div>');
        }
    }

    if (allResults.length < terms.length) {
        steps.push('<div class="xetex-note">Cannot integrate this yet.</div>');
        steps.push('</div>'); return steps.join('');
    }

    if (allResults.length === 0) {
        steps.push('<div class="xetex-note">Cannot integrate this yet.</div>');
        steps.push('</div>'); return steps.join('');
    }

    var finalAnswer = allResults.join(' + ').replace(/\+\s+-/g, '- ') + ' + C';

    if (allResults.length > 1) {
        steps.push('<div class="xetex-step"><div class="xetex-step-num">' + stepNum + '</div><div class="xetex-step-body">Add the constant</div></div>');
    }
    steps.push('<div class="xetex-indent">= ' + finalAnswer + '</div>');
    steps.push('<div class="xetex-answer"><span class="xetex-answer-label">Answer</span><span class="xetex-answer-val">' + finalAnswer + '</span></div>');
    steps.push('</div>'); return steps.join('');
}

function expandBinomials(left, right, v) {
    var lTerms = parsePolynomial(left, v), rTerms = parsePolynomial(right, v);
    if (!lTerms || !rTerms) return null;
    var result = {}, order = [];
    for (var i = 0; i < lTerms.length; i++)
        for (var j = 0; j < rTerms.length; j++) {
            var coeff = lTerms[i].coeff * rTerms[j].coeff;
            var power = addPowers(lTerms[i].power, rTerms[j].power);
            var key = powerKey(power);
            if (!(key in result)) { result[key] = { power: power, coeff: 0 }; order.push(key); }
            result[key].coeff += coeff;
        }
    return formatPolynomial(result, order, v);
}

function distribute(outer, inner, v) {
    var outerTerm = parseTermPoly(outer, v);
    if (!outerTerm) return null;
    var innerTerms = parsePolynomial(inner, v);
    if (!innerTerms) return null;
    var result = {}, order = [];
    for (var i = 0; i < innerTerms.length; i++) {
        var coeff = outerTerm.coeff * innerTerms[i].coeff;
        var power = addPowers(outerTerm.power, innerTerms[i].power);
        var key = powerKey(power);
        if (!(key in result)) { result[key] = { power: power, coeff: 0 }; order.push(key); }
        result[key].coeff += coeff;
    }
    return formatPolynomial(result, order, v);
}

function toFracPower(p) {
    if (typeof p === 'object') return p;
    return { num: p, den: 1 };
}
function addPowers(a, b) {
    var fa = toFracPower(a), fb = toFracPower(b);
    var num = fa.num * fb.den + fb.num * fa.den, den = fa.den * fb.den;
    var g = gcdPoly(Math.abs(num), den);
    if (g) { num /= g; den /= g; }
    return den === 1 ? num : { num: num, den: den };
}
function gcdPoly(a, b) { return b === 0 ? a : gcdPoly(b, a % b); }
function powerKey(p) {
    return typeof p === 'object' ? (p.num + '/' + p.den) : String(p);
}
function powerSortValue(p) {
    return typeof p === 'object' ? p.num / p.den : p;
}
function formatPowerSuffix(p) {
    if (typeof p === 'object') return '^(' + p.num + '/' + p.den + ')';
    if (p === 1) return '';
    if (p < 0) return '^(' + p + ')';
    return '^' + p;
}

function formatPolynomial(obj, order, v) {
    var keys = order ? order.slice() : Object.keys(obj);
    keys.sort(function(ka, kb) { return powerSortValue(obj[kb].power) - powerSortValue(obj[ka].power); });
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
        var entry = obj[keys[i]], p = entry.power, c = entry.coeff;
        if (Math.abs(c) < 0.0001) continue;
        var term = '';
        if (p === 0) term = '' + Math.abs(c);
        else term = (Math.abs(c) === 1 ? '' : Math.abs(c)) + v + formatPowerSuffix(p);
        if (parts.length === 0) parts.push((c < 0 ? '-' : '') + term);
        else parts.push((c >= 0 ? '+ ' : '- ') + term);
    }
    return parts.join(' ');
}

function tryDividePolynomials(numStr, denStr, v) {
    var num = parsePolynomial(numStr, v), den = parsePolynomial(denStr, v);
    if (!num || !den || den.length !== 2) return null;
    var root = null;
    if (den[0].power === 1 && den[1].power === 0) { root = -den[1].coeff / den[0].coeff; }
    if (root === null) return null;
    var result = [], carry = 0;
    num.sort(function(a, b) { return b.power - a.power; });
    for (var p = num[0].power; p >= 0; p--) {
        var coeff = 0;
        for (var i = 0; i < num.length; i++) { if (num[i].power === p) { coeff = num[i].coeff; break; } }
        coeff += carry; result.push({ coeff: coeff, power: p - 1 }); carry = coeff * root;
    }
    if (result.length > 0 && result[result.length - 1].power === -1 && Math.abs(result[result.length - 1].coeff) < 0.0001) result.pop();
    while (result.length > 0 && Math.abs(result[0].coeff) < 0.0001) result.shift();
    if (result.length === 0) return null;
    return formatPolynomialFromArray(result, v);
}

function formatPolynomialFromArray(arr, v) {
    var parts = [];
    for (var i = 0; i < arr.length; i++) {
        var c = arr[i].coeff, p = arr[i].power;
        if (Math.abs(c) < 0.0001) continue;
        var term = '';
        if (p === 0) term = '' + Math.abs(c);
        else if (p === 1) term = (Math.abs(c) === 1 ? '' : Math.abs(c)) + v;
        else term = (Math.abs(c) === 1 ? '' : Math.abs(c)) + v + (p < 0 ? '^(' + p + ')' : '^' + p);
        if (parts.length === 0) parts.push((c < 0 ? '-' : '') + term);
        else parts.push((c >= 0 ? '+ ' : '- ') + term);
    }
    return parts.join(' ');
}

function parsePolynomial(str, v) {
    var vEsc = escapeRegExp(v);
    str = str.replace(/\s/g, '');
    var terms = [], current = '', depth = 0;
    for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if ((ch === '+' || ch === '-') && depth === 0 && i > 0 && current.length > 0) {
            var parsed = parseTermPoly(current, v); if (parsed) terms.push(parsed);
            current = ch;
        } else { current += ch; }
    }
    if (current.length > 0) { var parsed = parseTermPoly(current, v); if (parsed) terms.push(parsed); }
    return terms.length > 0 ? terms : null;
}

function parseTermPoly(term, v) {
    var vEsc = escapeRegExp(v);
    term = term.trim(); if (!term) return null;
    var sign = 1;
    if (term.startsWith('+')) term = term.substring(1);
    else if (term.startsWith('-')) { sign = -1; term = term.substring(1); }
    term = term.trim();

    var radMatch = term.match(new RegExp('^(\\d*)(√|∛)\\(?' + vEsc + '\\)?$'));
    if (radMatch) {
        var rc = radMatch[1] === '' ? 1 : parseInt(radMatch[1]);
        var rp = radMatch[2] === '√' ? { num: 1, den: 2 } : { num: 1, den: 3 };
        return { coeff: sign * rc, power: rp };
    }

    if (/^\d+$/.test(term)) return { coeff: sign * parseInt(term), power: 0 };
    if (term === v) return { coeff: sign * 1, power: 1 };

    var fracPowMatch = term.match(new RegExp('^(\\d*)' + vEsc + '\\^\\((-?\\d+)/(\\d+)\\)$'));
    if (fracPowMatch) {
        var fc = fracPowMatch[1] === '' ? 1 : parseInt(fracPowMatch[1]);
        var fp = { num: parseInt(fracPowMatch[2]), den: parseInt(fracPowMatch[3]) };
        var g = gcdPoly(Math.abs(fp.num), fp.den);
        if (g) { fp.num /= g; fp.den /= g; }
        if (fp.den === 1) return { coeff: sign * fc, power: fp.num };
        return { coeff: sign * fc, power: fp };
    }

    var decPowMatch = term.match(new RegExp('^(\\d*)' + vEsc + '\\^\\(?(-?\\d+\\.\\d+)\\)?$'));
    if (decPowMatch) {
        var dc = decPowMatch[1] === '' ? 1 : parseInt(decPowMatch[1]);
        var decStr = decPowMatch[2];
        var neg = decStr.startsWith('-'); if (neg) decStr = decStr.slice(1);
        var parts = decStr.split('.');
        var den = Math.pow(10, parts[1] ? parts[1].length : 0);
        var num = parseInt(parts.join(''), 10);
        var g2 = gcdPoly(num, den);
        if (g2) { num /= g2; den /= g2; }
        if (neg) num = -num;
        if (den === 1) return { coeff: sign * dc, power: num };
        return { coeff: sign * dc, power: { num: num, den: den } };
    }

    var match = term.match(new RegExp('^(\\d*)' + vEsc + '\\^\\(?(-?\\d+)\\)?$'));
    if (match) return { coeff: sign * (match[1] === '' ? 1 : parseInt(match[1])), power: parseInt(match[2]) };
    match = term.match(new RegExp('^(\\d*)' + vEsc + '(\\d+)$'));
    if (match) return { coeff: sign * (match[1] === '' ? 1 : parseInt(match[1])), power: parseInt(match[2]) };
    match = term.match(new RegExp('^(\\d+)' + vEsc + '$'));
    if (match) return { coeff: sign * parseInt(match[1]), power: 1 };
    return null;
}

window.solveIntegration = solveIntegration;