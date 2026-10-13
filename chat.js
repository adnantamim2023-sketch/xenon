/* ---------------- CHAT LOGIC ---------------- */

let sessions = JSON.parse(localStorage.getItem('xenon_sessions')) || [];
let currentIdx = -1;
let shouldAutoScroll = true;

// Set currentIdx AFTER sessions is loaded
(function initCurrentIdx() {
    const saved = parseInt(localStorage.getItem('xenon_currentIdx'));
    if (!isNaN(saved) && saved >= 0 && saved < sessions.length) {
        currentIdx = saved;
    } else if (sessions.length > 0) {
        currentIdx = 0;
    } else {
        currentIdx = -1;
    }
})();

// ── Check if user is at the very bottom ──
function isAtBottom() {
    const feed = document.getElementById('chatFeed');
    const threshold = 10;
    return feed.scrollHeight - feed.scrollTop - feed.clientHeight < threshold;
}

// ── Auto-scroll to bottom only if user hasn't interfered ──
function autoScrollToBottom() {
    if (!shouldAutoScroll) return;
    
    const feed = document.getElementById('chatFeed');
    feed.scrollTop = feed.scrollHeight;
    _chaseBottom();
}

// ── Force scroll to bottom (when sending message) ──
function forceScrollToBottom() {
    const feed = document.getElementById('chatFeed');
    shouldAutoScroll = true;
    feed.scrollTop = feed.scrollHeight;
    _chaseBottom();
}

// ── Keep re-asserting the true bottom for a short window ──
// The feed's own bottom padding reserves space for the input bar and is
// CSS-transitioned (0.25s) — and the input bar's rendered height itself
// is measured via a ResizeObserver callback that fires asynchronously,
// a moment after the DOM change that caused it (e.g. clearing the
// textarea on send). So a single `scrollTop = scrollHeight` right after
// sending/receiving a message can land against a stale, not-yet-settled
// height and get stuck just short of the real bottom. This keeps
// re-pinning to the true (current) bottom every frame for a short window
// so it tracks the padding as it finishes settling, instead of freezing
// on whatever it happened to be on the first frame. Stops immediately if
// the user scrolls away (shouldAutoScroll flips false).
let _chaseBottomUntil = 0;
let _chasingBottom = false;
function _chaseBottom(durationMs = 320) {
    _chaseBottomUntil = performance.now() + durationMs;
    if (typeof _fingerWake === 'function') _fingerWake(durationMs); // bar height settles around sends/receives too
    if (_chasingBottom) return;
    _chasingBottom = true;
    const feed = document.getElementById('chatFeed');
    function step() {
        if (!feed || !shouldAutoScroll || performance.now() > _chaseBottomUntil) {
            _chasingBottom = false;
            return;
        }
        if (!window._chatFeedPulling) feed.scrollTop = feed.scrollHeight;
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ── Smooth scroll to bottom (when sending a message / explicit "go to end") ──
function smoothScrollToBottom() {
    const feed = document.getElementById('chatFeed');
    shouldAutoScroll = true;
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
    _chaseBottom();
}

// ── Anchor the just-sent user message under the nav bar ───────────────
// Sending a message used to call forceScrollToBottom(), which pins
// whatever is *bottom-most* in the feed to the feed's bottom edge — in
// practice that meant the AI reply's bottom, since shouldAutoScroll
// stayed true and every autoScrollToBottom() call during the typing
// indicator + word-reveal kept re-chasing the true bottom as the reply
// grew.
//
// Instead, this pins the TOP of the latest user message to a fixed gap
// under the nav bar (ChatGPT-style) and then leaves the scroll position
// alone while the reply streams in underneath it. shouldAutoScroll is
// switched off here so none of the bottom-chasing helpers
// (_chaseBottom, _fingerTick's "glued to bottom" branch,
// autoScrollToBottom) drag the view back down as the response grows —
// they all no-op while shouldAutoScroll is false and simply preserve
// this scrollTop (aside from _fingerTick's small relative nudges for
// input-bar height changes, which is what we want).
//
// Relies on .chat-feed's large bottom padding (see styles.css) to make
// sure there's always enough scrollable room below the latest user
// message to actually push it up to this position, even when the AI's
// reply ends up short.
const USER_MSG_NAV_GAP = 20; // px between the nav bar's bottom edge and the message

function anchorUserMessageNearTop(container) {
    const feed = document.getElementById('chatFeed');
    const nav = document.querySelector('.nav-container');
    if (!feed || !nav || !container) return;

    shouldAutoScroll = false;

    const targetTop = nav.getBoundingClientRect().bottom + USER_MSG_NAV_GAP;
    const currentTop = container.getBoundingClientRect().top;
    const delta = currentTop - targetTop;

    const maxScroll = Math.max(0, feed.scrollHeight - feed.clientHeight);
    feed.scrollTop = Math.min(Math.max(0, feed.scrollTop + delta), maxScroll);

    // Bar height (textarea clearing back to one line, etc.) still settles
    // asynchronously right after this — wake the finger tracker so its
    // relative-nudge branch (taken since shouldAutoScroll is now false)
    // keeps this position correct as that settles, instead of drifting.
    if (typeof _fingerWake === 'function') _fingerWake(320);
}

// ── Bot-reply-aware bottom padding ──────────────────────────────────────
// The feed's bottom padding exists purely to give anchorUserMessageNearTop
// somewhere to scroll into: right when a message is sent, the incoming
// reply doesn't exist yet, so without artificial scroll room below the
// user's message there'd be no way to pin it 20px under the nav bar. A
// blanket 70vh of padding covers that worst case (a one-line reply), but
// left in place afterward it causes two problems: a long reply that
// already fills most of the screen gets another 70vh of dead space
// tacked on past it, and a short reply leaves a huge blank gray/white
// gap the user can freely scroll down into.
//
// So the padding is dynamic: pumped back up to the full anchor amount
// right before a message is sent (restoreAnchorPadding), then settled
// down to whatever the actual final reply needs once it's done
// rendering (settleFeedBottomPadding) — ~20% of the visible feed height
// if the reply is big enough to mostly fill the screen on its own, or a
// small fixed margin otherwise, with the scroll position pulled back in
// if it's currently sitting past the new, shorter bottom.
const FEED_ANCHOR_PADDING_VH = 70;       // room needed for the pin-to-top scroll on send
const FEED_BIG_REPLY_PADDING_PCT = 0.20; // tail room after a reply that already fills the screen
const FEED_SMALL_REPLY_PADDING_PX = 20;  // small fixed margin for short replies — not a fraction of the screen
const FEED_BIG_REPLY_THRESHOLD = 0.7;    // reply height / feed height, at/above which it counts as "big"

function restoreAnchorPadding() {
    document.documentElement.style.setProperty('--chat-feed-bottom-pad', FEED_ANCHOR_PADDING_VH + 'vh');
}

function settleFeedBottomPadding() {
    const feed = document.getElementById('chatFeed');
    if (!feed) return;

    // Measuring the last message's height immediately after a full
    // renderChat() rebuild (page reload / session switch) can catch the
    // DOM before layout has actually settled — fonts, injected graph
    // canvases, etc. — which was producing a 0 or understated msgHeight
    // and, via the isBig branch below, an understated (sometimes ~0)
    // padPx. Deferring one frame lets layout finish first so this reads
    // real numbers.
    requestAnimationFrame(() => _settleFeedBottomPaddingNow(feed));
}

// Minimum gap the last AI message's action row should keep above the
// input bar, no matter what the isBig/small calculation above lands on.
// Without this floor, a msgHeight misread (0 or too small right after a
// fresh renderChat()) could drive padPx down to 0 and pin the message
// actions flush against the input bar on reload.
const FEED_MIN_BOTTOM_PADDING_PX = 20;

function _settleFeedBottomPaddingNow(feed) {
    const viewportH = feed.clientHeight || window.innerHeight;
    const lastContainer = feed.lastElementChild;
    const lastMsg = lastContainer ? lastContainer.querySelector('.message.ai') : null;
    const msgHeight = lastMsg ? lastMsg.getBoundingClientRect().height : 0;

    const isBig = msgHeight >= viewportH * FEED_BIG_REPLY_THRESHOLD;
    let padPx = isBig
        ? (viewportH * FEED_BIG_REPLY_PADDING_PCT)
        : FEED_SMALL_REPLY_PADDING_PX;

    // If a message is currently pinned near the top (anchorUserMessageNearTop
    // switched shouldAutoScroll off), scrollTop is sitting far down the
    // (still-large) padding to hold that pin in place. Shrinking padding
    // below what that pin needs would shrink scrollHeight out from under
    // it, and the browser would force scrollTop back down to the new max —
    // snapping the whole view down and breaking the pin. So while pinned,
    // never shrink past whatever the current scroll position requires.
    if (!shouldAutoScroll) {
        const currentPadPx = parseFloat(getComputedStyle(feed).paddingBottom) || 0;
        const contentHeightNoPad = feed.scrollHeight - currentPadPx;
        const totalNeeded = (feed.scrollTop + feed.clientHeight) - contentHeightNoPad;
        // totalNeeded is the FULL padding-bottom required (it's derived from
        // currentPadPx, which already bakes in --input-bar-height). But the
        // CSS calc() adds --input-bar-height on top of whatever we write to
        // --chat-feed-bottom-pad — so writing totalNeeded directly double-
        // counts the input bar's height as extra dead space below the
        // pinned message. Subtract it back out first.
        const inputBarPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--input-bar-height')) || 50;
        const neededForPin = totalNeeded - inputBarPx;

        // neededForPin is a FLOOR, not a replacement for padPx: it's only
        // the room required to keep the current pin from snapping down,
        // not what the reply actually deserves as tail space. Overwriting
        // padPx with it outright (as this used to do) meant a big reply
        // lost its 20%-of-viewport tail whenever the pin math happened to
        // need less than that — take the max instead so a big reply still
        // gets its full tail, while a pin that needs more than padPx still
        // gets that instead of being shrunk out from under it.
        padPx = Math.max(padPx, neededForPin);
    }

    document.documentElement.style.setProperty('--chat-feed-bottom-pad', Math.max(FEED_MIN_BOTTOM_PADDING_PX, padPx) + 'px');

    // Padding shrinking can leave scrollTop past the new max — pull it
    // back so there's no leftover blank gap below the real content.
    requestAnimationFrame(() => {
        const maxScroll = Math.max(0, feed.scrollHeight - feed.clientHeight);
        if (feed.scrollTop > maxScroll) feed.scrollTop = maxScroll;
        if (typeof _fingerWake === 'function') _fingerWake(320);
    });
}

// ── Input bar's height = a finger on the chat feed ─────────────────────
// The input bar's rendered HEIGHT is tracked like a fingertip touching
// the feed. Every animation frame (while awake — see below), we read
// how tall the bar actually is on screen right now and compare it to
// its height last frame. If it changed, the feed scrolls by that exact
// same number of pixels — nothing computed from keyboard height or any
// other stand-in value, just "the bar grew/shrank N px, so the feed
// moves N px." Works identically no matter where the user currently
// has the feed scrolled to (top, bottom, middle).
//
// Deliberately height, not top: .input-bar's top edge also moves
// whenever the keyboard opens/closes, because .input-container is
// bottom-anchored to var(--keyboard-height) (see styles.css) and slides
// the whole bar up/down as a pure position change, with no height
// change at all. Tracking top used to treat that keyboard-driven slide
// exactly like a real height change and nudge the feed by the full
// keyboard inset — which is what was dragging the just-sent user
// message away from its pinned 20px-under-the-nav-bar spot toward the
// middle of the screen. Tracking height instead only reacts to the bar
// actually growing/shrinking (textarea auto-expanding, clearing back to
// one line, etc.) and stays inert while the keyboard purely repositions
// the bar without resizing it.
//
// Idle-aware: this used to be an infinite requestAnimationFrame loop
// running 60x/second forever, forcing a layout read every single frame
// even when the input bar was sitting perfectly still (e.g. just
// reading the conversation with the keyboard down) — pure wasted CPU
// and battery/heat cost. It now sleeps by default and only runs for a
// short window around events that can actually resize the bar: the
// textarea's own expand/shrink animation, sending or receiving a
// message, and orientation/safe-area changes. Anything that calls
// _fingerWake() re-arms that window; the loop stops itself the instant
// nothing has woken it for a bit. (Keyboard show/hide still calls
// _fingerWake() too — harmless, since with height-tracking a pure
// keyboard move simply won't register as a change.)
let _fingerLastHeight = null;
let _fingerRunning = false;
let _fingerActiveUntil = 0;

function _fingerTick(now) {
    const feed = document.getElementById('chatFeed');
    // Measures .input-container (input bar + the toggle menu tiles below
    // it) rather than .input-bar alone, so opening/closing the toggle menu
    // — which grows/shrinks the input area from below — moves the feed by
    // the same amount, exactly like the textarea expanding does. Bottom
    // padding and the keyboard offset are constant/position-only, so they
    // never register as a height change.
    const bar = document.querySelector('.input-container');
    if (feed && bar) {
        const height = bar.getBoundingClientRect().height;
        // Skip while a pull-to-stretch drag owns the feed's position — this
        // used to overwrite scrollTop mid-pull (e.g. right after a
        // send/receive wakes this loop), shifting the top/bottom edge test
        // under the user's finger and making the stretch flicker on/off.
        if (_fingerLastHeight !== null && !window._chatFeedPulling) {
            const moved = height - _fingerLastHeight; // + when the bar grew taller (its top edge effectively moved up)
            if (moved) {
                if (shouldAutoScroll) {
                    // Already following the conversation (pinned to the
                    // bottom) — stay glued to the true bottom rather than
                    // doing a relative nudge. Otherwise a bar shrink right
                    // after sending a message (textarea clearing back to
                    // one line) would drag the feed backward at the exact
                    // moment it should be revealing the new reply.
                    feed.scrollTop = feed.scrollHeight;
                } else {
                    const maxScroll = Math.max(0, feed.scrollHeight - feed.clientHeight);
                    feed.scrollTop = Math.min(Math.max(0, feed.scrollTop + moved), maxScroll);
                }
            }
        }
        _fingerLastHeight = height;
    }

    if (now < _fingerActiveUntil) {
        requestAnimationFrame(_fingerTick);
    } else {
        // Go to sleep — no more layout reads until something wakes us.
        _fingerRunning = false;
        // Drop the baseline so the next wake doesn't compare against a
        // stale height from however long ago we fell asleep.
        _fingerLastHeight = null;
    }
}

// Call this from anything that might move the input bar's top edge:
// keyboard toggling, the bar's own resize animation, safe-area/
// orientation changes, or a message being sent/received. durationMs
// should comfortably cover however long that particular movement can
// take (e.g. a CSS transition's length, or an animation's duration).
function _fingerWake(durationMs = 400) {
    _fingerActiveUntil = Math.max(_fingerActiveUntil, performance.now() + durationMs);
    if (!_fingerRunning) {
        _fingerRunning = true;
        requestAnimationFrame(_fingerTick);
    }
}

// Like _fingerWake, but ALSO snapshots the input area's current height
// as the baseline right now. Call it synchronously BEFORE making a change
// you know will resize the input area (e.g. opening/closing the toggle
// menu), so the tracker measures that change from its true starting
// height instead of from wherever the first animation frame left it —
// otherwise the fast first frames of an ease-out reveal go unmeasured
// and the feed under-shifts.
function _fingerPrime(durationMs = 450) {
    const area = document.querySelector('.input-container');
    if (area) _fingerLastHeight = area.getBoundingClientRect().height;
    _fingerWake(durationMs);
}

function initInputBarFinger() {
    _fingerWake(300); // establish an initial baseline position on load
}

// ── Inject inline graph into message ──
function injectInlineGraph(textNode, graphHTML) {
    const msgContainer = textNode.closest('.message');
    if (!msgContainer) return;

    const graphDiv = document.createElement('div');
    graphDiv.innerHTML = graphHTML;

    const canvasMatch = graphHTML.match(/id="(ig_[^"]+)"/);
    const canvasId = canvasMatch ? canvasMatch[1] : null;

    const scripts = graphDiv.querySelectorAll('script');

    scripts.forEach(s => s.remove());
    const wrap = graphDiv.firstElementChild || graphDiv;
    msgContainer.appendChild(wrap);

    scripts.forEach(s => {
        // Remove any stale script left over from a previous render of this
        // same canvas id before appending the new one. Without this, every
        // call to injectInlineGraph (which happens on every renderChat(),
        // i.e. every message send, session switch, etc.) leaves the old
        // <script data-graph-id> orphaned in document.body forever. These
        // accumulated without bound over a session and were freezing the UI.
        if (canvasId) {
            const stale = document.querySelector(`script[data-graph-id="${canvasId}"]`);
            if (stale) stale.remove();
        }
        const newScript = document.createElement('script');
        newScript.textContent = s.textContent;
        if (canvasId) newScript.setAttribute('data-graph-id', canvasId);
        document.body.appendChild(newScript);
    });
}

// Inline graphs render exactly once, at message-creation time, and are
// intentionally never redrawn (see toggleDarkMode) — there used to be a
// redrawInlineGraphs() function called on every theme toggle that re-ran
// each graph's drawing script via eval(); that re-render was the source of
// the zoom-drift/crash bug, so it has been removed rather than patched.

// ── Stub interaction handlers ──
function likeMsg(i) {
    const msgs = sessions[currentIdx]?.messages;
    if (!msgs || !msgs[i]) return;
    const allMsgs = document.querySelectorAll('.message.ai');
    // Find the correct message element
    let msgEl = null;
    document.querySelectorAll('.message-container').forEach((c, idx) => {
        if (idx === i) msgEl = c.querySelector('.message.ai');
    });
    if (!msgEl) return;
    const btn = msgEl.querySelector('.icon-like');
    if (!btn) return;
    btn.style.color = '#22c55e';
    btn.style.opacity = '1';
    setTimeout(() => { btn.style.color = ''; btn.style.opacity = ''; }, 1500);
}

function dislikeMsg(i) {
    const msgEl = document.querySelectorAll('.message-container')[i]?.querySelector('.message.ai');
    if (!msgEl) return;
    const btn = msgEl.querySelector('.icon-dislike');
    if (!btn) return;
    btn.style.color = '#ef4444';
    btn.style.opacity = '1';
    setTimeout(() => { btn.style.color = ''; btn.style.opacity = ''; }, 1500);
}

// ── Render plain-text response as clean HTML ──
// Handles all Xenon response formats:
//   1. Math step blocks:    Title\n────\n\n1.  step
//   2. Word problem blocks: ━━━━\n🧩 Title\n━━━━\n\nstep\n   → detail
//   3. "  X"
//   4. Plain multi-line text with - bullets, → arrows, indentation
function renderResponseHTML(text) {
    if (!text) return '';

    // Math step block: "Title\n─────\n\n1.  step ..."
    const mathBlockMatch = text.match(/^(.+)\n[─]{4,}\n+([\s\S]+)$/);
    if (mathBlockMatch) {
        return buildStepBlock(mathBlockMatch[1].trim(), mathBlockMatch[2]);
    }

    // Word problem block: "━━━━\n🧩 Title\n━━━━\n\n..."
    const wpBlockMatch = text.match(/^[━]{4,}\n(.+)\n[━]{4,}\n+([\s\S]+?)\n*[━]*\s*$/);
    if (wpBlockMatch) {
        const title = wpBlockMatch[1].replace(/^🧩\s*/, '').trim();
        return buildStepBlock(title, wpBlockMatch[2]);
    }

    // "  X"
    const resultMatch = text.match(/^ \s*(.+)$/i);
    if (resultMatch) {
        return `<p class="resp-result-line"><span class="resp-plain">The result is</span><span class="resp-answer">${escapeHTML(resultMatch[1].trim())}</span></p>`;
    }

    // Plain multi-line: parse line types
    return renderPlainLines(text);
}

function buildStepBlock(title, body) {
    const lines = body.split('\n');
    let html = `<div class="resp-block">`;
    html += `<div class="resp-title">${escapeHTML(title)}</div>`;
    html += `<div class="resp-divider"></div>`;
    html += `<div class="resp-steps">`;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || /^[─━]{4,}$/.test(trimmed)) { i++; continue; }

        // Numbered step: "1.  text"
        const numMatch = trimmed.match(/^(\d+)\.\s{1,4}(.+)$/);
        if (numMatch) {
            let subHTML = '';
            i++;
            while (i < lines.length) {
                const next = lines[i];
                const nextT = next.trim();
                if (!nextT) { i++; break; }
                if (/^\d+\.\s/.test(nextT) || /^[─━]{4,}$/.test(nextT)) break;
                if (/^→/.test(nextT) || /^\s{2,}→/.test(next)) {
                    subHTML += `<div class="resp-sub-line"><span class="resp-arrow">→</span><span>${escapeHTML(nextT.replace(/^→\s*/, ''))}</span></div>`;
                } else if (/^\s{3,}/.test(next) && nextT) {
                    subHTML += `<div class="resp-indent">${escapeHTML(nextT)}</div>`;
                } else { break; }
                i++;
            }
            html += `<div class="resp-step">
                <span class="resp-step-num">${numMatch[1]}</span>
                <div class="resp-step-body">
                    <span class="resp-step-text">${inlineFormat(numMatch[2])}</span>
                    ${subHTML}
                </div>
            </div>`;
            continue;
        }

        // Arrow line outside step
        if (/^→/.test(trimmed)) {
            html += `<div class="resp-sub-line standalone"><span class="resp-arrow">→</span><span>${inlineFormat(trimmed.replace(/^→\s*/, ''))}</span></div>`;
            i++; continue;
        }

        html += `<div class="resp-note">${inlineFormat(trimmed)}</div>`;
        i++;
    }

    html += `</div></div>`;
    return html;
}

function renderPlainLines(text) {
    const lines = text.split('\n');
    let html = '';
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { html += '<div class="resp-spacer"></div>'; continue; }
        if (/^[-•]\s+/.test(trimmed)) {
            html += `<div class="resp-bullet"><span class="resp-bullet-dot">•</span><span>${inlineFormat(trimmed.replace(/^[-•]\s+/, ''))}</span></div>`;
        } else if (/^→/.test(trimmed)) {
            html += `<div class="resp-sub-line"><span class="resp-arrow">→</span><span>${inlineFormat(trimmed.replace(/^→\s*/, ''))}</span></div>`;
        } else if (/^[\t]|^\s{3,}/.test(line)) {
            html += `<div class="resp-indent">${inlineFormat(trimmed)}</div>`;
        } else {
            html += `<div class="resp-line">${inlineFormat(trimmed)}</div>`;
        }
    }
    return html || escapeHTML(text);
}

function inlineFormat(str) {
    let out = escapeHTML(str);
    out = out
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="resp-code">$1</code>');
    return out;
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.onload = () => {
    const savedDarkMode = localStorage.getItem('xenon_darkmode');
    const isDarkOnLoad = savedDarkMode === 'true';
    if (isDarkOnLoad) {
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
    }
    updateThemeIcon();
    if (window.AndroidBridge) {
        window.AndroidBridge.setDarkMode(isDarkOnLoad);
    }
    if (typeof syncSystemChrome === 'function') syncSystemChrome();

    // Ensure we have a valid session
    if (sessions.length === 0) {
        // True first-ever launch is gated on a persistent flag, not just
        // an empty session list — clearing all history later also leaves
        // sessions empty, but should get the normal greeting, not the
        // onboarding guide again.
        const hasOnboarded = localStorage.getItem('xenon_has_onboarded') === 'true';
        if (!hasOnboarded) {
            createNewSession("New Chat", { onboarding: true });
            localStorage.setItem('xenon_has_onboarded', 'true');
        } else {
            createNewSession("New Chat");
        }
    } else if (currentIdx < 0 || currentIdx >= sessions.length) {
        currentIdx = 0;
    }

    renderAll();
    updateGraph();
    updateThemeIcon();

    setTimeout(() => {
        tgraphInit();
        const vp = document.getElementById('tgraphViewport');
        if (vp) {
            vp.addEventListener('mousedown', tgraphStart);
            vp.addEventListener('touchstart', tgraphStart, { passive: false });
        }
    }, 100);

    const feed = document.getElementById('chatFeed');

    initInputBarFinger();

    feed.addEventListener('wheel', () => {
        shouldAutoScroll = false;
    }, { passive: true });

    feed.addEventListener('scroll', () => {
        if (!isAtBottom()) {
            shouldAutoScroll = false;
        }
    }, { passive: true });

    feed.addEventListener('scroll', () => {
        if (isAtBottom()) {
            shouldAutoScroll = true;
        }
    }, { passive: true });
};

window.addEventListener('mousemove', tgraphMove);
window.addEventListener('mouseup', tgraphStop);
window.addEventListener('touchmove', tgraphMove, { passive: false });
window.addEventListener('touchend', tgraphStop);

document.getElementById('userInput')?.addEventListener('focus', function() {
    document.getElementById('menuWrapper').classList.remove('active');
});

function renderAll() { renderChat(); renderHistory(); }

function createNewSession(title, opts) {
    // Every new chat opens with the same short tool list, generated from
    // the tool registry. No persona, no randomised greetings.
    const guide = "Hi, I'm Xenon. Ask me anything in plain English — I'll chat, or automatically solve math, physics, logic, code and word problems, or write essays, emails and letters. Send /tools to see every tool by name.";
    const newSession = { title: title, messages: [{ role: 'ai', text: guide, time: now() }] };
    sessions.unshift(newSession); currentIdx = 0; saveData();
}

function now() { return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

function saveData() {
    localStorage.setItem('xenon_sessions', JSON.stringify(sessions));
    if (currentIdx >= 0 && currentIdx < sessions.length) {
        localStorage.setItem('xenon_currentIdx', currentIdx);
    }
}

function renderHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = sessions.length === 0 ? '<p style="color:var(--text-muted)">No history yet.</p>' : '';
    sessions.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = `history-item ${i === currentIdx ? 'active' : ''}`;
        item.innerHTML = `<span>${s.title}</span><span class="icon icon-trash" style="width:16px;height:16px; cursor:pointer;" onclick="deleteSession(event, ${i})"></span>`;
        item.onclick = (e) => { if (!e.target.closest('.icon-trash')) { currentIdx = i; renderAll(); closeAll(); saveData(); } };
        list.appendChild(item);
    });
}

function deleteSession(e, i) {
    e.stopPropagation();
    showConfirm("Delete this conversation?", "This action cannot be undone.", () => {
        sessions.splice(i, 1);
        if (currentIdx >= sessions.length) currentIdx = sessions.length - 1;
        if (sessions.length === 0) createNewSession("New Chat");
        saveData(); renderAll();
    });
}

function renderChat() {
    const feed = document.getElementById('chatFeed');
    feed.innerHTML = '';
    // feed.innerHTML = '' destroys every canvas that was on screen, but the
    // matching <script data-graph-id> tags injected for them live in
    // document.body and are NOT touched by that — clear them here so they
    // don't accumulate unbounded across renders (message sends, session
    // switches, theme toggles, etc.).
    document.querySelectorAll('script[data-graph-id]').forEach(s => s.remove());
    if (currentIdx === -1 || !sessions[currentIdx]) return;

    sessions[currentIdx].messages.forEach((msg, i) => {
        appendMsgToUI(msg, i);
    });

    // Settle the bottom padding to its final size FIRST, then scroll to
    // bottom. Doing it in the other order (scroll first, settle padding
    // after) let settleFeedBottomPadding's own requestAnimationFrame
    // change feed.scrollHeight (padding shrinking/growing) after
    // forceScrollToBottom had already computed and applied scrollTop
    // against the old scrollHeight — landing short of the true bottom on
    // reload/session-switch, since _chaseBottom's re-pin window can close
    // before this padding settle even runs. Settling first means
    // scrollHeight is stable by the time we actually scroll.
    settleFeedBottomPadding();
    shouldAutoScroll = true;
    requestAnimationFrame(() => requestAnimationFrame(forceScrollToBottom));
}

function appendMsgToUI(msg, i) {
    const feed = document.getElementById('chatFeed');
    const isAi = msg.role === 'ai';

    const rawText = msg.text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
// With:
let displayText;
if (isAi && msg.__html) {
    displayText = msg.text;
} else if (isAi) {
    displayText = renderResponseHTML(rawText);
} else {
    displayText = escapeHTML(rawText).replace(/\n/g, '<br>');
}



    const html = `
        <div class="message-container" data-msg-index="${i}">
            <div class="message ${msg.role}">
                <span class="text-node">${displayText}</span>
                <span class="message-time">${msg.time}</span>
            </div>
        </div>`;
    feed.insertAdjacentHTML('beforeend', html);

    const msgEl = feed.lastElementChild.querySelector('.message');
    const textNode = msgEl ? msgEl.querySelector('.text-node') : null;

    if (msg._hasGraph && msg._graphHTML) {
        injectInlineGraph(textNode, msg._graphHTML);
    }

    if (isAi && msgEl) {
        const actionsHTML = `<div class="ai-actions">
    <span class="icon icon-copy" onclick="copyMsg(this, ${i})"></span>
    <span class="icon icon-like" onclick="likeMsg(${i})"></span>
    <span class="icon icon-dislike" onclick="dislikeMsg(${i})"></span>
</div>`;
        msgEl.insertAdjacentHTML('beforeend', actionsHTML);
    }

    return textNode;
}

let isCreatingChat = false;

function startNewChat() {
    if (window.Xenon && Xenon.Converse && Xenon.Converse.reset) Xenon.Converse.reset();  // fresh dialogue state for a fresh chat (long-term memory is kept)
    document.getElementById('menuWrapper').classList.remove('active');

    if (isCreatingChat) return;

    if (sessions.length > 0 && sessions[currentIdx] && sessions[currentIdx].messages.length <= 1 && sessions[currentIdx].title === "New Chat") {
        closeAll();
        return;
    }

    isCreatingChat = true;

    createNewSession("New Chat");
    renderAll();
    closeAll();

    setTimeout(() => { isCreatingChat = false; }, 300);
}

