// ── Long-press menu for user messages ───────────────────────────────
// Long-pressing a message you sent (".message.user") pops a small menu
// right at the touch/click point with three actions:
//   • Copy         — copies the message text to the clipboard
//   • Select Text  — hands the bubble back to native text selection so
//                    you can drag-select part of it
//   • Edit         — turns the bubble into an editable textarea; saving
//                    truncates everything after it and re-runs the
//                    command as a new turn.
//
// User-message text is user-select:none by default (see styles2.css)
// so a long-press reliably opens *our* menu instead of the OS selection
// callout. "Select Text" is the escape hatch back into native selection.

(function () {
    const LONG_PRESS_MS = 500;
    const MOVE_CANCEL_PX = 10;

    let pressTimer = null;
    let startX = 0, startY = 0;
    let pressTarget = null;
    let menuEl = null;

    function clearTimer() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        pressTarget = null;
    }

    function closeMenu() {
        if (menuEl) {
            menuEl.remove();
            menuEl = null;
        }
        document.removeEventListener('touchstart', onOutsideInteraction, true);
        document.removeEventListener('mousedown', onOutsideInteraction, true);
        document.removeEventListener('scroll', closeMenu, true);
    }

    function onOutsideInteraction(e) {
        if (menuEl && !menuEl.contains(e.target)) closeMenu();
    }

    function getMsgIndex(bubbleEl) {
        const container = bubbleEl.closest('.message-container');
        return container ? parseInt(container.dataset.msgIndex, 10) : -1;
    }

    function flash(el) {
        el.classList.add('copy-flash');
        setTimeout(() => el.classList.remove('copy-flash'), 200);
        if (navigator.vibrate) navigator.vibrate(15);
    }

    function copyBubbleText(bubbleEl, i) {
        const text = sessions[currentIdx].messages[i].text;
        const finish = () => flash(bubbleEl);
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

    function enableSelectText(bubbleEl, i) {
        // Selecting inside the bubble itself needed a programmatic
        // pre-selection, and Android only shows its native Copy/Share/
        // Select-all toolbar on the user's *first* touch-driven
        // selection — a selection that already exists needs an extra
        // tap before the toolbar appears. Opening the text on its own
        // plain page means the long-press that starts the selection is
        // a fresh gesture, so the toolbar shows up immediately.
        const msg = sessions[currentIdx].messages[i];
        openSelectTextModal(msg.text);
    }

    function startEdit(bubbleEl, i) {
        const container = bubbleEl.closest('.message-container');
        if (!container) return;
        const session = sessions[currentIdx];
        const msg = session.messages[i];
        const originalText = msg.text;

        bubbleEl.classList.add('editing');
        bubbleEl.innerHTML = `
            <textarea class="edit-textarea">${escapeHTML(originalText)}</textarea>
            <div class="edit-actions">
                <button type="button" class="edit-cancel-btn">Cancel</button>
                <button type="button" class="edit-save-btn">Save &amp; Submit</button>
            </div>`;

        const textarea = bubbleEl.querySelector('.edit-textarea');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
        textarea.dispatchEvent(new Event('input'));

        bubbleEl.querySelector('.edit-cancel-btn').addEventListener('click', () => {
            renderChat();
        });

        bubbleEl.querySelector('.edit-save-btn').addEventListener('click', () => {
            const newText = textarea.value.trim();
            if (!newText) return;
            saveEditedMessage(i, newText);
        });
    }

    function saveEditedMessage(i, newText) {
        const session = sessions[currentIdx];

        // Leave the original message (and everything else) exactly as it
        // was — the edit becomes a brand new turn appended to the end of
        // the conversation, not a replacement in place.
        const newUserMsg = { role: 'user', text: newText, time: now() };
        session.messages.push(newUserMsg);

        saveData();
        renderChat();
        forceScrollToBottom();

        runToolAndAppendReply(newText);
    }

    function positionMenu(bubbleEl, x, y) {
        const margin = 8;
        const rightMargin = 16;
        const gap = 10;
        const bubbleRect = bubbleEl.getBoundingClientRect();

        // Keep the menu clear of Xenon's own top nav bar and the bottom
        // input bar — measure the real elements rather than guessing at
        // heights, so this stays correct even if those bars resize
        // (keyboard open, safe-area insets, etc).
        const navEl = document.querySelector('.nav-container');
        const inputEl = document.querySelector('.input-container');
        const navBottom = navEl ? navEl.getBoundingClientRect().bottom : 0;
        const inputTop = inputEl ? inputEl.getBoundingClientRect().top : window.innerHeight;

        const topBound = navBottom + margin;
        const bottomBound = inputTop - margin;

        // If the menu is taller than the space we actually have between
        // those bounds, cap its height and let it scroll internally
        // instead of overflowing off-screen or under a bar.
        const availableHeight = bottomBound - topBound;
        menuEl.style.maxHeight = availableHeight > 0 ? `${availableHeight}px` : '';
        menuEl.style.overflowY = 'auto';

        const menuRect = menuEl.getBoundingClientRect();

        // Right-align the menu to the bubble's right edge, hovering just
        // above it — matching the native app's popover placement.
        let left = bubbleRect.right - menuRect.width;
        let top = bubbleRect.top - menuRect.height - gap;

        if (top < topBound) top = bubbleRect.bottom + gap; // flip below if no room above
        top = Math.max(topBound, Math.min(top, bottomBound - menuRect.height));
        left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - rightMargin));

        menuEl.style.left = `${left}px`;
        menuEl.style.top = `${top}px`;
    }

    function openMenu(bubbleEl, x, y) {
        closeMenu();
        const i = getMsgIndex(bubbleEl);
        if (i < 0) return;

        const msg = sessions[currentIdx].messages[i];

        menuEl = document.createElement('div');
        menuEl.className = 'msg-context-menu';
        menuEl.innerHTML = `
            <div class="msg-context-menu-time">${msg.time || ''}</div>
            <button type="button" data-action="copy">
                <span>Copy message</span>
                <span class="icon icon-copy"></span>
            </button>
            <button type="button" data-action="select">
                <span>Select text</span>
                <span class="icon icon-select"></span>
            </button>
            <button type="button" data-action="edit">
                <span>Edit</span>
                <span class="icon icon-edit"></span>
            </button>`;
        document.body.appendChild(menuEl);
        positionMenu(bubbleEl, x, y);

        menuEl.querySelector('[data-action="copy"]').addEventListener('click', () => {
            copyBubbleText(bubbleEl, i);
            closeMenu();
        });
        menuEl.querySelector('[data-action="select"]').addEventListener('click', () => {
            closeMenu();
            enableSelectText(bubbleEl, i);
        });
        menuEl.querySelector('[data-action="edit"]').addEventListener('click', () => {
            closeMenu();
            startEdit(bubbleEl, i);
        });

        // Delay attaching outside-close listeners so the opening tap/click
        // doesn't immediately close the menu it just opened.
        setTimeout(() => {
            document.addEventListener('touchstart', onOutsideInteraction, true);
            document.addEventListener('mousedown', onOutsideInteraction, true);
            document.addEventListener('scroll', closeMenu, true);
        }, 0);
    }

    function onPressStart(target, x, y) {
        const bubbleEl = target.closest('.message.user');
        if (!bubbleEl || bubbleEl.classList.contains('editing')) return;
        startX = x; startY = y;
        clearTimer(); // cancel any previous pending press first...
        pressTarget = bubbleEl; // ...then set the new target so it isn't wiped out
        pressTimer = setTimeout(() => {
            const t = pressTarget;
            clearTimer();
            if (t) openMenu(t, x, y);
        }, LONG_PRESS_MS);
    }

    function onPressMove(x, y) {
        if (!pressTimer) return;
        if (Math.abs(x - startX) > MOVE_CANCEL_PX || Math.abs(y - startY) > MOVE_CANCEL_PX) {
            clearTimer();
        }
    }

    const feed = document.getElementById('chatFeed');
    if (!feed) return;

    feed.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        onPressStart(e.target, t.clientX, t.clientY);
    }, { passive: true });
    feed.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        onPressMove(t.clientX, t.clientY);
    }, { passive: true });
    feed.addEventListener('touchend', clearTimer);
    feed.addEventListener('touchcancel', clearTimer);

    feed.addEventListener('mousedown', (e) => onPressStart(e.target, e.clientX, e.clientY));
    feed.addEventListener('mousemove', (e) => onPressMove(e.clientX, e.clientY));
    feed.addEventListener('mouseup', clearTimer);
    feed.addEventListener('mouseleave', clearTimer);

    // Block the native context menu on user bubbles so it never fights
    // with our custom one — but not while the bubble is in "select
    // text" mode, since that's when the OS's own selection UI (and
    // its Copy toolbar, on browsers that support it) needs to work.
    feed.addEventListener('contextmenu', (e) => {
        const bubble = e.target.closest('.message.user');
        if (bubble && !bubble.classList.contains('selecting')) e.preventDefault();
    });
})();
