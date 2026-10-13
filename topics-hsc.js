// ═══════════════════════════════════════════════════════════════════════════
// XENON KNOWLEDGE BASE — topics-hsc.js
// ═══════════════════════════════════════════════════════════════════════════
//
// A structured, queryable library of topics. Each topic is designed to
// answer many kinds of questions, not just "write a paragraph".
//
// ── SCHEMA (per topic) ─────────────────────────────────────────────────
//   id            unique slug
//   title         display name
//   category      section (Environment, Technology, ...)
//   tags          keywords for search
//   difficulty    'primary' | 'school' | 'hsc' | 'college'
//   aliases       regex matching user phrasing
//   summary       one-sentence definition
//   openers       variant opening sentences
//   body          { category, theme, text } fragments
//   closers       closing variants
//   keyPoints     revision bullets
//   facts         reusable statistics
//   examples      real-world case studies
//   quotes        famous quotations
//   sources       references for the claims
//   relatedTopics ids of adjacent topics
//
// ── FRAGMENT CATEGORIES ────────────────────────────────────────────────
//   definition | cause | effect | solution | importance | example
//   context | philosophical
//
// ═══════════════════════════════════════════════════════════════════════════

window.HSC_TOPICS = [

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT
// ─────────────────────────────────────────────────────────────────────────

{
    id: 'tree-plantation',
    title: 'Tree Plantation',
    category: 'Environment',
    tags: ['environment', 'forests', 'climate', 'biodiversity', 'afforestation', 'reforestation', 'nature', 'trees'],
    difficulty: 'school',
    aliases: /\btree\s+plantation\b|\bplanting\s+trees\b|\bplantation\s+of\s+trees\b|\btree\s+planting\b|\bplant\s+trees\b|\bafforestation\b|\breforestation\b/i,

    summary: 'Tree plantation is the practice of planting and caring for trees to restore forest cover, fight climate change, and sustain life on Earth.',

    openers: [
    'Trees are the silent protectors of our planet Earth. Trees give us oxygen; they absorb carbon dioxide and keep the soil together with their roots. Without them, our air and soil would slowly disappear.',
    'A tree is one of the best gifts nature has given us. It cleans the air. It cools the surroundings and gives shade to anyone who rests under it. Planting a tree is like planting life itself.',
    'Among all living things, trees hold a special place. A tree stands quietly for years, giving more than it takes. It asks for nothing but a little soil and water.',
    'Every tree starts as a tiny sapling. Its impact grows far bigger than its size. Tree plantation is one of the easiest things a person can do, and the benefits last for generations.',
    'The Earth loses about ten million hectares of forest every year. That is roughly the size of Iceland. Tree plantation is our most direct answer to that problem.',
    'Bangladesh was once covered with dense green forests. Today most of that cover is gone. Tree plantation is now a national need, not just an environmental duty.',
    'The best time to plant a tree was twenty years ago. The second best time is today. That old proverb says everything about why this cannot wait.'
],

    body: [
        // ── definition ──
        { category: 'definition', theme: 'definition',
          text: 'Tree plantation is the act of planting saplings and looking after them until they grow into big trees. It includes afforestation, which means planting trees in areas that never had forests, and reforestation, which means bringing back forests that were lost.' },

        // ── causes (why tree plantation is needed) ──
        { category: 'cause', theme: 'cause-deforestation',
          text: 'The main reason tree plantation has become urgent is deforestation. Forests are being cut down for farming, housing, roads, and industry at a rate the planet cannot afford.' },
        { category: 'cause', theme: 'cause-carbon',
          text: 'Carbon emissions from vehicles, factories, and power plants have pushed carbon dioxide in the air to record levels. Tree plantation is the simplest natural way to pull some of it back down.' },
        { category: 'cause', theme: 'cause-urbanisation',
          text: 'Fast urbanisation has replaced green spaces with concrete. Cities have become heat traps, and trees are the cheapest and most effective remedy available.' },
        { category: 'cause', theme: 'cause-climate',
          text: 'Climate change has made floods, droughts, and heatwaves more common. Forests steady the local climate, soak up floodwater, and cool the air. This makes them one of the most useful forms of climate adaptation.' },

        // ── effects (what trees do) ──
        { category: 'effect', theme: 'climate',
          text: 'Tree plantation is among the most effective measures in fighting climate change. Every tree that is planted today becomes a protector from the greenhouse effect for future generations.' },
        { category: 'effect', theme: 'carbon',
          text: 'As a natural carbon sink, a single hectare of forest can store hundreds of tons of carbon throughout its life. Trees absorb carbon dioxide from the air and keep it locked in their wood.' },
        { category: 'effect', theme: 'oxygen',
          text: 'A mature tree absorbs around 22 kilograms of carbon dioxide every year. At the same time, it releases enough oxygen to support two people for the same period.' },
        { category: 'effect', theme: 'soil',
          text: 'The roots of trees hold the soil in place. This stops erosion, keeps rivers clean, and protects fertile farmland from being washed away in heavy rains.' },
        { category: 'effect', theme: 'rainfall',
          text: 'Forests bring rain. Areas with dense tree cover receive more rainfall, which in turn supports farming and refills groundwater below the surface.' },
        { category: 'effect', theme: 'water',
          text: 'Trees work like natural sponges. Their roots slow down rainwater so it can soak into the ground instead of rushing into rivers. This reduces floods in the wet season and keeps streams alive in the dry.' },
        { category: 'effect', theme: 'wildlife',
          text: 'Trees are homes. Birds build nests in them, squirrels jump between them, and thousands of insects depend on them for food and shelter. Without trees, an entire web of life collapses.' },
        { category: 'effect', theme: 'biodiversity',
          text: 'Forests shelter more than eighty percent of the world land-based species. Every new tree adds another small sanctuary for the biodiversity that keeps ecosystems healthy.' },
        { category: 'effect', theme: 'temperature',
          text: 'Trees cool the air around them by several degrees. A street with trees feels noticeably cooler than one without, which matters more every year in our warming cities.' },
        { category: 'effect', theme: 'health',
          text: 'Being near trees calms the mind and lowers stress. Studies have shown that people who live near greenery feel more focused, happier, and healthier overall.' },
        { category: 'effect', theme: 'economy',
          text: 'Tree plantation also has economic value. Timber, fruit, honey, and medicinal plants support the lives of millions of families around the world.' },
        { category: 'effect', theme: 'agriculture',
          text: 'Farmers benefit directly from trees on their land. Growing trees along with crops improves soil fertility, reduces wind damage, and gives an extra source of income.' },

        // ── solutions ──
        { category: 'solution', theme: 'care',
          text: 'Planting a sapling is easy; the real work begins after. A young tree needs water, protection from animals, and patient care for years before it can stand on its own.' },
        { category: 'solution', theme: 'community',
          text: 'When a community plants trees together, it does more than help the environment. It builds shared purpose, pride, and a lasting bond among neighbours.' },
        { category: 'solution', theme: 'education',
          text: 'Schools and colleges can play a strong role by making tree plantation a regular activity. A child who plants a tree once tends to protect trees for life.' },
        { category: 'solution', theme: 'policy',
          text: 'Government policy also matters. Laws against illegal logging, support for farmers who plant trees, and protection of the forests that already exist are as important as planting new ones.' },

        // ── importance ──
        { category: 'importance', theme: 'importance-life',
          text: 'Trees are not optional for life on Earth; they are the base of it. Without them, oxygen, rainfall, fertile soil, and biodiversity would all break down within a single generation.' },
        { category: 'importance', theme: 'importance-economy',
          text: 'For a country like Bangladesh, tree plantation is economic policy as much as environmental policy. Forests protect crops, reduce damage from disasters, and support rural livelihoods.' },
        { category: 'importance', theme: 'importance-legacy',
          text: 'Planting trees is one of the few investments whose returns are measured in generations. It is a small act of faith in a future we may never see but that our children will.' },

        // ── examples ──
        { category: 'example', theme: 'example-kenya',
          text: 'The Green Belt Movement in Kenya, started by Wangari Maathai, planted more than fifty million trees and gave hundreds of thousands of women a source of income and dignity. It remains one of the most successful community-led plantation efforts in history.' },
        { category: 'example', theme: 'example-china',
          text: 'China Great Green Wall is a huge reforestation belt along the edge of the Gobi Desert. It has already planted billions of trees to stop the desert from spreading.' },
        { category: 'example', theme: 'example-bangladesh',
          text: 'Bangladesh Social Forestry Programme, started in the 1980s, has planted millions of trees along roads, embankments, and coastal belts. It protects coastal communities from cyclones while giving rural families a steady income.' },

        // ── context ──
        { category: 'context', theme: 'local-context',
          text: 'In Bangladesh, tree cover has shrunk from over twenty percent at independence to roughly eleven percent today. With the highest population density in the world, the pressure on forests has never been greater.' },

        // ── philosophical ──
        { category: 'philosophical', theme: 'legacy',
          text: 'A tree planted today will outlive the person who planted it. It becomes a quiet legacy; shade for strangers, fruit for birds, and cleaner air for children not yet born.' },
        { category: 'philosophical', theme: 'patience',
          text: 'Planting a tree teaches patience. It is an act of faith in a future we may not see and a small refusal to live only for the present moment.' }
    ],

    closers: [
    'So tree plantation is not just a good deed. It is a survival measure.',
    'Trees give far more than they take. Plant one. Protect one. That is the whole idea.',
    'If every person planted a single tree a year, the world would gain billions in ten years. That kind of change is possible.',
    'The best time to plant a tree was twenty years ago. The second best time is today.',
    'For a country like Bangladesh, tree plantation is not a choice. It is a promise.'
],





    keyPoints: [
        'Trees produce oxygen and absorb carbon dioxide.',
        'One mature tree absorbs about 22 kg of carbon dioxide per year.',
        'Roots prevent soil erosion and keep rivers clean.',
        'Forests bring rainfall and refill groundwater.',
        'Trees are homes for birds, insects, and animals.',
        'Forests shelter over 80 percent of land-based species.',
        'Trees cool the air by several degrees.',
        'Agroforestry improves soil fertility and farm income.',
        'Planting is easy; caring for the sapling is the real work.',
        'Community plantation builds social bonds too.',
        'China Great Green Wall and Kenya Green Belt are famous examples.',
        'Bangladesh forest cover has fallen to around 11 percent.',
        'A tree planted today outlives the person who planted it.',
        'The best time to plant a tree was twenty years ago; the second best time is today.'
    ],

    facts: [
        'Earth loses around 10 million hectares of forest every year.',
        'A mature tree absorbs around 22 kg of carbon dioxide annually.',
        'A single tree produces enough oxygen for two people per year.',
        'Forests cover about 31 percent of the Earth land area.',
        'Over 80 percent of land-based species live in forests.',
        'Bangladesh forest cover is roughly 11 percent of its land.',
        'China Great Green Wall has planted over 66 billion trees since 1978.',
        'Kenya Green Belt Movement planted over 51 million trees.',
        'One large tree can lift up to 100 gallons of water from the soil and release it into the air in a single day.',
        'Agriculture drives about 80 percent of tropical deforestation.'
    ],

    examples: [
        'Green Belt Movement (Kenya, 1977) started by Wangari Maathai; over 51 million trees planted.',
        'Great Green Wall (China, 1978) is a reforestation belt 4,500 km long to stop the Gobi Desert from spreading.',
        'Social Forestry Programme (Bangladesh, 1980s) planted trees along roads, embankments, and coastal belts.',
        'Billion Tree Tsunami (Pakistan, 2014 to 2017) restored 1 billion trees in Khyber Pakhtunkhwa.',
        'Ethiopia 2019 tree planting day: 350 million trees in a single day.'
    ],

    quotes: [
        '"The best time to plant a tree was twenty years ago. The second best time is today." Chinese Proverb',
        '"He who plants a tree plants a hope." Lucy Larcom',
        '"A nation that destroys its soils destroys itself." Franklin D. Roosevelt',
        '"The clearest way into the Universe is through a forest wilderness." John Muir',
        '"What we are doing to the forests of the world is a mirror reflection of what we are doing to ourselves." Mahatma Gandhi'
    ],

    sources: [
        'FAO Global Forest Resources Assessment',
        'UN Environment Programme',
        'IPCC Climate Change Reports',
        'World Wildlife Fund Forests',
        'Bangladesh Forest Department Annual Reports',
        'Global Forest Watch',
        'Green Belt Movement official archives',
        'One Tree Planted Tree Facts'
    ],

    relatedTopics: ['deforestation', 'climate-change', 'environmental-pollution', 'global-warming']
},






// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT (continued)
// ─────────────────────────────────────────────────────────────────────────

{
    id: 'deforestation',
    title: 'Deforestation',
    category: 'Environment',
    tags: ['environment', 'forests', 'climate', 'biodiversity', 'logging', 'agriculture', 'amazon', 'habitat-loss'],
    difficulty: 'school',
    aliases: /\bdeforestation\b|\bforest\s+clearing\b|\bclearing\s+(?:of\s+)?forests?\b|\bfelling\s+(?:of\s+)?trees?\b|\bcutting\s+down\s+(?:of\s+)?(?:forests?|trees?)\b/i,

    summary: 'Deforestation is the large-scale removal of forests, usually to make way for farming, logging, mining, or housing, and it carries serious consequences for the climate, wildlife, and human life.',

    openers: [
        'Deforestation is the quiet crisis of our time. Every year, an area of forest the size of a small country disappears. With it goes oxygen, rainfall, wildlife, and the way of life of millions of people.',
        'Forests have stood on this planet for hundreds of millions of years. In the last century, we have removed more of them than nature ever managed to destroy on its own.',
        'Deforestation does not happen in one dramatic moment. It happens tree by tree, tractor by tractor, until one day the forest is gone and the land below it is dry, eroded, and silent.',
        'When we picture environmental emergencies, we think of oil spills or plastic in the ocean. Deforestation is quieter. Its consequences are just as serious, and often just as permanent.',
        'The Earth loses roughly ten million hectares of forest every year. That works out to about one football field of forest every second. No amount of replanting can keep up with that rate.',
        'The world forests are being cleared faster than at any point in recorded history. This is deforestation, and understanding it is the first step toward slowing it down.',
        'What we are doing to the forests of the world is a mirror of what we are doing to ourselves. That line from Gandhi says everything about why deforestation is not just about trees.'
    ],

    body: [
        // ── definition ──
        { category: 'definition', theme: 'definition',
          text: 'Deforestation is the permanent removal of trees and forest cover from land, usually to convert it to another use. It includes both legal clearing, such as planned farming expansion, and illegal clearing, such as unauthorised logging. It is different from forest degradation, which is a loss of quality rather than a total loss of the forest.' },

        // ── causes ──
        { category: 'cause', theme: 'cause-agriculture',
          text: 'The biggest driver of deforestation is agriculture. Forests are cleared to make room for cattle ranching, soy plantations, palm oil, and other cash crops. The tropics carry most of this pressure, especially the Amazon, the Congo Basin, and Southeast Asia.' },
        { category: 'cause', theme: 'cause-logging',
          text: 'Commercial logging supplies the world demand for timber, paper, and furniture. Some of it is legal and selective, but illegal logging operates on a scale that dwarfs even the legal trade in many tropical countries.' },
        { category: 'cause', theme: 'cause-urbanisation',
          text: 'Fast urbanisation is another major cause. Cities grow, roads cut through forests, and settlements push deeper into areas that were once wild, to make room for more people.' },
        { category: 'cause', theme: 'cause-mining',
          text: 'Mining and other resource extraction carve forests away to reach oil, gas, coal, gold, and other minerals. Roads built for mining open the surrounding forest to more settlement and clearing.' },
        { category: 'cause', theme: 'cause-fires',
          text: 'Forest fires destroy millions of hectares every year, and many of them are set on purpose to clear land. In the Amazon, Indonesia, and Australia, fire seasons have grown longer and more severe with climate change.' },
        { category: 'cause', theme: 'cause-fuelwood',
          text: 'In many developing countries, millions of families still depend on firewood and charcoal for cooking. That steady demand strips trees from around rural communities, especially across Africa and South Asia.' },

        // ── effects ──
        { category: 'effect', theme: 'effect-carbon',
          text: 'Deforestation is a major driver of climate change. When forests are cut or burned, the carbon stored in their wood enters the atmosphere as carbon dioxide. Deforestation is responsible for roughly fifteen percent of all greenhouse gas emissions worldwide.' },
        { category: 'effect', theme: 'effect-biodiversity',
          text: 'Forests shelter more than eighty percent of land-based species. When the forest disappears, entire ecosystems fall apart. Birds, mammals, insects, and plants that depended on it disappear, often before science has even recorded them.' },
        { category: 'effect', theme: 'effect-soil',
          text: 'Without tree roots to hold it in place, soil washes away with the first heavy rain. Cleared land loses its fertility quickly, becomes prone to landslides, and can turn into barren ground within just a few years.' },
        { category: 'effect', theme: 'effect-water',
          text: 'Forests regulate the water cycle. Remove them and rainfall patterns shift, rivers dry up in the dry season, and floods become worse in the wet season. Millions of people who depend on forest-fed rivers lose their water supply.' },
        { category: 'effect', theme: 'effect-temperature',
          text: 'Deforestation raises local temperatures. Trees cool the air and provide shade. Without them, cleared land gets hotter and drier, and in some cases fertile regions turn into semi-desert through a process called desertification.' },
        { category: 'effect', theme: 'effect-indigenous',
          text: 'Deforestation forces indigenous communities off land their families have lived on for generations. Their languages, traditions, and knowledge of medicinal plants are lost along with the trees.' },
        { category: 'effect', theme: 'effect-economy',
          text: 'The economic benefits of deforestation are short-lived. The land stays productive for only a few years before the soil gives out. Over the long term, the loss of timber, tourism, and natural services costs far more than the wood ever earned.' },

        // ── solutions ──
        { category: 'solution', theme: 'solution-reforestation',
          text: 'Reforestation and afforestation help restore what was lost. That said, new plantations rarely match the complexity of an old-growth forest. Planting is not the same as protecting what already stands.' },
        { category: 'solution', theme: 'solution-laws',
          text: 'Strong laws and enforcement make a real difference. Countries that have succeeded in slowing deforestation, such as Costa Rica and Brazil in the 2000s, did it with strict regulation, satellite monitoring, and heavy fines for illegal clearing.' },
        { category: 'solution', theme: 'solution-indigenous',
          text: 'Protecting indigenous land rights is one of the most effective conservation strategies we have. Forests managed by indigenous communities suffer far less deforestation than those under government or corporate control.' },
        { category: 'solution', theme: 'solution-agriculture',
          text: 'Sustainable farming helps too. Higher yields on land that is already cleared, agroforestry, and lower meat consumption all reduce the pressure to cut new forest.' },
        { category: 'solution', theme: 'solution-consumers',
          text: 'Consumers have power here. Choosing products with FSC certification, avoiding unsustainably produced palm oil and beef, and cutting down on paper waste all reduce demand-side pressure on forests.' },
        { category: 'solution', theme: 'solution-international',
          text: 'International agreements like REDD+ pay developing countries to keep their forests standing. Debt-for-nature swaps and carbon credit markets offer similar incentives to protect rather than cut.' },

        // ── importance ──
        { category: 'importance', theme: 'importance-planetary',
          text: 'Forests are not optional for life on Earth. They produce oxygen, absorb carbon, regulate rainfall, and shelter biodiversity. Every hectare cut is a permanent loss of these services for the whole planet.' },
        { category: 'importance', theme: 'importance-future',
          text: 'The forests being cleared today would have stored carbon for centuries. Cutting them now commits us to future warming that will be felt by generations not yet born.' },

        // ── examples ──
        { category: 'example', theme: 'example-amazon',
          text: 'The Amazon rainforest has lost roughly seventeen percent of its area in the last fifty years, mostly to cattle ranching and soy farming. Scientists warn that past the twenty to twenty-five percent mark, the rainforest could tip into a permanent dry savanna.' },
        { category: 'example', theme: 'example-indonesia',
          text: 'Indonesia has cleared vast areas of tropical forest for palm oil plantations. During peak fire seasons, this has made the country one of the world top emitters of greenhouse gases.' },
        { category: 'example', theme: 'example-costa-rica',
          text: 'Costa Rica reversed decades of deforestation and now has over fifty percent forest cover, up from twenty-six percent in the 1980s. It is one of the most successful conservation stories in the world.' },
        { category: 'example', theme: 'example-bangladesh',
          text: 'Bangladesh has lost much of its historic forest cover, especially in the Chittagong Hill Tracts and along the edges of the Sundarbans. The Sundarbans, the largest mangrove forest in the world, is under pressure from shrimp farming, logging, and rising seas.' },

        // ── context ──
        { category: 'context', theme: 'context-history',
          text: 'Deforestation is not new. Europe and North America cleared most of their forests centuries ago to build cities and farms. What has changed is the scale and the speed, driven by global demand and industrial machinery.' },
        { category: 'context', theme: 'context-scale',
          text: 'At current rates, the world loses an area of forest roughly the size of Greece every year. The tropics carry the heaviest losses, but temperate and boreal forests face their own pressures from fire and pests.' },

        // ── philosophical ──
        { category: 'philosophical', theme: 'philosophical-loss',
          text: 'A forest takes centuries to grow and days to destroy. That asymmetry is the real tragedy. What we replace is never quite what we lost.' },
        { category: 'philosophical', theme: 'philosophical-choice',
          text: 'Every hectare of forest cleared is a choice. Not an accident, not a necessity, but a decision made somewhere, by someone, for a reason. Understanding those reasons is how we change them.' }
    ],

    closers: [
        'Deforestation is not a distant problem. It affects the air we breathe, the food we eat, and the climate our children will inherit.',
        'The answer is not to stop using forests. It is to use them wisely, protect what remains, and restore what has been lost.',
        'If the forests disappear, so does much of what makes this planet livable. Protecting them is not sentiment. It is survival.',
        'A forest cut down is a library burned and a pharmacy emptied. There is no shortcut to growing it back.',
        'The world forests are a shared inheritance. What we do with them in the next thirty years will shape the next three thousand.'
    ],

    keyPoints: [
        'Deforestation is the permanent removal of forest cover.',
        'The main cause is agriculture: cattle, soy, and palm oil.',
        'Other causes include logging, mining, urbanisation, and fuelwood.',
        'It accounts for about 15 percent of global greenhouse gas emissions.',
        'It destroys habitats for 80 percent of land-based species.',
        'It causes soil erosion, desertification, and disruption of the water cycle.',
        'It displaces indigenous communities and their knowledge.',
        'The Amazon has lost about 17 percent of its area in fifty years.',
        'Costa Rica reversed deforestation and now has over 50 percent forest cover.',
        'Solutions include laws, indigenous rights, sustainable farming, FSC products, and REDD+.'
    ],

    facts: [
        'The world loses about 10 million hectares of forest every year.',
        'That works out to roughly one football field of forest every second.',
        'Deforestation accounts for roughly 15 percent of global carbon dioxide emissions.',
        'The Amazon has lost about 17 percent of its area since 1970.',
        'Indonesia palm oil expansion has made it a top emitter during fire seasons.',
        'Costa Rica raised its forest cover from 26 percent in 1983 to over 50 percent today.',
        'Over 80 percent of land-based species live in forests.',
        'Indigenous-managed forests have much lower deforestation rates.',
        'Agriculture drives around 80 percent of tropical deforestation.',
        'Forests cover about 31 percent of the Earth land area, down from around 50 percent historically.'
    ],

    examples: [
        'Amazon Rainforest lost about 17 percent of its area in 50 years, mostly to cattle and soy.',
        'Indonesia cleared vast tropical forest for palm oil plantations.',
        'Costa Rica reversed deforestation and doubled its forest cover in 40 years.',
        'Chico Mendes movement in Brazil during the 1980s, rubber tappers who defended the Amazon.',
        'REDD+ programme, international payments to countries that reduce forest loss.'
    ],

    quotes: [
        '"What we are doing to the forests of the world is a mirror reflection of what we are doing to ourselves." Mahatma Gandhi',
        '"Forests are the lungs of our land, purifying the air and giving fresh strength to our people." Franklin D. Roosevelt',
        '"The Earth does not belong to us. We belong to the Earth." Chief Seattle',
        '"You cannot get through a single day without having an impact on the world around you." Jane Goodall',
        '"When the last tree has been cut down and the last river poisoned, only then will we realise that one cannot eat money." Cree Indian Proverb'
    ],

    sources: [
        'FAO Global Forest Resources Assessment',
        'UN Environment Programme Forest Programme',
        'Global Forest Watch',
        'IPCC Special Report on Climate Change and Land',
        'World Wildlife Fund Deforestation Fronts',
        'Bangladesh Forest Department Statistics',
        'Mongabay Global Forest Reporting'
    ],

    relatedTopics: ['tree-plantation', 'climate-change', 'global-warming', 'environmental-pollution']
}


// ─────────────────────────────────────────────────────────────────────────
// Add next topic here. The indexes rebuild automatically on load.
// ─────────────────────────────────────────────────────────────────────────

];


// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE API
// ═══════════════════════════════════════════════════════════════════════════

(function buildKnowledgeBase() {
    var topics = window.HSC_TOPICS || [];

    var byId = {};
    var byCategory = {};
    var byTag = {};
    var byDifficulty = {};

    for (var i = 0; i < topics.length; i++) {
        var t = topics[i];
        if (t.id) byId[t.id] = t;

        if (t.category) {
            if (!byCategory[t.category]) byCategory[t.category] = [];
            byCategory[t.category].push(t);
        }
        if (t.difficulty) {
            if (!byDifficulty[t.difficulty]) byDifficulty[t.difficulty] = [];
            byDifficulty[t.difficulty].push(t);
        }
        var tags = t.tags || [];
        for (var j = 0; j < tags.length; j++) {
            var tag = tags[j].toLowerCase();
            if (!byTag[tag]) byTag[tag] = [];
            byTag[tag].push(t);
        }
    }

    window.Knowledge = {
        version: '1.0.0',
        topics: topics,

        find: function (id) { return byId[id] || null; },

        findByText: function (text) {
            for (var i = 0; i < topics.length; i++) {
                if (topics[i].aliases && topics[i].aliases.test(text)) return topics[i];
            }
            return null;
        },

        findAll: function (text) {
            var found = [];
            for (var i = 0; i < topics.length; i++) {
                if (topics[i].aliases && topics[i].aliases.test(text)) found.push(topics[i]);
            }
            return found;
        },

        byCategory: function (cat) { return (byCategory[cat] || []).slice(); },
        categories: function () { return Object.keys(byCategory).sort(); },

        byTag: function (tag) { return (byTag[(tag || '').toLowerCase()] || []).slice(); },
        tags: function () { return Object.keys(byTag).sort(); },

        byDifficulty: function (d) { return (byDifficulty[d] || []).slice(); },

        related: function (id) {
            var t = byId[id];
            if (!t || !t.relatedTopics) return [];
            var out = [];
            for (var i = 0; i < t.relatedTopics.length; i++) {
                var r = byId[t.relatedTopics[i]];
                if (r) out.push(r);
            }
            return out;
        },

        search: function (query) {
            var q = String(query || '').toLowerCase().trim();
            if (!q) return [];
            var results = [];
            for (var i = 0; i < topics.length; i++) {
                var t = topics[i];
                var haystack = [t.title || '', t.summary || '', t.category || '']
                    .concat(t.tags || []).join(' ').toLowerCase();
                if (haystack.indexOf(q) !== -1) results.push(t);
            }
            return results;
        },

        fragments: function (id, category) {
            var t = byId[id];
            if (!t) return [];
            var body = t.body || [];
            if (!category) return body.slice();
            var out = [];
            for (var i = 0; i < body.length; i++) {
                if (body[i].category === category) out.push(body[i]);
            }
            return out;
        },

        stats: function () {
            var fragCount = 0, totalFacts = 0, totalExamples = 0, totalQuotes = 0;
            for (var i = 0; i < topics.length; i++) {
                fragCount += (topics[i].body || []).length;
                totalFacts += (topics[i].facts || []).length;
                totalExamples += (topics[i].examples || []).length;
                totalQuotes += (topics[i].quotes || []).length;
            }
            return {
                topics: topics.length,
                fragments: fragCount,
                facts: totalFacts,
                examples: totalExamples,
                quotes: totalQuotes,
                categories: Object.keys(byCategory).length,
                tags: Object.keys(byTag).length
            };
        },

        validate: function () { return this.validateFull().errors; },

        validateFull: function () {
            var errors = [];
            var warnings = [];
            var seenIds = {};

            for (var i = 0; i < topics.length; i++) {
                var t = topics[i];
                var path = 'topic[' + i + ']' + (t.id ? ' (' + t.id + ')' : '');

                if (!t.id) errors.push(path + ': missing id');
                else if (seenIds[t.id]) errors.push(path + ': duplicate id');
                else seenIds[t.id] = true;

                if (!t.title) errors.push(path + ': missing title');
                if (!t.category) errors.push(path + ': missing category');
                if (!t.aliases) errors.push(path + ': missing aliases');
                if (!t.summary) errors.push(path + ': missing summary');

                if (!Array.isArray(t.openers) || t.openers.length === 0)
                    errors.push(path + ': needs at least one opener');
                if (!Array.isArray(t.body) || t.body.length === 0)
                    errors.push(path + ': needs at least one body fragment');
                if (!Array.isArray(t.closers) || t.closers.length === 0)
                    errors.push(path + ': needs at least one closer');
                if (!Array.isArray(t.keyPoints) || t.keyPoints.length === 0)
                    errors.push(path + ': needs at least one keyPoint');

                var body = t.body || [];
                for (var b = 0; b < body.length; b++) {
                    var frag = body[b];
                    if (!frag.text) errors.push(path + '.body[' + b + ']: missing text');
                    if (!frag.category) errors.push(path + '.body[' + b + ']: missing category');
                    if (!frag.theme) errors.push(path + '.body[' + b + ']: missing theme');
                }
            }

            for (var k = 0; k < topics.length; k++) {
                var tk = topics[k];
                var pathK = 'topic[' + k + ']' + (tk.id ? ' (' + tk.id + ')' : '');
                var rel = tk.relatedTopics || [];
                for (var r = 0; r < rel.length; r++) {
                    if (!byId[rel[r]]) {
                        warnings.push(pathK + ': references "' + rel[r] + '" (not added yet)');
                    }
                }
            }

            return { errors: errors, warnings: warnings };
        }
    };

    try {
        var report = window.Knowledge.validateFull();
        if (report.errors.length) {
            console.warn('[Knowledge] ' + report.errors.length + ' error(s):');
            for (var e = 0; e < report.errors.length; e++) console.warn('  • ' + report.errors[e]);
        }
        if (report.warnings.length) {
            console.info('[Knowledge] ' + report.warnings.length +
                ' forward reference(s) to topics not added yet — safe to ignore.');
        }
    } catch (err) {
        console.warn('[Knowledge] Validation threw:', err);
    }
})();