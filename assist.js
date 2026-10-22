// assist.js — small conversational handlers + choice memory
//
// Handles three categories the knowledge engine doesn't touch:
//   1. CHOICE  — "bat or ball?", "choose a fruit 🍌🍍🥭🍊🍎",
//               "pick a number between 1 and 10",
//               "choose a letter from a to z"
//   2. COUNT   — "count from 1 to 10", "count to 20"
//   3. ADVICE  — "what should I buy, phone or laptop?"
//
// Choice memory: after any pick, the options/range and the picks already
// made are stored. "Pick another", "again", "one more", "try again",
// "something else", etc. — all reuse the same memory and give a fresh
// pick that excludes previous ones.
//
// Builders signal output format by their return type:
//   - String starting with '<'   → styled output card
//   - Any other string           → plain chat reply

// ═══════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════

function isAssistRequest(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    if (!t || t.length > 300) return false;

    // Reject other engines.
    if (/^\/(para|paragraph|essay|know|write|email|letter|application)\b/i.test(t)) return false;
    if (/\b(c\s*program|compile|syntax\s+error|integrate|differentiate)\b/i.test(t)) return false;
    if (/\b(binary|hex|octal)\b/i.test(t) && /\b(convert|to)\b/i.test(t)) return false;

    // Follow-up to a previous pick — must run before other checks.
    if (assistDetectPickAgain(t)) return true;

    // Count
    if (/\bcount\s+(?:from\s+(\d+)\s+to\s+(\d+)|to\s+(\d+)|up\s+to\s+(\d+))\b/i.test(t)) return true;
    if (/^count\b/i.test(t) && /\d/.test(t)) return true;

    // Choice — bat or ball, choose a fruit, pick one
    if (/\b(?:which\s+(?:one\s+)?(?:would|will|do|should)\s+(?:you|i)|choose\s+(?:one|a|an)|pick\s+(?:one|a|an))\b/i.test(t)) return true;
    if (/\b(?:would|will)\s+you\s+(?:choose|pick|prefer)\b/i.test(t)) return true;
    if (/\bif\s+(?:i|you)\s+(?:gave|give)\s+(?:you\s+)?(?:a\s+)?choice\b/i.test(t)) return true;
    if (/\bchoose\s+(?:among|between|from)\b/i.test(t)) return true;

    // Range choice
    if (/\b(?:pick|choose|select|give\s+me|tell\s+me|random)\b.{0,30}\b(?:between|from)\s+-?\d+(?:\.\d+)?\s+(?:and|to|-|–)\s+-?\d+/i.test(t)) return true;
    if (/\b(?:a\s+)?(?:random\s+)?(?:number|digit|letter)\s+(?:between|from)\s+\S+\s+(?:and|to|-|–)\s+\S+/i.test(t)) return true;
    if (/^(?:pick|choose|give\s+me|tell\s+me)\s+(?:a\s+)?(?:random\s+)?number\b/i.test(t)) return true;
    if (/^(?:pick|choose|give\s+me|tell\s+me)\s+(?:a\s+)?(?:random\s+)?letter\b/i.test(t)) return true;

    // Advice
    if (/\b(?:what|which)\s+(?:should|do)\s+i\s+(?:buy|get|pick|choose|go\s+for)\b/i.test(t)) return true;
    if (/\b(?:help\s+me\s+(?:decide|choose|pick))\b/i.test(t)) return true;
    if (/\b(?:which\s+(?:one|is\s+better))\s+(?:should\s+i|to\s+(?:buy|get|pick))\b/i.test(t)) return true;

    return false;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function assistEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Deterministic seed from text.
function assistSeed(text) {
    var seed = 0;
    for (var i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    return seed;
}

// ═══════════════════════════════════════════════════════════════════
// CHOICE MEMORY
// ═══════════════════════════════════════════════════════════════════

var __assistMemory = null;
var ASSIST_MEMORY_MS = 15 * 60 * 1000; // 15 min

function assistMemoryStore(m) {
    if (!m) { __assistMemory = null; return; }
    m.timestamp = Date.now();
    __assistMemory = m;
}

function assistMemoryGet() {
    if (!__assistMemory) return null;
    if (Date.now() - __assistMemory.timestamp > ASSIST_MEMORY_MS) {
        __assistMemory = null;
        return null;
    }
    return __assistMemory;
}

// Detects "pick another", "again", "one more", "try again", etc.
function assistDetectPickAgain(text) {
    if (!assistMemoryGet()) return false;
    var t = String(text || '').trim().toLowerCase();
    if (!t || t.length > 60) return false;

    // Strip leading verb if present.
    var body = t.replace(/^(?:pick|choose|give|show|tell)\s+(?:me\s+)?/, '').trim();
    return /^(?:another(?:\s+(?:one|pick|option))?|again|one\s+more|something\s+else|a\s+(?:new|different)\s+one|different\s+one|next(?:\s+one)?|try\s+again)\s*[.!?]*$/.test(body);
}

// ═══════════════════════════════════════════════════════════════════
// OPTION / RANGE EXTRACTION
// ═══════════════════════════════════════════════════════════════════

function assistExtractOptions(text) {
    var t = text.trim();

    // Emoji run
    var emojiRun = t.match(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}]\uFE0F?\s*){2,}/u);
    if (emojiRun) {
        var emojis = emojiRun[0].match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}]\uFE0F?/gu);
        if (emojis && emojis.length >= 2) return emojis;
    }

    t = t
        .replace(/^.*?\b(?:between|among|from)\s+/i, '')
        .replace(/^.*?\bchoice\s+(?:between\s+)?/i, '')
        .replace(/^.*?\b(?:choose|pick|select)\s+(?:one\s+|a\s+|an\s+)?/i, '')
        .replace(/[?!.]+$/g, '')
        .trim();
    t = t.replace(/^.*?\b(?:choose|pick)\s*,\s*/i, '').trim();

    var parts = t.split(/\s*,\s*|\s+or\s+|\s*\/\s*/i)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s && s.length <= 40; });

    parts = parts.filter(function (s) {
        return !/^(which|one|would|you|will|do|should|i|a|an|the|is|are|it|this|that|these|those)$/i.test(s);
    });

    return parts.length >= 2 ? parts : null;
}

function assistExtractRange(text) {
    var t = text.toLowerCase();

    var m = t.match(/\b(?:between|from)\s+(-?\d+(?:\.\d+)?)\s+(?:and|to|-|–)\s+(-?\d+(?:\.\d+)?)\b/);
    if (!m) m = t.match(/\b(-?\d+(?:\.\d+)?)\s+(?:to|-|–)\s+(-?\d+(?:\.\d+)?)\b/);
    if (m) {
        var lo = parseFloat(m[1]);
        var hi = parseFloat(m[2]);
        if (isFinite(lo) && isFinite(hi)) {
            if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
            var isInt = Number.isInteger(lo) && Number.isInteger(hi);
            return { type: 'number', lo: lo, hi: hi, isInt: isInt };
        }
    }

    var ml = t.match(/\b(?:between|from)\s+([a-z])\s+(?:and|to|-|–)\s+([a-z])\b/);
    if (!ml) ml = t.match(/\b([a-z])\s+(?:to|-|–)\s+([a-z])\b/);
    if (ml) {
        var a = ml[1].charCodeAt(0);
        var b = ml[2].charCodeAt(0);
        if (a > b) { var tmp2 = a; a = b; b = tmp2; }
        return { type: 'letter', lo: a, hi: b };
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════
// EXCLUSION-AWARE PICKERS
// ═══════════════════════════════════════════════════════════════════

function assistPickFromOptions(text, options, excluded) {
    var available = [];
    for (var i = 0; i < options.length; i++) {
        if (excluded.indexOf(options[i]) === -1) available.push(options[i]);
    }
    if (!available.length) return null;
    var seed = assistSeed(text + '|' + excluded.length);
    return available[seed % available.length];
}

function assistPickFromRange(text, range, excluded) {
    if (range.type === 'number' && range.isInt) {
        var lo = Math.floor(range.lo);
        var hi = Math.floor(range.hi);
        var availableNums = [];
        for (var n = lo; n <= hi; n++) {
            if (excluded.indexOf(String(n)) === -1) availableNums.push(String(n));
        }
        if (!availableNums.length) return null;
        var seedN = assistSeed(text + '|' + excluded.length);
        return availableNums[seedN % availableNums.length];
    }
    if (range.type === 'number') {
        var seedF = assistSeed(text + '|' + excluded.length);
        var val = range.lo + (seedF / 0xFFFFFFFF) * (range.hi - range.lo);
        val = Math.round(val * 100) / 100;
        var s = String(val);
        if (excluded.indexOf(s) !== -1) {
            val = Math.round((val + 0.01) * 100) / 100;
            s = String(val);
        }
        return s;
    }
    if (range.type === 'letter') {
        var availableLetters = [];
        for (var c = range.lo; c <= range.hi; c++) {
            var L = String.fromCharCode(c).toUpperCase();
            if (excluded.indexOf(L) === -1) availableLetters.push(L);
        }
        if (!availableLetters.length) return null;
        var seedL = assistSeed(text + '|' + excluded.length);
        return availableLetters[seedL % availableLetters.length];
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════
// CHOICE BUILDERS
// ═══════════════════════════════════════════════════════════════════

var ASSIST_CHOICE_REASONS = [
    'it feels like the more dependable option.',
    'it has a certain quiet charm I can\'t ignore.',
    'it just seems like the better fit.',
    'I keep coming back to it.',
    'it feels like the choice that grows on you.'
];

function assistBuildChoice(text) {
    // 1. Range-based choice.
    var range = assistExtractRange(text);
    if (range) return assistBuildRangeChoice(text, range);

    // 2. Bare "pick a number" / "pick a letter" with no range.
    if (/^(?:pick|choose|give\s+me|tell\s+me)\s+(?:a\s+)?(?:random\s+)?number\b/i.test(text.trim())) {
        return 'What range? Try /assist pick a number between 1 and 100.';
    }
    if (/^(?:pick|choose|give\s+me|tell\s+me)\s+(?:a\s+)?(?:random\s+)?letter\b/i.test(text.trim())) {
        return 'What range? Try /assist pick a letter from a to f.';
    }

    // 3. List-based choice.
    var options = assistExtractOptions(text);
    if (!options || options.length < 2) {
        return 'Give me at least two things to choose between — like "bat or ball" or "coffee or tea".';
    }

    var picked = assistPickFromOptions(text, options, []);
    var seed = assistSeed(text);
    var reason = ASSIST_CHOICE_REASONS[seed % ASSIST_CHOICE_REASONS.length];

    // Store memory for follow-ups.
    assistMemoryStore({
        kind: 'list',
        originalText: text,
        options: options.slice(),
        used: [picked]
    });

    var html = [];
    html.push('<div class="xetex-equation">My pick</div>');
    html.push('<div class="para-body"><p class="para-line" style="font-size:1.375rem;text-align:center;font-weight:600;">' +
        assistEsc(picked) + '</p></div>');
    html.push('<div class="para-explain">I\'d go with <b>' + assistEsc(picked) + '</b> — ' + reason + '</div>');

    var others = options.filter(function (o) { return o !== picked; });
    if (others.length) {
        html.push('<div class="para-intro" style="margin-top:10px;">' +
            (others.length === 1
                ? 'Not ' + assistEsc(others[0]) + ' this time.'
                : 'Not ' + others.map(assistEsc).join(', ') + ' this time.') +
            '</div>');
    }

    html.push('<div class="para-closing">Want another pick, or a different set of options?</div>');
    return html.join('');
}

function assistBuildRangeChoice(text, range) {
    var picked = assistPickFromRange(text, range, []);
    if (picked === null) return 'That range is empty.';

    assistMemoryStore({
        kind: 'range',
        originalText: text,
        range: range,
        used: [picked]
    });

    return assistRenderRangePick(picked, range, 1, 'My pick', 'Want a different range, or another pick?');
}

// Render a range pick as a card.
function assistRenderRangePick(value, range, pickIndex, title, closing) {
    var html = [];
    html.push('<div class="xetex-equation">' + assistEsc(title) + '</div>');
    html.push('<div class="para-body"><p class="para-line" style="font-size:1.75rem;text-align:center;font-weight:600;">' +
        assistEsc(value) + '</p></div>');

    if (range.type === 'number' && range.isInt) {
        var total = Math.floor(range.hi) - Math.floor(range.lo) + 1;
        html.push('<div class="para-intro" style="text-align:center;">from the range ' +
            assistEsc(String(range.lo)) + '–' + assistEsc(String(range.hi)) +
            (pickIndex > 1 ? ' · pick ' + pickIndex + ' of ' + total : '') + '</div>');
    } else if (range.type === 'letter') {
        html.push('<div class="para-intro" style="text-align:center;">from the range ' +
            assistEsc(String.fromCharCode(range.lo).toUpperCase()) + '–' +
            assistEsc(String.fromCharCode(range.hi).toUpperCase()) + '</div>');
    } else {
        html.push('<div class="para-intro" style="text-align:center;">from the range ' +
            assistEsc(String(range.lo)) + '–' + assistEsc(String(range.hi)) + '</div>');
    }

    html.push('<div class="para-closing">' + assistEsc(closing) + '</div>');
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// "PICK ANOTHER" — uses memory, excludes previous picks
// ═══════════════════════════════════════════════════════════════════

function assistBuildPickAgain() {
    var mem = assistMemoryGet();
    if (!mem) return 'No recent pick to repeat. Run /assist with some options first.';

    // ── List ──
    if (mem.kind === 'list') {
        var picked = assistPickFromOptions(mem.originalText, mem.options, mem.used);

        if (picked === null) {
            // Every option already shown. Reset, keep only the very last
            // pick so we don't repeat it immediately, and try again.
            var lastPicked = mem.used[mem.used.length - 1];
            mem.used = [lastPicked];
            picked = assistPickFromOptions(mem.originalText, mem.options, mem.used);

            if (picked === null) {
                // Only one option total.
                return 'There\'s only one option to pick from — <b>' + assistEsc(mem.options[0]) + '</b>.';
            }
        }

        mem.used.push(picked);
        assistMemoryStore(mem);

        var reason = ASSIST_CHOICE_REASONS[assistSeed(mem.originalText + mem.used.length) % ASSIST_CHOICE_REASONS.length];

        var html = [];
        html.push('<div class="xetex-equation">Another pick</div>');
        html.push('<div class="para-body"><p class="para-line" style="font-size:1.375rem;text-align:center;font-weight:600;">' +
            assistEsc(picked) + '</p></div>');
        html.push('<div class="para-explain">This time — <b>' + assistEsc(picked) + '</b>, because ' + reason + '</div>');

        var remaining = [];
        for (var i = 0; i < mem.options.length; i++) {
            if (mem.used.indexOf(mem.options[i]) === -1) remaining.push(mem.options[i]);
        }
        if (remaining.length) {
            html.push('<div class="para-intro" style="margin-top:10px;">Still unpicked: ' +
                remaining.map(assistEsc).join(', ') + '</div>');
        } else {
            html.push('<div class="para-intro" style="margin-top:10px;">That was the last option. Send /assist pick another to start fresh.</div>');
        }

        html.push('<div class="para-closing">Want another pick, or a different set?</div>');
        return html.join('');
    }

    // ── Range ──
    if (mem.kind === 'range') {
        var picked2 = assistPickFromRange(mem.originalText, mem.range, mem.used);

        if (picked2 === null) {
            // Range exhausted. Reset to keep only the last pick.
            var last2 = mem.used[mem.used.length - 1];
            mem.used = [last2];
            picked2 = assistPickFromRange(mem.originalText, mem.range, mem.used);

            if (picked2 === null) {
                return 'That range only has one value: <b>' + assistEsc(String(mem.range.lo)) + '</b>.';
            }
        }

        mem.used.push(picked2);
        assistMemoryStore(mem);

        var total2 = mem.range.type === 'number' && mem.range.isInt
            ? Math.floor(mem.range.hi) - Math.floor(mem.range.lo) + 1
            : null;

        var html2 = [];
        html2.push('<div class="xetex-equation">Another pick</div>');
        html2.push('<div class="para-body"><p class="para-line" style="font-size:1.75rem;text-align:center;font-weight:600;">' +
            assistEsc(String(picked2)) + '</p></div>');

        if (mem.range.type === 'number' && mem.range.isInt) {
            html2.push('<div class="para-intro" style="text-align:center;">from the range ' +
                assistEsc(String(mem.range.lo)) + '–' + assistEsc(String(mem.range.hi)) +
                ' · pick ' + mem.used.length + ' of ' + total2 + '</div>');
        } else if (mem.range.type === 'letter') {
            html2.push('<div class="para-intro" style="text-align:center;">from the range ' +
                assistEsc(String.fromCharCode(mem.range.lo).toUpperCase()) + '–' +
                assistEsc(String.fromCharCode(mem.range.hi).toUpperCase()) + '</div>');
        } else {
            html2.push('<div class="para-intro" style="text-align:center;">from the range ' +
                assistEsc(String(mem.range.lo)) + '–' + assistEsc(String(mem.range.hi)) + '</div>');
        }

        html2.push('<div class="para-closing">Want another pick, or a different range?</div>');
        return html2.join('');
    }

    return 'I don\'t have a recent pick to repeat from.';
}

// ═══════════════════════════════════════════════════════════════════
// COUNT HANDLER
// ═══════════════════════════════════════════════════════════════════

function assistBuildCount(text) {
    var t = text.toLowerCase();
    var m = t.match(/from\s+(\d+)\s+to\s+(\d+)/);
    var from = 1, to = null;
    if (m) { from = parseInt(m[1], 10); to = parseInt(m[2], 10); }
    else {
        m = t.match(/to\s+(\d+)/);
        if (m) to = parseInt(m[1], 10);
    }

    if (to === null) return 'Tell me a number — like "count from 1 to 10".';
    if (Math.abs(to - from) > 1000) return 'That\'s a big range — try something under 1000.';

    var nums = [];
    var step = from <= to ? 1 : -1;
    for (var n = from; step > 0 ? n <= to : n >= to; n += step) nums.push(n);

    var html = [];
    html.push('<div class="xetex-equation">Counting ' + from + ' to ' + to + '</div>');
    html.push('<div class="para-body"><p class="para-line" style="font-family:monospace;font-size:1rem;line-height:1.9;">' +
        nums.join(', ') + '</p></div>');
    html.push('<div class="para-closing">Want a different range, or count by 2s or 5s?</div>');
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// ADVICE HANDLER
// ═══════════════════════════════════════════════════════════════════

function assistBuildAdvice(text) {
    var options = assistExtractOptions(text);

    var cleanOptions = (options || []).map(function (o) {
        return o.replace(/\b(one|thing|option)\b/gi, '').trim();
    }).filter(Boolean);

    if (!cleanOptions || cleanOptions.length < 2) {
        return 'Tell me what you\'re comparing — like "phone or laptop" or "this laptop vs that laptop" — and I\'ll help you think through the trade-offs.';
    }

    var html = [];
    html.push('<div class="xetex-equation">Choosing between ' + cleanOptions.map(assistEsc).join(' and ') + '</div>');
    html.push('<div class="para-intro">Before I weigh in, I need to know what actually matters to you. Here are the questions that usually decide this:</div>');
    html.push('<div class="para-keypoints-heading">What to tell me</div>');
    html.push('<ul class="para-keypoints">' +
        '<li><b>Budget</b> — what\'s your comfortable range?</li>' +
        '<li><b>Primary use</b> — what will you do with it most of the time?</li>' +
        '<li><b>Portability</b> — will you carry it around, or does it stay in one place?</li>' +
        '<li><b>Lifespan</b> — how many years do you expect to use it?</li>' +
        '<li><b>Priorities</b> — speed, battery, screen, storage, price — rank what matters most.</li>' +
        '</ul>');
    html.push('<div class="para-explain"><b>Why I ask:</b> the "right" answer changes entirely depending on these. ' +
        'A phone wins on portability, a laptop on typing and serious work, a tablet on media and reading, a PC on raw performance and upgradability. ' +
        'Without knowing your priorities, any recommendation would be a guess.</div>');
    html.push('<div class="para-closing">Answer any of those and I\'ll give you a clear recommendation.</div>');
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

function assistHandle(text) {
    var t = text.trim();

    var inner;

    // Follow-up to a previous pick — highest priority.
    if (assistDetectPickAgain(t)) {
        inner = assistBuildPickAgain();
    } else if (/\bcount\b/i.test(t) && /\d/.test(t)) {
        inner = assistBuildCount(t);
    } else if (/\b(?:what|which)\s+(?:should|do)\s+i\s+(?:buy|get|pick|choose|go\s+for)\b/i.test(t) ||
               /\bhelp\s+me\s+(?:decide|choose|pick)\b/i.test(t) ||
               /\bwhich\s+(?:one|is\s+better)\s+(?:should\s+i|to\s+(?:buy|get|pick))\b/i.test(t)) {
        inner = assistBuildAdvice(t);
    } else {
        inner = assistBuildChoice(t);
    }

    // Plain chat reply — string doesn't start with '<'.
    if (typeof inner === 'string' && inner.charAt(0) !== '<') {
        return inner;
    }

    return { __html: true, text: '<div class="xetex-output para-output">' + inner + '</div>' };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

window.isAssistRequest = isAssistRequest;
window.assistHandle = assistHandle;