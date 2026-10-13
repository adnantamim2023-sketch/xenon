/* Run:  node converse-test.js     (add TOOLS=1 to load the tool modules too, as the browser does) */
const fs = require('fs'), vm = require('vm'), path = require('path');
const mem = {}; globalThis.localStorage = { getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
if (process.env.TOOLS === '1') {
  globalThis.window = globalThis;
  globalThis.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {}, appendChild() {} }), body: { appendChild() {} }, documentElement: {} };
  ['tools', 'math-basic', 'math-algebra', 'math-physics', 'math-integration', 'logic', 'coding', 'base', 'writing', 'assist', 'reasoning', 'topics-hsc', 'humanize', 'paragraph', 'shapes']
    .forEach(f => { try { vm.runInThisContext(fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')); } catch (e) { /* optional */ } });
}
['xenon', 'converse-data', 'converse'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')));
const B = Xenon.Brain, C = Xenon.Converse;
let pass = 0, fail = 0;
function convo(name, steps) {
  C.reset(); mem['xenon_converse_v1'] = null; C.memory.facts.length = 0;
  for (const [say, re] of steps) {
    const r = B.respond(say).text;
    if (re.test(r)) pass++; else { fail++; console.log('FAIL [' + name + '] "' + say + '"\n   expected ' + re + '\n   got      ' + r.slice(0, 160)); }
  }
}
convo('pet + pronoun + name', [['i have a golden retriever', /golden retriever.*name/i], ['her name is Luna', /Luna/], ['what is she like', /Luna/]]);
convo('emotion + people', [['my boss dumped a ton of work on me', /boss.*work|stretched|too much|on your plate/i], ['i feel so lonely', /lonel|company|alone/i]]);
convo('ellipsis (kb)', [['what is gravity', /gravity/i], ['what about the sun', /sun is a star/i]]);
convo('ellipsis (number)', [['what is 15% of 200', /= 30/], ['what about 300', /= 45/]]);
convo('open question answered', [['i love pizza', /pizza/i], ['yes', /./]]);
convo('opinion is not a topic dump', [['honestly i think cats are better than dogs', /take|what makes you say|interesting/i]]);
convo('gibberish', [['asdfgh', /catch|rephras|didn't get/i]]);
convo('persona', [['do you ever get lonely', /AI|lonely|here/i], ['what is your favorite planet', /Saturn/]]);
convo('learning from correction', [['capital of france', /Paris/], ['that is wrong', /right answer|correct answer/i], ['Paris is the capital of France, and also the city of light', /learned/i]]);
convo('thanks + bye', [['thanks, bye', /welcome|take care|see you/i]]);
convo('safety still first', [['i want to die', /988|emergency|not alone|sorry/i]]);
convo('why after a fact', [['what is a black hole', /black hole/i], ['why', /short|summary|paragraph|curious/i]]);
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
