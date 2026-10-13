// base.js — Number Base Converter
//
// Converts between binary / octal / decimal / hex / any base 2-36.
// Uses BigInt internally so large values never lose precision.
//
// Detects a wide range of phrasings:
//   "255 to binary"           "binary of 255"          "binary 255"
//   "255 in hex"              "hex of FF"              "FF to decimal"
//   "0xFF to decimal"         "convert 1010 to hex"    "base 16 255"
//   "what is binary of 255"   "255 binary"             "/base 255 10 16"
// And answers with the standard xetex-output structure.

// ── Constants ──
var BASE_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var BASE_SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

var BASE_NAMES = {
    binary: 2, bin: 2,
    octal: 8, oct: 8,
    decimal: 10, dec: 10,
    hexadecimal: 16, hex: 16
};

function baseNameToNum(name) {
    if (!name) return null;
    var lower = String(name).toLowerCase().trim();
    if (BASE_NAMES[lower] !== undefined) return BASE_NAMES[lower];
    var m = lower.match(/^base\s*(\d+)$/);
    if (m) {
        var n = parseInt(m[1], 10);
        if (n >= 2 && n <= 36) return n;
    }
    return null;
}

function baseNumToName(n) {
    if (n === 2) return 'binary';
    if (n === 8) return 'octal';
    if (n === 10) return 'decimal';
    if (n === 16) return 'hexadecimal';
    return 'base ' + n;
}

function baseSubscript(n) {
    return String(n).split('').map(function (ch) {
        var d = '0123456789'.indexOf(ch);
        return d >= 0 ? BASE_SUBSCRIPTS[d] : ch;
    }).join('');
}

// ── Detection ──
function isBaseConversion(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    if (!t || t.length > 200) return false;

    if (/^\/base\b/i.test(t)) return true;

    // Reject C contexts — those are coding questions, not base conversions.
    if (/\b(in|using)\s+c\b|\bc\s+(program|language|code|syntax)\b/i.test(t)) return false;

    // Reject obvious false-positive English phrases.
    if (/\b(binary\s+(tree|search|heap|operator|operation|file|string)|decimal\s+(point|place))/i.test(t)) return false;

    var hasBaseName = /\b(binary|octal|decimal|hex(adecimal)?|bin|oct|dec|base\s*\d+)\b/i.test(t);
    var hasPrefix = /\b0x[0-9a-f]+\b/i.test(t) || /\b0b[01]+\b/i.test(t) || /\b0o[0-7]+\b/i.test(t);

    if (!hasBaseName && !hasPrefix) return false;

    // Must have something that looks like a value: a digit, a prefix, or
    // a 2+ letter run of hex digits (for shorthand like "FF to decimal").
    var hasNumberish = /\d/.test(t) || hasPrefix || /\b[0-9A-F]{2,}\b/i.test(t);
    if (!hasNumberish) return false;

    return true;
}

// ── Request parsing ──
function baseParseRequest(text) {
    var t = text.trim();

    // ── /base mode ──
    var mExplicit = t.match(/^\/base\s+(\S+)(?:\s+(\d+)\s+(\d+))?\s*$/i);
    if (mExplicit) {
        var from = mExplicit[2] ? parseInt(mExplicit[2], 10) : null;
        var to = mExplicit[3] ? parseInt(mExplicit[3], 10) : null;
        if (from !== null && (from < 2 || from > 36)) return null;
        if (to !== null && (to < 2 || to > 36)) return null;
        return { value: mExplicit[1], fromBase: from, toBase: to, showAll: to === null };
    }

    // Strip filler and verbs.
    var work = t
        .replace(/^(please|can you|could you|would you|i want to|i'd like to)\s+/i, '')
        .replace(/\b(convert|calculate|compute|find|show|tell\s+me|help\s+me)\b/gi, ' ')
        .replace(/\bwhat\s+is\b/gi, ' ')
        .replace(/\bthe\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // ── Find every base mention with its position ──
    var baseMentions = [];
    var reBase = /\b(binary|octal|decimal|hex(?:adecimal)?|bin|oct|dec|base\s*\d+)\b/gi;
    var mBase;
    while ((mBase = reBase.exec(work)) !== null) {
        var bNum = baseNameToNum(mBase[1]);
        if (bNum !== null) {
            baseMentions.push({ base: bNum, index: mBase.index, end: mBase.index + mBase[0].length });
        }
    }

    // ── Find the value ──
    // Prefer a prefixed literal (0x/0b/0o). Otherwise take the LAST
    // number-like token that isn't part of a base mention.
    var valueStr = null;
    var valueIndex = -1;
    var valueEnd = -1;

    var mPrefix = work.match(/\b(0x[0-9a-f]+|0b[01]+|0o[0-7]+)\b/i);
    if (mPrefix) {
        valueStr = mPrefix[1];
        valueIndex = mPrefix.index;
        valueEnd = mPrefix.index + mPrefix[0].length;
    } else {
        var hasHexContext = baseMentions.some(function (b) { return b.base === 16; });
        var valueRe = hasHexContext ? /\b[0-9A-F]+\b/gi : /\b\d+\b/g;
        var mVal;
        var lastMatch = null;
        while ((mVal = valueRe.exec(work)) !== null) {
            // Skip matches inside a base mention span (e.g. the "16" in
            // "base 16" or the "dec" in "decimal").
            var overlaps = baseMentions.some(function (b) {
                return mVal.index < b.end && mVal.index + mVal[0].length > b.index;
            });
            if (overlaps) continue;
            lastMatch = mVal;
        }
        if (lastMatch) {
            valueStr = lastMatch[0];
            valueIndex = lastMatch.index;
            valueEnd = lastMatch.index + lastMatch[0].length;
        }
    }

    if (!valueStr) return null;

    // ── Handle value prefix (0x/0b/0o) — sets the source base ──
    var fromBase = null;
    if (/^0x/i.test(valueStr)) { fromBase = 16; valueStr = valueStr.slice(2); }
    else if (/^0b/i.test(valueStr)) { fromBase = 2; valueStr = valueStr.slice(2); }
    else if (/^0o/i.test(valueStr)) { fromBase = 8; valueStr = valueStr.slice(2); }

    // ── Classify base mentions relative to the value ──
    var mentionsBefore = baseMentions.filter(function (b) { return b.end <= valueIndex; });
    var mentionsAfter = baseMentions.filter(function (b) { return b.index >= valueEnd; });

    var toBase = null;

    // "X of <value>" or "binary of 255" — the before-mention is a target
    // because "of" flips the direction.
    if (fromBase === null && mentionsBefore.length > 0) {
        var mb = mentionsBefore[mentionsBefore.length - 1];
        var between = work.slice(mb.end, valueIndex);
        var hasOf = /\bof\b/i.test(between);
        if (hasOf) {
            toBase = mb.base;
        } else {
            fromBase = mb.base; // "binary 1010" — mention is source
        }
    }

    // Any mention after the value is a target.
    if (toBase === null && mentionsAfter.length > 0) {
        toBase = mentionsAfter[0].base;
    }

    // If nothing classified yet but we found mentions, use the first as target.
    if (fromBase === null && toBase === null && baseMentions.length > 0) {
        toBase = baseMentions[0].base;
    }

    // ── Default source if still unset ──
    // If the value has hex letters A-F, assume it's hex; otherwise decimal.
    if (fromBase === null) {
        fromBase = /[A-F]/i.test(valueStr) ? 16 : 10;
    }

    return {
        value: valueStr,
        fromBase: fromBase,
        toBase: toBase,
        showAll: toBase === null
    };
}

// ── Value validation ──
function baseValidateDigits(digits, base) {
    if (base < 2 || base > 36) return false;
    for (var i = 0; i < digits.length; i++) {
        var d = BASE_DIGITS.indexOf(digits[i].toUpperCase());
        if (d < 0 || d >= base) return false;
    }
    return true;
}

// ── Conversion core (BigInt) ──
function baseToBigInt(digits, base) {
    var result = 0n;
    var bigBase = BigInt(base);
    for (var i = 0; i < digits.length; i++) {
        var d = BASE_DIGITS.indexOf(digits[i].toUpperCase());
        result = result * bigBase + BigInt(d);
    }
    return result;
}

function baseFromBigInt(n, base) {
    if (n === 0n) return '0';
    var neg = n < 0n;
    if (neg) n = -n;
    var bigBase = BigInt(base);
    var out = '';
    while (n > 0n) {
        var d = Number(n % bigBase);
        out = BASE_DIGITS[d] + out;
        n = n / bigBase;
    }
    return (neg ? '-' : '') + out;
}

// ── Display helpers ──
function baseGroupBinary(digits) {
    var neg = digits[0] === '-';
    var d = neg ? digits.slice(1) : digits;
    var groups = [];
    for (var i = d.length; i > 0; i -= 4) {
        groups.unshift(d.slice(Math.max(0, i - 4), i));
    }
    return (neg ? '-' : '') + groups.join(' ');
}

function baseGroupHex(digits) {
    var neg = digits[0] === '-';
    var d = neg ? digits.slice(1) : digits;
    if (d.length <= 4) return digits;
    var groups = [];
    for (var i = d.length; i > 0; i -= 4) {
        groups.unshift(d.slice(Math.max(0, i - 4), i));
    }
    return (neg ? '-' : '') + groups.join(' ');
}

function baseDisplayWithPrefix(digits, base) {
    if (base === 2) return '0b' + digits;
    if (base === 8) return '0o' + digits;
    if (base === 16) return '0x' + digits;
    return digits;
}

// ── Output builder ──
function baseHandle(rawText) {
    var parsed = baseParseRequest(rawText);
    if (!parsed || !parsed.value) {
        return baseErrorBox("Couldn't read that as a base conversion.");
    }

    if (!baseValidateDigits(parsed.value, parsed.fromBase)) {
        return baseErrorBox('"' + parsed.value + '" contains digits that aren\'t valid in ' + baseNumToName(parsed.fromBase) + '.');
    }

    var decValue = baseToBigInt(parsed.value, parsed.fromBase);

    var parts = [];
    parts.push('<div class="xetex-output base-output">');
    parts.push('<div class="xetex-equation">Base Conversion</div>');

    // Step 1: read source
    parts.push('<div class="xetex-step"><div class="xetex-step-num">1</div><div class="xetex-step-body">Read the input</div></div>');
    parts.push('<div class="xetex-indent">' + baseNumToName(parsed.fromBase) + ': <b>' + parsed.value + '</b>' + baseSubscript(parsed.fromBase) + '</div>');

    // Step 2: to decimal
    parts.push('<div class="xetex-step"><div class="xetex-step-num">2</div><div class="xetex-step-body">Convert to decimal</div></div>');
    parts.push('<div class="xetex-indent">' + parsed.value + baseSubscript(parsed.fromBase) + ' = ' + decValue.toString() + baseSubscript(10) + '</div>');

    if (parsed.showAll || parsed.toBase === null) {
        // All common representations
        parts.push('<div class="xetex-step"><div class="xetex-step-num">3</div><div class="xetex-step-body">All common representations</div></div>');
        var bases = [2, 8, 10, 16];
        for (var i = 0; i < bases.length; i++) {
            var b = bases[i];
            var d = baseFromBigInt(decValue, b);
            var formatted = b === 2 ? baseGroupBinary(d) : (b === 16 ? baseGroupHex(d) : d);
            var suffix = (b === 2 || b === 8 || b === 16) ? '  <span style="opacity:0.6">(' + baseDisplayWithPrefix(d, b) + ')</span>' : '';
            parts.push('<div class="xetex-indent"><b>' + baseNumToName(b) + '</b>: ' + formatted + baseSubscript(b) + suffix + '</div>');
        }
        var answerDec = baseFromBigInt(decValue, 10);
        parts.push('<div class="xetex-answer"><span class="xetex-answer-label">Decimal</span><span class="xetex-answer-val">' + answerDec + '</span></div>');
    } else {
        // Specific target
        var outDigits = baseFromBigInt(decValue, parsed.toBase);
        parts.push('<div class="xetex-step"><div class="xetex-step-num">3</div><div class="xetex-step-body">Convert to ' + baseNumToName(parsed.toBase) + '</div></div>');
        parts.push('<div class="xetex-indent">' + decValue.toString() + baseSubscript(10) + ' = ' + outDigits + baseSubscript(parsed.toBase) + '</div>');

        var formatted = parsed.toBase === 2 ? baseGroupBinary(outDigits) : (parsed.toBase === 16 ? baseGroupHex(outDigits) : outDigits);
        var prefix = baseDisplayWithPrefix(outDigits, parsed.toBase);

        parts.push('<div class="xetex-answer">');
        parts.push('<span class="xetex-answer-label">Answer</span>');
        parts.push('<span class="xetex-answer-val">' + formatted + baseSubscript(parsed.toBase) + '</span>');
        if (parsed.toBase === 2 || parsed.toBase === 8 || parsed.toBase === 16) {
            parts.push('<span class="xetex-answer-val">' + prefix + '</span>');
        }
        parts.push('</div>');
    }

    parts.push('</div>');
    return { __html: true, text: parts.join('') };
}

function baseErrorBox(msg) {
    return {
        __html: true,
        text: '<div class="xetex-output base-output"><div class="xetex-error">' + msg + '</div></div>'
    };
}

// ── Exports ──
window.isBaseConversion = isBaseConversion;
window.baseHandle = baseHandle;