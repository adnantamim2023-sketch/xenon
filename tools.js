// tools.js -- the ONLY thing that turns a message into a result.
//
// Rules (this is the whole isolation contract):
//   1. A message runs a tool only if it starts with /tool_name.
//      Nothing else is ever inspected, so tools cannot compete for input.
//   2. Exactly one tool runs per message and it only sees its own argument
//      (the text after the command). No detect() functions, no priorities,
//      no fallbacks, no shared conversation state between tools.
//   3. A tool that throws or returns nothing produces a scoped usage message
//      for that tool. It never falls through to another tool.
//   4. Anything that is not a /command gets one static hint. No generated
//      replies of any kind.
(function () {
    'use strict';
    const Xenon = (window.Xenon = window.Xenon || {});

    const byName = new Map();   // every name and alias -> tool
    const list = [];            // canonical tools in registration order

    function register(spec) {
        if (!spec || !spec.name || typeof spec.run !== 'function') return null;
        const tool = {
            name: String(spec.name).toLowerCase(),
            aliases: (spec.aliases || []).map(a => String(a).toLowerCase()),
            summary: spec.summary || '',
            usage: spec.usage || ('/' + spec.name + ' <input>'),
            example: spec.example || '',
            // glue: the argument may touch the name, as in /square5 or /box6:4
            glue: !!spec.glue,
            // raw: hand the tool the whole command text instead of only its argument
            raw: !!spec.raw,
            // noArg: the tool needs no argument (e.g. /tools)
            noArg: !!spec.noArg,
            run: spec.run,
        };
        if (byName.has(tool.name)) return null;
        byName.set(tool.name, tool);
        for (const a of tool.aliases) if (!byName.has(a)) byName.set(a, tool);
        list.push(tool);
        return tool;
    }

    // -- Normalise whatever an engine returns into { html, text } ---------
    function normalise(r) {
        if (r === null || r === undefined || r === '') return null;
        if (typeof r === 'string') return { html: false, text: r };
        if (typeof r === 'object') {
            if (typeof r.responseStr === 'string') return { html: !!r.responseIsHTML, text: r.responseStr };
            if (typeof r.text === 'string') return { html: !!(r.__html || r.html), text: r.text };
        }
        return { html: false, text: String(r) };
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function usageText(tool, why) {
        const lines = ['**/' + tool.name + '** ' + why, 'Usage: ' + tool.usage];
        if (tool.example) lines.push('Example: ' + tool.example);
        return lines.join('\n');
    }

    // -- Parse "/name rest" ----------------------------------------------
    // The name is letters only. What follows must be whitespace (or end of
    // text) unless the tool is flagged glue. That stops "/base64 x" from being
    // silently read as "/base 64 x".
    function parse(text) {
        const raw = String(text || '').trim();
        const m = raw.match(/^\/([A-Za-z]+)/);
        if (!m) return null;
        const rest = raw.slice(m[0].length);
        return {
            raw: raw,
            name: m[1].toLowerCase(),
            rest: rest,
            glued: rest.length > 0 && !/^\s/.test(rest),
            arg: rest.trim(),
        };
    }

    function run(text) {
        const p = parse(text);
        if (!p) {
            return {
                ok: false, tool: null, html: false,
                text: 'Xenon only runs tools. Start your message with /tool_name, or send /tools to see them.',
            };
        }
        const tool = byName.get(p.name);
        if (!tool || (p.glued && !tool.glue)) {
            const shown = '/' + p.name + (p.glued ? p.rest.split(/\s/)[0] : '');
            return {
                ok: false, tool: null, html: false,
                text: 'Unknown tool ' + shown + '. Send /tools to see the available tools.',
            };
        }
        if (!tool.noArg && !p.arg) {
            return { ok: false, tool: tool.name, html: false, text: usageText(tool, 'needs an input.') };
        }
        let out = null, failed = false;
        try {
            out = normalise(tool.run(tool.raw ? p.raw : p.arg, p));
        } catch (e) {
            failed = true;
            console.warn('[Xenon] tool "' + tool.name + '" threw:', e);
        }
        if (!out) {
            return {
                ok: false, tool: tool.name, html: false,
                text: usageText(tool, failed ? 'hit an error on that input.' : "couldn't read that input."),
            };
        }
        return { ok: true, tool: tool.name, html: out.html, text: out.text };
    }

    // Static text generated from the registry so it can never drift out of date.
    // compact=true is the short line shown when a chat opens; /tools is the full list.
    function guideText(compact) {
        const head = '**Xenon tools**\nStart a message with /tool_name and your input. Each tool runs on its own.';
        if (compact) {
            return head + '\n\n' + list.map(t => '/' + t.name).join('  ') + '\n\nSend /tools for details and examples.';
        }
        const lines = [head, ''];
        for (const t of list) {
            lines.push('\u2022 /' + t.name + ' \u2014 ' + t.summary);
            if (t.example) lines.push('    ' + t.example);
        }
        return lines.join('\n');
    }

    Xenon.Tools = {
        register, parse, run, guideText,
        list: () => list.slice(),
        get: (n) => byName.get(String(n).toLowerCase()) || null,
        size: () => list.length,
    };

    // ---------------------------------------------------------------------
    // Registered tools. Every run() calls exactly one engine.
    // ---------------------------------------------------------------------
    const W = window;

    register({
        name: 'math', summary: 'Arithmetic, functions, statistics, geometry',
        usage: '/math <expression>', example: '/math sqrt(144)',
        run: (a) => W.mathEngineHandle((W.mathStripQuestionWrapper && W.mathStripQuestionWrapper(a)) || a),
    });
    register({
        name: 'algebra', summary: 'Linear, quadratic and cubic equations',
        usage: '/algebra <equation>', example: '/algebra x^2 - 5x + 6 = 0',
        run: (a) => W.mathAlgebraHandle(a),
    });
    register({
        name: 'integrate', summary: 'Symbolic integration',
        usage: '/integrate <expression> [dx]', example: '/integrate x^2',
        run: (a) => W.mathAlgebraHandle('integrate ' + a.replace(/^(?:integrate|\u222B)\s*/i, '')),
    });
    register({
        name: 'physics', summary: 'Physics problems from known quantities',
        usage: '/physics <problem with numbers and units>',
        example: '/physics a 5 kg mass accelerates at 3 m/s2, find the force',
        run: (a) => W.physHandle(a),
    });
    register({
        name: 'logic', summary: 'Boolean expressions, truth tables, gate circuits',
        usage: '/logic <expression>', example: '/logic A AND B',
        run: (a) => W.logicHandle(a),
    });
    register({
        name: 'base', summary: 'Binary, octal, decimal, hex and any base 2-36',
        usage: '/base <number> to <base>', example: '/base 255 to binary',
        run: (a) => W.baseHandle(a),
    });
    register({
        name: 'code', aliases: ['coding', 'c'], summary: 'Analyse C source code',
        usage: '/code <C source, on the next line>', example: '/code int main() { return 0; }',
        run: (a) => W.codingHandle(a),
    });
    register({
        name: 'reasoning', summary: 'Letter/word counts, comparisons, money and sharing word problems',
        usage: '/reasoning <question>', example: '/reasoning how many r in strawberry',
        run: (a) => W.rsnHandle(a),
    });
    register({
        name: 'assist', summary: 'Pick from options, count, simple choices ("again" repeats)',
        usage: '/assist <options>', example: '/assist bat or ball',
        run: (a) => W.assistHandle(a),
    });
    register({
        name: 'paragraph', aliases: ['para'], summary: 'Paragraphs, essays and notes on known topics',
        usage: '/paragraph <topic or request>', example: '/paragraph write a paragraph on climate change',
        run: (a) => (W.paraDetectFollowUp(a) ? W.paraFollowUpHandle(a) : W.paraHandle(a)),
    });
    register({
        name: 'write', aliases: ['email', 'letter', 'application', 'mail', 'writing'],
        summary: 'Applications, emails and letters',
        usage: '/write <what to write, and to whom>', example: '/write application to principal for sick leave',
        raw: false,
        run: (a, p) => W.writingHandle((p.name === 'write' || p.name === 'writing') ? a : (p.name + ' ' + a)),
    });

    // Shapes: /triangle3(a):4(b):5(c)  /square5  /box6:4  /circle5
    ['triangle', 'square', 'box', 'circle'].forEach(function (n) {
        register({
            name: n, aliases: n === 'box' ? ['rectangle'] : [], glue: true, raw: true,
            summary: { triangle: 'Triangle from three sides', square: 'Square from one side',
                       box: 'Rectangle from width and height', circle: 'Circle from a radius' }[n],
            usage: { triangle: '/triangle3(a):4(b):5(c)', square: '/square5',
                     box: '/box6:4', circle: '/circle5' }[n],
            example: { triangle: '/triangle3(a):4(b):5(c)', square: '/square5',
                       box: '/box6:4', circle: '/circle5' }[n],
            run: (raw) => W.computeShapeResponse(raw),
        });
    });

    register({
        name: 'table', glue: true, summary: 'Blank table with R rows and C columns',
        usage: '/table3:4', example: '/table3:4',
        run: function (a) {
            const m = a.match(/^(\d+)\s*:\s*(\d+)$/);
            if (!m) return null;
            const MAX = 12;
            const rows = Math.min(Math.max(parseInt(m[1], 10), 1), MAX);
            const cols = Math.min(Math.max(parseInt(m[2], 10), 1), MAX);
            let h = '<thead><tr>';
            for (let c = 1; c <= cols; c++) h += '<th>Header ' + c + '</th>';
            h += '</tr></thead><tbody>';
            for (let r = 1; r <= rows; r++) {
                h += '<tr>';
                for (let c = 1; c <= cols; c++) h += '<td>Row ' + r + ', Col ' + c + '</td>';
                h += '</tr>';
            }
            h += '</tbody>';
            return { __html: true, text: '<div class="xetex-table-wrap"><table class="xetex-table">' + h + '</table></div>' };
        },
    });

    register({
        name: 'tools', noArg: true, summary: 'List every tool',
        usage: '/tools', example: '',
        run: () => guideText(false),
    });
})();
