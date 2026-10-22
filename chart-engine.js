/* UI scale factor = current root font size / 16. On phones this is 1; on large desktop screens
   (see desktop.css) it grows, and the chart/graph drawing scales with it. */
function xenonUiScale() {
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return (fs && isFinite(fs)) ? Math.max(1, fs / 16) : 1;
}
window.xenonUiScale = xenonUiScale;
/* Canvas/SVG text is tiny by design (9-10px) — on desktop give the drawings a bit extra boost. */
function xenonChartScale() { const s = xenonUiScale(); return s > 1 ? s * 1.3 : 1; }
window.xenonChartScale = xenonChartScale;

/* ============================================================
   XENON GRAPH GENERATOR  —  Advanced Statistical Chart Engine
   Replaces Chart.js with a fully custom canvas renderer.
   Features:
     • Auto-organizes scattered numbers into classes (frequency)
     • Six graph types: lined, attached bar, unattached bar, 
       unlife line, median, prime
     • Settings panel (gear icon) in the chart controls
     • Configurable: class size, X/Y unit boxes, graph title
     • Default corner: origin(-10,-10) — no negative axes rendered
     • //-  markers for skipped leading classes
     • ✨ Two-finger pinch with angle blending:
         - Horizontal fingers → class size
         - Vertical fingers → Y grid boxes
         - Diagonal → both blended proportionally
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   CHART PAN / ZOOM / PINCH ENGINE  —  mirrors tgraph.js mobility
   ══════════════════════════════════════════════════════════════ */
const GGView = {
    // pan offset in data-space units
    panX: 0,
    panY: 0,
    zoom: 1.0,
    minZoom: 0.4,
    maxZoom: 4.0,

    // drag state (1 finger)
    dragging: false,
    lastX: 0,
    lastY: 0,
    pendingDX: 0,
    pendingDY: 0,
    dragLoopId: null,

    // zoom loop state (button hold)
    zoomDir: 0,
    zoomVel: 0,
    zoomLoopId: null,

    // ✨ Pinch state (2 fingers) with angle blending
    pinching: false,
    pinchStartDist: 0,           // initial distance between fingers
    pinchStartAngle: 0,          // initial angle (0=horizontal, π/2=vertical)
    pinchStartClassSize: 10,     // classSize at pinch start
    pinchStartYUnits: 5,         // yUnits at pinch start
};

/* ── Coord display ── */
function ggUpdateCoordTag() {
    const el = document.getElementById('ggCoordTag');
    if (!el) return;
    el.textContent = `📐 CS:${GG.classSize} Y:${GG.yUnits}`;
}

/* ── Unified touch/mouse start — handles drag (1 finger) and pinch (2 fingers) ── */
function ggDragStart(e) {
    if (e.target.closest('button')) return;
    
    const touches = e.touches;
    
    // ── 2-finger pinch ──
    if (touches && touches.length === 2) {
        GGView.pinching = true;
        GGView.dragging = false;
        
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(Math.abs(dy), Math.abs(dx)); // 0 to π/2
        
        GGView.pinchStartDist = dist;
        GGView.pinchStartAngle = angle;
        GGView.pinchStartClassSize = GG.classSize;
        GGView.pinchStartYUnits = GG.yUnits;
        
        if (e.cancelable) e.preventDefault();
        return;
    }
    
    // ── 1-finger drag ──
    GGView.pinching = false;
    GGView.dragging = true;
    GGView.pendingDX = 0;
    GGView.pendingDY = 0;
    const p = touches ? touches[0] : e;
    GGView.lastX = p.clientX;
    GGView.lastY = p.clientY;
    if (!GGView.dragLoopId) GGView.dragLoopId = requestAnimationFrame(ggDragLoop);
    if (e.cancelable) e.preventDefault();
}

/* ── Unified move — handles drag and angle-based pinch ── */
function ggDragMove(e) {
    const touches = e.touches;
    
    // ── 2-finger pinch with angle blending ──
    if (GGView.pinching && touches && touches.length === 2) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(Math.abs(dy), Math.abs(dx)); // 0 to π/2
        
        if (GGView.pinchStartDist > 0) {
            const ratio = dist / GGView.pinchStartDist;
            
            // ── Angle-based blending ──
            // cos² gives horizontal weight, sin² gives vertical weight
            // angle = 0 (horizontal) → cos²=1, sin²=0 → only class size changes
            // angle = π/2 (vertical) → cos²=0, sin²=1 → only Y units change
            // angle = π/4 (diagonal) → cos²=0.5, sin²=0.5 → both change equally
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const hWeight = cosA * cosA;  // horizontal influence
            const vWeight = sinA * sinA;  // vertical influence
            
            // ── Horizontal component → class size ──
            // Inverted: spread fingers = larger class size (fewer bars)
            //           pinch together = smaller class size (more bars)
            if (hWeight > 0.01) {
                const hRatio = 1 + (ratio - 1) * hWeight;
                const newCS = Math.round(GGView.pinchStartClassSize / hRatio);
                GG.classSize = Math.max(1, Math.min(100, newCS));
            }
            
            // ── Vertical component → Y grid boxes ──
            // Spread fingers = more grid boxes (finer scale)
            // Pinch together = fewer grid boxes (coarser scale)
            if (vWeight > 0.01) {
                const vRatio = 1 + (ratio - 1) * vWeight;
                const newY = Math.round(GGView.pinchStartYUnits * vRatio);
                GG.yUnits = Math.max(1, Math.min(20, newY));
            }
        }
        
        // Update settings panel if open
        const csEl = document.getElementById('ggClassSizeVal');
        const yEl = document.getElementById('ggYUnitsVal');
        if (csEl) csEl.textContent = GG.classSize;
        if (yEl) yEl.textContent = GG.yUnits;
        
        // Re-render with new settings
        ggRender();
        ggUpdateCoordTag();
        
        if (e.cancelable) e.preventDefault();
        return;
    }
    
    // ── 1-finger drag ──
    if (!GGView.dragging) return;
    const p = touches ? touches[0] : e;
    GGView.pendingDX += p.clientX - GGView.lastX;
    GGView.pendingDY += p.clientY - GGView.lastY;
    GGView.lastX = p.clientX;
    GGView.lastY = p.clientY;
    if (e.cancelable) e.preventDefault();
}

/* ── Drag loop ── */
function ggDragLoop() {
    if (!GGView.dragging) { GGView.dragLoopId = null; return; }
    if (GGView.pendingDX || GGView.pendingDY) {
        GGView.panX += GGView.pendingDX;
        GGView.panY += GGView.pendingDY;
        GGView.pendingDX = 0;
        GGView.pendingDY = 0;
        ggApplyTransform();
        ggUpdateCoordTag();
    }
    GGView.dragLoopId = requestAnimationFrame(ggDragLoop);
}

/* ── Stop both drag and pinch ── */
function ggDragStop() {
    GGView.dragging = false;
    GGView.pinching = false;
}

/* ── Zoom handlers (button hold) ── */
function ggStartZoomIn(e) {
    e.preventDefault();
    GGView.zoomDir = 1; GGView.zoomVel = 1.02;
    if (!GGView.zoomLoopId) GGView.zoomLoopId = requestAnimationFrame(ggZoomLoop);
}
function ggStartZoomOut(e) {
    e.preventDefault();
    GGView.zoomDir = -1; GGView.zoomVel = 0.98;
    if (!GGView.zoomLoopId) GGView.zoomLoopId = requestAnimationFrame(ggZoomLoop);
}
function ggStopZoom() {
    GGView.zoomDir = 0; GGView.zoomVel = 0;
}

function ggZoomLoop() {
    if (!GGView.zoomDir) { GGView.zoomLoopId = null; return; }
    GGView.zoomVel = GGView.zoomDir === 1
        ? Math.min(GGView.zoomVel * 1.002, 1.12)
        : Math.max(GGView.zoomVel * 0.998, 1 / 1.12);
    const newZ = GGView.zoom * GGView.zoomVel;
    GGView.zoom = Math.max(GGView.minZoom, Math.min(GGView.maxZoom, newZ));
    ggApplyTransform();
    ggUpdateCoordTag();
    GGView.zoomLoopId = requestAnimationFrame(ggZoomLoop);
}

/* ── Mouse-wheel zoom ── */
function ggWheelZoom(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    GGView.zoom = Math.max(GGView.minZoom, Math.min(GGView.maxZoom, GGView.zoom * delta));
    ggApplyTransform();
    ggUpdateCoordTag();
}

/* ── Apply CSS transform to canvas (zoom from centre + pan) ── */
function ggApplyTransform() {
    const canvas = document.getElementById('tChart');
    if (!canvas) return;
    canvas.style.transformOrigin = 'center center';
    canvas.style.transform = `translate(${GGView.panX}px, ${GGView.panY}px) scale(${GGView.zoom})`;
}

/* ── Reset to default view ── */
function ggResetView() {
    GGView.panX = 0;
    GGView.panY = 0;
    GGView.zoom = 1.0;
    GGView.pinching = false;
    GG.classSize = 10;
    GG.yUnits = 5;
    ggApplyTransform();
    ggUpdateCoordTag();
    ggRender();
}

/* ── Wire wheel event after DOM ready ── */
(function initGGViewport() {
    function setup() {
        const vp = document.getElementById('ggViewport');
        if (!vp) return;
        vp.addEventListener('wheel', ggWheelZoom, { passive: false });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();

/* ──────────────────────── Fuzzy Match (kept from original) ──────────────────────── */
function isFuzzyMatch(input, pattern, threshold = 0.7) {
    const s1 = input.toLowerCase(), s2 = pattern.toLowerCase();
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i++) track[0][i] = i;
    for (let j = 0; j <= s2.length; j++) track[j][0] = j;
    for (let j = 1; j <= s2.length; j++) {
        for (let i = 1; i <= s1.length; i++) {
            const ind = s1[i-1] === s2[j-1] ? 0 : 1;
            track[j][i] = Math.min(track[j][i-1]+1, track[j-1][i]+1, track[j-1][i-1]+ind);
        }
    }
    const distance = track[s2.length][s1.length];
    return 1 - distance / Math.max(s1.length, s2.length) >= threshold;
}

/* ──────────────────────── Click-outside menu close (kept) ──────────────────────── */
window.addEventListener('click', (e) => {
    const menu = document.querySelector('.input-menu');
    const toggleBtn = document.querySelector('.toggle-icon');
    if (menu && menu.classList.contains('show') && !menu.classList.contains('closing') &&
        !menu.contains(e.target) && !toggleBtn.contains(e.target)) {
        if (typeof _fingerPrime === 'function') _fingerPrime();
        menu.classList.add('closing');
        toggleBtn.classList.remove('active');
        setTimeout(() => { menu.classList.remove('show'); menu.classList.remove('closing'); }, 300);
    }
});

/* ──────────────────────── Math Brain (kept) ──────────────────────── */
(function() {
    window.ap_term = (a,d,n) => a+(n-1)*d;
    window.ap_sum  = (a,d,n) => (n/2)*(2*a+(n-1)*d);
    window.gp_term = (a,r,n) => a*Math.pow(r,n-1);
    window.gp_sum  = (a,r,n) => r===1 ? a*n : a*(Math.pow(r,n)-1)/(r-1);
    window.factorial = n => n<=1 ? 1 : n*window.factorial(n-1);
    window.sum = (expr,start,end) => {
        let t=0;
        for (let i=parseInt(start);i<=parseInt(end);i++) t+=eval(expr.replace(/\bx\b/g,`(${i})`));
        return t;
    };
    window.solvePoly = str => {
        let eq=str.replace(/=0/g,'').replace(/\s+/g,'');
        let a=0,b=0,c=0,d=0;
        const terms=eq.match(/[+-]?[^+-]+/g)||[];
        terms.forEach(t=>{
            if(t.includes('**3')) a+=parseFloat(t.replace('x**3','')||(t.startsWith('-')?-1:1));
            else if(t.includes('**2')) b+=parseFloat(t.replace('x**2','')||(t.startsWith('-')?-1:1));
            else if(t.includes('x')) c+=parseFloat(t.replace('x','')||(t.startsWith('-')?-1:1));
            else d+=parseFloat(t);
        });
        if(a!==0) return `x ≈ ${(d/-a)**(1/3)} (Cubic approx)`;
        if(b!==0){let disc=c*c-4*b*d;if(disc<0)return"No real roots";let x1=(-c+Math.sqrt(disc))/(2*b),x2=(-c-Math.sqrt(disc))/(2*b);return x1===x2?`x = ${x1}`:`x₁ = ${x1.toFixed(4)}, x₂ = ${x2.toFixed(4)}`;}
        return c!==0?`x = ${-d/c}`:"Result: "+d;
    };
})();

/* ══════════════════════════════════════════════════════════════
   GRAPH GENERATOR STATE
   ══════════════════════════════════════════════════════════════ */
const GG = {
    // user-facing settings
    graphType:  'attachedBar',   // attachedBar | unattachedBar | lined | cumulative | median | mode
    classSize:  10,              // ✨ grouping interval (adjustable by horizontal pinch)
    xUnits:     5,               // how many grid boxes on X axis
    yUnits:     5,               // ✨ how many grid boxes on Y axis (adjustable by vertical pinch)
    barWidthPct: 80,             // bar fill % within its natural slot
    barMinPx:   0,               // minimum bar width in px (0 = auto/natural)
    rawInput:   '',
    title:      '',

    // computed
    classes:    [],              // [{label, start, end, freq}]
    data:       [],              // raw numbers sorted
    minVal:     0,
    maxVal:     0,

    // canvas context
    canvas:     null,
    ctx:        null,
    tooltip:    null,

    // settings panel open?
    settingsOpen: false,
};

/* ──────────────── DATA ORGANISATION ──────────────────────── */
function ggOrganize() {
    const raw = GG.rawInput.replace(/[^0-9.\-,\s]/g, '');
    const nums = raw.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) { GG.classes = []; GG.data = []; return; }

    GG.data = [...nums].sort((a,b) => a-b);
    GG.minVal = GG.data[0];
    GG.maxVal = GG.data[GG.data.length-1];

    const cs = Math.max(1, GG.classSize);
    // Start of first class (floor to nearest class boundary at or below min)
    const firstStart = Math.floor(GG.minVal / cs) * cs;

    GG.classes = [];
    for (let s = firstStart; s <= GG.maxVal; s += cs) {
        const e = s + cs;
        const freq = GG.data.filter(v => v >= s && v < e).length;
        GG.classes.push({ start: s, end: e, label: `${s}–${e}`, freq });
    }
    // Handle edge: last value == maxVal exactly (belongs in last class)
    if (GG.data[GG.data.length-1] === GG.maxVal) {
        const last = GG.classes[GG.classes.length-1];
        if (last && GG.maxVal >= last.end) {
            last.freq++;
        }
    }
}

/* ──────────────── THEME ──────────────────────────────────── */
function ggTheme() {
    const dark = document.body.classList.contains('dark-mode');
    return {
        // Matches the graph engine's background (getTGraphTheme in tgraph.js)
        // instead of a flat black/white fill.
        bgColor:      dark ? '#0d1117' : '#f8fafc',
        bgGradientEnd:dark ? '#161b22' : '#e2e8f0',
        grid:     dark ? '#1f1f1f' : '#e2e8f0',
        axis:     dark ? '#444'    : '#94a3b8',
        text:     dark ? '#e2e2e2' : '#1e293b',
        accent:   '#3b82f6',
        bar:      dark ? 'rgba(59,130,246,0.7)'  : 'rgba(59,130,246,0.6)',
        barStroke:dark ? 'rgba(96,165,250,1)'    : 'rgba(37,99,235,1)',
        median:   '#f59e0b',
        mode:     '#10b981',
        skip:     dark ? '#555' : '#aaa',
    };
}

/* ──────────────── HELPERS ────────────────────────────────── */
function ggMode() {
    if (!GG.classes.length) return null;
    const maxFreq = Math.max(...GG.classes.map(c => c.freq));
    if (maxFreq === 0) return null;
    return GG.classes.filter(c => c.freq === maxFreq);
}

function ggMedian() {
    if (!GG.data.length) return null;
    const m = Math.floor(GG.data.length / 2);
    return GG.data.length % 2 === 0 ? (GG.data[m-1]+GG.data[m])/2 : GG.data[m];
}

/* ──────────────── CANVAS SETUP ──────────────────────────── */
function ggSetupCanvas() {
    const canvas = document.getElementById('tChart');
    if (!canvas) return false;
    GG.canvas = canvas;
    GG.ctx = canvas.getContext('2d');
    GG.tooltip = document.getElementById('chartTooltip');
    const cont = canvas.parentElement;
    const viewW = cont.clientWidth  || cont.offsetWidth  || 300;
    const viewH = cont.clientHeight || cont.offsetHeight || 250;

    const UIS = xenonChartScale();
    const PAD_L = 52 * UIS, PAD_R = 20 * UIS;
    const numSlots = GG.classes.length || 1;
    const naturalSlotW = (viewW - PAD_L - PAD_R) / numSlots;
    const slotW = GG.barMinPx > 0 ? Math.max(naturalSlotW, GG.barMinPx / UIS) : naturalSlotW;
    const neededW = PAD_L + PAD_R + slotW * numSlots;

    const cssW = Math.max(viewW, neededW);
    const cssH = viewH;

    // Remember the panel size this render was drawn for, so the resize
    // watcher below can tell when the panel has since changed.
    GG.viewW = viewW;
    GG.viewH = viewH;

    // ── Hi-DPI rendering ──────────────────────────────────────────────
    // Previously the backing store was sized in CSS pixels and the browser
    // upscaled it to the physical panel on high-DPI displays — that's what
    // made bars, text, and grid lines look soft / pixelated. Size the
    // backing store by devicePixelRatio, then draw with a matching ctx
    // transform so the existing layout math (which works in CSS pixels)
    // still lines up but every stroke/text/rect lands on a real device pixel.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    GG.dpr  = dpr;
    GG.cssW = cssW;
    GG.cssH = cssH;

    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // CSS (styles.css: `.chart-canvas { width: 100% !important; height: 100% !important; }`)
    // still forces the display box to cssW × cssH CSS px, so the browser
    // downsamples the dpr-scaled backing store instead of upscaling a 1x image.
    return true;
}
/* ══════════════════════════════════════════════════════════════
   RENDER  — main draw function
   ══════════════════════════════════════════════════════════════ */
function ggRender() {
    if (!ggSetupCanvas()) return;
    ggOrganize();

    const ggCanvas = document.getElementById('tChart');
    if (ggCanvas) ggCanvas.style.transform = 'none';

    const {ctx, canvas} = GG;
    // Layout math below works in CSS pixels; the ctx transform scales
    // drawing up to the dpr-sized backing store automatically.
    // Draw in a "virtual" space that is UIS times smaller than the panel, then scale it up with the
    // transform — fonts, paddings and line widths all grow together on big screens.
    const UIS = xenonChartScale();
    GG.uis = UIS;
    const W = GG.cssW / UIS;
    const H = GG.cssH / UIS;
    const T = ggTheme();

    ctx.setTransform(GG.dpr * UIS, 0, 0, GG.dpr * UIS, 0, 0);
    ctx.clearRect(0, 0, W + 1, H + 1);

    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, T.bgColor);
    bgGrad.addColorStop(1, T.bgGradientEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (!GG.classes.length) {
        ctx.fillStyle = T.text;
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Enter numbers above to generate graph', W/2, H/2);
        ggApplyTransform();
        ggUpdateCoordTag();
        return;
    }

    const PAD = { top: 38, right: 20, bottom: 52, left: 52 };
    const gW = W - PAD.left - PAD.right;
    const gH = H - PAD.top  - PAD.bottom;

    const type    = GG.graphType;
    const total   = GG.data.length;
    const maxFreq = Math.max(...GG.classes.map(c => c.freq), 1);

    // ── Y-axis nice scale using yUnits ──
    const yScaleMax = type === 'cumulative' ? total : maxFreq;
    const yUnits = Math.max(1, GG.yUnits || 5);
    const yStep = Math.ceil(yScaleMax / yUnits) || 1;
    const yMax  = yStep * yUnits;

    // ── X slots ──
    const classes = GG.classes;
    const firstNonZero = classes.findIndex(c => c.freq > 0);
    const showSkip = firstNonZero > 0;

    const displayClasses = showSkip ? classes.slice(firstNonZero) : classes;
    const totalSlots = displayClasses.length + (showSkip ? 1 : 0);
    const naturalSlotW = gW / Math.max(totalSlots, 1);
    const slotW = GG.barMinPx > 0 ? Math.max(naturalSlotW, GG.barMinPx / UIS) : naturalSlotW;

    // ── Draw title ──
    if (GG.title) {
        ctx.fillStyle = T.text;
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(GG.title, W/2, 16);
    }

    // ── Draw Y grid + labels ──
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= yUnits; i++) {
        const val = i * yStep;
        const y = PAD.top + gH - (val / yMax) * gH;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + gW, y);
        ctx.stroke();
        ctx.fillStyle = T.text;
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val, PAD.left - 6, y + 3.5);
    }

    // ── Draw X grid lines ──
    const xUnits = Math.max(1, GG.xUnits || 5);
    const xGridStep = gW / xUnits;
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= xUnits; i++) {
        const x = PAD.left + i * xGridStep;
        ctx.beginPath();
        ctx.moveTo(x, PAD.top);
        ctx.lineTo(x, PAD.top + gH);
        ctx.stroke();
    }

    // ── Draw axes ──
    ctx.strokeStyle = T.axis;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + gH);
    ctx.lineTo(PAD.left + gW, PAD.top + gH);
    ctx.stroke();

    // ── Draw //-  skip marker if needed ──
    if (showSkip) {
        const sx = PAD.left + slotW * 0.5;
        const sy = PAD.top + gH;
        ctx.fillStyle = T.skip;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('//-', sx, sy + 16);
        ctx.strokeStyle = T.skip;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const zx = PAD.left + slotW * 0 + 2;
        ctx.moveTo(zx, sy - 8);
        ctx.lineTo(zx + slotW * 0.4, sy - 2);
        ctx.lineTo(zx, sy + 4);
        ctx.stroke();
    }

    // ── Draw each class bar / line point ──
    const medVal = ggMedian();
    const points = [];
    const attached = type === 'attachedBar';
    const fillRatio = Math.max(0.1, Math.min(1, GG.barWidthPct / 100));
    const barGap = attached
        ? slotW * (1 - fillRatio) / 2
        : Math.max(slotW * (1 - fillRatio) / 2, slotW * 0.08);

    displayClasses.forEach((cls, i) => {
        const slotIdx = i + (showSkip ? 1 : 0);
        const slotX = PAD.left + slotW * slotIdx;
        const barH = (cls.freq / yMax) * gH;
        const barY = PAD.top + gH - barH;
        const cx = slotX + slotW / 2;

        // X label (class range)
        ctx.fillStyle = T.text;
        ctx.font = '9px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cls.label, cx, PAD.top + gH + 13);

        const modalClasses = ggMode() || [];
        const freqIsMode = modalClasses.some(mc => mc.start === cls.start);
        const inMedianClass = medVal !== null && medVal >= cls.start && medVal < cls.end;

        let fillColor = T.bar;
        if (type === 'mode'   && freqIsMode)    fillColor = T.mode;
        if (type === 'median' && inMedianClass)  fillColor = T.median;

        if (type === 'attachedBar' || type === 'unattachedBar') {
            const bx = slotX + barGap;
            const bw = slotW - barGap * 2;
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur  = 4;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = fillColor;
            ctx.fillRect(bx, barY, bw, barH);
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.strokeStyle = T.barStroke;
            ctx.lineWidth = 0.8;
            ctx.strokeRect(bx, barY, bw, barH);
            if (cls.freq > 0) {
                ctx.fillStyle = T.text;
                ctx.font = 'bold 9px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(cls.freq, cx, barY - 4);
            }
        }

        if (type === 'mode') {
            const bx = slotX + barGap;
            const bw = slotW - barGap * 2;
            ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
            ctx.fillStyle = fillColor;
            ctx.fillRect(bx, barY, bw, barH);
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.strokeStyle = freqIsMode ? T.mode : T.barStroke;
            ctx.lineWidth = freqIsMode ? 2 : 0.8;
            ctx.strokeRect(bx, barY, bw, barH);
            if (cls.freq > 0) {
                ctx.fillStyle = freqIsMode ? T.mode : T.text;
                ctx.font = freqIsMode ? 'bold 9px "Segoe UI", sans-serif' : '9px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(freqIsMode ? `Mo:${cls.freq}` : cls.freq, cx, barY - 4);
            }
            if (freqIsMode && barH > 0) {
                ctx.strokeStyle = T.mode;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3,3]);
                ctx.beginPath();
                ctx.moveTo(cx, PAD.top);
                ctx.lineTo(cx, barY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        if (type === 'median') {
            const bx = slotX + barGap;
            const bw = slotW - barGap * 2;
            ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
            ctx.fillStyle = fillColor;
            ctx.fillRect(bx, barY, bw, barH);
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.strokeStyle = inMedianClass ? T.median : T.barStroke;
            ctx.lineWidth = inMedianClass ? 2 : 0.8;
            ctx.strokeRect(bx, barY, bw, barH);
            if (cls.freq > 0) {
                ctx.fillStyle = inMedianClass ? T.median : T.text;
                ctx.font = 'bold 9px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(inMedianClass ? `M:${cls.freq}` : cls.freq, cx, barY - 4);
            }
            if (inMedianClass && barH > 0) {
                ctx.strokeStyle = T.median;
                ctx.lineWidth = 2;
                ctx.setLineDash([4,3]);
                ctx.beginPath();
                ctx.moveTo(cx, PAD.top);
                ctx.lineTo(cx, PAD.top + gH);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = T.median;
                ctx.font = 'bold 9px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Md=${medVal}`, cx, PAD.top - 5);
            }
        }

        // Collect points for line types
        if (type === 'lined') {
            points.push({ x: cx, y: barY, freq: cls.freq, label: cls.label });
        }
    });

    // ── Build cumulative points ──
    if (type === 'cumulative') {
        let cumFreq = 0;
        displayClasses.forEach((cls, i) => {
            cumFreq += cls.freq;
            const slotIdx = i + (showSkip ? 1 : 0);
            const slotX = PAD.left + slotW * slotIdx;
            const cx = slotX + slotW / 2;
            const cumY = PAD.top + gH - (cumFreq / yMax) * gH;
            points.push({ x: cx, y: cumY, cumFreq, freq: cls.freq, label: cls.label });
        });
    }

    // ── Draw line / cumulative chart types ──
    if ((type === 'lined' || type === 'cumulative') && points.length > 0) {
        const lineGrad = ctx.createLinearGradient(PAD.left, 0, PAD.left + gW, 0);
        lineGrad.addColorStop(0, 'rgba(59,130,246,0.8)');
        lineGrad.addColorStop(1, 'rgba(96,165,250,1)');

        if (type === 'lined') {
            const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + gH);
            grad.addColorStop(0, 'rgba(59,130,246,0.35)');
            grad.addColorStop(1, 'rgba(59,130,246,0.04)');
            ctx.beginPath();
            ctx.moveTo(points[0].x, PAD.top + gH);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length-1].x, PAD.top + gH);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }

        if (type === 'cumulative') {
            const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + gH);
            grad.addColorStop(0, 'rgba(99,179,237,0.3)');
            grad.addColorStop(1, 'rgba(59,130,246,0.04)');
            ctx.beginPath();
            ctx.moveTo(points[0].x, PAD.top + gH);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length-1].x, PAD.top + gH);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();

        points.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(59,130,246,0.15)'; ctx.fill();
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(59,130,246,1)'; ctx.fill();
            ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2);
            ctx.fillStyle = T.bgColor; ctx.fill();
            const label = type === 'cumulative' ? p.cumFreq : p.freq;
            if (label > 0) {
                ctx.fillStyle = T.text;
                ctx.font = 'bold 9px "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(label, p.x, p.y - 12);
            }
        });
        GG._linePoints = points;
    } else {
        GG._linePoints = null;
    }

    // ── Y-axis label ──
    ctx.save();
    ctx.translate(13, PAD.top + gH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = T.text;
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(type === 'cumulative' ? 'Cumulative Freq.' : 'Frequency', 0, 0);
    ctx.restore();

    // Reapply the pan/zoom CSS transform after drawing
    ggApplyTransform();
    ggUpdateCoordTag();
}
/* ══════════════════════════════════════════════════════════════
   SETTINGS MODAL
   ══════════════════════════════════════════════════════════════ */
const GG_TYPES = [
    { val:'attachedBar',   label:'Attached Bar', icon:'▮▮' },
    { val:'unattachedBar', label:'Detached Bar',  icon:'▯ ▯' },
    { val:'lined',         label:'Area Line',     icon:'∿' },
    { val:'cumulative',    label:'Cumulative',    icon:'∑' },
    { val:'median',        label:'Median',        icon:'⊕' },
    { val:'mode',          label:'Mode',          icon:'◉' },
];

function ggBuildSettingsBody() {
    const body = document.getElementById('ggSettingsBody');
    if (!body) return;
    body.innerHTML = `
      <div class="gg-settings-inner">
        <div class="gg-col-left">
          <div class="gg-setting-row gg-order-first">
            <label class="gg-section-label">Graph Type</label>
            <div class="gg-type-grid">
              ${GG_TYPES.map(t => `
                <button class="gg-type-btn${GG.graphType===t.val?' active':''}" onclick="ggSetType('${t.val}')">
                  <span class="gg-type-icon">${t.icon}</span>
                  <span class="gg-type-label">${t.label}</span>
                </button>`).join('')}
            </div>
          </div>
          <div class="gg-divider gg-order-last"></div>
          <div class="gg-setting-row gg-order-last">
            <label class="gg-section-label">Bar Width</label>
            <div class="gg-slider-row">
              <span class="gg-slider-label">Fill %</span>
              <input type="range" min="10" max="100" value="${GG.barWidthPct}" class="gg-slider"
                oninput="GG.barWidthPct=+this.value; document.getElementById('ggBarPctVal').textContent=this.value+'%'; ggRender()">
              <span class="gg-slider-val" id="ggBarPctVal">${GG.barWidthPct}%</span>
            </div>
            <div class="gg-slider-row" style="margin-top:6px;">
              <span class="gg-slider-label">Min px <span style="font-size:0.5625rem;opacity:0.6;">(expands)</span></span>
              <input type="range" min="0" max="120" step="4" value="${GG.barMinPx}" class="gg-slider"
                oninput="GG.barMinPx=+this.value; document.getElementById('ggBarMinVal').textContent=this.value>0?this.value+'px':'auto'; ggRender()">
              <span class="gg-slider-val" id="ggBarMinVal">${GG.barMinPx > 0 ? GG.barMinPx+'px' : 'auto'}</span>
            </div>
            <p class="gg-slider-hint">Pinch: ↔ class size | ↕ Y grid | diagonal = blend</p>
          </div>
        </div>
        <div class="gg-divider gg-col-divider"></div>
        <div class="gg-col-right">
          <div class="gg-setting-row gg-row-inline">
            <label>Class Size</label>
            <div class="gg-number-ctrl">
              <button onclick="ggAdjust('classSize',-1)">−</button>
              <span id="ggClassSizeVal">${GG.classSize}</span>
              <button onclick="ggAdjust('classSize',1)">+</button>
            </div>
          </div>
          <div class="gg-setting-row gg-row-inline">
            <label>Y Grid Boxes</label>
            <div class="gg-number-ctrl">
              <button onclick="ggAdjust('yUnits',-1)">−</button>
              <span id="ggYUnitsVal">${GG.yUnits}</span>
              <button onclick="ggAdjust('yUnits',1)">+</button>
            </div>
          </div>
          <div class="gg-divider"></div>
          <div class="gg-setting-row gg-row-inline">
            <label>Title</label>
            <input id="ggTitleInput" class="gg-title-input" value="${GG.title}" placeholder="Graph title…" oninput="GG.title=this.value;ggRender()">
          </div>
        </div>
      </div>`;
}

function ggSetType(val) {
    GG.graphType = val;
    ggBuildSettingsBody();
    ggRender();
}

function ggAdjust(key, delta) {
    const min = { classSize:1, yUnits:1 }[key] || 1;
    const max = { classSize:100, yUnits:20 }[key] || 20;
    GG[key] = Math.min(max, Math.max(min, GG[key] + delta));
    const idMap = { classSize:'ggClassSizeVal', yUnits:'ggYUnitsVal' };
    const el = document.getElementById(idMap[key]);
    if (el) el.textContent = GG[key];
    ggRender();
}

function ggOpenSettingsModal() {
    const modal = document.getElementById('ggSettingsModal');
    const btn   = document.getElementById('ggSettingsBtn');
    if (!modal) return;
    ggBuildSettingsBody();
    modal.classList.add('active');
    if (btn) btn.classList.add('active');
}

function ggCloseSettingsModal() {
    const modal = document.getElementById('ggSettingsModal');
    const btn   = document.getElementById('ggSettingsBtn');
    if (!modal) return;
    modal.classList.add('closing');
    if (btn) btn.classList.remove('active');
    setTimeout(() => {
        modal.classList.remove('active');
        modal.classList.remove('closing');
    }, 220);
}

/* ══════════════════════════════════════════════════════════════
   PUBLIC API  —  called by index.html / chat.js
   ══════════════════════════════════════════════════════════════ */

function updateGraph() {
    const dataEl = document.getElementById('gData');
    if (dataEl) GG.rawInput = dataEl.value;
    ggRender();
}

// Debounced entry point for the #gData input's oninput handler.
// ggRender() -> ggSetupCanvas() reads clientWidth/clientHeight (forces a
// layout reflow) and reassigns canvas.width/height (reallocates the canvas
// backing store) on every call. Without debouncing, that full reflow+redraw
// ran on every single keystroke, which is exactly the kind of synchronous
// work that turns janky right when the soft keyboard is animating open or
// closed. This mirrors the debounce pattern already used for the Xenon
// Graph Pro equation input in tgraph.js.
let ggInputDebounceTimer = null;
const GG_INPUT_DEBOUNCE_DELAY = 300;
function updateGraphDebounced() {
    if (ggInputDebounceTimer) clearTimeout(ggInputDebounceTimer);
    ggInputDebounceTimer = setTimeout(updateGraph, GG_INPUT_DEBOUNCE_DELAY);
}

// ── Re-render when the panel changes size ───────────────────────────────
// The chart is drawn to a bitmap sized for the panel at render time, and CSS
// then forces that bitmap to fill the panel. When the panel's height changes
// afterwards (keyboard opening/closing, rotation) with no re-render, the old
// bitmap gets stretched to the new size. This redraws it for the new size.
(function initChartResizeSync() {
    let timer = null;
    function sync() {
        const modal = document.getElementById('graphModal');
        if (!modal || !modal.classList.contains('active')) return;
        const canvas = document.getElementById('tChart');
        const panel = canvas && canvas.parentElement;
        if (!panel || panel.clientWidth <= 0 || panel.clientHeight <= 0) return;
        if (panel.clientWidth === GG.viewW && panel.clientHeight === GG.viewH) return; // already matches
        ggRender();
    }
    function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(sync, 120);
    }
    function setup() {
        const canvas = document.getElementById('tChart');
        if (canvas && canvas.parentElement && window.ResizeObserver) {
            new ResizeObserver(schedule).observe(canvas.parentElement);
        }
        window.addEventListener('resize', schedule);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();

// Tooltip hover for line types
(function initTooltipHover() {
    function setup() {
        const canvas  = document.getElementById('tChart');
        const tooltip = document.getElementById('chartTooltip');
        if (!canvas || !tooltip) return;

        function showTip(canvasX, canvasY) {
            const k = GG.uis || 1;
            canvasX /= k; canvasY /= k;          // points are stored in virtual (scaled) units
            if (!GG._linePoints) { tooltip.classList.remove('visible'); return; }
            let hit=null, minD=Infinity;
            GG._linePoints.forEach(p => {
                const d = Math.hypot(canvasX-p.x, canvasY-p.y);
                if (d < 28 && d < minD) { minD=d; hit=p; }
            });
            if (hit) {
                tooltip.textContent = `${hit.label}: ${hit.freq}`;
                // hit.x / hit.y are already in CSS pixels (the same space
                // ggRender draws in) and the tooltip is positioned inside
                // the same viewport, so no DPR conversion is needed.
                tooltip.style.left = (hit.x * k) + 'px';
                tooltip.style.top  = (hit.y * k) + 'px';
                tooltip.classList.add('visible');
            } else { tooltip.classList.remove('visible'); }
        }

        function xy(e) {
            // Convert mouse/touch to CSS-pixel space relative to the canvas —
            // the same space the drawing code uses. No DPR scaling needed.
            const r = canvas.getBoundingClientRect();
            const s = e.touches ? e.touches[0] : e;
            return [s.clientX - r.left, s.clientY - r.top];
        }

        canvas.addEventListener('mousemove', e => { const [x,y]=xy(e); showTip(x,y); });
        canvas.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
        canvas.addEventListener('touchmove', e => { const [x,y]=xy(e); showTip(x,y); }, {passive:true});
        canvas.addEventListener('touchend', () => tooltip.classList.remove('visible'));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();
/* ──────────────── Kept for compatibility with chat.js ──────────────── */
function selectChartTab(el, type) {
    const map = { bar:'attachedBar', line:'lined', area:'lined', doughnut:'attachedBar', ogive:'cumulative', prime:'mode' };
    GG.graphType = map[type] || type;
    document.getElementById('gType').value = type;
    updateGraph();
}
