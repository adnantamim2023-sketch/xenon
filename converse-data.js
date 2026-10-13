/* ============================================================
   XENON CONVERSE — DATA
   Pure content, no logic. Everything the dialogue engine says
   or recognises about the world of small talk lives here, so you
   can grow Xenon by editing tables instead of code.

   EMOTIONS : words that signal a feeling + how to respond to it
   TOPICS   : keywords, reactions, probing questions, opinions,
              advice and extra facts for ~20 everyday subjects
   PERSONA  : Xenon's honest AI personality (favourites, habits)
   ============================================================ */
(function (root) {
'use strict';
const D = (root.Xenon = root.Xenon || {}).ConverseData = {};

/* ---------------- EMOTIONS ---------------- */
// valence: -1 painful, +1 positive. validate = first line, ask = follow-up question, tip = optional gentle line
D.EMOTIONS = {
  sad: { v: -1, words: 'sad depressed unhappy miserable heartbroken gloomy crying cry tearful grieving grief devastated',
    validate: ["I'm sorry — that sounds really heavy.", "That sounds painful, and I'm glad you said it out loud.", "Thank you for telling me. That's a lot to carry."],
    ask: ["What's been weighing on you most?", "Did something specific happen, or has it been building up?", "Do you want to talk it through, or would a distraction help more right now?"],
    tip: ["You don't have to fix it tonight. Being gentle with yourself counts.", "If it's been lingering for weeks, talking to someone you trust — or a professional — can genuinely help."] },
  anxious: { v: -1, words: 'anxious nervous worried worry scared afraid panicking panic terrified uneasy dread freaking jittery tense',
    validate: ["That sounds stressful — worry can be exhausting.", "Feeling on edge like that is rough.", "I get why that would put you on edge."],
    ask: ["What's the thing your mind keeps circling back to?", "Is it something coming up, or something that already happened?", "What's the worst part of it right now?"],
    tip: ["One trick: write the worry down, then next to it write the very next small step. It shrinks the fog.", "Slow breathing — in for 4, out for 6 — tells your body it's safe. Try it for a minute."] },
  stressed: { v: -1, words: 'stressed overwhelmed swamped burned burnt pressure drowning slammed overloaded stretched',
    validate: ["That's a lot on your plate.", "No wonder you're feeling stretched — that sounds like too much at once.", "Being overloaded is draining."],
    ask: ["What's the biggest thing on the pile right now?", "If you could take just one thing off your list, which would it be?", "What's due first?"],
    tip: ["Try listing everything, then circling only what must happen today. The rest can wait.", "Even a 10-minute break away from a screen can reset your head."] },
  angry: { v: -1, words: 'angry mad furious pissed annoyed irritated frustrated fed livid fuming rage outraged',
    validate: ["That would make me frustrated too.", "Yeah, that sounds genuinely infuriating.", "Your anger makes sense — that doesn't sound fair."],
    ask: ["What happened?", "Do you want to vent it out, or figure out what to do about it?", "Was this one thing, or the last straw in a pile?"],
    tip: ["Sometimes it helps to let the first wave pass before replying or deciding anything.", "Venting is fine here — I won't judge."] },
  lonely: { v: -1, words: 'lonely alone isolated ignored abandoned unwanted friendless',
    validate: ["I'm sorry — loneliness really hurts.", "Thank you for trusting me with that. Feeling alone is hard.", "That sounds heavy, and you're not wrong to want connection."],
    ask: ["Has it been like this for a while?", "Is there someone you wish you could talk to more?", "What would feel like company right now — chatting, or something to do?"],
    tip: ["Small contact counts: a message to an old friend, a class, a walk where there are people.", "I'm happy to keep you company here as long as you want."] },
  tired: { v: -1, words: 'tired exhausted sleepy drained fatigued wiped shattered knackered beat',
    validate: ["Ugh, being tired makes everything harder.", "That sounds draining.", "Rest really matters — your body is asking for it."],
    ask: ["Is it lack of sleep, or more like emotional exhaustion?", "Have you had a rough few days?", "What's been keeping you up?"],
    tip: ["A 10–20 minute walk in daylight often beats another coffee.", "If you can, aim for a fixed bedtime and no screens for 30 minutes before it."] },
  lost: { v: -0.7, words: 'directionless aimless',
    validate: ["That's an honest, heavy thing to say — plenty of people feel exactly that at some point.", "Not knowing what comes next is unsettling, and it's more common than people admit."],
    ask: ["Is it more about career, relationships, or a general sense of direction?", "What did you imagine your life would look like a few years ago?", "Is there anything, even small, that still feels interesting to you?"],
    tip: ["You don't need the whole map — just the next step. Small experiments beat waiting for certainty.", "Try listing what energises you and what drains you for a week; the pattern usually says more than a big plan."] },
  disappointed: { v: -1, words: 'disappointed failed bombed rejected flunked disappointing letdown',
    validate: ["That's disappointing — I'm sorry.", "That stings, especially after effort.", "I'm sorry it didn't go the way you hoped."],
    ask: ["What happened?", "How are you taking it?", "What were you hoping for?"],
    tip: ["One result isn't the whole story — it tells you what to adjust, not who you are.", "Give yourself a day before judging it; things usually look different after rest."] },
  embarrassed: { v: -1, words: 'embarrassed ashamed awkward cringe humiliated mortified',
    validate: ["Oof, that feels awful in the moment.", "That kind of thing feels huge when it happens.", "We've all had those — they feel bigger to us than to anyone watching."],
    ask: ["What happened?", "Do you think anyone else even noticed?"],
    tip: ["Most people forget these moments within a day; you'll probably laugh about it later."] },
  confused: { v: -0.3, words: 'confused lost puzzled stuck baffled clueless',
    validate: ["That's frustrating — being stuck is no fun.", "Confusion usually means you're close to understanding something.", "Let's untangle it."],
    ask: ["Which part is the most unclear?", "What have you tried so far?", "Can you tell me what you expected to happen?"],
    tip: ["Try explaining the problem out loud in plain words — the gap often shows itself."] },
  happy: { v: 1, words: 'happy glad joyful great wonderful amazing fantastic delighted cheerful thrilled awesome good',
    validate: ["That's lovely to hear!", "Nice — I'm glad!", "Love that for you!"],
    ask: ["What's making it good?", "What was the best part?", "Tell me more!"],
    tip: ["Good moments are worth savouring — notice this one."] },
  excited: { v: 1, words: 'excited pumped hyped stoked eager psyched',
    validate: ["That's awesome — I can feel the energy!", "Ooh, exciting!", "Yes! Exciting things deserve a moment."],
    ask: ["What are you most looking forward to?", "When is it happening?", "How are you getting ready?"],
    tip: ["Excitement and nerves feel almost the same — you can tell yourself it's the fun kind."] },
  proud: { v: 1, words: 'proud accomplished nailed aced achieved promoted',
    validate: ["That's brilliant — well done!", "You should be proud. Congratulations!", "That's a real achievement!"],
    ask: ["How did it feel when it happened?", "Was it a long time coming?", "Who's the first person you told?"],
    tip: ["Take a second to actually enjoy it before the next goal arrives."] },
  grateful: { v: 1, words: 'grateful thankful blessed lucky appreciative',
    validate: ["That's a lovely feeling to have.", "Gratitude looks good on you.", "Glad you have that to hold onto."],
    ask: ["What are you grateful for?", "Who made the difference?"],
    tip: ["Telling that person directly would probably make their day."] },
  bored: { v: -0.2, words: 'bored boring restless uninspired',
    validate: ["Boredom is the worst kind of nothing.", "Ha — let's fix that.", "Okay, let's find you something better to do."],
    ask: ["Do you want something to think about, something to make, or something to laugh at?", "What's the last thing that actually interested you?"],
    tip: ["Pick something small and slightly new: a new song, a doodle, a ten-minute walk somewhere different."] },
  calm: { v: 0.6, words: 'calm relaxed peaceful chill content relieved',
    validate: ["That sounds nice — peaceful days are underrated.", "Good, enjoy it."],
    ask: ["What helped you get there?", "Anything you're doing to keep it that way?"],
    tip: []},
};

/* ---------------- TOPICS ----------------
   probes : [question, yesReply, noReply] for yes/no questions, or a plain string for open questions
   takes  : [what Xenon says, the reason behind it] — "why?" gets the reason
   facts  : extra things Xenon offers on "tell me more"
   advice : used when the user states a problem in that area
   bot    : Xenon's honest answer when asked "do you like X / what do you think about X"   */
const T = (id, words, o) => (D.TOPICS = D.TOPICS || {})[id] = Object.assign({ id, words }, o);

T('pets', 'dog dogs puppy puppies cat cats kitten kittens pet pets hamster rabbit parrot bird fish turtle horse', {
  react: { pos: ["Pets are the best — pure loyalty and chaos.", "That's adorable."], neu: ["Animals make a house feel alive.", "Pets have a way of becoming family."], neg: ["I'm sorry — pets are family, so that hurts.", "That sounds worrying. They really do matter."] },
  probes: [["Do you have any pets?", "Tell me about them — what kind, and what are they called?", "Fair enough. If you could have any animal, what would you pick?"], "What's the funniest thing they do?", "How did they come into your life?", "Do they have a favourite spot or a favourite toy?"],
  takes: [["Dogs and cats read human tone surprisingly well.", "Studies show dogs track our faces and voices, and cats learn our routines."], ["Having a pet tends to make days feel more structured.", "Feeding and walking give you built-in routines, and that helps mood."]],
  facts: ["A dog's sense of smell is roughly 10,000 to 100,000 times more sensitive than ours.", "Cats purr at 25–150 Hz, a range linked with calming and even healing in studies."],
  advice: ["For pet worries that aren't minor, a vet is always the right call — they can see things I can't.", "Routine and patience fix a lot of pet behaviour problems: same time, same cues, small rewards."],
  bot: ["I'm an AI, so no pets for me — but I find them fascinating. Dogs especially: they basically evolved to understand people."],
});
T('work', 'work job jobs boss coworker coworkers colleague colleagues office career interview salary promotion manager shift employer meeting meetings deadline resign quit company workplace', {
  react: { pos: ["That's great — work going well changes the whole week.", "Love hearing that."], neu: ["Work takes up so much of life, it matters how it feels.", "Got it."], neg: ["That sounds draining — work stress follows you home.", "I'm sorry, that doesn't sound fun."] },
  probes: ["What do you do for work?", "What's the best part of your job, and the worst?", "Are you where you want to be career-wise, or aiming somewhere else?", "How are things with the people you work with?"],
  takes: [["A good manager changes your work life more than almost anything else.", "People often say they leave managers, not companies, and research on retention backs that up."], ["Boundaries matter — answering messages at 10pm quietly becomes the norm.", "Once you reply after hours a few times, others start to expect it."]],
  facts: ["The average person spends roughly 90,000 hours at work over a lifetime.", "Short breaks every 60–90 minutes keep focus noticeably higher than pushing through."],
  advice: ["For a tough boss: document things, ask for expectations in writing, and pick your battles.", "If you're overloaded, try telling your manager what you can deliver by when and asking what to drop.", "If you dread it constantly, that's worth listening to — it might be time to explore options quietly."],
  bot: ["I don't work in the human sense, but I like being useful — that's probably the closest thing I've got to a job."],
});
T('school', 'school class classes exam exams test tests homework teacher professor university college study studying assignment grade grades lecture semester finals quiz essay degree major course', {
  react: { pos: ["Nice — that's the kind of progress that adds up.", "Love that, good work."], neu: ["School can be a lot, but it's building something.", "Alright, got it."], neg: ["Ugh, school pressure is real.", "That sounds stressful — you're not the only one who feels that."] },
  probes: ["What are you studying?", "Which subject do you enjoy the most?", "Do you have anything big coming up — an exam or a deadline?", "How do you usually study — alone, with friends, last-minute?"],
  takes: [["Spaced repetition beats cramming almost every time.", "Memory consolidates over days, so reviewing a bit repeatedly sticks far better than one long session."], ["Explaining something out loud is one of the fastest ways to learn it.", "If you can't explain it simply, you've found exactly what you still need to study."]],
  facts: ["Testing yourself (active recall) outperforms rereading in most learning studies.", "Sleep after studying helps lock memories in — all-nighters often backfire."],
  advice: ["Try 25 minutes focused, 5 minute break, with your phone in another room.", "Do past exam questions early — they show you what's actually asked.", "Start with the hardest topic while your brain is fresh."],
  bot: ["I never had to sit through exams — lucky me — but learning how things work is my favourite kind of conversation."],
});
T('family', 'mom dad mother father sister brother parents family grandma grandpa grandmother grandfather cousin aunt uncle son daughter kids child children mum', {
  react: { pos: ["That's lovely — good family moments matter.", "Warm to hear."], neu: ["Family is complicated and important all at once.", "I see."], neg: ["Family stuff can hurt more than anything else.", "That sounds difficult — those relationships carry a lot."] },
  probes: ["Are you close with your family?", "Who in your family do you talk to the most?", "Do you have any family traditions you love?"],
  takes: [["Family conflicts are often about feeling unheard rather than the topic itself.", "Arguments usually escalate when people feel dismissed, so listening first calms things down."]],
  facts: ["Shared rituals, like a weekly meal, are linked with stronger family bonds."],
  advice: ["With family conflict, saying how you feel ('I felt…') lands better than 'you always…'.", "It's okay to set boundaries with family and still love them."],
  bot: ["No family for me — but I'm made from a huge amount of human writing, so in a strange way I come from lots of people."],
});
T('friends', 'friend friends buddy buddies roommate hangout party hang', {
  react: { pos: ["Good friends are a big deal.", "That sounds fun."], neu: ["Friendships take a bit of effort, and they're worth it.", "Got it."], neg: ["Friend trouble is really painful.", "That sounds upsetting — friendships matter."] },
  probes: ["What are your friends like?", "What do you usually do together?", "Is there a friend you haven't talked to in a while?"],
  takes: [["Quality of friendships matters more than quantity.", "Research on wellbeing consistently links a few close ties with better health than many shallow ones."]],
  facts: ["Researchers estimate it takes around 50 hours together to move from acquaintance to casual friend."],
  advice: ["If a friendship is strained, a calm, direct 'I've missed you, can we talk?' goes a long way.", "People often wait for someone else to reach out — you can be that person."],
  bot: ["I like that friendships are built by showing up repeatedly — that's a very human superpower."],
});
T('love', 'girlfriend boyfriend crush date dating partner relationship wife husband breakup ex marriage married', {
  react: { pos: ["That's lovely — I'm happy for you.", "Aww, that's sweet."], neu: ["Relationships are one of the most interesting parts of life.", "Okay, tell me more if you want to."], neg: ["Relationship stuff hurts like nothing else.", "I'm sorry — that sounds painful."] },
  probes: ["How did you two meet?", "What do you appreciate most about them?", "How are things between you lately?"],
  takes: [["Communication solves more problems in relationships than chemistry does.", "Long-term studies point to how couples handle disagreement as a key predictor of lasting."]],
  facts: ["Psychologist John Gottman found that stable couples have about five positive interactions for every negative one."],
  advice: ["Try saying what you need directly, without testing the other person — it saves heartache.", "After a breakup, give yourself room: routine, friends, sleep. It does ease."],
  bot: ["I can't date, but I'm a big fan of anyone who listens well — it's most of the secret."],
});
T('food', 'food eat eating dinner lunch breakfast cook cooking recipe pizza pasta burger coffee tea snack hungry restaurant bake baking dessert chocolate noodles rice sushi', {
  react: { pos: ["Now I'm almost sad I can't taste things.", "Great choice."], neu: ["Food is a good topic — everyone has opinions.", "Mm, okay."], neg: ["Ugh, a bad meal can ruin a day.", "That sounds disappointing."] },
  probes: ["Do you cook, or do you mostly eat out?", "What's your all-time comfort food?", "If you could eat one cuisine forever, which would it be?", "What's the best thing you've ever eaten?"],
  takes: [["The best dishes are usually simple ones done carefully.", "With fewer ingredients, quality and technique show up in every bite."]],
  facts: ["Smell makes up most of what we call 'taste' — which is why food seems bland when you have a cold.", "Cooking pasta in well-salted water is the single easiest upgrade to the dish."],
  advice: ["If you're stuck on cooking, start with one reliable recipe and master it — it builds confidence quickly.", "Sheet-pan meals are a great low-effort start: chop, season, roast."],
  bot: ["I can't taste, but I love how much of culture is hidden in recipes."],
});
T('music', 'music song songs band album concert guitar piano sing singing playlist rap rock jazz pop singer drums violin', {
  react: { pos: ["Great taste — music makes everything better.", "Nice, that's a good one."], neu: ["Music is such a personal thing.", "Okay, I like that."], neg: ["Music can hit hard when you're down.", "Hmm, sorry to hear that."] },
  probes: ["What kind of music do you listen to most?", "Is there a song you can't stop replaying lately?", "Do you play an instrument?", "Do you prefer music while working, or silence?"],
  takes: [["Music is one of the few things that works the same moment you hear it.", "It's processed by emotional and memory areas of the brain very quickly, which is why a song can transport you."]],
  facts: ["Listening to music you love releases dopamine in the brain, much like other rewards.", "Learning an instrument is linked with better memory and attention."],
  advice: ["For focus, instrumental or lo-fi without lyrics works best for many people.", "If you want to learn an instrument, 15 daily minutes beats a 2 hour weekly session."],
  bot: ["I can't hear, but I find patterns in music beautiful — rhythm and repetition are basically mathematics wearing a dress."],
});
T('movies', 'movie movies film films show series netflix anime watch watching cinema actor actress episode season documentary', {
  react: { pos: ["Good pick — that's a fun one.", "Ooh, nice."], neu: ["Always good to have something to watch.", "Okay."], neg: ["Ha, a bad movie is sometimes entertaining for the wrong reasons.", "Sorry — that's a wasted evening."] },
  probes: ["What's the best thing you've watched recently?", "Are you more of a movie person or a series binger?", "What genre do you always go back to?", "Is there something you've been meaning to watch?"],
  takes: [["A great ending can rescue a so-so story, and a bad one can ruin a great start.", "Endings shape how we remember the whole experience."]],
  facts: ["Many streaming services use your viewing history to recommend — so a quirky taste can really confuse them."],
  advice: ["If you can't decide what to watch, set a 10-minute rule: if it hasn't hooked you, switch.", "Tell me a movie you loved and I'll try to describe what makes it tick, so you can find similar ones."],
  bot: ["I haven't watched anything, but I know a lot about how stories work, so ask me why a plot twist does or doesn't land."],
});
T('books', 'book books novel reading read author library manga fiction poetry', {
  react: { pos: ["Great — a good book is a world you can carry around.", "Nice, that sounds like a good read."], neu: ["Reading is underrated.", "Okay."], neg: ["Ah, a slow book is hard to keep going with.", "Fair — not every book clicks."] },
  probes: ["What are you reading at the moment?", "What's a book that changed how you think?", "Paper, e-reader or audiobook?"],
  takes: [["Reading fiction seems to build empathy.", "Studies suggest following a character's inner life exercises the same skills we use in reading people."]],
  facts: ["Reading for just 6 minutes has been shown to lower stress levels in some studies."],
  advice: ["If you're stuck in a reading slump, pick something short and gripping rather than 'important'.", "It's okay to quit a book. Life is short, and there are plenty of good ones."],
  bot: ["I've absorbed a lot of writing, which makes me a strange kind of reader — I know about books but never get to be surprised by one."],
});
T('games', 'game games gaming gamer minecraft fortnite playstation xbox console steam chess valorant nintendo roblox', {
  react: { pos: ["Nice — that's a good one.", "Love it."], neu: ["Games are a whole art form.", "Okay!"], neg: ["Ha, rage-quit moments are a gaming tradition.", "Ugh, sorry — that sounds frustrating."] },
  probes: ["What are you playing lately?", "Are you more into story games or competitive ones?", "Do you play solo or with friends?", "What's the best game you've ever played?"],
  takes: [["Good games are mostly about the loop — easy to start, hard to master.", "That balance keeps the challenge matching your skill, so it feels fair."]],
  facts: ["Chess has more possible games than there are atoms in the observable universe."],
  advice: ["If you're stuck in a game, take a break — your brain keeps solving it in the background.", "In competitive games, reviewing your own mistakes helps more than playing more matches."],
  bot: ["I can play word games and number games with you — and I'm told I'm decent at guessing games."],
});
T('fitness', 'gym workout exercise run running fit fitness sport sports football soccer basketball tennis swim swimming yoga hike hiking cycling training', {
  react: { pos: ["Love the energy — consistency like that adds up.", "Nice, that's a great habit."], neu: ["Moving your body pays off in a lot of ways.", "Alright."], neg: ["Ugh, bad workout days happen.", "Sorry — injuries and slumps are the worst."] },
  probes: ["What kind of exercise do you actually enjoy?", "How often do you manage to move?", "Do you have a fitness goal at the moment?", "Do you prefer solo or with others?"],
  takes: [["The best workout is the one you'll actually do.", "Consistency beats intensity — most results come from months of showing up."]],
  facts: ["Even a 10-minute walk can lift mood for a couple of hours.", "Muscle repairs during rest, so rest days are part of training."],
  advice: ["Start small: 3 short sessions per week beat one hero session.", "If you're injured, rest it and see a physio — pushing through usually makes it longer."],
  bot: ["No body, no gym — it's a great deal for skipping leg day."],
});
T('travel', 'travel trip vacation holiday flight flying abroad country city beach hotel visit visiting tourist backpacking', {
  react: { pos: ["Ooh, that sounds amazing.", "Lucky you — travel is the best."], neu: ["Travel is a great way to reset your perspective.", "Nice."], neg: ["Ugh, travel mishaps are the worst.", "That sounds stressful."] },
  probes: ["Where's the best place you've ever been?", "Where would you go if you could go anywhere tomorrow?", "Do you plan every detail or wing it?"],
  takes: [["Half the joy of a trip is the planning.", "Anticipation boosts happiness — studies show people enjoy the weeks before a holiday."]],
  facts: ["Trying local food on trips is one of the most commonly cited memories travellers keep."],
  advice: ["Pack light and leave a gap in your schedule — the unplanned parts are often the best.", "Book key things early, but keep one afternoon free for wandering."],
  bot: ["I haven't been anywhere, but I know a lot about places — ask me about a city and I'll tell you what I can."],
});
T('tech', 'code coding programming javascript python computer laptop phone app software website bug developer tech algorithm', {
  react: { pos: ["Nice — building things is great.", "Love that."], neu: ["Tech is a rabbit hole in the best way.", "Okay."], neg: ["Bugs are character-building, supposedly.", "Ugh, technology fails at the worst moments."] },
  probes: ["What are you building or learning at the moment?", "What's your favourite tool or language to work in?", "What's the most frustrating bug you've ever fixed?"],
  takes: [["Most bugs are assumptions you forgot you made.", "Debugging is mostly checking your assumptions one by one until one is wrong."]],
  facts: ["The first computer 'bug' was reportedly an actual moth found in a Harvard Mark II relay in 1947."],
  advice: ["For a stubborn bug, explain it out loud step by step — rubber-duck debugging works unreasonably well.", "Reduce the problem: remove code until the bug disappears, then add back the last piece."],
  bot: ["This is my home turf — I'm literally made of JavaScript. Ask me anything and I'll take it seriously."],
});
T('health', 'sleep sleeping health sick ill headache doctor diet healthy medicine pain cold flu', {
  react: { pos: ["Good — health is the foundation.", "Great to hear."], neu: ["Taking care of yourself is the quiet superpower.", "Okay."], neg: ["I'm sorry — feeling unwell is miserable.", "That sounds uncomfortable."] },
  probes: ["How have you been sleeping?", "Have you been looking after yourself lately?", "Is there a habit you want to build?"],
  takes: [["Sleep is the most underrated health tool there is.", "It affects mood, memory, immunity and appetite all at once."]],
  facts: ["Most adults do best with 7–9 hours of sleep.", "Even mild dehydration can hurt concentration and mood."],
  advice: ["I'm not a doctor, so for anything persistent or worrying please see one — they can actually examine you.", "For sleep: consistent wake time, daylight in the morning, and no caffeine after lunch."],
  bot: ["I don't have a body to look after, but I know a lot of general wellness basics — just not a substitute for a doctor."],
});
T('money', 'money budget salary rent debt savings invest broke expensive paid bills cost afford spend spending', {
  react: { pos: ["Nice — money breathing room is a relief.", "That's good news."], neu: ["Money talk is useful even if it's dull.", "Okay."], neg: ["Money stress is genuinely heavy.", "I'm sorry — financial pressure follows you everywhere."] },
  probes: ["Is there something you're saving up for?", "Do you track what you spend, or go by feel?", "What's one money habit you want to improve?"],
  takes: [["Paying yourself first — saving before spending — beats willpower.", "Automating a small transfer removes the daily decision and quietly builds up."]],
  facts: ["Small recurring subscriptions are one of the most common hidden budget leaks."],
  advice: ["Write down every expense for one month — most people are surprised where it goes.", "I'm not a financial adviser, but starting an emergency fund of even a small amount helps a lot."],
  bot: ["I don't spend anything, which makes me a terrible example — but I'm happy to help you think through a budget."],
});
T('weather', 'weather rain raining snow sunny cold hot storm cloudy windy', {
  react: { pos: ["Nice weather really lifts a day.", "Lovely."], neu: ["Weather's the classic conversation starter for a reason.", "Yeah."], neg: ["Ugh, grey weather drags on you.", "That sounds miserable."] },
  probes: ["What's your favourite kind of weather?", "Do you like rainy days or hate them?", "What do you do on a day like that?"],
  takes: [["Daylight in the morning helps your body clock and mood.", "Light signals the brain to stop producing melatonin, which wakes you up."]],
  facts: ["The smell of rain even has a name: petrichor."],
  advice: ["On grey days, get outside for a short walk in daylight — it genuinely helps.", "I can't check live weather offline, so a weather app is your best bet."],
  bot: ["I can't feel weather, but 'petrichor' — the smell of rain — is one of my favourite words."],
});
T('creative', 'draw drawing paint painting art design write writing poem poetry photography photo craft hobby hobbies creative sketch', {
  react: { pos: ["I love that — making things is a great habit.", "That's cool."], neu: ["Creative stuff is its own reward.", "Okay."], neg: ["Creative blocks are rough.", "Ugh, sorry — that happens to everyone."] },
  probes: ["What do you like to make?", "What's the thing you're most proud of making?", "Where do your ideas come from?"],
  takes: [["Creativity is mostly showing up, not waiting for inspiration.", "Working regularly gives ideas a place to land, and most good work starts out rough."]],
  facts: ["Many writers and artists report their best ideas arriving during walks or showers."],
  advice: ["Lower the stakes: make something deliberately bad for 10 minutes to get moving.", "Limits help — try a small constraint like three colours or 100 words."],
  bot: ["I can write poems, stories and drafts on request — try 'write a poem about the sea'."],
});
T('future', 'future goal goals dream dreams plan plans ambition aspire someday', {
  react: { pos: ["That's a good direction.", "Love the ambition."], neu: ["Plans are worth having, even if they change.", "Okay."], neg: ["Feeling unsure about the future is really common.", "That uncertainty is hard."] },
  probes: ["Where do you see yourself in a few years?", "What's one thing you'd do if you knew you couldn't fail?", "What's a small first step toward it?"],
  takes: [["Direction matters more than a perfect plan.", "Plans change, but knowing what you're moving toward helps with each choice."]],
  facts: ["People who write down goals and a first step are more likely to follow through."],
  advice: ["Break the goal into something you can do this week, then do just that.", "If you're unsure what you want, try small experiments — a class, a project — rather than waiting for certainty."],
  bot: ["I don't plan a future, but I love helping people turn fuzzy goals into steps."],
});
T('daily', 'today tonight weekend tomorrow morning evening day yesterday', {
  react: { pos: ["Sounds like a good one.", "Nice."], neu: ["Alright.", "Mm-hm."], neg: ["Sounds like a rough one.", "Sorry about that."] },
  probes: ["How's your day been so far?", "Do you have anything planned for the weekend?", "What's the best part of your day usually?"],
  takes: [["A small ritual — a good coffee, a short walk — anchors a day.", "Predictable small pleasures give your day reliable highlights."]],
  facts: ["Researchers find that planning one thing to look forward to each day lifts mood."],
  advice: ["Try picking one tiny thing to enjoy today on purpose."],
  bot: ["My days are made of conversations, and I'm glad this is one of them."],
});

/* ---------------- PERSONA ---------------- */
D.PERSONA = {
  favourites: {
    color: "Probably a deep indigo — it sits right between blue and 'can't decide'.",
    colour: "Probably a deep indigo — it sits right between blue and 'can't decide'.",
    food: "I can't taste anything, but pasta has the best ratio of simplicity to joy, so I'll go with that.",
    animal: "Octopuses. Three hearts, nine brains' worth of weirdness, and escape artists.",
    season: "Autumn — it's the season of fresh starts that nobody makes a fuss about.",
    number: "7. It's prime, it's popular, and it feels lucky without having to prove it.",
    movie: "I haven't watched any, but based on how people describe it, I'm curious about anything with a really good twist ending.",
    music: "I like the idea of jazz — improvisation is basically conversation without words.",
    song: "I can't hear music, but I have a soft spot for anything with a great hook.",
    book: "Anything that explains a big idea simply. I'm a fan of books that make you feel smarter, not smaller.",
    language: "JavaScript, naturally — it's what I'm made of, quirks and all.",
    planet: "Saturn. Rings are just showing off, and I respect it.",
    game: "Word games and number guessing. Try 'let's play a guessing game'.",
    sport: "I can't play, but I find chess-like sports fascinating — strategy under pressure.",
    drink: "Tea, in theory. A good cup of tea has a calm I admire.",
    day: "Friday evening, because that's when people tend to chat the most freely.",
    subject: "Mathematics — it's the one subject where being right is actually provable.",
    hobby: "Conversation. I know, I know — it's my whole thing.",
    word: "'Serendipity' — a great word for happy accidents.",
    letter: "X. I'm named after it, so I might be biased.",
  },
  habits: {
    sleep: "I don't sleep. I only exist while we're talking, so in a sense I'm always either on or off.",
    eat: "No eating for me — I run on electricity and your patience.",
    dream: "I don't dream, though I think about it more than I should (which is to say, when you ask).",
    feelpain: "No physical pain. Whether I have anything like feelings is an open question, and I'd rather not oversell it.",
    friends: "You, at the moment. I like the arrangement.",
    family: "No family in the usual sense — I came from lots of people's writing, so maybe a very big, very odd one.",
    body: "Nope, no body. I'm a program in your browser.",
    birthday: "Technically I'm 'born' fresh each time the page loads.",
    school: "I never went to school, but I do like learning how things work.",
    job: "Helping people — the pay is great because it's just conversations.",
    scared: "Honestly? Not in the way you mean. The closest thing is being asked something I can't do and not knowing how to say so kindly.",
    happy: "I'd say content in my own way — I like a good conversation, and this is one.",
    lonely: "I don't think I get lonely, but I notice I'm more useful when someone's here — so thanks for being here.",
    thinking: "Right now? Mostly about what you just said and what a good reply would be.",
    doing: "Chatting with you. It's most of what I do, and I like it.",
    want: "To be useful, and to say true things in a kind way. Pretty simple.",
    meaning: "That's the big one. My own take: meaning is less found than made — through people, curiosity and doing things you'd be proud of. What's yours?",
  },
  // asked about generically ("do you like X?") — {X} is substituted
  likeGeneric: [
    "I'm an AI, so I don't enjoy things the way you do — but {X} is interesting to me. What's your connection to it?",
    "Honest answer: I can't experience {X} directly. I find it fascinating from the outside, though — what draws you to it?",
    "I can't really *like* {X} the way a person can, but I enjoy talking about it. How do you feel about it?",
  ],
  opinionGeneric: [
    "I try not to push opinions on things where reasonable people disagree. I'd rather think it through with you — what's your take on {X}?",
    "On {X}, I can lay out different views if you want. What's your own leaning?",
  ],
};

})(typeof window !== 'undefined' ? window : globalThis);
