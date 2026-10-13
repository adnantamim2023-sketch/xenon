// writing.js — Composable Application / Email / Letter Writer (v2)
// Audience groups × purposes × reason-types × style → richer drafts.

// ═══════════════════════════════════════════════════════════════════
// AUDIENCES (with group classification)
// ═══════════════════════════════════════════════════════════════════

var WRITING_AUDIENCES = [
    { id:'principal', group:'school', role:'Principal',
      aliases:/\b(principal|headmaster|headmistress|vice\s+principal|head\s+of\s+school)\b/i,
      salutation:{formal:'Respected Sir/Madam,',semi:'Dear Sir/Madam,'},
      closing:{formal:'Yours obediently,',semi:'Yours sincerely,'} },
    { id:'teacher', group:'school', role:'Teacher',
      aliases:/\b(teacher|professor|lecturer|faculty|instructor)\b/i,
      salutation:{formal:'Respected [Name],',semi:'Dear [Name],'},
      closing:{formal:'Yours obediently,',semi:'Sincerely,'} },
    { id:'dean', group:'school', role:'Dean',
      aliases:/\b(dean|hod|head\s+of\s+department)\b/i,
      salutation:{formal:'Respected [Name],',semi:'Dear [Name],'},
      closing:{formal:'Yours sincerely,',semi:'Sincerely,'} },
    { id:'registrar', group:'school', role:'Registrar',
      aliases:/\b(registrar|admin|administration|university\s+office)\b/i,
      salutation:{formal:'Dear Sir/Madam,',semi:'Dear [Name],'},
      closing:{formal:'Yours sincerely,',semi:'Sincerely,'} },

    { id:'manager', group:'workplace', role:'Manager',
      aliases:/\b(manager|boss|supervisor|team\s+lead|employer)\b/i,
      salutation:{formal:'Dear [Name],',semi:'Hi [Name],'},
      closing:{formal:'Best regards,',semi:'Thanks,'} },
    { id:'hr', group:'workplace', role:'HR Manager',
      aliases:/\b(hr|human\s+resources)\b/i,
      salutation:{formal:'Dear Sir/Madam,',semi:'Hi [Name],'},
      closing:{formal:'Best regards,',semi:'Thanks,'} },
    { id:'colleague', group:'workplace', role:'Colleague',
      aliases:/\b(colleague|coworker|co-worker|teammate|team\s+member)\b/i,
      salutation:{formal:'Dear [Name],',semi:'Hi [Name],'},
      closing:{formal:'Best regards,',semi:'Cheers,'} },

    { id:'client', group:'business', role:'Client',
      aliases:/\b(client|customer|buyer)\b/i,
      salutation:{formal:'Dear [Name],',semi:'Hi [Name],'},
      closing:{formal:'Best regards,',semi:'Thanks,'} },
    { id:'vendor', group:'business', role:'Vendor',
      aliases:/\b(vendor|supplier|contractor)\b/i,
      salutation:{formal:'Dear [Name],',semi:'Hi [Name],'},
      closing:{formal:'Best regards,',semi:'Thanks,'} },

    { id:'friend', group:'personal', role:'Friend',
      aliases:/\b(friend|buddy|mate|bro|sis|dude|pal)\b/i,
      salutation:{formal:'Dear [Name],',semi:'Hi [Name],',informal:'Hey [Name],'},
      closing:{formal:'Best,',semi:'Take care,',informal:'Cheers,'} },
    { id:'family', group:'personal', role:'Family',
      aliases:/\b(family|mom|mum|dad|mother|father|sister|brother|grandma|grandpa|aunt|uncle|cousin)\b/i,
      salutation:{informal:'Hi [Name],',semi:'Hi [Name],',formal:'Dear [Name],'},
      closing:{informal:'Love,',semi:'Take care,',formal:'Best,'} },

    { id:'bank', group:'official', role:'Bank Manager',
      aliases:/\b(bank|banker|bank\s+manager)\b/i,
      salutation:{formal:'Dear Sir/Madam,',semi:'Dear [Name],'},
      closing:{formal:'Yours sincerely,',semi:'Sincerely,'} },
    { id:'landlord', group:'official', role:'Landlord',
      aliases:/\b(landlord|landlady|property\s+owner)\b/i,
      salutation:{formal:'Dear Mr./Ms. [Name],',semi:'Hello [Name],'},
      closing:{formal:'Sincerely,',semi:'Thanks,'} },
    { id:'police', group:'official', role:'Police Officer',
      aliases:/\b(police|station|inspector|sho|officer)\b/i,
      salutation:{formal:'Respected Sir/Madam,',semi:'Dear Officer,'},
      closing:{formal:'Yours sincerely,',semi:'Regards,'} },
    { id:'municipal', group:'official', role:'Municipal Officer',
      aliases:/\b(municipal|municipality|corporation|council|ward)\b/i,
      salutation:{formal:'Dear Sir/Madam,',semi:'Dear [Name],'},
      closing:{formal:'Yours sincerely,',semi:'Regards,'} },
    { id:'government', group:'official', role:'Government Officer',
      aliases:/\b(government|ministry|department|secretary|collector|commissioner)\b/i,
      salutation:{formal:'Respected Sir/Madam,',semi:'Dear Sir/Madam,'},
      closing:{formal:'Yours faithfully,',semi:'Sincerely,'} },
    { id:'doctor', group:'official', role:'Doctor',
      aliases:/\b(doctor|physician|surgeon|dr\.?)\b/i,
      salutation:{formal:'Dear Dr. [Name],',semi:'Hi Dr. [Name],'},
      closing:{formal:'Sincerely,',semi:'Regards,'} },
    { id:'editor', group:'official', role:'Editor',
      aliases:/\b(editor|journalist|reporter|news\s+editor)\b/i,
      salutation:{formal:'Dear Editor,',semi:'Hi [Name],'},
      closing:{formal:'Yours sincerely,',semi:'Regards,'} },

    { id:'interviewer', group:'interview', role:'Interviewer',
      aliases:/\b(interviewer|hiring\s+manager|recruiter)\b/i,
      salutation:{formal:'Dear [Name],',semi:'Hi [Name],'},
      closing:{formal:'Sincerely,',semi:'Best,'} },

    { id:'unknown', group:'_', role:'Recipient',
      aliases:/$^/,
      salutation:{formal:'Dear Sir/Madam,',semi:'Dear [Name],',informal:'Hi [Name],'},
      closing:{formal:'Sincerely,',semi:'Best regards,',informal:'Take care,'} }
];

function writingDetectAudience(text) {
    for (var i = 0; i < WRITING_AUDIENCES.length; i++) {
        var a = WRITING_AUDIENCES[i];
        if (a.aliases.source !== '$^' && a.aliases.test(text)) return a;
    }
    return WRITING_AUDIENCES[WRITING_AUDIENCES.length - 1];
}

function writingDetectTone(text, audience) {
    var t = text.toLowerCase();
    if (/\b(informal|casual|friendly|chill|relaxed)\b/.test(t)) return 'informal';
    if (/\b(formal|professional|official)\b/.test(t)) return 'formal';
    if (audience.group === 'personal') return 'informal';
    if (audience.group === 'school' || audience.group === 'official' || audience.group === 'business') return 'formal';
    return 'semi';
}

function writingDetectStyle(text) {
    var t = text.toLowerCase();
    if (/\b(short|brief|concise|quick|small)\b/.test(t)) return 'concise';
    if (/\b(detailed|long|elaborate|thorough)\b/.test(t)) return 'detailed';
    if (/\b(urgent|asap|immediately|right\s+away)\b/.test(t)) return 'urgent';
    return 'standard';
}

// ═══════════════════════════════════════════════════════════════════
// REASON TYPE CLASSIFIER
// ═══════════════════════════════════════════════════════════════════

var WRITING_REASON_TYPES = [
    { id:'health',
      aliases:/\b(sick|unwell|ill|fever|cold|flu|cough|headache|migraine|pain|surgery|hospital|doctor|treatment|injury|accident|recover|medical|health)\b/i,
      phrases:{ cause:'I have not been keeping well lately',
                detail:'My doctor has advised me to rest and take medication',
                after:'I am expected to recover in a few days',
                courtesy:'I will catch up on anything I miss once I am back on my feet' } },
    { id:'family',
      aliases:/\b(wedding|marriage|nikah|shaadi|funeral|death|demise|family|function|ceremony|ritual|relative|cousin|uncle|aunt|birth|anniversary)\b/i,
      phrases:{ cause:'there is an important family commitment that requires my presence',
                detail:'This is a family matter and I need to be there in person',
                after:'I will be back to my regular schedule once it is over',
                courtesy:'I have arranged for my responsibilities to be covered in my absence' } },
    { id:'academic',
      aliases:/\b(exam|exams|examination|study|studies|class|lecture|assignment|submission|project|thesis|viva|semester|academic)\b/i,
      phrases:{ cause:'there is an academic commitment I need to prepare for',
                detail:'This is time-sensitive and directly related to my coursework',
                after:'I will make sure to compensate for any missed content',
                courtesy:'I have spoken to my classmates about notes and updates I might miss' } },
    { id:'work',
      aliases:/\b(deadline|project|meeting|conference|training|client\s+call|deliverable|release|deploy|launch|sprint)\b/i,
      phrases:{ cause:'there is a work commitment that cannot be rescheduled',
                detail:'The deliverable is due on a tight timeline',
                after:'I will be fully available again once it is done',
                courtesy:'I have briefed the relevant team members about current status' } },
    { id:'travel',
      aliases:/\b(travel|travelling|traveling|trip|journey|flight|train|out\s+of\s+(town|station|city|country)|vacation|holiday)\b/i,
      phrases:{ cause:'I have pre-planned travel that cannot be moved',
                detail:'Tickets have already been booked',
                after:'I will be back on the scheduled return date',
                courtesy:'I will stay reachable over email during travel' } },
    { id:'financial',
      aliases:/\b(money|financial|financially|fee|fees|payment|bill|loan|expense|fund|afford|income|salary|cost)\b/i,
      phrases:{ cause:'there is a financial constraint in the family at the moment',
                detail:'This has been a persistent difficulty for some time',
                after:'The situation is expected to improve soon',
                courtesy:'I am willing to provide any documentation required' } },
    { id:'emergency',
      aliases:/\b(emergency|urgent|unexpected|sudden|crisis|unforeseen|last\s+minute)\b/i,
      phrases:{ cause:'an unexpected emergency has come up',
                detail:'This could not have been planned for or predicted',
                after:'I am doing everything I can to resolve it quickly',
                courtesy:'I will update you as soon as the situation stabilises' } },
    { id:'technical',
      aliases:/\b(system|server|software|bug|outage|network|internet|power|electricity|maintenance|downtime|technical)\b/i,
      phrases:{ cause:'there is a technical issue that requires my attention',
                detail:'This has affected my ability to work normally',
                after:'I am working with the relevant support team to resolve it',
                courtesy:'I will keep you posted on any change in status' } },
    { id:'personal',
      aliases:/\b(personal|private|unavoidable|commitment|matter)\b/i,
      phrases:{ cause:'I have a personal matter that requires my attention',
                detail:'This is unavoidable and time-sensitive',
                after:'I will be back to my regular schedule shortly',
                courtesy:'I appreciate your understanding on this' } },
    { id:'other',
      aliases:/$^/,
      phrases:{ cause:'I have an unavoidable commitment I need to attend to',
                detail:'This has come up on short notice',
                after:'I will resume my regular schedule as soon as possible',
                courtesy:'Thank you for your understanding' } }
];

function writingDetectReasonType(text) {
    for (var i = 0; i < WRITING_REASON_TYPES.length; i++) {
        var r = WRITING_REASON_TYPES[i];
        if (r.aliases.source !== '$^' && r.aliases.test(text)) return r;
    }
    return WRITING_REASON_TYPES[WRITING_REASON_TYPES.length - 1];
}

// ═══════════════════════════════════════════════════════════════════
// DETAIL EXTRACTION
// ═══════════════════════════════════════════════════════════════════

function writingExtractDetails(text) {
    var d = { name:null, dates:null, reason:null, topic:null };

    var mName = text.match(/\b(?:to|dear)\s+(?:mr\.?|ms\.?|mrs\.?|dr\.?|prof\.?|professor|sir|madam)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/);
    if (mName) d.name = mName[1].trim();

    var mRange = text.match(/\bfrom\s+([^,.;]+?)\s+to\s+([^,.;]+?)(?:[,.;]|$)/i);
    if (mRange) d.dates = { from:mRange[1].trim(), to:mRange[2].trim() };
    else {
        var mOn = text.match(/\bon\s+([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+|\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (mOn) d.dates = { on:mOn[1].trim() };
    }

    var mReason = text.match(/\b(?:because|due\s+to|as|since|owing\s+to)\s+([^,.;]+?)(?:[,.;]|$)/i);
    if (mReason) d.reason = mReason[1].trim();

    var mTopic = text.match(/\b(?:about|regarding|concerning|on\s+the\s+topic\s+of)\s+([^,.;]+?)(?:[,.;]|$)/i);
    if (mTopic) d.topic = mTopic[1].trim();
    else {
        var mFor = text.match(/\bfor\s+([^,.;]+?)(?:[,.;]|$)/i);
        if (mFor) d.topic = mFor[1].trim();
    }

    return d;
}

// ═══════════════════════════════════════════════════════════════════
// PURPOSES
// Each build(ctx) returns paragraphs, branching by audience.group.
// ctx = { audience, tone, style, name, reason, topic, dates,
//         reasonType:{phrases}, formatRange(), formatDate() }
// ═══════════════════════════════════════════════════════════════════

var WRITING_PURPOSES = [
    { id:'sick-leave', aliases:/\bsick\b|\bill(ness)?\b|\bmedical\b|\bnot\s+well\b|\bunwell\b|\bhealth\b/i,
      subject:{ school:'Application for Sick Leave', workplace:'Sick Leave Request', business:'Out Sick — Coverage Arranged', personal:'Sick Leave Request', official:'Sick Leave Application', _:'Sick Leave Request' },
      build:function(ctx){
        var R = ctx.reasonType.phrases;
        if (ctx.audience.group === 'school') return [
          'I am [Your Name], a student of [Class / Section] with Roll No. [Number]. I regret to inform you that I am unwell and will not be able to attend school for the next few days.',
          'My doctor has advised rest'+ctx.formatRange()+', and I have attached a medical certificate for your kind reference. '+R.after+'.',
          'I kindly request you to grant me sick leave for the stated period. I will make sure to catch up on any missed lessons and assignments once I am back.'
        ];
        if (ctx.audience.group === 'workplace') return [
          'I wanted to let you know that I am unwell and will not be able to come in to work for the next few days. My doctor has advised rest'+ctx.formatRange()+'.',
          'I have informed [Colleague Name] about my ongoing tasks and shared all necessary context so nothing urgent gets held up. I will be reachable at [Phone / Email] if anything critical comes up.',
          'I will keep you updated on how I am doing and will be back as soon as I am fit. Thank you for understanding.'
        ];
        if (ctx.audience.group === 'business') return [
          'I wanted to give you a quick heads-up that I am unwell and will be away for the next few days'+ctx.formatRange()+'.',
          '[Colleague Name] will be available at [contact] in my absence for anything urgent. All ongoing work is documented and handed over so nothing is left hanging.',
          'I will be back as soon as I am well. Apologies for any inconvenience, and thank you for your patience.'
        ];
        return [
          'I am writing to inform you that I am unwell and will not be available for [number] days'+ctx.formatRange()+'.',
          R.detail+'. '+R.courtesy+'.',
          'Thank you for your understanding.'
        ];
      } },

    { id:'casual-leave', aliases:/\bcasual\s+leave\b|\bpersonal\s+(leave|reason|work)\b/i,
      subject:{ school:'Application for Casual Leave', workplace:'Casual Leave Request', _:'Leave Request' },
      build:function(ctx){
        var R = ctx.reasonType.phrases;
        if (ctx.audience.group === 'school') return [
          'I am [Your Name], a student of [Class / Section] with Roll No. [Number]. I am writing to request casual leave for [number] day(s)'+ctx.formatRange()+'.',
          'The reason for this is that '+R.cause+'. '+R.detail+'.',
          'I kindly request you to approve my leave. '+R.courtesy+'.'
        ];
        if (ctx.audience.group === 'workplace') return [
          'I would like to request casual leave for [number] day(s)'+ctx.formatRange()+'. The reason is that '+R.cause+'.',
          'I have completed my pending tasks and briefed [Colleague Name] on anything time-sensitive. I will be reachable at [Phone / Email] for anything urgent.',
          'Thank you for considering my request.'
        ];
        return [
          'I am writing to request leave for [number] day(s)'+ctx.formatRange()+'.',
          'This is because '+R.cause+'. '+R.detail+'.',
          'Thank you for considering my request.'
        ];
      } },

    { id:'emergency-leave', aliases:/\bemergency\b|\burgent\b|\bfamily\s+(emergency|problem|crisis)\b|\bunforeseen\b/i,
      subject:{ _:'Urgent — Emergency Leave Request' },
      build:function(ctx){
        var R = ctx.reasonType.phrases;
        return [
          'I am [Your Name]'+(ctx.audience.group==='school'?', a student of [Class / Section]':'')+'. I am writing to request emergency leave for [number] day(s)'+ctx.formatRange()+'.',
          'The situation is that '+R.cause+'. '+R.detail+'. I was unable to give prior notice because of how suddenly this came up.',
          'I kindly request you to approve my leave. '+R.courtesy+'. I will return as soon as things are settled and will share the necessary details then.'
        ];
      } },

    { id:'marriage-leave', aliases:/\bmarriage\b|\bwedding\b|\bnikah\b|\bshaadi\b/i,
      subject:{ _:'Application for Marriage Leave' },
      build:function(ctx){
        return [
          'I am [Your Name]'+(ctx.audience.group==='school'?', a student of [Class / Section]':'')+'. I am writing to request leave for [number] days'+ctx.formatRange()+', as I am getting married / attending a close family wedding.',
          'There are several pre-wedding and post-wedding ceremonies and rituals that require my presence at home during this period.',
          'I kindly request you to grant me leave for the stated duration. I will resume my duties promptly afterwards and catch up on anything I have missed.'
        ];
      } },

    { id:'leave-generic', aliases:/\bleave\b|\bday\s+off\b|\btime\s+off\b|\babsence\b|\bvacation\b|\bholiday\b/i,
      subject:{ _:'Leave Request' },
      build:function(ctx){
        var R = ctx.reasonType.phrases;
        if (ctx.audience.group === 'workplace') return [
          'I would like to request leave'+ctx.formatRange()+'.',
          'The reason is that '+R.cause+'. '+R.detail+'.',
          'I have arranged for my work to be covered during my absence and will be reachable at [Phone / Email] for anything urgent. Thank you for considering this request.'
        ];
        return [
          'I am writing to request leave'+ctx.formatRange()+'.',
          'This is because '+R.cause+'. '+R.detail+'.',
          'I kindly request you to grant the leave. Thank you for your consideration.'
        ];
      } },

    { id:'apology', aliases:/\bapolog(y|ize|ise|etic)\b|\bsorry\b|\bregret\b/i,
      subject:{ school:'Apology for [Issue]', workplace:'Apology — [Issue]', business:'Our Apologies for [Issue]', personal:'Sorry about [Issue]', official:'Apology regarding [Issue]', _:'Apology' },
      build:function(ctx){
        var topic = ctx.topic || '[what happened]';
        var reason = ctx.reason || ctx.reasonType.phrases.cause;
        if (ctx.audience.group === 'school') return [
          'I am writing to sincerely apologize for '+topic+'.',
          'The reason for this was '+reason+'. I understand this was not acceptable, and I take full responsibility for my actions.',
          'I assure you this will not happen again. I would be grateful for the opportunity to make up for any inconvenience caused. Thank you for your understanding.'
        ];
        if (ctx.audience.group === 'workplace') return [
          'I want to apologize for '+topic+'. This should not have happened, and I take full ownership of it.',
          'The reason was '+reason+'. That said, I understand the impact this had and I am already putting measures in place to make sure it does not repeat.',
          'Thank you for your patience. Please let me know if there is anything I can do to make this right.'
        ];
        if (ctx.audience.group === 'business') return [
          'I am writing on behalf of [Company Name] to sincerely apologize for '+topic+'.',
          'We understand how frustrating this must have been, and we take full responsibility. The issue was caused by '+reason+'. We have already taken steps to correct it and are putting measures in place to prevent a recurrence.',
          'Thank you for your patience and for giving us the opportunity to make this right. Please do not hesitate to reach out if there is anything else we can do.'
        ];
        if (ctx.audience.group === 'personal') return [
          'I wanted to say sorry for '+topic+'. I know I should have handled it better.',
          'The reason was '+reason+', but that is not really an excuse — I should have thought it through.',
          'I hope you can forgive me. Let me know if there is anything I can do to make it up to you.'
        ];
        return [
          'I am writing to apologize for '+topic+'.',
          'The reason was '+reason+'. I take full responsibility for this.',
          'Please accept my sincere apologies. Thank you for your understanding.'
        ];
      } },

    { id:'complaint', aliases:/\bcomplain(t|ing)?\b|\bdisappointed\b|\bunhappy\b|\bpoor\s+(service|quality)\b|\bnot\s+satisfied\b|\bissue\s+with\b/i,
      subject:{ _:'Complaint regarding [Issue]' },
      build:function(ctx){
        var topic = ctx.topic || '[the issue]';
        if (ctx.audience.group === 'business' || ctx.audience.group === 'official') return [
          'I am writing to formally raise a complaint regarding '+topic+'.',
          'On [Date], I experienced the following problem: [describe the issue in detail]. This is far below the standard I expected and has caused me [inconvenience / loss / delay].',
          'I kindly request you to look into this matter and take appropriate action at the earliest. I would appreciate a written response within [timeframe].'
        ];
        return [
          'I wanted to raise a concern about '+topic+'.',
          'Here is what happened: [describe the issue]. This has caused me [impact — delay / cost / inconvenience].',
          'I hope this can be looked into and resolved. Please let me know what the next steps are.'
        ];
      } },

    { id:'request-generic', aliases:/\brequest(ing)?\b|\bask(ing)?\s+for\b|\bplease\s+(help|provide|send|share|arrange)\b/i,
      subject:{ _:'Request — [Subject]' },
      build:function(ctx){
        var topic = ctx.topic || '[what you are requesting]';
        if (ctx.audience.group === 'workplace') return [
          'I wanted to reach out with a small request regarding '+topic+'.',
          '[Add the specifics — what you need, by when, and any context that helps.]',
          'I would really appreciate it if this could be looked into. Thank you.'
        ];
        if (ctx.audience.group === 'school') return [
          'I am [Your Name], a student of [Class / Section]. I am writing to request '+topic+'.',
          '[Add any relevant details or background.]',
          'I kindly request you to consider my request. Thank you for your time.'
        ];
        return [
          'I am writing to request '+topic+'.',
          '[Add the details here.]',
          'Thank you for considering this.'
        ];
      } },

    { id:'meeting-request', aliases:/\bmeeting\s+(request|invite|invitation)\b|\brequest\b.{0,20}\bmeeting\b|\bschedule\b.{0,20}\bmeeting\b|\bcall\b.{0,20}\bschedule\b/i,
      subject:{ _:'Meeting Request — [Topic]' },
      build:function(ctx){
        var topic = ctx.topic || '[topic]';
        return [
          'I would like to request a meeting to discuss '+topic+'. I believe a short conversation would help us [desired outcome].',
          'Would [Proposed Date] at [Proposed Time] work for you? The meeting should take approximately [Duration]. If that time does not suit you, please suggest an alternative.',
          'Looking forward to speaking with you. Thank you.'
        ];
      } },

    { id:'follow-up', aliases:/\bfollow[\s-]?up\b|\bchecking\s+in\b|\bany\s+update\b|\bcheck\s+on\b/i,
      subject:{ _:'Follow-up — [Topic]' },
      build:function(ctx){
        var topic = ctx.topic || '[the topic]';
        if (ctx.audience.group === 'interview') return [
          'I hope this message finds you well. I wanted to follow up on my interview for the '+topic+' position.',
          'I remain very interested in this opportunity and believe my experience in [relevant skill] would allow me to contribute meaningfully to your team.',
          'Please let me know if there are any updates on the hiring process or if you need any additional information from me. Thank you for your time.'
        ];
        return [
          'Just following up on '+topic+' — I wanted to check if there is any update.',
          '[Add any context or new information that might be relevant.]',
          'No rush if you are still working on it — just wanted to keep it on the radar. Thank you!'
        ];
      } },

    { id:'thank-you', aliases:/\bthank[\s-]?you\b|\bthanks\b|\bgrateful\b|\bappreciat(e|ion)\b/i,
      subject:{ _:'Thank You' },
      build:function(ctx){
        var topic = ctx.topic || '[what you are thankful for]';
        if (ctx.audience.group === 'interview') return [
          'Thank you for taking the time to speak with me about the '+topic+' position. I really enjoyed learning more about the role and your team.',
          'Our conversation reinforced my enthusiasm for this opportunity. I am especially excited about [something specific you discussed] and how it aligns with my experience in [relevant area].',
          'Please do not hesitate to reach out if you need any further information. Thank you again for your time and consideration.'
        ];
        if (ctx.audience.group === 'personal') return [
          'I just wanted to say a huge thank you for '+topic+'. It genuinely meant a lot to me.',
          'You did not have to go out of your way, and I really appreciate it. Let me know how I can return the favour.',
          'Thanks again — you are the best!'
        ];
        if (ctx.audience.group === 'workplace' || ctx.audience.group === 'business') return [
          'I wanted to take a moment to thank you for '+topic+'. It made a real difference.',
          'I appreciate the time and effort you put in. It did not go unnoticed.',
          'Thank you again. If there is ever anything I can do in return, please do not hesitate to ask.'
        ];
        return [
          'I wanted to sincerely thank you for '+topic+'.',
          'It meant a great deal to me, and I truly appreciate the time and effort you put in.',
          'Thank you again. Please let me know if I can ever return the favour.'
        ];
      } },

    { id:'resignation', aliases:/\bresignation\b|\bresign\b|\bquit(ting)?\b/i,
      subject:{ _:'Resignation — [Your Name]' },
      build:function(ctx){
        var role = ctx.topic || '[Job Title]';
        return [
          'I am writing to formally resign from my position as '+role+' at [Company Name]. My last working day will be [Date], as per my notice period.',
          'I am grateful for the opportunities I have had here. Working with the team has helped me grow in [skills / areas], and I will always value the time I spent at [Company Name].',
          'I will do my best to ensure a smooth handover of my responsibilities before I leave. Thank you for the support you have shown me.'
        ];
      } },

    { id:'job-application', aliases:/\bjob\s+application\b|\bapplication\b.{0,20}\b(job|position|post|vacancy)\b|\bapply(ing)?\s+for\b.{0,20}\b(job|position|role)\b/i,
      subject:{ _:'Application for the Post of [Job Title]' },
      build:function(ctx){
        var role = ctx.topic || '[Job Title]';
        return [
          'I am writing to apply for the position of '+role+' at [Company Name], as advertised on [Where You Saw It]. I am a [Your Qualification] with [Number] years of experience in [Field].',
          'In my current role at [Current Employer], I have [Key Achievement 1] and [Key Achievement 2]. I believe my skills in [Skill 1], [Skill 2], and [Skill 3] make me a strong fit for this role.',
          'I have attached my resume for your consideration. I would be glad to discuss how I can contribute to your team. Thank you for your time and consideration.'
        ];
      } },

    { id:'recommendation', aliases:/\brecommendation\b|\breference\s+letter\b|\bletter\s+of\s+recommendation\b/i,
      subject:{ _:'Request for a Letter of Recommendation' },
      build:function(ctx){
        var topic = ctx.topic || '[program / position]';
        return [
          'I hope you are doing well. I am writing to ask if you would be willing to write a letter of recommendation for me.',
          'I am applying for '+topic+', and the application requires a recommendation from someone who can speak to my [work ethic / academic performance / skills]. Having worked with you on [specific project / course], I believe your perspective would be especially valuable.',
          'The deadline is '+ctx.formatDate()+'. I have attached my resume and [statement of purpose / transcript] for reference. Please let me know if there is any information that would help. Thank you for considering my request.'
        ];
      } },

    { id:'fee-concession', aliases:/\bfee\s+(concession|waiver|reduction)\b|\bscholarship\b|\bfinancial\s+(aid|assistance)\b/i,
      subject:{ _:'Application for Fee Concession' },
      build:function(ctx){
        var reason = ctx.reason || '[financial difficulty at home]';
        return [
          'I am [Your Name], a student of [Class / Section] with Roll No. [Roll Number]. I am writing to request a fee concession for the current academic year.',
          'Due to '+reason+', my family is currently unable to pay the full fees. I have always maintained [mention academic standing] and remain committed to my studies.',
          'I kindly request you to consider my situation and grant a concession or an installment plan. I am ready to provide any supporting documents required.'
        ];
      } },

    { id:'character-certificate', aliases:/\bcharacter\s+certificate\b/i,
      subject:{ _:'Application for Character Certificate' },
      build:function(ctx){
        var topic = ctx.topic || '[Purpose — e.g. job application / new admission]';
        return [
          'I am [Your Name], a former student of this institution, having completed [Course / Class] in the year [Year of Passing] with Roll No. [Roll Number].',
          'I require a character certificate for '+topic+'.',
          'I kindly request you to issue the character certificate at the earliest. I will be grateful for your assistance.'
        ];
      } },

    { id:'invite-birthday', aliases:/\bbirthday\b/i,
      subject:{ _:'You\'re invited to my birthday! 🎉' },
      build:function(ctx){
        var date = ctx.formatDate();
        if (ctx.audience.group === 'personal') return [
          'Hope you\'re doing great! I\'m throwing a small birthday party this year and I\'d love for you to be there.',
          'It\'s on '+date+' at [Time], at [Venue]. There\'ll be food, music, and a whole lot of fun — it won\'t be the same without you.',
          'Let me know if you can make it. Really hoping to see you there!'
        ];
        return [
          'I am delighted to invite you to my birthday celebration on '+date+' at [Time].',
          'The venue is [Venue]. It will be a small gathering of close friends and family — your presence would mean a lot.',
          'Kindly confirm your availability at your earliest convenience. Looking forward to celebrating together.'
        ];
      } },

    { id:'invite-wedding', aliases:/\bwedding\b|\bmarriage\s+invitation\b|\bnikah\b/i,
      subject:{ _:'Wedding Invitation 💍' },
      build:function(ctx){
        var date = ctx.formatDate();
        return [
          'With great joy, I would like to invite you to my wedding. It would mean the world to have you there on this special day.',
          'The ceremony will be held on '+date+' at [Time], at [Venue]. The reception will follow at [Time] at [Location].',
          'Your presence will make the occasion even more memorable. Please let me know if you can join us.'
        ];
      } },

    { id:'invite-generic', aliases:/\binvit(e|ation|ing)\b|\bjoin\s+us\b/i,
      subject:{ _:'Invitation — [Event]' },
      build:function(ctx){
        var topic = ctx.topic || '[event]';
        var date = ctx.formatDate();
        return [
          'I would love to invite you to '+topic+'.',
          'It will be held on '+date+' at [Time], at [Venue]. [Add any other relevant details.]',
          'Please let me know if you can make it. It would mean a lot to have you there.'
        ];
      } },

    { id:'get-well-soon', aliases:/\bget[\s-]?well\b|\bwishing\b.{0,20}\b(well|recover)\b|\bspeedy\s+recovery\b/i,
      subject:{ _:'Get well soon!' },
      build:function(ctx){
        if (ctx.audience.group === 'personal') return [
          'I heard you haven\'t been feeling well and just wanted to reach out. I hope you\'re taking it easy and getting plenty of rest.',
          'Don\'t worry about anything on this end — just focus on getting better.',
          'Let me know if there\'s anything I can do. Wishing you a quick recovery!'
        ];
        return [
          'I was sorry to hear that you have not been well. Please accept my best wishes for a quick and complete recovery.',
          'Do take adequate rest and follow your doctor\'s advice. Everything on this side is well taken care of, so please do not worry.',
          'Let me know if there is anything at all I can help with. Wishing you a speedy recovery.'
        ];
      } },

    { id:'congratulation', aliases:/\bcongratulat(e|ion|ing)\b|\bwell\s+done\b|\bcongrats\b/i,
      subject:{ _:'Congratulations!' },
      build:function(ctx){
        var topic = ctx.topic || '[the achievement]';
        if (ctx.audience.group === 'personal') return [
          'Congratulations on '+topic+'! I am so happy for you.',
          'You worked really hard for this and you absolutely deserve it.',
          'Let\'s celebrate soon. So proud of you!'
        ];
        return [
          'I was delighted to hear about '+topic+'. Please accept my warmest congratulations.',
          'This is a well-deserved recognition of your hard work and dedication.',
          'Wishing you continued success in all your future endeavours.'
        ];
      } },

    { id:'condolence', aliases:/\bcondolence\b|\bsympath(y|ies)\b|\bpassing\s+away\b|\bdeath\b|\bdemise\b|\bfuneral\b/i,
      subject:{ _:'Heartfelt Condolences' },
      build:function(ctx){
        return [
          'I was deeply saddened to hear about the passing of [Name]. Please accept my heartfelt condolences.',
          'I know words cannot take away the pain, but please know that you and your family are in my thoughts and prayers during this difficult time.',
          'Please do not hesitate to reach out if there is anything at all I can do. Take care.'
        ];
      } },

    { id:'feedback', aliases:/\bfeedback\b|\bsuggestion(s)?\b|\breview\b|\bopinion\s+on\b/i,
      subject:{ _:'Feedback on [Topic]' },
      build:function(ctx){
        var topic = ctx.topic || '[the subject]';
        if (ctx.audience.group === 'business' || ctx.audience.group === 'workplace') return [
          'Thank you for sharing '+topic+' with me. I have gone through it and would like to share my feedback.',
          'Overall, I think [overall impression]. A few things that could be improved: [point 1], [point 2], and [point 3].',
          'I hope this is helpful. Happy to discuss in more detail if needed.'
        ];
        return [
          'Here is my honest feedback on '+topic+'.',
          '[What worked well.] On the other hand, [what could be better].',
          'Hope this helps. Let me know what you think.'
        ];
      } },

    { id:'reminder', aliases:/\bremind(er|ing)?\b|\bdon\'t\s+forget\b|\bjust\s+a\s+nudge\b/i,
      subject:{ _:'Friendly Reminder — [Topic]' },
      build:function(ctx){
        var topic = ctx.topic || '[the task]';
        return [
          'Just a quick reminder about '+topic+'.',
          'I know things get busy — sharing this so it does not slip through. [Add the deadline or any specifics.]',
          'Let me know if you need anything from my end. Thanks!'
        ];
      } },

    { id:'introduction', aliases:/\bintroduce\s+myself\b|\bintroduction\b|\bwho\s+i\s+am\b|\bintroduce\s+me\b/i,
      subject:{ _:'Introduction — [Your Name]' },
      build:function(ctx){
        if (ctx.audience.group === 'workplace' || ctx.audience.group === 'business') return [
          'Hello, I am [Your Name], and I recently joined as [Your Role]. I wanted to introduce myself and say how glad I am to be working with you.',
          'I come from [Background] and have experience in [Skill / Area]. I look forward to learning from everyone here and contributing to our shared goals.',
          'Please feel free to reach out if there is anything I should know or if I can help with anything. Looking forward to working together.'
        ];
        return [
          'Hi! I am [Your Name]. [A bit about yourself — where you are from, what you do.]',
          '[Something interesting or relevant — a hobby, a recent project, a shared interest.]',
          'Looking forward to getting to know you. Feel free to reach out anytime.'
        ];
      } },

    { id:'request-information', aliases:/\brequest\s+information\b|\basking\s+for\s+details\b|\bneed\s+info\b|\benquire\b|\binquiry\b/i,
      subject:{ _:'Enquiry regarding [Topic]' },
      build:function(ctx){
        var topic = ctx.topic || '[the subject]';
        return [
          'I am writing to enquire about '+topic+'.',
          'Could you please share the following details: [list them — one per line]. Any additional context you can provide would also be helpful.',
          'Thank you for your time. I look forward to your response.'
        ];
      } },

    { id:'appreciation', aliases:/\bappreciat(e|ion)\b|\bcredit\s+where\s+due\b|\brecogni[sz]e\b/i,
      subject:{ _:'A note of appreciation' },
      build:function(ctx){
        var topic = ctx.topic || '[what you appreciate]';
        return [
          'I wanted to take a moment to express my sincere appreciation for '+topic+'.',
          'It made a real difference to me, and I did not want it to go unnoticed. Your effort and care were evident throughout.',
          'Thank you once again. I hope our paths continue to cross.'
        ];
      } },

    { id:'reschedule', aliases:/\breschedul(e|ing)\b|\bpostpone\b|\bcancel\b.*\b(reschedule|meeting|call)\b|\bmove\s+the\b/i,
      subject:{ _:'Reschedule — [Event]' },
      build:function(ctx){
        var topic = ctx.topic || '[the meeting / call / event]';
        var reason = ctx.reason || ctx.reasonType.phrases.cause;
        return [
          'I am writing to request that we reschedule '+topic+'. Unfortunately, '+reason+'.',
          'Could we move it to [Proposed New Date] at [Proposed Time]? If that does not work, please suggest an alternative that suits you.',
          'Apologies for the inconvenience. Thank you for your understanding.'
        ];
      } },

    { id:'generic', aliases:/$^/,
      subject:{ _:'[Subject]' },
      build:function(ctx){
        var topic = ctx.topic || '[the matter]';
        var reason = ctx.reason || ctx.reasonType.phrases.cause;
        if (ctx.audience.group === 'personal') return [
          'Hope you\'re doing well! I wanted to reach out about '+topic+'.',
          'This is because '+reason+'. [Add the details you want to share.]',
          'Let me know what you think. Talk soon!'
        ];
        if (ctx.audience.group === 'school' || ctx.audience.group === 'official') return [
          'I am [Your Name]'+(ctx.audience.group==='school'?', a student of [Class / Section]':'')+'. I am writing to bring the following matter to your kind attention:',
          'Regarding: '+topic+'. '+reason+' — [add any relevant background here.]',
          'I kindly request you to look into this matter. Thank you for your time.'
        ];
        return [
          'I am writing to you regarding '+topic+'.',
          reason+' — [add any relevant background here.]',
          'Please let me know if you need any further information. Thank you for your time.'
        ];
      } }
];

function writingDetectPurpose(text) {
    for (var i = 0; i < WRITING_PURPOSES.length; i++) {
        var p = WRITING_PURPOSES[i];
        if (p.aliases.source !== '$^' && p.aliases.test(text)) return p;
    }
    return WRITING_PURPOSES[WRITING_PURPOSES.length - 1];
}

// ═══════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════

function isWritingRequest(text) {
    if (typeof text !== 'string') return false;
    var t = text.trim();
    if (!t || t.length > 400) return false;

    if (/^\/(write|email|letter|application|mail)\b/i.test(t)) return true;
    if (/\b(c\s*program|programming|source\s+code|syntax|compile|base\s+conversion|binary|hex|octal)\b/i.test(t)) return false;
    if (/^(write|say|repeat|print)\s+.+\s+\d+\s*times?/i.test(t)) return false;
    if (/^(how|what|why|where|when|which|who|can\s+i|is|are|do|does)\b/i.test(t)) return false;

    if (/\b(write|draft|compose|create|make|prepare|formulate|send)\b.{0,40}\b(application|email|e-mail|letter|mail|note|invitation|request|message)\b/i.test(t)) return true;
    if (/\b(application|email|e-mail|letter|mail|invitation|note)\b.{0,40}\b(to|for|about|regarding|from|inviting)\b/i.test(t)) return true;
    if (/\b(invite|apologize|apologise|resign|thank|congratulate|request|remind)\b.{0,40}\b(him|her|them|friend|boss|manager|professor|principal|client|teacher|colleague|doctor|bank|police|family)\b/i.test(t)) return true;

    return false;
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSER
// ═══════════════════════════════════════════════════════════════════

function writingCompose(text) {
    var audience   = writingDetectAudience(text);
    var purpose    = writingDetectPurpose(text);
    var tone       = writingDetectTone(text, audience);
    var style      = writingDetectStyle(text);
    var reasonType = writingDetectReasonType(text);
    var details    = writingExtractDetails(text);

    var ctx = {
        audience: audience, purpose: purpose, tone: tone, style: style,
        reasonType: reasonType,
        name: details.name, reason: details.reason, topic: details.topic, dates: details.dates,
        formatRange: function () {
            if (details.dates && details.dates.from && details.dates.to)
                return ', from ' + details.dates.from + ' to ' + details.dates.to;
            if (details.dates && details.dates.on) return ', on ' + details.dates.on;
            return ', from [Start Date] to [End Date]';
        },
        formatDate: function () {
            if (details.dates && (details.dates.on || details.dates.from))
                return details.dates.on || details.dates.from;
            return '[Date]';
        }
    };

    var paragraphs = purpose.build(ctx);

    // Concise: drop the middle paragraph (usually detail/context).
    if (style === 'concise' && paragraphs.length >= 3) {
        paragraphs = [paragraphs[0], paragraphs[paragraphs.length - 1]];
    }
    // Detailed: prepend a short courtesy line after the first paragraph.
    if (style === 'detailed') {
        var empathy = {
            'health':   'I regret having to make this request and appreciate your consideration.',
            'family':   'I understand the timing may not be ideal and I truly appreciate your understanding.',
            'work':     'I take my responsibilities seriously and would not ask unless it were necessary.',
            'emergency':'I apologise for the short notice and will do my best to minimise any disruption.',
            'financial':'I am sharing this in confidence and hope you will consider my situation kindly.'
        }[reasonType.id];
        if (empathy) paragraphs.splice(1, 0, empathy);
    }
    // Urgent: prefix the subject with "Urgent —".
    var subject = (purpose.subject[audience.group] || purpose.subject._ || '[Subject]');
    if (style === 'urgent' && !/^urgent\b/i.test(subject)) subject = 'Urgent — ' + subject;
    if (details.topic) subject = subject.replace(/\[Topic\]/g, details.topic).replace(/\[Subject\]/g, details.topic);

    var salutation = audience.salutation[tone] || audience.salutation.formal || audience.salutation.semi || audience.salutation.informal || 'Dear [Name],';
    var closing    = audience.closing[tone]    || audience.closing.formal    || audience.closing.semi    || audience.closing.informal    || 'Sincerely,';

    if (details.name) {
        salutation = salutation.replace(/\[Name\]/g, details.name).replace(/\[Manager's Name\]/g, details.name);
    }

    return { audience:audience, purpose:purpose, tone:tone, style:style,
             reasonType:reasonType, details:details,
             subject:subject, salutation:salutation, paragraphs:paragraphs, closing:closing };
}

// ═══════════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════════

function writingEscapeHTML(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function writingBuildDocument(composed, medium) {
    var L = [];
    if (medium === 'application') {
        L.push('To');
        L.push('The ' + (composed.audience.id === 'unknown' ? 'Principal' : composed.audience.role));
        L.push('[School / College / Company Name]');
        L.push('');
        L.push('Date: [DD/MM/YYYY]');
        L.push('');
        L.push('Subject: ' + composed.subject);
        L.push('');
        L.push('Respected Sir/Madam,');
    } else {
        L.push('Subject: ' + composed.subject);
        L.push('');
        L.push(composed.salutation);
    }
    L.push('');
    for (var i = 0; i < composed.paragraphs.length; i++) {
        L.push(composed.paragraphs[i]);
        L.push('');
    }
    L.push(composed.closing + '\n[Your Name]');
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
}

function writingHandle(rawText) {
    var text = String(rawText).trim();

    var medium = 'email';
    if (/\bapplication\b/i.test(text)) medium = 'application';
    else if (/\bletter\b/i.test(text) && !/\b(email|e-mail|mail)\b/i.test(text)) medium = 'letter';
    else if (/\b(email|e-mail|mail)\b/i.test(text)) medium = 'email';

    var cleaned = text
        .replace(/^\/(write|email|letter|application|mail)\s+/i, '')
        .replace(/^(please\s+)?(can\s+you\s+|could\s+you\s+|i\s+want\s+to\s+|i'd\s+like\s+to\s+)?/i, '')
        .replace(/^(write|draft|compose|create|make|prepare|formulate|send)\s+/i, '')
        .replace(/^(an?|the)\s+/i, '')
        .trim();
    if (!cleaned) cleaned = text;

    var composed = writingCompose(cleaned);
    var doc = writingBuildDocument(composed, medium);

    var title = composed.subject;
    if (medium === 'application' && !/^application/i.test(title)) title = 'Application — ' + title;
    else if (medium === 'letter' && !/^letter/i.test(title)) title = 'Letter — ' + title;
    if (!title || title === '[Subject]') title = 'Draft';

    var parts = [];
    parts.push('<div class="xetex-output write-output">');
    parts.push('<div class="xetex-equation">' + writingEscapeHTML(title) + '</div>');
    var fileType = medium === 'application' ? 'application'
             : medium === 'letter'      ? 'letter'
             : 'email';

parts.push('<div class="xetex-step"><div class="xetex-step-num">i</div><div class="xetex-step-body">Draft</div></div>');

if (typeof window.ccodeCard === 'function') {
    parts.push(window.ccodeCard(fileType, writingEscapeHTML(doc), 'write-body'));
} else {
    parts.push('<pre class="write-body">' + writingEscapeHTML(doc) + '</pre>');
}
    parts.push('<div class="xetex-note">Replace every <b>[bracketed]</b> placeholder with your own details.</div>');
    parts.push('</div>');
    return { __html: true, text: parts.join('') };
}

window.isWritingRequest = isWritingRequest;
window.writingHandle = writingHandle;