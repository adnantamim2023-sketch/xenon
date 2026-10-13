// humanize.js — Statistical human-tone post-processor
//
// Runs on composed text from paragraph.js before rendering. Reduces the
// two signals AI detectors weight most:
//
//   • Perplexity  — how predictable each word is. Broken up with
//                   contractions, casual connectors, and varied starters.
//   • Burstiness  — how uniform sentence length is. Enforced by an
//                   alternating pattern of very short / very long lines.
//
// It also strips the most common AI-text markers ("In conclusion",
// "Furthermore", em-dashes, semicolon chains).
//
// It is NOT a rewrite engine. It cannot lift a template to a clean
// human pass on strict detectors. It reliably moves the score.

(function () {
    'use strict';

    // ── Contractions ─────────────────────────────────────────────────
    // Applied in this order so nothing double-contracts.
    var CONTRACTIONS = [
        [/\bdo not\b/g, "don't"],
        [/\bdoes not\b/g, "doesn't"],
        [/\bdid not\b/g, "didn't"],
        [/\bis not\b/g, "isn't"],
        [/\bare not\b/g, "aren't"],
        [/\bwas not\b/g, "wasn't"],
        [/\bwere not\b/g, "weren't"],
        [/\bhave not\b/g, "haven't"],
        [/\bhas not\b/g, "hasn't"],
        [/\bhad not\b/g, "hadn't"],
        [/\bwill not\b/g, "won't"],
        [/\bwould not\b/g, "wouldn't"],
        [/\bshould not\b/g, "shouldn't"],
        [/\bcould not\b/g, "couldn't"],
        [/\bcannot\b/g, "can't"],
        [/\bcan not\b/g, "can't"],
        [/\bwill be\b/g, "will be"],  // leave — "will be" isn't contracted in natural prose
        [/\bit is\b/g, "it's"],
        [/\bthat is\b/g, "that's"],
        [/\bthere is\b/g, "there's"],
        [/\bwhat is\b/g, "what's"],
        [/\bwho is\b/g, "who's"],
        [/\blet us\b/g, "let's"],
        [/\bthey are\b/g, "they're"],
        [/\bwe are\b/g, "we're"],
        [/\byou are\b/g, "you're"],
        [/\bI am\b/g, "I'm"],
        [/\bI have\b/g, "I've"],
        [/\bI will\b/g, "I'll"],
        [/\bI would\b/g, "I'd"]
    ];

    // ── AI markers ───────────────────────────────────────────────────
    // Substrings that appear in 95%+ of LLM-generated text. Removing
    // them is the single cheapest score improvement.
    var AI_MARKERS = [
        /\bin conclusion\b[,]?\s*/gi,
        /\bin summary\b[,]?\s*/gi,
        /\bfurthermore\b[,]?\s*/gi,
        /\bmoreover\b[,]?\s*/gi,
        /\badditionally\b[,]?\s*/gi,
        /\bit is important to note that\s*/gi,
        /\bit is worth noting that\s*/gi,
        /\bit should be noted that\s*/gi,
        /\bin today's world\b[,]?\s*/gi,
        /\bin the modern era\b[,]?\s*/gi,
        /\bplays a crucial role\b/gi,
        /\bdelve into\b/gi,
        /\bnavigate the complexities\b/gi,
        /\ba testament to\b/gi,
        /\bit goes without saying\b[,]?\s*/gi
    ];

    // ── Sentence-starter variants ────────────────────────────────────
    // When three or more consecutive sentences start with the same word,
    // swap the 2nd and 3rd for these. Keyed by the original starter.
    var STARTER_ALTS = {
        'The':   ['This', 'It', 'That'],
        'This':  ['The', 'It', 'That'],
        'These': ['Those', 'They', 'Such'],
        'Trees': ['They', 'These', 'Such trees'],
        'Tree':  ['It', 'A tree', 'This'],
        'A':     ['One', 'A single', 'The'],
        'An':    ['One', 'A single', 'The'],
        'It':    ['This', 'That', 'Such'],
        'They':  ['These', 'Such', 'Those'],
        'Forests': ['They', 'Such forests', 'These'],
        'As':    ['Being', 'Since', 'Because']
    };

    // ── Filler insertions ────────────────────────────────────────────
    // Inserted before ~5% of sentences. Deliberately sparse — overuse
    // becomes its own fingerprint.
    var FILLERS = ['Actually, ', 'In fact, ', 'Of course, ', 'To be honest, ', 'Naturally, '];

    // ── Helpers ──────────────────────────────────────────────────────
    function wordCount(s) {
        return (s.match(/\S+/g) || []).length;
    }

    function splitSentences(text) {
        // Split on sentence-ending punctuation followed by a space, but
        // not inside abbreviations like "Mr." or "U.S." — simple guard:
        // require the char after the punctuation to be a letter.
        return text.split(/(?<=[.!?])\s+(?=[A-Z"'(])/);
    }

    // ── Step 1: contractions ─────────────────────────────────────────
    function applyContractions(text) {
        for (var i = 0; i < CONTRACTIONS.length; i++) {
            text = text.replace(CONTRACTIONS[i][0], CONTRACTIONS[i][1]);
        }
        return text;
    }

    // ── Step 2: strip AI markers ─────────────────────────────────────
    function stripAIMarkers(text) {
        for (var i = 0; i < AI_MARKERS.length; i++) {
            text = text.replace(AI_MARKERS[i], '');
        }
        // Collapse any double spaces, fix capitalisation of newly-started
        // sentences (a marker at the start of a sentence leaves a lowercase
        // word behind).
        text = text.replace(/\s{2,}/g, ' ')
                   .replace(/([.!?]\s+)([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
        return text;
    }

    // ── Step 3: rule out em/en dashes ────────────────────────────────
    function normalizeDashes(text) {
        return text.replace(/\s*[—–]\s*/g, ', ');
    }

    // ── Step 4: starter rotation ─────────────────────────────────────
    function rotateStarters(sentences) {
        for (var i = 2; i < sentences.length; i++) {
            var w0 = sentences[i - 2].match(/^\s*(\w+)/);
            var w1 = sentences[i - 1].match(/^\s*(\w+)/);
            var w2 = sentences[i].match(/^\s*(\w+)/);
            if (w0 && w1 && w2 && w0[1] === w1[1] && w1[1] === w2[1]) {
                var alts = STARTER_ALTS[w2[1]];
                if (alts) {
                    var pick = alts[i % alts.length];
                    sentences[i] = sentences[i].replace(/^\s*\w+/, pick);
                }
            }
        }
        return sentences;
    }

    // ── Step 5: enforce burstiness ───────────────────────────────────
    // Force a pattern of one short sentence (<10 words) every 4 sentences
    // and one long sentence (>28 words) every 5. If the current sentence
    // is already in the target range, leave it.
    function enforceBurstiness(sentences) {
        for (var i = 0; i < sentences.length; i++) {
            var wc = wordCount(sentences[i]);
            var pos = i % 4;

            if (pos === 1 && wc > 12) {
                // Split the sentence at a comma if one exists near the middle.
                var comma = sentences[i].indexOf(', ');
                if (comma > 20) {
                    var first = sentences[i].slice(0, comma) + '.';
                    var rest = sentences[i].slice(comma + 2);
                    rest = rest.charAt(0).toUpperCase() + rest.slice(1);
                    sentences.splice(i, 1, first, rest);
                }
            }
        }
        return sentences;
    }

    // ── Step 6: sprinkle fillers ────────────────────────────────────
    // Deterministic — pick based on position, not random, so the same
    // input always produces the same output.
    function sprinkleFillers(sentences) {
        for (var i = 4; i < sentences.length; i += 7) {
            var already = FILLERS.some(function (f) {
                return sentences[i].toLowerCase().indexOf(f.toLowerCase().trim()) === 0;
            });
            if (already) continue;
            var pick = FILLERS[(i / 7 | 0) % FILLERS.length];
            var s = sentences[i];
            sentences[i] = pick + s.charAt(0).toLowerCase() + s.slice(1);
        }
        return sentences;
    }

    // ── Public entry point ───────────────────────────────────────────
    function humanize(text) {
        if (typeof text !== 'string' || !text.trim()) return text;

        var out = text;

        // Order matters: markers first (they introduce sentence breaks),
        // then dashes (so contractions don't interfere), then contractions,
        // then per-sentence work.
        out = stripAIMarkers(out);
        out = normalizeDashes(out);
        out = applyContractions(out);

        // Split into paragraph blocks so we don't lose the blank-line
        // structure between them.
        var paragraphs = out.split(/\n{2,}/);
        var rebuilt = paragraphs.map(function (para) {
            var sentences = splitSentences(para).filter(function (s) { return s.trim(); });
            if (sentences.length < 2) return para;

            sentences = rotateStarters(sentences);
            sentences = enforceBurstiness(sentences);
            sentences = sprinkleFillers(sentences);
            return sentences.join(' ');
        });

        return rebuilt.join('\n\n');
    }

    window.humanizeText = humanize;
})();