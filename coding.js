// coding.js — C code analyzer

function cesc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ccodeCard(fileType, escapedBody, className) {
    className = className || 'cparse-code';
    return '<div class="code-card">' +
        '<div class="code-card-header">' +
            '<span class="code-card-type">' + cesc(fileType) + '</span>' +
            '<button type="button" class="code-card-copy" onclick="codeCardCopy(this)">' +
                '<span class="icon icon-copy"></span>' +
                '<span class="code-card-copy-label">Copy</span>' +
            '</button>' +
        '</div>' +
        '<pre class="' + className + '">' + escapedBody + '</pre>' +
    '</div>';
}

function isCCode(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    if (!t) return false;
    if (t.length < 15 || t.length > 40000) return false;
    if (/^\/c\b/m.test(t)) return true;
    if (/#\s*include\s*[<"]/.test(t)) return true;
    if (/\b(int|void|float|double)\s+main\s*\(/.test(t)) return true;
    var lines = t.split('\n');
    if (lines.length >= 3) {
        var semis = (t.match(/;/g) || []).length;
        var braces = (t.match(/[{}]/g) || []).length;
        if (semis >= 2 && braces >= 2) return true;
    }
    return false;
}

function clexLines(text) {
    text = text.replace(/\r\n/g, '\n');
    var lines = [];
    var state = 'normal';
    var bcStart = 0, strStart = 0;
    var srcLines = text.split('\n');

    for (var li = 0; li < srcLines.length; li++) {
        var raw = srcLines[li];
        var cleaned = '';
        var i = 0;
        while (i < raw.length) {
            var ch = raw[i], next = raw[i + 1];
            if (state === 'normal') {
                if (ch === '/' && next === '/') { cleaned += ' '.repeat(raw.length - i); i = raw.length; break; }
                if (ch === '/' && next === '*') { state = 'blockcomment'; bcStart = li + 1; cleaned += '  '; i += 2; continue; }
                if (ch === '"') { state = 'string'; strStart = li + 1; cleaned += ' '; i++; continue; }
                if (ch === "'") { state = 'char';   strStart = li + 1; cleaned += ' '; i++; continue; }
                if (ch === '#' && /^\s*#/.test(raw)) { cleaned += raw.slice(i); i = raw.length; break; }
                cleaned += ch; i++;
            } else if (state === 'blockcomment') {
                if (ch === '*' && next === '/') { state = 'normal'; cleaned += '  '; i += 2; }
                else { cleaned += ' '; i++; }
            } else if (state === 'string') {
                if (ch === '\\' && next) { cleaned += '  '; i += 2; }
                else if (ch === '"') { state = 'normal'; cleaned += ' '; i++; }
                else { cleaned += ' '; i++; }
            } else if (state === 'char') {
                if (ch === '\\' && next) { cleaned += '  '; i += 2; }
                else if (ch === "'") { state = 'normal'; cleaned += ' '; i++; }
                else { cleaned += ' '; i++; }
            }
        }
        lines.push({ lineNum: li + 1, raw: raw, cleaned: cleaned });
    }

    return {
        lines: lines,
        unclosedBlockComment: state === 'blockcomment' ? bcStart : 0,
        unclosedString: (state === 'string' || state === 'char') ? strStart : 0
    };
}

function cfindNextNonBlank(lex, startIdx) {
    for (var i = startIdx; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (t && !/^#/.test(t)) return lex.lines[i];
    }
    return null;
}
function cfindPrevNonBlank(lex, startIdx) {
    for (var i = startIdx; i >= 0; i--) {
        var t = lex.lines[i].cleaned.trim();
        if (t) return lex.lines[i];
    }
    return null;
}

var C_STMT_STARTERS = /^(?:if|else|for|while|switch|do|return|break|continue|goto|int|char|float|double|void|long|short|signed|unsigned|struct|union|enum|typedef|static|extern|const|volatile|register|#|\/\/|\/\*)\b/;

// ── Stray-brace diagnosis ─────────────────────────────────────────
function cdiagnoseStrayClose(lex, lineNum) {
    var idx = lineNum - 1;
    var prev1 = cfindPrevNonBlank(lex, idx - 1);
    if (!prev1) return null;
    var prev2 = cfindPrevNonBlank(lex, idx - 2);
    if (!prev2) return null;
    var p1 = prev1.cleaned.trim();
    var p2 = prev2.cleaned.trim();
    if (/;$/.test(p1) && /^(if|else\s+if|else|while|for)\b/.test(p2) && !/\{$/.test(p2)) {
        var kwMatch = p2.match(/^(if|else\s+if|else|while|for)/);
        var kw = kwMatch ? kwMatch[1] : 'control statement';
        return 'Stray "}" — the ' + kw + ' above has a single-statement body with no "{", so this "}" closes the surrounding block too early';
    }
    if (/^\}/.test(p1)) {
        return 'Stray "}" — the block above was already closed; this one has no opening "{"';
    }
    return null;
}

// ── Balance ────────────────────────────────────────────────────────
function ccheckBalance(lex) {
    var issues = [];
    var stack = [];
    var PAIRS = { ')': '(', ']': '[', '}': '{' };
    for (var li = 0; li < lex.lines.length; li++) {
        var ln = lex.lines[li];
        var t = ln.cleaned;
        if (/=\s*\{[^}]*$/.test(t.trim())) continue;
        for (var ci = 0; ci < t.length; ci++) {
            var ch = t[ci];
            if (ch === '(' || ch === '[' || ch === '{') stack.push({ ch: ch, line: ln.lineNum });
            else if (ch === ')' || ch === ']' || ch === '}') {
                var top = stack.pop();
                if (!top) {
                    var msg = (ch === '}') ? cdiagnoseStrayClose(lex, ln.lineNum) : null;
                    issues.push({ severity: 'error', line: ln.lineNum, type: 'unmatched-close',
                        message: msg || ("Unexpected '" + ch + "' — no matching '" + PAIRS[ch] + "'") });
                } else if (top.ch !== PAIRS[ch]) {
                    issues.push({ severity: 'error', line: ln.lineNum, type: 'mismatched-close',
                        message: "'" + ch + "' does not match '" + top.ch + "' opened on line " + top.line });
                }
            }
        }
    }
    for (var si = 0; si < stack.length; si++) {
        var u = stack[si];
        issues.push({ severity: 'error', line: u.line, type: 'unclosed-open',
            message: "'" + u.ch + "' opened here is never closed" });
    }
    return issues;
}

function ccheckUnclosedBraceAtEof(lex) {
    var issues = [];
    var stack = [];
    var PAIRS = { ')': '(', ']': '[', '}': '{' };
    for (var li = 0; li < lex.lines.length; li++) {
        var ln = lex.lines[li];
        var t = ln.cleaned;
        if (/=\s*\{[^}]*$/.test(t.trim())) continue;
        for (var ci = 0; ci < t.length; ci++) {
            var ch = t[ci];
            if (ch === '(' || ch === '[' || ch === '{') stack.push({ ch: ch, line: ln.lineNum, cleaned: t });
            else if (ch === ')' || ch === ']' || ch === '}') {
                var top = stack.pop();
                if (!top || top.ch !== PAIRS[ch]) { stack.length = 0; return issues; }
            }
        }
    }
    if (stack.length !== 1) return issues;
    var only = stack[0];
    if (only.ch !== '{') return issues;
    if (!/^\s*(?:[a-zA-Z_]\w*\s+|\*\s*)+[a-zA-Z_]\w*\s*\([^)]*\)\s*\{/.test(only.cleaned)) return issues;
    issues.push({ severity: 'error', line: only.line, type: 'unclosed-brace-eof',
        message: 'Missing "}" — function body opened here is never closed before end of file',
        fix: 'append-close-brace' });
    return issues;
}

// ── Struct/union/enum missing ; after } ───────────────────────────
function ccheckStructClosingSemi(lex) {
    var issues = [];
    var inStruct = 0;
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!t) continue;
        if (/^(typedef\s+)?(struct|union|enum)(\s+[a-zA-Z_]\w*)?\s*\{\s*$/.test(t)) { inStruct++; continue; }
        if (inStruct > 0 && /^\}/.test(t)) {
            inStruct--;
            if (/;/.test(t)) continue;
            var next = cfindNextNonBlank(lex, i + 1);
            if (next && /^;/.test(next.cleaned.trim())) continue;
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'struct-missing-semi',
                message: 'Missing ";" after struct/union/enum definition',
                fix: 'add-struct-semi' });
        }
    }
    return issues;
}

// ── #define with unbalanced parens ────────────────────────────────
function ccheckMalformedDefine(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var raw = lex.lines[i].raw.trim();
        if (!/^#\s*define\b/.test(raw)) continue;
        var o = (raw.match(/\(/g) || []).length;
        var c = (raw.match(/\)/g) || []).length;
        if (o !== c) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'malformed-define',
                message: 'Unbalanced parentheses in #define (' + o + ' "(" and ' + c + ' ")")' });
        }
    }
    return issues;
}

// ── Malformed #include ────────────────────────────────────────────
function ccheckMalformedIncludes(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var raw = lex.lines[i].raw.trim();
        if (!/^#\s*include\b/.test(raw)) continue;
        if (/^#\s*include\s*<[^>]*$/.test(raw)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'malformed-include',
                message: 'Malformed #include — missing ">" after the header name', fix: 'close-include' });
            continue;
        }
        if (/^#\s*include\s*"[^"]*$/.test(raw)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'malformed-include',
                message: 'Malformed #include — missing closing quote', fix: 'close-include' });
        }
    }
    return issues;
}

// ── Malformed function header ─────────────────────────────────────
function ccheckMalformedFunctionHeader(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!t) continue;
        var m = t.match(/^[a-zA-Z_]\w*(\s*\*)?\s+[a-zA-Z_]\w*\s*\(/);
        if (!m) continue;
        var startIdx = m[0].length;
        var depth = 1, j = startIdx, foundBrace = false, foundClose = false;
        while (j < t.length) {
            if (t[j] === '(') depth++;
            else if (t[j] === ')') { depth--; if (depth === 0) { foundClose = true; break; } }
            else if (t[j] === '{' && depth === 1) { foundBrace = true; break; }
            j++;
        }
        if (foundBrace && !foundClose) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'malformed-function-header',
                message: 'Malformed function header — "{" cannot appear inside the parameter list',
                fix: 'fix-malformed-header' });
        }
    }
    return issues;
}

// ── Control statement missing "(" ─────────────────────────────────
function ccheckControlMissingParen(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        var m = t.match(/^(if|while|for|switch)\s+([^\s(].*)$/);
        if (m) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'control-missing-paren',
                message: 'Missing "(" after "' + m[1] + '" — needs a parenthesized condition' });
        }
    }
    return issues;
}

// ── Missing ")" before "{" in controls ────────────────────────────
function ccheckControlParens(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!t) continue;
        var m = t.match(/^(if|for|while|switch)\s*\(/);
        if (!m) continue;
        var startIdx = m[0].length;
        var depth = 1, j = startIdx, foundBrace = false;
        while (j < t.length) {
            if (t[j] === '(') depth++;
            else if (t[j] === ')') depth--;
            else if (t[j] === '{' && depth === 1) { foundBrace = true; break; }
            j++;
        }
        if (foundBrace && depth > 0) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'missing-paren-before-brace',
                message: 'Missing ")" before "{" in ' + m[1] + ' statement',
                fix: 'close-paren-before-brace' });
        }
    }
    return issues;
}

// ── Empty-control trap: `if (...) ;` ──────────────────────────────
function ccheckEmptyControlTrap(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        var m = t.match(/^(if|while|for)\s*\([^)]*\)\s*;\s*$/);
        if (!m) continue;
        var next = cfindNextNonBlank(lex, i + 1);
        if (next && /^\s*\{/.test(next.cleaned)) {
            issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'empty-control-trap',
                message: 'The ";" after "' + m[1] + ' (...)" gives it an empty body — the following "{ ... }" is a separate block' });
        }
    }
    return issues;
}

// ── Dangling && / || ─────────────────────────────────────────────
function ccheckDanglingLogicalOp(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var m = t.match(/(&&|\|\|)\s*\)\s*\{?\s*$/);
        if (m) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'dangling-logical-op',
                message: 'Missing right operand for "' + m[1] + '"' });
        }
    }
    return issues;
}

// ── Unclosed "(" at EOL ───────────────────────────────────────────
function ccheckUnclosedParen(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!t || /^#/.test(t)) continue;
        if (/^(if|for|while|switch)\b/.test(t)) continue;
        if (/[,\\]$/.test(t)) continue;
        if (/\b[a-zA-Z_]\w*\s*\([^)]*;\s*$/.test(t)) continue;
        var o = (t.match(/\(/g) || []).length;
        var c = (t.match(/\)/g) || []).length;
        if (o <= c) continue;
        var next = cfindNextNonBlank(lex, i + 1);
        if (next) {
            var nt = next.cleaned.trim();
            var isContinuation = /^[,)\]]/.test(nt) || /^["']/.test(nt) || /^[+\-*/%&|^?:]/.test(nt);
            if (isContinuation) continue;
        }
        issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'unclosed-paren',
            message: 'Unclosed "(" — missing ")" on this line', fix: 'close-paren-at-eol' });
    }
    return issues;
}

// ── Unclosed array initializer ────────────────────────────────────
function ccheckArrayInit(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!t || /^#/.test(t)) continue;
        if (!/=\s*\{[^}]*$/.test(t)) continue;
        var next = cfindNextNonBlank(lex, i + 1);
        if (next) {
            var nt = next.cleaned.trim();
            if (/^[\d"'{,]/.test(nt) && !C_STMT_STARTERS.test(nt)) continue;
        }
        issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'unclosed-array-init',
            message: 'Unclosed "{ }" — array initializer is missing its closing "}"', fix: 'close-array-init' });
    }
    return issues;
}

// ── Stray ";" inside initializer ──────────────────────────────────
function ccheckStraySemiInInitializer(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        if (!/=\s*\{[^{}]*;[^{}]*\}/.test(t)) continue;
        issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'stray-semi-in-init',
            message: 'Stray ";" inside the initializer — the semicolon belongs after the closing "}"',
            fix: 'drop-semi-in-init' });
    }
    return issues;
}

// ── Unclosed "[" in declaration ───────────────────────────────────
function ccheckUnclosedBracketInDecl(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var m = t.match(/\b([a-zA-Z_]\w*)\s*\[([^\]\n]*);/);
        if (m) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'missing-bracket-in-decl',
                message: 'Missing "]" — the array size is not closed before ";"',
                fix: 'close-bracket-before-semi' });
        }
    }
    return issues;
}

// ── Missing semicolon ─────────────────────────────────────────────
function ccheckSemicolons(lex) {
    var issues = [];
    var inStruct = 0;
    for (var i = 0; i < lex.lines.length; i++) {
        var ln = lex.lines[i];
        var t = ln.cleaned.trim();
        if (!t) continue;
        if (/^#/.test(t)) continue;
        if (/^(typedef\s+)?(struct|union|enum)(\s+[a-zA-Z_]\w*)?\s*\{\s*$/.test(t)) { inStruct++; continue; }
        if (inStruct > 0) { if (/^\}/.test(t)) inStruct--; continue; }
        if (/[;{}:,]$/.test(t)) continue;
        if (/^\}\s*while\s*\([^)]*\)\s*$/.test(t)) {
            issues.push({ severity: 'error', line: ln.lineNum, type: 'do-while-no-semi',
                message: 'Missing semicolon after do-while', fix: 'add-semicolon' });
            continue;
        }
        if (/^[,)\]}]/.test(t)) continue;
        if (/[,\\]$/.test(t)) continue;
        if (/^(if|else\s+if|else|while|for|switch|do|case\b|default\b)/.test(t)) continue;
        var next = cfindNextNonBlank(lex, i + 1);
        if (next && /^\s*\{/.test(next.cleaned)) continue;
        var pO = (t.match(/\(/g) || []).length;
        var pC = (t.match(/\)/g) || []).length;
        if (pO > pC) continue;
        var bO = (t.match(/\{/g) || []).length;
        var bC = (t.match(/\}/g) || []).length;
        if (bO > bC) continue;
        if (/\b[a-zA-Z_]\w*\s*\([^)]*;\s*$/.test(t)) continue;
        if (!/[)\]"'0-9A-Za-z]$/.test(t) && !/(\+\+|--)$/.test(t)) continue;
        issues.push({ severity: 'error', line: ln.lineNum, type: 'missing-semicolon',
            message: 'Missing semicolon at end of statement', fix: 'add-semicolon' });
    }
    return issues;
}

// ── Struct field missing semicolon ────────────────────────────────
function ccheckStructFields(lex) {
    var issues = [];
    var inStruct = 0;
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!t) continue;
        if (/^(typedef\s+)?(struct|union)(\s+[a-zA-Z_]\w*)?\s*\{\s*$/.test(t)) { inStruct++; continue; }
        if (inStruct > 0 && /^\}/.test(t)) { inStruct--; continue; }
        if (inStruct === 0) continue;
        if (/^#/.test(t)) continue;
        if (/;$/.test(t)) continue;
        if (/^(?:unsigned\s+|signed\s+|const\s+|volatile\s+|static\s+)?[a-zA-Z_]\w*(\s*\*?\s*[a-zA-Z_]\w*(\s*\[[^\]]*\])?)+\s*$/.test(t)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'struct-field-no-semi',
                message: 'Struct field missing semicolon', fix: 'add-semicolon' });
        }
    }
    return issues;
}

// ── Misplaced ";" inside function call ────────────────────────────
function ccheckMisplacedSemi(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (/^for\b/.test(t)) continue;
        var m = t.match(/\b([a-zA-Z_]\w*)\s*\([^)]*;\s*$/);
        if (m) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'semicolon-inside-call',
                message: 'Semicolon inside "' + m[1] + '(...)" — should be after the closing ")"',
                fix: 'move-semicolon-out' });
        }
    }
    return issues;
}

// ── Case label colon ──────────────────────────────────────────────
function ccheckCaseColon(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (/^case\s+[^:\s]+\s*::\s*$/.test(t)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'case-double-colon',
                message: 'Extra ":" after case label', fix: 'remove-extra-colon' });
            continue;
        }
        if (/^case\s+[^:\s]+\s*$/.test(t)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'case-no-colon',
                message: 'Missing ":" after case label', fix: 'add-case-colon' });
        }
    }
    return issues;
}

// ── Case missing value ────────────────────────────────────────────
function ccheckCaseNoValue(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (/^case\s*:\s*$/.test(t)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'case-no-value',
                message: 'Missing value after "case"' });
        }
    }
    return issues;
}

// ── Default missing colon ─────────────────────────────────────────
function ccheckDefaultColon(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (/^default\s*$/.test(t)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'default-no-colon',
                message: 'Missing ":" after "default"', fix: 'add-default-colon' });
        }
    }
    return issues;
}

// ── Missing "}" before "else" ─────────────────────────────────────
function ccheckMissingBraceBeforeElse(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!t || !/^else\b/.test(t)) continue;
        var prev = cfindPrevNonBlank(lex, i - 1);
        if (!prev) continue;
        var prevT = prev.cleaned.trim();
        if (/\}\s*$/.test(prevT)) continue;
        var prev2 = cfindPrevNonBlank(lex, i - 2);
        if (prev2) {
            var prevT2 = prev2.cleaned.trim();
            if (/^(if|else\s+if|while|for)\s*\([^)]*\)\s*$/.test(prevT2)) continue;
        }
        if (/[;{]\s*$/.test(prevT)) {
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'missing-brace-before-else',
                message: 'Missing "}" before "else" — the previous block was never closed',
                fix: 'add-brace-before-else' });
        }
    }
    return issues;
}

// ── Stray "}" before "else" ───────────────────────────────────────
function ccheckStrayBraceBeforeElse(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!/^\}\s*$/.test(t)) continue;
        var next = cfindNextNonBlank(lex, i + 1);
        if (!next || !/^else\b/.test(next.cleaned.trim())) continue;
        var prev1 = cfindPrevNonBlank(lex, i - 1);
        if (!prev1) continue;
        if (!/;$/.test(prev1.cleaned.trim())) continue;
        var prev2 = cfindPrevNonBlank(lex, i - 2);
        if (!prev2) continue;
        var p2 = prev2.cleaned.trim();
        if (!/^(if|else\s+if)\s*\([^)]*\)\s*$/.test(p2)) continue;
        issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'stray-brace-before-else',
            message: 'Stray "}" — the ' + (p2.startsWith('else') ? 'else if' : 'if') +
                ' above has an unbraced body; this "}" is leftover and should be removed',
            fix: 'remove-stray-brace' });
    }
    return issues;
}

// ── Stray "}" after unbraced else ─────────────────────────────────
function ccheckStrayBraceAfterUnbracedElse(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        if (!/^\}\s*$/.test(t)) continue;
        var prev1 = cfindPrevNonBlank(lex, i - 1);
        if (!prev1) continue;
        if (!/;$/.test(prev1.cleaned.trim())) continue;
        var prev2 = cfindPrevNonBlank(lex, i - 2);
        if (!prev2) continue;
        if (!/^else\b/.test(prev2.cleaned.trim())) continue;
        var next = cfindNextNonBlank(lex, i + 1);
        if (next && /^else\b/.test(next.cleaned.trim())) continue;
        issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'stray-brace-after-else',
            message: 'Stray "}" — the else above has an unbraced body, so this "}" closes the surrounding block too early',
            fix: 'remove-stray-brace' });
    }
    return issues;
}

// ── Missing #include ──────────────────────────────────────────────
function ccheckIncludes(lex) {
    var issues = [];
    var src = lex.lines.map(function (l) { return l.cleaned; }).join('\n');
    var raw = lex.lines.map(function (l) { return l.raw; }).join('\n');
    var need = [
        { header: 'stdio.h',  fns: /\b(printf|scanf|fprintf|fscanf|fopen|fclose|fgets|fputs|putchar|getchar|sprintf|sscanf)\s*\(/ },
        { header: 'stdlib.h', fns: /\b(malloc|calloc|realloc|free|atoi|atof|rand|srand|exit|abs)\s*\(/ },
        { header: 'string.h', fns: /\b(strlen|strcpy|strncpy|strcmp|strncmp|strcat|strncat|memset|memcpy|memcmp|strchr|strstr)\s*\(/ },
        { header: 'math.h',   fns: /\b(pow|sqrt|sin|cos|tan|log|log10|exp|floor|ceil|fabs)\s*\(/ }
    ];
    for (var i = 0; i < need.length; i++) {
        var n = need[i];
        if (n.fns.test(src)) {
            var inc = new RegExp('#\\s*include\\s*[<"]' + n.header.replace('.', '\\.') + '[>"]');
            if (!inc.test(raw)) {
                issues.push({ severity: 'warn', line: 1, type: 'missing-include',
                    message: 'Uses functions from <' + n.header + '> but never includes it',
                    fix: 'add-include', header: n.header });
            }
        }
    }
    return issues;
}

function ccheckMainReturn(lex) {
    var src = lex.lines.map(function (l) { return l.cleaned; }).join('\n');
    var m = src.match(/\bint\s+main\s*\([^)]*\)\s*\{/);
    if (!m) return [];
    if (/\breturn\b/.test(src.slice(m.index + m[0].length))) return [];
    return [{ severity: 'warn', line: 1, type: 'missing-return',
        message: 'int main() has no return statement' }];
}

// ═══════════════════════════════════════════════════════════════════
// SEMANTIC CHECKS
// ═══════════════════════════════════════════════════════════════════

function ccheckAssignmentInCondition(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var m = t.match(/\b(if|while)\s*\(([^)]*)\)/);
        if (!m) continue;
        if (/(^|[^=!<>+\-*/%&|^])=([^=]|$)/.test(m[2])) {
            issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'assignment-in-condition',
                message: "Possible '=' used instead of '==' inside " + m[1] + " condition" });
        }
    }
    return issues;
}

function ccheckMissingBreak(lex) {
    var issues = [];
    var switchStack = [];
    var depth = 0;
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var trimmed = t.trim();
        if (!trimmed) continue;
        var opens = (t.match(/\{/g) || []).length;
        var closes = (t.match(/\}/g) || []).length;
        if (/\bswitch\s*\(/.test(trimmed)) {
            switchStack.push({ entryDepth: depth, caseLine: 0, caseContent: false, caseBreak: false });
        }
        var cur = switchStack.length ? switchStack[switchStack.length - 1] : null;
        if (cur && depth === cur.entryDepth + 1) {
            if (/^(case\b|default\s*:)/.test(trimmed)) {
                if (cur.caseLine > 0 && cur.caseContent && !cur.caseBreak) {
                    issues.push({ severity: 'warn', line: cur.caseLine, type: 'missing-break',
                        message: 'Case may fall through — no break before the next case' });
                }
                cur.caseLine = lex.lines[i].lineNum;
                cur.caseContent = /\b(case|default)\b[^:]*:\s*\S/.test(trimmed);
                cur.caseBreak = false;
            } else if (cur.caseLine > 0) {
                if (trimmed.length > 0) cur.caseContent = true;
                if (/\bbreak\s*;/.test(trimmed) || /\breturn\b/.test(trimmed) ||
                    /\bexit\s*\(/.test(trimmed) || /\bcontinue\s*;/.test(trimmed) || /\bgoto\b/.test(trimmed)) {
                    cur.caseBreak = true;
                }
            }
        }
        depth += opens - closes;
        while (switchStack.length && depth <= switchStack[switchStack.length - 1].entryDepth) {
            switchStack.pop();
        }
    }
    return issues;
}

function ccheckDuplicateConditions(lex) {
    var issues = [];
    var chain = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        var mIf = t.match(/^if\s*\(([^)]+)\)/);
        var mElseIf = t.match(/^else\s+if\s*\(([^)]+)\)/);
        if (mIf) { chain = [{ cond: mIf[1].trim(), line: lex.lines[i].lineNum }]; continue; }
        if (mElseIf) {
            var cond = mElseIf[1].trim();
            for (var k = 0; k < chain.length; k++) {
                if (chain[k].cond === cond) {
                    issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'duplicate-condition',
                        message: 'Unreachable branch — same condition as line ' + chain[k].line });
                }
            }
            chain.push({ cond: cond, line: lex.lines[i].lineNum });
            continue;
        }
        if (/^else\b/.test(t) || /^\}/.test(t) || /^$/.test(t)) continue;
        chain = [];
    }
    return issues;
}

function ccheckNullDeref(lex) {
    var issues = [];
    var nullPtrs = {};
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var m = t.match(/\b([a-zA-Z_]\w*)\s*=\s*NULL\s*;/);
        if (m) { nullPtrs[m[1]] = lex.lines[i].lineNum; continue; }
        var r = t.match(/\b([a-zA-Z_]\w*)\s*=\s*[^N]/);
        if (r && nullPtrs[r[1]]) delete nullPtrs[r[1]];
        for (var name in nullPtrs) {
            var deref = new RegExp('\\*\\s*' + name + '\\b|\\b' + name + '\\s*->');
            if (deref.test(t)) {
                issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'null-deref',
                    message: '"' + name + '" was set to NULL on line ' + nullPtrs[name] + ' and is dereferenced here' });
            }
        }
    }
    return issues;
}

function ccheckUseAfterFree(lex) {
    var issues = [];
    var freed = {};
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var m = t.match(/\bfree\s*\(\s*([a-zA-Z_]\w*)\s*\)/);
        if (m) { freed[m[1]] = lex.lines[i].lineNum; continue; }
        var r = t.match(/\b([a-zA-Z_]\w*)\s*=\s*(?:malloc|calloc|realloc)/);
        if (r && freed[r[1]]) delete freed[r[1]];
        for (var name in freed) {
            var use = new RegExp('\\*\\s*' + name + '\\b|\\b' + name + '\\s*\\[|\\b' + name + '\\s*->');
            if (use.test(t) && !/free\s*\(\s*[a-zA-Z_]\w*\s*\)/.test(t)) {
                issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'use-after-free',
                    message: '"' + name + '" was freed on line ' + freed[name] + ' but is used again here' });
            }
        }
    }
    return issues;
}

function ccheckInfiniteLoop(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        var m = t.match(/^while\s*\(([^)]+)\)\s*\{?$/);
        if (!m) continue;
        var cond = m[1].trim();
        if (/^1$|^true$/.test(cond)) continue;
        var varM = cond.match(/([a-zA-Z_]\w*)\s*(?:[<>=!]=?|[<>])/);
        if (!varM) continue;
        var loopVar = varM[1];
        var depth = 1, modified = false;
        for (var j = i + 1; j < lex.lines.length && depth > 0; j++) {
            var b = lex.lines[j].cleaned;
            depth += (b.match(/\{/g) || []).length - (b.match(/\}/g) || []).length;
            var modRe = new RegExp('\\b' + loopVar + '\\s*(?:\\+\\+|--|[-+*/%]?=)');
            if (modRe.test(b)) { modified = true; break; }
        }
        if (!modified) {
            issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'infinite-loop',
                message: 'Possible infinite loop — "' + loopVar + '" is not modified inside the body' });
        }
    }
    return issues;
}

function ccheckArrayOOB(lex) {
    var issues = [];
    var arrays = {};
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var decl = t.match(/\b([a-zA-Z_]\w*)\s*\[\s*(\d+)\s*\]/);
        if (decl) arrays[decl[1]] = { size: parseInt(decl[2], 10), line: lex.lines[i].lineNum };
    }
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned.trim();
        var m = t.match(/^for\s*\([^;]+;\s*([a-zA-Z_]\w*)\s*<=\s*([a-zA-Z_]\w*|\d+)\s*;/);
        if (!m) continue;
        var loopVar = m[1];
        var boundExpr = m[2];
        var isLiteral = /^\d+$/.test(boundExpr);
        var bound = isLiteral ? parseInt(boundExpr, 10) : null;
        var depth = 1;
        for (var j = i + 1; j < lex.lines.length && depth > 0; j++) {
            var b = lex.lines[j].cleaned;
            depth += (b.match(/\{/g) || []).length - (b.match(/\}/g) || []).length;
            for (var name in arrays) {
                var idxRe = new RegExp('\\b' + name + '\\s*\\[\\s*' + loopVar + '\\s*\\]');
                if (!idxRe.test(b)) continue;
                if (isLiteral && bound >= arrays[name].size) {
                    issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'array-oob',
                        message: 'Loop runs to ' + loopVar + '<=' + bound + ' but "' + name +
                            '" has size ' + arrays[name].size + ' — index ' + arrays[name].size + ' is out of bounds' });
                } else if (!isLiteral) {
                    issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'array-oob',
                        message: 'Loop uses "' + loopVar + ' <= ' + boundExpr + '" but indexes "' + name +
                            '" with ' + loopVar + ' — if ' + boundExpr + ' reaches ' + arrays[name].size +
                            ', the last access is out of bounds (use < not <=)' });
                }
            }
        }
    }
    return issues;
}

function ccheckArrayLiteralIndexOOB(lex) {
    var issues = [];
    var arrays = {};
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var decl = t.match(/\b([a-zA-Z_]\w*)\s*\[\s*(\d+)\s*\]/);
        if (decl) arrays[decl[1]] = { size: parseInt(decl[2], 10), line: lex.lines[i].lineNum };
    }
    if (!Object.keys(arrays).length) return issues;
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        if (/\b[a-zA-Z_]\w*\s*\[\s*\d+\s*\]\s*=/.test(t)) continue;
        for (var name in arrays) {
            var info = arrays[name];
            var re = new RegExp('\\b' + name + '\\s*\\[\\s*(-?\\d+)\\s*\\]', 'g');
            var m;
            while ((m = re.exec(t)) !== null) {
                var idx = parseInt(m[1], 10);
                if (idx < 0) {
                    issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'array-oob-literal',
                        message: '"' + name + '[' + idx + ']" — negative index on an array of size ' +
                            info.size + ' (declared on line ' + info.line + ')' });
                } else if (idx >= info.size) {
                    issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'array-oob-literal',
                        message: '"' + name + '[' + idx + ']" is out of bounds — "' + name +
                            '" has size ' + info.size + ' (declared on line ' + info.line +
                            '), so valid indices are 0–' + (info.size - 1) });
                }
            }
        }
    }
    return issues;
}

function ccheckDivisionByZero(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        if (/\/\s*0(?![.\d])/.test(t)) {
            issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'div-by-zero',
                message: 'Division by zero — the divisor is 0' });
            continue;
        }
        var m = t.match(/\b([a-zA-Z_]\w*)\s*=\s*0\s*;/);
        if (m) {
            var zeroVar = m[1];
            for (var j = i + 1; j < Math.min(lex.lines.length, i + 15); j++) {
                var b = lex.lines[j].cleaned;
                if (new RegExp('/\\s*' + zeroVar + '\\b').test(b)) {
                    issues.push({ severity: 'warn', line: lex.lines[j].lineNum, type: 'div-by-zero',
                        message: '"' + zeroVar + '" was set to 0 on line ' + lex.lines[i].lineNum + ' and used as a divisor here' });
                }
            }
        }
    }
    return issues;
}

var C_RESERVED = {
    auto:1, break:1, case:1, char:1, const:1, continue:1, default:1,
    do:1, double:1, else:1, enum:1, extern:1, float:1, for:1, goto:1,
    if:1, inline:1, int:1, long:1, register:1, restrict:1, return:1,
    short:1, signed:1, sizeof:1, static:1, struct:1, switch:1,
    typedef:1, union:1, unsigned:1, void:1, volatile:1, while:1
};

function ccheckReservedWords(lex) {
    var issues = [];
    var VALID_CONT = {
        unsigned: /^(int|char|short|long)$/, signed: /^(int|char|short|long)$/,
        long: /^(int|double)$/, short: /^int$/,
        const: /^(int|char|float|double|long|short|signed|unsigned|void|struct|union|enum)$/,
        volatile: /^(int|char|float|double|long|short|signed|unsigned|void|struct|union|enum)$/,
        static: /^(int|char|float|double|long|short|signed|unsigned|void|struct|union|enum|const|volatile)$/,
        extern: /^(int|char|float|double|long|short|signed|unsigned|void|struct|union|enum|const|volatile)$/
    };
    for (var i = 0; i < lex.lines.length; i++) {
        var t = lex.lines[i].cleaned;
        var re = /\b(int|char|float|double|long|short|signed|unsigned|void|const|volatile|static|extern|struct|union|enum)\s+([a-zA-Z_]\w*)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
            var first = m[1], id = m[2];
            if (/^(struct|union|enum)$/.test(first)) continue;
            if (!C_RESERVED[id]) continue;
            var vc = VALID_CONT[first];
            if (vc && vc.test(id)) continue;
            issues.push({ severity: 'error', line: lex.lines[i].lineNum, type: 'reserved-identifier',
                message: '"' + id + '" is a reserved C keyword and cannot be used as an identifier' });
        }
    }
    return issues;
}

function ccheckCharLiterals(lex) {
    var issues = [];
    for (var i = 0; i < lex.lines.length; i++) {
        var raw = lex.lines[i].raw;
        var re = /'(\\?[^'\\]*)'/g, m;
        while ((m = re.exec(raw)) !== null) {
            var c = m[1];
            if (/^\\/.test(c)) continue;
            if (c.length > 1) {
                issues.push({ severity: 'warn', line: lex.lines[i].lineNum, type: 'multi-char-literal',
                    message: 'Character literal ' + m[0] + ' contains more than one character' });
            }
        }
    }
    return issues;
}

// ═══════════════════════════════════════════════════════════════════
// ISSUE GATHERING
// ═══════════════════════════════════════════════════════════════════

function cgatherIssues(lex) {
    var issues = [];
    issues = issues.concat(ccheckBalance(lex));
    issues = issues.concat(ccheckUnclosedBraceAtEof(lex));
    issues = issues.concat(ccheckStructClosingSemi(lex));
    issues = issues.concat(ccheckMalformedDefine(lex));
    issues = issues.concat(ccheckMalformedIncludes(lex));
    issues = issues.concat(ccheckMalformedFunctionHeader(lex));
    issues = issues.concat(ccheckControlMissingParen(lex));
    issues = issues.concat(ccheckControlParens(lex));
    issues = issues.concat(ccheckEmptyControlTrap(lex));
    issues = issues.concat(ccheckDanglingLogicalOp(lex));
    issues = issues.concat(ccheckUnclosedParen(lex));
    issues = issues.concat(ccheckArrayInit(lex));
    issues = issues.concat(ccheckStraySemiInInitializer(lex));
    issues = issues.concat(ccheckUnclosedBracketInDecl(lex));
    issues = issues.concat(ccheckSemicolons(lex));
    issues = issues.concat(ccheckStructFields(lex));
    issues = issues.concat(ccheckMisplacedSemi(lex));
    issues = issues.concat(ccheckCaseColon(lex));
    issues = issues.concat(ccheckCaseNoValue(lex));
    issues = issues.concat(ccheckDefaultColon(lex));
    issues = issues.concat(ccheckMissingBraceBeforeElse(lex));
    issues = issues.concat(ccheckStrayBraceBeforeElse(lex));
    issues = issues.concat(ccheckStrayBraceAfterUnbracedElse(lex));
    issues = issues.concat(ccheckIncludes(lex));
    issues = issues.concat(ccheckMainReturn(lex));
    issues = issues.concat(ccheckAssignmentInCondition(lex));
    issues = issues.concat(ccheckMissingBreak(lex));
    issues = issues.concat(ccheckDuplicateConditions(lex));
    issues = issues.concat(ccheckNullDeref(lex));
    issues = issues.concat(ccheckUseAfterFree(lex));
    issues = issues.concat(ccheckInfiniteLoop(lex));
    issues = issues.concat(ccheckArrayOOB(lex));
    issues = issues.concat(ccheckArrayLiteralIndexOOB(lex));
    issues = issues.concat(ccheckDivisionByZero(lex));
    issues = issues.concat(ccheckReservedWords(lex));
    issues = issues.concat(ccheckCharLiterals(lex));

    var seen = {};
    issues = issues.filter(function (iss) {
        var key = iss.line + ':' + iss.type;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });

    var diagnosed = {};
    var minStrayLine = Infinity;
    var eofBraceLines = {};
    for (var i = 0; i < issues.length; i++) {
        if (issues[i].type === 'stray-brace-before-else' || issues[i].type === 'stray-brace-after-else') {
            diagnosed[issues[i].line] = true;
            if (issues[i].line < minStrayLine) minStrayLine = issues[i].line;
        }
        if (issues[i].type === 'unclosed-brace-eof') eofBraceLines[issues[i].line] = true;
        if (issues[i].type === 'missing-bracket-in-decl') diagnosed['bracket:' + issues[i].line] = true;
    }
    issues = issues.filter(function (iss) {
        if (iss.type === 'unmatched-close') {
            if (diagnosed[iss.line]) return false;
            if (iss.line > minStrayLine) return false;
        }
        if (iss.type === 'unclosed-open' && /^\{/.test(iss.message) && eofBraceLines[iss.line]) return false;
        if (iss.type === 'unclosed-open' && /\[/.test(iss.message) && diagnosed['bracket:' + iss.line]) return false;
        return true;
    });

    issues.sort(function (a, b) {
        if (a.line !== b.line) return a.line - b.line;
        return (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1);
    });
    return issues;
}

// ═══════════════════════════════════════════════════════════════════
// FIX ENGINE
// ═══════════════════════════════════════════════════════════════════

var CFIX_LABELS = {
    'add-semicolon': 'Added missing semicolon',
    'add-include': 'Added #include',
    'close-paren-before-brace': 'Added missing ")" before "{"',
    'close-paren-at-eol': 'Closed unclosed "("',
    'close-array-init': 'Closed array initializer',
    'drop-semi-in-init': 'Removed stray ";" inside initializer',
    'close-bracket-before-semi': 'Added missing "]" before ";"',
    'add-case-colon': 'Added ":" after case label',
    'add-default-colon': 'Added ":" after "default"',
    'remove-extra-colon': 'Removed extra ":" after case label',
    'move-semicolon-out': 'Moved semicolon outside call',
    'add-brace-before-else': 'Inserted missing "}" before "else"',
    'close-include': 'Closed malformed #include',
    'fix-malformed-header': 'Fixed malformed function header',
    'remove-stray-brace': 'Removed stray "}"',
    'append-close-brace': 'Appended missing "}" at end of file',
    'add-struct-semi': 'Added ";" after struct/union/enum'
};

function capplyFixesOnce(text, issues) {
    var lines = text.split('\n');
    var applied = [];
    var includesToAdd = [];
    var perLine = {};
    var insertsBefore = {};
    var deletes = {};
    var fileAppend = '';

    for (var i = 0; i < issues.length; i++) {
        var iss = issues[i];
        if (!iss.fix) continue;

        if (iss.fix === 'add-include') {
            if (includesToAdd.indexOf(iss.header) === -1) {
                includesToAdd.push(iss.header);
                applied.push({ line: 0, message: 'Added #include <' + iss.header + '>' });
            }
            continue;
        }
        if (iss.fix === 'add-brace-before-else') {
            if (!insertsBefore[iss.line]) insertsBefore[iss.line] = [];
            insertsBefore[iss.line].push('}');
            applied.push({ line: iss.line, message: CFIX_LABELS[iss.fix] });
            continue;
        }
        if (iss.fix === 'remove-stray-brace') {
            if (deletes[iss.line]) continue;
            deletes[iss.line] = true;
            applied.push({ line: iss.line, message: CFIX_LABELS[iss.fix] });
            continue;
        }
        if (iss.fix === 'append-close-brace') {
            fileAppend += '}';
            applied.push({ line: iss.line, message: CFIX_LABELS[iss.fix] });
            continue;
        }

        var ln = iss.line;
        if (!perLine[ln]) perLine[ln] = {};
        if (perLine[ln][iss.fix]) continue;
        perLine[ln][iss.fix] = true;
        applied.push({ line: ln, message: CFIX_LABELS[iss.fix] || iss.fix });
    }

    var modLines = Object.keys(perLine).map(Number).sort(function (a, b) { return b - a; });
    for (var li = 0; li < modLines.length; li++) {
        var lnNum = modLines[li];
        var idx = lnNum - 1;
        if (idx < 0 || idx >= lines.length) continue;
        var line = lines[idx];
        var fixes = perLine[lnNum];
        var endsSemi = false;

        if (fixes['close-include']) {
            line = line.replace(/\s+$/, '');
            if (/<[^>]*$/.test(line)) line += '>';
            else if (/"[^"]*$/.test(line)) line += '"';
        }
        if (fixes['fix-malformed-header']) line = line.replace(/\(\s*\{[^)]*\)?\s*;?\s*$/, '() {');
        if (fixes['close-bracket-before-semi']) line = line.replace(/(\w+\s*\[[^\]\n]*);/, '$1];');
        if (fixes['drop-semi-in-init']) line = line.replace(/=\s*\{([^{}]*);([^{}]*)\}/, '= {$1$2}');
        if (fixes['add-struct-semi']) line = line.replace(/\s+$/, '') + ';';
        if (fixes['close-paren-before-brace']) {
            var kw = line.match(/^(\s*)(if|for|while|switch)\s*\(/);
            if (kw) {
                var startIdx = kw[0].length;
                var depth = 1, j = startIdx;
                while (j < line.length) {
                    if (line[j] === '(') depth++;
                    else if (line[j] === ')') depth--;
                    else if (line[j] === '{' && depth === 1) break;
                    j++;
                }
                if (j < line.length && line[j] === '{') {
                    var before = line.slice(0, j).replace(/\s+$/, '');
                    var gap = line.slice(before.length, j);
                    line = before + ')' + gap + line.slice(j);
                }
            }
        }
        if (fixes['move-semicolon-out']) { line = line.replace(/;\s*$/, ');'); endsSemi = true; }
        if (fixes['close-array-init']) { line = line.replace(/\s+$/, '') + '};'; endsSemi = true; }
        if (fixes['add-case-colon']) line = line.replace(/\s+$/, '') + ':';
        if (fixes['add-default-colon']) line = line.replace(/\s+$/, '') + ':';
        if (fixes['remove-extra-colon']) line = line.replace(/(case\s+[^:\s]+)\s*::\s*$/, '$1:');
        if (fixes['close-paren-at-eol']) {
            var tt = line.replace(/\s+$/, '');
            if (/;$/.test(tt)) line = tt.replace(/;$/, ');');
            else line = tt + ');';
            endsSemi = true;
        }
        if (fixes['add-semicolon'] && !endsSemi) {
            var cIdx = line.indexOf('//');
            if (cIdx >= 0) line = line.slice(0, cIdx).replace(/\s+$/, '') + '; ' + line.slice(cIdx);
            else line = line.replace(/\s+$/, '') + ';';
        }

        lines[idx] = line;
    }

    var delNums = Object.keys(deletes).map(Number).sort(function (a, b) { return b - a; });
    for (var di = 0; di < delNums.length; di++) {
        var idx3 = delNums[di] - 1;
        if (idx3 >= 0 && idx3 < lines.length) lines.splice(idx3, 1);
    }

    var insLines = Object.keys(insertsBefore).map(Number).sort(function (a, b) { return b - a; });
    for (var ii = 0; ii < insLines.length; ii++) {
        var lnNum2 = insLines[ii];
        var idx2 = lnNum2 - 1;
        if (idx2 < 0) idx2 = 0;
        if (idx2 > lines.length) idx2 = lines.length;
        var target = lines[idx2] || '';
        var indent = (target.match(/^(\s*)/) || ['', ''])[1];
        var newLines = insertsBefore[lnNum2].map(function (l) { return indent + l; });
        var args = [idx2, 0].concat(newLines);
        Array.prototype.splice.apply(lines, args);
    }

    if (fileAppend) {
        if (lines.length === 0 || lines[lines.length - 1].trim() !== '') lines.push('');
        lines.push(fileAppend);
    }

    if (includesToAdd.length > 0) {
        lines.unshift(includesToAdd.map(function (h) { return '#include <' + h + '>'; }).join('\n'));
    }

    return { text: lines.join('\n'), applied: applied };
}

function capplyFixes(text, issues) {
    var current = text;
    var allApplied = [];
    var MAX_ITER = 8;
    for (var iter = 0; iter < MAX_ITER; iter++) {
        var lex = clexLines(current);
        var currentIssues = cgatherIssues(lex);
        var fixable = currentIssues.filter(function (iss) { return iss.fix; });
        if (!fixable.length) break;
        var result = capplyFixesOnce(current, currentIssues);
        if (result.text === current) break;
        current = result.text;
        allApplied = allApplied.concat(result.applied);
    }
    return { text: current, applied: allApplied };
}

// ═══════════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════════

function cissueStep(kind, text) {
    var marker = kind === 'error' ? '×' : '!';
    var cls = kind === 'error' ? 'cparse-err' : 'cparse-warn';
    return '<div class="xetex-step ' + cls + '"><div class="xetex-step-num">' + marker +
        '</div><div class="xetex-step-body">' + text + '</div></div>';
}

function cbuildOutput(originalText, lex, issues, fixResult) {
    var parts = [];
    parts.push('<div class="xetex-output cparse-output">');
    parts.push('<div class="xetex-equation">C Code Analysis</div>');

    if (lex.unclosedBlockComment) parts.push(cissueStep('error', 'Line ' + lex.unclosedBlockComment + ' — block comment "/*" is never closed'));
    if (lex.unclosedString) parts.push(cissueStep('error', 'Line ' + lex.unclosedString + ' — string or char literal is never closed'));

    var errors = [], warnings = [];
    for (var i = 0; i < issues.length; i++) {
        (issues[i].severity === 'error' ? errors : warnings).push(issues[i]);
    }
    for (var e = 0; e < errors.length; e++) {
        var err = errors[e];
        parts.push(cissueStep('error', (err.line > 0 ? 'Line ' + err.line + ' — ' : '') + cesc(err.message)));
    }
    for (var w = 0; w < warnings.length; w++) {
        var wn = warnings[w];
        parts.push(cissueStep('warn', (wn.line > 0 ? 'Line ' + wn.line + ' — ' : '') + cesc(wn.message)));
    }
    if (!errors.length && !warnings.length && !lex.unclosedBlockComment && !lex.unclosedString) {
        parts.push('<div class="xetex-note">No issues detected.</div>');
    }

    if (fixResult.applied.length > 0) {
        parts.push('<div class="xetex-step"><div class="xetex-step-num">i</div><div class="xetex-step-body">Auto-fixed code</div></div>');
        parts.push(ccodeCard('c', cesc(fixResult.text)));
    } else if (errors.length > 0) {
        parts.push('<div class="xetex-step"><div class="xetex-step-num">i</div><div class="xetex-step-body">Original code (nothing auto-fixed)</div></div>');
        parts.push(ccodeCard('c', cesc(originalText)));
    }

    var bits = [];
    if (errors.length) bits.push(errors.length + ' error' + (errors.length > 1 ? 's' : ''));
    if (warnings.length) bits.push(warnings.length + ' warning' + (warnings.length > 1 ? 's' : ''));
    if (fixResult.applied.length) bits.push(fixResult.applied.length + ' auto-fixed');
    if (!bits.length) bits.push('Clean');

    parts.push('<div class="xetex-answer"><span class="xetex-answer-label">Status</span>' +
        '<span class="xetex-answer-val">' + bits.join(' · ') + '</span></div>');
    parts.push('</div>');
    return parts.join('');
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

function cparseHandle(rawText) {
    var text = String(rawText || '').replace(/^\s*\/c\s*\n?/, '').replace(/^\s*\/c\s+/, '');
    try {
        var originalLex = clexLines(text);
        var originalIssues = cgatherIssues(originalLex);
        var fixResult = capplyFixes(text, originalIssues);
        var html = cbuildOutput(text, originalLex, originalIssues, fixResult);
        return { __html: true, text: html };
    } catch (err) {
        return { __html: true, text: '<div class="xetex-output"><div class="xetex-error">C analyzer crashed: ' + cesc(err.message) + '</div></div>' };
    }
}

function isCoding(text) { return isCCode(text); }
function codingHandle(text) { return cparseHandle(text); }

window.isCCode = isCCode;
window.cparseHandle = cparseHandle;
window.isCoding = isCoding;
window.codingHandle = codingHandle;
window.ccodeCard = ccodeCard;