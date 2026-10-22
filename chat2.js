// Send button <-> Stop button.
// Tools answer synchronously, so there is no pending/"thinking" phase to
// cancel. The send button flips to a stop button while a reply is being
// revealed word by word; tapping it finishes that reveal instantly.
let activeRevealSkip = null;   // set while a reply's word-reveal is animating

// Morphs the send-btn glyph between icon-send/icon-stop: the current
// glyph spins/shrinks away and the new one spins back in (see
// .icon-morphing + @keyframes sendIconMorph in styles.css), with the
// actual class swap landing right at the animation's invisible
// midpoint so only the morph is ever visible, never a hard cut.
function morphSendIcon(icon, fromClass, toClass) {
    icon.classList.remove('icon-morphing');
    void icon.offsetWidth; // restart the animation if it's mid-flight
    icon.classList.add('icon-morphing');
    setTimeout(() => {
        icon.classList.remove(fromClass);
        icon.classList.add(toClass);
    }, 135);
    setTimeout(() => icon.classList.remove('icon-morphing'), 300);
}

function setSendButtonToStop() {
    const wrap = document.getElementById('sendBtnWrap');
    const icon = wrap ? wrap.querySelector('.send-btn') : null;
    if (!wrap || !icon) return;
    wrap.classList.add('stop-mode');
    morphSendIcon(icon, 'icon-send', 'icon-stop');
    wrap.onclick = stopGeneration;
}

function restoreSendButton() {
    const wrap = document.getElementById('sendBtnWrap');
    const icon = wrap ? wrap.querySelector('.send-btn') : null;
    if (!wrap || !icon) return;
    wrap.classList.remove('stop-mode');
    morphSendIcon(icon, 'icon-stop', 'icon-send');
    wrap.onclick = sendMessage;
}

function stopGeneration() {
    let stopped = false;
    if (activeRevealSkip) {
        activeRevealSkip();
        activeRevealSkip = null;
        stopped = true;
    }
    restoreSendButton();
    if (stopped) appendStoppedNotice();
}

// Small centered note dropped into the feed so the user has confirmation
// that hitting stop actually did something, rather than the button just
// silently reverting.
function appendStoppedNotice() {
    const feed = document.getElementById('chatFeed');
    if (!feed) return;
    feed.insertAdjacentHTML('beforeend', `<div class="message-container"><div class="stopped-notice">Response stopped</div></div>`);
    autoScrollToBottom();
}




function isKeyboardOpen() {
    if (!window.visualViewport) return false;
    var inset = Math.max(0,
        window.innerHeight
        - window.visualViewport.height
        - (window.visualViewport.offsetTop || 0)
    );
    return inset > 100;
}


async function sendMessage() {
    const area = document.getElementById('userInput');
    const text = area.value.trim();
    if (!text) return;

    const keyboardWasOpen = isKeyboardOpen();

    if (text === '/refresh') {
        area.value = '';
        area.style.height = 'auto';
        saveData();
        location.reload();
        return;
    }



    if (!sessions[currentIdx]) {
        createNewSession("New Chat");
        renderAll();
    }

    if (sessions[currentIdx].title === "New Chat" || sessions[currentIdx].title === "New Conversation") {
        sessions[currentIdx].title = text.length > 20 ? text.substring(0, 20) + "..." : text;
        renderHistory();
    }

    const userMsg = { role: 'user', text: text, time: now() };
    sessions[currentIdx].messages.push(userMsg);
    appendMsgToUI(userMsg, sessions[currentIdx].messages.length - 1);

area.value = "";
area.style.height = 'auto';
saveData();

// Blur the textarea if the keyboard wasn't open before send. This
// stops Android WebView from popping the keyboard open after an
// otherwise-completed send (which happens because the paste gesture
// left the empty textarea focused).
if (!keyboardWasOpen && document.activeElement === area) {
    area.blur();
}

// The previous reply may have settled the feed's bottom padding down
// to a small amount (see settleFeedBottomPadding). Pump it back up to
// the full anchor amount before pinning this new message, or there
// may not be enough scroll room to pull it up under the nav bar.
restoreAnchorPadding();

    // Pin the message just sent 20px under the nav bar instead of
    // chasing the bottom of whatever reply arrives beneath it.
    const feedEl = document.getElementById('chatFeed');
    anchorUserMessageNearTop(feedEl ? feedEl.lastElementChild : null);

    setSendButtonToStop();

    runToolAndAppendReply(text);
}

// Runs the tool the message names and returns its result. Pure computation:
// no DOM or session mutation. There is no simulated "thinking" time --
// answers come back instantly either way.
//
// A message starting with /tool_name still goes straight to that exact
// tool, unchanged. Everything else — plain English — goes to Xenon.Brain,
// which is the main conversational AI: it chats on its own, and it also
// recognizes math/physics/logic/code/word-problem/writing/essay questions
// and calls the matching tool itself (see xenon.js), so most messages
// never need the leading slash at all.
function computeToolResponse(text) {
    const isCommand = /^\s*\//.test(text);
    const r = isCommand
        ? Xenon.Tools.run(text)
        : (window.Xenon && Xenon.Brain ? Xenon.Brain.respond(text) : Xenon.Tools.run(text));
    return { responseStr: r.text, responseIsHTML: r.html };
}

function runToolAndAppendReply(text) {
    const { responseStr, responseIsHTML } = computeToolResponse(text);
    speakReply(responseStr, responseIsHTML);

    const aiMsg = {
        role: 'ai',
        text: responseStr,
        time: now(),
        _hasGraph: false,
        _graphHTML: null,
        __html: responseIsHTML
    };
    sessions[currentIdx].messages.push(aiMsg);
    saveData();

    const textNode = appendMsgToUI({role: 'ai', text: '', time: now()}, sessions[currentIdx].messages.length - 1);
    (async () => {
        await wordGenerator(responseStr, textNode, responseIsHTML);
        activeRevealSkip = null;
        restoreSendButton();
        autoScrollToBottom();
    })();
}


async function wordGenerator(fullText, targetElement, isHTML) {
    targetElement.innerHTML = isHTML ? fullText : renderResponseHTML(fullText);
    // Height is already final at this point (all words are in the DOM,
    // just invisible), so scroll now rather than waiting on the animation.
    autoScrollToBottom();
    await animateReveal(targetElement);
    // The reply's real, final height is now on screen — shrink the
    // feed's bottom padding down to what it actually needs instead of
    // leaving the full anchor-sized reserve sitting there as dead space.
    settleFeedBottomPadding();
}

// Reveals an already-rendered response bubble word-by-word instead of it
// just popping in. Works on the final HTML (not raw text) so structured
// blocks — step lists, word-problem headers, tables, graphs — keep their
// real layout the whole time; only the individual words fade/slide in.
//
// While this is running, activeRevealSkip() will jump straight to the
// finished state — used when the user hits the stop button mid-reveal.
function animateReveal(container) {
    const words = [];

    function wrapTextNode(node) {
        const text = node.textContent;
        if (!text.trim()) return; // pure whitespace between elements — leave alone
        const frag = document.createDocumentFragment();
        const parts = text.match(/\S+|\s+/g) || [text];
        parts.forEach(part => {
            if (part.trim() === '') {
                // Whitespace stays as a real text node, sitting between
                // spans rather than baked into one — a trailing space
                // placed inside a display:inline-block span gets trimmed
                // by the browser (edge-of-box collapsing), which is what
                // was silently eating every space between words.
                frag.appendChild(document.createTextNode(part));
                return;
            }
            const span = document.createElement('span');
            span.className = 'reveal-word';
            span.textContent = part;
            words.push(span);
            frag.appendChild(span);
        });
        node.parentNode.replaceChild(frag, node);
    }

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            wrapTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip elements whose contents aren't prose (icons, injected
            // graph canvases/scripts, shape diagrams) so we don't shred
            // their markup. SVG element tagNames come back lowercase
            // (unlike HTML's uppercase), so compare case-insensitively —
            // otherwise this check silently misses <svg> and the walker
            // tries to stuff HTML <span> reveal-word wrappers inside an
            // SVG <text> node, which the SVG renderer just drops.
            const tag = node.tagName ? node.tagName.toLowerCase() : '';
if (tag === 'script' || tag === 'style' || tag === 'canvas' || tag === 'svg' ||
    tag === 'pre'   || tag === 'code'  || tag === 'button' ||
    node.classList && node.classList.contains('code-card-header')) return;
            Array.from(node.childNodes).forEach(walk);
        }
    }

    Array.from(container.childNodes).forEach(walk);

    if (words.length === 0) return Promise.resolve();

    // Pace by total character count rather than word count. Calculation
    // output (equations, step numbers, operators) tends to split into many
    // short tokens — pacing purely by word count made those blocks blow
    // past the "long response" threshold and speed-step down to almost
    // nothing, so the whole thing flashed in nearly instantly. Character
    // length is a much steadier proxy for how much there actually is to
    // read, and a firm minimum keeps even a two-word answer from feeling
    // like it just snapped into place.
    const charLengths = words.map(w => w.textContent.length);
    const totalChars = charLengths.reduce((a, b) => a + b, 0) || words.length;
    const fadeMs = 260; // each word's own fade-in duration
    const totalMs = Math.min(1600, Math.max(450, totalChars * 7));

    let charsSoFar = 0;
    words.forEach((span, idx) => {
        const delay = (charsSoFar / totalChars) * (totalMs - fadeMs);
        span.style.animationDelay = `${delay}ms`;
        charsSoFar += charLengths[idx];
    });

    return new Promise(resolve => {
        const timer = setTimeout(resolve, totalMs);
        activeRevealSkip = () => {
            clearTimeout(timer);
            words.forEach(span => {
                span.style.animation = 'none';
                span.style.opacity = '1';
                span.style.transform = 'none';
            });
            resolve();
        };
    });
}

function toggleMenu() { document.getElementById('menuWrapper').classList.toggle('active'); }

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('show'); }
function toggleAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal.classList.contains('active')) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active');
            modal.classList.remove('closing');
        }, 220);
    } else {
        modal.classList.add('active');
    }
}

// Opens the Select Text modal with a message's text rendered as plain,
// freshly-mounted content — see the comment on #selectTextModal in
// index.html for why this (rather than selecting inside the bubble)
// is what makes the native Copy toolbar appear on the first long-press.
function openSelectTextModal(text) {
    const modal = document.getElementById('selectTextModal');
    const body = document.getElementById('selectTextBody');
    if (!modal || !body) return;
    body.textContent = text;
    modal.classList.remove('closing');
    modal.classList.add('active');
}
function toggleSelectTextModal() {
    const modal = document.getElementById('selectTextModal');
    if (!modal) return;
    if (modal.classList.contains('active')) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active');
            modal.classList.remove('closing');
        }, 220);
    } else {
        modal.classList.add('active');
    }
}

// ── Logic Circuit modal: tapping a rendered gate diagram opens it in a
// full-screen view the user can pinch-zoom, wheel-zoom, drag to pan, or
// use the +/−/reset buttons on — instead of only ever seeing it shrunk
// to fit the chat bubble. Mirrors the Select Text modal's full-page
// card, with the Graph modal's zoom-control affordance. ─────────────
const lcState = { scale: 1, x: 0, y: 0 };
const LC_MIN_SCALE = 0.4, LC_MAX_SCALE = 6;
let lcDragging = false, lcDragStartX = 0, lcDragStartY = 0, lcStartPanX = 0, lcStartPanY = 0;
let lcPinchStartDist = 0, lcPinchStartScale = 1, lcPinchMidClientX = 0, lcPinchMidClientY = 0;
let lcZoomIntervalId = null;

function lcApplyTransform() {
    const inner = document.getElementById('logicCircuitInner');
    if (inner) inner.style.transform = `translate(${lcState.x}px, ${lcState.y}px) scale(${lcState.scale})`;
}
function lcClampScale(s) { return Math.min(LC_MAX_SCALE, Math.max(LC_MIN_SCALE, s)); }

// Zooms around a fixed point (in viewport-local coordinates) so the
// content under that point stays put while the scale changes.
function lcZoomAround(originX, originY, newScale) {
    newScale = lcClampScale(newScale);
    const factor = newScale / lcState.scale;
    lcState.x = originX - (originX - lcState.x) * factor;
    lcState.y = originY - (originY - lcState.y) * factor;
    lcState.scale = newScale;
    lcApplyTransform();
}

function openLogicCircuitModal(svgMarkup) {
    const modal = document.getElementById('logicCircuitModal');
    const inner = document.getElementById('logicCircuitInner');
    if (!modal || !inner || !svgMarkup) return;

    inner.innerHTML = svgMarkup;
    const svg = inner.querySelector('svg');
    if (svg) {
        // Drop the bubble-fitting classes (width:100% etc.) so the SVG
        // renders at its natural viewBox size — that's what makes
        // panning/zooming meaningful instead of it just re-squishing.
        svg.classList.remove('xetex-shape-svg', 'xetex-logic-circuit-svg');
        svg.classList.add('logic-circuit-full-svg');
        svg.removeAttribute('preserveAspectRatio');
        const vb = (svg.getAttribute('viewBox') || '0 0 300 150').trim().split(/\s+/).map(Number);
        svg.style.width = (vb[2] || 300) + 'px';
        svg.style.height = (vb[3] || 150) + 'px';
    }

    modal.classList.remove('closing');
    modal.classList.add('active');
    // Wait a frame so the viewport has real layout dimensions before we
    // compute the fit-to-screen starting zoom.
    requestAnimationFrame(lcResetView);
}

function toggleLogicCircuitModal() {
    const modal = document.getElementById('logicCircuitModal');
    if (!modal) return;
    if (modal.classList.contains('active')) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active');
            modal.classList.remove('closing');
        }, 220);
    } else {
        modal.classList.add('active');
    }
}

function lcResetView() {
    const viewport = document.getElementById('logicCircuitViewport');
    const inner = document.getElementById('logicCircuitInner');
    const svg = inner ? inner.querySelector('svg') : null;
    if (!viewport || !inner) return;

    lcState.scale = 1; lcState.x = 0; lcState.y = 0;
    if (svg) {
        const vw = viewport.clientWidth || 300, vh = viewport.clientHeight || 300;
        const sw = parseFloat(svg.style.width) || vw, sh = parseFloat(svg.style.height) || vh;
        const fitScale = Math.min(vw / sw, vh / sh, 1.6) * 0.92;
        lcState.scale = lcClampScale(fitScale > 0 && isFinite(fitScale) ? fitScale : 1);
        lcState.x = (vw - sw * lcState.scale) / 2;
        lcState.y = (vh - sh * lcState.scale) / 2;
    }
    lcApplyTransform();
}

function lcPoint(e) {
    if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}
function lcTouchDist(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); }

function lcDragStart(e) {
    if (e.touches && e.touches.length === 2) {
        lcDragging = false;
        lcPinchStartDist = lcTouchDist(e.touches[0], e.touches[1]);
        lcPinchStartScale = lcState.scale;
        lcPinchMidClientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lcPinchMidClientY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        return;
    }
    const p = lcPoint(e);
    lcDragging = true;
    lcDragStartX = p.x; lcDragStartY = p.y;
    lcStartPanX = lcState.x; lcStartPanY = lcState.y;
}

function lcDragMove(e) {
    if (e.touches && e.touches.length === 2) {
        e.preventDefault();
        if (lcPinchStartDist <= 0) return;
        const dist = lcTouchDist(e.touches[0], e.touches[1]);
        const viewport = document.getElementById('logicCircuitViewport');
        const rect = viewport.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        lcZoomAround(midX - rect.left, midY - rect.top, lcPinchStartScale * (dist / lcPinchStartDist));
        return;
    }
    if (!lcDragging) return;
    if (e.preventDefault) e.preventDefault();
    const p = lcPoint(e);
    lcState.x = lcStartPanX + (p.x - lcDragStartX);
    lcState.y = lcStartPanY + (p.y - lcDragStartY);
    lcApplyTransform();
}

function lcDragStop() {
    lcDragging = false;
    lcPinchStartDist = 0;
}

function lcWheelZoom(e) {
    e.preventDefault();
    const viewport = document.getElementById('logicCircuitViewport');
    const rect = viewport.getBoundingClientRect();
    const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    lcZoomAround(e.clientX - rect.left, e.clientY - rect.top, lcState.scale * delta);
}

function lcZoomStep(dir) {
    const viewport = document.getElementById('logicCircuitViewport');
    if (!viewport) return;
    const cx = viewport.clientWidth / 2, cy = viewport.clientHeight / 2;
    lcZoomAround(cx, cy, lcState.scale * (dir > 0 ? 1.18 : 1 / 1.18));
}
function lcStartZoomIn(e) { if (e && e.preventDefault) e.preventDefault(); lcZoomStep(1); lcStopZoom(); lcZoomIntervalId = setInterval(() => lcZoomStep(1), 110); }
function lcStartZoomOut(e) { if (e && e.preventDefault) e.preventDefault(); lcZoomStep(-1); lcStopZoom(); lcZoomIntervalId = setInterval(() => lcZoomStep(-1), 110); }
function lcStopZoom() { if (lcZoomIntervalId) { clearInterval(lcZoomIntervalId); lcZoomIntervalId = null; } }

// Delegated tap: any rendered circuit diagram (current or future
// messages) opens the full-screen view. Delegated on the feed since
// messages mount dynamically.
(function initLogicCircuitTapToOpen() {
    const feed = document.getElementById('chatFeed');
    if (!feed) return;
    feed.addEventListener('click', (e) => {
        const wrap = e.target.closest('.xetex-logic-circuit-wrap');
        if (!wrap) return;
        const svg = wrap.querySelector('svg');
        if (!svg) return;
        openLogicCircuitModal(svg.outerHTML);
    });
})();

// 🔒 Background scroll lock: whenever the sidebar, the overlay, or any .modal
// is open/active, lock the body so the chat feed underneath can't be scrolled
// or touched through the overlay. Uses a MutationObserver so it automatically
// covers every current and future modal without needing to edit each toggle
// function individually.
function updateScrollLock() {
    const sidebarOpen = document.getElementById('sidebar')?.classList.contains('open');
    const overlayShown = document.getElementById('overlay')?.classList.contains('show');
    const anyModalActive = !!document.querySelector('.modal.active');
    const shouldLock = sidebarOpen || overlayShown || anyModalActive;
    document.body.classList.toggle('scroll-locked', shouldLock);
}

(function initScrollLockObserver() {
    const watchIds = ['sidebar', 'overlay', 'aboutModal', 'graphModal', 'tgraphModal', 'settingsModal', 'backupModal', 'confirmModal', 'ggSettingsModal', 'selectTextModal', 'logicCircuitModal'];
    const observer = new MutationObserver(updateScrollLock);
    watchIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // Run once on load in case a modal starts open.
    updateScrollLock();
})();

// ⬅️ Back button / back gesture handling: pressing back (hardware back key,
// browser back button, or an edge-swipe gesture) while a modal, the Graph
// Settings panel, or the sidebar is open should close THAT, not leave the
// app/page. We do this by pushing one history entry per overlay as it opens,
// and consuming that same entry (via history.back()) whenever it's closed
// any other way (its own close/X button, tapping the backdrop, etc.), so
// browser history and "what's open" always stay 1:1. A stack (not just a
// counter) means nested overlays — e.g. Graph Settings opened on top of the
// Chart modal — unwind one at a time, innermost first.
const XENON_OVERLAYS = {
    ggSettingsModal: 'active',
    confirmModal:    'active',
    graphModal:      'active',
    tgraphModal:     'active',
    settingsModal:   'active',
    backupModal:     'active',
    aboutModal:      'active',
    selectTextModal: 'active',
    logicCircuitModal: 'active',
    sidebar:         'open',
};

// Backup is opened as a drill-in *from* Settings (Settings closes instantly,
// then this opens in its place — see the onclick handler on the Settings row
// in index.html). A back-press from it should therefore land back on
// Settings, not drop the user straight to the main page, the way "go back"
// would elsewhere in the app.
const XENON_SETTINGS_SUBPAGES = new Set(['backupModal']);

window.xenonOpenStack = [];
window.xenonSuppressHistory = false;
window.xenonPushCounter = 0;

// Push a real, distinct history entry for an overlay. Earlier this reused
// location.href unchanged for every push — some Android WebView back-button
// implementations decide whether there's anything to "go back" to by
// comparing the URL, not just the state object, so an unchanged URL could
// make the hardware/gesture back button skip our history entirely and
// close the whole app (or the whole modal stack) in one shot instead of
// stepping back one overlay at a time. Giving every push its own hash
// makes the entry unambiguous everywhere.
function xenonPushOverlayState(id) {
    window.xenonPushCounter++;
    const hash = '#xo-' + id + '-' + window.xenonPushCounter;
    history.pushState({ xenonOverlay: id }, '', hash);
}

function xenonCloseOverlayById(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'sidebar') {
        closeAll(); // also clears the backdrop + input menu together
    } else {
        el.classList.remove(XENON_OVERLAYS[id]);
        if (XENON_SETTINGS_SUBPAGES.has(id)) {
            const settingsEl = document.getElementById('settingsModal');
            if (settingsEl) settingsEl.classList.add('active');
        }
    }
}

// Drill in from Settings to one of its sub-pages (Update, Backup & Storage).
// Settings closes instantly and the sub-page opens in its place, but unlike
// a normal overlay swap we deliberately do NOT consume the Settings history
// entry — it stays on xenonOpenStack underneath the new one, so a back-press
// pops the sub-page first and lands back on Settings (see
// XENON_SETTINGS_SUBPAGES / xenonCloseOverlayById above), and only a second
// back-press leaves Settings entirely. openFn is the sub-page's own
// toggle function (e.g. toggleBackupModal), which also renders its content.
function xenonOpenSettingsSubpage(subpageId, openFn) {
    window.xenonSuppressHistory = true;
    const settingsEl = document.getElementById('settingsModal');
    if (settingsEl) {
        settingsEl.classList.remove('active');
        settingsEl.classList.remove('closing');
    }
    openFn();
    window.xenonOpenStack.push(subpageId);
    xenonPushOverlayState(subpageId);
    setTimeout(() => { window.xenonSuppressHistory = false; }, 50);
}

function xenonHandleOverlayMutations(mutations) {
    if (window.xenonSuppressHistory) return;
    for (const m of mutations) {
        if (m.attributeName !== 'class') continue;
        const id = m.target.id;
        const activeClass = XENON_OVERLAYS[id];
        if (!activeClass) continue;
        const wasOpen = (m.oldValue || '').split(/\s+/).includes(activeClass);
        const isOpen = m.target.classList.contains(activeClass);
        if (!wasOpen && isOpen) {
            // Opened via a normal in-app action — remember it and reserve
            // a spot in browser history for the "close" that a back-press
            // should perform.
            window.xenonOpenStack.push(id);
            xenonPushOverlayState(id);
        } else if (wasOpen && !isOpen) {
            // Closed via its own close/X button, a backdrop tap, etc. —
            // consume the history entry we reserved for it so back/forward
            // stay balanced (otherwise back would later do nothing visible).
            const idx = window.xenonOpenStack.lastIndexOf(id);
            if (idx !== -1) window.xenonOpenStack.splice(idx, 1);
            window.xenonSuppressHistory = true;
            history.back();
            setTimeout(() => { window.xenonSuppressHistory = false; }, 50);
        }
    }
}

window.addEventListener('popstate', () => {
    if (window.xenonSuppressHistory) return; // our own history.back() call above; already handled
    const id = window.xenonOpenStack.pop();
    if (id) {
        window.xenonSuppressHistory = true;
        xenonCloseOverlayById(id);
        setTimeout(() => { window.xenonSuppressHistory = false; }, 50);
    }
    // If nothing was open, there's nothing to intercept — let the back
    // navigation proceed normally (leave the page/app), same as before.
});

(function initOverlayHistoryObserver() {
    const observer = new MutationObserver(xenonHandleOverlayMutations);
    Object.keys(XENON_OVERLAYS).forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    });
})();

// 🗑️ Double-tap (touch) / double-click (mouse) on a message opens the
// delete confirmation directly — a single tap does nothing. No visible
// delete icon is needed since the confirm dialog (showConfirm) is the
// only UI for this action. Delegated on the chat feed since messages
// are added dynamically.
(function initMessageDoubleTapDelete() {
    const feed = document.getElementById('chatFeed');
    if (!feed) return;
    const DOUBLE_TAP_MS = 400;
    let lastTapTime = 0;
    let lastTapEl = null;

    feed.addEventListener('click', (e) => {
        const messageEl = e.target.closest('.message');
        const container = messageEl ? messageEl.closest('.message-container') : null;
        if (!container) return;

        const now = Date.now();
        const isDoubleTap = (messageEl === lastTapEl) && (now - lastTapTime < DOUBLE_TAP_MS);

        if (isDoubleTap) {
            lastTapTime = 0;
            lastTapEl = null;
            const idx = parseInt(container.dataset.msgIndex, 10);
            if (!Number.isNaN(idx)) deleteMsg(idx);
        } else {
            lastTapTime = now;
            lastTapEl = messageEl;
        }
    });
})();

// 🔒 Belt-and-suspenders guard against "Select all" (and any other path
// that bypasses CSS user-select) growing a selection outside a single
// message's .text-node. If the current selection's start and end don't
// both fall inside the same .text-node, the selection is cleared.
(function initSelectionGuard() {
    function closestTextNode(node) {
        const el = node && node.nodeType === 1 ? node : node?.parentElement;
        // .select-text-body is the Select Text modal's own dedicated,
        // single-message page — selection there can never span multiple
        // bubbles, so it's just as safe a container as .text-node.
        return el && el.closest ? el.closest('.text-node, .select-text-body') : null;
    }

    document.addEventListener('selectionchange', () => {
        const active = document.activeElement;
        const inEditableField = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable
        );
        if (inEditableField) return; // native field selection is always fine

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

        const range = sel.getRangeAt(0);
        const startNode = closestTextNode(range.startContainer);
        const endNode = closestTextNode(range.endContainer);
        const sameTextNode = !!startNode && startNode === endNode;

        if (!sameTextNode) {
            sel.removeAllRanges();
        }
    });
})();

function selectChartTab(el, type) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('gType').value = type;
    updateGraph();
}

function toggleGraphModal() {
    const modal = document.getElementById('graphModal');
    if (modal.classList.contains('active')) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active');
            modal.classList.remove('closing');
        }, 220);
    } else {
        modal.classList.add('active');
        // Fullscreen layout is unconditional CSS now (see styles2.css) — this
        // delay just gives the modal a frame to lay out before we measure the
        // canvas for updateGraph().
        setTimeout(updateGraph, 50);
        // Desktop: the settings panel is docked open beside the chart (see desktop.css),
        // so fill it in as soon as the Chart Generator opens.
        if (window.matchMedia('(min-width: 1100px) and (min-height: 560px)').matches &&
            typeof ggBuildSettingsBody === 'function') {
            setTimeout(ggBuildSettingsBody, 60);
        }
    }
}

function toggleTgraphModal() {
    const modal = document.getElementById('tgraphModal');
    if (modal.classList.contains('active')) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active');
            modal.classList.remove('closing');
            // Stop the graph's render loop now that it's not visible —
            // otherwise it keeps ticking in the background indefinitely.
            if (window.tgraphStopAnimation) window.tgraphStopAnimation();
        }, 220);
    } else {
        modal.classList.add('active');
        // Fullscreen layout is unconditional CSS now (see styles2.css) — this
        // delay just gives the modal a frame to lay out before tgraphInit()
        // measures the canvas.
        setTimeout(tgraphInit, 50);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    document.documentElement.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('xenon_darkmode', isDark ? 'true' : 'false');
    updateThemeIcon();
    if (window.AndroidBridge) {
        window.AndroidBridge.setDarkMode(isDark);
    }

    if (document.getElementById('graphModal').classList.contains('active')) {
        setTimeout(updateGraph, 50);
    }
    if (document.getElementById('tgraphModal').classList.contains('active')) {
        tgraphRender();
    }

    // Inline graphs are intentionally NOT redrawn here. They render once,
    // at message-creation time, with a fixed light palette baked in (see
    // inline-graph.js) and are never touched again — toggling theme should
    // never re-run their drawing script, since every extra render was the
    // source of the zoom/crash bug. The canvas keeps its original look
    // regardless of how many times dark mode is toggled.
}

function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    const isDark = document.body.classList.contains('dark-mode');
    icon.className = isDark ? 'icon icon-sun' : 'icon icon-moon';
}

function toggleInputMenu() {
    document.getElementById('menuWrapper').classList.remove('active');

    const sugBox = document.getElementById('suggestionBox');
    if (sugBox) sugBox.style.display = 'none';

    const menu = document.getElementById('inputMenu');
    const icon = document.getElementById('plusIcon');

    // The menu opens/closes below the bar and resizes the input area —
    // snapshot its height first so the feed follows the whole move.
    if (typeof _fingerPrime === 'function') _fingerPrime();

    if (menu.classList.contains('show')) {
        menu.classList.add('closing');
        icon.classList.remove('active');

        setTimeout(() => {
            menu.classList.remove('show');
            menu.classList.remove('closing');
        }, 300);
    } else {
        menu.classList.add('show');
        icon.classList.add('active');
    }
}

// ── Speaker / read-aloud toggle ───────────────────────────────────────
// A persistent on/off switch (same idea as Nova's speaker button): while
// on, the button stays highlighted (the "active" class — see
// .voice-btn-wrap.active in styles.css) and every new AI reply is read
// aloud with the browser's built-in speech synthesis. The state survives
// reload via localStorage, same pattern as the dark-mode toggle.
const VOICE_KEY = 'xenon_voice_on';
function isVoiceOn() {
    try { return localStorage.getItem(VOICE_KEY) === '1'; } catch (e) { return false; }
}
function setVoiceOn(on) {
    try { localStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
}
function toggleVoiceInput() {
    const wrap = document.getElementById('voiceBtnWrap');
    if (!wrap) return;
    const on = !wrap.classList.contains('active');
    wrap.classList.toggle('active', on);
    setVoiceOn(on);
    if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
}
// Restore the toggle's on/off state (not tied to whether it happens to be
// speaking right now) as soon as the DOM is ready.
document.addEventListener('DOMContentLoaded', function () {
    const wrap = document.getElementById('voiceBtnWrap');
    if (wrap && isVoiceOn()) wrap.classList.add('active');
});

// Strips markdown-ish symbols and HTML down to plain readable text.
function textForSpeech(raw, isHTML) {
    let s = String(raw || '');
    if (isHTML) {
        const div = document.createElement('div');
        div.innerHTML = s;
        s = div.textContent || div.innerText || '';
    }
    return s.replace(/[*_#•→─━]/g, ' ').replace(/```[\s\S]*?```/g, ' code block ')
        .replace(/\s+/g, ' ').trim();
}

// Reads an AI reply aloud if the speaker toggle is on. Cancels whatever
// was still playing so replies never overlap.
function speakReply(text, isHTML) {
    if (!isVoiceOn() || !('speechSynthesis' in window)) return;
    const clean = textForSpeech(text, isHTML);
    if (!clean) return;
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.02;
        speechSynthesis.speak(u);
    } catch (e) { /* speech synthesis unavailable — stay silent */ }
}

function closeAll() {
    if (typeof _fingerPrime === 'function') _fingerPrime();
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('inputMenu').classList.remove('show');
    document.getElementById('plusIcon').classList.remove('active');
    document.getElementById('menuWrapper').classList.remove('active');
}

// ── Smooth height animation for the input textarea ──────────────────
// Runs a manual rAF interpolation loop (synced to the display's refresh
// rate) ONLY while the box is actively expanding/shrinking. The loop
// starts on input and self-terminates the instant it reaches its target
// height, so no rAF work happens while the user is just typing on a
// single line or idle — purely an event-driven animation, not a
// continuous background loop.
//
// Perf notes:
// - _taCurrentHeight caches the box's live height in JS so retargeting
//   mid-animation (fast typing) never needs a layout read (no
//   getBoundingClientRect/offsetHeight call) — only the unavoidable
//   'auto'+scrollHeight read to measure the new target is a reflow.
// - The first frame is applied synchronously (not via rAF) so the box
//   starts moving in the very same tick as the keystroke, instead of
//   waiting a frame — makes the start feel instant rather than laggy.
let _taAnim = null;         // { rafId } while an animation is in flight
let _taCurrentHeight = null; // last known rendered height, kept in sync

function autoExpand(el) {
    const from = _taCurrentHeight !== null ? _taCurrentHeight : el.offsetHeight;
    const prevHeight = el.style.height;
    el.style.height = 'auto';
    const target = el.scrollHeight;
    el.style.height = prevHeight || from + 'px'; // restore, avoids any visible flash

    _animateTextareaHeight(el, from, target);
}

function _animateTextareaHeight(el, from, target) {
    if (_taAnim && _taAnim.rafId) cancelAnimationFrame(_taAnim.rafId);

    if (Math.abs(target - from) < 0.5) {
        el.style.height = target + 'px';
        _taCurrentHeight = target;
        el.style.willChange = 'auto'; // ensure it's released even if this follows a cancelled animation
        _taAnim = null;
        return;
    }

    el.style.willChange = 'height'; // GPU layer only while actually animating
    if (typeof _fingerWake === 'function') _fingerWake(220); // wake the scroll tracker for the duration of this resize

    const duration = 160; // ms — snappy but visibly eased
    const startTime = performance.now();
    _taAnim = { rafId: null };

    function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        // ease-out cubic — fast start, gentle settle
        const eased = 1 - Math.pow(1 - t, 3);
        const current = from + (target - from) * eased;

        el.style.height = current + 'px';
        _taCurrentHeight = current;

        if (t < 1) {
            _taAnim.rafId = requestAnimationFrame(step);
        } else {
            el.style.height = target + 'px';
            _taCurrentHeight = target;
            el.style.willChange = 'auto'; // release the layer — no idle GPU cost
            _taAnim = null; // loop stops here — no idle rAF cost
        }
    }
    step(startTime); // first frame applied synchronously — starts instantly, no 1-frame delay
}

// ── HTML → plain text helper ─────────────────────────────────────────
// Strips tags, keeps block structure (paragraphs, list items, headings).
function htmlToPlainText(html) {
    if (typeof html !== 'string') return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;

    // Table rows first — replace each <tr> with a single line where cells
    // are separated by "  |  ", so a two-column compare table copies as
    // proper tabular text instead of running together.
    tmp.querySelectorAll('tr').forEach(function (tr) {
        var cells = tr.querySelectorAll('th, td');
        var parts = [];
        cells.forEach(function (c) {
            parts.push((c.innerText || c.textContent || '').trim());
        });
        tr.replaceWith(document.createTextNode(parts.join('  |  ') + '\n'));
    });

    // List items become "- text" lines.
    tmp.querySelectorAll('li').forEach(function (li) {
        var text = (li.innerText || li.textContent || '').trim();
        li.replaceWith(document.createTextNode('- ' + text + '\n'));
    });

    // Block elements get a trailing newline so innerText keeps structure.
    tmp.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, pre').forEach(function (el) {
        el.appendChild(document.createTextNode('\n'));
    });

    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;';
    holder.appendChild(tmp);
    document.body.appendChild(holder);
    var text = tmp.innerText || tmp.textContent || '';
    document.body.removeChild(holder);

    return text
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function copyMsg(btn, i) {
    const msg = sessions[currentIdx] && sessions[currentIdx].messages[i];
    if (!msg) return;

    let textToCopy = msg.text || '';

    // If the message is an HTML payload (flag set, or the string looks
    // like markup), extract plain text so the copy contains what the
    // user actually sees, not the raw tags.
    if (msg.__html || /^\s*</.test(textToCopy)) {
        textToCopy = htmlToPlainText(textToCopy);
    }

    // Graph spec text — appended after the base text, as before.
    if (msg._hasGraph) {
        const msgEl = btn.closest('.message');
        if (msgEl) {
            const label = msgEl.querySelector('.graph-spec-label');
            const items = msgEl.querySelectorAll('.graph-spec-item');
            if (label || items.length > 0) {
                let specText = '';
                if (label) specText += '\n' + label.textContent.trim() + '\n';
                items.forEach((item, idx) => {
                    specText += `${idx + 1}. ${item.textContent.replace(/^\d+\.\s*/, '').trim()}\n`;
                });
                textToCopy = textToCopy + specText;
            }
        }
    }

    navigator.clipboard.writeText(textToCopy).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    });
    btn.classList.remove('icon-copy');
    btn.classList.add('icon-check');
    setTimeout(() => {
        btn.classList.remove('icon-check');
        btn.classList.add('icon-copy');
    }, 1500);
}



// ── Code card copy: handles the copy button inside a .code-card ─────
function codeCardCopy(btn) {
    var card = btn.closest('.code-card');
    if (!card) return;
    var body = card.querySelector('pre') || card.querySelector('.code-card-body');
    if (!body) return;

    var text = (body.innerText || body.textContent || '').trim();
    var label = btn.querySelector('.code-card-copy-label');

    function done() {
        btn.classList.add('copied');
        if (label) label.textContent = 'Copied';
        if (navigator.vibrate) navigator.vibrate(15);
        setTimeout(function () {
            btn.classList.remove('copied');
            if (label) label.textContent = 'Copy';
        }, 1400);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
            codeCardCopyFallback(text, done);
        });
    } else {
        codeCardCopyFallback(text, done);
    }
}

function codeCardCopyFallback(text, onSuccess) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch (e) {}
    document.body.removeChild(ta);
}





function showConfirm(title, desc, onConfirm) {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmDesc').innerText = desc;
    document.getElementById('confirmModal').classList.add('active');

    document.getElementById('confirmDeleteBtn').onclick = () => {
        onConfirm();
        closeConfirm();
    };
    document.getElementById('confirmCancelBtn').onclick = closeConfirm;
}

function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.remove('active');
        modal.classList.remove('closing');
    }, 220);
}

function deleteMsg(i) {
    showConfirm("Delete Message?", "Remove this message from your chat?", () => {
        sessions[currentIdx].messages.splice(i, 1);
        saveData();
        renderChat();
    });
}

function clearAllHistory() {
    showConfirm("Clear All History?", "This will permanently delete every conversation you have. Proceed?", () => {
        sessions = [];
        createNewSession("New Chat");
        saveData();
        renderAll();
        closeAll();
    });
}

// #userInput allows native text selection so Paste keeps working; the
// long-press-to-copy shortcut below is just a convenience on top of that.
// Works for touch and mouse; cancels cleanly if the press is released
// early or the finger/cursor moves off the field.
(function initUserInputLongPressCopy() {
    const LONG_PRESS_MS = 1500;
    const MOVE_CANCEL_PX = 12;
    const input = document.getElementById('userInput');
    if (!input) return;

    let pressTimer = null;
    let startX = 0, startY = 0;

    function clearTimer() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }

    function doCopy() {
        const text = input.value;
        if (!text) return;
        const finish = () => {
            input.classList.add('copy-flash');
            setTimeout(() => input.classList.remove('copy-flash'), 200);
            if (navigator.vibrate) navigator.vibrate(15);
        };
        navigator.clipboard.writeText(text).then(finish).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            finish();
        });
    }

    function onPressStart(x, y) {
        startX = x; startY = y;
        clearTimer();
        pressTimer = setTimeout(doCopy, LONG_PRESS_MS);
    }

    function onPressMove(x, y) {
        if (!pressTimer) return;
        if (Math.abs(x - startX) > MOVE_CANCEL_PX || Math.abs(y - startY) > MOVE_CANCEL_PX) {
            clearTimer();
        }
    }

    input.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        onPressStart(t.clientX, t.clientY);
    }, { passive: true });
    input.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        onPressMove(t.clientX, t.clientY);
    }, { passive: true });
    input.addEventListener('touchend', clearTimer);
    input.addEventListener('touchcancel', clearTimer);

    input.addEventListener('mousedown', (e) => onPressStart(e.clientX, e.clientY));
    input.addEventListener('mousemove', (e) => onPressMove(e.clientX, e.clientY));
    input.addEventListener('mouseup', clearTimer);
    input.addEventListener('mouseleave', clearTimer);
})();
(function () {
    const feed = document.getElementById('chatFeed');
    if (!feed) return;

    const MAX_PULL = 30;
    const RESISTANCE = 3.0;
    const RETURN_MS = 250; // must match the snap-back transition duration below
    let startY = 0;
    let pulling = false;
    let pullDir = 0; // +1 = pulling down at the top edge, -1 = pulling up at the bottom edge
    let pullAmount = 0;
    let returnTimer = null; // guards the momentum-bounce path while a snap-back is still animating

    // Single place that puts the feed back at translateY(0). Always clears
    // any previous return timer first so a fresh gesture/bounce can never
    // land in the middle of an old one and have the two fight over
    // `transform`/`transition` — that stacking was the "conflicts with
    // itself" glitch.
    function snapBack() {
        if (returnTimer) {
            clearTimeout(returnTimer);
            returnTimer = null;
        }
        feed.style.transition = 'transform 0.25s ease-out';
        feed.style.transform = 'translateY(0)';
        returnTimer = setTimeout(() => { returnTimer = null; }, RETURN_MS);
    }

    feed.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        startY = e.touches[0].clientY;
        pulling = false;
        pullDir = 0;
        pullAmount = 0;
        // A brand-new touch always wins over whatever animation was still
        // finishing up (return-from-pull or a momentum bounce).
        if (returnTimer) {
            clearTimeout(returnTimer);
            returnTimer = null;
        }
        feed.style.transition = 'none';
        armUserScroll();
    }, { passive: true });

    feed.addEventListener('touchmove', (e) => {
        shouldAutoScroll = false;
        armUserScroll();

        const y = e.touches[0].clientY;
        // Fuzz both edges the same way — an unfuzzed `<= 0` top check misses
        // the frequent sub-pixel scrollTop values Chromium reports, which is
        // what made the pull silently fail to start ("stuck") at the top.
        const atTop = feed.scrollTop <= 1;
        const atBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 1;
        const rawDeltaFromStart = y - startY;
        const enteringPull = !pulling &&
            ((atTop && rawDeltaFromStart > 0) || (atBottom && rawDeltaFromStart < 0));

        if (enteringPull) {
            // Rebase to the finger position at the moment the edge is
            // actually reached, not wherever the gesture began. Without
            // this, dragging through several hundred px of normal scroll
            // before hitting the edge made the stretch jump straight to
            // (or past) MAX_PULL on the very first qualifying frame instead
            // of growing smoothly from 0.
            startY = y;
            pulling = true;
            pullDir = atTop ? 1 : -1;
            window._chatFeedPulling = true;
        }

        if (pulling) {
            const rawDelta = y - startY;
            // Only bail out early on a real, deliberate push back past the
            // edge — a small negative dip from finger jitter should just
            // ease the stretch toward 0, not cancel the gesture and
            // rebase the origin. That rebase-on-every-jitter was the bug:
            // each tiny wobble reset `startY` to the current finger
            // position, so the accumulated pull distance kept getting
            // thrown away and the stretch could never build up to
            // MAX_PULL — it just felt like it kept losing momentum.
            const CANCEL_PX = 24;
            const reversed = (pullDir === 1 && rawDelta < -CANCEL_PX) ||
                              (pullDir === -1 && rawDelta > CANCEL_PX);
            if (reversed) {
                pulling = false;
                pullDir = 0;
                pullAmount = 0;
                window._chatFeedPulling = false;
                snapBack();
                return;
            }
            const damped = rawDelta / RESISTANCE;
            pullAmount = pullDir === 1
                ? Math.max(0, Math.min(MAX_PULL, damped))
                : Math.min(0, Math.max(-MAX_PULL, damped));
            feed.style.transition = 'none';
            feed.style.transform = `translateY(${pullAmount}px)`;
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    feed.addEventListener('touchend', () => {
        if (pulling) {
            pulling = false;
            pullDir = 0;
            pullAmount = 0;
            window._chatFeedPulling = false;
            snapBack();
        }
    });

    feed.addEventListener('touchcancel', () => {
        pulling = false;
        pullDir = 0;
        pullAmount = 0;
        window._chatFeedPulling = false;
        snapBack();
    });

    // ── Fast-scroll (fling/momentum) hitting the top or bottom ──────────
    // overscroll-behavior:none on #chatFeed kills the native rubber-band
    // bounce, so a fast flick that reaches either end just stops dead —
    // it "locks" at the boundary instead of overshooting into the
    // overflow area like a normal momentum scroll would. This tracks
    // scroll velocity while the user is actively scrolling (touch or
    // wheel) and, if the feed hits an edge while still moving fast,
    // plays a short overshoot-then-settle bounce — same visual language
    // as the drag-to-edge case above, just driven by momentum instead of
    // a live touch. No haptics here — purely visual.
    //
    // Gated to a short window around real user scroll gestures (armed by
    // touchstart/touchmove/wheel) so it never fires on programmatic
    // scrolls — e.g. auto-scroll-to-bottom when a new message arrives.
    const USER_SCROLL_WINDOW_MS = 1600;
    const VELOCITY_THRESHOLD = 0.35;     // px/ms — below this it's a normal, gentle stop: no overshoot
    const VELOCITY_FOR_MAX_BOUNCE = 1.6; // px/ms — velocity at/above which the overshoot maxes out
    const MIN_BOUNCE = 8;
    const MAX_BOUNCE = 22;

    let userScrollActiveUntil = 0;
    let velTrackTop = feed.scrollTop;
    let velTrackTime = performance.now();
    let currentVelocity = 0;
    let bounceArmed = true;
    let suppressedUntil = 0;

    function armUserScroll() {
        userScrollActiveUntil = performance.now() + USER_SCROLL_WINDOW_MS;
    }
    feed.addEventListener('wheel', armUserScroll, { passive: true });

    // Called from index.html whenever the on-screen keyboard opens or
    // closes, so the resulting feed reflow/scroll never reads as a real
    // scroll gesture and triggers a spurious bounce. Name kept as
    // `_suppressScrollHaptics` for backward compatibility with that
    // existing call site — it now gates the bounce animation only, since
    // haptics were removed from the feed entirely.
    window._suppressScrollHaptics = function (durationMs = 400) {
        suppressedUntil = Math.max(suppressedUntil, performance.now() + durationMs);
    };

    function playMomentumBounce(direction, velocity) {
        // Cancel any drag-return still in flight so it can't stomp this
        // (or vice versa) — same reasoning as snapBack() above.
        if (returnTimer) {
            clearTimeout(returnTimer);
            returnTimer = null;
        }
        const mag = Math.min(1, Math.abs(velocity) / VELOCITY_FOR_MAX_BOUNCE);
        const overshoot = (MIN_BOUNCE + (MAX_BOUNCE - MIN_BOUNCE) * mag) * direction;

        feed.style.transition = 'none';
        feed.style.transform = `translateY(${overshoot}px)`;
        void feed.offsetHeight; // force reflow so the jump renders before easing back
        feed.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        feed.style.transform = 'translateY(0)';
        returnTimer = setTimeout(() => { returnTimer = null; }, 280);
    }

    feed.addEventListener('scroll', () => {
        const now = performance.now();
        const dt = now - velTrackTime;
        if (dt < 4) return; // light throttle, avoids over-sampling on very dense scroll events

        // Skip entirely while the feed's position is being driven
        // programmatically (keyboard opening/closing, the input bar
        // resizing, or chasing the bottom after a send/receive) — those
        // move scrollTop/clientHeight on their own and can otherwise look
        // like a fast scroll hitting the edge, firing a bounce nobody
        // asked for. This is also what keeps the auto-scroll-to-bottom
        // stream smooth — without it, every content-growth tick during a
        // streaming reply could misread as a fling and jitter the feed.
        if (now < suppressedUntil ||
            (typeof _fingerRunning !== 'undefined' && _fingerRunning) ||
            (typeof _chasingBottom !== 'undefined' && _chasingBottom)) {
            velTrackTop = feed.scrollTop;
            velTrackTime = now;
            return;
        }

        const atTop = feed.scrollTop <= 0;
        const atBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 1;
        const withinUserWindow = now < userScrollActiveUntil;

        if (!atTop && !atBottom) {
            currentVelocity = (feed.scrollTop - velTrackTop) / dt;
            bounceArmed = true; // re-arm so leaving and re-hitting an edge can trigger again
        } else if (bounceArmed && withinUserWindow && !pulling && !returnTimer) {
            bounceArmed = false;
            if (Math.abs(currentVelocity) >= VELOCITY_THRESHOLD) {
                playMomentumBounce(atTop ? 1 : -1, currentVelocity);
            }
            currentVelocity = 0;
        }

        velTrackTop = feed.scrollTop;
        velTrackTime = now;
    }, { passive: true });
})();
