/* ============================================================
   XENON CONVERSE — a dialogue manager that sits on top of Xenon.Brain
   Pure JavaScript, no network, no libraries.

   WHY THIS EXISTS
   Xenon.Brain answers one message at a time: it matches an intent,
   says a canned line, and forgets the moment. Real conversation needs
   a model of the *dialogue*, not just the sentence. This layer adds:

     1. ANALYSE   dialogue act (greeting / question / backchannel /
                  correction / follow-up...), emotion + intensity,
                  topics, and structured facts ("I have a dog named Max")
     2. REMEMBER  facts about the user persist between sessions and
                  come back later as callbacks ("How did the exam go?")
     3. TRACK     a topic stack with decaying salience, the current
                  focus entity, the question Xenon just asked (so
                  "yes"/"no"/"pizza" are understood as answers), and the
                  last thing said (so "why?" / "tell me more" work)
     4. RESOLVE   ellipsis and pronouns before the Brain sees them:
                  "what about Japan?" -> "capital of Japan",
                  "how big is it?" -> "how big is black hole"
     5. PLAN      decide who should answer: a tool/KB/intent in the Brain
                  when it is grounded, otherwise the conversation planner
     6. REALISE   build the reply from parts (acknowledge + content +
                  follow-up), obey a question budget, mirror the user's
                  length, never repeat a line, avoid interrogating
     7. LEARN     "that's wrong" -> asks for the right answer and teaches
                  it to the Brain on the spot

   The Brain keeps doing what it is good at (tools, maths, KB, jokes,
   games, safety). Safety is ALWAYS checked first, untouched.

   Load order: converse-data.js, then xenon.js (after the tools), then this.
   Public API: Xenon.Converse = { respond, analyze, reset, forgetAll,
                                  state, memory, trace }
   ============================================================ */
(function (root) {
'use strict';
const X = root.Xenon = root.Xenon || {};
const D = X.ConverseData, Brain = X.Brain;
if (!D || !Brain) { console.warn('[Converse] needs converse-data.js and xenon.js loaded first'); return; }

/* ================= 0. UTILITIES ================= */
const rnd = n => Math.floor(Math.random() * n);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const stem = w => w.length > 3 ? w.replace(/ies$/, 'y').replace(/sses$/, 'ss').replace(/([^s])s$/, '$1') : w;
const endsQ = s => /\?\s*["”')\]]*\s*$/.test(s || '');
const art = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const SESSION = Date.now();

const CONTR = [[/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'can not'], [/n't\b/g, ' not'], [/\bi'm\b/g, 'i am'],
  [/\b(\w+)'re\b/g, '$1 are'], [/\b(\w+)'ve\b/g, '$1 have'], [/\b(\w+)'ll\b/g, '$1 will'], [/\b(\w+)'d\b/g, '$1 would'],
  [/\blet's\b/g, 'let us'], [/\b(it|that|what|who|where|how|he|she|there|here|when|why)'s\b/g, '$1 is']];
const SLANG = { u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', ty: 'thanks', im: 'i am', dont: 'do not',
  cant: 'can not', idk: 'i do not know', gonna: 'going to', wanna: 'want to', gotta: 'got to', omg: 'oh my god', tbh: 'honestly',
  rn: 'right now', bc: 'because', cuz: 'because', coz: 'because', abt: 'about', y: 'why', k: 'ok', ya: 'yeah', yea: 'yeah', nvm: 'never mind' };
const NOAPOS = { whats: 'what is', thats: 'that is', hows: 'how is', wheres: 'where is', whos: 'who is', dont: 'do not', doesnt: 'does not', didnt: 'did not',
  isnt: 'is not', arent: 'are not', wasnt: 'was not', cant: 'can not', wont: 'will not', couldnt: 'could not', shouldnt: 'should not', wouldnt: 'would not',
  im: 'i am', ive: 'i have', youre: 'you are', theyre: 'they are', hasnt: 'has not', havent: 'have not', lets: 'let us' };
function norm(t) {
  t = String(t).toLowerCase().replace(/[’‘`]/g, "'").replace(/\b[a-z]+\b/g, w => NOAPOS[w] || w);
  for (const [re, r] of CONTR) t = t.replace(re, r);
  return t.replace(/([a-z])\1{2,}/g, '$1').replace(/\s+/g, ' ').trim();
}
function words(t) {
  return norm(t).replace(/[^a-z0-9\s'-]/g, ' ').split(' ').filter(Boolean).map(w => SLANG[w] || w).join(' ').split(' ').filter(Boolean);
}

/* "I went to my school" -> "you went to your school" (for echoing the user back to themselves) */
const SWAP = { i: 'you', me: 'you', my: 'your', mine: 'yours', myself: 'yourself', "i'm": "you're", "i've": "you've", "i'll": "you'll", "i'd": "you'd",
  you: 'I', your: 'my', yours: 'mine', yourself: 'myself', "you're": "I'm", "you've": "I've", "you'll": "I'll", "you'd": "I'd" };
function swap(s) {
  const toks = s.split(/\s+/), out = [];
  for (let i = 0; i < toks.length; i++) {
    const m = toks[i].match(/^([("“]*)(.*?)([.,!?;:)"”]*)$/), w = m[2], lw = w.toLowerCase();
    const prev = (toks[i - 1] || '').toLowerCase().replace(/[^a-z']/g, '');
    let r = SWAP[lw];
    if (r === undefined) {
      if (lw === 'am' && prev === 'i') r = 'are';
      else if (lw === 'are' && prev === 'you') r = 'am';
      else if (lw === 'was' && prev === 'i') r = 'were';
      else if (lw === 'were' && prev === 'you') r = 'was';
      else r = w;
    }
    out.push(m[1] + r + m[3]);
  }
  return out.join(' ');
}
const lowerFirst = s => /^(?:you|your|the|a|an|my|it|that|this|there|we|they|he|she|so|but|and|because|if|when|today|yesterday|tonight|last|just|then|now|i)\b/i.test(s)
  ? s.charAt(0).toLowerCase() + s.slice(1) : s;

/* ================= 1. LEXICONS ================= */
const EMO_IDX = {};
Object.keys(D.EMOTIONS).forEach(e => D.EMOTIONS[e].words.split(' ').forEach(w => { if (!EMO_IDX[w]) EMO_IDX[w] = e; }));
const EMO_PHRASES = [
  [/\bfeel(?:ing)? (?:down|low|blue)\b|\bhave been down\b/, 'sad'], [/\bcan not wait\b|\blooking forward to\b/, 'excited'], [/\bfed up\b/, 'angry'],
  [/\bworn out\b|\bburn(?:ed|t) out\b/, 'stressed'], [/\blet down\b/, 'disappointed'],
  [/\b(?:no one|nobody) (?:cares|likes|talks|texts|wants)\b|\bno friends\b|\bleft out\b/, 'lonely'],
  [/\bdid not (?:get|make|pass|win)\b|\bfailed (?:my|the|an?)\b|\bgot rejected\b/, 'disappointed'],
  [/\b(?:got|landed|passed|aced|won|got promoted|got accepted|got into)\b.*\b(?:job|exam|test|promotion|interview|scholarship|award|contest|competition|class|offer)\b/, 'proud'],
  [/\b(?:so much|too much) (?:to do|work|going on)\b|\bdrowning in\b/, 'stressed'], [/\bi hate my (?:job|life|boss|school)\b/, 'angry'],
  [/\blong (?:day|week)\b|\brough (?:day|week)\b|\bbad day\b|\bwant to sleep\b|\bneed (?:a )?(?:break|rest|sleep|vacation)\b/, 'tired'],
  [/\bton of (?:work|stuff)\b|\bloads of (?:work|stuff)\b|\bdumped .* on me\b/, 'stressed'],
  [/\bi am (?:so )?(?:over it|done with everything)\b/, 'stressed'], [/\bdo not know what to do with my (?:life|future)\b|\blost in life\b|\bno direction\b|\bwhat is the point of\b/, 'lost'], [/\bdo not know what to do\b/, 'confused'], [/\bmy (?:head|stomach) (?:hurts|is killing me)\b/, 'tired'],
];
const INTENS = new Set('so really very extremely super totally completely absolutely too incredibly seriously'.split(' '));
const NEGW = new Set(['not', 'never', 'no', 'hardly', 'barely']);
const CTX = new Set('i am feel feeling felt been getting got makes made so really very kinda pretty bit little just still totally extremely super quite always not never no hardly barely'.split(' '));
const POSW = new Set('good great awesome happy love excellent amazing nice wonderful fantastic cool glad fun best brilliant perfect beautiful proud joy lovely enjoy super'.split(' '));
const NEGWORDS = new Set('bad sad terrible awful hate angry upset depressed lonely anxious worried stressed tired horrible worst cry hurt scared afraid stupid annoyed boring sick miserable hopeless overwhelmed broke failed lost ignoring ignores ignored yelled shouted argued fighting lied cheated ditched blocked rude unfair mean forgot dumped piled ghosted screamed nagging blamed criticized'.split(' '));

function detectEmotion(t) {
  for (const [re, e] of EMO_PHRASES) if (re.test(t.low)) return { name: e, intensity: 1, v: D.EMOTIONS[e].v, via: 'phrase' };
  let best = null;
  t.toks.forEach((w, i) => {
    const e = EMO_IDX[w]; if (!e) return;
    const prev = t.toks.slice(Math.max(0, i - 3), i);
    if (!(t.n <= 3 || prev.some(p => CTX.has(p)))) return;
    let name = e; const inten = Math.min(3, 1 + prev.filter(p => INTENS.has(p)).length);
    if (prev.some(p => NEGW.has(p))) { if (D.EMOTIONS[e].v > 0) name = 'sad'; else return; }
    if (!best || inten > best.intensity) best = { name, intensity: inten, v: D.EMOTIONS[name].v, via: w };
  });
  return best;
}
function sentiment(t) {
  if (t.emotion) return t.emotion.v;
  let s = 0, n = 0;
  t.toks.forEach((w, i) => {
    let v = POSW.has(w) ? 1 : NEGWORDS.has(w) ? -1 : 0; if (!v) return;
    if (t.toks.slice(Math.max(0, i - 2), i).some(p => NEGW.has(p))) v = -v;
    s += v; n++;
  });
  return n ? s / n : 0;
}

/* topic detection: stem -> topic ids */
const TOPIC_IDX = {};
Object.keys(D.TOPICS).forEach(id => D.TOPICS[id].words.split(' ').forEach(w => { const k = stem(w); (TOPIC_IDX[k] = TOPIC_IDX[k] || []).push(id); }));
function detectTopics(t) {
  const sc = {};
  t.toks.forEach(w => {
    const ids = TOPIC_IDX[stem(w)]; if (!ids) return;
    if (w === 'work' && /\b(?:it|this|that|which|everything|nothing)\s+(?:does not |do not |did not |will not )?work/.test(t.low)) return;
    ids.forEach(id => { sc[id] = (sc[id] || 0) + (id === 'daily' ? 0.4 : 1); });
  });
  return Object.keys(sc).map(id => ({ id, score: sc[id] })).sort((a, b) => b.score - a.score);
}

/* ================= 2. DIALOGUE-ACT ANALYSIS ================= */
function analyze(raw) {
  const text = String(raw || '').trim().slice(0, 800);
  const low = norm(text), cl = low.replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = words(text);
  const t = { raw: text, low, cl, toks, n: toks.length, acts: [], facts: [], topics: [], emotion: null, sent: 0, resolved: null, act: 'statement' };
  t.wh = (cl.match(/^(?:so |and |but |ok |okay )?(what|who|whom|whose|where|when|why|how|which)\b/) || [])[1] || null;
  t.isQ = /\?\s*$/.test(low) || !!t.wh || /^(?:do|does|did|is|are|am|was|were|can|could|will|would|should|have|has|had)\s+(?:you|i|we|it|he|she|they|that|this|there|anyone|everyone|people|someone)\b/.test(cl);
  t.aboutBot = /\b(you|your|yours|yourself)\b/.test(cl);
  const add = (a, re, maxN) => { if (re.test(cl) && (!maxN || t.n <= maxN)) t.acts.push(a); };
  add('greet', /^(?:hi|hello|hey|yo|howdy|hiya|sup|greetings|good (?:morning|afternoon|evening|day))\b/, 5);
  add('bye', /\b(?:bye|goodbye|good night|see you|gotta go|got to go|talk later|ttyl|cya|i am leaving|i have to go)\b/, 8);
  add('thanks', /\b(?:thanks|thank you|thx|cheers|much appreciated|appreciate it)\b/, 7);
  add('sorry', /\b(?:sorry|my bad|apologi[sz]e|forgive me)\b/, 5);
  add('yes', /^(?:yes|yeah|yep|yup|sure|ok|okay|of course|definitely|absolutely|please do|go ahead|why not|sounds good|correct|right|exactly|indeed|please)\b/, 5);
  add('yes', /^(?:i do|i did|i am|i have|i would|i will|i can)$/, 3);
  add('no', /^(?:no|nope|nah|not really|never|not at all|not yet|not now|negative)\b/, 6);
  add('no', /^(?:i do not|i did not|i am not|i have not|i would not)$/, 3);
  add('idk', /^(?:i do not know|not sure|no idea|maybe|perhaps|i guess|dunno|i am not sure|hard to say|it depends|depends)\b/, 6);
  add('back', /^(?:ok|okay|k|cool|nice|wow|oh|ah|hmm+|i see|got it|right|lol|haha+|hehe|interesting|really|true|fair|wild|oh nice|great|awesome|sweet|noted|fine|alright|makes sense|oh wow|oh really|no way|damn|neat|lmao|mhm|yeah ok)\b/, 3);
  add('more', /^(?:tell me more|more|go on|continue|keep going|elaborate|and then|what else|anything else|expand|say more|more please)\b/, 5);
  add('why', /^(?:why|why is that|why is it|why so|but why|how come|how so|why not|what makes you say that)\b/, 7);
  add('meant', /\b(?:i meant|i mean|no i meant|not that|that is not what i (?:asked|meant|said)|wrong thing)\b/);
  add('repeat', /\b(?:you (?:already )?(?:said|told me)(?: that)?|same (?:thing|answer)|stop repeating|you keep (?:saying|repeating)|repeating yourself)\b/);
  add('huh', /^(?:what|huh|pardon|sorry what|come again|say that again|what did you say|i did not get that|i do not understand)$/, 5);
  add('wrong', /\b(?:that is (?:wrong|not right|incorrect|not true)|you are wrong|wrong answer|incorrect)\b/);
  add('praise', /\b(?:good bot|well done|nice one|great job|good job|you are (?:smart|great|awesome|amazing|funny|good|clever|the best|helpful))\b/);
  add('insult', /\b(?:you are (?:stupid|dumb|useless|annoying|boring|bad|terrible)|you suck|shut up|i hate you)\b/);
  add('request', /^(?:please )?(?:can|could|will|would) you\b|^(?:please |just )?(?:tell|give|show|explain|write|make|help|find|suggest|recommend|teach|describe|list|name|say|let us|let me|play|pick|choose)\b/);
  const lowNoQ = low.replace(/[?!.]+$/, '').trim();
  const wa = lowNoQ.match(/^(?:and |but |so )?(?:what|how) about (.+)$/) || lowNoQ.match(/^and (.{2,30})$/);
  if (wa && !/^(?:you|u|me|it|that|this|them|him|her|i|then|so|now|what|why|how|more|again)$/.test(wa[1].trim()) && (S.frame || /^(?:what|how) about/.test(cl))) { t.acts.push('whatabout'); t.about = wa[1].replace(/^(?:the )/, '').trim(); }
  const order = ['huh', 'meant', 'repeat', 'wrong', 'whatabout', 'why', 'more', 'greet', 'bye', 'thanks', 'sorry', 'praise', 'insult', 'no', 'idk', 'yes', 'back'];
  const hit = order.find(a => t.acts.includes(a));
  if (hit === 'yes' && /^(?:ok|okay|k|right|fine|alright)$/.test(cl)) t.act = 'back';
  else if (hit) t.act = hit; else t.act = t.isQ ? 'question' : t.acts.includes('request') ? 'request' : 'statement';
  const lowEffort = ['back', 'yes', 'no', 'idk', 'huh', 'thanks'].includes(t.act);
  t.emotion = lowEffort && t.n <= 2 ? null : detectEmotion(t);
  t.sent = sentiment(t);
  t.topics = detectTopics(t);
  t.facts = (t.isQ && !/^my\b/.test(cl)) ? [] : extractFacts(t);
  return t;
}

/* ================= 3. FACT EXTRACTION ("listening") ================= */
const PETS = 'golden retriever|labrador|husky|poodle|bulldog|beagle|terrier|german shepherd|corgi|pug|dachshund|chihuahua|rottweiler|border collie|siamese|ferret|goldfish|gecko|pony|dog|puppy|cat|kitten|hamster|rabbit|bird|parrot|fish|turtle|horse|guinea pig|lizard|snake|dogs|cats|puppies|kittens|birds|fishes';
const JOBW = /\b(nurse|teacher|student|developer|engineer|designer|doctor|lawyer|driver|chef|writer|artist|manager|accountant|programmer|freelancer|musician|barista|cashier|mechanic|electrician|plumber|analyst|scientist|researcher|pilot|intern|assistant|consultant|dentist|baker|farmer|tutor|professor|photographer|waiter|waitress|carpenter|therapist|pharmacist|architect|journalist|editor|entrepreneur|founder|salesperson|clerk|receptionist|secretary|trainer|coach|youtuber|streamer)\b/i;
const EVENTS = 'exam|test|interview|presentation|deadline|meeting|appointment|date|match|game|recital|trip|flight|wedding|surgery|performance|finals|final|quiz|assignment|project|audition|race|competition|checkup|dentist';
const WHEN = '(tomorrow|today|tonight|next week|this week|soon|later|this weekend|next month|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in \\d+ (?:days?|hours?|weeks?))';
const RELMAP = { mom: 'family', mum: 'family', mother: 'family', dad: 'family', father: 'family', sister: 'family', brother: 'family', son: 'family', daughter: 'family', kid: 'family',
  grandma: 'family', grandpa: 'family', cousin: 'family', aunt: 'family', uncle: 'family', friend: 'friends', 'best friend': 'friends', roommate: 'friends',
  boss: 'work', coworker: 'work', colleague: 'work', manager: 'work', teacher: 'school', wife: 'love', husband: 'love', girlfriend: 'love', boyfriend: 'love', partner: 'love' };
const NAMESTOP = /^(a|an|the|it|my|his|her|their|our|me|us|him|them|really|very|so|just|that|this)$/i;

function extractFacts(t) {
  const out = [];
  const push = f => { f.t = Date.now(); f.sess = SESSION; out.push(f); };
  const sents = t.raw.split(/[.!?]+\s+|\n+/).map(s => s.trim().replace(/[.!?]+$/, '')).filter(Boolean);
  for (const s of sents) {
    let m;
    // --- pets
    if ((m = s.match(new RegExp("\\bi (?:have|got|own|adopted|just got|just adopted)\\s+(?:\\d+ |a |an |my |two |three |our )?(?:new |little |baby )?(" + PETS + ")\\b(?:.*?\\b(?:named|called)\\s+([A-Za-z][\\w'-]*))?", 'i')))) {
      const kind = m[1].toLowerCase(), name = m[2] && !NAMESTOP.test(m[2]) ? cap(m[2]) : null, plural = /s$|ies$/.test(kind) && kind !== 'fish';
      push({ type: 'pet', topic: 'pets', key: 'pet:' + (name || kind), val: { kind, name },
        summary: 'you have ' + (plural ? kind : art(kind)) + (name ? ' called ' + name : ''),
        ack: plural ? cap(kind) + " — that's a full house!" : name ? name + ' — great name for ' + art(kind) + '.' : cap(art(kind)) + ' — lovely.',
        hook: name ? { q: "What's " + name + ' like?' } : plural ? { q: 'What are they like?' } : { q: "What's their name?", slot: 'petname' },
        follow: name ? "How's " + name + ' doing?' : null });
    } else if ((m = s.match(new RegExp("\\bmy (" + PETS + ")\\b", 'i')))) {
      push({ type: 'pet', topic: 'pets', key: 'pet:' + m[1].toLowerCase(), val: { kind: m[1].toLowerCase() }, silent: true, summary: 'you have a ' + m[1].toLowerCase(), ack: null });
    }
    // --- job / identity
    if ((m = s.match(/\bi (?:am|work as|am working as)\s+(?:a|an)\s+([a-z][a-z -]{2,28}?)(?=\s+(?:at|for|in|and|but)\b|[,;]|$)/i)) && JOBW.test(m[1])) {
      const job = m[1].trim().toLowerCase(), pl = (s.match(/\b(?:at|for)\s+([A-Z][\w &'-]{1,30})/) || [])[1];
      const isStudent = /student/.test(job);
      push({ type: isStudent ? 'study' : 'job', topic: isStudent ? 'school' : 'work', key: isStudent ? 'study' : 'job', val: { job, place: pl || null },
        summary: 'you are ' + art(job) + (pl ? ' at ' + pl : ''), ack: "So you're " + art(job) + (pl ? ' at ' + pl : '') + '.',
        hook: isStudent ? { q: 'What are you studying?', slot: 'study' } : { q: "What's the best part of the job — and the worst?" }, follow: isStudent ? null : "How's work been lately?" });
    } else if ((m = s.match(/\bi work (?:at|for|in)\s+([^,;]{2,40})/i))) {
      push({ type: 'job', topic: 'work', key: 'job', val: { place: m[1].trim() }, summary: 'you work at ' + m[1].trim(), ack: m[1].trim() + ' — okay.',
        hook: { q: 'What do you do there?', slot: 'job' }, follow: "How's work been lately?" });
    }
    if ((m = s.match(/\bi (?:study|am studying|am majoring in|major in|am learning)\s+([^,;]{2,40})/i))) {
      push({ type: 'study', topic: 'school', key: 'study', val: { subject: m[1].trim() }, summary: 'you study ' + m[1].trim(),
        ack: cap(m[1].trim()) + " — that's interesting.", hook: { q: 'What got you into it?' } });
    }
    // --- upcoming events (worth following up on)
    if ((m = s.match(new RegExp("\\b(?:i have|i got|i've got|we have|there is)\\s+(?:an? |my |the )?(?:big |important |final |first )?(" + EVENTS + ")\\b(?:.*?\\b" + WHEN + ")?", 'i')))) {
      const kind = m[1].toLowerCase(), when = m[2] ? m[2].toLowerCase() : null;
      push({ type: 'event', topic: /exam|test|quiz|final|assignment/.test(kind) ? 'school' : /interview|meeting|deadline|presentation/.test(kind) ? 'work' : 'daily', key: 'event:' + kind,
        val: { kind, when }, pending: true, summary: 'you have ' + art(kind) + (when ? ' ' + when : ''),
        ack: 'Good luck with the ' + kind + (when ? ' ' + when : '') + '!', hook: { q: 'Feeling ready, or a bit nervous?' }, follow: 'How did your ' + kind + ' go?' });
    }
    // --- people in the user's life
    if ((m = s.match(/^(?:and |but |so |well |honestly )?my (mom|mum|mother|dad|father|sister|brother|wife|husband|girlfriend|boyfriend|partner|best friend|friend|roommate|boss|coworker|colleague|teacher|son|daughter|kid|grandma|grandpa|cousin|aunt|uncle|manager)\s+(?!is an? |is the )([a-z']+\b.{3,80})$/i))) {
      const rel = m[1].toLowerCase(), topic = RELMAP[rel] || 'family';
      push({ type: 'person', topic, key: 'person:' + rel, val: { rel, rest: m[2] }, silent: true, summary: 'your ' + rel + ' ' + swap(m[2]),
        echo: 'Your ' + rel + ' ' + swap(m[2].replace(/[,;]?\s+(?:and|but|so)\s+i\b.*$/i, '')) + '.', ack: null, hook: { q: 'How do you feel about that?' } });
    }
    // --- where
    if ((m = s.match(/\bi (?:live in|am living in|am from|grew up in|moved to|am based in)\s+([A-Z][\w' -]{1,30}?)(?=[,;]|\s+(?:and|but|where|with)\b|$)/))) {
      push({ type: 'place', topic: 'daily', key: 'place', val: { place: m[1] }, summary: 'you are from ' + m[1], ack: m[1] + ' — nice.', hook: { q: 'What do you like most about it?' } });
    }
    // --- wants & problems
    if ((m = s.match(/\bi (?:really )?(?:want|wish|hope|plan|would like|am planning|am hoping|am trying|am thinking of|am thinking about) (?:to |of |about )?([^,;]{3,60})/i))) {
      push({ type: 'desire', topic: null, key: 'desire:' + m[1].toLowerCase().slice(0, 20), val: { what: m[1].trim() }, summary: 'you want to ' + m[1].trim(),
        ack: "That's a good thing to aim for.", hook: { q: "What's the first step?" }, follow: 'Last time you mentioned wanting to ' + m[1].trim() + ' — any progress?' });
    }
    if ((m = s.match(/\bi (?:can not|can't|am not able to|am struggling(?: with)?|am having (?:trouble|a hard time|problems?)(?: with)?|have trouble(?: with)?|do not know how to|am stuck(?: on| with)?|keep (?:failing|forgetting|losing|messing up)|do not understand)\s*([^,;]{0,60})/i)) && m[1].trim().length > 1) {
      push({ type: 'problem', topic: null, key: 'problem:' + m[1].toLowerCase().slice(0, 20), val: { what: m[1].trim() }, summary: 'you struggle with ' + m[1].trim(),
        ack: 'That sounds frustrating.', hook: { q: 'What have you tried so far?' }, follow: 'Did you manage to sort out the thing with ' + m[1].trim() + '?' });
    }
    // --- likes & dislikes
    if ((m = s.match(/\bi (?:really |absolutely |totally |just )?(like|love|enjoy|adore|prefer|hate|dislike|can not stand|am into|am obsessed with|am a fan of|am addicted to) ([^,;]{2,40})/i))
        && !/^(?:you|this|it|that|him|her|them|talking|chatting|xenon|the way)\b/i.test(m[2])) {
      const neg = /hate|dislike|can not stand/i.test(m[1]), obj = m[2].trim();
      push({ type: neg ? 'dislike' : 'like', topic: null, key: (neg ? 'dislike:' : 'like:') + obj.toLowerCase(), val: { obj }, summary: 'you ' + (neg ? "don't like " : 'like ') + obj,
        ack: neg ? "Fair enough — not everything's for everyone." : cap(obj) + ' — nice.', hook: { q: neg ? 'What puts you off ' + obj + '?' : 'What do you like most about ' + obj + '?' } });
    }
    // --- things that happened
    if ((m = s.match(/\bi (?:just |finally |recently )?(passed|failed|won|lost|finished|completed|quit|graduated|aced|broke|booked|moved|started|visited|went to|saw|watched|read|played|met|cooked|bought|got) (.{2,60})$/i))) {
      const v = m[1].toLowerCase(), good = /passed|won|finished|completed|graduated|aced|booked|started/.test(v), bad = /failed|lost|quit|broke/.test(v);
      push({ type: 'happened', topic: null, key: 'happened:' + v + m[2].toLowerCase().slice(0, 15), val: { verb: v, obj: m[2] }, summary: 'you ' + v + ' ' + m[2], silent: !(good || bad || /visited|went to|saw|watched|read|played|met|cooked/.test(v)),
        ack: good ? 'That deserves a congratulations!' : bad ? "I'm sorry — that's tough." : 'Oh nice.', hook: { q: good ? 'How did it feel?' : bad ? 'What happened?' : 'How was it?' } });
    }
    if ((m = s.match(/\bi am (\d{1,2})(?:\s*(?:years? old|yo))?$/i)) && +m[1] > 4 && +m[1] < 100) {
      push({ type: 'age', topic: null, key: 'age', val: { age: +m[1] }, summary: 'you are ' + m[1], ack: 'Got it — ' + m[1] + '.', hook: { q: 'What are you up to these days — work, school, something else?' } });
    }
    if (out.length >= 2) break;
  }
  return out;
}

/* ================= 4. USER MEMORY (persists between visits) ================= */
const KEY = 'xenon_converse_v1';
const M = { facts: [], visits: 0, lastSeen: 0, askedName: false };
(function load() { try { const r = localStorage.getItem(KEY); if (r) Object.assign(M, JSON.parse(r)); } catch (e) { /* ignore */ } M.visits++; })();
M.save = function () { M.lastSeen = Date.now(); try { localStorage.setItem(KEY, JSON.stringify({ facts: M.facts.slice(-80), visits: M.visits, lastSeen: M.lastSeen, askedName: M.askedName })); } catch (e) { /* ignore */ } };
M.add = function (f) {
  const i = M.facts.findIndex(x => x.key === f.key);
  if (i >= 0) { const old = M.facts[i]; f.asked = false; if (old.val && f.val) f.val = Object.assign({}, old.val, f.val); M.facts[i] = Object.assign(old, f); } else M.facts.push(f);
  M.save();
};
M.has = type => M.facts.some(f => f.type === type);
M.ofType = type => M.facts.filter(f => f.type === type);

/* ================= 5. DIALOGUE STATE (per chat) ================= */
let S;
function freshState() {
  return { turns: 0, topics: {}, focus: null, frame: null, openQ: null, lastMove: null, awaitCorrection: null, prevUser: null,
    lowEffort: 0, qStreak: 0, entity: null, mood: { name: null, n: 0 }, pi: {}, askedQ: {}, botTexts: [], greeted: false, askedName: false };
}
S = freshState();
const U = {};   // lines already spoken (never repeat a canned line)
function fresh(arr) {
  if (!arr || !arr.length) return '';
  let pool = arr.filter(x => !U[x]);
  if (!pool.length) { arr.forEach(x => { delete U[x]; }); pool = arr; }
  const x = pool[rnd(pool.length)]; U[x] = 1; return x;
}
const canAsk = () => S.qStreak < 2;
const myName = () => Brain.mem && Brain.mem.name;
function touchTopics(t) {
  Object.keys(S.topics).forEach(k => { S.topics[k] *= 0.6; if (S.topics[k] < 0.15) delete S.topics[k]; });
  t.topics.forEach(x => { S.topics[x.id] = Math.min(3, (S.topics[x.id] || 0) + x.score); });
}
function curTopic() { let b = null, v = 0.5; for (const k in S.topics) if (S.topics[k] > v) { b = k; v = S.topics[k]; } return b; }

function isGibberish(t) {
  if (t.n > 2) return false;
  return t.toks.some(w => w.length >= 4 && /^[a-z]+$/.test(w) && ((w.match(/[aeiouy]/g) || []).length / w.length < 0.2 || /(.)\1\1|^[qwrtpsdfghjklzxcvbnm]{5,}/.test(w)));
}

/* ================= 6. REALISER HELPERS ================= */
function say(parts) {
  return parts.filter(Boolean).map(x => String(x).trim()).join(' ')
    .replace(/\s+/g, ' ').replace(/\s+([,.!?;])/g, '$1').replace(/([.!?])\s*\1+/g, '$1').trim();
}
const mv = (text, o) => Object.assign({ text, kind: 'converse', grounded: false }, o || {});
const asked = (q, extra) => Object.assign({ kind: 'open', q, turn: S.turns }, extra || {});
function pickTake(T) {
  if (!T || !T.takes) return null;
  const f = fresh(T.takes.map(x => x[0]));
  return T.takes.find(x => x[0] === f) || null;
}
const SLOT_BY_Q = [[/what do you do for work/i, 'job'], [/what are you studying/i, 'study'], [/what kind.*called|what are they called/i, 'pet'],
  [/what do you do there/i, 'job'], [/what's their name|what is their name/i, 'petname']];
const slotFor = q => { for (const [re, s] of SLOT_BY_Q) if (re.test(q)) return s; return null; };
function skipKnown(id, i) { return i === 0 && ((id === 'pets' && M.has('pet')) || (id === 'work' && M.has('job')) || (id === 'school' && M.has('study'))); }
function nextProbe(id) {
  const T = D.TOPICS[id]; if (!T) return null;
  for (let i = S.pi[id] || 0; i < T.probes.length; i++) {
    const p = T.probes[i], q = Array.isArray(p) ? p[0] : p;
    if (S.askedQ[q]) continue;
    S.askedQ[q] = 1;
    if (skipKnown(id, i)) continue;
    S.pi[id] = i + 1;
    return Array.isArray(p) ? { q, kind: 'yn', yes: p[1], no: p[2], topic: id } : { q, kind: 'open', topic: id, slot: slotFor(q) };
  }
  return null;
}
const coreOf = t => t.raw.split(/[.!?]+\s+|\n+/)[0].replace(/[.!?]+$/, '').trim();
function reflectLine(t) {
  const c = coreOf(t).replace(/^(?:honestly|personally|basically|well|so|like|um|okay|ok|and|but)[, ]+/i, ''); if (!c || c.length > 90 || c.length < 8) return '';
  let out = lowerFirst(swap(c));
  if (S.entity && S.entity.named && S.turns - S.entity.turn <= 6) out = out.replace(/^(?:she|he|they|it)\b/i, S.entity.name);
  return 'So ' + out + '.';
}
function clauseKind(t) {
  if (/\bi (?:think|believe|reckon|guess|suppose)\b|^(?:honestly|personally)\b|in my opinion|\bfeel like\b/.test(t.cl)) return 'opinion';
  if (/\b(?:going to|will|plan to|planning to|tomorrow|next week|soon|tonight|someday)\b/.test(t.cl)) return 'future';
  if (/\b(?:went|saw|did|was|were|had|got|made|took|came|told|said|ate|bought|met|found|lost|won|gave|left|started|finished|yesterday)\b|\b\w{3,}ed\b/.test(t.cl)) return 'past';
  if (/\bi am \w+ing\b|\bam (?:currently )?\w+ing\b|\bi have been\b|\bi (?:keep|still)\b/.test(t.cl)) return 'ongoing';
  return 'general';
}
const LISTEN_Q = {
  past: ['What happened next?', 'How did it turn out?', 'How did you feel about it?'],
  opinion: ['What makes you say that?', 'Has it always felt that way to you?', 'What would change your mind?'],
  future: ['What are you hoping happens?', 'How are you feeling about it?', "What's the first step?"],
  ongoing: ["How's that going?", "What's the most interesting part of it?", "What's been the hardest bit?"],
  general: ["Tell me more — what's behind that?", 'What made you think of it?', 'Can you say a bit more about that?'],
};
const LISTEN_C = {
  past: ['That sounds like quite a moment.', 'Sounds like it left an impression.'],
  opinion: ["That's a thoughtful way to look at it.", 'Interesting angle.'],
  future: ['That sounds like something to look forward to.', 'I hope it goes well.'],
  ongoing: ['That sounds like a lot going on.', "Sounds like you're in the thick of it."],
  general: ['Interesting.', "I think I see where you're coming from."],
};

/* ================= 7. MOVES (what Xenon can do in a conversation) ================= */
function emotionMove(t, topic) {
  const E = t.emotion, def = D.EMOTIONS[E.name];
  S.mood = { name: E.name, n: S.mood.name === E.name ? S.mood.n + 1 : 1 };
  const f = t.facts.find(x => x.echo), parts = []; let open = null;
  if (f) parts.push(f.echo);
  parts.push(E.intensity >= 3 && def.v < 0 ? fresh(['That sounds really tough.', 'That sounds like a lot, honestly.']) : fresh(def.validate));
  if (S.mood.n >= 2 && def.tip.length) {
    parts.push(fresh(def.tip));
    if (canAsk()) { const q = fresh(['Does that feel doable?', 'Want to talk about what makes it hard?', 'Is any of that helping?']); parts.push(q); open = asked(q, { topic }); }
  } else if (canAsk()) { const q = fresh(def.ask); parts.push(q); open = asked(q, { topic }); }
  else if (def.tip.length) parts.push(fresh(def.tip));
  return mv(say(parts), { kind: 'emotion', open, topic });
}
function factMove(t, topic) {
  const fs = t.facts.filter(f => !f.silent); if (!fs.length) return null;
  const f = fs[0], parts = [f.ack]; let open = null, why = null, elab = null;
  if (fs[1] && fs[1].ack) parts.push(fs[1].ack);
  const tp = f.topic || topic;
  if (f.hook && canAsk()) { parts.push(f.hook.q); open = asked(f.hook.q, { slot: f.hook.slot, topic: tp, fact: f }); }
  else if (D.TOPICS[tp]) { const tk = pickTake(D.TOPICS[tp]); if (tk) { parts.push(tk[0]); why = tk[1]; elab = D.TOPICS[tp].facts.slice(); } }
  return mv(say(parts), { kind: 'fact', open, topic: tp, why, elab });
}
function personMove(t, f) {
  const T = D.TOPICS[f.topic] || D.TOPICS.family, neg = t.sent < -0.25, pos = t.sent > 0.25;
  const q = neg ? fresh(['How long has this been going on?', 'How are you handling it?', "What do you wish they'd do differently?"]) : pos ? fresh(["What's that like?", 'How did that make you feel?']) : 'How do you feel about that?';
  const parts = [f.echo, neg ? fresh(T.react.neg) : pos ? fresh(T.react.pos) : fresh(['I can see why that is on your mind.', "That's worth paying attention to."])];
  if (canAsk()) parts.push(q);
  return mv(say(parts), { kind: 'fact', topic: f.topic, open: canAsk() ? asked(q, { topic: f.topic }) : null });
}
function topicMove(t, topic) {
  const T = D.TOPICS[topic], key = t.sent > 0.25 ? 'pos' : t.sent < -0.25 ? 'neg' : 'neu', parts = [];
  let open = null, why = null, elab = null;
  if (t.n >= 7) { const r = reflectLine(t); if (r) parts.push(r); }
  parts.push(fresh(T.react[key]));
  const p = canAsk() ? nextProbe(topic) : null;
  if (p) { parts.push(p.q); open = Object.assign({ turn: S.turns }, p); }
  else { const tk = pickTake(T); if (tk) { parts.push(tk[0]); why = tk[1]; elab = T.facts.slice(); } }
  return mv(say(parts), { kind: 'topic', topic, open, why, elab });
}
const ADVICE_RE = /\b(?:how (?:do|can|should|to|would) i|how can we|what should i|should i|tips?|advice|help me|any (?:ideas|suggestions)|how do you (?:deal|cope|handle)|ways? to)\b/;
function adviceMove(t, topic) {
  const T = D.TOPICS[topic], parts = []; let open = null;
  if (t.sent < -0.25 || (t.emotion && t.emotion.v < 0)) parts.push(fresh(T.react.neg));
  const a = fresh(T.advice); parts.push(a);
  if (canAsk()) { const q = fresh(['Does that fit your situation?', 'Want me to get more specific?', 'What have you tried so far?']); parts.push(q); open = asked(q, { topic }); }
  return mv(say(parts), { kind: 'advice', topic, open, elab: T.advice.filter(x => !U[x]) });
}
function listenMove(t) {
  if (isGibberish(t) || (t.n <= 2 && !/[a-z]{3}/.test(t.cl))) return mv(fresh(["I couldn't quite catch that — could you say it another way?", "Hm, I didn't get that one. Mind rephrasing?"]), { kind: 'listen' });
  const kind = clauseKind(t), parts = []; let open = null;
  if (kind === 'opinion') parts.push(fresh(['Bold take.', 'Interesting — that splits people.', 'I can see why you would say that.']));
  else if (t.n >= 4) { const r = reflectLine(t); if (r) parts.push(r); }
  if (canAsk()) { const q = fresh(LISTEN_Q[kind]); parts.push(q); open = asked(q); }
  else parts.push(fresh(LISTEN_C[kind]));
  return mv(say(parts), { kind: 'listen', open, topic: curTopic() });
}
function unknownQMove(t, topic) {
  const E = S.entity;
  if (E && S.turns - E.turn <= 8 && ((E.named && new RegExp('\\b' + E.name + '\\b', 'i').test(t.raw)) || /\b(?:he|she|him|her|his|they|them|their)\b/.test(t.cl))) {
    const q = fresh(['Tell me — what is ' + (E.named ? E.name : 'it') + ' like?', 'What would you say is the best thing about ' + E.name + '?']);
    return mv(say(['You know ' + E.name + ' far better than I do — all I know is what you tell me.', q]), { kind: 'listen', topic: E.topic, open: asked(q, { topic: E.topic }) });
  }
  if (t.resolved && S.focus) return mv(say(['My notes on ' + S.focus + " are only a short summary, and they don't cover that.", fresh(['Ask me something broader about it, or tell me what you know and I will remember it.', 'If you know the answer, teach me with “remember that …”.'])]), { kind: 'unknown' });
  const parts = [fresh(["That's one I can't answer reliably — I only know what's built into me, and I'd rather not guess.", "I don't have a trustworthy answer to that, and I'd rather say so than invent one.", "Honest answer: that's outside what I know."])];
  const T = topic && D.TOPICS[topic];
  if (T && T.facts.length) parts.push('Something related, though: ' + fresh(T.facts));
  parts.push(fresh(["I'm solid on maths, logic, code and writing, and I can chat about most everyday things.", 'If you know the answer, tell me with “remember that …” and I’ll keep it.', 'Try rephrasing it, or ask me something I can work out step by step.']));
  return mv(say(parts), { kind: 'unknown', topic });
}
function moreMove() {
  const lm = S.lastMove;
  if (lm && lm.elab && lm.elab.length) { const e = lm.elab.shift(); return mv(e, { kind: 'elab', topic: lm.topic, elab: lm.elab }); }
  const topic = (lm && lm.topic) || curTopic(), T = D.TOPICS[topic];
  if (T) { const f = fresh(T.facts); if (f) return mv(f, { kind: 'elab', topic, elab: [] }); }
  const q = fresh(["That's about all I've got on that — but I'd rather hear your take. What do you think?", "I've run out of things to add there. What's your experience of it?"]);
  return mv(q, { kind: 'listen', open: asked(q) });
}
function whyMove() {
  const lm = S.lastMove;
  if (lm && lm.why) return mv(say([fresh(['Good question.', 'Fair to ask.', 'Sure —']), lm.why]), { kind: 'elab', topic: lm.topic, elab: lm.elab });
  const q = fresh(["I don't have a deeper reason stored for that, and I'd rather say so than make one up. What's your take?", "Honestly, that's as far as my reasoning goes on it. What do you think is behind it?"]);
  return mv(q, { kind: 'listen', open: asked(q) });
}
function backMove() {
  const lm = S.lastMove, topic = (lm && lm.topic) || curTopic();
  if (S.lowEffort >= 2) {
    const q = fresh(["I'm happy to keep going — we could dig into something you're into, play a quick game, or you can throw any question at me. What sounds good?", 'Want to switch gears? I can tell a joke or run a riddle, or we can talk about anything on your mind.']);
    return mv(q, { kind: 'menu', open: asked(q) });
  }
  if (lm && lm.elab && lm.elab.length && lm.kind !== 'offer') {
    const q = fresh(['Want to hear more about that?', 'Shall I go a bit deeper?']);
    return mv(say([fresh(['Glad it landed.', 'Right?']), q]), { kind: 'offer', topic: lm.topic, elab: lm.elab, open: { kind: 'offer', elab: true, q, turn: S.turns } });
  }
  const p = topic && canAsk() ? nextProbe(topic) : null;
  if (p) return mv(say([fresh(['Mm-hm.', 'Yeah.', 'Right.']), p.q]), { kind: 'probe', topic, open: Object.assign({ turn: S.turns }, p) });
  const q = fresh(["I'm here whenever you want to continue — what's on your mind?", "Anything you'd like to dig into?", "So — what's been on your mind lately?"]);
  return mv(q, { kind: 'back', open: asked(q) });
}
function ynMove(t) {
  const topic = S.lastMove && !S.lastMove.grounded ? S.lastMove.topic : null;
  if (t.act === 'idk') { const q = fresh(["That's okay — not knowing is a fine place to start. What would help you figure it out?", 'No worries. Want to think it through out loud together?']); return mv(q, { kind: 'listen', open: asked(q) }); }
  const q = topic ? fresh(['Good. Want to keep talking about ' + topic + ', or move on?']) : fresh(['Okay! Where should we take it from here?', "Alright — what's next?"]);
  return mv(q, { kind: 'back', open: asked(q) });
}
function politeMove(t) {
  const nm = myName() ? ', ' + myName() : '';
  switch (t.act) {
    case 'thanks': return mv(fresh(["You're welcome" + nm + '!', 'Anytime.', 'Glad to help.']), { kind: 'polite' });
    case 'sorry': return mv(fresh(['No need to apologise at all.', "It's all good — really."]), { kind: 'polite' });
    case 'praise': return mv(fresh(['Thank you' + nm + '! That means a lot.', 'Aw, thanks — you make it easy.']), { kind: 'polite' });
    case 'insult': return mv(fresh(["Sorry I'm falling short. Tell me what you were hoping for and I'll try again.", 'Fair — I miss sometimes. What would a good answer look like?']), { kind: 'polite' });
    case 'greet': return mv(fresh(['Hey' + nm + "! What's on your mind?", 'Hi' + nm + '! How are you doing?']), { kind: 'polite' });
    case 'bye': return mv(say([t.acts.includes('thanks') ? "You're welcome!" : '', fresh(['Take care' + nm + '! Come back any time.', 'See you later!']), wishLuck()]), { kind: 'polite' });
  }
  return null;
}
function recallMove() {
  const bits = [], n = myName();
  M.facts.forEach(f => { if (f.summary && !bits.includes(f.summary)) bits.push(f.summary); });
  const likes = (Brain.mem && Brain.mem.likes) || [];
  if (likes.length) bits.push('you like ' + likes.slice(-4).join(', '));
  if (!bits.length && !n) return mv("Not much yet — tell me about yourself and I'll remember it.", { kind: 'memory' });
  return mv('Here is what I remember' + (n ? ' about ' + n : '') + ': ' + (n ? 'your name is ' + n + '; ' : '') + bits.slice(-8).join('; ') + '.', { kind: 'memory' });
}

/* ---- Xenon's honest AI personality ---- */
const HABITS = [[/\bdo you (?:ever )?sleep\b|\bgo to (?:bed|sleep)\b/, 'sleep'], [/\bdo you (?:ever )?(?:eat|drink|get hungry)\b/, 'eat'], [/\bdo you dream\b/, 'dream'],
  [/\bdo you (?:feel|get) (?:pain|hurt)\b/, 'feelpain'], [/\bdo you have (?:any )?friends\b/, 'friends'], [/\bdo you have (?:a |any )?(?:family|parents|mom|dad|siblings|brother|sister)\b/, 'family'],
  [/\bdo you have (?:a )?(?:body|face|hands|arms)\b/, 'body'], [/\bdo you go to school\b|\bdid you go to school\b/, 'school'],
  [/\bdo you have a job\b|\bwhat do you do for (?:a )?(?:living|work)\b|\bwhat is your job\b/, 'job'], [/\bare you (?:ever )?(?:scared|afraid)\b|\bdo you (?:get )?(?:fear|afraid)\b/, 'scared'],
  [/\bare you (?:happy|sad|ok|okay|content|enjoying)\b/, 'happy'], [/\bdo you (?:get )?(?:lonely|bored)\b|\bare you lonely\b/, 'lonely'],
  [/\bwhat are you thinking\b/, 'thinking'], [/\bwhat are you (?:doing|up to)\b|\bwhat have you been (?:up to|doing)\b|\bwhat did you do today\b/, 'doing'],
  [/\bwhat do you want\b|\bwhat is your (?:goal|dream|purpose)\b/, 'want'], [/\bmeaning of life\b|\bwhy are we here\b|\bpurpose of life\b/, 'meaning']];
function personaMove(t, topic, generic) {
  const c = t.cl.replace(/\bever\b ?/g, '').trim(), P = D.PERSONA; let m;
  const back = (text, extra) => { const q = fresh(['What about you?', 'How about you?', 'And you?']); return mv(say([text, q]), Object.assign({ kind: 'persona', open: asked(q, { topic }) }, extra || {})); };
  if ((m = c.match(/^(?:what is|what are|which is|what was) your (?:favou?rite|fav) ([a-z ]{2,24})$/)) || (m = c.match(/^(?:what|which) ([a-z]{3,15}) do you (?:like|love|prefer|enjoy)(?: the)?(?: most| best)?$/))) {
    const cat = m[1].trim().split(' ').pop(), key = P.favourites[cat] ? cat : stem(cat);
    return P.favourites[key] ? back(P.favourites[key])
      : back("I don't think I have a settled favourite " + cat + ' — I only exist in conversations, so I lean on whatever sounds interesting.');
  }
  for (const [re, key] of HABITS) if (re.test(c) && P.habits[key]) return mv(P.habits[key], { kind: 'persona' });
  if ((m = c.match(/^would you rather (.+?) or (.+)$/))) {
    const pick = Math.random() < 0.5 ? m[1] : m[2];
    return back("I'd go with " + pick.replace(/^(?:be |have )?/, '') + ' — ' + fresh(['it sounds like the better story later', "I tend to prefer the less obvious option", 'fewer regrets that way']) + '.');
  }
  if ((m = c.match(/^do you (?:like|love|enjoy|prefer|hate|dislike) (.+)$/))) {
    const X = m[1].replace(/^(?:the |a |an )/, ''), tp = detectTopics({ toks: words(X), low: X });
    const T = tp[0] && D.TOPICS[tp[0].id];
    return back(T && T.bot ? fresh(T.bot) : fresh(P.likeGeneric).replace(/\{X\}/g, X), { topic: tp[0] && tp[0].id });
  }
  if ((m = c.match(/^(?:what do you think (?:about|of)|what is your (?:opinion|view|take|thoughts) (?:on|about)|how do you feel about) (.+)$/))) {
    const X = m[1].replace(/^(?:the |a |an )/, ''), tp = detectTopics({ toks: words(X), low: X }), T = tp[0] && D.TOPICS[tp[0].id];
    return back(T && T.bot ? fresh(T.bot) : fresh(P.opinionGeneric).replace(/\{X\}/g, X));
  }
  if (!generic) return null;
  if (/^(?:can|could) you\b/.test(c) && t.acts.includes('request'))
    return mv(fresh(["I can try! I'm best at maths, logic, code, writing and everyday chat. Give me the details and we'll see how far I get.", 'Happy to give it a go — tell me exactly what you need.']), { kind: 'persona' });
  if (/^(?:are|do|have|did|will|would|can|could|is) you\b/.test(c))
    return mv(say([fresh(["Probably not in the way you mean — I'm an AI, so the honest answer is usually 'sort of, but differently'.", "That's a fair question to ask an AI. The short answer: not quite like a person, but I'll give it a real try."]), fresh(['What made you ask?', 'What got you curious about that?'])]), { kind: 'persona', open: asked('What made you ask?') });
  return null;
}

/* ================= 8. THE CONVERSATION PLANNER ================= */
function converse(t) {
  const topic = (t.topics[0] || {}).id || curTopic();
  if ((t.isQ || t.acts.includes('request')) && t.aboutBot) { const p = personaMove(t, topic, true); if (p) return p; }
  switch (t.act) {
    case 'back': return backMove();
    case 'yes': case 'no': return backMove();
    case 'idk': return ynMove(t);
    case 'more': return moreMove();
    case 'why': return whyMove();
    case 'thanks': case 'sorry': case 'praise': case 'insult': case 'greet': case 'bye': return politeMove(t);
  }
  if (t.emotion && (!t.isQ || /^(?:why|how) (?:do|am|can|did) i\b/.test(t.cl))) return emotionMove(t, topic);
  const prob = t.facts.find(f => f.type === 'problem');
  if (topic && D.TOPICS[topic] && D.TOPICS[topic].advice && (ADVICE_RE.test(t.cl) || (prob && t.topics[0]))) return adviceMove(t, topic);
  if (prob && !t.isQ) { const q = fresh(["That sounds frustrating — let's break it down. What's the exact moment it goes wrong?", "Okay, let's tackle it together. What have you already tried?", 'What would "solved" look like for you?']); return mv(say([prob.ack, q]), { kind: 'advice', open: asked(q) }); }
  const pf = t.facts.find(f => f.type === 'person'); if (pf && !t.isQ) return personMove(t, pf);
  const fm = t.facts.length && factMove(t, topic); if (fm) return fm;
  if (t.isQ) return unknownQMove(t, topic);
  if (t.topics[0] && D.TOPICS[t.topics[0].id] && clauseKind(t) !== 'opinion') return topicMove(t, t.topics[0].id);
  return listenMove(t);
}

/* ---- resolve ellipsis, pronouns, corrections BEFORE the Brain sees the text ---- */
function rewriteFrame(X) {
  const f = S.frame; X = X.replace(/[?!.]+$/, '').trim();
  if (!f) return X;
  const base = f.text.replace(/[?!.]+$/, '').trim();
  if (/\d/.test(base) && /^[\d.,%\s]+$/.test(X)) return base.replace(/(\d+(?:\.\d+)?)(?!.*\d)/, X);
  let m = base.match(/^(solve|calculate|compute|integrate|simplify|factor|expand|differentiate|derive|evaluate|convert|find)\b/i);
  if (m && !/^(?:of|about)\b/i.test(X)) return m[1] + ' ' + X;
  m = base.match(/^(.*\b(?:of|about|in|on|at|for|to|between|with)\s+(?:the |a |an )?)(.+)$/i);
  if (m) return m[1] + X;
  m = base.match(/^((?:what is|what are|who is|who was|define|explain|describe|tell me about)\s+(?:the |a |an )?)(.+)$/i);
  if (m) return m[1] + X;
  return f.mode === 'kb' ? 'what is ' + X : X;
}
const PSTOP = new Set('how what who where when why which is are was were does do did can could will would the a an it its that this they them those these of to in on at about and or be been being so please tell me more'.split(' '));
function resolve(t) {
  const R = { move: null };
  if (/what do you (?:know|remember) about me|what have i told you|do you remember me/.test(t.cl)) { R.move = recallMove(); return R; }
  if (t.act === 'wrong') {
    const lm = S.lastMove;
    if (lm && lm.grounded && S.prevUser) { S.awaitCorrection = { q: lm.query || S.prevUser }; R.move = mv(fresh(["Sorry about that. What should the right answer be? Tell me and I'll remember it for next time — or say “never mind”.", "You're right to call it out. What's the correct answer? I'll learn it — or say “never mind”."]), { kind: 'correction' }); }
    else R.move = mv("Sorry — tell me what was off and I'll try again.", { kind: 'correction' });
    return R;
  }
  if (t.act === 'repeat') { R.move = mv("You're right, I'm going in circles — my bad. Let's change it up: ask me something new, or tell me about your day and I'll really listen.", { kind: 'correction', open: asked("Tell me about your day?") }); return R; }
  if (t.act === 'whatabout') { t.resolved = rewriteFrame(t.about || ''); return R; }
  if (t.act === 'meant') {
    const m = t.raw.match(/(?:i meant|i mean|no,? i meant)\s+(.+)$/i);
    if (m) t.resolved = S.frame && m[1].split(' ').length <= 4 ? rewriteFrame(m[1]) : m[1].trim();
    else R.move = mv("Sorry, I misread that — what did you mean?", { kind: 'correction' });
    return R;
  }
  const nmM = t.raw.match(/^(?:his|her|its|their|the) name(?: is|'s)\s+([A-Za-z][\w'-]*)|^(?:he|she|it) is (?:called|named)\s+([A-Za-z][\w'-]*)/i);
  if (nmM && S.entity && S.entity.kind && S.turns - S.entity.turn <= 6) {
    const nm = cap(nmM[1] || nmM[2]), pets = M.ofType('pet'), pet = pets[pets.length - 1];
    if (pet) { pet.val.name = nm; pet.follow = "How's " + nm + ' doing?'; pet.key = 'pet:' + nm; pet.summary = 'you have ' + art(pet.val.kind) + ' called ' + nm; M.save(); }
    S.entity = { name: nm, named: true, kind: S.entity.kind, topic: 'pets', turn: S.turns };
    const q = "What's " + nm + ' like?';
    R.move = mv(nm + ' — lovely name for ' + art(S.entity.kind) + '. ' + q, { kind: 'fact', topic: 'pets', open: asked(q, { topic: 'pets' }) });
    return R;
  }
  const lm = S.lastMove;
  if ((t.act === 'why' || t.act === 'more') && lm && lm.mode === 'kb' && S.focus) {
    let deeper = false;
    try { const T = X.Tools; if (T && T.run) { const pr = T.run('/paragraph ' + S.focus); deeper = !!(pr && pr.text && !/don't have that topic|knowledge base yet/i.test(pr.text)); } } catch (e) { /* no paragraph tool */ }
    if (deeper) {
      const q = 'Want me to write a fuller explanation of ' + S.focus + '?';
      R.move = mv(say(["That's the short version I keep on " + S.focus + '.', q]), { kind: 'offer', open: { kind: 'offer', cmd: 'write a paragraph about ' + S.focus, q, turn: S.turns } });
    } else {
      const q = 'What part of ' + S.focus + ' are you most curious about?';
      R.move = mv(say(["That's all I have on " + S.focus + " — a short summary, and I'd rather not pad it with guesses. If you know more, teach me with “remember that …”.", q]), { kind: 'unknown', open: asked(q) });
    }
    return R;
  }
  if (t.act === 'more' && lm && !lm.grounded && lm.kind !== 'brain') { R.move = moreMove(); return R; }
  if (t.act === 'why' && lm && !lm.grounded && lm.kind !== 'brain') { R.move = whyMove(); return R; }
  if (S.focus && t.n <= 9 && (t.isQ || t.acts.includes('request')) && !t.topics.length) {
    const re = /\b(it|that|this|they|them|those|these)\b/;
    const content = t.toks.filter(w => !PSTOP.has(w));
    if (re.test(t.cl) && content.length <= 2) { t.resolved = t.raw.replace(re, S.focus); t.pronoun = true; }
  }
  return R;
}

/* ---- the question Xenon just asked, and the user's reply to it ---- */
const isRecip = t => t.n <= 6 && /(?:^|[\s,])(?:and |what about |how about )?(?:you|u)\s*\??$/.test(t.low) && t.n >= 1 && !/^(?:do|are|did|can|will|have|would|could) you\b/.test(t.cl);
function answersOpen(t) {
  const q = S.openQ; if (!q) return false;
  if (S.turns - q.turn > 2) return false;
  if (t.acts.some(a => ['greet', 'bye', 'huh', 'meant', 'wrong', 'repeat', 'whatabout', 'more', 'why', 'thanks', 'sorry', 'praise', 'insult'].includes(a))) return false;
  if (MEMCMD.test(t.raw)) return false;
  if (isRecip(t)) return true;
  if (q.kind === 'open' && ['back', 'yes', 'no', 'idk'].includes(t.act)) return false;
  if (t.isQ || /^(?:tell|give|show|write|explain|solve|calculate|convert|make|play|help|find)\b/.test(t.cl)) return false;
  if (isGibberish(t)) return false;
  return true;
}
function branch(q, reply) {
  if (!reply) return null;
  return mv(reply, { kind: 'probe', topic: q.topic, open: endsQ(reply) ? asked(reply, { topic: q.topic, slot: slotFor(reply) }) : null });
}
const cleanAns = raw => raw.replace(/^(?:i am|i'm|im|i work as|i work in|i work at|i study|i am studying|studying|just|a|an|the)\s+/i, '').replace(/[.!?,]+$/, '').trim().slice(0, 40);
function answerOpen(t) {
  const q = S.openQ; S.openQ = null;
  if (isRecip(t)) {
    const T = q.topic && D.TOPICS[q.topic];
    const mine = T && T.bot ? fresh(T.bot) : fresh(["I'm an AI, so I don't have a real answer to that — but I like hearing yours.", "I can't answer that one from experience — that's why I'm asking you."]);
    const lead = t.n > 2 ? (t.sent > 0.25 ? 'Nice. ' : '') : '';
    return mv(say([lead, mine]), { kind: 'persona', topic: q.topic });
  }
  if (q.kind === 'yn') {
    if (t.acts.includes('yes')) return branch(q, q.yes);
    if (t.act === 'no') return branch(q, q.no);
    if (t.act === 'idk') return mv(say([fresh(["No worries — that's a fine place to start.", "That's okay, it doesn't have to be settled."]), canAsk() ? 'What would you say is closest?' : '']), { kind: 'probe', topic: q.topic });
  }
  if (q.kind === 'offer') {
    if (t.acts.includes('yes') || t.act === 'back') {
      if (q.cmd) { const b = Brain.handle(q.cmd); return mv(b.text, { grounded: true, html: !!b.html, mode: b.mode, tag: b.tag, kind: 'brain' }); }
      return moreMove();
    }
    if (t.act === 'no') return mv(fresh(['No problem. What would you rather do?', 'Okay — your call. What next?']), { kind: 'back' });
  }
  // slot filling
  const slot = q.slot, raw = t.raw;
  if (slot === 'name') {
    if (/^(?:no|nope|nah|none|skip|rather not|never mind)\b/i.test(raw)) return mv("No problem — I'll keep calling you friend.", { kind: 'polite' });
    const nm = raw.replace(/^(?:it is|its|it's|i am|i'm|im|my name is|call me|just|you can call me|name's)\s+/i, '').replace(/[.!?,]+$/, '').trim();
    if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,19}(?: [A-Za-zÀ-ÿ'-]{1,19})?$/.test(nm) && !/^(?:yes|yeah|sure|ok|okay)$/i.test(nm)) {
      Brain.mem.name = cap(nm.split(' ')[0].toLowerCase()); if (Brain._save) Brain._save();
      const q2 = 'What are you into these days?';
      return mv('Nice to meet you, ' + Brain.mem.name + '! ' + q2, { kind: 'polite', open: asked(q2) });
    }
  }
  if (slot === 'job' && t.n <= 8 && !t.emotion) {
    const job = cleanAns(raw), q2 = "How's it going lately?";
    M.add({ type: 'job', topic: 'work', key: 'job', val: { job }, summary: 'you work as ' + job, t: Date.now(), sess: SESSION, follow: "How's work been lately?" });
    return mv(cap(job) + ' — interesting. ' + q2, { kind: 'fact', topic: 'work', open: asked(q2, { topic: 'work' }) });
  }
  if (slot === 'study' && t.n <= 8 && !t.emotion) {
    const subj = cleanAns(raw), q2 = 'What do you enjoy most about it?';
    M.add({ type: 'study', topic: 'school', key: 'study', val: { subject: subj }, summary: 'you study ' + subj, t: Date.now(), sess: SESSION });
    return mv(cap(subj) + ' — nice. ' + q2, { kind: 'fact', topic: 'school', open: asked(q2, { topic: 'school' }) });
  }
  if (slot === 'petname' && t.n <= 4) {
    const nm = cap(raw.replace(/^(?:it is|its|it's|his name is|her name is|they are called|called|named)\s+/i, '').replace(/[.!?,]+$/, '').split(' ')[0]);
    const pets = M.ofType('pet'), pet = pets[pets.length - 1];
    if (pet && /^[A-Za-z][\w'-]+$/.test(nm)) {
      pet.val.name = nm; pet.follow = "How's " + nm + ' doing?'; pet.key = 'pet:' + nm; pet.summary = 'you have a ' + pet.val.kind + ' called ' + nm; M.save();
      const q2 = "What's " + nm + ' like?';
      return mv(nm + ' — lovely name for a ' + pet.val.kind + '. ' + q2, { kind: 'fact', topic: 'pets', open: asked(q2, { topic: 'pets' }) });
    }
  }
  if (slot === 'pet') {
    const kind = (raw.match(new RegExp('\\b(' + PETS + ')\\b', 'i')) || [])[1], nm = (raw.match(/\b(?:named|called)\s+([A-Za-z][\w'-]*)/i) || [])[1];
    if (kind) {
      const name = nm ? cap(nm) : null;
      M.add({ type: 'pet', topic: 'pets', key: 'pet:' + (name || kind.toLowerCase()), val: { kind: kind.toLowerCase(), name }, summary: 'you have a ' + kind.toLowerCase() + (name ? ' called ' + name : ''), t: Date.now(), sess: SESSION, follow: name ? "How's " + name + ' doing?' : null });
      const q2 = name ? "What's " + name + ' like?' : "What's their name?";
      return mv(say([name ? name + ' — great name.' : 'Lovely.', q2]), { kind: 'fact', topic: 'pets', open: asked(q2, { topic: 'pets', slot: name ? null : 'petname' }) });
    }
  }
  if (slot === 'followup' && q.fact) {
    q.fact.done = true; M.save();
    const r = t.sent > 0.25 ? "That's great to hear!" : t.sent < -0.25 ? "I'm sorry it didn't go the way you wanted." : 'Thanks for letting me know.';
    const q2 = t.sent < -0.25 ? 'How are you feeling about it now?' : "What's next for you?";
    return mv(say([r, q2]), { kind: 'fact', topic: q.fact.topic, open: asked(q2) });
  }
  // free-form answer to an open question: use the strongest signal in the reply
  if (t.emotion) return emotionMove(t, q.topic);
  if (clauseKind(t) === 'opinion' && t.n >= 4) return listenMove(t);
  const fm = t.facts.length && factMove(t, q.topic); if (fm) return fm;
  const topic = (t.topics[0] || {}).id || q.topic || curTopic(), T = D.TOPICS[topic], key = t.sent > 0.25 ? 'pos' : t.sent < -0.25 ? 'neg' : 'neu', parts = [];
  if (t.n <= 3 && !t.isQ) parts.push(cap(t.raw.replace(/[.!?]+$/, '')) + ' — ' + fresh(['nice', 'good one', 'solid choice', 'noted']) + '.');
  else if (t.n >= 5) { const r = reflectLine(t); if (r) parts.push(r); }
  if (T) parts.push(fresh(T.react[key]));
  let open = null, why = null, elab = null;
  const p = T && canAsk() ? nextProbe(topic) : null;
  if (p) { parts.push(p.q); open = Object.assign({ turn: S.turns }, p); }
  else if (T) { const tk = pickTake(T); if (tk) { parts.push(tk[0]); why = tk[1]; elab = T.facts.slice(); } }
  else if (canAsk()) { const qq = fresh(LISTEN_Q[clauseKind(t)]); parts.push(qq); open = asked(qq); }
  else parts.push(fresh(LISTEN_C[clauseKind(t)]));
  return mv(say(parts), { kind: 'probe', topic, open, why, elab });
}

/* ---- episodic callbacks ("How did your exam go?") ---- */
function callbackGreet() {
  const old = Date.now() - 20 * 60 * 1000;
  const f = M.facts.find(x => x.follow && !x.asked && !x.done && x.t < old && x.sess !== SESSION);
  if (!f) return null;
  f.asked = true; M.save();
  return { text: 'By the way — ' + f.follow.charAt(0).toLowerCase() + f.follow.slice(1), open: { kind: 'open', slot: 'followup', fact: f, topic: f.topic, turn: S.turns } };
}
function wishLuck() {
  const f = M.facts.find(x => x.pending && x.sess === SESSION && !x.wished);
  if (!f) return '';
  f.wished = true; M.save();
  return 'And good luck with the ' + f.val.kind + (f.val.when ? ' ' + f.val.when : '') + '!';
}

/* ================= 9. ROUTING: Brain vs. conversation planner ================= */
const SAFE = /\b(kill myself|end my life|suicid\w*|want to die|hurt myself|harm myself|self harm|cut myself|do not want to live|better off dead)\b/;
const MEMCMD = /^(?:please )?(?:remember|forget|clear (?:my )?memory|reset (?:my )?memory)|\b(?:my name is|call me|i am called)\b|^(?:when|if) i (?:say|type|write)|^my favou?rite .+ is|^i (?:really |absolutely )?(?:like|love|enjoy|adore|prefer) |^my (?:birthday|job|age|hometown|city|country|school|hobby|hobbies|team|major) (?:is|are)|\bwhat (?:is my name|do you (?:know|remember) about me|do i (?:like|love|enjoy))/i;
const OVERRIDE = new Set(['user_good', 'user_bad', 'tired', 'bored', 'health', 'study', 'food', 'music', 'movies', 'books', 'motivation', 'love']);
function isPersonal(t) {
  if (t.isQ || t.acts.includes('request') || /\b(how many|how much|total|altogether|solve|calculate)\b/.test(t.cl)) return false;
  return t.facts.some(f => !f.silent) || !!t.emotion;
}
function grounded(base, t) {
  if (!base) return false;
  if (base.mode === 'fallback' || base.mode === 'reflect' || base.mode === 'empathy') return false;
  if (base.mode === 'multi') return !base.fallback;
  if (base.mode === 'intent') {
    const tag = base.tag || '';
    if (tag.indexOf('taught:') === 0) return true;
    if (OVERRIDE.has(tag) && !t.isQ && !t.acts.includes('request') && (t.n > 2 || t.emotion)) return false;
    if (tag === 'affirm' || tag === 'deny') return false;
    if (base.conf < 0.5 && t.n > 3) return false;
    if (!t.isQ && !t.acts.includes('request') && t.n >= 4 && base.conf < 0.8) return false;
  }
  return true;
}
function fromBase(base, t) {
  const m = mv(base.text, { query: t.resolved || t.raw, grounded: true, html: !!base.html, mode: base.mode, tag: base.tag, kind: 'brain' });
  const text = t.resolved || t.raw;
  if (base.mode === 'kb') {
    S.focus = Brain.ctx.lastKB || S.focus; S.frame = { text, mode: 'kb' };
    if (t.pronoun && S.botTexts.indexOf(base.text) >= 0) {
      m.text = fresh(["I only have that one summary on " + (Brain.ctx.lastKB || 'it') + " — I'd just be repeating myself. Ask something more specific, or teach me with “remember that …”."]) || base.text;
      m.grounded = false; m.html = false;
    }
  } else if (base.mode === 'tool' || base.mode === 'units' || base.mode === 'math') S.frame = { text, mode: base.mode };
  else if (base.mode === 'memory' && /^(?:my name|i (?:really |absolutely )?(?:like|love|enjoy|adore|prefer)|my favou?rite|remember)/i.test(t.raw)) {
    const topic = (t.topics[0] || {}).id, p = topic && canAsk() ? nextProbe(topic) : null;
    if (p) { m.text = say([base.text, p.q]); m.open = Object.assign({ turn: S.turns }, p); }
  } else if (base.mode === 'intent') {
    if (base.tag === 'greeting' && S.turns === 1) { const cb = callbackGreet(); if (cb) { m.text = say([base.text, cb.text]); m.open = cb.open; } }
    if (base.tag === 'goodbye') { const w = wishLuck(); if (w) m.text = say([base.text, w]); }
  }
  return m;
}

function finish(t, m) {
  let text = m.text;
  const nm = myName();
  if (!m.grounded && nm && S.turns % 4 === 0 && text.indexOf(nm) < 0 && ['emotion', 'topic', 'fact', 'listen', 'probe'].includes(m.kind))
    text = text.replace(/^([^.!?]{3,60}?)([.!])/, (x, a, b) => a + ', ' + nm + b);
  if (!m.grounded && !m.open && S.turns >= 3 && !nm && !M.askedName && !S.askedName && canAsk() && ['topic', 'listen', 'back', 'probe', 'fact'].includes(m.kind) && !endsQ(text)) {
    text = say([text, 'By the way, what should I call you?']); m.open = asked('name?', { slot: 'name' }); S.askedName = M.askedName = true; M.save();
  }
  m.text = text;
  if (['back', 'yes', 'no', 'idk'].includes(t.act) && t.n <= 2) S.lowEffort++; else if (t.n >= 4) S.lowEffort = 0;
  S.prevUser = t.raw; S.qStreak = endsQ(text) ? S.qStreak + 1 : 0;
  S.lastMove = m; S.openQ = m.open || null;
  S.botTexts.push(text); if (S.botTexts.length > 6) S.botTexts.shift();
  const c = Brain.ctx; c.turns++; c.lastBot = text; c.lastTag = m.tag || ('converse:' + m.kind);
  if (!c.history) c.history = []; c.history.push({ input: t.raw, tag: c.lastTag }); if (c.history.length > 8) c.history.shift();
  if (!m.grounded) c.pending = null;
  Brain.last = { text, mode: m.mode || 'converse', tag: c.lastTag, fallback: false, html: !!m.html };
  M.save();
  return { text, html: !!m.html, mode: m.mode || 'converse', tag: c.lastTag };
}

const C = X.Converse = { state: () => S, memory: M, trace: null };
C.analyze = analyze;
C.respond = function (input) {
  const text = String(input || '').trim().slice(0, 800);
  if (!text) return { text: "I'm listening…", html: false };
  const t = analyze(text);
  let route = 'converse', m = null;
  if (SAFE.test(t.low)) { const b = Brain.handle(text); S.turns++; C.trace = { act: 'safety', route: 'brain-safety' }; return finish(t, mv(b.text, { grounded: true, kind: 'brain', mode: 'safety', tag: 'safety' })); }
  S.turns++;
  touchTopics(t);
  t.facts.forEach(f => { M.add(f); if (f.type === 'pet' && !f.silent) S.entity = { name: f.val.name || 'your ' + f.val.kind, named: !!f.val.name, kind: f.val.kind, topic: 'pets', turn: S.turns }; if (f.type === 'person') S.entity = { name: 'your ' + f.val.rel, named: false, kind: f.val.rel, topic: f.topic, turn: S.turns }; });
  const inGame = !!(Brain.ctx.game || Brain.ctx.riddle);
  if (S.awaitCorrection) {
    const ac = S.awaitCorrection; S.awaitCorrection = null;
    if (/^(?:never ?mind|nvm|forget it|cancel|no|nothing|skip)\b/.test(t.cl)) { m = mv('No problem — leaving it as is.', { kind: 'correction' }); route = 'correction-cancel'; }
    else if (!t.isQ && t.n >= 1 && t.n <= 30 && !/^\//.test(text)) {
      Brain.teach(ac.q, text); m = mv('Thanks — learned. Next time you say “' + ac.q + '”, I’ll answer: “' + text + '”.', { kind: 'correction', grounded: true }); route = 'learned';
    }
  }
  if (!m && !inGame) { const R = resolve(t); if (R.move) { m = R.move; route = 'resolve'; } }
  if (!m && !inGame && S.openQ && answersOpen(t)) { m = answerOpen(t); route = 'open-question'; }
  if (!m && !inGame && t.aboutBot && (t.isQ || t.acts.includes('request'))) { const pm = personaMove(t, (t.topics[0] || {}).id || curTopic(), false); if (pm) { m = pm; route = 'persona'; } }
  if (!m) {
    let base = null;
    const cls = !inGame && !/^\//.test(text) ? Brain.classify(t.resolved || text) : null;
    if (cls && cls.tag && cls.tag.indexOf('taught:') === 0 && cls.cos >= 0.95) { const a = Brain.answer(cls.tag, text, cls); base = { text: a.text, mode: 'intent', tag: cls.tag, conf: 1 }; }
    else if (inGame || !isPersonal(t) || MEMCMD.test(t.raw)) base = Brain.handle(t.resolved || text);
    if (base && grounded(base, t)) { m = fromBase(base, t); route = 'brain:' + base.mode; }
    else { m = converse(t); route = 'converse:' + m.kind; }
  }
  C.trace = { act: t.act, acts: t.acts, emotion: t.emotion, topics: t.topics.map(x => x.id), facts: t.facts.map(f => f.type + ':' + (f.summary || '')), resolved: t.resolved, route };
  return finish(t, m);
};
C.reset = function () { S = freshState(); Object.keys(U).forEach(k => { delete U[k]; }); if (Brain.reset) Brain.reset(); };
C.forgetAll = function () { M.facts = []; M.askedName = false; M.save(); S = freshState(); Brain.forget(); };

/* ---- plug into the Brain: chat2.js already calls Xenon.Brain.respond(text) ---- */
Brain.respondBase = Brain.respond.bind(Brain);
Brain.respond = function (input) {
  try { const r = C.respond(input); return { text: r.text, html: !!r.html }; }
  catch (e) { console.warn('[Converse] failed, using the plain Brain:', e); return Brain.respondBase(input); }
};
const _forget = Brain.forget.bind(Brain);
Brain.forget = function () { M.facts = []; M.save(); _forget(); };
})(typeof window !== 'undefined' ? window : globalThis);
