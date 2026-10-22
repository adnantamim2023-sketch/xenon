// countries-data.js — Country knowledge base for Xenon.
// Each country: identity, geography, economy, society, key dates,
// history, culture, major events, rivers, neighbours.
// Derived values (populationDensity, gdpPerCapita) are computed once
// at load so every query path sees the same numbers.

(function (root) {
'use strict';

const C = root.XENON_COUNTRIES = [];

function add(o) {
  o.populationDensity = o.area ? +(o.population / o.area).toFixed(1) : null;
  if (!o.gdpPerCapita && o.gdp && o.population) o.gdpPerCapita = Math.round(o.gdp / o.population);
  if (!o.gnp) o.gnp = o.gdp;
  o.history = o.history || '';
  o.culture = o.culture || '';
  o.events = o.events || [];
  o.rivers = o.rivers || [];
  o.neighbors = o.neighbors || [];
  o.languages = o.languages || [];
  C.push(o);
}

// ─── SOUTH ASIA ──────────────────────────────────────────────
add({
  id: 'bangladesh', name: 'Bangladesh',
  aliases: /\b(?:bangladesh|bangla\s*desh)\b/i,
  capital: 'Dhaka', continent: 'Asia', subregion: 'South Asia',
  population: 173562364, area: 148460,
  gdp: 460.2e9, gdpGrowth: 6.0, hdi: 0.661,
  currency: 'Bangladeshi Taka (BDT)', languages: ['Bengali'],
  independence: { year: 1971, date: '26 March 1971', from: 'Pakistan' },
  nationalDay: { name: 'Independence Day', date: '26 March' },
  victoryDay: { name: 'Victory Day', date: '16 December 1971' },
  mourningDay: { name: 'National Mourning Day', date: '15 August' },
  history: 'Modern Bangladesh became independent in 1971 after a nine-month war of liberation against Pakistan. It was formerly East Pakistan and before 1947 was part of British India.',
  culture: 'Bengali culture dominates. The 1952 Language Movement made Bengali a symbol of national identity. Jamdani weaving, rickshaw art and Baul music are distinctive traditions.',
  events: ['Ekushey February — Language Martyrs\' Day (21 Feb)', 'Independence Day (26 March)', 'Pohela Boishakh — Bengali New Year (14 April)', 'Victory Day (16 December)', 'Eid ul-Fitr and Eid ul-Adha', 'Durga Puja'],
  rivers: ['Padma', 'Meghna', 'Jamuna', 'Brahmaputra', 'Karnaphuli', 'Teesta', 'Surma', 'Rupsa', 'Madhumati'],
  neighbors: ['india', 'myanmar'],
});

add({
  id: 'india', name: 'India',
  aliases: /\b(?:india|bharat)\b/i,
  capital: 'New Delhi', continent: 'Asia', subregion: 'South Asia',
  population: 1428627663, area: 3287263,
  gdp: 3.73e12, gdpGrowth: 7.0, hdi: 0.644,
  currency: 'Indian Rupee (INR)', languages: ['Hindi', 'English', 'and 21 other official languages'],
  independence: { year: 1947, date: '15 August 1947', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '15 August' },
  republicDay: { name: 'Republic Day', date: '26 January 1950' },
  history: 'India gained independence from Britain in 1947 after a long non-violent struggle. Partition split it into India and Pakistan (later Bangladesh).',
  culture: 'One of the most diverse cultures on Earth — 22 scheduled languages, every major religion, and classical arts from Bharatanatyam to Bollywood.',
  events: ['Republic Day (26 January)', 'Independence Day (15 August)', 'Gandhi Jayanti (2 October)', 'Diwali', 'Holi', 'Durga Puja and Eid'],
  rivers: ['Ganges', 'Yamuna', 'Brahmaputra', 'Godavari', 'Narmada', 'Krishna', 'Mahanadi', 'Kaveri', 'Indus', 'Tapti'],
  neighbors: ['bangladesh', 'pakistan', 'china', 'myanmar'],
});

add({
  id: 'pakistan', name: 'Pakistan',
  aliases: /\b(?:pakistan)\b/i,
  capital: 'Islamabad', continent: 'Asia', subregion: 'South Asia',
  population: 240485658, area: 881913,
  gdp: 375e9, gdpGrowth: 2.4, hdi: 0.540,
  currency: 'Pakistani Rupee (PKR)', languages: ['Urdu', 'English'],
  independence: { year: 1947, date: '14 August 1947', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '14 August' },
  history: 'Pakistan was created in 1947 as a homeland for South Asian Muslims, carved out of British India. It originally included East Pakistan, which became Bangladesh after the 1971 war.',
  culture: 'Pakistani culture mixes Punjabi, Sindhi, Pashtun and Baloch traditions. Sufi shrines, qawwali music, truck art and cricket are central to national life.',
  events: ['Pakistan Day (23 March)', 'Independence Day (14 August)', 'Iqbal Day (9 November)', 'Eid ul-Fitr and Eid ul-Adha'],
  rivers: ['Indus', 'Jhelum', 'Chenab', 'Ravi', 'Sutlej', 'Kabul'],
  neighbors: ['india', 'china', 'iran'],
});

// ─── EAST ASIA ───────────────────────────────────────────────
add({
  id: 'china', name: 'China',
  aliases: /\b(?:china|prc|people's\s+republic\s+of\s+china)\b/i,
  capital: 'Beijing', continent: 'Asia', subregion: 'East Asia',
  population: 1425671352, area: 9596961,
  gdp: 17.79e12, gdpGrowth: 5.2, hdi: 0.788,
  currency: 'Renminbi / Yuan (CNY)', languages: ['Mandarin Chinese'],
  independence: { year: 1949, date: '1 October 1949', from: 'Republic of China (civil war)' },
  nationalDay: { name: 'National Day', date: '1 October' },
  history: 'China has one of the oldest continuous civilizations, with dynasties stretching back over four thousand years. The PRC was founded in 1949 and since 1978 has become a major global economy.',
  culture: 'Chinese culture spans Confucian philosophy, tea ceremony, calligraphy and one of the world\'s great cuisines. Lunar New Year and Mid-Autumn Festival are the biggest celebrations.',
  events: ['Chinese New Year / Spring Festival', 'Qingming — tomb-sweeping day', 'Dragon Boat Festival', 'Mid-Autumn Festival', 'National Day (1 October)'],
  rivers: ['Yangtze', 'Yellow River', 'Pearl', 'Mekong', 'Amur', 'Brahmaputra'],
  neighbors: ['india', 'russia', 'pakistan', 'vietnam'],
});

add({
  id: 'japan', name: 'Japan',
  aliases: /\b(?:japan|nippon)\b/i,
  capital: 'Tokyo', continent: 'Asia', subregion: 'East Asia',
  population: 123294513, area: 377975,
  gdp: 4.21e12, gdpGrowth: 1.9, hdi: 0.920,
  currency: 'Japanese Yen (JPY)', languages: ['Japanese'],
  independence: { year: 1952, date: '28 April 1952', from: 'Allied occupation (post-WWII)' },
  nationalDay: { name: 'National Foundation Day', date: '11 February' },
  history: 'Japan emerged from feudal rule in 1868 with the Meiji Restoration, industrialising rapidly. After defeat in WWII it rebuilt into one of the world\'s largest economies and a stable democracy.',
  culture: 'Japanese culture blends Shinto and Buddhist traditions with tea ceremony, kabuki, sumo and anime. Cherry-blossom season and the New Year are national obsessions.',
  events: ['Shōgatsu — New Year', 'Hanami — cherry blossom viewing', 'Golden Week (late April–early May)', 'Obon — festival of ancestors', 'National Foundation Day (11 February)'],
  rivers: ['Shinano', 'Tone', 'Ishikari', 'Kitakami'],
  neighbors: [],
});

add({
  id: 'south-korea', name: 'South Korea',
  aliases: /\b(?:south\s+korea|republic\s+of\s+korea|rok)\b/i,
  capital: 'Seoul', continent: 'Asia', subregion: 'East Asia',
  population: 51712621, area: 100363,
  gdp: 1.71e12, gdpGrowth: 1.4, hdi: 0.929,
  currency: 'South Korean Won (KRW)', languages: ['Korean'],
  independence: { year: 1948, date: '15 August 1948', from: 'Japanese rule / US military administration' },
  nationalDay: { name: 'Liberation Day', date: '15 August' },
  history: 'Korea was under Japanese rule from 1910 to 1945. After WWII the peninsula was divided; South Korea was founded in 1948 and after the Korean War (1950–53) transformed into an industrial democracy.',
  culture: 'K-pop, K-dramas, Korean cuisine and traditional arts like pansori are globally popular today. Confucian values still shape daily manners and hierarchy.',
  events: ['Seollal — Lunar New Year', 'Chuseok — harvest festival', 'Liberation Day (15 August)', 'Gaecheonjeol — National Foundation Day (3 October)', 'Hangul Day (9 October)'],
  rivers: ['Han', 'Nakdong', 'Geum', 'Imjin'],
  neighbors: ['north-korea'],
});

add({
  id: 'north-korea', name: 'North Korea',
  aliases: /\b(?:north\s+korea|dprk|democratic\s+people's\s+republic\s+of\s+korea)\b/i,
  capital: 'Pyongyang', continent: 'Asia', subregion: 'East Asia',
  population: 26160821, area: 120538,
  gdp: 28e9, gdpGrowth: 0.5, hdi: 0.400,
  currency: 'North Korean Won (KPW)', languages: ['Korean'],
  independence: { year: 1948, date: '9 September 1948', from: 'Soviet military administration' },
  nationalDay: { name: 'Day of the Foundation of the Republic', date: '9 September' },
  history: 'North Korea was founded in 1948 under Soviet influence. The Korean War (1950–53) ended in a ceasefire with no peace treaty, and the country remains an isolated one-party state under the Kim dynasty.',
  culture: 'North Korean culture is tightly controlled by the state, emphasising Juche ideology, collective identity and loyalty to the leadership.',
  events: ['Day of the Sun — Kim Il-sung\'s birthday (15 April)', 'Day of the Foundation of the Republic (9 September)', 'Victory Day (27 July)'],
  rivers: ['Yalu', 'Tumen', 'Taedong'],
  neighbors: ['south-korea', 'china', 'russia'],
});

// ─── NORTH AMERICA ──────────────────────────────────────────
add({
  id: 'usa', name: 'United States',
  aliases: /\b(?:usa|united\s+states(?:\s+of\s+america)?|u\.s\.a?\.?|the\s+us)\b/i,
  capital: 'Washington, D.C.', continent: 'North America', subregion: 'North America',
  population: 339996563, area: 9833517,
  gdp: 27.36e12, gdpGrowth: 2.5, hdi: 0.927,
  currency: 'US Dollar (USD)', languages: ['English (de facto)'],
  independence: { year: 1776, date: '4 July 1776', from: 'Great Britain' },
  nationalDay: { name: 'Independence Day', date: '4 July' },
  history: 'The United States declared independence from Britain in 1776 and won it after the Revolutionary War. It expanded westward across the continent in the 19th century and became a global superpower after WWII.',
  culture: 'American culture is famously diverse, drawing on immigrant traditions from around the world. Hollywood, jazz, blues, hip-hop and fast food are its most globally recognised exports.',
  events: ['Independence Day (4 July)', 'Thanksgiving (fourth Thursday of November)', 'Martin Luther King Jr. Day (third Monday of January)', 'Memorial Day (last Monday of May)', 'Veterans Day (11 November)'],
  rivers: ['Mississippi', 'Missouri', 'Colorado', 'Rio Grande', 'Yukon', 'Columbia'],
  neighbors: ['canada', 'mexico'],
});

add({
  id: 'canada', name: 'Canada',
  aliases: /\b(?:canada)\b/i,
  capital: 'Ottawa', continent: 'North America', subregion: 'North America',
  population: 38781291, area: 9984670,
  gdp: 2.14e12, gdpGrowth: 1.5, hdi: 0.935,
  currency: 'Canadian Dollar (CAD)', languages: ['English', 'French'],
  independence: { year: 1867, date: '1 July 1867', from: 'United Kingdom (Confederation)' },
  nationalDay: { name: 'Canada Day', date: '1 July' },
  history: 'Canada became a self-governing dominion in 1867 through Confederation. Full legal independence from Britain came with the 1982 Constitution Act.',
  culture: 'Bilingual, multicultural, and famously polite. Hockey, maple syrup and vast wilderness are touchstones of Canadian identity.',
  events: ['Canada Day (1 July)', 'Thanksgiving (second Monday of October)', 'Victoria Day (last Monday before 25 May)', 'Remembrance Day (11 November)'],
  rivers: ['Mackenzie', 'Yukon', 'St. Lawrence', 'Fraser', 'Nelson'],
  neighbors: ['usa'],
});

add({
  id: 'mexico', name: 'Mexico',
  aliases: /\b(?:mexico|méxico)\b/i,
  capital: 'Mexico City', continent: 'North America', subregion: 'North America',
  population: 128455567, area: 1964375,
  gdp: 1.79e12, gdpGrowth: 3.2, hdi: 0.781,
  currency: 'Mexican Peso (MXN)', languages: ['Spanish'],
  independence: { year: 1821, date: '16 September 1821', from: 'Spain' },
  nationalDay: { name: 'Independence Day', date: '16 September' },
  history: 'Mexico won independence from Spain in 1821. The 1910–20 revolution reshaped the country into a modern federal republic.',
  culture: 'Mexico has one of the richest cultural traditions in the Americas — Maya and Aztec heritage, Día de los Muertos, mariachi, and one of the world\'s great cuisines.',
  events: ['Día de los Muertos (1–2 November)', 'Independence Day (16 September)', 'Cinco de Mayo (5 May)', 'Revolution Day (third Monday of November)'],
  rivers: ['Rio Grande', 'Usumacinta', 'Grijalva', 'Balsas'],
  neighbors: ['usa'],
});

// ─── EUROPE ──────────────────────────────────────────────────
add({
  id: 'uk', name: 'United Kingdom',
  aliases: /\b(?:uk|united\s+kingdom|britain|great\s+britain)\b/i,
  capital: 'London', continent: 'Europe', subregion: 'Western Europe',
  population: 67736802, area: 243610,
  gdp: 3.34e12, gdpGrowth: 0.1, hdi: 0.940,
  currency: 'British Pound Sterling (GBP)', languages: ['English'],
  independence: null, nationalDay: null,
  history: 'The United Kingdom was formed by the union of England and Scotland in 1707, later including Ireland (1801–1922). It led the Industrial Revolution and was the largest empire in history before decolonisation in the 20th century.',
  culture: 'British culture spans Shakespeare, the Beatles, tea traditions, football and a strong literary and scientific heritage.',
  events: ['New Year\'s Day (1 January)', 'Bonfire Night (5 November)', 'Remembrance Day (11 November)', 'Christmas Day and Boxing Day'],
  rivers: ['Thames', 'Severn', 'Trent', 'Mersey', 'Clyde'],
  neighbors: ['ireland'],
});

add({
  id: 'france', name: 'France',
  aliases: /\b(?:france)\b/i,
  capital: 'Paris', continent: 'Europe', subregion: 'Western Europe',
  population: 64756584, area: 551695,
  gdp: 3.03e12, gdpGrowth: 0.9, hdi: 0.910,
  currency: 'Euro (EUR)', languages: ['French'],
  independence: null,
  nationalDay: { name: 'Bastille Day', date: '14 July' },
  history: 'The French Revolution of 1789 ended the monarchy and reshaped European politics. France has since been a republic (with interruptions), a major colonial power and a founding member of the EU.',
  culture: 'France is known for its art, philosophy, cuisine and fashion. The Louvre, Impressionism, Bordeaux wines and the Cannes Film Festival are all exports of French culture.',
  events: ['Bastille Day (14 July)', 'Fête de la Musique (21 June)', 'Christmas and New Year'],
  rivers: ['Seine', 'Loire', 'Rhône', 'Garonne', 'Rhine'],
  neighbors: ['germany', 'italy', 'spain'],
});

add({
  id: 'germany', name: 'Germany',
  aliases: /\b(?:germany|deutschland)\b/i,
  capital: 'Berlin', continent: 'Europe', subregion: 'Western Europe',
  population: 83294633, area: 357022,
  gdp: 4.46e12, gdpGrowth: -0.3, hdi: 0.950,
  currency: 'Euro (EUR)', languages: ['German'],
  independence: null,
  nationalDay: { name: 'German Unity Day', date: '3 October' },
  history: 'Germany unified in 1871, was defeated in both World Wars, and was split during the Cold War. The Berlin Wall fell in 1989 and reunification followed in 1990.',
  culture: 'Germany has deep traditions in philosophy, classical music, engineering and beer culture. Oktoberfest, Christmas markets and the Autobahn are globally known.',
  events: ['German Unity Day (3 October)', 'Oktoberfest (late September – early October)', 'Karneval / Fasching', 'Christmas markets (December)'],
  rivers: ['Rhine', 'Danube', 'Elbe', 'Oder', 'Weser'],
  neighbors: ['france', 'poland'],
});

add({
  id: 'italy', name: 'Italy',
  aliases: /\b(?:italy|italia)\b/i,
  capital: 'Rome', continent: 'Europe', subregion: 'Southern Europe',
  population: 58870762, area: 301340,
  gdp: 2.26e12, gdpGrowth: 0.7, hdi: 0.906,
  currency: 'Euro (EUR)', languages: ['Italian'],
  independence: { year: 1861, date: '17 March 1861', from: 'Austrian Empire and various states (unification)' },
  nationalDay: { name: 'Festa della Repubblica', date: '2 June' },
  history: 'Italy was unified in 1861 after centuries of fragmented city-states and foreign rule. It became a republic in 1946 after WWII.',
  culture: 'Italy is home to the Renaissance, Roman ruins, the Vatican, and one of the world\'s most beloved cuisines. Opera, fashion and football are central to its identity.',
  events: ['New Year\'s Day', 'Festa della Repubblica (2 June)', 'Ferragosto (15 August)', 'Venice Carnival', 'Christmas and Easter'],
  rivers: ['Po', 'Tiber', 'Arno', 'Adige'],
  neighbors: ['france', 'switzerland'],
});

add({
  id: 'spain', name: 'Spain',
  aliases: /\b(?:spain|españa|espana)\b/i,
  capital: 'Madrid', continent: 'Europe', subregion: 'Southern Europe',
  population: 48486294, area: 505990,
  gdp: 1.62e12, gdpGrowth: 2.4, hdi: 0.911,
  currency: 'Euro (EUR)', languages: ['Spanish'],
  independence: { year: 1492, date: '1492', from: 'Reconquista (unification of Castile and Aragon)' },
  nationalDay: { name: 'Fiesta Nacional', date: '12 October' },
  history: 'Spain became a unified kingdom in 1492 after the Reconquista and went on to build one of history\'s largest empires. It became a democracy after Franco\'s death in 1975.',
  culture: 'Flamenco, tapas, bullfighting (in some regions), Picasso, Gaudí and La Tomatina — Spain has an outsized cultural footprint.',
  events: ['Fiesta Nacional (12 October)', 'La Tomatina (last Wednesday of August)', 'Semana Santa (Easter week)', 'Running of the Bulls (July, Pamplona)'],
  rivers: ['Ebro', 'Tagus', 'Guadalquivir', 'Douro'],
  neighbors: ['france', 'portugal'],
});

add({
  id: 'russia', name: 'Russia',
  aliases: /\b(?:russia|russian\s+federation)\b/i,
  capital: 'Moscow', continent: 'Europe / Asia', subregion: 'Eastern Europe / Northern Asia',
  population: 144444359, area: 17098246,
  gdp: 2.02e12, gdpGrowth: 3.6, hdi: 0.821,
  currency: 'Russian Ruble (RUB)', languages: ['Russian'],
  independence: { year: 1991, date: '26 December 1991', from: 'Soviet Union (dissolution)' },
  nationalDay: { name: 'Russia Day', date: '12 June' },
  history: 'Russia emerged as a major power under the Tsars, then became the core of the Soviet Union from 1922 to 1991. It is the world\'s largest country by area.',
  culture: 'Russia has deep traditions in literature (Tolstoy, Dostoevsky), classical music (Tchaikovsky), ballet and Orthodox Christianity.',
  events: ['Russia Day (12 June)', 'Victory Day (9 May)', 'New Year (the biggest holiday)', 'Maslenitsa — pancake week'],
  rivers: ['Volga', 'Yenisei', 'Ob', 'Lena', 'Amur', 'Don'],
  neighbors: ['china', 'north-korea'],
});

// ─── SOUTH AMERICA ──────────────────────────────────────────
add({
  id: 'brazil', name: 'Brazil',
  aliases: /\b(?:brazil|brasil)\b/i,
  capital: 'Brasília', continent: 'South America', subregion: 'South America',
  population: 216422446, area: 8515767,
  gdp: 2.17e12, gdpGrowth: 2.9, hdi: 0.760,
  currency: 'Brazilian Real (BRL)', languages: ['Portuguese'],
  independence: { year: 1822, date: '7 September 1822', from: 'Portugal' },
  nationalDay: { name: 'Independence Day', date: '7 September' },
  history: 'Brazil was a Portuguese colony until 1822, when it declared independence and became an empire, then a republic in 1889. It is the largest country in South America.',
  culture: 'Brazil is famous for samba, bossa nova, football and Carnival. It has the largest Japanese diaspora outside Japan and a strong Afro-Brazilian heritage.',
  events: ['Carnival (February or March)', 'Independence Day (7 September)', 'Festa Junina (June)', 'New Year\'s Eve on Copacabana beach'],
  rivers: ['Amazon', 'Paraná', 'São Francisco', 'Negro', 'Madeira'],
  neighbors: ['argentina', 'peru'],
});

// ─── OCEANIA ─────────────────────────────────────────────────
add({
  id: 'australia', name: 'Australia',
  aliases: /\b(?:australia|aussie|commonwealth\s+of\s+australia)\b/i,
  capital: 'Canberra', continent: 'Oceania', subregion: 'Australasia',
  population: 26439111, area: 7692024,
  gdp: 1.72e12, gdpGrowth: 2.0, hdi: 0.946,
  currency: 'Australian Dollar (AUD)', languages: ['English'],
  independence: { year: 1901, date: '1 January 1901', from: 'United Kingdom (Federation)' },
  nationalDay: { name: 'Australia Day', date: '26 January' },
  history: 'Australia was inhabited by Aboriginal peoples for over 60,000 years. Britain colonised it in 1788, and it became a federation of six states in 1901.',
  culture: 'Australian culture blends Aboriginal heritage with British colonial roots and multicultural immigration. Surfing, cricket and the outdoors are central.',
  events: ['Australia Day (26 January)', 'Anzac Day (25 April)', 'NAIDOC Week (July)', 'Melbourne Cup (first Tuesday of November)'],
  rivers: ['Murray', 'Darling', 'Murrumbidgee'],
  neighbors: [],
});

// ─── SOUTHEAST ASIA ──────────────────────────────────────────
add({
  id: 'indonesia', name: 'Indonesia',
  aliases: /\b(?:indonesia)\b/i,
  capital: 'Jakarta', continent: 'Asia', subregion: 'Southeast Asia',
  population: 277534122, area: 1904569,
  gdp: 1.37e12, gdpGrowth: 5.0, hdi: 0.705,
  currency: 'Indonesian Rupiah (IDR)', languages: ['Indonesian'],
  independence: { year: 1945, date: '17 August 1945', from: 'Netherlands' },
  nationalDay: { name: 'Independence Day', date: '17 August' },
  history: 'Indonesia declared independence from the Netherlands in 1945 after centuries of Dutch colonial rule. It is the world\'s largest archipelagic state, with over 17,000 islands.',
  culture: 'Indonesia is home to over 300 ethnic groups, from Javanese and Sundanese to Balinese. Batik, wayang puppetry and gamelan music are UNESCO-recognised traditions.',
  events: ['Independence Day (17 August)', 'Nyepi — Balinese day of silence', 'Eid ul-Fitr (the largest holiday)', 'Waisak — Buddhist festival at Borobudur'],
  rivers: ['Kapuas', 'Barito', 'Mahakam', 'Musi'],
  neighbors: ['malaysia', 'papua-new-guinea'],
});

add({
  id: 'singapore', name: 'Singapore',
  aliases: /\b(?:singapore)\b/i,
  capital: 'Singapore', continent: 'Asia', subregion: 'Southeast Asia',
  population: 6014723, area: 734,
  gdp: 501.4e9, gdpGrowth: 1.1, hdi: 0.949,
  currency: 'Singapore Dollar (SGD)', languages: ['English', 'Mandarin', 'Malay', 'Tamil'],
  independence: { year: 1965, date: '9 August 1965', from: 'Malaysia' },
  nationalDay: { name: 'National Day', date: '9 August' },
  history: 'Singapore was a British trading post from 1819, briefly part of Malaysia, and became fully independent in 1965. It grew from a fishing village into one of the world\'s richest countries in a single generation.',
  culture: 'A multicultural melting pot of Chinese, Malay, Indian and Eurasian communities. Hawker centres, HDB flats and meritocracy are defining features.',
  events: ['Chinese New Year', 'Hari Raya Puasa and Hari Raya Haji', 'Vesak Day', 'National Day (9 August)', 'Deepavali'],
  rivers: ['Singapore River'],
  neighbors: ['malaysia'],
});

add({
  id: 'vietnam', name: 'Vietnam',
  aliases: /\b(?:vietnam|viet\s+nam)\b/i,
  capital: 'Hanoi', continent: 'Asia', subregion: 'Southeast Asia',
  population: 98858950, area: 331212,
  gdp: 430e9, gdpGrowth: 5.0, hdi: 0.726,
  currency: 'Vietnamese Dong (VND)', languages: ['Vietnamese'],
  independence: { year: 1945, date: '2 September 1945', from: 'France' },
  nationalDay: { name: 'Independence Day', date: '2 September' },
  history: 'Vietnam won independence from France in 1945 and reunified in 1976 after the Vietnam War. Since the 1980s, economic reforms (Đổi Mới) have transformed it into a major manufacturer.',
  culture: 'Vietnam has a strong Confucian-Buddhist heritage, with traditions in water puppetry, Áo dài dress and one of the world\'s great street-food cultures.',
  events: ['Tết — Lunar New Year', 'Independence Day (2 September)', 'Mid-Autumn Festival', 'Hùng Kings Commemoration (April)'],
  rivers: ['Mekong', 'Red River', 'Perfume'],
  neighbors: ['china', 'laos', 'cambodia'],
});

add({
  id: 'thailand', name: 'Thailand',
  aliases: /\b(?:thailand|siam)\b/i,
  capital: 'Bangkok', continent: 'Asia', subregion: 'Southeast Asia',
  population: 71801279, area: 513120,
  gdp: 514.9e9, gdpGrowth: 1.9, hdi: 0.803,
  currency: 'Thai Baht (THB)', languages: ['Thai'],
  independence: null,
  nationalDay: { name: 'King\'s Birthday / National Day', date: '5 December' },
  history: 'Thailand (formerly Siam) is the only Southeast Asian nation never colonised by a European power. It became a constitutional monarchy in 1932.',
  culture: 'Buddhism permeates Thai life, with over 90% of the population practising. Thai cuisine, massage and kickboxing are globally popular.',
  events: ['Songkran — Thai New Year (13–15 April)', 'Loy Krathong (November)', 'King\'s Birthday / National Day (5 December)'],
  rivers: ['Chao Phraya', 'Mekong', 'Chi', 'Mun'],
  neighbors: ['malaysia', 'laos', 'cambodia', 'myanmar'],
});

add({
  id: 'philippines', name: 'Philippines',
  aliases: /\b(?:philippines|the\s+philippines)\b/i,
  capital: 'Manila', continent: 'Asia', subregion: 'Southeast Asia',
  population: 117337368, area: 342353,
  gdp: 437.1e9, gdpGrowth: 5.3, hdi: 0.710,
  currency: 'Philippine Peso (PHP)', languages: ['Filipino', 'English'],
  independence: { year: 1946, date: '4 July 1946', from: 'United States' },
  nationalDay: { name: 'Independence Day', date: '12 June' },
  history: 'The Philippines was a Spanish colony for over 300 years, then an American territory, before becoming fully independent in 1946.',
  culture: 'Filipino culture blends Malay, Spanish and American influences. Karaoke, basketball and family-centric values are distinctly Filipino.',
  events: ['Independence Day (12 June)', 'Christmas (the longest in the world)', 'Sinulog Festival (January)', 'Ati-Atihan Festival'],
  rivers: ['Cagayan', 'Mindanao', 'Agno', 'Pampanga'],
  neighbors: [],
});

add({
  id: 'malaysia', name: 'Malaysia',
  aliases: /\b(?:malaysia)\b/i,
  capital: 'Kuala Lumpur', continent: 'Asia', subregion: 'Southeast Asia',
  population: 34308525, area: 330803,
  gdp: 445e9, gdpGrowth: 3.7, hdi: 0.807,
  currency: 'Malaysian Ringgit (MYR)', languages: ['Malay', 'English'],
  independence: { year: 1957, date: '31 August 1957', from: 'United Kingdom' },
  nationalDay: { name: 'Hari Merdeka', date: '31 August' },
  history: 'Malaysia gained independence from Britain in 1957. It formed in its current shape in 1963, when Sabah, Sarawak and (briefly) Singapore joined.',
  culture: 'Malaysia is a multi-ethnic society of Malay, Chinese and Indian communities. Its food — nasi lemak, laksa, roti canai — is a living expression of that mix.',
  events: ['Hari Merdeka (31 August)', 'Chinese New Year', 'Hari Raya Puasa and Hari Raya Haji', 'Deepavali'],
  rivers: ['Rajang', 'Kinabatangan', 'Baram'],
  neighbors: ['thailand', 'indonesia', 'singapore'],
});

// ─── AFRICA ─────────────────────────────────────────────────
add({
  id: 'nigeria', name: 'Nigeria',
  aliases: /\b(?:nigeria)\b/i,
  capital: 'Abuja', continent: 'Africa', subregion: 'West Africa',
  population: 223804632, area: 923768,
  gdp: 472.6e9, gdpGrowth: 2.9, hdi: 0.548,
  currency: 'Nigerian Naira (NGN)', languages: ['English', 'Hausa', 'Yoruba', 'Igbo'],
  independence: { year: 1960, date: '1 October 1960', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '1 October' },
  history: 'Nigeria gained independence from Britain in 1960 and became a republic in 1963. It is Africa\'s most populous country and a major oil producer.',
  culture: 'Nigeria is home to over 250 ethnic groups. "Nollywood" (Nigeria\'s film industry) is one of the world\'s largest, and Afrobeats music has gone global.',
  events: ['Independence Day (1 October)', 'Eid ul-Fitr and Eid ul-Adha', 'Osun-Osogbo Festival', 'New Yam Festival (Igbo)'],
  rivers: ['Niger', 'Benue', 'Cross'],
  neighbors: [],
});

add({
  id: 'egypt', name: 'Egypt',
  aliases: /\b(?:egypt|misr)\b/i,
  capital: 'Cairo', continent: 'Africa', subregion: 'North Africa',
  population: 112716598, area: 1002450,
  gdp: 398.4e9, gdpGrowth: 3.8, hdi: 0.728,
  currency: 'Egyptian Pound (EGP)', languages: ['Arabic'],
  independence: { year: 1922, date: '28 February 1922', from: 'United Kingdom' },
  nationalDay: { name: 'Revolution Day', date: '23 July' },
  history: 'Egypt is one of the oldest civilisations, with pharaonic history stretching back over 5,000 years. It became a republic in 1953 after the 1952 revolution.',
  culture: 'Egyptian culture blends ancient pharaonic heritage with Arab, Coptic and Mediterranean influences. Cairo\'s Al-Azhar and the pyramids are national symbols.',
  events: ['Revolution Day (23 July)', 'Eid ul-Fitr and Eid ul-Adha', 'Coptic Christmas (7 January)', 'Sham el-Nessim — spring festival'],
  rivers: ['Nile'],
  neighbors: [],
});

add({
  id: 'south-africa', name: 'South Africa',
  aliases: /\b(?:south\s+africa|rsa)\b/i,
  capital: 'Pretoria (executive), Cape Town (legislative), Bloemfontein (judicial)',
  continent: 'Africa', subregion: 'Southern Africa',
  population: 60414495, area: 1221037,
  gdp: 377.8e9, gdpGrowth: 0.6, hdi: 0.717,
  currency: 'South African Rand (ZAR)',
  languages: ['Zulu', 'Xhosa', 'Afrikaans', 'English', 'and 7 others'],
  independence: { year: 1910, date: '31 May 1910', from: 'United Kingdom (Union); republic 1961' },
  nationalDay: { name: 'Freedom Day', date: '27 April' },
  history: 'South Africa was formed as a union of British colonies in 1910. The apartheid system (1948–1994) ended with Nelson Mandela\'s election in 1994.',
  culture: 'The "Rainbow Nation" has 11 official languages. Ubuntu philosophy, braai (barbecue) and a rich tradition of music and dance are central.',
  events: ['Freedom Day (27 April)', 'Human Rights Day (21 March)', 'Heritage Day (24 September)', 'Mandela Day (18 July)'],
  rivers: ['Orange', 'Vaal', 'Limpopo'],
  neighbors: [],
});

// ─── MIDDLE EAST ────────────────────────────────────────────
add({
  id: 'saudi-arabia', name: 'Saudi Arabia',
  aliases: /\b(?:saudi\s+arabia|ksa)\b/i,
  capital: 'Riyadh', continent: 'Asia', subregion: 'Middle East',
  population: 36947025, area: 2149690,
  gdp: 1.07e12, gdpGrowth: -0.8, hdi: 0.875,
  currency: 'Saudi Riyal (SAR)', languages: ['Arabic'],
  independence: { year: 1932, date: '23 September 1932', from: 'Unification of Hejaz and Nejd' },
  nationalDay: { name: 'Saudi National Day', date: '23 September' },
  history: 'Saudi Arabia was unified under Ibn Saud in 1932. The discovery of oil in 1938 transformed it into one of the world\'s wealthiest nations.',
  culture: 'Saudi culture is deeply rooted in Islam — Mecca and Medina are its holiest cities. Traditional arts, camel racing and coffee ceremonies are important.',
  events: ['Saudi National Day (23 September)', 'Eid ul-Fitr and Eid ul-Adha', 'Hajj pilgrimage', 'Founding Day (22 February)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'turkey', name: 'Turkey',
  aliases: /\b(?:turkey|türkiye|turkiye)\b/i,
  capital: 'Ankara', continent: 'Asia / Europe', subregion: 'Middle East / Southeastern Europe',
  population: 85816199, area: 783562,
  gdp: 1.12e12, gdpGrowth: 4.5, hdi: 0.855,
  currency: 'Turkish Lira (TRY)', languages: ['Turkish'],
  independence: { year: 1923, date: '29 October 1923', from: 'Ottoman Empire (republic)' },
  nationalDay: { name: 'Republic Day', date: '29 October' },
  history: 'Modern Turkey was founded in 1923 by Mustafa Kemal Atatürk after the collapse of the Ottoman Empire. It bridges Europe and Asia across the Bosphorus.',
  culture: 'Turkish culture blends Ottoman heritage with Anatolian folk traditions. Tea, kebabs, hamams and Turkish carpets are iconic.',
  events: ['Republic Day (29 October)', 'Victory Day (30 August)', 'Eid ul-Fitr and Eid ul-Adha', 'Commemoration of Atatürk (10 November)'],
  rivers: ['Kızılırmak', 'Tigris', 'Euphrates', 'Sakarya'],
  neighbors: [],
});

add({
  id: 'iran', name: 'Iran',
  aliases: /\b(?:iran|persia)\b/i,
  capital: 'Tehran', continent: 'Asia', subregion: 'Middle East',
  population: 89172767, area: 1648195,
  gdp: 401.5e9, gdpGrowth: 5.0, hdi: 0.780,
  currency: 'Iranian Rial (IRR)', languages: ['Persian (Farsi)'],
  independence: { year: 1979, date: '11 February 1979', from: 'Monarchy (Islamic Republic)' },
  nationalDay: { name: 'Islamic Republic Day', date: '1 April' },
  history: 'Iran was the ancient Persian Empire, one of the world\'s oldest civilisations. It became an Islamic Republic in 1979 after the revolution.',
  culture: 'Iranian culture goes back to Zoroastrian and Persian imperial traditions. Nowruz, Persian poetry and carpets are central to its identity.',
  events: ['Nowruz — Persian New Year (20 or 21 March)', 'Islamic Republic Day (1 April)', 'Yalda Night (winter solstice)', 'Chaharshanbe Suri (fire festival)'],
  rivers: ['Karun', 'Sefid Rud', 'Zayandeh Rud'],
  neighbors: ['iraq', 'turkey', 'pakistan'],
});

add({
  id: 'iraq', name: 'Iraq',
  aliases: /\b(?:iraq)\b/i,
  capital: 'Baghdad', continent: 'Asia', subregion: 'Middle East',
  population: 45504560, area: 438317,
  gdp: 250.8e9, gdpGrowth: -2.9, hdi: 0.673,
  currency: 'Iraqi Dinar (IQD)', languages: ['Arabic', 'Kurdish'],
  independence: { year: 1932, date: '3 October 1932', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '3 October' },
  history: 'Iraq is ancient Mesopotamia — the "cradle of civilisation" — home to Sumer, Babylon and Assyria. It became independent from Britain in 1932.',
  culture: 'Iraq has deep roots in Islamic scholarship, and its cuisine (masgouf, dolma) and date palm cultivation are famous across the region.',
  events: ['Independence Day (3 October)', 'Nowruz — Kurdish New Year (21 March)', 'Eid ul-Fitr and Eid ul-Adha'],
  rivers: ['Tigris', 'Euphrates'],
  neighbors: ['iran', 'turkey', 'kuwait', 'saudi-arabia'],
});



// ─── MICROSTATES & SMALLEST COUNTRIES ───────────────────────
// The 21 smallest sovereign states by area, so superlatives like
// "smallest country" and "smallest country by population" and
// "highest population density" return real answers instead of the
// bottom of the main list.

add({
  id: 'vatican-city', name: 'Vatican City',
  aliases: /\bvatican\s+city\b|\bholy\s+see\b|\bvatican\b/i,
  capital: 'Vatican City', continent: 'Europe', subregion: 'Southern Europe',
  population: 764, area: 0.49,
  gdp: 21e6, gdpGrowth: 0, hdi: null,
  currency: 'Euro (EUR)', languages: ['Italian', 'Latin'],
  independence: { year: 1929, date: '11 February 1929', from: 'Italy (Lateran Treaty)' },
  nationalDay: { name: 'Lateran Treaty Day', date: '11 February' },
  history: 'The Vatican City is the smallest sovereign state in the world. It was created in 1929 by the Lateran Treaty between Italy and the Holy See, and serves as the spiritual and administrative centre of the Roman Catholic Church.',
  culture: 'Home to St. Peter\'s Basilica, the Sistine Chapel and the Vatican Museums. Swiss Guard protect the Pope, who is the state\'s absolute monarch.',
  events: ['Easter Mass at St. Peter\'s', 'Christmas Midnight Mass', 'Papal Urbi et Orbi blessing', 'Lateran Treaty Day (11 February)'],
  rivers: [],
  neighbors: ['italy'],
});

add({
  id: 'monaco', name: 'Monaco',
  aliases: /\bmonaco\b/i,
  capital: 'Monaco', continent: 'Europe', subregion: 'Western Europe',
  population: 36297, area: 2.08,
  gdp: 7.4e9, gdpGrowth: 2.5, hdi: 0.956,
  currency: 'Euro (EUR)', languages: ['French'],
  independence: { year: 1861, date: '2 February 1861', from: 'Sardinia (Franco-Monegasque Treaty)' },
  nationalDay: { name: 'Saint Devote\'s Day', date: '27 January' },
  history: 'Monaco has been ruled by the Grimaldi family since 1297 and is the world\'s second-smallest country. Full sovereignty was recognised by France in 1861, and today it is a wealthy tax haven famous for the Monte Carlo casino and the Monaco Grand Prix.',
  culture: 'A glittering Mediterranean principality known for luxury yachts, the Formula 1 Grand Prix, the Monte Carlo Rally and the Ballet de Monte-Carlo.',
  events: ['Monaco Grand Prix (May)', 'Monte Carlo Rally (January)', 'Fête du Prince (19 November)', 'Saint Devote\'s Day (27 January)'],
  rivers: [],
  neighbors: ['france'],
});

add({
  id: 'nauru', name: 'Nauru',
  aliases: /\bnauru\b/i,
  capital: 'Yaren (de facto)', continent: 'Oceania', subregion: 'Micronesia',
  population: 12780, area: 21,
  gdp: 150e6, gdpGrowth: 1.0, hdi: 0.696,
  currency: 'Australian Dollar (AUD)', languages: ['Nauruan', 'English'],
  independence: { year: 1968, date: '31 January 1968', from: 'Australia / New Zealand / UK trusteeship' },
  nationalDay: { name: 'Independence Day', date: '31 January' },
  history: 'Nauru is the world\'s smallest island country. Once one of the richest countries per capita thanks to phosphate mining, its economy collapsed after the reserves were exhausted in the 1990s.',
  culture: 'Traditional Nauruan culture revolves around fishing, frigate birds and community feasts. Australian rules football is a national passion.',
  events: ['Independence Day (31 January)', 'Constitution Day (17 May)', 'Angam Day (26 October)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'tuvalu', name: 'Tuvalu',
  aliases: /\btuvalu\b/i,
  capital: 'Funafuti', continent: 'Oceania', subregion: 'Polynesia',
  population: 11396, area: 26,
  gdp: 63e6, gdpGrowth: 1.0, hdi: 0.653,
  currency: 'Australian Dollar (AUD)', languages: ['Tuvaluan', 'English'],
  independence: { year: 1978, date: '1 October 1978', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '1 October' },
  history: 'Tuvalu is a Polynesian island nation made up of nine coral atolls. It is one of the countries most threatened by climate change and rising sea levels. Its ".tv" internet domain is a major source of national revenue.',
  culture: 'Tuvaluan culture is built around the fatele (traditional dance) and the maneapa (community meeting house). Fishing and subsistence farming are central.',
  events: ['Independence Day (1 October)', 'Gospel Day (second Monday in May)', 'Hurricane Day'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'san-marino', name: 'San Marino',
  aliases: /\bsan\s+marino\b/i,
  capital: 'San Marino', continent: 'Europe', subregion: 'Southern Europe',
  population: 33642, area: 61,
  gdp: 2.0e9, gdpGrowth: 1.2, hdi: 0.853,
  currency: 'Euro (EUR)', languages: ['Italian'],
  independence: { year: 301, date: '3 September 301 AD', from: 'Roman Empire (traditional founding)' },
  nationalDay: { name: 'Foundation of the Republic', date: '3 September' },
  history: 'San Marino claims to be the world\'s oldest surviving sovereign state and constitutional republic, founded on 3 September 301 AD by Saint Marinus. It sits on the slopes of Monte Titano, entirely surrounded by Italy.',
  culture: 'A medieval hilltop republic with three iconic towers (Guaita, Cesta and Montale), famous for its crossbow corps and traditional investiture of the Captains Regent twice a year.',
  events: ['Foundation of the Republic (3 September)', 'Investiture of the Captains Regent (1 April and 1 October)', 'Medieval Days festival (July)'],
  rivers: [],
  neighbors: ['italy'],
});

add({
  id: 'liechtenstein', name: 'Liechtenstein',
  aliases: /\bliechtenstein\b/i,
  capital: 'Vaduz', continent: 'Europe', subregion: 'Western Europe',
  population: 39584, area: 160,
  gdp: 7.4e9, gdpGrowth: 1.5, hdi: 0.942,
  currency: 'Swiss Franc (CHF)', languages: ['German'],
  independence: { year: 1806, date: '12 July 1806', from: 'Holy Roman Empire' },
  nationalDay: { name: 'National Day', date: '15 August' },
  history: 'An Alpine principality between Switzerland and Austria, Liechtenstein is a constitutional monarchy and one of the world\'s wealthiest countries per capita. It stayed neutral through both World Wars.',
  culture: 'Famous for its financial sector, alpine skiing and the Vaduz castle that dominates the capital. The Prince still holds significant political power.',
  events: ['National Day (15 August)', 'Fasnacht (February carnival)', 'Staatsfeiertag celebrations'],
  rivers: ['Rhine'],
  neighbors: [],
});

add({
  id: 'marshall-islands', name: 'Marshall Islands',
  aliases: /\bmarshall\s+islands\b/i,
  capital: 'Majuro', continent: 'Oceania', subregion: 'Micronesia',
  population: 41996, area: 181,
  gdp: 270e6, gdpGrowth: 2.0, hdi: 0.731,
  currency: 'US Dollar (USD)', languages: ['Marshallese', 'English'],
  independence: { year: 1986, date: '21 October 1986', from: 'US Trust Territory (Compact of Free Association)' },
  nationalDay: { name: 'Constitution Day', date: '1 May' },
  history: 'The Marshall Islands is a chain of 29 coral atolls in the Pacific. The US tested 67 nuclear weapons at Bikini and Enewetak atolls between 1946 and 1958, leaving lasting environmental and health damage.',
  culture: 'Marshallese culture is famous for its stick charts used in traditional navigation, and for its outrigger canoes.',
  events: ['Constitution Day (1 May)', 'Fisherman\'s Day (first Friday of July)', 'Nuclear Victims Remembrance Day (1 March)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'saint-kitts-nevis', name: 'Saint Kitts and Nevis',
  aliases: /\bsaint\s+kitts(?:\s+and\s+nevis)?\b|\bst\.?\s+kitts(?:\s+and\s+nevis)?\b/i,
  capital: 'Basseterre', continent: 'North America', subregion: 'Caribbean',
  population: 47755, area: 261,
  gdp: 1.0e9, gdpGrowth: 3.0, hdi: 0.838,
  currency: 'East Caribbean Dollar (XCD)', languages: ['English'],
  independence: { year: 1983, date: '19 September 1983', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '19 September' },
  history: 'Saint Kitts and Nevis is the smallest country in the Americas by both area and population. It was the first English colony in the Caribbean (1623), and gained independence from Britain in 1983.',
  culture: 'Famous for its Carnival (Sugar Mas), Brimstone Hill Fortress and the scenic narrow-gauge railway that circles Saint Kitts.',
  events: ['Carnival / Sugar Mas (December–January)', 'Independence Day (19 September)', 'Culturama on Nevis (August)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'maldives', name: 'Maldives',
  aliases: /\bmaldives\b/i,
  capital: 'Malé', continent: 'Asia', subregion: 'South Asia',
  population: 521021, area: 298,
  gdp: 6.2e9, gdpGrowth: 4.0, hdi: 0.762,
  currency: 'Maldivian Rufiyaa (MVR)', languages: ['Dhivehi'],
  independence: { year: 1965, date: '26 July 1965', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '26 July' },
  history: 'The Maldives is an archipelago of about 1,200 coral islands in the Indian Ocean, of which roughly 200 are inhabited. It became a republic in 1968 and is famous worldwide for luxury tourism and its underwater beauty.',
  culture: 'Maldivian culture blends South Indian, Sri Lankan and Arab influences. Fishing, boat-building (dhonis) and Bodu Beru drumming are central traditions.',
  events: ['Independence Day (26 July)', 'Republic Day (11 November)', 'Eid ul-Fitr and Eid ul-Adha'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'malta', name: 'Malta',
  aliases: /\bmalta\b/i,
  capital: 'Valletta', continent: 'Europe', subregion: 'Southern Europe',
  population: 535064, area: 316,
  gdp: 20.9e9, gdpGrowth: 6.0, hdi: 0.915,
  currency: 'Euro (EUR)', languages: ['Maltese', 'English'],
  independence: { year: 1964, date: '21 September 1964', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '21 September' },
  history: 'Malta is a Mediterranean archipelago with over 7,000 years of history — home to megalithic temples older than the pyramids, and ruled by Phoenicians, Romans, Arabs, Knights of St. John, French and British before independence in 1964. It joined the EU in 2004.',
  culture: 'Maltese culture mixes Mediterranean, Arab and European influences. Its capital Valletta is a UNESCO World Heritage Site, and the country is famous for its festas (religious village festivals).',
  events: ['Independence Day (21 September)', 'Freedom Day (31 March)', 'Mnarja (29 June)', 'Notte Bianca (October)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'grenada', name: 'Grenada',
  aliases: /\bgrenada\b/i,
  capital: 'St. George\'s', continent: 'North America', subregion: 'Caribbean',
  population: 126183, area: 344,
  gdp: 1.3e9, gdpGrowth: 3.5, hdi: 0.791,
  currency: 'East Caribbean Dollar (XCD)', languages: ['English'],
  independence: { year: 1974, date: '7 February 1974', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '7 February' },
  history: 'Known as the "Isle of Spice," Grenada is one of the world\'s largest exporters of nutmeg and mace. It gained independence from Britain in 1974 and was invaded by the US in 1983 after a Marxist coup.',
  culture: 'Grenadian culture is famous for its Carnival (Spicemas), Big Drum dance and oil-down (a national dish cooked in coconut milk).',
  events: ['Spicemas Carnival (August)', 'Independence Day (7 February)', 'Thanksgiving (25 October)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'saint-vincent', name: 'Saint Vincent and the Grenadines',
  aliases: /\bsaint\s+vincent(?:\s+and\s+the\s+grenadines)?\b|\bst\.?\s+vincent(?:\s+and\s+the\s+grenadines)?\b/i,
  capital: 'Kingstown', continent: 'North America', subregion: 'Caribbean',
  population: 103698, area: 389,
  gdp: 1.0e9, gdpGrowth: 2.0, hdi: 0.772,
  currency: 'East Caribbean Dollar (XCD)', languages: ['English'],
  independence: { year: 1979, date: '27 October 1979', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '27 October' },
  history: 'Saint Vincent and the Grenadines is an island chain in the eastern Caribbean, famous for the Pirates of the Caribbean film locations and the active La Soufrière volcano (which erupted in 2021).',
  culture: 'Vincy Mas (the national carnival) is one of the Caribbean\'s biggest. The Tobago Cays are a marine park and yachting destination.',
  events: ['Vincy Mas (June–July)', 'Independence Day (27 October)', 'Nine Mornings Festival (December)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'barbados', name: 'Barbados',
  aliases: /\bbarbados\b/i,
  capital: 'Bridgetown', continent: 'North America', subregion: 'Caribbean',
  population: 281995, area: 430,
  gdp: 6.3e9, gdpGrowth: 4.0, hdi: 0.809,
  currency: 'Barbadian Dollar (BBD)', languages: ['English'],
  independence: { year: 1966, date: '30 November 1966', from: 'United Kingdom (republic since 2021)' },
  nationalDay: { name: 'Independence Day', date: '30 November' },
  history: 'Barbados is the easternmost Caribbean island and the birthplace of rum. It gained independence from Britain in 1966 and became a republic in 2021, replacing the British monarch with its own president.',
  culture: 'Barbadian (Bajan) culture is famous for Crop Over (the summer harvest festival), calypso music, rum distilleries and the global pop star Rihanna.',
  events: ['Crop Over (July–August)', 'Independence Day (30 November)', 'Holetown Festival (February)', 'Oistins Fish Festival (Easter)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'antigua-barbuda', name: 'Antigua and Barbuda',
  aliases: /\bantigua(?:\s+and\s+barbuda)?\b/i,
  capital: 'St. John\'s', continent: 'North America', subregion: 'Caribbean',
  population: 94298, area: 442,
  gdp: 1.9e9, gdpGrowth: 5.0, hdi: 0.826,
  currency: 'East Caribbean Dollar (XCD)', languages: ['English'],
  independence: { year: 1981, date: '1 November 1981', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '1 November' },
  history: 'Antigua and Barbuda is a twin-island nation in the eastern Caribbean. Antigua famously has 365 beaches — "one for every day of the year" — and was a British colony until 1981.',
  culture: 'Antiguan culture is centred around Carnival (August), sailing (Antigua Sailing Week) and cricket. Barbuda is a quieter sister island with untouched pink-sand beaches.',
  events: ['Antigua Carnival (August)', 'Antigua Sailing Week (April–May)', 'Independence Day (1 November)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'seychelles', name: 'Seychelles',
  aliases: /\bseychelles\b/i,
  capital: 'Victoria', continent: 'Africa', subregion: 'East Africa',
  population: 107660, area: 452,
  gdp: 2.1e9, gdpGrowth: 3.5, hdi: 0.802,
  currency: 'Seychellois Rupee (SCR)', languages: ['Seychellois Creole', 'French', 'English'],
  independence: { year: 1976, date: '29 June 1976', from: 'United Kingdom' },
  nationalDay: { name: 'Constitution Day', date: '18 June' },
  history: 'Seychelles is an archipelago of 115 islands in the Indian Ocean and the smallest country in Africa by both area and population. It gained independence from Britain in 1976 and is one of the most developed African nations.',
  culture: 'Seychellois culture is a blend of African, French, Indian and Chinese influences, with moutya dance and Creole cuisine at its heart.',
  events: ['Constitution Day (18 June)', 'Independence Day (29 June)', 'Creole Festival (October)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'palau', name: 'Palau',
  aliases: /\bpalau\b/i,
  capital: 'Ngerulmud', continent: 'Oceania', subregion: 'Micronesia',
  population: 18058, area: 459,
  gdp: 268e6, gdpGrowth: 1.5, hdi: 0.797,
  currency: 'US Dollar (USD)', languages: ['Palauan', 'English'],
  independence: { year: 1994, date: '1 October 1994', from: 'US Trust Territory (Compact of Free Association)' },
  nationalDay: { name: 'Independence Day', date: '1 October' },
  history: 'Palau is an archipelago of about 340 islands in the western Pacific, known for its Rock Islands, Jellyfish Lake and world-class diving. It became fully independent in 1994 after decades of US trusteeship.',
  culture: 'Palauan culture is famous for its bai (traditional men\'s meeting houses) and its traditional money made from giant stone discs called rai.',
  events: ['Independence Day (1 October)', 'Constitution Day (9 July)', 'Olechotel Belau Fair'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'andorra', name: 'Andorra',
  aliases: /\bandorra\b/i,
  capital: 'Andorra la Vella', continent: 'Europe', subregion: 'Southern Europe',
  population: 80088, area: 468,
  gdp: 3.7e9, gdpGrowth: 2.5, hdi: 0.884,
  currency: 'Euro (EUR)', languages: ['Catalan'],
  independence: { year: 1278, date: '8 September 1278', from: 'Paréage treaty (co-sovereignty)' },
  nationalDay: { name: 'Our Lady of Meritxell Day', date: '8 September' },
  history: 'Andorra is a Pyrenean microstate co-ruled by the President of France and the Bishop of Urgell (Spain) — a unique diarchy. It is the world\'s only country where Catalan is the sole official language.',
  culture: 'Andorran culture blends Catalan and French traditions. Famous for ski resorts (Grandvalira, Vallnord), tax-free shopping and Romanesque churches.',
  events: ['Our Lady of Meritxell Day (8 September)', 'Carnival (February)', 'Sant Jordi (23 April)'],
  rivers: [],
  neighbors: ['france', 'spain'],
});

add({
  id: 'saint-lucia', name: 'Saint Lucia',
  aliases: /\bsaint\s+lucia\b|\bst\.?\s+lucia\b/i,
  capital: 'Castries', continent: 'North America', subregion: 'Caribbean',
  population: 180251, area: 617,
  gdp: 2.5e9, gdpGrowth: 3.0, hdi: 0.715,
  currency: 'East Caribbean Dollar (XCD)', languages: ['English', 'Saint Lucian Creole'],
  independence: { year: 1979, date: '22 February 1979', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '22 February' },
  history: 'Saint Lucia is famous for the twin Pitons (UNESCO World Heritage volcanic peaks), its sulphur springs and the world\'s only drive-in volcano. It gained independence from Britain in 1979.',
  culture: 'Saint Lucian culture is African-French-Caribbean in character, famous for its Nobel laureates (Derek Walcott and Arthur Lewis — the only country with two), and its Jazz Festival.',
  events: ['Saint Lucia Jazz Festival (May)', 'Carnival (July)', 'Independence Day (22 February)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'micronesia', name: 'Micronesia',
  aliases: /\bmicronesia\b|\bfederated\s+states\s+of\s+micronesia\b/i,
  capital: 'Palikir', continent: 'Oceania', subregion: 'Micronesia',
  population: 115224, area: 702,
  gdp: 460e6, gdpGrowth: 1.0, hdi: 0.628,
  currency: 'US Dollar (USD)', languages: ['English', 'Chuukese', 'Pohnpeian', 'Yapese', 'Kosraean'],
  independence: { year: 1986, date: '3 November 1986', from: 'US Trust Territory (Compact of Free Association)' },
  nationalDay: { name: 'Independence Day', date: '3 November' },
  history: 'The Federated States of Micronesia is a sprawling Pacific nation of 607 islands in four states — Yap, Chuuk, Pohnpei and Kosrae. It became independent in 1986 under a Compact of Free Association with the US.',
  culture: 'Micronesian culture is famous for stone money (Yap), the megalithic ruins of Nan Madol (Pohnpei) and traditional navigation skills.',
  events: ['Independence Day (3 November)', 'Constitution Day (10 May)', 'FSM Culture Day'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'tonga', name: 'Tonga',
  aliases: /\btonga\b/i,
  capital: 'Nuku\'alofa', continent: 'Oceania', subregion: 'Polynesia',
  population: 107773, area: 747,
  gdp: 500e6, gdpGrowth: 1.5, hdi: 0.745,
  currency: 'Tongan Paʻanga (TOP)', languages: ['Tongan', 'English'],
  independence: { year: 1970, date: '4 June 1970', from: 'UK protectorate' },
  nationalDay: { name: 'Emancipation Day', date: '4 June' },
  history: 'Tonga is the only Pacific island nation never formally colonised — it was a British protectorate from 1900 to 1970 but kept its own monarchy. It remains a constitutional monarchy today.',
  culture: 'Tongan culture is famous for its kava ceremonies, tapa cloth (ngatu) and the huge Haʻamonga ʻa Maui trilithon. Rugby is the national sport.',
  events: ['Emancipation Day (4 June)', 'Heilala Festival (July)', 'King Tupou VI\'s Birthday (4 July)'],
  rivers: [],
  neighbors: [],
});

add({
  id: 'bahrain', name: 'Bahrain',
  aliases: /\bbahrain\b/i,
  capital: 'Manama', continent: 'Asia', subregion: 'Middle East',
  population: 1485509, area: 786,
  gdp: 44.4e9, gdpGrowth: 2.6, hdi: 0.888,
  currency: 'Bahraini Dinar (BHD)', languages: ['Arabic'],
  independence: { year: 1971, date: '15 August 1971', from: 'United Kingdom' },
  nationalDay: { name: 'Independence Day', date: '16 December' },
  history: 'Bahrain is a small Gulf archipelago with a history stretching back to the ancient Dilmun civilization. It was the first Gulf state to discover oil (1932) and is now a major banking and financial hub.',
  culture: 'Bahraini culture blends Arab, Persian and Indian influences. Famous for pearl diving history, the UNESCO-listed Bahrain Fort and its Formula 1 Grand Prix.',
  events: ['Bahrain Grand Prix (March)', 'Spring of Culture (March–April)', 'National Day (16 December)'],
  rivers: [],
  neighbors: [],
});



// ─── WORLD RIVERS ───────────────────────────────────────────
root.XENON_WORLD_RIVERS = [
  { name: 'Nile', length: 6650, continent: 'Africa', countries: ['Egypt', 'Sudan', 'Uganda', 'Ethiopia', 'Tanzania'] },
  { name: 'Amazon', length: 6400, continent: 'South America', countries: ['Brazil', 'Peru', 'Colombia'] },
  { name: 'Yangtze', length: 6300, continent: 'Asia', countries: ['China'] },
  { name: 'Mississippi–Missouri', length: 6275, continent: 'North America', countries: ['USA'] },
  { name: 'Yenisei', length: 5539, continent: 'Asia', countries: ['Russia', 'Mongolia'] },
  { name: 'Yellow River', length: 5464, continent: 'Asia', countries: ['China'] },
  { name: 'Ob–Irtysh', length: 5410, continent: 'Asia', countries: ['Russia', 'Kazakhstan'] },
  { name: 'Río de la Plata–Paraná', length: 4880, continent: 'South America', countries: ['Brazil', 'Argentina', 'Uruguay'] },
  { name: 'Congo–Chambeshi', length: 4700, continent: 'Africa', countries: ['DR Congo', 'Congo', 'Zambia'] },
  { name: 'Amur–Argun', length: 4444, continent: 'Asia', countries: ['Russia', 'China'] },
  { name: 'Lena', length: 4400, continent: 'Asia', countries: ['Russia'] },
  { name: 'Mekong', length: 4350, continent: 'Asia', countries: ['China', 'Laos', 'Cambodia', 'Vietnam', 'Thailand'] },
  { name: 'Mackenzie–Slave–Peace', length: 4241, continent: 'North America', countries: ['Canada'] },
  { name: 'Niger', length: 4200, continent: 'Africa', countries: ['Nigeria', 'Mali', 'Niger'] },
  { name: 'Volga', length: 3531, continent: 'Europe', countries: ['Russia'] },
  { name: 'Indus', length: 3180, continent: 'Asia', countries: ['Pakistan', 'India', 'China'] },
  { name: 'Danube', length: 2850, continent: 'Europe', countries: ['Germany', 'Austria', 'Hungary', 'Romania', 'Serbia'] },
  { name: 'Euphrates', length: 2800, continent: 'Asia', countries: ['Turkey', 'Syria', 'Iraq'] },
  { name: 'Ganges', length: 2525, continent: 'Asia', countries: ['India', 'Bangladesh'] },
  { name: 'Tigris', length: 1850, continent: 'Asia', countries: ['Turkey', 'Iraq'] },
  { name: 'Rhine', length: 1230, continent: 'Europe', countries: ['Germany', 'France', 'Netherlands', 'Switzerland'] },
  { name: 'Seine', length: 777, continent: 'Europe', countries: ['France'] },
  { name: 'Meghna', length: 400, continent: 'Asia', countries: ['Bangladesh'] },
  { name: 'Thames', length: 346, continent: 'Europe', countries: ['UK'] },
  { name: 'Jamuna', length: 205, continent: 'Asia', countries: ['Bangladesh'] },
  { name: 'Padma', length: 120, continent: 'Asia', countries: ['Bangladesh', 'India'] },
];

// ═══════════════════════════════════════════════════════════════════
// MOUNTAINS, CLIFFS & SEAS
// ═══════════════════════════════════════════════════════════════════
// Referenced by DISPLAY NAME (not id) so entries can mention countries
// not yet in the country database (Nepal, Switzerland, Tanzania, etc.)
// — "mountains in Nepal" still works even though Nepal has no country
// page yet.

root.XENON_WORLD_MOUNTAINS = [
  // 8000ers
  { name: 'Mount Everest', height: 8849, countries: ['Nepal', 'China'], range: 'Himalayas', continent: 'Asia', note: 'Highest point on Earth' },
  { name: 'K2', height: 8611, countries: ['Pakistan', 'China'], range: 'Karakoram', continent: 'Asia' },
  { name: 'Kangchenjunga', height: 8586, countries: ['Nepal', 'India'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Lhotse', height: 8516, countries: ['Nepal', 'China'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Makalu', height: 8485, countries: ['Nepal', 'China'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Cho Oyu', height: 8188, countries: ['Nepal', 'China'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Dhaulagiri I', height: 8167, countries: ['Nepal'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Manaslu', height: 8163, countries: ['Nepal'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Nanga Parbat', height: 8126, countries: ['Pakistan'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Annapurna I', height: 8091, countries: ['Nepal'], range: 'Himalayas', continent: 'Asia' },
  { name: 'Gasherbrum I', height: 8080, countries: ['Pakistan', 'China'], range: 'Karakoram', continent: 'Asia' },
  { name: 'Broad Peak', height: 8051, countries: ['Pakistan', 'China'], range: 'Karakoram', continent: 'Asia' },
  { name: 'Gasherbrum II', height: 8035, countries: ['Pakistan', 'China'], range: 'Karakoram', continent: 'Asia' },
  { name: 'Shishapangma', height: 8027, countries: ['China'], range: 'Himalayas', continent: 'Asia' },
  // Notable non-8000ers
  { name: 'Aconcagua', height: 6961, countries: ['Argentina'], range: 'Andes', continent: 'South America', note: 'Highest in the Americas' },
  { name: 'Denali', height: 6190, countries: ['USA'], range: 'Alaska Range', continent: 'North America' },
  { name: 'Mount Kilimanjaro', height: 5895, countries: ['Tanzania'], range: 'Volcanic', continent: 'Africa', note: 'Highest in Africa' },
  { name: 'Mount Elbrus', height: 5642, countries: ['Russia'], range: 'Caucasus', continent: 'Europe', note: 'Highest in Europe' },
  { name: 'Pico de Orizaba', height: 5636, countries: ['Mexico'], range: 'Volcanic', continent: 'North America' },
  { name: 'Damavand', height: 5610, countries: ['Iran'], range: 'Alborz', continent: 'Asia', note: 'Highest in Iran' },
  { name: 'Mount Ararat', height: 5137, countries: ['Turkey'], range: 'Volcanic', continent: 'Asia' },
  { name: 'Mount Logan', height: 5959, countries: ['Canada'], range: 'Saint Elias', continent: 'North America' },
  { name: 'Puncak Jaya', height: 4884, countries: ['Indonesia'], range: 'Sudirman', continent: 'Asia' },
  { name: 'Mont Blanc', height: 4808, countries: ['France', 'Italy'], range: 'Alps', continent: 'Europe' },
  { name: 'Matterhorn', height: 4478, countries: ['Switzerland', 'Italy'], range: 'Alps', continent: 'Europe' },
  { name: 'Mount Whitney', height: 4421, countries: ['USA'], range: 'Sierra Nevada', continent: 'North America' },
  { name: 'Kinabalu', height: 4095, countries: ['Malaysia'], range: 'Crocker Range', continent: 'Asia' },
  { name: 'Mount Fuji', height: 3776, countries: ['Japan'], range: 'Volcanic', continent: 'Asia', note: 'Highest in Japan' },
  { name: 'Teide', height: 3718, countries: ['Spain'], range: 'Volcanic (Tenerife)', continent: 'Europe' },
  { name: 'Mulhacén', height: 3479, countries: ['Spain'], range: 'Sierra Nevada', continent: 'Europe' },
  { name: 'Mafadi', height: 3450, countries: ['South Africa'], range: 'Drakensberg', continent: 'Africa' },
  { name: 'Fansipan', height: 3143, countries: ['Vietnam'], range: 'Hoang Lien Son', continent: 'Asia' },
  { name: 'Jabal Sawda', height: 3000, countries: ['Saudi Arabia'], range: 'Sarawat', continent: 'Asia' },
  { name: 'Pico da Neblina', height: 2995, countries: ['Brazil'], range: 'Guiana Highlands', continent: 'South America' },
  { name: 'Zugspitze', height: 2962, countries: ['Germany'], range: 'Alps', continent: 'Europe' },
  { name: 'Mount Apo', height: 2954, countries: ['Philippines'], range: 'Volcanic', continent: 'Asia' },
  { name: 'Paektu', height: 2744, countries: ['North Korea', 'China'], range: 'Volcanic', continent: 'Asia' },
  { name: 'Mount Catherine', height: 2629, countries: ['Egypt'], range: 'Sinai', continent: 'Africa' },
  { name: 'Doi Inthanon', height: 2565, countries: ['Thailand'], range: 'Thanon Thong Chai', continent: 'Asia' },
  { name: 'Chappal Waddi', height: 2419, countries: ['Nigeria'], range: 'Cameroon Line', continent: 'Africa' },
  { name: 'Mount Kosciuszko', height: 2228, countries: ['Australia'], range: 'Snowy Mountains', continent: 'Oceania' },
  { name: 'Hallasan', height: 1947, countries: ['South Korea'], range: 'Volcanic (Jeju)', continent: 'Asia' },
  { name: 'Ben Nevis', height: 1345, countries: ['UK'], range: 'Grampians', continent: 'Europe' },
  { name: 'Keokradong', height: 985, countries: ['Bangladesh'], range: 'Chittagong Hill Tracts', continent: 'Asia', note: 'Highest in Bangladesh' },
  { name: 'Tajingdong (Bijah)', height: 1000, countries: ['Bangladesh'], range: 'Chittagong Hill Tracts', continent: 'Asia' },
];

root.XENON_WORLD_CLIFFS = [
  // Measured by CLIFF FACE height (sheer drop), not elevation of top.
  { name: 'Trango Towers', cliffDrop: 1340, country: 'Pakistan', location: 'Karakoram', type: 'rock face', note: 'Some of the world\'s tallest near-vertical drops' },
  { name: 'Mitre Peak', cliffDrop: 1692, country: 'New Zealand', location: 'Milford Sound', type: 'sea cliff' },
  { name: 'Troll Wall (Trollveggen)', cliffDrop: 1100, country: 'Norway', location: 'Romsdal', type: 'rock face', note: 'Tallest vertical drop in Europe' },
  { name: 'Kalaupapa Sea Cliffs', cliffDrop: 1010, country: 'USA', location: 'Molokai, Hawaii', type: 'sea cliff' },
  { name: 'El Capitan', cliffDrop: 914, country: 'USA', location: 'Yosemite', type: 'granite face' },
  { name: 'Cape Enniberg', cliffDrop: 754, country: 'Faroe Islands', location: 'Viðoy', type: 'sea cliff' },
  { name: 'Preikestolen (Pulpit Rock)', cliffDrop: 604, country: 'Norway', location: 'Lysefjord', type: 'sea cliff' },
  { name: 'Cliffs of Moher', cliffDrop: 214, country: 'Ireland', location: 'County Clare', type: 'sea cliff' },
  { name: 'Beachy Head', cliffDrop: 162, country: 'UK', location: 'East Sussex', type: 'chalk cliff' },
  { name: 'White Cliffs of Dover', cliffDrop: 110, country: 'UK', location: 'Kent', type: 'chalk cliff' },
  { name: 'Étretat', cliffDrop: 90, country: 'France', location: 'Normandy', type: 'chalk cliff' },
];

root.XENON_WORLD_SEAS = [
  { name: 'Philippine Sea', area: 5695000, avgDepth: 4108, maxDepth: 10540, ocean: 'Pacific', continent: 'Asia', countries: ['Philippines', 'Japan', 'Palau', 'Taiwan'] },
  { name: 'Coral Sea', area: 4791000, avgDepth: 2394, maxDepth: 9140, ocean: 'Pacific', continent: 'Oceania', countries: ['Australia', 'Papua New Guinea', 'Solomon Islands', 'Vanuatu'] },
  { name: 'Arabian Sea', area: 3862000, avgDepth: 2734, maxDepth: 4652, ocean: 'Indian', continent: 'Asia', countries: ['India', 'Pakistan', 'Iran', 'Oman', 'Yemen', 'Somalia', 'Maldives'] },
  { name: 'South China Sea', area: 3500000, avgDepth: 1212, maxDepth: 5559, ocean: 'Pacific', continent: 'Asia', countries: ['China', 'Vietnam', 'Philippines', 'Malaysia', 'Indonesia', 'Brunei', 'Taiwan'] },
  { name: 'Caribbean Sea', area: 2754000, avgDepth: 2647, maxDepth: 7686, ocean: 'Atlantic', continent: 'North America', countries: ['Mexico', 'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic', 'Colombia', 'Venezuela', 'Honduras', 'Belize', 'Nicaragua', 'Costa Rica', 'Panama'] },
  { name: 'Bay of Bengal', area: 2600000, avgDepth: 2600, maxDepth: 4694, ocean: 'Indian', continent: 'Asia', countries: ['India', 'Bangladesh', 'Myanmar', 'Sri Lanka'] },
  { name: 'Mediterranean Sea', area: 2500000, avgDepth: 1500, maxDepth: 5267, ocean: 'Atlantic', continent: 'Europe / Africa', countries: ['Spain', 'France', 'Italy', 'Greece', 'Turkey', 'Egypt', 'Libya', 'Tunisia', 'Algeria', 'Morocco', 'Syria', 'Lebanon', 'Israel', 'Cyprus', 'Malta'] },
  { name: 'Tasman Sea', area: 2300000, avgDepth: 2750, maxDepth: 5943, ocean: 'Pacific', continent: 'Oceania', countries: ['Australia', 'New Zealand'] },
  { name: 'Bering Sea', area: 2000000, avgDepth: 1600, maxDepth: 4097, ocean: 'Pacific', continent: 'Asia / North America', countries: ['USA', 'Russia'] },
  { name: 'Sea of Okhotsk', area: 1583000, avgDepth: 859, maxDepth: 3916, ocean: 'Pacific', continent: 'Asia', countries: ['Russia', 'Japan'] },
  { name: 'Sea of Japan', area: 978000, avgDepth: 1752, maxDepth: 3742, ocean: 'Pacific', continent: 'Asia', countries: ['Japan', 'South Korea', 'North Korea', 'Russia'] },
  { name: 'Andaman Sea', area: 797700, avgDepth: 1096, maxDepth: 4198, ocean: 'Indian', continent: 'Asia', countries: ['Thailand', 'Myanmar', 'India', 'Indonesia', 'Malaysia'] },
  { name: 'North Sea', area: 570000, avgDepth: 95, maxDepth: 700, ocean: 'Atlantic', continent: 'Europe', countries: ['UK', 'Norway', 'Denmark', 'Germany', 'Netherlands', 'Belgium', 'France'] },
  { name: 'Red Sea', area: 438000, avgDepth: 490, maxDepth: 3040, ocean: 'Indian', continent: 'Africa / Asia', countries: ['Egypt', 'Sudan', 'Eritrea', 'Djibouti', 'Saudi Arabia', 'Yemen', 'Jordan', 'Israel'] },
  { name: 'Black Sea', area: 436400, avgDepth: 1253, maxDepth: 2212, ocean: 'Atlantic', continent: 'Europe / Asia', countries: ['Turkey', 'Bulgaria', 'Romania', 'Ukraine', 'Russia', 'Georgia'] },
  { name: 'Yellow Sea', area: 380000, avgDepth: 44, maxDepth: 152, ocean: 'Pacific', continent: 'Asia', countries: ['China', 'South Korea', 'North Korea'] },
  { name: 'Baltic Sea', area: 377000, avgDepth: 55, maxDepth: 459, ocean: 'Atlantic', continent: 'Europe', countries: ['Sweden', 'Finland', 'Russia', 'Estonia', 'Latvia', 'Lithuania', 'Poland', 'Germany', 'Denmark'] },
  { name: 'Caspian Sea', area: 371000, avgDepth: 211, maxDepth: 1025, ocean: 'Inland (endorheic)', continent: 'Europe / Asia', countries: ['Russia', 'Kazakhstan', 'Turkmenistan', 'Iran', 'Azerbaijan'], note: 'Largest inland body of water' },
  { name: 'Gulf of Mexico', area: 1550000, avgDepth: 1615, maxDepth: 4384, ocean: 'Atlantic', continent: 'North America', countries: ['USA', 'Mexico', 'Cuba'] },
  { name: 'Java Sea', area: 320000, avgDepth: 46, maxDepth: 67, ocean: 'Pacific', continent: 'Asia', countries: ['Indonesia'] },
  { name: 'Banda Sea', area: 470000, avgDepth: 3064, maxDepth: 7440, ocean: 'Pacific', continent: 'Asia', countries: ['Indonesia', 'East Timor'] },
  { name: 'Celebes Sea', area: 280000, avgDepth: 3645, maxDepth: 6260, ocean: 'Pacific', continent: 'Asia', countries: ['Indonesia', 'Philippines', 'Malaysia'] },
  { name: 'Sulu Sea', area: 260000, avgDepth: 1570, maxDepth: 5590, ocean: 'Pacific', continent: 'Asia', countries: ['Philippines', 'Malaysia'] },
  { name: 'Gulf of Thailand', area: 320000, avgDepth: 58, maxDepth: 85, ocean: 'Pacific', continent: 'Asia', countries: ['Thailand', 'Cambodia', 'Vietnam', 'Malaysia'] },
  { name: 'Adriatic Sea', area: 138600, avgDepth: 259, maxDepth: 1233, ocean: 'Atlantic', continent: 'Europe', countries: ['Italy', 'Croatia', 'Slovenia', 'Montenegro', 'Albania', 'Bosnia and Herzegovina'] },
  { name: 'Aegean Sea', area: 214000, avgDepth: 377, maxDepth: 3543, ocean: 'Atlantic', continent: 'Europe / Asia', countries: ['Greece', 'Turkey'] },
  { name: 'Timor Sea', area: 610000, avgDepth: 600, maxDepth: 3300, ocean: 'Indian', continent: 'Oceania', countries: ['Australia', 'Indonesia', 'East Timor'] },
  { name: 'Dead Sea', area: 605, avgDepth: 118, maxDepth: 298, ocean: 'Inland (endorheic)', continent: 'Asia', countries: ['Jordan', 'Israel', 'Palestine'], note: 'Lowest land elevation on Earth (~-430 m below sea level)' },
];

// ─── Cross-link world data onto each country ─────────────────────
// Adds country.mountains / country.cliffs / country.seas so
// "mountains in Japan" can simply read the array instead of
// scanning the global lists every time.
(function attachGeoToCountries() {
  const byName = {};
  C.forEach(c => {
    byName[c.name] = c;
    c.mountains = c.mountains || [];
    c.cliffs = c.cliffs || [];
    c.seas = c.seas || [];
  });
  root.XENON_WORLD_MOUNTAINS.forEach(m => {
    m.countries.forEach(cn => { if (byName[cn]) byName[cn].mountains.push(m.name); });
  });
  root.XENON_WORLD_CLIFFS.forEach(cl => {
    if (byName[cl.country]) byName[cl.country].cliffs.push(cl.name);
  });
  root.XENON_WORLD_SEAS.forEach(s => {
    s.countries.forEach(cn => { if (byName[cn]) byName[cn].seas.push(s.name); });
  });
})();


})(window);