// ================= SETTINGS MANAGEMENT =================
//
// Settings persist through the native XenonStorage bridge's configuration
// store instead of localStorage. window.XenonStorage calls are synchronous,
// so this stays a plain synchronous read/write module just like before.

function readSettingsConfig() {
    if (typeof window === 'undefined' || !window.XenonStorage) return {};
    try {
        const parsed = JSON.parse(window.XenonStorage.loadConfiguration());
        return (parsed && parsed.success !== false && parsed.configuration) || {};
    } catch (e) {
        return {};
    }
}

function writeSettingsConfig(config) {
    if (typeof window === 'undefined' || !window.XenonStorage) return;
    try {
        window.XenonStorage.saveConfiguration(JSON.stringify(config));
    } catch (e) {
        // best-effort — in-memory state for this session is still correct
    }
}

// Settings state
let suggestionsEnabled = readSettingsConfig().xenon_suggestions === true;

// Settings Modal Toggle
function toggleSettingsModal() {
    const modal = document.getElementById('settingsModal');
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

// Closes Settings instantly (skips the normal 220ms fade-out) so it can be
// swapped straight for another full-screen modal — used by the Update/Model/
// Backup rows below. Letting Settings' own fade play at the same time as the
// next modal's fade-IN meant two independent full-screen transitions were
// compositing on screen simultaneously, which on some devices showed up as
// a brief ghost of Settings behind the modal that was opening. Settings'
// own X button still uses the regular toggleSettingsModal() fade, since
// nothing else opens on top of it there.
function closeSettingsInstantly() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.classList.remove('closing');
}

// True when the on-screen keyboard is (effectively) up — i.e. a text field
// currently has focus. The menu tiles no longer steal focus (see
// initInputMenuTiles below), so at the moment a tile is tapped this still
// reflects what the user was doing before they opened the menu.
function isTypingInField() {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes((el.type || 'text').toLowerCase());
}

// ── Is the on-screen keyboard REALLY showing? ──────────────────────────
// A text field can stay focused after the keyboard is dismissed (hide button /
// back gesture) — the caret is still blinking but there's no keyboard. So
// "a field has focus" alone is not enough to say the keyboard is up, and
// acting on it re-summoned the keyboard on taps that should leave it closed.
// The keyboard is up when a field is focused AND the screen has visibly
// shrunk for it. Two signals cover both ways browsers/WebViews do that:
//   • the layout viewport got shorter than the tallest it has been
//     (interactive-widget=resizes-content / adjustResize), or
//   • the visual viewport is shorter than the layout viewport (overlay mode).
const KB_MIN_SHRINK_PX = 150; // keyboards are 200px+; URL-bar wobble is < 120
let _kbBaseW = window.innerWidth;
let _kbBaseH = window.innerHeight;
function _kbTrackViewport() {
    if (window.innerWidth !== _kbBaseW) {      // rotation: start a new baseline
        _kbBaseW = window.innerWidth;
        _kbBaseH = window.innerHeight;
    } else if (window.innerHeight > _kbBaseH) { // grew (keyboard closed / URL bar hid)
        _kbBaseH = window.innerHeight;
    }
}
window.addEventListener('resize', _kbTrackViewport);
if (window.visualViewport) window.visualViewport.addEventListener('resize', _kbTrackViewport);

function isKeyboardOpen() {
    if (!isTypingInField()) return false;
    if (_kbBaseH - window.innerHeight >= KB_MIN_SHRINK_PX) return true;
    const vv = window.visualViewport;
    if (vv && (!vv.scale || vv.scale <= 1.01) &&
        window.innerHeight - (vv.height + vv.offsetTop) >= KB_MIN_SHRINK_PX) return true;
    return false;
}

// Fields that should take over the keyboard when Chart / Xenon Graph open
// from a keyboard-open state.
const MENU_MODAL_FIELDS = {
    Graph:  { modal: 'graphModal',  field: 'gData' },
    TGraph: { modal: 'tgraphModal', field: 'tgraphEquation' }
};

// Update handleMenu function
function handleMenu(action) {
    const wasTyping = isKeyboardOpen(); // keyboard actually up — not just a focused field
    const typingField = document.activeElement;

    if(action === 'Graph') toggleGraphModal();
    else if(action === 'TGraph') toggleTgraphModal();
    else if(action === 'Settings') toggleSettingsModal();
    toggleInputMenu();

    if (!wasTyping) return; // keyboard was down — leave it down

    // Keyboard was up: hand it straight to the modal's own input so it
    // never drops. This must happen synchronously inside the tap (not in a
    // timeout) or Android tears the keyboard down first and it flickers.
    const target = MENU_MODAL_FIELDS[action];
    const modal = target && document.getElementById(target.modal);
    const field = target && document.getElementById(target.field);
    if (modal && field && modal.classList.contains('active') && !modal.classList.contains('closing')) {
        field.focus({ preventScroll: true });
        try { const n = field.value.length; field.setSelectionRange(n, n); } catch (e) {}
    } else if (typingField && typeof typingField.blur === 'function') {
        // Destination has no text field (e.g. Settings) — close the keyboard
        // rather than leaving it hanging over a screen you can't type on.
        typingField.blur();
    }
}

// ── Toggle-menu tiles ──────────────────────────────────────────────────
// Tapping a plain <div> normally moves focus off the text box, which is what
// dismissed the keyboard the instant a tile was tapped. Same recipe the +
// button uses: cancel mousedown/touchstart so focus stays where it is, and
// fire the action from touchend (touch) / click (mouse). touchstart is
// cancelled, so the browser's own :active never applies — a .pressed class
// stands in for it.
(function initInputMenuTiles() {
    const menu = document.getElementById('inputMenu');
    if (!menu) return;

    const tileOf = (e) => (e.target && e.target.closest) ? e.target.closest('.menu-item') : null;
    let lastFire = 0;
    function fire(tile) {
        const now = performance.now();
        if (now - lastFire < 400) return; // touchend + click never double-fire
        lastFire = now;
        handleMenu(tile.dataset.action);
    }
    const clearPressed = () => menu.querySelectorAll('.pressed').forEach(t => t.classList.remove('pressed'));

    // Only take over the tap (to keep focus in the text box) when the keyboard
    // is really up. If it's down, behave like any normal tap — otherwise
    // holding focus in a text field would summon the keyboard back.
    let keepKeyboard = false;

    menu.addEventListener('mousedown', (e) => { if (isKeyboardOpen()) e.preventDefault(); });

    menu.addEventListener('touchstart', (e) => {
        const tile = tileOf(e);
        keepKeyboard = false;
        if (!tile) return;
        keepKeyboard = isKeyboardOpen();
        if (!keepKeyboard) return; // normal tap: browser handles it, click follows
        e.preventDefault();
        tile.classList.add('pressed');
    }, { passive: false });

    menu.addEventListener('touchend', (e) => {
        const tile = tileOf(e);
        if (!tile || !keepKeyboard) return;
        keepKeyboard = false;
        e.preventDefault();
        tile.classList.remove('pressed');
        // Only count it as a tap if the finger lifted still on the tile.
        const pt = e.changedTouches && e.changedTouches[0];
        const r = tile.getBoundingClientRect();
        if (pt && pt.clientX >= r.left && pt.clientX <= r.right && pt.clientY >= r.top && pt.clientY <= r.bottom) {
            fire(tile);
        }
    }, { passive: false });

    menu.addEventListener('touchcancel', () => { keepKeyboard = false; clearPressed(); });

    menu.addEventListener('click', (e) => {
        const tile = tileOf(e);
        if (tile) fire(tile);
    });
})();

// Chart and Xenon Graph are fullscreen-only (no windowed mode). The
// fullscreen layout used to be applied by adding a 'graph-fullscreen' /
// 'tgraph-fullscreen' class here, ~50ms after the modal opened — which
// meant the old small/windowed card style (still sitting in CSS) was what
// actually rendered for that first frame, every single time. The
// fullscreen layout is now baked directly into #graphModal/#tgraphModal's
// base CSS (styles2.css) so there's no separate small-card style left to
// flash into view and no class-toggling step needed here anymore.

// Initialize settings on page load
window.addEventListener('DOMContentLoaded', () => {
    const suggestionToggle = document.getElementById('suggestionToggle');

    if (suggestionToggle) {
        suggestionToggle.checked = suggestionsEnabled;
        suggestionToggle.addEventListener('change', (e) => {
            suggestionsEnabled = e.target.checked;
            const config = readSettingsConfig();
            config.xenon_suggestions = suggestionsEnabled;
            writeSettingsConfig(config);

            // Hide suggestions immediately if disabled
            if (!suggestionsEnabled) {
                const sugBox = document.getElementById('suggestionBox');
                if (sugBox) sugBox.style.display = 'none';
            }
        });
    }
});

// Suggestion input listener is defined above in the main script block.

// ── Buttons that must NOT close the keyboard ───────────────────────────
// Any <button data-keep-keyboard> can be tapped while typing in a text field
// (e.g. the Chart data box or the Xenon Graph equation box) without the
// field losing focus — so the keyboard stays up. Tapping a button normally
// moves focus onto it, which is what dropped the keyboard on the Reset
// buttons. Same recipe as the + button and the menu tiles: cancel
// mousedown/touchstart so focus never moves, then run the button's own
// onclick from touchend (touch) or the normal click (mouse). Because
// touchstart is cancelled, native :active never applies, so a .pressed
// class stands in for it.
(function initKeepKeyboardButtons() {
    document.querySelectorAll('[data-keep-keyboard]').forEach(function (btn) {
        let lastTouchTap = 0;
        // Only intercept when the keyboard is REALLY up. With the keyboard
        // down (even if a field still has a blinking caret) the button acts
        // like any normal tap — intercepting there kept focus in the field
        // and brought the keyboard back on a plain Reset tap.
        let keepKeyboard = false;

        btn.addEventListener('mousedown', function (e) { if (isKeyboardOpen()) e.preventDefault(); });

        btn.addEventListener('touchstart', function (e) {
            keepKeyboard = isKeyboardOpen();
            if (!keepKeyboard) return; // normal tap; native click follows
            e.preventDefault();
            btn.classList.add('pressed');
        }, { passive: false });

        btn.addEventListener('touchend', function (e) {
            if (!keepKeyboard) return;
            keepKeyboard = false;
            e.preventDefault();
            btn.classList.remove('pressed');
            // Only a tap if the finger lifted still on the button.
            const pt = e.changedTouches && e.changedTouches[0];
            const r = btn.getBoundingClientRect();
            if (pt && pt.clientX >= r.left && pt.clientX <= r.right && pt.clientY >= r.top && pt.clientY <= r.bottom) {
                lastTouchTap = performance.now();
                btn.click(); // runs the button's own onclick
            }
        }, { passive: false });

        btn.addEventListener('touchcancel', function () { keepKeyboard = false; btn.classList.remove('pressed'); });

        // If a WebView also delivers its own click after the touch, swallow
        // that duplicate (our synthetic .click() is untrusted, so it passes).
        btn.addEventListener('click', function (e) {
            if (e.isTrusted && performance.now() - lastTouchTap < 500) {
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }, true);
    });
})();
