// paragraph.js — Knowledge engine + paragraph/essay composer
//
// Two responsibilities:
//   1. Composition — "write a paragraph/essay about X under N words"
//   2. Knowledge queries — "what causes X", "facts about X",
//      "solutions for X", "quote about X", "examples of X", etc.
//
// The topic library (topics-hsc.js) is a structured knowledge base.
// Every body fragment carries a `category` describing WHAT QUESTION
// it answers: definition | cause | effect | solution | example |
// importance | context | philosophical. Topic-level arrays carry
// facts[], examples[], quotes[], sources[], keyPoints[], relatedTopics[].
//
// Conversational layer: strips greetings and meta preamble, resolves
// pronouns against an active topic, and answers multi-part questions
// with per-intent sections.
//
// Multi-part: when a query asks several things or mentions several
// topics, it answers each in order, under its own heading.
//
// Comparison: neutral side-by-side, or bias-aware ("why is X better
// than Y") when the phrasing favours one option.
//
// Relation: when two topics are named, both are linked. When one topic
// is named alongside an external concept ("how is X related with Y"
// where Y isn't a topic), the topic's own fragments frame the answer.

// ═══════════════════════════════════════════════════════════════════
// TOPIC LOOKUP
// ═══════════════════════════════════════════════════════════════════

function knGetTopics() {
    return (typeof window !== 'undefined' && Array.isArray(window.HSC_TOPICS)) ? window.HSC_TOPICS : [];
}

function knFindTopic(text) {
    var topics = knGetTopics();
    for (var i = 0; i < topics.length; i++) {
        var t = topics[i];
        if (t && t.aliases && t.aliases.test(text)) return t;
    }
    return null;
}

function knFindAllTopics(text) {
    var topics = knGetTopics();
    var found = [];
    for (var i = 0; i < topics.length; i++) {
        if (topics[i] && topics[i].aliases && topics[i].aliases.test(text)) found.push(topics[i]);
    }
    return found;
}

function knTopicById(id) {
    var topics = knGetTopics();
    for (var i = 0; i < topics.length; i++) {
        if (topics[i].id === id) return topics[i];
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════
// FRAGMENT SELECTION
// ═══════════════════════════════════════════════════════════════════

function knFragmentsByCategory(topic, category) {
    if (!topic || !topic.body) return [];
    var out = [];
    for (var i = 0; i < topic.body.length; i++) {
        if (topic.body[i].category === category) out.push(topic.body[i]);
    }
    return out;
}

function knFragmentsByCategories(topic, categories) {
    if (!topic || !topic.body) return [];
    var out = [];
    for (var i = 0; i < topic.body.length; i++) {
        if (categories.indexOf(topic.body[i].category) !== -1) out.push(topic.body[i]);
    }
    return out;
}

// ═══════════════════════════════════════════════════════════════════
// CONVERSATIONAL LAYER
// ═══════════════════════════════════════════════════════════════════

var __knActiveTopic = null;
var __knActiveTopicAt = 0;
var KN_ACTIVE_TOPIC_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

function knSetActiveTopic(topic) {
    __knActiveTopic = topic;
    __knActiveTopicAt = Date.now();
}

function knGetActiveTopic() {
    if (!__knActiveTopic) return null;
    if (Date.now() - __knActiveTopicAt > KN_ACTIVE_TOPIC_TIMEOUT_MS) {
        __knActiveTopic = null;
        return null;
    }
    return __knActiveTopic;
}

function knParseEnvelope(rawText) {
    var t = String(rawText || '').trim();
    var greeting = null;

    if (/\b(?:long\s+time|after\s+so\s+long|been\s+a\s+while|no\s+see)\b/i.test(t)) {
        greeting = 'catchup';
        t = t.replace(/\b(?:hey\s+)?xenon[,!.]?\s*/i, '');
        t = t.replace(/\b(?:it'?s|its)\s+been\s+(?:a\s+)?(?:quite\s+)?(?:a\s+)?(?:long|while|time)\b[^.]*[.,!]?\s*/gi, '');
        t = t.replace(/\bno\s+see\b[.,!]?\s*/gi, '');
    }

    var greetRe = /^(?:hi|hey|hello|yo|hiya|sup|greetings|good\s+(?:morning|afternoon|evening|night))(?:\s+xenon)?\b[,!. ]*/i;
    var gm = t.match(greetRe);
    if (gm) {
        if (!greeting) greeting = 'hello';
        t = t.replace(greetRe, '');
    }

    t = t
        .replace(/^(?:today|now)\s+(?:i\s+(?:want|wanna|would\s+like)\s+to\s+|we(?:'re|\s+are)\s+going\s+to\s+)?/i, '')
        .replace(/^(?:i\s+(?:want|wanna|would\s+like)\s+to\s+|let'?s\s+|we\s+are\s+going\s+to\s+)/i, '')
        .replace(/^(?:can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|please\s+)/i, '')
        .replace(/^(?:help\s+(?:me\s+)?(?:on\s+|with\s+|in\s+)?)/i, '')
        .replace(/^(?:about|on|regarding)\s+/i, '')
        .trim();

    return { greeting: greeting, request: t };
}

function knHasAnaphora(text) {
    return /\b(it|this|that|them|these|those|its|their|they)\b/i.test(text);
}

function knNamesAnyTopic(text) {
    var topics = knGetTopics();
    for (var i = 0; i < topics.length; i++) {
        if (topics[i].aliases && topics[i].aliases.test(text)) return true;
    }
    return false;
}

function knGreetingAck(kind) {
    if (kind === 'catchup') return 'Good to have you back! 👋';
    if (kind === 'hello')   return 'Hi! 👋';
    return null;
}

// ═══════════════════════════════════════════════════════════════════
// INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════

var KN_RELATION_RE = /\b(?:relat(?:ed|es|e|ing|ion(?:ship)?)?\s+(?:to|with)|relationship\s+(?:between|with|to)|connection\s+(?:between|with|to)|link(?:ed|s)?\s+(?:to|with|between)|how\s+(?:is|are|does|do)\s+.{1,50}?\s+(?:relate|relates|connect|connects|link|links)|in\s+relation\s+to|how\s+(?:is|are)\s+.{1,50}?\s+(?:connected|involved|associated))\b/i;

var KN_INTENT_PATTERNS = [
    // ── Meta / conversational intents ──
    { intent: 'sources',  re: /\b(?:sources?|references?|citations?|where\s+did\s+you\s+(?:get|read|find)|what\s+are\s+your\s+sources|based\s+on\s+what|how\s+do\s+you\s+know)\b/gi },
    { intent: 'research', re: /\b(?:research(?:ing)?|analy[sz]e|analy[sz]ing|analysis|investigate|explore|study|deep\s+dive|overview|discuss(?:ion)?|going\s+to\s+(?:analy[sz]e|discuss|study|research))\b/gi },
    { intent: 'judge',    re: /\b(?:do\s+you\s+think|is\s+it\s+(?:bad|good|harmful|dangerous)|which\s+(?:one\s+)?is\s+(?:bad|good|worse|better|harmful)|(?:bad|good|harmful|dangerous|worse|better)\s+(?:one|option|choice)|should\s+we\s+(?:avoid|prefer))\b/gi },
    { intent: 'predict',  re: /\b(?:what\s+will\s+happen|what\s+happens\s+if|if\s+we\s+(?:don'?t|do\s+not|continue|keep)|future\s+(?:of|consequences|impact)|long[\s-]?term\s+(?:effects?|consequences?)|what\s+(?:could|would)\s+happen)\b/gi },

    // ── Content intents ──
    { intent: 'relation',   re: KN_RELATION_RE },
    { intent: 'compare',    re: /\b(?:vs\.?|versus|compare|difference\s+between|contrast|differ(?:ence)?\s+between|how\s+(?:do|does)\s+.+?\s+differ|better\s+than|worse\s+than|superior\s+to|inferior\s+to|prefer\s+\w+\s+(?:over|to))\b/gi },
    { intent: 'quote',      re: /\b(?:quotes?|quotations?|sayings?)\b/gi },
    { intent: 'facts',      re: /\b(?:facts?|statistics?|stats|figures?|data)\b/gi },
    { intent: 'examples',   re: /\b(?:examples?|case\s+stud(?:y|ies)|instances?)\b/gi },
    { intent: 'causes',     re: /\b(?:causes?|reasons?|why\s+(?:does|do|is|are|did))\b/gi },
    { intent: 'effects',    re: /\b(?:effects?|impacts?|consequences?|results?|harm(?:ful)?|damages?|dangerous)\b/gi },
    { intent: 'solutions',  re: /\b(?:solutions?|solve|prevent(?:ion|ing)?|reduce|stop|control|measures?|remed(?:y|ies)|cures?|how\s+can\s+we\s+(?:prevent|stop|fix|reduce))\b/gi },
    { intent: 'importance', re: /\b(?:importance|important|significance|why\s+should)\b/gi },
    { intent: 'keyPoints',  re: /\b(?:key\s+points?|main\s+points?|important\s+points?|summary|summarize)\b/gi },
    { intent: 'define',     re: /\b(?:what\s+is|what\s+are|define|explain|describe|tell\s+me\s+about)\b/gi }
];

function knExtractIntentsWithPositions(text) {
    var found = [];
    for (var i = 0; i < KN_INTENT_PATTERNS.length; i++) {
        var p = KN_INTENT_PATTERNS[i];
        p.re.lastIndex = 0;
        var m;
        while ((m = p.re.exec(text)) !== null) {
            found.push({ intent: p.intent, pos: m.index, text: m[0] });
        }
    }
    found.sort(function (a, b) { return a.pos - b.pos; });
    var out = [], last = null;
    for (var j = 0; j < found.length; j++) {
        if (found[j].intent !== last) { out.push(found[j]); last = found[j].intent; }
    }
    return out;
}

function knExtractTopicsWithPositions(text) {
    var topics = knGetTopics();
    var found = [];
    for (var i = 0; i < topics.length; i++) {
        var t = topics[i];
        if (!t.aliases) continue;
        var re = new RegExp(t.aliases.source, 'i');
        var m = re.exec(text);
        if (m) found.push({ topic: t, pos: m.index });
    }
    found.sort(function (a, b) { return a.pos - b.pos; });
    return found;
}

function knIsMultiPart(text) {
    var intents = knExtractIntentsWithPositions(text);
    var topicsInfo = knExtractTopicsWithPositions(text);
    var hasConjunction = /\b(?:and\s+(?:also\s+)?(?:why|what|how|is|are|does|do)|\?\s*(?:and|also|why|what|how)|,\s*and)\b/i.test(text);

    if (intents.length >= 2 && (hasConjunction || topicsInfo.length >= 2)) return true;

    if (topicsInfo.length >= 2) {
        for (var i = 0; i < intents.length; i++) {
            var it = intents[i].intent;
            if (it === 'relation' || it === 'compare' || it === 'judge') return true;
        }
    }

    for (var j = 0; j < intents.length; j++) {
        if (intents[j].intent === 'relation' || intents[j].intent === 'compare') return true;
    }

    return false;
}

function knDetectIntent(text) {
    var t = text.toLowerCase().trim();

    if (/\b(write|compose|draft|prepare|give)\b.{0,30}\b(paragraph|essay|notes?)\b/i.test(t)) return 'compose';
    if (/\b(paragraph|essay)\b.{0,30}\b(on|about|for)\b/i.test(t)) return 'compose';

    if (/\b(?:sources?|references?|citations?|where\s+did\s+you\s+(?:get|read|find)|what\s+are\s+your\s+sources|based\s+on\s+what|how\s+do\s+you\s+know)\b/i.test(t)) return 'sources';
    if (/\b(?:research(?:ing)?|analy[sz]e|analy[sz]ing|analysis|investigate|explore|deep\s+dive|overview|discuss(?:ion)?)\b/i.test(t)) return 'research';
    if (/\b(?:do\s+you\s+think|is\s+it\s+(?:bad|good|harmful|dangerous)|which\s+(?:one\s+)?is\s+(?:bad|good|worse|better|harmful))\b/i.test(t)) return 'judge';
    if (/\b(?:what\s+will\s+happen|what\s+happens\s+if|if\s+we\s+(?:don'?t|do\s+not)|what\s+(?:could|would)\s+happen)\b/i.test(t)) return 'predict';

    if (KN_RELATION_RE.test(t)) return 'relation';

    if (/\b(vs\.?|versus)\b/i.test(t)) return 'compare';
    if (/\b(compare|difference\s+between|contrast|differ(?:ence)?\s+between|better\s+than|worse\s+than|superior\s+to|inferior\s+to|prefer\s+\w+\s+(?:over|to))\b/i.test(t)) return 'compare';

    if (/\b(quote|quotation|saying)\b/i.test(t)) return 'quote';
    if (/\b(example|examples|case\s+study|instance|real[\s-]?life\s+example)\b/i.test(t)) return 'examples';
    if (/\b(facts?|statistics?|stats|figures?|numbers?|data)\b/i.test(t)) return 'facts';
    if (/\b(causes?|reasons?|why\s+(does|is|do|are)|what\s+makes)\b/i.test(t)) return 'causes';
    if (/\b(effects?|impacts?|consequences?|results?|how\s+does.*affect)\b/i.test(t)) return 'effects';
    if (/\b(solutions?|solve|prevent|fix|reduce|stop|control|measures?|remedies?|cure)\b/i.test(t)) return 'solutions';
    if (/\b(importance|important|why\s+is|why\s+should|significance|value)\b/i.test(t)) return 'importance';
    if (/\b(key\s+points?|main\s+points?|important\s+points?|summary|summarize|in\s+short|brief\s+note)\b/i.test(t)) return 'keyPoints';
    if (/^(what\s+is|what\s+are|define|explain|describe|tell\s+me\s+about)\b/i.test(t)) return 'define';

    return 'define';
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST PARSING
// ═══════════════════════════════════════════════════════════════════

function knDetectFormat(text) {
    var t = text.toLowerCase();
    if (/\bessay\b/.test(t)) return 'essay';
    if (/\bnotes?\b/.test(t) && !/\bnote\s+down\b/.test(t)) return 'notes';
    return 'paragraph';
}

function knDetectTargetWords(text, format) {
    var t = text.toLowerCase();
    var m = t.match(/\b(?:under|within|about|around)\s+(\d+)\s*words?\b/);
    if (m) return parseInt(m[1], 10);
    m = t.match(/\b(\d+)\s*words?\b/);
    if (m) return parseInt(m[1], 10);
    return format === 'essay' ? 400 : 180;
}

function knDetectMood(text) {
    var t = text.toLowerCase();
    if (/\blazy\b|\btired\b|\bsleepy\b|\bdon'?t\s+feel\s+like\b|\bexhausted\b|\bbored\b/.test(t)) return 'lazy';
    if (/\burgent\b|\basap\b|\bquick\b|\bright\s+now\b|\bdeadline\b/.test(t)) return 'urgent';
    if (/\bexcited\b|\bhappy\b|\bcheerful\b|\bglad\b/.test(t)) return 'cheerful';
    if (/\bformal\b|\bacademic\b|\bserious\b|\bprofessional\b/.test(t)) return 'formal';
    if (/\bcasual\b|\bchill\b|\bfriendly\b/.test(t)) return 'casual';
    return 'neutral';
}

function knWordCount(s) {
    return (s.match(/\S+/g) || []).length;
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSER
// ═══════════════════════════════════════════════════════════════════

function knPickOpener(topic, mood) {
    var openers = topic.openers || [];
    if (!openers.length) return '';
    var idx = 0;
    if (mood === 'lazy') idx = 1;
    else if (mood === 'formal') idx = 2;
    else if (mood === 'cheerful') idx = 3;
    else if (mood === 'urgent') idx = 4;
    return openers[idx % openers.length];
}

function knSelectFragmentsForComposition(topic, format) {
    if (format === 'notes') return [];

    var def = knFragmentsByCategory(topic, 'definition');
    var effects = knFragmentsByCategory(topic, 'effect');
    var causes = knFragmentsByCategory(topic, 'cause');
    var solutions = knFragmentsByCategory(topic, 'solution');
    var examples = knFragmentsByCategory(topic, 'example');
    var philosophical = knFragmentsByCategory(topic, 'philosophical');

    if (format === 'essay') {
        return [].concat(def, causes, effects.slice(0, 5), examples.slice(0, 2), solutions.slice(0, 3), philosophical);
    }

    return [].concat(def, effects.slice(0, 6), solutions.slice(0, 1), philosophical.slice(0, 1));
}

function knCleanPunctuation(text) {
    return String(text)
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/,\s*,/g, ',')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',');
}

// Post-process: split long sentences, merge short ones, insert casual
// connectors. Raises "burstiness" — the sentence-length variance that
// AI detectors weight heavily.
function knVaryRhythm(text) {
    var sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length < 3) return text;

    // Split any sentence over 30 words at a natural conjunction.
    var out = [];
    for (var i = 0; i < sentences.length; i++) {
        var s = sentences[i];
        if (knWordCount(s) > 30) {
            var split = s.replace(/\s+(and|but|so|which|because)\s+/i, '. $1 ');
            if (knWordCount(split) < knWordCount(s) - 5) {
                out.push(split);
                continue;
            }
        }
        out.push(s);
    }

    // Occasionally merge two short neighbors with a comma + conjunction.
    var merged = [];
    var j = 0;
    while (j < out.length) {
        if (j < out.length - 1 &&
            knWordCount(out[j]) < 8 &&
            knWordCount(out[j+1]) < 8) {
            merged.push(out[j].replace(/[.!?]$/, '') + ', and ' +
                out[j+1].charAt(0).toLowerCase() + out[j+1].slice(1));
            j += 2;
        } else {
            merged.push(out[j]);
            j++;
        }
    }
    return merged.join(' ');
}



function knComposeBody(topic, format, targetWords, mood) {
    var opener = knPickOpener(topic, mood) || '';
    var closer = (topic.closers && topic.closers[0]) || '';

    if (format === 'notes') return { text: '', opener: '', closer: '' };

    var fragments = knSelectFragmentsForComposition(topic, format);
    var closerWords = knWordCount(closer);
    var openerWords = knWordCount(opener);

    var sentences = [];
    var words = openerWords;
    for (var i = 0; i < fragments.length; i++) {
        var fragWords = knWordCount(fragments[i].text);
        if (words + fragWords + closerWords > targetWords && i > 2) break;
        sentences.push(fragments[i].text);
        words += fragWords;
    }

    var text;
    if (format === 'essay') {
        var paragraphs = [];
        var current = [];
        var idx = 0;
        if (opener) {
            current.push(opener);
            while (idx < sentences.length && current.length < 3) current.push(sentences[idx++]);
            paragraphs.push(current.join(' '));
            current = [];
        }
        while (idx < sentences.length) {
            while (idx < sentences.length && current.length < 3) current.push(sentences[idx++]);
            paragraphs.push(current.join(' '));
            current = [];
        }
        if (closer) paragraphs.push(closer);
        text = paragraphs.join('\n\n');
    } else {
        var parts = [];
        if (opener) parts.push(opener);
        for (var k = 0; k < sentences.length; k++) parts.push(sentences[k]);
        if (closer) parts.push(closer);
        text = parts.join(' ');
    }

    text = knCleanPunctuation(text);
text = knVaryRhythm(text);
if (typeof window.humanizeText === 'function') {
    text = window.humanizeText(text);
}
return { text: text, opener: opener, closer: closer };
}
// ═══════════════════════════════════════════════════════════════════
// HTML HELPERS
// ═══════════════════════════════════════════════════════════════════

function knEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function knBodyHTML(text) {
    if (!text) return '';
    return text.split(/\n\n+/).map(function (p) {
        return '<p class="para-line">' + knEsc(p) + '</p>';
    }).join('');
}

function knListHTML(items) {
    var out = ['<ul class="para-keypoints">'];
    for (var i = 0; i < items.length; i++) out.push('<li>' + knEsc(items[i]) + '</li>');
    out.push('</ul>');
    return out.join('');
}

function knParagraphsHTML(items) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
        out.push('<p class="para-line">' + knEsc(items[i]) + '</p>');
    }
    return out.join('');
}

function knTitle(text) {
    return '<div class="xetex-equation">' + knEsc(text) + '</div>';
}

function knSectionHeading(label) {
    return '<div class="para-keypoints-heading">' + knEsc(label) + '</div>';
}

function knMoodIntro(mood, what, words) {
    var s = words ? ' (~' + words + ' words)' : '';
    switch (mood) {
        case 'lazy':     return 'No rush — here\'s a gentle ' + what + ' for you' + s + ':';
        case 'urgent':   return 'Here it is, straight to the point:';
        case 'cheerful': return 'Here you go! 🌟 ' + what.charAt(0).toUpperCase() + what.slice(1) + s + ':';
        case 'formal':   return 'Below is the requested ' + what + s + '.';
        case 'casual':   return 'Alright, here\'s your ' + what + s + ':';
        default:         return 'Here\'s your ' + what + s + ':';
    }
}

function knNaturalClose() {
    var options = [
        'Want me to shorten it, expand any section, change the tone, or explain any point?',
        'Adjust it with a follow-up such as /paragraph shorter, /paragraph longer or /paragraph more formal.',
        'Let me know if you want a different angle, an example, or a source for any claim.',
        'Want a shorter version, a longer one, or more facts on this?'
    ];
    return options[Math.floor(Date.now() / 1000) % options.length];
}

// ═══════════════════════════════════════════════════════════════════
// ANSWER BUILDERS
// ═══════════════════════════════════════════════════════════════════

function knBuildCompose(topic, text) {
    var format = knDetectFormat(text);
    var targetWords = knDetectTargetWords(text, format);
    var mood = knDetectMood(text);
    var wantsKeyPoints = /\b(important|key|main)\s+(parts?|points?|things?)\b/i.test(text)
                       || /\bwhat\s+should\s+i\s+remember\b/i.test(text)
                       || /\bstep\s+by\s+step\b/i.test(text)
                       || /\bbullet\b/i.test(text);

    if (format === 'notes') return knComposeNotes(topic, mood);

    var composed = knComposeBody(topic, format, targetWords, mood);
    var words = knWordCount(composed.text);

    var inner = [];
    inner.push('<div class="para-body">' + knBodyHTML(composed.text) + '</div>');
    if (wantsKeyPoints) {
        inner.push(knSectionHeading('📌 Key points to remember'));
        inner.push(knListHTML(topic.keyPoints || []));
    }

    var cardLabel = format === 'essay' ? 'essay' : 'paragraph';

    var html = [];
    html.push(knTitle(topic.title + (format === 'essay' ? ' — Essay' : '')));
    html.push('<div class="para-intro">' + knEsc(knMoodIntro(mood, format, words)) + '</div>');
    html.push('<div class="code-card para-card">');
    html.push('<div class="code-card-header">');
    html.push('<span class="code-card-type">' + cardLabel + '</span>');
    html.push('<button type="button" class="code-card-copy" onclick="codeCardCopy(this)">');
    html.push('<span class="icon icon-copy"></span>');
    html.push('<span class="code-card-copy-label">Copy</span>');
    html.push('</button>');
    html.push('</div>');
    html.push('<div class="code-card-body">');
    html.push(inner.join(''));
    html.push('</div>');
    html.push('</div>');
    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'compose', composed.text, {
        format: format, targetWords: targetWords, actualWords: words,
        mood: mood, wantsKeyPoints: wantsKeyPoints
    });

    return html.join('');
}

function knComposeNotes(topic, mood) {
    var inner = [];
    inner.push(knSectionHeading('📌 Key points'));
    inner.push(knListHTML(topic.keyPoints || []));

    var html = [];
    html.push(knTitle(topic.title + ' — Notes'));
    html.push('<div class="para-intro">' + knEsc(knMoodIntro(mood, 'notes', null)) + '</div>');
    html.push('<div class="code-card para-card">');
    html.push('<div class="code-card-header">');
    html.push('<span class="code-card-type">notes</span>');
    html.push('<button type="button" class="code-card-copy" onclick="codeCardCopy(this)">');
    html.push('<span class="icon icon-copy"></span>');
    html.push('<span class="code-card-copy-label">Copy</span>');
    html.push('</button>');
    html.push('</div>');
    html.push('<div class="code-card-body">');
    html.push(inner.join(''));
    html.push('</div>');
    html.push('</div>');

    knStoreContext(topic, 'notes', (topic.keyPoints || []).join('\n'), { format: 'notes', mood: mood });
    return html.join('');
}
function knBuildDefine(topic) {
    var defs = knFragmentsByCategory(topic, 'definition');
    var defText = defs.length ? defs[0].text : (topic.summary || '');

    var html = [];
    html.push(knTitle(topic.title));
    html.push('<div class="para-body">' + knBodyHTML(defText) + '</div>');

    if (topic.summary && defText !== topic.summary) {
        html.push('<div class="para-explain"><b>In one line:</b> ' + knEsc(topic.summary) + '</div>');
    }

    if (topic.keyPoints && topic.keyPoints.length) {
        html.push(knSectionHeading('What defines it'));
        html.push(knListHTML(topic.keyPoints.slice(0, 6)));
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'define', defText + '\n\n' + (topic.keyPoints || []).slice(0, 6).join('\n'), {});
    return html.join('');
}

function knBuildCauses(topic) {
    var frags = knFragmentsByCategory(topic, 'cause');
    if (!frags.length) frags = knFragmentsByCategory(topic, 'context');

    var html = [];
    html.push(knTitle('Causes — ' + topic.title));

    if (!frags.length) {
        html.push('<div class="para-body"><p class="para-line">I don\'t have specific cause fragments for this topic yet. What I do have:</p></div>');
        html.push(knListHTML((topic.keyPoints || []).slice(0, 6)));
    } else {
        html.push('<div class="para-body">' + knParagraphsHTML(frags.map(function (f) { return f.text; })) + '</div>');
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'causes', frags.map(function (f) { return f.text; }).join('\n\n'), {});
    return html.join('');
}

function knBuildEffects(topic) {
    var frags = knFragmentsByCategory(topic, 'effect');

    var html = [];
    html.push(knTitle('Effects — ' + topic.title));

    if (!frags.length) {
        html.push('<div class="para-body"><p class="para-line">I don\'t have specific effect fragments for this topic yet.</p></div>');
    } else {
        html.push('<div class="para-body">' + knParagraphsHTML(frags.map(function (f) { return f.text; })) + '</div>');
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'effects', frags.map(function (f) { return f.text; }).join('\n\n'), {});
    return html.join('');
}

function knBuildSolutions(topic) {
    var frags = knFragmentsByCategory(topic, 'solution');

    var html = [];
    html.push(knTitle('Solutions — ' + topic.title));

    if (!frags.length) {
        html.push('<div class="para-body"><p class="para-line">I don\'t have specific solution fragments for this topic yet. Related points that may help:</p></div>');
        html.push(knListHTML((topic.keyPoints || []).slice(0, 6)));
    } else {
        html.push('<div class="para-body">' + knParagraphsHTML(frags.map(function (f) { return f.text; })) + '</div>');
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'solutions', frags.map(function (f) { return f.text; }).join('\n\n'), {});
    return html.join('');
}

function knBuildImportance(topic) {
    var frags = knFragmentsByCategory(topic, 'importance');
    if (!frags.length) frags = knFragmentsByCategory(topic, 'effect');

    var html = [];
    html.push(knTitle('Why ' + topic.title + ' matters'));

    if (topic.summary) {
        html.push('<div class="para-explain"><b>At a glance:</b> ' + knEsc(topic.summary) + '</div>');
    }

    if (frags.length) {
        html.push('<div class="para-body">' + knParagraphsHTML(frags.slice(0, 5).map(function (f) { return f.text; })) + '</div>');
    }

    if (topic.keyPoints && topic.keyPoints.length) {
        html.push(knSectionHeading('Key reasons'));
        html.push(knListHTML(topic.keyPoints.slice(0, 6)));
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'importance', frags.slice(0, 5).map(function (f) { return f.text; }).join('\n\n'), {});
    return html.join('');
}

function knBuildFacts(topic) {
    var html = [];
    html.push(knTitle('Facts — ' + topic.title));

    if (!topic.facts || !topic.facts.length) {
        html.push('<div class="para-body"><p class="para-line">I don\'t have specific facts recorded for this topic yet.</p></div>');
    } else {
        html.push(knSectionHeading('📊 Facts and figures'));
        html.push(knListHTML(topic.facts));
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'facts', (topic.facts || []).join('\n'), {});
    return html.join('');
}

function knBuildExamples(topic) {
    var html = [];
    html.push(knTitle('Examples — ' + topic.title));

    var fragExamples = knFragmentsByCategory(topic, 'example').map(function (f) { return f.text; });
    var listExamples = topic.examples || [];
    var all = listExamples.length ? listExamples : fragExamples;

    if (!all.length) {
        html.push('<div class="para-body"><p class="para-line">I don\'t have specific examples for this topic yet.</p></div>');
    } else {
        html.push(knSectionHeading('🌍 Real-world examples'));
        html.push(knListHTML(all));
        if (listExamples.length && fragExamples.length) {
            html.push(knSectionHeading('In more detail'));
            html.push('<div class="para-body">' + knParagraphsHTML(fragExamples) + '</div>');
        }
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'examples', all.join('\n'), {});
    return html.join('');
}

function knBuildQuote(topic) {
    var html = [];
    html.push(knTitle('Quotes — ' + topic.title));

    if (!topic.quotes || !topic.quotes.length) {
        html.push('<div class="para-body"><p class="para-line">I don\'t have quotes recorded for this topic yet.</p></div>');
    } else {
        for (var i = 0; i < topic.quotes.length; i++) {
            html.push('<div class="para-explain" style="font-style:italic;">' + knEsc(topic.quotes[i]) + '</div>');
        }
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'quote', (topic.quotes || []).join('\n'), {});
    return html.join('');
}

function knBuildKeyPoints(topic) {
    var html = [];
    html.push(knTitle('Key Points — ' + topic.title));
    html.push(knSectionHeading('📌 Key points to remember'));
    html.push(knListHTML(topic.keyPoints || []));
    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');

    knStoreContext(topic, 'keyPoints', (topic.keyPoints || []).join('\n'), {});
    return html.join('');
}


// Builds a two-column comparison table with both key-point lists.
// Rows are padded to the same length so the columns line up.
function knBuildCompareTable(topicA, topicB, labelA, labelB) {
    var a = (topicA.keyPoints || []).slice(0, 8);
    var b = (topicB.keyPoints || []).slice(0, 8);
    var rows = Math.max(a.length, b.length);

    var html = ['<div class="xetex-table-wrap">'];
    html.push('<table class="xetex-table xetex-compare-table">');
    html.push('<thead><tr>');
    html.push('<th>' + knEsc(labelA || topicA.title) + '</th>');
    html.push('<th>' + knEsc(labelB || topicB.title) + '</th>');
    html.push('</tr></thead>');
    html.push('<tbody>');
    for (var i = 0; i < rows; i++) {
        html.push('<tr>');
        html.push('<td>' + knEsc(a[i] || '') + '</td>');
        html.push('<td>' + knEsc(b[i] || '') + '</td>');
        html.push('</tr>');
    }
    html.push('</tbody>');
    html.push('</table>');
    html.push('</div>');
    return html.join('');
}



// ── Neutral compare ──
function knBuildCompare(text) {
    var topics = knFindAllTopics(text);

    var html = [];
    if (topics.length < 2) {
        html.push(knTitle('Comparison'));
        html.push('<div class="para-body"><p class="para-line">I need two topics to compare. You mentioned: ' +
            (topics.length ? topics.map(function (t) { return knEsc(t.title); }).join(', ') : 'none') +
            '.</p></div>');
        html.push('<div class="para-closing">Right now I only have one topic in the library. Add more and I can compare them.</div>');
        return html.join('');
    }

    var a = topics[0], b = topics[1];
    html.push(knTitle(a.title + ' vs ' + b.title));

    var defA = knFragmentsByCategory(a, 'definition');
    var defB = knFragmentsByCategory(b, 'definition');

    if (defA.length || defB.length) {
        html.push(knSectionHeading(a.title));
        if (defA.length) html.push('<div class="para-body">' + knBodyHTML(defA[0].text) + '</div>');
        else if (a.summary) html.push('<div class="para-body">' + knBodyHTML(a.summary) + '</div>');

        html.push(knSectionHeading(b.title));
        if (defB.length) html.push('<div class="para-body">' + knBodyHTML(defB[0].text) + '</div>');
        else if (b.summary) html.push('<div class="para-body">' + knBodyHTML(b.summary) + '</div>');
    }

    html.push(knSectionHeading('Key points side by side'));
html.push(knBuildCompareTable(a, b));

    html.push('<div class="para-closing">Want me to write a paragraph comparing these two, or expand any point?</div>');

    knStoreContext(a, 'compare', a.title + ' vs ' + b.title, { comparedWith: b.id });
    return html.join('');
}

// ── Bias detection ──
function knDetectCompareBias(text) {
    var t = text.toLowerCase();
    if (/\bbetter\s+than\b|\bsuperior\s+to\b|\bprefer\s+\w+\s+(?:over|to)\b|\bwhich\s+(?:one\s+)?is\s+better\b/.test(t)) {
        return 'first';
    }
    if (/\bworse\s+than\b|\binferior\s+to\b/.test(t)) return 'second';
    return null;
}

// ── Biased compare ──
function knBuildCompareBiased(a, b, favoured) {
    var other = (favoured.id === a.id) ? b : a;

    var favEffects     = knFragmentsByCategory(favoured, 'effect');
    var favKeyPoints   = favoured.keyPoints || [];
    var otherEffects   = knFragmentsByCategory(other, 'effect');
    var otherKeyPoints = other.keyPoints || [];

    var html = [];
    html.push(knTitle('Why ' + favoured.title + ' has the edge over ' + other.title));

    html.push('<div class="para-explain"><b>Short answer:</b> ' +
        knEsc(favoured.title) + ' is generally the stronger choice when its strengths align with what you need — ' +
        'but "better" depends on the job. ' + knEsc(other.title) + ' wins in some situations too.</div>');

    // Build two parallel point lists, then render them side by side.
var favPoints = [];
for (var i = 0; i < favEffects.length && favPoints.length < 4; i++) favPoints.push(favEffects[i].text);
if (favPoints.length < 4) {
    for (var k = 0; k < favKeyPoints.length && favPoints.length < 6; k++) favPoints.push(favKeyPoints[k]);
}

var otherPoints = [];
for (var j = 0; j < otherEffects.length && otherPoints.length < 3; j++) otherPoints.push(otherEffects[j].text);
if (otherPoints.length < 3) {
    for (var m = 0; m < otherKeyPoints.length && otherPoints.length < 4; m++) otherPoints.push(otherKeyPoints[m]);
}

if (favPoints.length || otherPoints.length) {
    html.push(knSectionHeading('Side by side'));
    var fakeA = { title: favoured.title, keyPoints: favPoints };
    var fakeB = { title: other.title, keyPoints: otherPoints };
    html.push(knBuildCompareTable(fakeA, fakeB,
        'Why ' + favoured.title, 'Where ' + other.title + ' wins'));
}

    if (otherEffects.length || otherKeyPoints.length) {
        html.push(knSectionHeading('Where ' + other.title + ' still wins'));
        var cpoints = [];
        for (var j = 0; j < otherEffects.length && cpoints.length < 3; j++) {
            cpoints.push(otherEffects[j].text);
        }
        if (cpoints.length < 3) {
            for (var m = 0; m < otherKeyPoints.length && cpoints.length < 4; m++) {
                cpoints.push(otherKeyPoints[m]);
            }
        }
        html.push(knListHTML(cpoints));
    }

    html.push('<div class="para-explain"><b>Verdict:</b> choose ' + knEsc(favoured.title) +
        ' when its strengths match your priorities; choose ' + knEsc(other.title) +
        ' when its strengths matter more for your use case.</div>');

    html.push('<div class="para-closing">Want me to go deeper on any of these points, or a full neutral side-by-side?</div>');

    knStoreContext(favoured, 'compare-biased', favoured.title + ' > ' + other.title, { comparedWith: other.id });
    return html.join('');
}

function knBuildCompareAuto(text) {
    var topics = knFindAllTopics(text);
    if (topics.length < 2) return knBuildCompare(text);

    var bias = knDetectCompareBias(text);
    if (!bias) return knBuildCompare(text);

    var favoured = (bias === 'first') ? topics[0] : topics[1];
    return knBuildCompareBiased(topics[0], topics[1], favoured);
}

// ── judge ──
function knBuildJudge(topic) {
    var html = [];
    html.push(knTitle('Is ' + topic.title + ' harmful?'));

    var effects = knFragmentsByCategory(topic, 'effect');
    var causes  = knFragmentsByCategory(topic, 'cause');
    var solutions = knFragmentsByCategory(topic, 'solution');

    var verdict;
    if (causes.length && !solutions.length) {
        verdict = 'Yes — ' + topic.title.toLowerCase() + ' is harmful. The reasons are clear.';
    } else if (causes.length && solutions.length) {
        verdict = 'Yes — but not hopelessly so. It is harmful, yet it can be addressed.';
    } else {
        verdict = 'Based on what I have recorded:';
    }
    html.push('<div class="para-explain"><b>Short answer:</b> ' + knEsc(verdict) + '</div>');

    if (effects.length) {
        html.push(knSectionHeading('Why'));
        html.push(knParagraphsHTML(effects.slice(0, 4).map(function (f) { return f.text; })));
    }
    if (solutions.length) {
        html.push(knSectionHeading('But here\'s what can be done'));
        html.push(knParagraphsHTML(solutions.slice(0, 3).map(function (f) { return f.text; })));
    }

    html.push('<div class="para-closing">Want the full effects list, the causes, or the solutions?</div>');
    return html.join('');
}

// ── predict ──
function knBuildPredict(topic) {
    var html = [];
    html.push(knTitle('What happens if we do nothing about ' + topic.title));

    var causes    = knFragmentsByCategory(topic, 'cause');
    var effects   = knFragmentsByCategory(topic, 'effect');
    var importance = knFragmentsByCategory(topic, 'importance');

    if (causes.length) {
        html.push(knSectionHeading('The forces at play'));
        html.push(knParagraphsHTML(causes.slice(0, 2).map(function (f) { return f.text; })));
    }
    if (effects.length) {
        html.push(knSectionHeading('If nothing changes'));
        html.push(knParagraphsHTML(effects.slice(0, 4).map(function (f) { return f.text; })));
    }
    if (importance.length) {
        html.push('<div class="para-explain"><b>Stakes:</b> ' +
            importance.map(function (f) { return knEsc(f.text); }).join(' ') + '</div>');
    }

    var facts = topic.facts || [];
    if (facts.length) {
        html.push(knSectionHeading('By the numbers'));
        html.push(knListHTML(facts.slice(0, 3)));
    }

    html.push('<div class="para-closing">Want me to lay out what can still be done?</div>');
    return html.join('');
}

// ── sources ──
function knBuildSources(topic) {
    var html = [];
    html.push(knTitle('Sources — ' + topic.title));

    var sources = topic.sources || [];
    if (!sources.length) {
        html.push('<div class="para-explain">I haven\'t recorded specific sources for this topic yet. The content in this knowledge base is curated from general reference material — school textbooks, environmental studies, and publicly available reports.</div>');
    } else {
        html.push(knSectionHeading('Where the facts and figures come from'));
        html.push(knListHTML(sources));
    }

    if (topic.facts && topic.facts.length) {
        html.push(knSectionHeading('Facts on record'));
        html.push(knListHTML(topic.facts.slice(0, 5)));
    }

    html.push('<div class="para-explain" style="opacity:0.75;font-size:var(--xn-text-sm);">Xenon\'s knowledge base is curated content for study and reference. For research or publication, verify any figure against the primary source.</div>');

    html.push('<div class="para-closing">Want the full facts list, or a specific claim traced?</div>');
    return html.join('');
}

// ── research / analyze ──
function knBuildResearch(topic, greeting) {
    var html = [];
    var ack = greeting ? knGreetingAck(greeting) : null;
    if (ack) {
        html.push('<div class="para-intro">' + knEsc(ack) + ' Let\'s take a structured look at ' + knEsc(topic.title) + '.</div>');
    } else {
        html.push('<div class="para-intro">A structured overview of ' + knEsc(topic.title) + ':</div>');
    }

    html.push(knTitle(topic.title + ' — Overview'));

    var defs = knFragmentsByCategory(topic, 'definition');
    if (defs.length) {
        html.push(knSectionHeading('1. What it is'));
        html.push(knParagraphsHTML([defs[0].text]));
    } else if (topic.summary) {
        html.push(knSectionHeading('1. What it is'));
        html.push(knParagraphsHTML([topic.summary]));
    }

    var causes = knFragmentsByCategory(topic, 'cause');
    if (causes.length) {
        html.push(knSectionHeading('2. What drives it'));
        html.push(knListHTML(causes.map(function (f) { return f.text.split(/[.!?]/)[0].trim(); })));
    }

    var effects = knFragmentsByCategory(topic, 'effect');
    if (effects.length) {
        html.push(knSectionHeading('3. Why it matters'));
        html.push(knListHTML(effects.slice(0, 5).map(function (f) { return f.text.split(/[.!?]/)[0].trim(); })));
    }

    var solutions = knFragmentsByCategory(topic, 'solution');
    if (solutions.length) {
        html.push(knSectionHeading('4. What can be done'));
        html.push(knListHTML(solutions.map(function (f) { return f.text.split(/[.!?]/)[0].trim(); })));
    }

    if (topic.facts && topic.facts.length) {
        html.push(knSectionHeading('5. Key figures'));
        html.push(knListHTML(topic.facts.slice(0, 5)));
    }

    var related = (topic.relatedTopics || []).map(function (id) {
        var r = knTopicById(id);
        return r ? r.title : null;
    }).filter(Boolean);
    if (related.length) {
        html.push(knSectionHeading('6. Related topics'));
        html.push(knListHTML(related));
    }

    html.push('<div class="para-closing">Want me to go deeper on any section — causes, effects, solutions, facts, or examples?</div>');
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// RELATION HELPERS (NEW)
// ═══════════════════════════════════════════════════════════════════

// Pull the "external" referent out of a relation query:
//   "how Machine Code is related with computers"  → "computers"
//   "how does compiler relate to interpreters"    → "interpreters"
//   "in relation to hardware"                     → "hardware"
// Returns null if no phrase can be extracted, or if the phrase actually
// resolves to a known topic (caller should use knBuildRelation instead).
function knExtractRelationTarget(text, knownTopic) {
    var t = String(text || '');

    var m = t.match(/\brelat\w*\s+(?:to|with)\s+(.+?)[.?!]*\s*$/i)
         || t.match(/\bconnection\s+(?:between|with|to)\s+(.+?)[.?!]*\s*$/i)
         || t.match(/\blink(?:ed|s)?\s+(?:to|with|between)\s+(.+?)[.?!]*\s*$/i)
         || t.match(/\brelationship\s+(?:with|to)\s+(.+?)[.?!]*\s*$/i);
    if (!m) return null;

    var phrase = m[1].trim();
    if (!phrase) return null;

    phrase = phrase.replace(/^(?:the|a|an|some|any)\s+/i, '').trim();
    phrase = phrase.replace(/\s+(?:and|or)\s*$/i, '').trim();

    if (!phrase || phrase.length > 40) return null;

    var topics = knGetTopics();
    for (var i = 0; i < topics.length; i++) {
        if (topics[i].aliases && topics[i].aliases.test(phrase)) return null;
    }

    if (knownTopic && knownTopic.aliases && knownTopic.aliases.test(phrase)) return null;

    return phrase;
}

// When a relation is asked about a topic and an external concept that
// isn't in the KB, answer using the topic's own fragments.
function knBuildRelationExternal(topic, external) {
    var html = [];
    var target = external || 'the wider world';

    html.push(knTitle(topic.title + ' — its place in ' + target));

    var defs = knFragmentsByCategory(topic, 'definition');
    if (defs.length) {
        html.push('<div class="para-body">' + knBodyHTML(defs[0].text) + '</div>');
    } else if (topic.summary) {
        html.push('<div class="para-body">' + knBodyHTML(topic.summary) + '</div>');
    }

    var effects     = knFragmentsByCategory(topic, 'effect');
    var importance  = knFragmentsByCategory(topic, 'importance');
    var context     = knFragmentsByCategory(topic, 'context');

    var points = [];
    for (var i = 0; i < effects.length && points.length < 4; i++) points.push(effects[i].text);
    for (var j = 0; j < importance.length && points.length < 5; j++) points.push(importance[j].text);
    for (var k = 0; k < context.length && points.length < 6; k++) points.push(context[k].text);

    if (points.length) {
        html.push(knSectionHeading('How ' + topic.title + ' connects to ' + target));
        html.push(knParagraphsHTML(points));
    }

    html.push('<div class="para-explain" style="opacity:0.85;">I don\'t have a dedicated entry on <b>' +
        knEsc(target) + '</b> yet, so this is what ' + knEsc(topic.title) +
        ' contributes to ' + knEsc(target) + ' rather than a full comparison. ' +
        'If you mean a specific topic inside ' + knEsc(target) +
        ', name it and I\'ll pull that up.</div>');

    html.push('<div class="para-closing">Want me to go deeper on any of these points, or add ' +
        knEsc(target) + ' as a topic?</div>');

    return html.join('');
}

// ── two-topic relation ──
function knFragmentsMentioningTopic(source, target) {
    if (!source.body) return [];
    var needles = [target.title.toLowerCase()];
    var tags = target.tags || [];
    for (var i = 0; i < tags.length; i++) needles.push(tags[i].toLowerCase());
    var out = [];
    for (var b = 0; b < source.body.length; b++) {
        var frag = source.body[b];
        var txt = frag.text.toLowerCase();
        for (var n = 0; n < needles.length; n++) {
            if (needles[n].length < 3) continue;
            if (txt.indexOf(needles[n]) !== -1) { out.push(frag); break; }
        }
    }
    return out;
}

function knSharedKeywords(a, b) {
    var ta = (a.tags || []).map(function (x) { return x.toLowerCase(); });
    var tb = (b.tags || []).map(function (x) { return x.toLowerCase(); });
    var shared = [];
    for (var i = 0; i < ta.length; i++) if (tb.indexOf(ta[i]) !== -1) shared.push(ta[i]);
    return shared;
}

function knBuildRelation(topicA, topicB) {
    var html = [];
    html.push(knTitle(topicA.title + ' & ' + topicB.title + ' — how they connect'));

    var aRefersToB = (topicA.relatedTopics || []).indexOf(topicB.id) !== -1;
    var bRefersToA = (topicB.relatedTopics || []).indexOf(topicA.id) !== -1;
    if (aRefersToB || bRefersToA) {
        html.push('<div class="para-explain">These topics are directly cross-referenced in the knowledge base.</div>');
    }

    var aMentionsB = knFragmentsMentioningTopic(topicA, topicB);
    var bMentionsA = knFragmentsMentioningTopic(topicB, topicA);

    if (aMentionsB.length) {
        html.push(knSectionHeading('How ' + topicA.title + ' relates to ' + topicB.title));
        html.push(knParagraphsHTML(aMentionsB.map(function (f) { return f.text; })));
    }
    if (bMentionsA.length) {
        html.push(knSectionHeading('How ' + topicB.title + ' relates to ' + topicA.title));
        html.push(knParagraphsHTML(bMentionsA.map(function (f) { return f.text; })));
    }

    if (!aMentionsB.length && !bMentionsA.length) {
        var shared = knSharedKeywords(topicA, topicB);
        if (shared.length) {
            html.push('<div class="para-explain">They aren\'t directly cross-referenced, but they share common ground on: <b>' + knEsc(shared.join(', ')) + '</b>.</div>');
            var efA = knFragmentsByCategory(topicA, 'effect').slice(0, 2);
            var efB = knFragmentsByCategory(topicB, 'effect').slice(0, 2);
            if (efA.length) {
                html.push(knSectionHeading('From ' + topicA.title));
                html.push(knParagraphsHTML(efA.map(function (f) { return f.text; })));
            }
            if (efB.length) {
                html.push(knSectionHeading('From ' + topicB.title));
                html.push(knParagraphsHTML(efB.map(function (f) { return f.text; })));
            }
        } else {
            html.push('<div class="para-explain">I don\'t have enough recorded on both topics yet to draw a direct link.</div>');
        }
    }

    html.push('<div class="para-closing">Want me to write a paragraph covering both, or a full comparison?</div>');
    return html.join('');
}

// ── unknown-topics fallback (capped) ──
function knBuildUnknownTopicsFallback(rawText) {
    var html = [];
    var candidates = [];
    var re = /\b(?:what\s+is|what\s+are|why\s+is|why\s+are|tell\s+me\s+about|explain|describe|define|about)\s+([a-z][a-z\s]{2,30}?)(?=\s+(?:is|are|does|do|and|why|how|related|\?|$))/gi;
    var m;
    while ((m = re.exec(rawText)) !== null) {
        var name = m[1].trim();
        if (name && candidates.indexOf(name) === -1) candidates.push(name);
    }

    var topics = knGetTopics();
    var total = topics.length;

    if (candidates.length) {
        html.push('<div class="para-intro">I don\'t have <b>' +
            candidates.map(function (c) { return knEsc(c); }).join('</b> or <b>') +
            '</b> in my knowledge base yet.</div>');
    } else {
        html.push('<div class="para-intro">I don\'t have that topic in my knowledge base yet.</div>');
    }

    if (total === 0) {
        html.push('<div class="para-closing">The knowledge base is empty right now.</div>');
        return html.join('');
    }

    var byCat = {};
    var catOrder = [];
    for (var i = 0; i < topics.length; i++) {
        var cat = topics[i].category || 'General';
        if (!byCat[cat]) { byCat[cat] = []; catOrder.push(cat); }
        byCat[cat].push(topics[i]);
    }

    var LIST_ALL_LIMIT = 8;
    var PER_CAT_CAP = 4;

    if (total <= LIST_ALL_LIMIT) {
        for (var c = 0; c < catOrder.length; c++) {
            var list = byCat[catOrder[c]];
            html.push(knSectionHeading(catOrder[c] + ' (' + list.length + ')'));
            html.push('<ul class="para-keypoints">');
            for (var t = 0; t < list.length; t++) {
                html.push('<li><b>' + knEsc(list[t].title) + '</b></li>');
            }
            html.push('</ul>');
        }
    } else {
        for (var c2 = 0; c2 < catOrder.length; c2++) {
            var list2 = byCat[catOrder[c2]];
            var shown = list2.slice(0, PER_CAT_CAP);
            var remaining = list2.length - shown.length;
            html.push(knSectionHeading(catOrder[c2] + ' (' + list2.length + ')'));
            html.push('<ul class="para-keypoints">');
            for (var s = 0; s < shown.length; s++) {
                html.push('<li><b>' + knEsc(shown[s].title) + '</b></li>');
            }
            if (remaining > 0) {
                html.push('<li style="opacity:0.6;">…and ' + remaining + ' more</li>');
            }
            html.push('</ul>');
        }
        html.push('<div class="para-explain">The library has <b>' + total +
            '</b> topics across <b>' + catOrder.length + '</b> categories. Ask about any single one to see its full answer.</div>');
    }

    html.push('<div class="para-closing">Ask about any of these — or tell me a new topic and I\'ll do my best.</div>');
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-PART HANDLING
// ═══════════════════════════════════════════════════════════════════

var KN_TOPIC_SKIPPED_INTENTS = { compare: true, relation: true, 'compare-biased': true };

function knBuildIntentSection(topic, intent) {
    var heading = {
        define:     'What is ' + topic.title + '?',
        causes:     'What causes ' + topic.title + '?',
        effects:    'Is it harmful? Effects of ' + topic.title,
        solutions:  'Solutions — ' + topic.title,
        importance: 'Why ' + topic.title + ' matters',
        facts:      'Facts and figures',
        examples:   'Examples',
        quote:      'Quotes',
        keyPoints:  'Key points',
        judge:      'Is it harmful?',
        predict:    'What happens if nothing changes',
        sources:    'Sources',
        research:   'Overview'
    }[intent] || 'Overview';

    var inner;
    switch (intent) {
        case 'define':     inner = knBuildDefine(topic); break;
        case 'causes':     inner = knBuildCauses(topic); break;
        case 'effects':    inner = knBuildEffects(topic); break;
        case 'solutions':  inner = knBuildSolutions(topic); break;
        case 'importance': inner = knBuildImportance(topic); break;
        case 'facts':      inner = knBuildFacts(topic); break;
        case 'examples':   inner = knBuildExamples(topic); break;
        case 'quote':      inner = knBuildQuote(topic); break;
        case 'keyPoints':  inner = knBuildKeyPoints(topic); break;
        case 'judge':      inner = knBuildJudge(topic); break;
        case 'predict':    inner = knBuildPredict(topic); break;
        case 'sources':    inner = knBuildSources(topic); break;
        case 'research':   inner = knBuildResearch(topic); break;
        default:           inner = knBuildDefine(topic); break;
    }
    inner = inner.replace(/^<div class="xetex-equation">[^<]*<\/div>/, '');
    inner = inner.replace(/<div class="para-closing">[\s\S]*?<\/div>$/, '');
    return '<div class="para-keypoints-heading">' + knEsc(heading) + '</div>' + inner;
}

function knBuildMultiPart(rawText) {
    var intents = knExtractIntentsWithPositions(rawText);
    var topicsInfo = knExtractTopicsWithPositions(rawText);
    var knownTopics = topicsInfo.map(function (x) { return x.topic; });

    if (!knownTopics.length) return knBuildUnknownTopicsFallback(rawText);

    var html = [];

    var hasRelation = intents.some(function (x) { return x.intent === 'relation'; });
    var hasCompare = intents.some(function (x) { return x.intent === 'compare'; });
    var hasJudge   = intents.some(function (x) { return x.intent === 'judge'; });

    // Relation — one or two topics.
    if (hasRelation) {
        if (knownTopics.length >= 2) {
            html.push(knBuildRelation(knownTopics[0], knownTopics[1]));
            knStoreContext(knownTopics[0], 'relation', knownTopics.map(function (t) { return t.title; }).join(' · '), {});
        } else if (knownTopics.length === 1) {
            var target = knExtractRelationTarget(rawText, knownTopics[0]);
            html.push(knBuildRelationExternal(knownTopics[0], target));
            knStoreContext(knownTopics[0], 'relation-external',
                knownTopics[0].title + ' ↔ ' + (target || 'external'), {});
        } else {
            html.push(knBuildUnknownTopicsFallback(rawText));
        }
        return html.join('');
    }

    // Compare — two topics.
    if (hasCompare && knownTopics.length >= 2) {
        html.push(knBuildCompareAuto(rawText));
        return html.join('');
    }

    // Judge with two topics — biased compare.
    if (hasJudge && knownTopics.length >= 2) {
        var bias = knDetectCompareBias(rawText) || 'first';
        var favoured = (bias === 'first') ? knownTopics[0] : knownTopics[1];
        html.push(knBuildCompareBiased(knownTopics[0], knownTopics[1], favoured));
        return html.join('');
    }

    // Per-topic sections for each applicable intent.
    var fullText = [];
    if (knownTopics.length >= 2) {
        for (var t = 0; t < knownTopics.length; t++) {
            var topic = knownTopics[t];
            var topicIntents = intents.length
                ? intents.map(function (x) { return x.intent; })
                : ['define'];
            html.push(knTitle(topic.title));
            var seen = {};
            for (var i = 0; i < topicIntents.length; i++) {
                var it = topicIntents[i];
                if (seen[it]) continue;
                if (KN_TOPIC_SKIPPED_INTENTS[it]) continue;
                seen[it] = true;
                html.push(knBuildIntentSection(topic, it));
                fullText.push(topic.title + ': ' + it);
            }
            if (!Object.keys(seen).length) {
                html.push(knBuildIntentSection(topic, 'define'));
                fullText.push(topic.title + ': define');
            }
        }
    } else {
        var topic0 = knownTopics[0];
        html.push(knTitle(topic0.title));
        var seen0 = {};
        var anyIntents = intents.length ? intents : [{ intent: 'define' }];
        for (var k = 0; k < anyIntents.length; k++) {
            var itk = anyIntents[k].intent;
            if (seen0[itk]) continue;
            if (KN_TOPIC_SKIPPED_INTENTS[itk]) continue;
            seen0[itk] = true;
            html.push(knBuildIntentSection(topic0, itk));
            fullText.push(topic0.title + ': ' + itk);
        }
        if (!Object.keys(seen0).length) {
            html.push(knBuildIntentSection(topic0, 'define'));
            fullText.push(topic0.title + ': define');
        }
    }

    html.push('<div class="para-closing">' + knEsc(knNaturalClose()) + '</div>');
    knStoreContext(knownTopics[0], 'multi', fullText.join('\n'), {});
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// FOLLOW-UP MEMORY
// ═══════════════════════════════════════════════════════════════════

var __knContext = null;

function knStoreContext(topic, intent, text, meta) {
    __knContext = {
        timestamp: Date.now(),
        topic: topic,
        intent: intent,
        text: text,
        paragraphs: text.split(/\n\n+/),
        keyPoints: (topic.keyPoints || []).slice(),
        meta: meta || {}
    };
}

function knDetectFollowUp(text) {
    if (!__knContext) return false;
    if (typeof text !== 'string') return false;
    var t = text.trim().toLowerCase();
    if (!t || t.length > 250) return false;

    if (/^\/(para|paragraph|essay|write)\b/i.test(t)) return false;
    if (/\b(write|draft|compose|create|prepare)\b.{0,30}\b(paragraph|essay|notes)\b/i.test(t)) return false;
    if (knFindTopic(t)) return false;

    if (/\b(paragraph|para|point|line|section|item|fact|bullet|example|quote)\s+(\d+|first|second|third|fourth|fifth|last|one|two|three)\b/.test(t)) return true;
    if (/\b(explain|describe|elaborate\s+on|what\s+about|tell\s+me\s+more\s+about)\b/.test(t)) return true;

    if (/\b(shorten|shorter|short\s+version|trim|reduce|cut\s+it|brief|concise)\b/.test(t)) return true;
    if (/\b(expand|lengthen|longer|add\s+(more|detail|example|examples)|flesh\s+out|more\s+detail)\b/.test(t)) return true;

    if (/\b(more\s+formal|less\s+formal|more\s+casual|more\s+informal|professional|academic|formal\s+version|casual\s+version|simpler\s+version|simplify|make\s+it\s+simple)\b/.test(t)) return true;
    if (/\b(bullet\s*points?|bulleted|as\s+a\s+list|list\s+form|turn\s+(it|this|that)\s+into|convert\s+to)\b/.test(t)) return true;
    if (/\b(rewrite|rephrase|reword|change\s+the\s+tone)\b/.test(t)) return true;

    if (/\b(why|what|how)\b.{0,50}\b(mention|mentioned|mean|means|say|said|wrote|include|included)\b/.test(t)) return true;
    if (/\bwhat\s+does\b.{0,50}\bmean\b/.test(t)) return true;

    // Sources / claims — a follow-up to whatever topic we last answered about.
    if (/\b(?:sources?|references?|citations?|evidence|claims?)\b/.test(t)) return true;
    if (/\bwhere\s+did\s+you\s+(?:get|read|find)\b/.test(t)) return true;
    if (/\bwhat\s+are\s+your\s+sources?\b/.test(t)) return true;
    if (/\bbased\s+on\s+what\b/.test(t)) return true;
    if (/\bhow\s+do\s+you\s+know\b/.test(t)) return true;

    if (/^(shorter|longer|expand|shorten|simplify|formal|casual|bullets?|more|why|how)\s*[.!?]?$/.test(t)) return true;

    return false;
}

function knOrdinalToIndex(word) {
    var map = {
        first: 0, second: 1, third: 2, fourth: 3, fifth: 4,
        '1st': 0, '2nd': 1, '3rd': 2, '4th': 3, '5th': 4,
        one: 0, two: 1, three: 2, last: -1
    };
    return map[word] !== undefined ? map[word] : null;
}

function knFindParagraphOrItem(text) {
    var t = text.toLowerCase();
    var m = t.match(/\b(first|second|third|fourth|fifth|last|one|two|three|\d+(?:st|nd|rd|th)?)\s+(?:paragraph|point|line|section|item|fact|bullet|example|quote)\b/);
    if (m) {
        var tok = m[1];
        if (tok === 'last') return __knContext.paragraphs.length - 1;
        var numMatch = tok.match(/\d+/);
        if (numMatch) return parseInt(numMatch[0], 10) - 1;
        var idx = knOrdinalToIndex(tok);
        if (idx !== null) return idx;
    }
    m = t.match(/\b(?:paragraph|point|item|fact)\s+(\d+)/);
    if (m) return parseInt(m[1], 10) - 1;
    return null;
}

function knApplyTone(text, tone) {
    var out = text;
    if (tone === 'formal') {
        out = out
            .replace(/\bkids\b/gi, 'children')
            .replace(/\ba lot of\b/gi, 'a great deal of')
            .replace(/\bstuff\b/gi, 'materials')
            .replace(/\bthings\b/gi, 'elements')
            .replace(/\bbig\b/gi, 'substantial')
            .replace(/\bhuge\b/gi, 'significant')
            .replace(/\bget\b/gi, 'obtain')
            .replace(/\bbad\b/gi, 'detrimental')
            .replace(/\bgood\b/gi, 'beneficial')
            .replace(/\bcan'?t\b/gi, 'cannot')
            .replace(/\bdon'?t\b/gi, 'do not')
            .replace(/\bwon'?t\b/gi, 'will not');
    } else if (tone === 'casual') {
        out = out
            .replace(/\bchildren\b/gi, 'kids')
            .replace(/\bindividuals\b/gi, 'people')
            .replace(/\bcommence\b/gi, 'start')
            .replace(/\bterminate\b/gi, 'end')
            .replace(/\bobtain\b/gi, 'get')
            .replace(/\bthus\b/gi, 'so')
            .replace(/\bhowever\b/gi, 'but')
            .replace(/\bmoreover\b/gi, 'also');
    } else if (tone === 'simple') {
        out = out.split(/(?<=[.!?])\s+/).map(function (s) { return s.replace(/;\s+/g, '. '); }).join(' ');
    }
    return out;
}

function knToBullets(ctx) {
    var lines = ctx.text.split(/\n+/).filter(function (l) { return l.trim(); });
    if (lines.length > 1 && lines[0].length < 200) return lines.slice(0, 10);

    var bullets = [];
    if (ctx.topic && ctx.topic.body) {
        for (var i = 0; i < ctx.topic.body.length; i++) {
            var frag = ctx.topic.body[i];
            if (ctx.text.indexOf(frag.text) !== -1) {
                var short = frag.text.split(/[.!?]/)[0].trim();
                if (short.length > 90) short = short.slice(0, 87) + '...';
                bullets.push(short);
            }
        }
    }
    if (bullets.length > 8) bullets = bullets.slice(0, 8);
    if (bullets.length === 0) bullets = (ctx.keyPoints || []).slice(0, 6);
    return bullets;
}

function knExtractKeyword(t) {
    var m = t.match(/\b(?:mention|mentioned|about|mean|means|say|said|write|wrote|include|included)\s+([a-z][a-z\s]{2,30})[?.!]*$/);
    if (m) return m[1].trim().replace(/^(the|a|an)\s+/, '');
    m = t.match(/\bwhat\s+does\s+([a-z][a-z\s]{2,30})\s+mean\b/);
    if (m) return m[1].trim().replace(/^(the|a|an)\s+/, '');
    m = t.match(/\btell\s+me\s+more\s+about\s+([a-z][a-z\s]{2,30})[?.!]*$/);
    if (m) return m[1].trim().replace(/^(the|a|an)\s+/, '');
    return null;
}

function knSearchContent(keyword, ctx) {
    if (!keyword) return null;
    var kw = keyword.toLowerCase();

    for (var k = 0; k < ctx.keyPoints.length; k++) {
        if (ctx.keyPoints[k].toLowerCase().indexOf(kw) !== -1) {
            return { type: 'keyPoint', text: ctx.keyPoints[k] };
        }
    }

    if (ctx.topic && ctx.topic.body) {
        for (var b = 0; b < ctx.topic.body.length; b++) {
            var frag = ctx.topic.body[b];
            if (frag.text.toLowerCase().indexOf(kw) !== -1 && ctx.text.indexOf(frag.text) !== -1) {
                return { type: 'fragment', text: frag.text };
            }
        }
    }

    if (ctx.topic && ctx.topic.facts) {
        for (var f = 0; f < ctx.topic.facts.length; f++) {
            if (ctx.topic.facts[f].toLowerCase().indexOf(kw) !== -1) {
                return { type: 'fact', text: ctx.topic.facts[f] };
            }
        }
    }

    for (var p = 0; p < ctx.paragraphs.length; p++) {
        if (ctx.paragraphs[p].toLowerCase().indexOf(kw) !== -1) {
            return { type: 'paragraph', text: ctx.paragraphs[p] };
        }
    }

    return null;
}

function knMatchKeyPointsToParagraph(paragraph, keyPoints) {
    var paraLower = paragraph.toLowerCase();
    var matches = [];
    for (var i = 0; i < keyPoints.length; i++) {
        var words = keyPoints[i].toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        for (var w = 0; w < words.length; w++) {
            if (paraLower.indexOf(words[w]) !== -1) {
                matches.push(keyPoints[i]);
                break;
            }
        }
        if (matches.length >= 3) break;
    }
    return matches;
}

function knBuildFollowUp(text) {
    if (!__knContext) {
        return '<div class="xetex-note">No recent answer to refer back to. Run /paragraph with a topic first.</div>';
    }

    var t = text.toLowerCase().trim();
    var ctx = __knContext;
    var html = [];

    // Sources / claims — highest priority so "sources" isn't mistaken for
    // other follow-up intents.
    if (/\b(?:sources?|references?|citations?|evidence|claims?)\b/.test(t) ||
        /\bwhere\s+did\s+you\s+(?:get|read|find)\b/.test(t) ||
        /\bwhat\s+are\s+your\s+sources?\b/.test(t) ||
        /\bbased\s+on\s+what\b/.test(t) ||
        /\bhow\s+do\s+you\s+know\b/.test(t)) {
        var srcHTML = knBuildSources(ctx.topic);
        srcHTML = srcHTML.replace(/^<div class="xetex-equation">[^<]*<\/div>/, '');
        return srcHTML;
    }

    if (/\b(shorten|shorter|short\s+version|trim|reduce|cut\s+it|brief|concise)\b/.test(t) || /^shorter\b/.test(t)) {
        var shortParagraphs = [ctx.paragraphs[0], ctx.paragraphs[ctx.paragraphs.length - 1]];
        var shortText = shortParagraphs.join('\n\n');
        html.push(knTitle('Shortened — ' + ctx.topic.title));
        html.push('<div class="para-body">' + knBodyHTML(shortText) + '</div>');
        html.push('<div class="para-closing">That\'s the shortened version. Want it even shorter?</div>');
        return html.join('');
    }

    if (/\b(expand|lengthen|longer|add\s+(more|detail|example|examples)|flesh\s+out|more\s+detail)\b/.test(t) || /^longer\b/.test(t)) {
        var current = ctx.text;
        var added = [];

        if (ctx.topic && ctx.topic.body) {
            for (var bi = 0; bi < ctx.topic.body.length; bi++) {
                var frag = ctx.topic.body[bi];
                if (current.indexOf(frag.text) === -1 && frag.category !== 'definition') {
                    added.push(frag.text);
                    if (added.length >= 3) break;
                }
            }
        }
        if (!added.length && ctx.topic && ctx.topic.facts) {
            for (var fi = 0; fi < ctx.topic.facts.length; fi++) {
                if (current.indexOf(ctx.topic.facts[fi]) === -1) {
                    added.push(ctx.topic.facts[fi]);
                    if (added.length >= 3) break;
                }
            }
        }

        if (!added.length) {
            html.push(knTitle('Already at full length'));
            html.push('<div class="para-body"><p class="para-line">This answer already includes every fragment I have on the topic. I can\'t expand it further without repeating.</p></div>');
            html.push('<div class="para-closing">Want to ask a different angle?</div>');
            return html.join('');
        }

        var expandedText = current + '\n\n' + added.join('\n\n');
        html.push(knTitle('Expanded — ' + ctx.topic.title));
        html.push('<div class="para-body">' + knBodyHTML(expandedText) + '</div>');
        html.push('<div class="para-closing">Added ' + added.length + ' more paragraph' + (added.length > 1 ? 's' : '') + '. Want more?</div>');
        return html.join('');
    }

    var newTone = null;
    if (/\b(more\s+formal|professional|academic|formal\s+version)\b/.test(t)) newTone = 'formal';
    else if (/\b(more\s+casual|more\s+informal|casual\s+version|relaxed)\b/.test(t)) newTone = 'casual';
    else if (/\b(simpler|simplify|make\s+it\s+simple|easy\s+version)\b/.test(t)) newTone = 'simple';

    if (newTone) {
        var rewritten = knApplyTone(ctx.text, newTone);
        html.push(knTitle(ctx.topic.title + ' — ' + newTone.charAt(0).toUpperCase() + newTone.slice(1) + ' version'));
        html.push('<div class="para-body">' + knBodyHTML(rewritten) + '</div>');
        html.push('<div class="para-closing">How does that read?</div>');
        return html.join('');
    }

    if (/\b(bullet\s*points?|bulleted|as\s+a\s+list|list\s+form|turn\s+(it|this|that)\s+into|convert\s+to)\b/.test(t)) {
        var bullets = knToBullets(ctx);
        html.push(knTitle(ctx.topic.title + ' — Bullet Points'));
        html.push(knListHTML(bullets));
        html.push('<div class="para-closing">Want these as numbered steps?</div>');
        return html.join('');
    }

    var idx = knFindParagraphOrItem(text);
    if (idx !== null && idx >= 0 && idx < ctx.paragraphs.length) {
        var para = ctx.paragraphs[idx];
        var total = ctx.paragraphs.length;
        var role;
        if (idx === 0) role = 'the opening paragraph — it sets the tone and introduces the topic.';
        else if (idx === total - 1) role = 'the closing paragraph — it wraps up the piece with a final thought.';
        else role = 'a supporting paragraph — it develops the topic with a specific reason, fact, or example.';

        html.push(knTitle('Paragraph ' + (idx + 1) + ' of ' + total));
        html.push('<div class="para-body"><p class="para-line"><b>Original text:</b> ' + knEsc(para) + '</p></div>');
        html.push('<div class="para-explain"><b>Its role:</b> This is ' + role + '</div>');

        var matched = knMatchKeyPointsToParagraph(para, ctx.keyPoints);
        if (matched.length) {
            html.push('<div class="para-explain"><b>Related key points:</b> ' + matched.map(knEsc).join(' · ') + '</div>');
        }
        html.push('<div class="para-closing">Want me to simplify this paragraph, expand it, or explain any word in it?</div>');
        return html.join('');
    }

    var keyword = knExtractKeyword(t);
    if (keyword) {
        var match = knSearchContent(keyword, ctx);
        if (match) {
            html.push(knTitle('About: "' + keyword + '"'));
            if (match.type === 'keyPoint' || match.type === 'fact') {
                html.push('<div class="para-explain">' + knEsc(match.text) + '</div>');
            } else {
                html.push('<div class="para-body"><p class="para-line">' + knEsc(match.text) + '</p></div>');
                html.push('<div class="para-explain">That\'s where the point appears in the answer.</div>');
            }
            html.push('<div class="para-closing">Does that answer it?</div>');
            return html.join('');
        }
    }

    html.push(knTitle('Following up on: ' + ctx.topic.title));
    html.push('<div class="para-intro">I didn\'t quite catch what you want to change. Here\'s what I can do:</div>');
    html.push('<ul class="para-keypoints">' +
        '<li>Explain a specific paragraph — <b>"explain the second paragraph"</b></li>' +
        '<li>Shorten or expand — <b>"shorten it"</b>, <b>"make it longer"</b></li>' +
        '<li>Clarify a point — <b>"why did you mention soil?"</b></li>' +
        '<li>Change the tone — <b>"make it more formal"</b>, <b>"simplify it"</b></li>' +
        '<li>Convert to bullets — <b>"turn it into bullet points"</b></li>' +
        '</ul>');
    return html.join('');
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

function paraHandle(rawText) {
    var env = knParseEnvelope(rawText);
    var request = env.request || rawText;

    var activeTopic = knGetActiveTopic();
    var namesTopic = knNamesAnyTopic(request);
    var hasAnaphora = knHasAnaphora(request);

    var effectiveRequest = request;
    if (hasAnaphora && !namesTopic && activeTopic) {
        effectiveRequest = request.replace(/\b(it|this|that|them|these|those)\b/i, activeTopic.title);
    }

    if (knIsMultiPart(effectiveRequest)) {
        var multiBody = knBuildMultiPart(effectiveRequest);
        var ackMulti = env.greeting ? knGreetingAck(env.greeting) : null;
        var prefix = ackMulti ? '<div class="para-intro">' + knEsc(ackMulti) + '</div>' : '';
        return { __html: true, text: '<div class="xetex-output para-output">' + prefix + multiBody + '</div>' };
    }

    var topics = knFindAllTopics(effectiveRequest);
    var topic = topics.length ? topics[0] : (hasAnaphora && activeTopic ? activeTopic : null);

    if (!topic) {
        return {
            __html: true,
            text: '<div class="xetex-output para-output">' + knBuildUnknownTopicsFallback(effectiveRequest) + '</div>'
        };
    }

    knSetActiveTopic(topic);

    var intent = knDetectIntent(effectiveRequest);
    var inner;
    var ack = env.greeting ? knGreetingAck(env.greeting) : null;

    switch (intent) {
        case 'compose':    inner = knBuildCompose(topic, effectiveRequest); break;
        case 'define':     inner = knBuildDefine(topic); break;
        case 'causes':     inner = knBuildCauses(topic); break;
        case 'effects':    inner = knBuildEffects(topic); break;
        case 'solutions':  inner = knBuildSolutions(topic); break;
        case 'importance': inner = knBuildImportance(topic); break;
        case 'facts':      inner = knBuildFacts(topic); break;
        case 'examples':   inner = knBuildExamples(topic); break;
        case 'quote':      inner = knBuildQuote(topic); break;
        case 'keyPoints':  inner = knBuildKeyPoints(topic); break;
        case 'judge':      inner = knBuildJudge(topic); break;
        case 'predict':    inner = knBuildPredict(topic); break;
        case 'sources':    inner = knBuildSources(topic); break;
        case 'research':   inner = knBuildResearch(topic, env.greeting); break;
        default:           inner = knBuildDefine(topic); break;
    }

    var prefixLine = (ack && intent !== 'research')
        ? '<div class="para-intro">' + knEsc(ack) + ' Here\'s what I have on <b>' + knEsc(topic.title) + '</b>:</div>'
        : '';

    return { __html: true, text: '<div class="xetex-output para-output">' + prefixLine + inner + '</div>' };
}

// ═══════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════

function isParagraphRequest(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    if (!t || t.length > 500) return false;

    if (/^\/(para|paragraph|essay|know)\b/i.test(t)) return true;

    // Reject other engines.
    if (/\b(c\s*program|source\s+code|compile|syntax\s+error)\b/i.test(t)) return false;
    if (/\b(email|letter|application)\b/i.test(t) && /\b(to|for)\s+\w+/i.test(t)) return false;
    if (/\b(binary|hex|octal|decimal\s+to)\b/i.test(t) && /\bconvert|to\b/i.test(t)) return false;
    if (/\b(integrate|differentiate|derive)\b/i.test(t)) return false;

    // ── Reject MATH-shaped questions ──
    // Strip a leading question wrapper, then check whether the remainder
    // is a math expression. This is what was missing — "what is 9+9"
    // was matching the "what is X" pattern and being swallowed.
    var stripped = t
        .replace(/^(?:what\s+is|what\s+are|what's|calculate|compute|evaluate|solve|find|tell\s+me|show\s+me|give\s+me)\s+/i, '')
        .replace(/[?.!]+$/, '')
        .trim();
    if (stripped && typeof window.mathIsMath === 'function' && window.mathIsMath(stripped)) {
        return false;
    }
    // Any digit adjacent to a math operator → math.
    if (/\d\s*[\+\-\*\/\^]|[\+\-\*\/\^]\s*\d/.test(stripped)) return false;
    // Any recognized math function call → math.
    if (/\b(?:sin|cos|tan|csc|sec|cot|asin|acos|atan|ln|log|log2|log10|sqrt|cbrt|abs|exp|factorial|sum|mean|median|mode|variance|stdDev|gcd|lcm|isPrime|primeFactors|fibonacci|nCr|nPr|log_base|dist|dist3d|midpoint|slope|triangleArea|circleArea|rectangleArea|sphereVolume|cylinderVolume|ap_sum|ap_term|gp_sum|gp_term|gp_infinite_sum|product)\s*\(/i.test(stripped)) {
        return false;
    }

    // ── Reject REASONING-shaped questions ──
    // Text analysis
    if (/\b(?:how\s+many|count(?:\s+the)?|number\s+of)\s+[a-z](?:'s)?\s+(?:are\s+)?(?:there\s+)?(?:in|inside|within)\b/i.test(t)) return false;
    if (/\b(?:how\s+many|count)\s+[a-z](?:'s)?\s+(?:does\s+)?(?:my\s+)?(?:prompt|message|text|sentence|string)\b/i.test(t)) return false;
    if (/\b(?:how\s+many|count(?:\s+the)?)\s+words?\b/i.test(t)) return false;
    if (/\b(?:how\s+many|count(?:\s+the)?)\s+(?:characters?|letters?|chars?)\b/i.test(t)) return false;
    // Comparisons
    if (/\bis\s+\S+\s+(?:bigger|larger|greater|smaller|less|lesser|higher|lower|more|heavier|taller|shorter|younger|older)\s+than\s+\S+/i.test(t)) return false;
    if (/\bwhich\s+(?:is|one\s+is)\s+(?:bigger|larger|greater|smaller|less|higher|lower|more)\b/i.test(t)) return false;
    // Transactions: "had X, spent Y, how much left"
    if (/\b(?:had|has|have|started\s+with)\s+\d+/i.test(t) && /\b(?:spent|paid|bought|put|received|got\s+back|earned)\b/i.test(t) && /\bhow\s+many|how\s+much|what.?s\s+left|remaining\b/i.test(t)) return false;
    // Distribution: "divide N among K"
    if (/\b(?:divide|distribute|share|split)\b.*\bamong\b/i.test(t) && /\d/.test(t)) return false;
    // Two-variable word problems
    if (/\b\d+\s+[a-z]+\s+and\s+\d+\s+[a-z]+/i.test(t) && /\b(?:times|twice|half|less\s+than|more\s+than)\b/i.test(t) && /\b(?:gave|paid|cost|total|spent)\s+\d+/i.test(t)) return false;

    // Composition.
    if (/\b(write|compose|draft|prepare|give)\b.{0,30}\b(paragraph|essay|notes?)\b/i.test(t)) return true;
    if (/\b(paragraph|essay)\b.{0,30}\b(on|about|for)\b/i.test(t)) return true;

    // Strip greeting.
    var env = knParseEnvelope(t);
    var body = env.request || t;

    // Named topic → route.
    var topics = knGetTopics();
    for (var i = 0; i < topics.length; i++) {
        if (topics[i].aliases && topics[i].aliases.test(body)) return true;
    }

    // Pure meta-questions with no active topic — don't route.
    if (!knGetActiveTopic() &&
        /^(?:what\s+are\s+(?:your\s+)?(?:sources?|references?|citations?)|where\s+did\s+you\s+(?:get|read|find)|based\s+on\s+what|how\s+do\s+you\s+know)\b/i.test(body)) {
        return false;
    }

    if (knHasAnaphora(body) && knGetActiveTopic()) return true;

    var isQuestionShape =
        /^(what\s+is|what\s+are|what\s+causes|what\s+are\s+the\s+(causes|effects|solutions))\b/i.test(body) ||
        /^(explain|describe|define|tell\s+me\s+about|tell\s+me\s+more\s+about)\b/i.test(body) ||
        /^(why\s+is|why\s+are|why\s+should|how\s+to\s+(solve|prevent|reduce|stop|control)|how\s+can\s+we\s+(prevent|stop|reduce|control))\b/i.test(body) ||
        /\b(causes?|effects?|impacts?|solutions?|importance|significance)\s+of\b/i.test(body) ||
        /\b(facts?|statistics?|stats|figures?|examples?|case\s+studies|quotes?|quotations?|sources?|references?)\s+(about|on|of|for)\b/i.test(body) ||
        /\b(key\s+points?|main\s+points?|important\s+points?|summary)\s+(about|on|of|for)\b/i.test(body) ||
        /^(do\s+you\s+think|is\s+it|which\s+(one\s+)?is)\b/i.test(body) ||
        /\bwhat\s+will\s+happen\b|\bif\s+we\s+don'?t\b/i.test(body) ||
        /\b(better|worse)\s+than\b/i.test(body) ||
        /\brelat\w*\s+(?:to|with)\b/i.test(body) ||
        /\b(research(?:ing)?|analy[sz]e|analy[sz]ing|investigate|explore|study|deep\s+dive)\b/i.test(body);

       if (isQuestionShape && body.split(/\s+/).length <= 30) {
        // Only claim the question if it actually names a topic, or if
        // there is an active topic and this is a follow-up. Generic
        // "what is X" questions where X is unknown should NOT reach
        // the paragraph engine — they belong to Comms.
        var bodyTopics = knGetTopics();
        for (var k = 0; k < bodyTopics.length; k++) {
            if (bodyTopics[k].aliases && bodyTopics[k].aliases.test(body)) return true;
        }
        if (knGetActiveTopic() && knHasAnaphora(body)) return true;
        return false;
    }

    return false;
}
function paraDetectFollowUp(text) {
    return knDetectFollowUp(text);
}

function paraFollowUpHandle(text) {
    var inner = knBuildFollowUp(text);
    return { __html: true, text: '<div class="xetex-output para-followup">' + inner + '</div>' };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

window.isParagraphRequest = isParagraphRequest;
window.paraHandle = paraHandle;
window.paraDetectFollowUp = paraDetectFollowUp;
window.paraFollowUpHandle = paraFollowUpHandle;

window.knowledgeFindTopic = knFindTopic;
window.knowledgeTopics = knGetTopics;
window.knowledgeByCategory = knFragmentsByCategory;
