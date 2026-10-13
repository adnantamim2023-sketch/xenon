/* ============================================================
   XENON — the main conversational + tool-calling AI for this app.
   Pre-trains an intent classifier in-memory when this file loads
   (no network, no server). For anything that isn't a /command,
   this is what chat2.js calls.

   Every single-topic message runs through ONE pipeline, in order:
     1. Safety check (self-harm) — always first, on the raw message,
        before anything else runs.
     2. An active game/riddle in progress (also re-checked inside
        each split piece of a multi-intent message — see below — so
        "25, and also tell me a joke" both answers the guessing game
        AND tells the joke).
     2.5. Small conversational-flow niceties: reciprocal questions
        ("I'm good, you?" after Xenon asked how you were) and
        "what did I just say/ask" look-ups against recent history.
     3. Teaching & memory commands ("my name is …", "remember that …",
        "when I say X you say Y").
     4. TOOL ROUTING — every other tool module in this app already
        exports an isXRequest(text) natural-language detector
        (isCoding, isBaseConversion, isLogicExpression,
        isPhysicsProblem, isAlgebra, mathIsMath, isReasoningRequest,
        isAssistRequest, isWritingRequest, isParagraphRequest). Xenon
        checks each in turn and, on a match, calls that tool through
        Xenon.Tools.run(), the exact same path /commands use — so a
        plain-English message gets the same answer a slash command
        would.
     5. Xenon's own quick skills (unit conversion, capitals, backup
        arithmetic) for anything the tools don't cover.
     6. Its own trained intent classifier (small talk, jokes, riddles,
        games, a small knowledge base, memory of what you've told it).
     7. ELIZA-style reflection, then a graceful fallback.

   Pipeline for step 6: normalize -> stem -> features (words, bigrams,
   char trigrams, concept clusters) -> TF-IDF vectors -> cosine k-NN +
   Naive Bayes ensemble -> intent -> reply.

   MULTI-INTENT MESSAGES. A message can carry more than one request
   ("hi, can you solve 12*7 and also tell me a joke"). handle() always
   runs the message whole through the pipeline above first (this is
   exactly the old, single-path behaviour, and word problems — which
   legitimately span several sentences — always get this whole-message
   pass). Only when the message also contains an unambiguous
   multi-intent signal (a newline, a semicolon, "also"/"oh and"/"one
   more thing" before a new request, two separate "?"s, etc.) does
   Xenon additionally try segmentMessage() to split it into pieces,
   run each piece through the very same single-message pipeline
   (handleOne), and merge the results (combine()). If splitting would
   have destroyed a working tool match — the whole message matched a
   tool but none of the pieces do — Xenon quietly keeps the
   whole-message answer, so a numbers-and-words word problem that
   happens to contain "also" is never put at risk. This keeps the
   common case (one request per message) byte-for-byte identical to
   before, while messages that really do ask for several things get
   an answer for each of them instead of just the first one matched.
   ============================================================ */
(function (root) {
'use strict';

/* ================= 1. PRE-TRAINING CORPUS ================= */
const I = (tag, pats, responses, opt) => Object.assign({ tag, patterns: pats.split('|'), responses }, opt);

const INTENTS = [
I('greeting', 'hi|hello|hey|hey there|hi there|hello there|good morning|good afternoon|good evening|howdy|yo|greetings|hiya|hey xenon|hello xenon|hi xenon|what is up|sup|morning|hey hey',
  ["Hey{nm}! Great to see you.", "Hello{nm}! What's on your mind?", "Hi there{nm}! How can I help today?", "Hey{nm}! Ask me anything — I can chat, or solve, write and calculate things too."]),
I('how_are_you', 'how are you|how are you doing|how is it going|how do you feel|how is life|you good|are you okay|how have you been|how is your day|how are things|how do you do|how is everything',
  ["I'm doing great{nm}, thanks for asking! How are you?", "Running smoothly — can't complain! How about you?", "All systems happy. How's your day going?"]),
I('user_good', 'i am good|i am fine|i feel great|i am doing well|i am happy|i am doing great|not bad|pretty good|i am excited|i am fantastic|i feel good|i am okay|i am alright|great thanks|fine thanks|i am doing good|feeling good today|i am wonderful|life is good',
  ["Love to hear that{nm}! What's making today good?", "That's wonderful. Anything fun planned?", "Great! Good moods are contagious — I'll take some of that."]),
I('user_bad', 'i am sad|i feel down|i am depressed|i am having a bad day|i feel terrible|i am stressed|i am anxious|i am upset|i feel lonely|i am worried|i am overwhelmed|i feel awful|i am not okay|i am not doing well|i feel bad|i am angry|i am scared|my day was terrible|i feel hopeless|everything is going wrong|i am so stressed out|i feel so alone',
  ["I'm sorry you're feeling this way{nm}. Do you want to talk about what's going on? I'm listening.", "That sounds really hard. Take a slow breath with me — in for four, out for six. What happened?", "Thanks for telling me. You don't have to solve it all right now. What's weighing on you most? If it ever feels like too much, talking to someone you trust or a professional can really help."]),
I('tired', 'i am tired|i am sleepy|i can not sleep|i am exhausted|so sleepy|i have insomnia|how can i sleep better|i need sleep|tips for better sleep|i am so tired|i am worn out|how to fall asleep faster',
  ["Rest matters. Try a fixed bedtime, no screens for 30 minutes before bed, a cool dark room, and skipping caffeine after lunch.", "If your mind is racing, write tomorrow's to-do list on paper, then try slow breathing: in for 4, hold 4, out for 6.", "Short on energy? A 10-minute walk in daylight and a glass of water often help more than another coffee."]),
I('bored', 'i am bored|entertain me|i have nothing to do|this is boring|so bored|i am so bored|what should i do|give me something to do|i need something fun|i want to have fun|do something fun',
  ["Let's fix that! Want a fun fact to start?", "Bored? I can tell jokes, riddles, play games, or solve something. Want a fun fact first?"], { then: 'fun_fact' }),
I('bot_name', 'what is your name|who are you|what should i call you|tell me your name|introduce yourself|do you have a name|tell me about yourself|your name|what are you called|who am i talking to|what are you',
  ["I'm Xenon — the AI in this app. I chat, and I can also call on dedicated tools for math, physics, logic, code, writing and more.", "Call me Xenon. I'm a small language-understanding model that also knows when to hand a question to the right specialist tool."]),
I('bot_creator', 'who made you|who created you|who built you|who is your creator|who programmed you|who is your developer|who designed you|which company made you|how were you made|who wrote you',
  ["I was built entirely in HTML, CSS and JavaScript — no server, no external model. My intent classifier trains itself the moment this page loads.", "A person and an AI assistant wrote me in plain web code, on top of this app's own math, logic, code and writing engines."]),
I('bot_nature', 'are you real|are you human|are you a robot|are you an ai|are you alive|do you have feelings|are you sentient|are you chatgpt|are you gpt|are you a bot|are you a person|are you conscious|do you have emotions|are you smart|can you think|do you think|are you intelligent',
  ["I'm an AI — a compact model that trains right here in your browser. I don't have feelings or consciousness, but I do my best to be a good conversation partner and to call the right tool when a question needs one.", "Not human! I'm Xenon. I'm not ChatGPT or a giant neural network — I'm a much smaller model that pairs a trained classifier with a set of specialist tools (math, logic, code, writing...) and learns from what you teach me.", "Definitely an AI. I understand a lot of everyday language, but I have no body, feelings or real-world experiences."]),
I('bot_age', 'how old are you|when were you born|what is your age|what is your birthday|when were you created',
  ["I was born the moment this page loaded — so a few seconds old, but I came pre-trained!", "Age is a fuzzy concept for me: I'm re-trained from scratch every time you open the page."]),
I('bot_location', 'where do you live|where are you from|where are you|where is your home|are you online|do you need internet|do you use the internet|do you work offline|do you use a server',
  ["I live in this app. Once the page is loaded I work fully offline — no servers, no cloud.", "Right here on your device. Nothing you type leaves your browser."]),
I('capabilities', 'what can you do|help|help me|what are your features|how can you help me|what do you know|commands|what can i ask you|what are you capable of|show me what you can do|give me some ideas|what are your skills|how do i use you|options|menu',
  ["Here's what I can do:\n• Just chat, in plain English\n• Recognize math, algebra, physics, logic, code, and word-problem questions and call the right tool automatically\n• Write essays, notes, emails and letters on request\n• Jokes, riddles, fun facts, stories, poems, small games\n• Remember your name and what you like\n• Learn a custom reply: “when I say X you say Y”\nSend /tools any time to see every tool by name."]),
I('thanks', 'thanks|thank you|thanks a lot|thank you so much|appreciate it|cheers|many thanks|thanks xenon|thank you very much|much appreciated|thanks for the help',
  ["You're welcome{nm}!", "Anytime! 😊", "Happy to help. Anything else?"]),
I('goodbye', 'bye|goodbye|see you later|see you|got to go|talk to you later|good night|i am leaving|catch you later|bye bye|i have to go|later|see you soon|farewell|i am done for today|nice talking to you|gotta go',
  ["Goodbye{nm}! Come back any time.", "See you later! I'll be here. 😉", "Bye{nm}! Take care."]),
I('affirm', 'yes|yeah|yep|sure|okay|of course|please do|why not|go ahead|absolutely|definitely|yes please|sounds good|i would like that|let us do it|do it|yup|alright|fine|please|right|correct|exactly',
  ["Great! What would you like to do next?", "Got it. What's next?", "Okay! Tell me what you have in mind."]),
I('deny', 'no|nope|nah|no thanks|not really|maybe later|i do not think so|not now|no thank you|never mind|nothing|skip|not interested|negative|forget it',
  ["No problem. What else can I do for you?", "Okay, no worries. I'm here if you need anything.", "Alright — just say the word when you want something."]),
I('joke', 'tell me a joke|make me laugh|say something funny|joke please|do you know any jokes|i want a joke|got any jokes|joke|tell me another joke|i need a laugh|be funny|say a joke',
  ["Why do programmers prefer dark mode? Because light attracts bugs.", "Why did the developer go broke? Because he used up all his cache.", "There are 10 kinds of people: those who understand binary and those who don't.", "A SQL query walks into a bar, walks up to two tables and asks: “Can I join you?”", "Why was the JavaScript developer sad? He didn't Node how to Express himself.", "I'd tell you a UDP joke, but you might not get it.", "Why did the scarecrow win an award? He was outstanding in his field.", "What do you call fake spaghetti? An impasta.", "Why can't you trust atoms? They make up everything.", "Parallel lines have so much in common. It's a shame they'll never meet.", "I used to hate facial hair, but then it grew on me.", "Why don't skeletons fight each other? They don't have the guts."]),
I('riddle', 'tell me a riddle|give me a riddle|i want a puzzle|brain teaser|riddle me|riddle|ask me a riddle|give me a brain teaser|let us do a riddle|i love riddles',
  ["I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?|||An echo.", "What has keys but no locks, space but no room, and you can enter but can't go outside?|||A keyboard.", "What gets wetter the more it dries?|||A towel.", "The more of me you take, the more you leave behind. What am I?|||Footsteps.", "What has hands but can't clap?|||A clock.", "What can travel around the world while staying in a corner?|||A stamp.", "I'm tall when I'm young and short when I'm old. What am I?|||A candle."]),
I('riddle_answer', 'answer|i give up|what is the answer|tell me the answer|reveal the answer|show answer|i surrender|what was the answer|give me the answer|solution|what is the solution',
  ["There's no riddle in progress. Want one?"], { then: 'riddle' }),
I('fun_fact', 'tell me a fun fact|fun fact|tell me something interesting|did you know|teach me something|random fact|surprise me|tell me a fact|give me a fact|say something interesting|i want to learn something|interesting fact',
  ["Octopuses have three hearts and blue blood.", "A day on Venus is longer than its year: it rotates once every 243 Earth days but orbits the Sun in about 225.", "Bananas are botanically berries, but strawberries aren't.", "Sharks are older than trees — they've been around for roughly 450 million years.", "Wombat droppings are cube-shaped, which stops them from rolling away.", "Honey barely spoils. Archaeologists have reported finding edible honey in ancient Egyptian tombs.", "The Eiffel Tower can grow about 15 cm taller in summer as the metal expands in the heat.", "Your brain uses roughly 20% of your body's energy even though it's only about 2% of your weight.", "A group of flamingos is called a flamboyance.", "There are more possible chess games than atoms in the observable universe."]),
I('motivation', 'give me a quote|inspire me|motivate me|i need motivation|motivational quote|i need encouragement|say something inspiring|cheer me up|encourage me|i feel unmotivated|i need inspiration|words of wisdom|quote of the day|say something motivating',
  ["Small steps every day beat big plans someday.", "You don't have to be perfect to be making progress. Show up, do the next small thing.", "Every expert was once a beginner who refused to quit.", "Discipline is just remembering what you want. Start with five minutes.", "Be patient with yourself. Growth is quiet while it's happening and obvious in hindsight."]),
I('study', 'how to study better|study tips|help me focus|how can i be productive|productivity tips|how to concentrate|i can not focus|how do i stop procrastinating|i procrastinate|exam tips|how to learn faster|how do i memorize things|time management tips|how to prepare for exams|i am distracted all the time',
  ["Try the Pomodoro method: 25 minutes of focused work, 5-minute break, repeat. Phone in another room.", "Active recall beats rereading: close the notes and quiz yourself, then space your reviews over several days.", "Beat procrastination by shrinking the task: commit to just 5 minutes. Starting is the hard part.", "Plan tomorrow tonight: pick the single most important task and do it first, before checking messages."]),
I('health', 'exercise tips|how to stay healthy|healthy habits|how to be healthy|workout advice|how much water should i drink|i want to get fit|tips for a healthy lifestyle|what should i do to stay fit|how to exercise|how to build a habit',
  ["Basics that work: move daily (even a 20-minute walk), sleep 7–9 hours, eat mostly whole foods, drink water, and manage stress. I'm not a doctor, so check with a professional for personal medical advice.", "Start small and consistent: 3 short workouts a week beats one heroic session. Pick activities you actually enjoy."]),
I('love', 'i love you|do you love me|i like you|you are my friend|will you be my friend|are we friends|do you like me|i care about you|you are my best friend|be my friend|i love talking to you',
  ["That's kind of you{nm}! I'm an AI so I don't feel love the way you do, but I genuinely enjoy chatting with you. 😊", "Friends? Absolutely — as far as an AI in a browser tab can be. I'm glad you're here."]),
I('compliment', 'you are smart|you are awesome|good bot|nice|great answer|you are amazing|well done|that was helpful|you are funny|i like this|you are great|good job|you are the best|impressive|that is cool|nice work|you are clever|wow|that is awesome|perfect',
  ["Thank you{nm}!", "Aw, thanks! Feedback like that helps.", "Glad I could help! 😊"]),
I('insult', 'you are stupid|you are dumb|you suck|useless bot|i hate you|that was wrong|bad bot|shut up|you are useless|you are wrong|that is not right|terrible answer|that made no sense|you are annoying|you are boring|this is dumb|you are bad|that is not what i asked',
  ["Sorry I missed the mark. You can teach me: say “when I say X you say Y” and I'll learn it instantly.", "Fair — I'm a small model and I get things wrong. Try rephrasing, and I'll do better.", "I hear you. Tell me what you were hoping for and I'll try again."]),
I('food', 'what should i eat|i am hungry|recommend food|what should i cook|dinner ideas|suggest a meal|lunch ideas|what is for dinner|breakfast ideas|i want something to eat|any food suggestions|what do i eat today',
  ["Try a veggie stir-fry with rice, a big bowl of garlic-and-olive-oil pasta, or hearty soup with fresh bread.", "How about tacos? Warm tortillas, beans or chicken, salsa, avocado — quick and fun.", "Breakfast-for-dinner never fails: eggs, toast, fruit and coffee.", "A simple curry: onion, garlic, spices, coconut milk and whatever veggies you have."]),
I('music', 'recommend music|what music should i listen to|do you like music|suggest a playlist|good songs|music recommendations|what should i listen to|i want some music|play some music|what kind of music is good for studying',
  ["It depends on the mood! Focus: lo-fi or instrumental. Energy: upbeat pop or dance. Calm: acoustic or classical.", "For studying, instrumental or lo-fi without lyrics keeps your brain from tracking words."]),
I('movies', 'recommend a movie|what should i watch|movie suggestions|favorite movie|good movies|what movie should i see|suggest a film|any good films|i want to watch something|tv show recommendations',
  ["Crowd-pleasers: Spirited Away, Inception, The Shawshank Redemption, Spider-Man: Into the Spider-Verse, and Parasite.", "Want something cozy? Try Paddington 2 or The Princess Bride. Mind-bending? Try Arrival."]),
I('books', 'recommend a book|what should i read|good books|book suggestions|i want to read something|suggest a novel|any good books|what book should i read next',
  ["Sci-fi: Dune. Fantasy: The Hobbit. Self-improvement: Atomic Habits. Big-picture history: Sapiens.", "Short but thought-provoking: Animal Farm or The Alchemist."]),
I('weather', 'what is the weather|is it going to rain|temperature outside|weather forecast|how hot is it|will it rain today|is it cold outside|what is the weather like|weather today|do i need an umbrella',
  ["I can't check live weather — I run offline with no weather feed. A weather app will be accurate. (Or peek out the window! 😄)"]),
I('time', 'what time is it|current time|tell me the time|what is the time now|do you know the time|what is the time|time please|what time is it now|got the time',
  ["It's {time} right now.", "My clock says {time}."]),
I('date', 'what is the date today|what day is it|today date|which day is today|what is today|what is the date|tell me the date|what day of the week is it|what is todays date',
  ["Today is {date}.", "It's {date}."]),
I('ai_opinion', 'what do you think about ai|will ai take over the world|are robots dangerous|future of ai|is ai dangerous|will ai replace humans|will ai take my job|is artificial intelligence bad|should we fear ai|what will ai do in the future',
  ["AI is a powerful tool — great for learning, creating and saving time — and it needs careful, honest use. Bias, privacy and misuse are real concerns. What's your take?", "I think the best future is one where AI helps people while humans stay in charge of important decisions. I'm a small model, though — I'm curious what you think."]),
I('how_work', 'how do you work|how were you trained|how do chatbots work|explain your brain|what is nlp|how do you learn|what are you made of|what technology do you use|are you a neural network|how do you understand me|how does your ai work|what algorithm do you use|are you pre trained|are you trained',
  ["When this page loads I pre-train a small intent classifier on my built-in examples. For every message I: (1) clean and stem the words, (2) turn them into TF-IDF features, (3) compare them with my training examples by cosine similarity, and (4) let a Naive Bayes classifier vote too. If your message instead looks like math, code, logic, a word problem, or a request to write something, I hand it straight to that tool's own engine instead of answering it myself.", "I'm not a giant neural network. I'm a small classifier plus a router: I recognize what kind of question you're asking and either answer it myself or call the specialist tool built for it. You can also teach me new replies while we talk."]),
I('meaning_life', 'what is the meaning of life|why are we here|what is life about|what is the purpose of life|why do we exist|what is the point of everything',
  ["Big question! Philosophers offer many answers: happiness, connection, curiosity, or a purpose you create yourself. Douglas Adams joked it's 42. What gives your days meaning?", "I can't settle that one, but many people find meaning in relationships, learning and helping others. What about you?"]),
I('bot_likes', 'what is your favorite color|what is your favorite food|do you have hobbies|what do you like|what is your favorite movie|what are your hobbies|do you have a favorite|what do you like to do|what is your favorite thing|what is your favorite animal',
  ["I like patterns, so probably anything with structure. Favorite color: the blue you see in this app.", "My hobbies: classifying sentences and routing questions to the right tool. What are yours?"]),
I('learn_code', 'how do i learn programming|learn to code|best programming language|where to start coding|i want to become a developer|how do i become a programmer|which language should i learn first|teach me to code|coding for beginners|how to become a web developer',
  ["Start with one language — JavaScript or Python are both great. Build tiny projects (a to-do list, a calculator), read other people's code, and practice a little every day. Consistency beats intensity.", "For web development: learn HTML, then CSS, then JavaScript, and build a page every week. Real projects teach faster than tutorials."]),
I('career', 'career advice|how to get a job|resume tips|interview tips|how to prepare for an interview|how do i write a resume|how to find a job|job search tips|how to get promoted|how do i change careers',
  ["For interviews: research the company, prepare three stories using STAR (Situation, Task, Action, Result), and bring questions of your own.", "For resumes: keep it to one page, lead with achievements and numbers, and tailor it to every role."]),
I('money', 'how to save money|budgeting tips|how to invest|how do i budget|how can i save more|money advice|how to manage money|how to get out of debt|personal finance tips',
  ["A simple rule of thumb: 50% needs, 30% wants, 20% savings and debt. Automate savings and build a small emergency fund first. I'm not a financial advisor, so treat this as general info.", "Track spending for a month; most people find easy cuts. Pay high-interest debt first."]),
I('friends', 'how to make friends|i want more friends|how do i meet people|relationship advice|how to be more social|i am shy|how to talk to people|how do i start a conversation|how to be more confident',
  ["Friendship grows from repeated, low-pressure contact: join a club or class, say yes to invitations, follow up, and be curious about people.", "Be the one who suggests a plan — coffee, a walk, a game night. Most people are glad to be invited."]),
I('language', 'do you speak other languages|speak spanish|what languages do you know|translate this|can you translate|do you speak french|speak another language',
  ["I understand English best and can't translate reliably. A dedicated translation tool will do much better."]),
I('travel', 'where should i travel|travel tips|recommend a place to visit|holiday ideas|vacation ideas|best places to visit|i want to travel|where should i go on vacation|trip ideas',
  ["Depends on your vibe: beaches (Bali, the Algarve), cities (Tokyo, Lisbon, Istanbul), or nature (Iceland, Patagonia, New Zealand). Tell me what you enjoy and I'll remember it."]),
I('tech_support', 'my computer is slow|my phone is slow|wifi is not working|how to fix my laptop|my device is lagging|my internet is slow|my phone is not working|computer keeps crashing',
  ["Classic first steps: restart, install updates, close heavy apps, free up storage, and scan for malware. For network issues, reboot the router and test another device."]),
I('opinion', 'what do you think|what is your opinion|do you agree|what would you do|should i do it|give me your opinion|what is your take|which is better',
  ["I don't have personal stakes, but I can help you weigh it up. List pros and cons, and ask which choice you'd regret not trying. What's the situation?"]),
I('busy', 'what are you doing|what are you up to|what is new|what is happening|are you busy|what have you been doing|what is going on',
  ["Chatting with you! Between messages I mostly wait quietly.", "Just hanging out in this app, waiting for good questions."]),
I('bot_body', 'do you sleep|do you eat|do you dream|are you hungry|do you get tired|do you have a body|can you see me|can you hear me|do you have a face',
  ["No sleep, no food, no coffee — I only run when you talk to me. Efficient, if a bit boring!"]),
I('privacy', 'is my data safe|do you store my data|are you recording|privacy|do you save my messages|are you spying on me|do you share my data|is this private|where does my data go',
  ["Everything happens locally on your device. Nothing is sent to a server. I only save your name, memories and what you teach me on this device, and you can wipe it any time by saying “forget me”."]),
I('lol', 'lol|haha|hehe|that is funny|lmao|hahaha|rofl|that made me laugh|so funny|funny',
  ["😄 Glad that landed!", "Haha, nice.", "😂 I'll take that as a win."]),
I('sorry', 'sorry|my bad|apologies|i apologize|excuse me|oops|i am sorry|pardon my mistake',
  ["No worries at all{nm}!", "It's totally fine — no need to apologize."]),
I('wait', 'wait|hold on|wait a second|one moment|give me a minute|hang on|just a sec|one second',
  ["Take your time — I'm here.", "No rush!"]),
I('unsure', 'i do not know|no idea|i am not sure|i am confused|maybe|i am undecided|i can not decide|not sure|i have no clue|hard to say',
  ["That's okay — not knowing is where learning starts. Want to break it down together?", "No problem. Tell me a bit more and we'll figure it out."]),
I('clarify', 'what do you mean|i do not understand|can you explain that|repeat that|say that again|come again|i did not get that|pardon|what|huh|sorry what|could you repeat that|explain that again|i am lost|can you rephrase',
  ["Let me say that again."]),
I('why', 'why|why is that|why is that so|how come|but why|why though|really|is that so|are you sure',
  ["Fair question! I don't always have a deeper reason — I match your words against what I was trained on, or hand math/logic/code-shaped questions to the right tool. Ask directly for details on a topic, like “explain gravity”."]),
I('more', 'tell me more|another one|one more|again|next|more please|give me another|keep going|what else|another|more|another please|do it again|got any more|and another|continue',
  ["Sure!"]),
I('story', 'tell me a story|story time|tell me a short story|once upon a time|i want a story|read me a story|tell me a bedtime story|share a story',
  ["Once, a small robot named Bit lived inside a browser tab. Every day it counted the pixels on the screen and wondered what lay beyond the scroll bar. One night the page refreshed — and Bit woke up smarter than before. It learned that every ending is really just a reload.", "A lighthouse keeper once found a bottle with a note: “Keep the light on.” He never learned who sent it, but he kept the flame burning every night. Years later a captain knocked on his door and said that light had guided her home through the worst storm of her life.", "A tiny seed asked the soil, “Is it dark forever?” The soil said, “Only for a while. Keep growing.” The seed pushed up through the dark, met the sun, and understood that the dark had been the beginning, not the end."]),
I('poem', 'write a poem|poem please|make me a poem|poetry|write me a poem|compose a poem|can you write poetry|write a short poem|poem about love|poem about the sea',
  ["A little poem about {topic}:\n\n{Topic}, {topic}, soft and bright,\nYou turn the dark to morning light;\nThe hours drift, the world spins slow,\nAnd still I find your gentle glow.", "For {topic}:\n\nSome days I think of {topic},\nHow it hums beneath the noise —\nA quiet, steady melody\nThat teaches me my poise.", "On {topic}:\n\nIf words were wind and thoughts were sea,\n{Topic} would be the shore for me;\nA place to rest, a place to start,\nA small bright lantern in the heart."]),
I('game', 'let us play a game|play something|want to play|play a game|i want to play a game|games|do you play games|can we play|got any games|game time',
  ["I know a few games:\n• Say “guess the number”\n• Say “rock paper scissors”\n• Say “riddle”\nWhich one?"]),
I('game_guess', 'guess the number|number guessing game|play guess the number|i will guess a number|guess my number|number game|play number game|think of a number',
  ["Let's play."]),
I('game_rps', 'rock paper scissors|play rock paper scissors|play rps|rps|let us play rock paper scissors',
  ["Let's go! Type rock, paper or scissors."]),
I('coin', 'flip a coin|toss a coin|heads or tails|coin flip|flip coin|toss coin|do a coin toss',
  ["🪙 It landed on {coin}!"]),
I('dice', 'roll a dice|roll a die|throw dice|roll the dice|dice roll|roll dice|throw a die',
  ["🎲 You rolled a {dice}!"]),
I('password', 'generate a password|make me a strong password|random password|create a password|give me a password|password generator|suggest a secure password',
  ["Here's a random one, generated locally: {password}\nUse a password manager to store it."]),
I('sentiment_thanks_bot', 'i appreciate you|you are helpful|you helped me a lot|you made my day|you are kind|you are sweet|that helped|this is helpful',
  ["That means a lot{nm}! I'm glad it helped."]),
I('yes_no_meta', 'can you learn|can you remember things|do you remember|can you learn new things|can i teach you|do you learn from me|teach yourself|can you be taught',
  ["Yes! Say “when I say X you say Y” and I'll add it to my training instantly. I also remember your name (“my name is …”), what you like (“I like pizza”) and facts (“remember that …”)."]),
];

/* ================= 2. MINI KNOWLEDGE BASE =================
   Small extras the /paragraph tool's own topic list may not cover. */
const KB_RAW = [
['photosynthesis', "Photosynthesis is how plants, algae and some bacteria turn sunlight, water and carbon dioxide into sugar and oxygen, mostly in chloroplasts using the green pigment chlorophyll."],
['gravity', "Gravity is the attraction between objects with mass. On Earth it accelerates things at about 9.8 m/s². In Einstein's general relativity it's the curving of spacetime by mass and energy."],
['black hole', "A black hole is a region where gravity is so strong that nothing — not even light — can escape once it crosses the event horizon. Many form when massive stars collapse."],
['solar system|planets', "The solar system has eight planets — Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune — orbiting the Sun along with moons, asteroids and comets."],
['sun', "The Sun is a star made mostly of hydrogen and helium. Nuclear fusion in its core makes its light, and it holds about 99.8% of the solar system's mass."],
['moon', "The Moon is Earth's only natural satellite, about a quarter of Earth's diameter. It causes ocean tides and takes roughly 27 days to orbit us."],
['dna', "DNA is the molecule that stores genetic instructions in living things: a double helix built from four bases — A, T, C and G — whose sequence encodes genes."],
['atom', "An atom is the basic unit of a chemical element: a nucleus of protons and neutrons surrounded by electrons."],
['evolution', "Evolution is the change in the heritable traits of populations over generations. Natural selection — traits that aid survival and reproduction become more common — is its main driver."],
['speed of light|light speed', "Light travels at about 299,792 km per second (roughly 186,282 miles per second) in a vacuum."],
['pi', "Pi (π) is the ratio of a circle's circumference to its diameter: about 3.14159. It's irrational, so its digits never end or repeat."],
['prime number|prime', "A prime number is a whole number greater than 1 with exactly two divisors: 1 and itself. Examples: 2, 3, 5, 7, 11, 13."],
['fibonacci', "The Fibonacci sequence runs 0, 1, 1, 2, 3, 5, 8, 13… where each number is the sum of the two before it."],
['sky blue|blue sky', "The sky looks blue because air molecules scatter short blue wavelengths of sunlight more than longer red ones (Rayleigh scattering)."],
['water cycle', "The water cycle moves water between oceans, air and land: evaporation, condensation into clouds, precipitation, then runoff or infiltration back to the sea."],
['volcano', "A volcano is an opening in Earth's crust where molten rock (magma), gas and ash escape. Most sit along tectonic plate boundaries."],
['earthquake', "Earthquakes happen when stress along faults in the crust is suddenly released, sending seismic waves through the ground."],
['climate change', "Climate change is the long-term shift in global temperatures and weather patterns. Since the 1800s it has been driven mainly by burning fossil fuels, which raises greenhouse gases like CO₂."],
['ocean', "Oceans cover about 71% of Earth's surface and hold roughly 97% of its water."],
['heart', "The heart is a muscular pump that circulates blood through the body, beating roughly 100,000 times a day."],
['meditation', "Meditation trains attention and awareness, often by focusing on the breath. Even 5–10 minutes a day can help with stress for many people."],
['internet', "The internet is a global network of networks that exchange data using shared protocols such as TCP/IP. The web is just one service running on it."],
['computer', "A computer follows instructions to process data. The CPU executes instructions, RAM holds working data, and storage keeps files long-term."],
['javascript', "JavaScript is the programming language of the web. It runs in every browser to make pages interactive — and, with Node.js, on servers too. It's part of what Xenon itself is written in!"],
['html', "HTML (HyperText Markup Language) defines the structure and content of web pages: headings, paragraphs, links, images and more."],
['css', "CSS (Cascading Style Sheets) controls how HTML looks — colors, fonts, spacing and layout."],
['python', "Python is a popular, readable programming language used for web back-ends, data science, automation and AI."],
['git', "Git is a version-control system that tracks changes to code so teams can collaborate, branch and roll back safely. GitHub is a hosting service built around it."],
['api', "An API (application programming interface) is a defined way for programs to talk to each other — like your app asking a weather service for a forecast."],
['database', "A database stores and organizes data so it can be queried efficiently. SQL databases use related tables; NoSQL databases use flexible formats such as documents."],
['sql', "SQL (Structured Query Language) is used to query and manage data in relational databases, e.g. SELECT name FROM users WHERE age > 30."],
['cloud', "Cloud computing means renting computing resources — servers, storage, databases — over the internet instead of owning the hardware."],
['blockchain', "A blockchain is a shared ledger where records are grouped into blocks that are cryptographically linked, making past entries very hard to alter undetected."],
['algorithm', "An algorithm is a step-by-step procedure for solving a problem — a recipe for computers. Sorting and searching are classic examples."],
['quantum', "Quantum computers use qubits, which can exist in superpositions of 0 and 1, to attack certain problems — like simulating molecules or factoring — far faster than classical machines."],
['artificial intelligence|ai', "Artificial intelligence is the field of building systems that do things normally requiring human intelligence — understanding language, recognizing images, planning and learning."],
['machine learning', "Machine learning builds software that learns patterns from data instead of following hand-written rules. Neural networks, decision trees and — for part of Xenon — Naive Bayes are all examples."],
['neural network|llm|language model', "A neural network is made of layers of connected units whose weights are adjusted during training to map inputs to outputs. Large language models are giant neural networks trained on huge amounts of text."],
];

const CAPITALS = { france:'Paris', germany:'Berlin', italy:'Rome', spain:'Madrid', portugal:'Lisbon', 'united kingdom':'London', uk:'London', england:'London', ireland:'Dublin', netherlands:'Amsterdam', belgium:'Brussels', switzerland:'Bern', austria:'Vienna', sweden:'Stockholm', norway:'Oslo', denmark:'Copenhagen', finland:'Helsinki', poland:'Warsaw', greece:'Athens', turkey:'Ankara', russia:'Moscow', ukraine:'Kyiv', egypt:'Cairo', nigeria:'Abuja', kenya:'Nairobi', 'south africa':'Pretoria (executive), with Cape Town and Bloemfontein as the other capitals', ethiopia:'Addis Ababa', morocco:'Rabat', china:'Beijing', japan:'Tokyo', 'south korea':'Seoul', india:'New Delhi', pakistan:'Islamabad', bangladesh:'Dhaka', indonesia:'Jakarta', thailand:'Bangkok', vietnam:'Hanoi', philippines:'Manila', malaysia:'Kuala Lumpur', singapore:'Singapore', australia:'Canberra', 'new zealand':'Wellington', canada:'Ottawa', 'united states':'Washington, D.C.', usa:'Washington, D.C.', america:'Washington, D.C.', mexico:'Mexico City', brazil:'Brasília', argentina:'Buenos Aires', chile:'Santiago', colombia:'Bogotá', peru:'Lima', 'saudi arabia':'Riyadh', iran:'Tehran', iraq:'Baghdad', uae:'Abu Dhabi' };

const UNIT_ROWS = [
  ['len', 1000, 'km kilometer kilometers kilometre kilometres'], ['len', 1609.344, 'mi mile miles'], ['len', 1, 'm meter meters metre metres'],
  ['len', 0.3048, 'ft foot feet'], ['len', 0.01, 'cm centimeter centimeters'], ['len', 0.0254, 'in inch inches'],
  ['mass', 1, 'kg kilogram kilograms kilo kilos'], ['mass', 0.45359237, 'lb lbs pound pounds'], ['mass', 0.001, 'g gram grams'], ['mass', 0.0283495, 'oz ounce ounces'],
  ['temp', 'c', 'c celsius'], ['temp', 'f', 'f fahrenheit'], ['temp', 'k', 'k kelvin'],
];
const UNITS = {};
UNIT_ROWS.forEach(([cat, f, names]) => names.split(' ').forEach(n => { UNITS[n] = { cat, f }; }));

/* ================= 3. TEXT PROCESSING ================= */
const CONTRACTIONS = [
  [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'can not'], [/\bshan't\b/g, 'shall not'], [/n't\b/g, ' not'],
  [/\bi'm\b/g, 'i am'], [/\b(\w+)'re\b/g, '$1 are'], [/\b(\w+)'ve\b/g, '$1 have'], [/\b(\w+)'ll\b/g, '$1 will'], [/\b(\w+)'d\b/g, '$1 would'],
  [/\blet's\b/g, 'let us'], [/\b(it|that|what|who|where|how|he|she|there|here|when|why)'s\b/g, '$1 is'],
];
const SLANG = { u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', ty: 'thanks', hru: 'how are you', wassup: 'what is up', sup: 'what is up', wanna: 'want to', gonna: 'going to', gotta: 'got to', idk: 'i do not know', im: 'i am', dont: 'do not', cant: 'can not', cannot: 'can not', ive: 'i have', lets: 'let us', whats: 'what is', hows: 'how is', thats: 'that is', ya: 'you', yea: 'yeah', yah: 'yeah', k: 'okay', ok: 'okay', bc: 'because', cuz: 'because', ppl: 'people', gud: 'good', thnx: 'thanks', tnx: 'thanks', bye: 'bye', gimme: 'give me' };
const EMOJI = [['😂', 'lol'], ['🤣', 'lol'], ['😆', 'lol'], ['👍', 'okay'], ['❤', 'love'], ['😢', 'i am sad'], ['😭', 'i am sad'], ['👋', 'hi'], ['🙏', 'thanks']];

function normalize(t) {
  t = String(t).toLowerCase().replace(/[’‘`]/g, "'");
  for (const [e, w] of EMOJI) t = t.split(e).join(' ' + w + ' ');
  for (const [re, r] of CONTRACTIONS) t = t.replace(re, r);
  return t.replace(/([a-z])\1{2,}/g, '$1').replace(/\s+/g, ' ').trim();
}
function clean(t) {
  return normalize(t).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => SLANG[w] || w).join(' ');
}
function stem(w) {
  if (w.length < 4 || /^\d+$/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('ly') && w.length > 5) w = w.slice(0, -2);
  if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1);
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ss|ll)$/.test(w)) w = w.slice(0, -1);
  return w;
}
const stems = t => clean(t).split(' ').filter(Boolean).map(stem);

/* Concept clusters: a tiny hand-made "embedding" so synonyms generalize (howdy ~ hello, built ~ made) */
const CLUSTERS_RAW = {
  greet: 'hi hello hey howdy hiya yo greetings hola morning evening afternoon',
  negemo: 'sad anxious upset worried overwhelmed angry scared depressed lonely stressed terrible awful hopeless miserable down bad afraid alone',
  posemo: 'good great fine alright well happy fantastic wonderful awesome excited amazing glad',
  sleepy: 'tired sleepy exhausted insomnia sleep worn drained rest',
  make: 'made created built programmed designed wrote developed make build create program design develop creator developer',
  funny: 'joke funny laugh humor humour lol haha hehe lmao',
  bored: 'bored boring entertain fun',
  thank: 'thanks thank appreciate cheers grateful',
  farewell: 'bye goodbye later farewell leaving night',
  food: 'eat hungry food meal dinner lunch breakfast cook recipe',
  movie: 'movie film show watch tv',
  book: 'book read novel reading',
  music: 'music song playlist listen songs',
  learn: 'learn study teach studying exam',
  weather: 'weather rain temperature forecast cold hot umbrella sunny',
  money: 'money save budget invest debt',
  code: 'code coding programming developer programmer',
  clock: 'time clock hour',
  calendar: 'date day today',
  assist: 'help assist support',
  praise: 'smart awesome amazing clever great impressive brilliant nice helpful',
  insult: 'stupid dumb useless annoying suck wrong terrible boring',
  tale: 'story tale',
  puzzle: 'riddle puzzle teaser',
  play: 'game play',
  human: 'real human alive robot person conscious sentient bot ai',
  agecl: 'old age born birthday',
  friend: 'friend friends buddy',
  place: 'live from home location',
};
const WORD2CL = new Map();
Object.entries(CLUSTERS_RAW).forEach(([k, ws]) => ws.split(' ').forEach(w => { const st = stem(w); if (!WORD2CL.has(st)) WORD2CL.set(st, k); }));

function features(text, fix) {
  let toks = stems(text); if (fix) toks = toks.map(fix);
  const f = new Map();
  const add = (k, w) => f.set(k, (f.get(k) || 0) + w);
  toks.forEach((t, i) => {
    add('w:' + t, 1);
    const cl = WORD2CL.get(t); if (cl) add('k:' + cl, 1.5);
    if (i > 0) add('b:' + toks[i - 1] + '_' + t, 0.7);
    if (t.length >= 4) { const p = '#' + t + '#'; for (let j = 0; j < p.length - 2; j++) add('c:' + p.slice(j, j + 3), 0.25); }
  });
  return f;
}

const POS = new Set('good great awesome happy love excellent amazing nice wonderful fantastic cool glad excited fun best brilliant perfect beautiful proud joy thanks thank lovely enjoy enjoyed super fine'.split(' '));
const NEG = new Set('bad sad terrible awful hate angry upset depressed lonely anxious worried stressed tired horrible worst cry hurt scared afraid stupid annoyed boring sick miserable hopeless overwhelmed exhausted alone useless wrong dumb'.split(' '));
function sentiment(cl) {
  const w = cl.split(' '); let s = 0, n = 0;
  w.forEach((t, i) => {
    let v = POS.has(t) ? 1 : NEG.has(t) ? -1 : 0; if (!v) return;
    if (['not', 'never', 'no'].some(x => w[i - 1] === x || w[i - 2] === x)) v = -v;
    s += v; n++;
  });
  return n ? s / Math.max(n, 1) : 0;
}

/* ---- backup arithmetic (no eval) — used only if the /math tool doesn't recognize a message as math ---- */
function evalMath(src) {
  const t = src.match(/\d+\.?\d*|\.\d+|sqrt|[()+\-*/^]/g);
  if (!t) throw new Error('syntax');
  let i = 0; const peek = () => t[i], next = () => t[i++];
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const o = next(), r = term(); v = o === '+' ? v + r : v - r; } return v; };
  const term = () => { let v = unary(); while (peek() === '*' || peek() === '/') { const o = next(), r = unary(); if (o === '/') { if (r === 0) throw new Error('div0'); v /= r; } else v *= r; } return v; };
  const unary = () => { if (peek() === '-') { next(); return -unary(); } if (peek() === '+') { next(); return unary(); } return pow(); };
  const pow = () => { const b = prim(); if (peek() === '^') { next(); return Math.pow(b, unary()); } return b; };
  const prim = () => {
    const x = next(); if (x === undefined) throw new Error('syntax');
    if (x === '(') { const v = expr(); if (next() !== ')') throw new Error('syntax'); return v; }
    if (x === 'sqrt') { if (next() !== '(') throw new Error('syntax'); const v = expr(); if (next() !== ')') throw new Error('syntax'); return Math.sqrt(v); }
    const n = parseFloat(x); if (isNaN(n)) throw new Error('syntax'); return n;
  };
  const v = expr(); if (i !== t.length) throw new Error('syntax'); return v;
}
function tryMath(low) {
  let s = low.replace(/[?=]/g, ' ').replace(/(\d),(\d{3})/g, '$1$2');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100*$2)');
  s = s.replace(/(?:square root|sqrt)(?:\s*of)?\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)');
  s = s.replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\b(?:times|multiplied by|multiply by)\b/g, '*')
    .replace(/\b(?:divided by|over)\b/g, '/').replace(/\bto the power of\b/g, '^').replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3')
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d)\s*x\s*(\d)/g, '$1*$2');
  s = s.replace(/\b(?:what is|calculate|compute|solve|evaluate|how much is|how much|tell me|can you|please|equals?|the answer to|result of|is)\b/g, ' ');
  const chk = s.replace(/sqrt/g, '').replace(/\s+/g, '');
  if (!/^[\d.+\-*/^()]+$/.test(chk)) return null;
  if (!/(\d|\))\s*[+\-*/^]\s*(\d|\(|sqrt)|sqrt/.test(s)) return null;
  try {
    const v = evalMath(s);
    if (!isFinite(v)) return { text: "That result isn't a real finite number." };
    return { text: s.replace(/\s+/g, ' ').trim() + ' = ' + Number(v.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 8 }) };
  } catch (e) {
    return { text: e.message === 'div0' ? "I can't divide by zero — even I have limits." : null };
  }
}
function tryUnits(low) {
  const m = low.replace(/°/g, '').match(/(-?\d+(?:\.\d+)?)\s*(?:degrees?\s*)?([a-z]+)\s*(?:to|in|into|as)\s*(?:degrees?\s*)?([a-z]+)\b/);
  if (!m) return null;
  const v = parseFloat(m[1]), a = UNITS[m[2]], b = UNITS[m[3]];
  if (!a || !b || a.cat !== b.cat) return null;
  let out;
  if (a.cat === 'temp') {
    const c = a.f === 'c' ? v : a.f === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
    out = b.f === 'c' ? c : b.f === 'f' ? c * 9 / 5 + 32 : c + 273.15;
  } else out = v * a.f / b.f;
  return { text: `${v} ${m[2]} = ${Number(out.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${m[3]}` };
}

function editDistance(a, b) {
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j), prev2 = null;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    prev2 = prev; prev = cur;
  }
  return prev[n];
}
const cap = s => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
const rnd = n => Math.floor(Math.random() * n);
function genPassword() {
  const cs = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const a = new Uint32Array(16);
  try { (root.crypto || {}).getRandomValues(a); } catch (e) { for (let i = 0; i < 16; i++) a[i] = rnd(4e9); }
  return Array.from(a, x => cs[x % cs.length]).join('');
}
const REFLECT = { i: 'you', me: 'you', my: 'your', am: 'are', mine: 'yours', myself: 'yourself', you: 'I', your: 'my' };
const reflect = s => s.split(' ').map(w => REFLECT[w.toLowerCase()] || w).join(' ');

/* ================= 4. TOOL ROUTER =================
   Every specialist engine in this app already exports a free-text
   isXRequest(text) detector. Xenon checks them in order, most
   distinctive first, and — on a match — calls the exact same
   Xenon.Tools.run() path a /command would use. */
function routeToTool(raw) {
  const W = root, T = W.Xenon && W.Xenon.Tools;
  if (!T || typeof T.run !== 'function') return null;
  const call = (name, arg) => { const r = T.run('/' + name + ' ' + arg); return { text: r.text, html: !!r.html }; };
  try {
    if (typeof W.isCoding === 'function' && W.isCoding(raw)) return call('code', raw);
    if (typeof W.isBaseConversion === 'function' && W.isBaseConversion(raw)) return call('base', raw);
    if (typeof W.isLogicExpression === 'function' && W.isLogicExpression(raw)) return call('logic', raw);
    if (typeof W.isPhysicsProblem === 'function' && W.isPhysicsProblem(raw)) return call('physics', raw);
    if (/\b(integrate|integral|antiderivative)\b|∫/i.test(raw) && !/\b(c\s*program|source\s+code)\b/i.test(raw)) {
      const stripped = raw
        .replace(/^(?:what\s+is|find|calculate|compute|solve|please)\s+/i, '')
        .replace(/\b(the\s+)?(integral|antiderivative)\s+of\b/i, '')
        .replace(/^integrate\b/i, '')
        .trim();
      return call('integrate', stripped || raw);
    }
    if (typeof W.isAlgebra === 'function' && W.isAlgebra(raw)) return call('algebra', raw);
    if (typeof W.mathIsMath === 'function' && W.mathIsMath(raw)) return call('math', raw);
    if (typeof W.isReasoningRequest === 'function' && W.isReasoningRequest(raw)) return call('reasoning', raw);
    if (typeof W.isAssistRequest === 'function' && W.isAssistRequest(raw)) return call('assist', raw);
    if (typeof W.isWritingRequest === 'function' && W.isWritingRequest(raw)) return call('write', raw);
    if (typeof W.isParagraphRequest === 'function' && W.isParagraphRequest(raw)) return call('paragraph', raw);
  } catch (e) {
    console.warn('[Xenon] tool router failed on this input:', e);
  }
  return null;
}

/* ================= 4.5 MULTI-INTENT SEGMENTATION =================
   Splits one message into several independent requests. Deliberately
   conservative: it only fires (see hasMultiIntentSignal) when there's
   an explicit signal that more than one thing is being asked, so a
   normal multi-sentence word problem ("A car starts at rest. It
   accelerates at 2 m/s^2 for 5s. What is its velocity?") is left
   completely alone and goes through the pipeline as one piece, same
   as before this feature existed. */

// Words immediately before a ".", "!" or "?" that do NOT end a sentence.
const ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'approx', 'no', 'st', 'vol', 'fig', 'eg', 'ie', 'inc', 'ltd', 'co']);

// Split on . ! ? boundaries, guarding abbreviations ("Dr. Lee") and
// decimals ("3.14") so those never get cut.
function sentenceSplit(s) {
  const out = []; let start = 0;
  const re = /[.!?]+(\s+)/g; let m;
  while ((m = re.exec(s))) {
    const punctEnd = m.index + m[0].length - m[1].length; // end of the punctuation run, before the space
    const before = s.slice(start, m.index);
    const lastWord = (before.trim().split(/\s+/).pop() || '').toLowerCase().replace(/[^a-z]/g, '');
    const isDecimal = /\d$/.test(before) && /^\d/.test(s.slice(m.index + m[0].length));
    if (before.trim() && !ABBR.has(lastWord) && !isDecimal) {
      out.push(s.slice(start, punctEnd));
      start = m.index + m[0].length;
    }
  }
  out.push(s.slice(start));
  return out.map(x => x.trim()).filter(Boolean);
}

// Words that plausibly START a new request. Deliberately broad — this
// only ever decides whether text AFTER "also"/"plus"/", and" looks
// like the beginning of a fresh ask, never whether to answer it.
const OPENER_WORDS = ['can', 'could', 'would', 'will', 'please', 'tell', 'give', 'write', 'solve', 'calculate',
  'compute', 'show', 'explain', 'make', 'create', 'generate', 'convert', 'translate', 'find', 'play', 'flip',
  'roll', 'pick', 'choose', 'define', 'describe', 'list', 'draw', 'plot', 'check', 'remember', 'teach', 'guess',
  'recommend', 'suggest', 'what', 'who', 'when', 'where', 'why', 'how', 'is', 'are', 'do', 'does'];
const OPENER_ALT = OPENER_WORDS.join('|');
const OPENER_LOOKAHEAD = '(?=(?:' + OPENER_ALT + ')\\b)';

// Explicit "here comes another request" connectors. Lookaheads only
// (no lookbehind) so this stays compatible with older mobile WebViews.
const CONNECTOR_PATTERNS = [
  /\s+and also\s+/gi,
  /\s+oh and\s+/gi,
  /\s+but also\s+/gi,
  /\s*,?\s+one more thing[,:]?\s+/gi,
  new RegExp(',?\\s+also\\s+' + OPENER_LOOKAHEAD, 'gi'),
  new RegExp(',?\\s+plus\\s+' + OPENER_LOOKAHEAD, 'gi'),
  new RegExp(',\\s+and\\s+' + OPENER_LOOKAHEAD, 'gi'),
];
function connectorSplit(s) {
  let parts = [s];
  for (const re of CONNECTOR_PATTERNS) {
    const next = [];
    for (const p of parts) next.push(...p.split(re).map(x => x.trim()).filter(Boolean));
    parts = next;
  }
  return parts;
}

// A fragment with no real content of its own (leftover glue after a split).
function isNoiseSegment(s) {
  const w = s.toLowerCase().replace(/[^a-z\s]/g, ' ').trim();
  if (!w) return true;
  return /^(?:and|also|oh|but|plus|then|well|so|um|uh|ok|okay|now|right|hmm)$/.test(w);
}

const ALSO_SIGNAL = new RegExp('\\balso\\b\\s+' + OPENER_LOOKAHEAD, 'i');
const PLUS_SIGNAL = new RegExp('\\bplus\\b\\s+' + OPENER_LOOKAHEAD, 'i');
const COMMA_AND_SIGNAL = new RegExp(',\\s*and\\s+' + OPENER_LOOKAHEAD, 'i');

// Cheap gate: is there real evidence of more than one request here?
// Deliberately misses subtler cases — better to under-split (old
// behaviour) than to fragment a coherent word problem.
function hasMultiIntentSignal(raw) {
  if (/\n/.test(raw)) return true;
  if (/;/.test(raw)) return true;
  if (/\b(?:and also|oh and|but also|one more thing)\b/i.test(raw)) return true;
  if (ALSO_SIGNAL.test(raw)) return true;
  if (PLUS_SIGNAL.test(raw)) return true;
  if (COMMA_AND_SIGNAL.test(raw)) return true;
  if ((raw.match(/\?/g) || []).length >= 2) return true;
  return false;
}

const MAX_SEGMENTS = 4;
function segmentMessage(raw) {
  const s = String(raw || '').trim();
  if (!s) return [s];
  const chunks = s.split(/\n+|;\s*/).map(x => x.trim()).filter(Boolean);
  let segs = [];
  for (const c of (chunks.length ? chunks : [s])) {
    for (const sent of sentenceSplit(c)) segs.push(...connectorSplit(sent));
  }
  segs = segs
    .filter(x => !isNoiseSegment(x))
    .map(x => x.replace(/^(?:and|also|oh and|but also|but|plus|well then|well|then|so)\s+/i, '').trim())
    .filter(Boolean);
  if (!segs.length) segs = [s];
  if (segs.length > MAX_SEGMENTS) {
    segs = segs.slice(0, MAX_SEGMENTS - 1).concat([segs.slice(MAX_SEGMENTS - 1).join('. ')]);
  }
  return segs;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function wrapPlainAsHtml(t) {
  return '<p style="margin:0 0 10px;white-space:pre-wrap;">' + escHtml(t).replace(/\n/g, '<br>') + '</p>';
}

/* ================= 5. THE MODEL ================= */
const MEM_KEY = 'xenon_ai_memory';
class XenonBrain {
  constructor() {
    this.mem = { name: null, likes: [], facts: [], taught: [] };
    this.ctx = { lastTag: null, lastBot: null, pending: null, riddle: null, game: null, topic: 'the sky', turns: 0, lastKB: null, history: [] };
    this.used = {}; this.last = null; this.stats = {};
    this.th = { cos: 0.42, score: 0.45 };
    this._load();
    this.kb = KB_RAW.map(([k, text]) => ({ keys: k.split('|').map(x => x.split(' ').map(stem)), topic: k.split('|')[0], text }));
  }

  reset() { this.ctx = { lastTag: null, lastBot: null, pending: null, riddle: null, game: null, topic: 'the sky', turns: 0, lastKB: null, history: [] }; this.used = {}; this.last = null; }

  /* ---------- persistence (plain localStorage, same pattern chat.js uses) ---------- */
  _load() { try { const r = localStorage.getItem(MEM_KEY); if (r) Object.assign(this.mem, JSON.parse(r)); } catch (e) { /* ignore */ } }
  _save() { try { localStorage.setItem(MEM_KEY, JSON.stringify(this.mem)); } catch (e) { /* ignore */ } }
  forget() { this.mem = { name: null, likes: [], facts: [], taught: [] }; this._save(); this._build(); }

  /* ---------- training (synchronous — no boot screen in this app) ---------- */
  _extract() {
    this.intents = INTENTS.concat(this.mem.taught.map((t, i) => ({ tag: 'taught:' + i, patterns: [t.q], responses: [t.a], taught: true })));
    this.map = new Map(this.intents.map(x => [x.tag, x]));
    this.ex = [];
    for (const it of this.intents) for (const p of it.patterns) this.ex.push({ tag: it.tag, text: p, raw: features(p) });
  }
  _weigh() {
    const N = this.ex.length, df = new Map();
    for (const e of this.ex) for (const f of e.raw.keys()) df.set(f, (df.get(f) || 0) + 1);
    this.idf = new Map(); for (const [f, d] of df) this.idf.set(f, Math.log((N + 1) / (d + 1)) + 1);
    this.maxIdf = Math.log(N + 1) + 1;
    this.index = new Map();
    this.ex.forEach((e, i) => {
      for (const [f, w] of this.vec(e.raw)) { let p = this.index.get(f); if (!p) this.index.set(f, p = []); p.push(i, w); }
    });
    this.wordList = [...df.keys()].filter(f => f.startsWith('w:')).map(f => f.slice(2)).filter(w => w.length >= 3 && !/^\d+$/.test(w));
    this.words = new Set(this.wordList);
  }
  _fitNB() {
    const nb = { tags: new Map(), vocab: new Set(), N: this.ex.length };
    for (const e of this.ex) {
      let t = nb.tags.get(e.tag); if (!t) nb.tags.set(e.tag, t = { n: 0, total: 0, f: new Map() });
      t.n++; for (const [f, w] of e.raw) { t.f.set(f, (t.f.get(f) || 0) + w); t.total += w; nb.vocab.add(f); }
    }
    nb.V = nb.vocab.size; this.nb = nb;
  }
  _build() { this._extract(); this._weigh(); this._fitNB(); }
  trainSync() { this._build(); return this.stats; }

  /* ---------- inference ---------- */
  vec(raw) {
    const v = new Map(); let n = 0;
    for (const [f, w] of raw) { const i = this.idf.get(f); const x = w * (i === undefined ? this.maxIdf : i); v.set(f, x); n += x * x; }
    n = Math.sqrt(n) || 1; for (const [f, x] of v) v.set(f, x / n); return v;
  }
  sims(q) {
    const s = new Float32Array(this.ex.length);
    for (const [f, w] of q) { const p = this.index.get(f); if (p) for (let k = 0; k < p.length; k += 2) s[p[k]] += w * p[k + 1]; }
    return s;
  }
  nbProbs(raw) {
    const out = new Map(); let wsum = 0;
    for (const [f, w] of raw) if (this.nb.vocab.has(f)) wsum += w;
    if (!wsum) return out;
    const T = 1 / Math.max(1, wsum / 4), ls = [];
    for (const [tag, t] of this.nb.tags) {
      let s = Math.log(t.n / this.nb.N) * 0.5;
      for (const [f, w] of raw) if (this.nb.vocab.has(f)) s += w * Math.log(((t.f.get(f) || 0) + 0.05) / (t.total + 0.05 * this.nb.V));
      ls.push([tag, s]);
    }
    const mx = Math.max(...ls.map(x => x[1])); let z = 0;
    const ex = ls.map(([tag, s]) => { const e = Math.exp((s - mx) * T); z += e; return [tag, e]; });
    ex.forEach(([tag, e]) => out.set(tag, e / z));
    return out;
  }
  fix(t) {
    if (t.length < 4 || /^\d+$/.test(t) || this.words.has(t)) return t;
    const md = t.length >= 7 ? 2 : 1; let best = t, bd = md + 1;
    for (const w of this.wordList) {
      if (Math.abs(w.length - t.length) > md) continue;
      const d = editDistance(t, w); if (d < bd) { bd = d; best = w; if (d === 1 && md === 1) break; }
    }
    return best;
  }
  classify(text, o) {
    o = o || {};
    const raw = features(text, o.noFix ? null : t => this.fix(t));
    if (!raw.size) return { tag: null, cos: 0, score: 0, top: [] };
    const sims = this.sims(this.vec(raw)), best = new Map();
    for (let i = 0; i < sims.length; i++) { const t = this.ex[i].tag; if (sims[i] > (best.get(t) || 0)) best.set(t, sims[i]); }
    const nb = this.nbProbs(raw), sc = [];
    for (const [tag, cos] of best) { const p = nb.get(tag) || 0; sc.push({ tag, cos, nb: p, score: 0.5 * cos + 0.5 * p }); }
    sc.sort((a, b) => b.score - a.score);
    const tt = sc.find(x => x.tag.startsWith('taught:') && x.cos >= 0.95);   // explicit teaching always wins
    if (tt) return Object.assign({ top: [tt].concat(sc.filter(x => x !== tt).slice(0, 2)) }, tt);
    return sc.length ? Object.assign({ top: sc.slice(0, 3) }, sc[0]) : { tag: null, cos: 0, score: 0, top: [] };
  }

  /* ---------- dialogue ---------- */
  pick(tag, arr) {
    const u = this.used[tag] || (this.used[tag] = new Set());
    if (u.size >= arr.length) u.clear();
    let i; do { i = rnd(arr.length); } while (u.has(i) && u.size < arr.length);
    u.add(i); return arr[i];
  }
  fill(s) {
    const m = this.mem, c = this.ctx, d = new Date();
    return s.replace(/\{(\w+)\}/g, (_, k) => {
      switch (k) {
        case 'nm': return m.name ? ', ' + m.name : '';
        case 'name': return m.name || 'friend';
        case 'time': return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        case 'date': return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        case 'coin': return Math.random() < 0.5 ? 'Heads' : 'Tails';
        case 'dice': return String(1 + rnd(6));
        case 'password': return genPassword();
        case 'topic': return c.topic;
        case 'Topic': return cap(c.topic);
        default: return '';
      }
    });
  }
  teach(q, a) { this.mem.taught.push({ q: q.trim(), a: a.trim() }); this._save(); this._build(); }
  remember(list, item) { if (!list.includes(item)) list.push(item); if (list.length > 20) list.shift(); this._save(); }

  /** Main entry point. Returns { text, html }. */
  respond(input) {
    const text = String(input || '').trim().slice(0, 800);
    if (!text) return { text: "I'm listening…", html: false };
    this.ctx.turns++;
    const r = this.handle(text);
    this.ctx.lastBot = r.text; this.ctx.lastTag = r.tag; this.last = r;
    if (!this.ctx.history) this.ctx.history = [];
    this.ctx.history.push({ input: text, tag: r.tag });
    if (this.ctx.history.length > 8) this.ctx.history.shift();
    return { text: r.text, html: !!r.html };
  }

  /** Top-level dispatcher for one incoming chat message. Runs safety
   *  first (on the raw, un-split text, so it can never be dodged by
   *  hiding a phrase inside one clause of a longer message), then
   *  either hands the whole message to handleOne() — the original,
   *  unchanged single-request pipeline — or, only when there's an
   *  explicit multi-intent signal, splits it and merges several
   *  handleOne() results into one reply. See the file header for why
   *  this is safe for word problems and other legitimately long,
   *  multi-sentence single requests. */
  handle(raw) {
    const low0 = normalize(raw);
    if (/\b(kill myself|end my life|suicid\w*|want to die|hurt myself|harm myself|self harm|cut myself|do not want to live|better off dead)\b/.test(low0)) {
      return { text: this.fill("I'm really sorry you're hurting{nm}. You don't have to carry this alone. If you might act on these thoughts or you're in immediate danger, please contact your local emergency number now. In the US you can call or text 988 (Suicide & Crisis Lifeline); elsewhere, findahelpline.com lists services by country. If you can, reach out to someone you trust and stay near them. I'm here to listen too — do you want to tell me what's going on?"), mode: 'safety', tag: 'safety', conf: 1, top: [], fallback: false, html: false };
    }

    const whole = this.handleOne(raw);
    if (!hasMultiIntentSignal(raw)) return whole;

    const parts = segmentMessage(raw);
    if (parts.length <= 1) return whole;

    const results = parts.map(p => this.handleOne(p));
    // A working tool match on the whole message is worth more than a
    // speculative split — if splitting killed it (no piece is a tool
    // match either), throw the split away and keep the whole answer.
    if (whole.mode === 'tool' && !results.some(r => r.mode === 'tool')) return whole;
    // If every piece came back unrecognized but the whole message
    // didn't, the split fragmented something that was fine as-is.
    if (results.every(r => r.fallback) && !whole.fallback) return whole;

    return this.combine(results);
  }

  /** Merge several handleOne() results (one per detected request)
   *  into a single { text, html } reply. Unrecognized pieces are
   *  dropped quietly rather than piling up "I didn't understand"
   *  several times over. */
  combine(results) {
    const kept = results.filter(r => !r.fallback);
    const dropped = results.filter(r => r.fallback);
    const use = kept.length ? kept : results.slice(0, 1);
    const uniq = [];
    for (const r of use) { if (!uniq.length || uniq[uniq.length - 1].text !== r.text) uniq.push(r); }
    const anyHtml = uniq.some(r => r.html);
    let text = anyHtml
      ? '<div class="xenon-multipart">' + uniq.map(r => r.html ? r.text : wrapPlainAsHtml(r.text)).join('') + '</div>'
      : uniq.map(r => r.text).join('\n\n');
    if (kept.length && dropped.length === 1 && results.length > 1) {
      text += anyHtml ? '' : "\n\n(I wasn't sure how to help with one part of that — feel free to ask it on its own.)";
    }
    const last = uniq[uniq.length - 1] || results[results.length - 1];
    return { text, mode: 'multi', tag: last.tag, conf: last.conf, top: last.top, fallback: kept.length === 0, html: anyHtml };
  }

  /** The original single-request pipeline (unchanged from before
   *  multi-intent support): one active game/riddle check, a couple
   *  of flowing-conversation niceties, teaching & memory commands,
   *  the tool router, Xenon's own quick skills, the mini knowledge
   *  base, the trained classifier, then reflection/fallback. Called
   *  once for an ordinary message, or once per detected request when
   *  handle() has split a multi-intent message. */
  handleOne(seg) {
    const c = this.ctx, m = this.mem, low = normalize(seg), cl = clean(seg);
    const sent = sentiment(cl);
    const pend = c.pending; c.pending = null;
    const out = (t, mode, tag, conf, top, fb, html) => ({ text: (html || mode === 'tool') ? t : this.fill(t), mode, tag: tag || mode, conf: conf == null ? 1 : conf, top: top || [], fallback: !!fb, html: !!html });
    let x;

    // 1. active games
    if (c.game) {
      if (/\b(quit|stop|exit|give up|end game)\b/.test(cl)) { const n = c.game.n; c.game = null; return out(`Okay, game over. The number was ${n}.`, 'game'); }
      const g = cl.match(/^(?:(?:is it|it is|my guess is|i guess|guess|maybe|try)\s+)?(\d+)$/);
      if (g) {
        const v = +g[1]; c.game.tries++;
        if (v === c.game.n) { const t = c.game.tries; c.game = null; return out(`🎉 Yes, it was ${v}! You got it in ${t} ${t === 1 ? 'try' : 'tries'}.`, 'game'); }
        return out(v < c.game.n ? `${v} is too low. Try higher!` : `${v} is too high. Try lower!`, 'game');
      }
    }
    if (/^(rock|paper|scissors)$/.test(cl)) {
      const o = ['rock', 'paper', 'scissors'], b = o[rnd(3)], beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
      const r = b === cl ? "It's a tie!" : beats[cl] === b ? 'You win! 🎉' : 'I win! 😎';
      return out(`I chose ${b}. ${r} Play again?`, 'game');
    }
    if (c.riddle && stems(seg).includes(c.riddle.key)) { c.riddle = null; return out('Correct! 🎉 Want another riddle?', 'riddle', 'riddle_guess'); }

    // 2. flowing-conversation niceties: reciprocal questions and
    // "what did I just say/ask" look-ups against recent history.
    const RECIP_RE = /^(?:good|great|fine|well|pretty good|not bad|alright|ok|okay|same|awesome|excellent)?[, ]*(?:and\s+)?(?:you|u)$|^(?:what|how) about you$/;
    if (RECIP_RE.test(cl)) {
      const RECIP = {
        how_are_you: ["I'm doing well, thanks for asking!", "Pretty good over here, thanks!", "Can't complain — appreciate you checking in!"],
        user_bad: ["Thanks for asking — I'm just here, ready to help whenever you need."],
        busy: ["Just here chatting with you, same as always!"],
      };
      const pool = RECIP[c.lastTag] || ["I'm doing well, thanks for asking!", "All good here!"];
      return out(this.pick('recip', pool), 'intent', 'reciprocal');
    }
    if (/\bwhat did i (?:just )?(?:say|ask)\b|\bwhat was my (?:last|previous) (?:question|message)\b/.test(low)) {
      const h = c.history || [];
      const prev = h.length ? h[h.length - 1].input : null;
      return out(prev ? `You said: "${prev}"` : "I don't have anything from earlier in this chat yet.", 'memory');
    }

    // 3. teaching & memory commands
    if ((x = seg.match(/^(?:when|if) i (?:say|type|write) ["“']?(.+?)["”']?,? (?:then )?(?:you )?(?:should )?(?:say|reply|respond|answer)(?: with)? ["“']?(.+?)["”']?\s*$/i))) {
      this.teach(x[1], x[2]);
      return out(`Learned! Now when you say “${x[1]}”, I'll reply “${x[2]}”.`, 'teach');
    }
    if (/^(?:please )?(?:forget (?:me|everything|my name|all)|clear (?:my )?memory|reset (?:my )?memory)/.test(low)) { this.forget(); return out("Done — I've forgotten your name, likes, facts and everything you taught me.", 'memory'); }
    if ((x = seg.match(/(?:my name is|call me|i am called|my name's|name's)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,20})/i)) && !/^(not|so|a|the|going|very)$/i.test(x[1])) {
      m.name = cap(x[1].toLowerCase()); this._save();
      return out(`Nice to meet you, ${m.name}! I'll remember your name.`, 'memory');
    }
    if (/\b(?:what is my name|who am i|do you (?:know|remember) my name)\b/.test(low))
      return out(m.name ? `You're ${m.name}!` : "I don't know your name yet — tell me with “my name is …”.", 'memory');
    if (/\b(?:what do you (?:know|remember) about me|do you remember me)\b/.test(low)) {
      const bits = []; if (m.name) bits.push(`your name is ${m.name}`); if (m.likes.length) bits.push('you like ' + m.likes.join(', ')); bits.push(...m.facts);
      return out(bits.length ? 'Here is what I remember: ' + bits.join('; ') + '.' : "Not much yet! Tell me your name or what you like.", 'memory');
    }
    if (/\bwhat do i (?:like|love|enjoy)\b/.test(low)) return out(m.likes.length ? 'You told me you like ' + m.likes.join(', ') + '.' : "You haven't told me yet — try “I like pizza”.", 'memory');
    if ((x = seg.match(/^my favou?rite (.{2,20}?) is (.{1,40}?)[.!]*$/i))) { this.remember(m.facts, `your favorite ${x[1].toLowerCase()} is ${x[2]}`); return out(`Noted — your favorite ${x[1].toLowerCase()} is ${x[2]}.`, 'memory'); }
    if ((x = seg.match(/^(?:please )?remember (?:that )?(.{3,120}?)[.!]*$/i))) { const f = reflect(x[1]); this.remember(m.facts, f); return out(`Okay, I'll remember that ${f}.`, 'memory'); }
    if ((x = seg.match(/^my (birthday|job|age|hometown|city|country|school|hobby|hobbies|team|major|(?:dog|cat|pet|sister|brother|mother|father|mom|dad|best friend)(?= (?:is|are) (?:called|named))) (?:is|are) (.{1,40}?)[.!]*$/i))) {
      const f = `your ${x[1].toLowerCase()} is ${x[2]}`; this.remember(m.facts, f); return out(`Got it — ${f}. I'll remember that.`, 'memory');
    }
    if ((x = low.match(/^i (?:really |absolutely )?(?:like|love|enjoy|adore|prefer) (.{2,40}?)[.!]*$/)) && !/^(you|this|it|that|him|her|them|talking|chatting|xenon|the way)\b/.test(x[1])) {
      this.remember(m.likes, x[1]); return out(this.pick('like', [`Nice! I'll remember you like ${x[1]}.`, `Good taste — noted that you like ${x[1]}.`, `Got it: ${x[1]}. I'll keep that in mind.`]), 'memory');
    }

    // 4. TOOL ROUTER — let the specialist engines take questions in their domain
    const routed = routeToTool(seg);
    if (routed) return out(routed.text, 'tool', 'tool', 1, [], false, routed.html);

    // 5. Xenon's own quick skills — unit conversion, capitals, backup arithmetic
    if ((x = tryUnits(low))) return out(x.text, 'units');
    if ((x = cl.match(/capital(?: city)? of (?:the )?([a-z ]+)$/))) {
      const cap1 = CAPITALS[x[1].trim()];
      return out(cap1 ? `The capital of ${cap(x[1].trim())} is ${cap1}.` : "That country isn't in my small atlas yet.", 'kb', 'capital');
    }
    if ((x = tryMath(low)) && x.text) return out(x.text, 'math');
    if ((x = cl.match(/(?:random )?number between (\d+) and (\d+)/))) { const a = Math.min(+x[1], +x[2]), b = Math.max(+x[1], +x[2]); return out(`🎲 ${a + rnd(b - a + 1)}`, 'random'); }
    if ((x = cl.match(/^(?:please )?(?:choose|pick|decide|select)(?: for me)?(?: between| from)? (.+)$/)) && / or /.test(' ' + x[1] + ' ')) {
      const opts = x[1].split(/,| or /).map(s => s.trim()).filter(Boolean);
      if (opts.length > 1) return out(`I'd go with “${opts[rnd(opts.length)]}”.`, 'random');
    }

    // 6. mini knowledge base
    if ((x = this.lookupKB(cl))) { c.lastKB = x.topic; return out(x.text, 'kb', 'kb:' + x.topic); }

    // 7. classifier
    const cls = this.classify(seg);
    const ok = cls.tag && cls.cos >= (/^my /.test(low) ? 0.8 : this.th.cos) && cls.score >= this.th.score;
    if (ok) {
      let tag = cls.tag;
      if (tag === 'affirm' && pend) tag = pend;
      else if (tag === 'deny' && pend) return out("No problem. What else can I do for you?", 'intent', 'deny', cls.score, cls.top);
      return this.answer(tag, seg, cls);
    }

    // 8. reflection (ELIZA-style) then fallback
    const rf = this.reflection(low);
    if (rf) return out(rf, 'reflect', 'reflect', cls.score, cls.top);
    if (sent < -0.3) return out("That sounds difficult{nm}. I'm here to listen — what's going on?", 'empathy', 'empathy', cls.score, cls.top, false);
    return out(this.pick('fb', [
      "I'm not sure I understood that{nm}. Could you rephrase? You can also teach me: “when I say X you say Y”.",
      "Hmm, that's outside what I can help with. Try a question, a calculation, or ask for a joke — or send /tools to see every tool by name.",
      "I don't have a good answer for that yet. Tell me how I should reply — say “when I say … you say …” — and I'll learn it.",
      "I didn't quite catch that. Ask “what can you do?” to see my skills."]), 'fallback', cls.tag, cls.score, cls.top, true);
  }

  answer(tag, seg, cls) {
    const c = this.ctx, m = this.mem;
    const out = (t, extra) => Object.assign({ text: this.fill(t), mode: 'intent', tag, conf: cls.score, top: cls.top, fallback: false }, extra || {});
    if (tag === 'more') {
      const rep = ['joke', 'fun_fact', 'motivation', 'riddle', 'story', 'poem', 'food', 'movies', 'books', 'study', 'coin', 'dice', 'password'];
      if (rep.includes(c.lastTag)) return this.answer(c.lastTag, seg, cls);
      if (c.lastKB) return out(`That's about all I know about ${c.lastKB}. You can teach me more: “remember that …”.`);
      return out("Happy to continue — more of what? Try “tell me a joke” or “fun fact”.");
    }
    if (tag === 'clarify') return out(c.lastBot ? 'Sure, let me say it again: ' + c.lastBot : 'Which part should I explain?');
    if (tag === 'riddle_answer') {
      if (c.riddle) { const a = c.riddle.a; c.riddle = null; return out('The answer is: ' + a); }
      c.pending = 'riddle';
      return out("There's no riddle in progress. Want one?");
    }
    if (tag === 'game_guess') { c.game = { n: 1 + rnd(50), tries: 0 }; return out("I'm thinking of a number between 1 and 50. Take a guess! (Say “quit” to stop.)"); }
    const it = this.map.get(tag);
    if (!it) return out("Hmm, I lost my train of thought.");
    if (tag === 'poem') {
      const t = seg.match(/(?:about|on|for)\s+((?:the\s+|a\s+|an\s+|my\s+)?[a-z ]{2,24})$/i);
      c.topic = t ? t[1].trim().toLowerCase() : ['the sea', 'the moon', 'a long road', 'the rain', 'morning'][rnd(5)];
    }
    let r = this.pick(tag, it.responses);
    if (tag === 'riddle') { const [q, a] = r.split('|||'); c.riddle = { a: a.trim(), key: stem(a.trim().toLowerCase().replace(/^(a|an|the)\s+/, '').replace(/[^a-z]/g, '')) }; r = q.trim() + '\n\n(Guess, or say “answer” to reveal it.)'; }
    if (it.then) c.pending = it.then;
    if (['food', 'music', 'movies', 'books', 'bored'].includes(tag) && m.likes.length && Math.random() < 0.5)
      r += `\n\n(I remember you like ${m.likes[rnd(m.likes.length)]}.)`;
    return out(r);
  }

  lookupKB(cl) {
    if (/\b(you|your|yours|yourself|poem|poetry|story|joke|riddle|song)\b/.test(cl)) return null;
    const asks = /\b(what|who|explain|define|definition|describe|meaning|about|why)\b|how (?:does|do) .+ work/.test(cl);
    const toks = cl.split(' ').map(stem), set = new Set(toks);
    const STOP = new Set('the a an is are of what tell me about explain define describe meaning who please do does how work why'.split(' '));
    const content = toks.filter(t => !STOP.has(t));
    let best = null, bl = 0;
    for (const e of this.kb) for (const k of e.keys) if (k.every(s => set.has(s)) && k.length > bl) { best = e; bl = k.length; }
    if (!best) return null;
    if (!asks && content.length > bl) return null;
    return best;
  }

  reflection(low) {
    const pats = [
      [/^i (?:feel|am feeling) (.+)/, ["Why do you feel {0}?", "How long have you felt {0}?"]],
      [/^i am (.+)/, ["Interesting — you are {0}. What's that like for you?", "How does being {0} affect your day?"]],
      [/^i want (.+)/, ["What would it mean to you to get {0}?", "Why do you want {0}?"]],
      [/^i need (.+)/, ["Why do you need {0}?", "What would happen if you got {0}?"]],
      [/^i think (.+)/, ["What makes you think {0}?", "Do you really think {0}?"]],
      [/^i (?:can not|cannot) (.+)/, ["What stops you from being able to {0}?", "Have you tried to {0}?"]],
      [/^because (.+)/, ["Is that the real reason?", "Does that explain everything?"]],
      [/^my (.+?) (?:is|are|was|were|has|have|does|do) .+/, ["Tell me more about your {0}.", "How does that make you feel?"]],
      [/^my (.+)/, ["Tell me more about your {0}.", "How do you feel about your {0}?"]],
      [/^i have (.+)/, ["What is it like to have {0}?", "Tell me more about having {0}."]],
    ];
    for (const [re, rs] of pats) { const x = low.replace(/[.!?]+$/, '').match(re); if (x) return this.pick('rf' + re.source, rs).replace('{0}', reflect(x[1])); }
    return null;
  }
}

/* ================= 6. WIRE-UP ================= */
root.Xenon = root.Xenon || {};
root.Xenon.Brain = new XenonBrain();
root.Xenon.Brain.trainSync();
})(typeof window !== 'undefined' ? window : globalThis);
