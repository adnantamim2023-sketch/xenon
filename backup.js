// backup.js — full data export/import + storage info + factory reset
// (doc sections 23-25, 39-40). Bundles updates/model/memory/configuration
// (+conversations if requested) into Xenon-Backup.xbackup via the native
// bridge; a failed import leaves the existing installation untouched
// (validated entirely on the Kotlin side before anything is replaced).

function bridgeAvailable() {
    return typeof window !== 'undefined' && !!window.XenonStorage;
}

function nativeCall(method, ...args) {
    if (!bridgeAvailable()) return null;
    try {
        const parsed = JSON.parse(window.XenonStorage[method](...args));
        return (parsed && parsed.success !== false) ? parsed : null;
    } catch (e) {
        return null;
    }
}

// Re-hydrates every in-memory index/state from persistent storage — needed
// after an import or factory reset replaces the files out from under the
// already-loaded JS state (doc: REBUILD ACTIVE XENON STATE).
function rebuildActiveState() {
    // No-op: the knowledge-index and conversation-state modules this used
    // to rehydrate have been removed from the project.
}

// ---------- export ----------

function exportBackup(includeConversations) {
    const res = nativeCall('exportData', !!includeConversations);
    if (!res) throw new Error('Failed to export backup.');
    return res.path;
}

function shareBackup(path) {
    nativeCall('shareFile', path);
}

// ---------- import ----------

// base64Zip: a picked .xbackup file's content, base64-encoded.
function importBackup(base64Zip) {
    const res = nativeCall('importData', base64Zip);
    if (bridgeAvailable() && !res) throw new Error('Import failed — existing data was not touched.');
    rebuildActiveState();
    return true;
}

// ---------- storage info ----------

function getStorageInfo() {
    const res = nativeCall('getStorageInfo');
    return res ? res.storage : null;
}

function formatBytes(n) {
    if (!n) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

// ---------- factory reset ----------

function factoryReset() {
    const res = nativeCall('factoryReset');
    if (bridgeAvailable() && !res) throw new Error('Factory reset failed.');
    rebuildActiveState();
    return true;
}

// ---------- UI wiring ----------

function toggleBackupModal() {
    const modal = document.getElementById('backupModal');
    if (!modal) return;
    if (modal.classList.contains('active')) {
        modal.classList.add('closing');
        setTimeout(function () {
            modal.classList.remove('active');
            modal.classList.remove('closing');
        }, 220);
    } else {
        modal.classList.add('active');
        renderStorageInfo();
    }
}
// Return from Backup & Storage to Settings using the existing overlay history.
// This avoids closing the subpage directly and landing on the main screen.
function backFromBackupModal() {
    if (window.xenonOpenStack && window.xenonOpenStack.includes('backupModal')) {
        history.back();
        return;
    }

    // Fallback if Backup & Storage was opened outside the Settings flow.
    const modal = document.getElementById('backupModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('closing');
    }
}

function renderStorageInfo() {
    const info = getStorageInfo();
    const fallback = '—';

    function value(key) {
        return info && info[key] !== undefined ? formatBytes(info[key]) : fallback;
    }

    const total = info && info.total !== undefined ? Number(info.total) : 0;
    const parts = ['model', 'updates', 'memory', 'conversations', 'configuration', 'cache'];
    const known = parts.reduce(function(sum, key) {
        return sum + (info && info[key] !== undefined ? Number(info[key]) : 0);
    }, 0);
    const percent = total > 0 ? Math.max(3, Math.min(100, (known / total) * 100)) : 3;

    const totalEl = document.getElementById('storageTotalValue');
    if (totalEl) totalEl.textContent = value('total');

    ['model', 'updates', 'memory', 'conversations'].forEach(function(key) {
        const el = document.getElementById('storage' + key.charAt(0).toUpperCase() + key.slice(1) + 'Value');
        if (el) el.textContent = value(key);
    });

    const meter = document.getElementById('storageMeterFill');
    if (meter) meter.style.width = percent + '%';

    const breakdown = document.getElementById('storageBreakdown');
    if (breakdown && !info) {
        breakdown.innerHTML = '<div class="backup-unavailable">Storage details are currently unavailable.</div>';
    }
}

function showBackupMessage(text, isError) {
    const msgEl = document.getElementById('backupMessage');
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.whiteSpace = 'pre-line';
    msgEl.style.color = isError ? 'var(--red-cancel)' : 'var(--accent)';
    msgEl.style.display = 'block';
}

function handleExportBackup() {
    const includeConvos = !!document.getElementById('includeConversationsToggle')?.checked;
    try {
        const path = exportBackup(includeConvos);
        shareBackup(path);
        showBackupMessage('Backup exported.\n\n' + path, false);
    } catch (err) {
        showBackupMessage(err.message || 'Export failed.', true);
    }
}

function handleImportBackupFile(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
        try {
            const base64 = String(reader.result).split(',')[1] || '';
            importBackup(base64);
            showBackupMessage('Backup imported successfully. Restart Xenon to fully apply changes.', false);
            renderStorageInfo();
        } catch (err) {
            showBackupMessage(err.message || 'Invalid backup file.', true);
        }
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
}

function handleFactoryReset() {
    if (typeof window.showConfirm !== 'function') return;
    window.showConfirm(
        'Factory Reset?',
        'This permanently deletes all updates, model data, memory, and settings. This cannot be undone.',
        function () {
            try {
                factoryReset();
                showBackupMessage('Factory reset complete.', false);
                renderStorageInfo();
            } catch (err) {
                showBackupMessage(err.message || 'Factory reset failed.', true);
            }
        }
    );
}

window.addEventListener('DOMContentLoaded', function () {
    const exportBtn = document.getElementById('exportBackupBtn');
    if (exportBtn) exportBtn.addEventListener('click', handleExportBackup);
    const importInput = document.getElementById('importBackupInput');
    if (importInput) importInput.addEventListener('change', function () { handleImportBackupFile(importInput); });
    const resetBtn = document.getElementById('factoryResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', handleFactoryReset);
});

if (typeof window !== 'undefined') {
    window.toggleBackupModal = toggleBackupModal;
    window.backFromBackupModal = backFromBackupModal;
    window.exportBackup = exportBackup;
    window.importBackup = importBackup;
    window.getStorageInfo = getStorageInfo;
    window.factoryReset = factoryReset;
}
