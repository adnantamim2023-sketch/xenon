// reasoning.js — Text + Word-Problem Reasoning Engine
//
// Handles prompts that symbolic math can't touch:
//   1. TEXT ANALYSIS   — "how many r's in strawberry"
//                        "how many y's in my prompt"
//                        "how many letters in banana"
//                        "count the words"
//   2. VOWEL / CONSONANT — "how many vowels in banana"
//                        "how many consonants are there" (uses memory)
//   3. COMPARISONS     — "is 9 bigger than 10"
//                        "is Dhaka bigger than Chittagong"
//   4. TRANSACTIONS    — "had 100 tk, spent 70, got 30 back, how much left"
//   5. DISTRIBUTION    — "57 mangos among 3, I want more"
//   6. TWO-VARIABLE    — "10 pens + 2 pencils = 170, pens cost half pencils"
//
// Design rules:
//   - Detection runs AFTER paragraph/assist, BEFORE math-basic
//   - When a prompt is ambiguous (like "2 times less than"), the engine
//     presents alternatives instead of guessing
//   - Last-word memory lets follow-ups like "how many consonants are there"
//     resolve to the most recently analysed word

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

function rsnEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rsnTitle(t)  { return '<div class="xetex-equation">' + rsnEsc(t) + '</div>'; }
function rsnHeading(t){ return '<div class="para-keypoints-heading">' + rsnEsc(t) + '</div>'; }
function rsnNote(t)   { return '<div class="para-explain">' + t + '</div>'; }
function rsnBody(t)   { return '<div class="para-body"><p class="para-line">' + t + '</p></div>'; }
function rsnClose(t)  { return '<div class="para-closing">' + rsnEsc(t) + '</div>'; }
function rsnList(items) {
    var out = ['<ul class="para-keypoints">'];
    for (var i = 0; i < items.length; i++) out.push('<li>' + rsnEsc(items[i]) + '</li>');
    out.push('</ul>');
    return out.join('');
}

// ═══════════════════════════════════════════════════════════════════
// LAST-WORD MEMORY
// Remembers the last word/phrase analysed so follow-ups like
// "how many consonants are there" resolve to it.
// ═══════════════════════════════════════════════════════════════════

var __rsnLastWord = null;
var __rsnLastWordAt = 0;
var RSN_LAST_WORD_MS = 15 * 60 * 1000;

function rsnRememberWord(word) {
    if (!word || typeof word !== 'string') return;
    __rsnLastWord = word;
    __rsnLastWordAt = Date.now();
}

function rsnGetRememberedWord() {
    if (!__rsnLastWord) return null;
    if (Date.now() - __rsnLastWordAt > RSN_LAST_WORD_MS) {
        __rsnLastWord = null;
        return null;
    }
    return __rsnLastWord;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 — VOWEL / CONSONANT COUNTING
// ═══════════════════════════════════════════════════════════════════

function rsnVowelDetect(text) {
    var t = String(text || '').trim().toLowerCase();
    if (!t || t.length > 200) return false;
    var mentions = /\b(?:vowels?|consonants?)\b/.test(t);
    if (!mentions) return false;
    // Require a counting context OR a target phrase — avoids firing on
    // random sentences that happen to contain the word "vowel".
    return /\b(?:how\s+many|count|number\s+of)\b/.test(t)
        || /\b(?:in|of|within)\s+[a-z]/.test(t)
        || /\b(?:does|do)\s+[a-z]+\s+(?:have|contain)/.test(t);
}

function rsnVowelParse(text) {
    var t = String(text || '').trim();
    var lower = t.toLowerCase();

    var kind = null;
    if (/\bvowels?\b/.test(lower)) kind = 'vowels';
    if (/\bconsonants?\b/.test(lower)) kind = 'consonants';
    if (!kind) return null;

    // Explicit target: "in banana", "in the word X", "of X", "within X"
    var m = t.match(/\b(?:in|of|within)\s+(?:the\s+word\s+|the\s+|"|')?([a-zA-Z]+)["']?\s*[.?!]*$/i);
    if (m && m[1]) {
        return { kind: kind, target: m[1], self: false };
    }

    // "how many vowels does X have"
    m = t.match(/\b(?:does|do)\s+([a-zA-Z]+)\s+(?:have|contain)/i);
    if (m && m[1]) {
        return { kind: kind, target: m[1], self: false };
    }

    // "vowels in strawberry" (no leading verb)
    m = t.match(/\b(?:in|of|within)\s+([a-zA-Z]+)\b/i);
    if (m && m[1]) {
        return { kind: kind, target: m[1], self: false };
    }

    // No explicit target — use the remembered word.
    var remembered = rsnGetRememberedWord();
    if (remembered) {
        return { kind: kind, target: remembered, self: true };
    }

    return { kind: kind, target: null, self: true };
}
function rsnVowelHandle(text) {
    var parsed = rsnVowelParse(text);
    if (!parsed) return rsnTitle('Vowel / Consonant Count') + rsnNote('I couldn\'t read that.');

    if (!parsed.target) {
        return rsnTitle('Vowel / Consonant Count') +
            rsnNote('No word to analyse. Try: <b>/reasoning how many vowels in banana</b>.');
    }

    var word = parsed.target;
    var lower = word.toLowerCase();
    var vowels = [], consonants = [];
    var VOWELS = 'aeiou';

    for (var i = 0; i < lower.length; i++) {
        var ch = lower[i];
        if (!/[a-z]/.test(ch)) continue;
        if (VOWELS.indexOf(ch) !== -1) vowels.push(ch);
        else consonants.push(ch);
    }

    var list = parsed.kind === 'vowels' ? vowels : consonants;
    var other = parsed.kind === 'vowels' ? consonants : vowels;
    var label = parsed.kind === 'vowels' ? 'Vowels' : 'Consonants';

    // Remember for the next follow-up.
    rsnRememberWord(word);

    var html = [];
    html.push(rsnTitle(label + ' — "' + word + '"'));
    html.push(rsnBody('Word analysed: <b>' + rsnEsc(word) + '</b>'));

    html.push(rsnHeading(label));
    if (list.length === 0) {
        html.push(rsnNote('No ' + parsed.kind + ' found in this word.'));
    } else {
        html.push(rsnNote('Found <b>' + list.length + '</b> ' + parsed.kind + ': <b>' +
            rsnEsc(list.join(' · ')) + '</b>'));
    }

    html.push(rsnHeading('The other side'));
    html.push(rsnNote(other.length + ' ' +
        (parsed.kind === 'vowels' ? 'consonants' : 'vowels') + ': <b>' +
        rsnEsc(other.join(' · ')) + '</b>'));

    html.push(rsnBody('Answer: <b>' + list.length + '</b>'));
    html.push(rsnClose('Want the total letter count, or a different word?'));
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — TEXT ANALYSIS (letter/word/char counting)
// ═══════════════════════════════════════════════════════════════════

function rsnTextDetect(text) {
    var t = String(text || '').trim();
    if (!t || t.length > 400) return false;

    if (/\b(?:how\s+many|count(?:\s+the)?|number\s+of)\s+([a-z])(?:'s)?\s+(?:are\s+)?(?:there\s+)?(?:in|inside|within)\b/i.test(t)) return true;
    if (/\b(?:how\s+many|count)\s+([a-z])(?:'s)?\s+(?:does\s+)?(?:my\s+)?(?:prompt|message|text|sentence|string)\b/i.test(t)) return true;
    if (/\b(?:how\s+many|count(?:\s+the)?)\s+words?\b/i.test(t)) return true;
    if (/\b(?:how\s+many|count(?:\s+the)?)\s+(?:characters?|chars?|letters?)\b/i.test(t)) return true;

    return false;
}

function rsnTextParse(text) {
    var t = text.trim();
    var target = null;
    var needle = null;

    // "how many r in strawberry" (single letter)
    var m = t.match(/\b(?:how\s+many|count(?:\s+the)?|number\s+of)\s+([a-z])(?:'s)?\s+(?:are\s+)?(?:there\s+)?(?:in|inside|within)\s+(?:the\s+word\s+|the\s+|"|')?([^"']+?)["']?\s*[.?!]*$/i);
    if (m) {
        needle = m[1].toLowerCase();
        target = m[2].trim();
        return { kind: 'letter', needle: needle, target: target };
    }

    // "how many r does my prompt contain"
    m = t.match(/\b(?:how\s+many|count)\s+([a-z])(?:'s)?\s+(?:does\s+)?(?:my\s+)?(?:prompt|message|text|sentence|string)\s*(?:contains?|has|have)?\b/i);
    if (m) {
        needle = m[1].toLowerCase();
        target = t;
        return { kind: 'letter', needle: needle, target: target, self: true };
    }

    // "how many letters in the word banana" / "how many letters in banana"
    m = t.match(/\b(?:how\s+many|count(?:\s+the)?)\s+letters?\s+(?:are\s+)?(?:there\s+)?(?:in|does|has)\s+(?:the\s+word\s+|the\s+|"|')?([^"']+?)["']?\s*(?:have|contain|contain\s+)?[.?!]*$/i);
    if (m && m[1] && m[1].trim()) {
        return { kind: 'chars', target: m[1].trim().replace(/^["']|["']$/g, '') };
    }

    // "how many words in ..."
    m = t.match(/\b(?:how\s+many|count(?:\s+the)?)\s+words?\s+(?:are\s+)?(?:in|does)\s+(?:the\s+)?(?:sentence|text|string|phrase)?\s*(.+?)[.?!]*$/i);
    if (m && m[1] && m[1].trim()) {
        return { kind: 'words', target: m[1].trim().replace(/^["']|["']$/g, '') };
    }

    // "how many characters in ..."
    m = t.match(/\b(?:how\s+many|count(?:\s+the)?)\s+(?:characters?|chars?)\s+(?:are\s+)?(?:in|does)\s+(.+?)[.?!]*$/i);
    if (m && m[1]) {
        return { kind: 'chars', target: m[1].trim().replace(/^["']|["']$/g, '') };
    }

    return null;
}

function rsnTextHandle(text) {
    var parsed = rsnTextParse(text);
    if (!parsed) return rsnTitle('Text Analysis') + rsnNote('I couldn\'t read that as a counting request.');

    var html = [];

    if (parsed.kind === 'letter') {
        var target = parsed.target;
        var needle = parsed.needle;
        var lower = target.toLowerCase();
        var count = 0;
        var positions = [];
        for (var i = 0; i < lower.length; i++) {
            if (lower[i] === needle) { count++; positions.push(i + 1); }
        }

        // Remember the analysed text for follow-ups.
        rsnRememberWord(target);

        html.push(rsnTitle('Letter Count — "' + needle + '"'));
        html.push(rsnBody('Text analysed: <b>' + rsnEsc(target) + '</b>'));

        html.push(rsnHeading('How I counted'));
        if (count === 0) {
            html.push(rsnNote('The letter <b>' + rsnEsc(needle) + '</b> does not appear in that text at all.'));
        } else {
            html.push(rsnNote('The letter <b>' + rsnEsc(needle) + '</b> appears <b>' + count + '</b> time' +
                (count === 1 ? '' : 's') + ', at position' + (count === 1 ? '' : 's') + ' ' +
                positions.join(', ') + '.'));
        }

        html.push(rsnBody('Answer: <b>' + count + '</b>'));
        html.push(rsnClose('Want me to count a different letter, or count vowels/consonants?'));
        return html.join('');
    }

    if (parsed.kind === 'words') {
        var targetW = parsed.target;
        var words = (targetW.match(/\S+/g) || []);
        rsnRememberWord(targetW);
        html.push(rsnTitle('Word Count'));
        html.push(rsnBody('Text analysed: <b>' + rsnEsc(targetW) + '</b>'));
        html.push(rsnBody('Number of words: <b>' + words.length + '</b>'));
        if (words.length > 1) {
            html.push(rsnNote('Words: ' + words.map(function (w) { return rsnEsc(w); }).join(' · ')));
        }
        html.push(rsnClose('Want me to count characters or a specific letter?'));
        return html.join('');
    }

    if (parsed.kind === 'chars') {
        var targetC = parsed.target;
        var isWordContext = /\bword\s+/i.test(text) || /^[a-z]+$/i.test(targetC);
        var label = isWordContext ? 'Letters' : 'Characters';

        rsnRememberWord(targetC);

        html.push(rsnTitle(label + ' — "' + targetC + '"'));
        html.push(rsnBody('Text analysed: <b>' + rsnEsc(targetC) + '</b>'));
        html.push(rsnBody('Total ' + label.toLowerCase() + ': <b>' + targetC.length + '</b>'));

        if (isWordContext && targetC.length > 1) {
            var lettersList = targetC.toLowerCase().split('').join(' · ');
            html.push(rsnNote('Letters: ' + rsnEsc(lettersList)));
        } else {
            var noSpace = targetC.replace(/\s/g, '');
            html.push(rsnNote('Without spaces: <b>' + noSpace.length + '</b>'));
        }

        html.push(rsnClose('Want me to count a specific letter, or vowels vs consonants?'));
        return html.join('');
    }

    return rsnTitle('Text Analysis') + rsnNote('Something went wrong parsing that.');
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 3 — COMPARISONS
// ═══════════════════════════════════════════════════════════════════

var RSN_ENTITIES = {
    'dhaka':        { name: 'Dhaka',        category: 'city', population: 22.0, area: 306,  country: 'Bangladesh' },
    'chittagong':   { name: 'Chittagong',   category: 'city', population: 5.2,  area: 157,  country: 'Bangladesh' },
    'chattogram':   { name: 'Chattogram',   category: 'city', population: 5.2,  area: 157,  country: 'Bangladesh' },
    'khulna':       { name: 'Khulna',       category: 'city', population: 1.5,  area: 60,   country: 'Bangladesh' },
    'rajshahi':     { name: 'Rajshahi',     category: 'city', population: 1.0,  area: 96,   country: 'Bangladesh' },
    'sylhet':       { name: 'Sylhet',       category: 'city', population: 0.9,  area: 27,   country: 'Bangladesh' },
    'barisal':      { name: 'Barisal',      category: 'city', population: 0.5,  area: 20,   country: 'Bangladesh' },
    'rangpur':      { name: 'Rangpur',      category: 'city', population: 0.4,  area: 21,   country: 'Bangladesh' },
    'mymensingh':   { name: 'Mymensingh',   category: 'city', population: 0.5,  area: 21,   country: 'Bangladesh' },

    'bangladesh':   { name: 'Bangladesh',   category: 'country', population: 173, area: 148460 },
    'india':        { name: 'India',        category: 'country', population: 1428, area: 3287263 },
    'pakistan':     { name: 'Pakistan',     category: 'country', population: 240, area: 881913 },
    'china':        { name: 'China',        category: 'country', population: 1425, area: 9596961 },
    'usa':          { name: 'USA',          category: 'country', population: 335, area: 9833517 },

    'earth':        { name: 'Earth',        category: 'planet', population: null, area: 510.1, diameter: 12742, mass: 5.97 },
    'mars':         { name: 'Mars',         category: 'planet', population: null, area: 144.8, diameter: 6779, mass: 0.642 },
    'jupiter':      { name: 'Jupiter',      category: 'planet', population: null, area: 61419, diameter: 139820, mass: 1898 }
};

function rsnCompareDetect(text) {
    var t = String(text || '').trim();
    if (!t || t.length > 300) return false;

    if (/\bis\s+\S+\s+(?:bigger|larger|greater|smaller|less|lesser|higher|lower|more|equal|heavier|taller|shorter|younger|older)\s+than\s+\S+/i.test(t)) return true;
    if (/\bwhich\s+(?:is|one\s+is)\s+(?:bigger|larger|greater|smaller|less|higher|lower|more)\b/i.test(t)) return true;
    if (/\bis\s+\S+\s*[<>]\s*\S+/i.test(t) && /[a-zA-Z]{2,}/.test(t)) return true;

    return false;
}

function rsnCompareHandle(text) {
    var t = text.trim();

    var m = t.match(/\bis\s+(.+?)\s+(bigger|larger|greater|smaller|less|lesser|higher|lower|more|equal|heavier|taller|shorter|younger|older)\s+than\s+(.+?)\s*[.?!]*$/i);
    if (!m) {
        m = t.match(/\bwhich\s+(?:is|one\s+is)\s+(bigger|larger|greater|smaller|less|higher|lower|more)\s*[,:]?\s*(.+?)\s+or\s+(.+?)\s*[.?!]*$/i);
        if (m) {
            m = [m[0], m[2], m[1], m[3]];
        }
    }
    if (!m) {
        return rsnTitle('Comparison') + rsnNote('I couldn\'t read that as a comparison.');
    }

    var subjA = m[1].trim();
    var opWord = m[2].toLowerCase();
    var subjB = m[3].trim();

    var numA = parseFloat(subjA);
    var numB = parseFloat(subjB);
    if (isFinite(numA) && isFinite(numB)) {
        return rsnNumericCompare(numA, subjA, opWord, numB, subjB);
    }

    var aKey = subjA.toLowerCase();
    var bKey = subjB.toLowerCase();
    var a = RSN_ENTITIES[aKey];
    var b = RSN_ENTITIES[bKey];
    if (a || b) {
        return rsnEntityCompare(a, subjA, opWord, b, subjB);
    }

    return rsnTitle('Comparison') + rsnNote('I know how to compare numbers, and a few cities and countries. I don\'t have data on <b>' +
        rsnEsc(subjA) + '</b> or <b>' + rsnEsc(subjB) + '</b> yet.');
}

function rsnNumericCompare(a, aDisp, opWord, b, bDisp) {
    var isGreater = /bigger|larger|greater|higher|more/.test(opWord);
    var isLesser  = /smaller|less|lesser|lower/.test(opWord);

    var verdict;

    if (isGreater) {
        verdict = (a > b)
            ? 'Yes, <b>' + aDisp + '</b> is bigger than <b>' + bDisp + '</b>.'
            : 'No. <b>' + aDisp + '</b> is ' + (a < b ? 'smaller' : 'equal') + ' than <b>' + bDisp + '</b>.';
    } else if (isLesser) {
        verdict = (a < b)
            ? 'Yes, <b>' + aDisp + '</b> is smaller than <b>' + bDisp + '</b>.'
            : 'No. <b>' + aDisp + '</b> is ' + (a > b ? 'bigger' : 'equal') + ' than <b>' + bDisp + '</b>.';
    } else {
        verdict = (a === b) ? 'Yes, they are equal.' : 'No, they are not equal.';
    }

    var html = [];
    html.push(rsnTitle('Is ' + aDisp + ' ' + opWord + ' than ' + bDisp + '?'));
    html.push(rsnNote(verdict));
    html.push(rsnHeading('Working'));
    html.push(rsnList([
        aDisp + ' = ' + a,
        bDisp + ' = ' + b,
        a + ' ' + (a > b ? '>' : a < b ? '<' : '=') + ' ' + b
    ]));
    html.push(rsnClose('Want to compare other numbers?'));
    return html.join('');
}

function rsnEntityCompare(a, aDisp, opWord, b, bDisp) {
    if (!a) return rsnNote('I don\'t have data on <b>' + rsnEsc(aDisp) + '</b> yet.');
    if (!b) return rsnNote('I don\'t have data on <b>' + rsnEsc(bDisp) + '</b> yet.');

    var isGreater = /bigger|larger|greater|higher|more/.test(opWord);

    var metric, metricLabel;
    if (a.population !== null && a.population !== undefined &&
        b.population !== null && b.population !== undefined) {
        metric = 'population';
        metricLabel = 'population';
    } else if (a.area && b.area) {
        metric = 'area';
        metricLabel = 'area';
    } else if (a.diameter && b.diameter) {
        metric = 'diameter';
        metricLabel = 'diameter';
    } else {
        return rsnNote('I have both entities but no shared metric to compare them by.');
    }

    var valA = a[metric];
    var valB = b[metric];

    var verdict;
    if (isGreater) {
        verdict = (valA > valB)
            ? 'Yes. <b>' + a.name + '</b> is bigger than <b>' + b.name + '</b> by ' + metricLabel + '.'
            : 'No. <b>' + b.name + '</b> is bigger — <b>' + a.name + '</b> is smaller by ' + metricLabel + '.';
    } else {
        verdict = (valA < valB)
            ? 'Yes. <b>' + a.name + '</b> is smaller than <b>' + b.name + '</b> by ' + metricLabel + '.'
            : 'No. <b>' + a.name + '</b> is bigger by ' + metricLabel + '.';
    }

    var html = [];
    html.push(rsnTitle('Is ' + a.name + ' ' + opWord + ' than ' + b.name + '?'));
    html.push(rsnNote(verdict));
    html.push(rsnHeading('By the numbers (' + metricLabel + ')'));
    html.push(rsnList([
        a.name + ': ' + valA + (metric === 'area' ? ' thousand km²' : metric === 'population' ? ' million' : ''),
        b.name + ': ' + valB + (metric === 'area' ? ' thousand km²' : metric === 'population' ? ' million' : ''),
        'Difference: ' + (Math.round(Math.abs(valA - valB) * 100) / 100)
    ]));
    html.push(rsnClose('Want to compare a different pair?'));
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 4 — TRANSACTIONS ("had X, spent Y, got Z, how much left")
// ═══════════════════════════════════════════════════════════════════

function rsnTxnDetect(text) {
    var t = String(text || '').trim();
    if (!t || t.length > 400) return false;

    var hasAmount = /\b\d+(?:\.\d+)?\s*(?:tk|taka|dollar|dollars|usd|rupee|rupees|inr|bdt|euro|eur|pound|gbp)?\b/i.test(t);
    if (!hasAmount) return false;

    var hasInit = /\b(?:had|has|have|started with|begin|initially|got|received)\b/i.test(t);
    var hasFlow = /\b(?:spent|spend|paid|bought|put|deposited|gave|gave away|received|got|earned|lost|added|withdrew)\b/i.test(t);
    var hasAsk  = /\b(?:how\s+(?:much|many)|what(?:'s)?\s+(?:left|remains|remained)|remaining|left)\b/i.test(t);

    return hasInit && hasFlow && hasAsk;
}

function rsnTxnHandle(text) {
    var t = String(text || '').trim();

    var initMatch = t.match(/\b(?:had|has|have|started\s+with|began\s+with|initially)\s+(\d+(?:\.\d+)?)\s*(?:tk|taka|taka|dollars?|usd|rupees?|inr|bdt|euros?|eur|pounds?|gbp)?/i);
    var initial = initMatch ? parseFloat(initMatch[1]) : null;

    if (initial === null) {
        return rsnTitle('Transaction') + rsnNote('I couldn\'t find the starting amount. Say something like "Karim had 100 tk...".');
    }

    var currencyMatch = t.match(/\b(tk|taka|dollars?|usd|rupees?|inr|bdt|euros?|eur|pounds?|gbp)\b/i);
    var currency = currencyMatch ? currencyMatch[1].toLowerCase() : '';

    var movements = [];
    var m;
    var spentRe = /\bspent\s+(\d+(?:\.\d+)?)/gi;
    while ((m = spentRe.exec(t)) !== null) movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: -1, label: 'spent', raw: m[0] });
    var paidRe = /\bpaid\s+(\d+(?:\.\d+)?)/gi;
    while ((m = paidRe.exec(t)) !== null) movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: -1, label: 'paid', raw: m[0] });
    var putRe = /\bput\s+(\d+(?:\.\d+)?)/gi;
    while ((m = putRe.exec(t)) !== null) movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: -1, label: 'put aside', raw: m[0] });
    var depRe = /\bdeposited\s+(\d+(?:\.\d+)?)/gi;
    while ((m = depRe.exec(t)) !== null) movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: -1, label: 'deposited', raw: m[0] });
    var gaveRe = /\bgave\s+(\d+(?:\.\d+)?)(?!\s+back)/gi;
    while ((m = gaveRe.exec(t)) !== null) movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: -1, label: 'gave', raw: m[0] });
    var recvRe = /\b(?:received|got|earned|found)\s+(\d+(?:\.\d+)?)(?:\s+back)?/gi;
    while ((m = recvRe.exec(t)) !== null) movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: +1, label: 'received', raw: m[0] });
    var wdRe = /\bwithdrew\s+(\d+(?:\.\d+)?)/gi;
    while ((m = wdRe.exec(t)) !== null) movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: +1, label: 'withdrew', raw: m[0] });

    // "spent 70 on chocolate and 5 on pen" — companion spends that follow
    // "and" / "," without their own verb.
    var andSpentRe = /\b(?:and|,)\s+(\d+(?:\.\d+)?)\s+(?:on|for|at)\b/gi;
    while ((m = andSpentRe.exec(t)) !== null) {
        movements.push({ pos: m.index, amount: parseFloat(m[1]), sign: -1, label: 'spent', raw: m[0] });
    }

    if (!movements.length) {
        return rsnTitle('Transaction') + rsnNote('I found the starting amount but couldn\'t identify any spending or receiving. Try wording it like "spent 70 on chocolate".');
    }

    movements.sort(function (a, b) { return a.pos - b.pos; });

    var balance = initial;
    var steps = [{ balance: initial, description: 'Started with ' + initial + ' ' + currency }];
    for (var i = 0; i < movements.length; i++) {
        var mv = movements[i];
        balance += mv.sign * mv.amount;
        steps.push({
            balance: balance,
            description: mv.label.charAt(0).toUpperCase() + mv.label.slice(1) + ' ' + mv.amount + ' ' + currency +
                ' → ' + balance
        });
    }

    var html = [];
    html.push(rsnTitle('Transaction Breakdown'));
    html.push(rsnHeading('Step by step'));
    html.push(rsnList(steps.map(function (s) { return s.description; })));
    html.push(rsnBody('Final amount left: <b>' + Math.round(balance * 100) / 100 + ' ' + currency + '</b>'));
    html.push(rsnClose('Want me to break down a different sequence?'));
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 5 — DISTRIBUTION ("divide N among K, I want more")
// ═══════════════════════════════════════════════════════════════════

function rsnDistDetect(text) {
    var t = String(text || '').trim();
    if (!t || t.length > 400) return false;

    var itemRegex = /\b\d+\s*(?:mango(?:e?s)?|apples?|oranges?|bananas?|takas?|tk|chocolates?|cand(?:y|ies)|cookies?|items?|things?|stickers?|coins?|books?|pens?|pencils?|rupees?|eggs?|cakes?|sweets?|laddus?|flowers?|cards?|papers?)\b/i;

    var hasAmount = itemRegex.test(t);
    var hasDiv = /\b(?:divide|distribute|share|split|among|between)\b/i.test(t);
    var hasPeople = /\b(?:people|persons?|friends?|among\s+\w+|between\s+\w+|three|four|five|six|seven|eight|nine|ten|two)\b/i.test(t);

    return hasAmount && hasDiv && (hasPeople || /\bamong\b/i.test(t));
}

function rsnDistHandle(text) {
    var t = String(text || '').trim();

    var amtMatch = t.match(/\b(\d+)\s*(mango(?:e?s)?|apples?|oranges?|bananas?|takas?|tk|chocolates?|cand(?:y|ies)|cookies?|items?|things?|stickers?|coins?|books?|pens?|pencils?|rupees?|eggs?|cakes?|sweets?|laddus?|flowers?|cards?|papers?)\b/i);
    if (!amtMatch) return rsnTitle('Distribution') + rsnNote('I couldn\'t identify what\'s being divided.');
    var total = parseInt(amtMatch[1], 10);
    var item = amtMatch[2].toLowerCase();

    var peopleMap = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    var people = null;

    // Digit right after "among" or "between"
    var pm = t.match(/\b(?:among|between)\s+(\d+)/i);
    if (pm) people = parseInt(pm[1], 10);

    // Number-word after "among" or "between"
    if (!people) {
        pm = t.match(/\b(?:among|between)\s+(two|three|four|five|six|seven|eight|nine|ten)\b/i);
        if (pm) people = peopleMap[pm[1].toLowerCase()];
    }

    // Number-word followed by "people" / "friends" / "persons"
    if (!people) {
        pm = t.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|persons?|friends?|members?|kids?|children)\b/i);
        if (pm) people = peopleMap[pm[1].toLowerCase()];
    }

    // Any number-word anywhere (last resort)
    if (!people) {
        pm = t.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\b/i);
        if (pm) people = peopleMap[pm[1].toLowerCase()];
    }

    if (!people) people = 3;

    var wantsMore = /\bhigher|more|bigger|larger|greater|myself|me\s+more|I\s+want|I\s+keep\b/i.test(t);

    var html = [];
    html.push(rsnTitle('Distributing ' + total + ' ' + item + ' among ' + people + ' people'));

    var base = Math.floor(total / people);
    var remainder = total - base * people;

    if (wantsMore && people >= 2) {
        var othersShare = Math.floor(total / people);
        var yours = total - (people - 1) * othersShare;
        if (yours <= othersShare) {
            othersShare = Math.floor((total - 1) / people);
            yours = total - (people - 1) * othersShare;
        }

        html.push(rsnHeading('Your preferred reading — you get more'));
        html.push(rsnList([
            'You: ' + yours + ' ' + item,
            'Each of the other ' + (people - 1) + ': ' + othersShare + ' ' + item,
            'Check: ' + yours + ' + ' + (people - 1) + ' × ' + othersShare + ' = ' + (yours + (people - 1) * othersShare)
        ]));

        html.push(rsnHeading('Other valid readings'));
        html.push(rsnList([
            'Fair split (equal): everyone gets ' + base + (remainder ? ' (with ' + remainder + ' left over)' : ''),
            'Balanced: your share ' + Math.min(total, yours) + ', others ' + othersShare
        ]));
    } else {
        html.push(rsnHeading('Equal split'));
        html.push(rsnList([
            'Each person gets: ' + base + ' ' + item,
            remainder ? 'Remainder: ' + remainder + ' ' + item + ' left over (or give ' + remainder + ' people one extra)' : 'No remainder'
        ]));
    }

    html.push(rsnClose('Tell me your exact rule (e.g. "I want exactly twice as much") and I\'ll recompute.'));
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 6 — TWO-VARIABLE WORD PROBLEMS
// ═══════════════════════════════════════════════════════════════════

function rsnTwoVarDetect(text) {
    var t = String(text || '').trim();
    if (!t || t.length > 500) return false;

    var hasQuantities = /\b\d+\s+[a-z]+\s+(?:and|,)\s+\d+\s+[a-z]+/i.test(t);
    var hasTotal = /\b(?:gave|paid|cost|total|spent)\s+\d+/i.test(t) || /\b\d+\s*(?:tk|taka|dollars?|rupees?)\b/i.test(t);
    var hasRelation = /\b(?:times|twice|half|less than|more than|times less|times more)\b/i.test(t);
    var hasAsk = /\bwhat|find|how much|price|cost\b/i.test(t);

    return hasQuantities && hasTotal && hasRelation && hasAsk;
}

function rsnTwoVarHandle(text) {
    var t = String(text || '').trim();

    // Single-word item names only — multi-word captures pulled in things
    // like "tk and" and "back then". Aggressive stop-word filter to
    // reject currency, verbs, conjunctions, and common function words.
    var itemRe = /\b(\d+)\s+([a-z]+)\b/gi;
    var items = [];
    var m;
    var STOP_ITEM = /^(?:tk|taka|takas?|dollars?|rupees?|bdt|inr|usd|euros?|pounds?|to|from|of|at|and|or|but|the|a|an|he|she|it|they|we|you|i|karim|rahim|jamal|kamal|shop|owner|man|boy|girl|back|change|bank|then|that|this|these|those|times|time|less|more|half|twice|double|triple|got|gave|give|paid|spent|spend|bought|buy|cost|costs|total|price|prices|between|among|divide|divided|sharing|share|three|four|five|six|seven|eight|nine|ten|two|people|person|persons|friend|friends|portion|higher|lower|equal|each|every|some|any|all|more|both|than|was|were|is|are|has|have|had|with|without|by|in|on|into|out|up|down|new|old|other|many|much|lot|sum|amount|number|everyone|someone|nobody|anyone)$/i;
    while ((m = itemRe.exec(t)) !== null) {
        var qty = parseInt(m[1], 10);
        var name = m[2].toLowerCase().trim();
        if (STOP_ITEM.test(name)) continue;
        if (name.length < 2) continue;
        items.push({ qty: qty, name: name, pos: m.index });
    }

    var byName = {};
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!byName[it.name] || it.qty > byName[it.name].qty) byName[it.name] = it;
    }
    var uniqItems = Object.keys(byName).map(function (k) { return byName[k]; });
    if (uniqItems.length < 2) {
        return rsnTitle('Two-Variable Problem') + rsnNote('I couldn\'t identify two distinct items in that problem.');
    }
    uniqItems.sort(function (a, b) { return b.qty - a.qty; });
    var itemA = uniqItems[0], itemB = uniqItems[1];

    var totalMatch = t.match(/\b(?:gave|paid|cost|total|spent)\s+(\d+(?:\.\d+)?)/i)
                  || t.match(/\b(\d+(?:\.\d+)?)\s*(?:tk|taka|dollars?|rupees?)\b/i);
    if (!totalMatch) {
        return rsnTitle('Two-Variable Problem') + rsnNote('I couldn\'t find the total amount.');
    }
    var paidAmt = parseFloat(totalMatch[1]);

    var backMatch = t.match(/\bgot\s+(\d+(?:\.\d+)?)\s+back/i);
    var backAmt = backMatch ? parseFloat(backMatch[1]) : 0;
    var actualTotal = paidAmt - backAmt;

    var relMatch = t.match(new RegExp(itemA.name + '(?:\\s+price|\\s+cost)?\\s*(?:is|cost|costs?)?\\s*(\\d+)?\\s*times?\\s*(less|more|greater|smaller)?\\s*(?:than)?\\s*' + itemB.name, 'i'));
    if (!relMatch) {
        relMatch = t.match(new RegExp(itemB.name + '(?:\\s+price|\\s+cost)?\\s*(?:is|cost|costs?)?\\s*(\\d+)?\\s*times?\\s*(less|more|greater|smaller)?\\s*(?:than)?\\s*' + itemA.name, 'i'));
        if (relMatch) {
            var tmp = itemA; itemA = itemB; itemB = tmp;
        }
    }

    var N = relMatch && relMatch[1] ? parseInt(relMatch[1], 10) : 2;
    var direction = relMatch && relMatch[2] ? relMatch[2].toLowerCase() : '';

    var html = [];
    html.push(rsnTitle('Two-Variable Word Problem'));
    html.push(rsnBody('Let me lay out what I read from your problem:'));
    html.push(rsnList([
        itemA.qty + ' × (price of ' + itemA.name + ') + ' + itemB.qty + ' × (price of ' + itemB.name + ') = ' + actualTotal + ' ' +
            (backAmt ? '(after subtracting ' + backAmt + ' change from ' + paidAmt + ')' : ''),
        'Relation: ' + itemA.name + ' is ' + (N || '?') + ' times ' + (direction || 'relative to') + ' ' + itemB.name
    ]));

    if (/less/i.test(direction)) {
        html.push(rsnHeading('This phrasing is ambiguous'));
        html.push(rsnNote('The phrase "<b>' + N + ' times less than</b>" can mean two different things in everyday English. Here are both readings — pick the one you meant, or rephrase.'));
        html.push(rsnNote('<b>Reading A (South Asian idiom — "half"):</b> ' + itemA.name + ' price = ' + itemB.name + ' price ÷ ' + N));
        html.push(rsnNote('<b>Reading B (literal subtraction):</b> ' + itemA.name + ' price = ' + itemB.name + ' price − ' + N));

        var solA = rsnSolveTwoVar(itemA, itemB, actualTotal, N, 'divide');
        var solB = rsnSolveTwoVar(itemA, itemB, actualTotal, N, 'subtract');

        html.push(rsnHeading('Under Reading A (half)'));
        html.push(rsnNote(solA));
        html.push(rsnHeading('Under Reading B (subtract)'));
        html.push(rsnNote(solB));

        html.push(rsnClose('Which reading did you mean? Or restate the relation — e.g. "pens cost twice pencils".'));
        return html.join('');
    }

    if (/more|greater/i.test(direction) || !direction) {
        var sol = rsnSolveTwoVar(itemA, itemB, actualTotal, N, 'multiply');
        html.push(rsnHeading('Working'));
        html.push(rsnNote(sol));
        html.push(rsnClose('Want me to check with different numbers?'));
        return html.join('');
    }

    return rsnNote('Relation direction was not clear. Try "X is twice Y" or "X costs half of Y".');
}

function rsnSolveTwoVar(itemA, itemB, T, N, mode) {
    var qa = itemA.qty, qb = itemB.qty;
    var pa, pb, working;

    if (mode === 'multiply') {
        var coefB = qa * N + qb;
        pb = T / coefB;
        pa = N * pb;
        working = itemA.name + ' price = ' + N + ' × ' + itemB.name + ' price.\n' +
                  'So ' + qa + '×(' + N + '·pb) + ' + qb + '·pb = ' + T + '\n' +
                  '→ ' + coefB + ' · pb = ' + T + '\n' +
                  '→ ' + itemB.name + ' price = ' + rsnRound(pb) + '\n' +
                  '→ ' + itemA.name + ' price = ' + rsnRound(pa);
    } else if (mode === 'divide') {
        var coefB2 = qa / N + qb;
        pb = T / coefB2;
        pa = pb / N;
        working = itemA.name + ' price = ' + itemB.name + ' price ÷ ' + N + '\n' +
                  'So ' + qa + '×pb/' + N + ' + ' + qb + '·pb = ' + T + '\n' +
                  '→ ' + rsnRound(coefB2) + ' · pb = ' + T + '\n' +
                  '→ ' + itemB.name + ' price = ' + rsnRound(pb) + '\n' +
                  '→ ' + itemA.name + ' price = ' + rsnRound(pa);
    } else {
        var coefB3 = qa + qb;
        pb = (T + qa * N) / coefB3;
        pa = pb - N;
        working = itemA.name + ' price = ' + itemB.name + ' price − ' + N + '\n' +
                  'So ' + qa + '×(pb−' + N + ') + ' + qb + '·pb = ' + T + '\n' +
                  '→ ' + coefB3 + '·pb = ' + T + ' + ' + (qa * N) + '\n' +
                  '→ ' + itemB.name + ' price = ' + rsnRound(pb) + '\n' +
                  '→ ' + itemA.name + ' price = ' + rsnRound(pa);
    }

    return working.replace(/\n/g, '<br>');
}

function rsnRound(n) {
    if (!isFinite(n)) return '—';
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 100) / 100);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

function rsnHandle(text) {
    var inner = null;
    if (rsnVowelDetect(text))         inner = rsnVowelHandle(text);
    else if (rsnTextDetect(text))     inner = rsnTextHandle(text);
    else if (rsnCompareDetect(text))  inner = rsnCompareHandle(text);
    else if (rsnTxnDetect(text))      inner = rsnTxnHandle(text);
    else if (rsnDistDetect(text))     inner = rsnDistHandle(text);
    else if (rsnTwoVarDetect(text))   inner = rsnTwoVarHandle(text);

    if (!inner) return null;
    return { __html: true, text: '<div class="xetex-output para-output">' + inner + '</div>' };
}

// ═══════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════

function isReasoningRequest(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    if (!t || t.length > 500) return false;

    if (/^\/(para|paragraph|essay|know|write|email|letter|application|cgen|base|c)\b/i.test(t)) return false;
    if (/\b(c\s*program|source\s+code|compile)\b/i.test(t)) return false;
    if (/\b(integrate|differentiate|derive)\b/i.test(t)) return false;

    return rsnVowelDetect(t)
        || rsnTextDetect(t)
        || rsnCompareDetect(t)
        || rsnTxnDetect(t)
        || rsnDistDetect(t)
        || rsnTwoVarDetect(t);
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

window.isReasoningRequest = isReasoningRequest;
window.rsnHandle = rsnHandle;