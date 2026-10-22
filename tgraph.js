const tcanvas = document.getElementById('tgraphCanvas');
const teqInput = document.getElementById('tgraphEquation');
const tcoordDisplay = document.getElementById('tgraphCoords');
const ttimeDisplay = document.getElementById('tgraphTimeDisplay');

const SVG_NS = 'http://www.w3.org/2000/svg';

let tscale = 40;
let toffsetX = 0, toffsetY = 0;
let tViewInitialized = false;
let tisDragging = false;
let tlastMouseX, tlastMouseY;
let defaultScale = 40;

let tPendingDX = 0, tPendingDY = 0;
let tDragLoopId = null;

let tcachedCompiled = [];
let tcachedHash = '';
let tVisBounds = null;

let tNeedsRender = true;

let tDebounceTimer = null;
const DEBOUNCE_DELAY = 300;

let ttimeValue = 0;
let tisPlaying = true;
let ttimeSpeed = 0.02;
let ttimeDirection = 1;
let ttimeRange = 10;
let tanimationId = null;

let terrorCount = 0;
const MAX_ERRORS = 5;
let tisFrozen = false;
let tisRendering = false;
let tlastSuccessfulRender = 0;
const RENDER_TIMEOUT = 5000;

// ── Quality / performance knobs ──────────────────────────────────────────
// Curve quality is FIXED in screen pixels. It never drops while dragging or
// zooming (the old code coarsened the grid in both cases, which is what made
// circles look rough). Heavy scenes stay smooth because the finished curve
// geometry is cached and only *transformed* during interaction, then
// re-solved at full quality in small time-sliced chunks.
const T_RES = 2;                // marching-squares cell size in CSS px
const T_MAX_CELLS = 900000;     // safety cap per equation (res auto-relaxes past this)
const T_BUDGET_INTERACT = 7;    // ms of curve solving per frame while dragging/zooming
const T_BUDGET_IDLE = 12;       // ms of curve solving per frame otherwise

const graphColors = [
    "#4f87ff",
    "#ff5f5f",
    "#00e0a4",
    "#ffb84f",
    "#c77dff",
    "#00d4ff"
];


function getTGraphTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    return {
        isDark,
        bgColor:       isDark ? '#1c2436' : '#eef4fb',
        bgGradientEnd: isDark ? '#171a20' : '#dfe7f1',
        glowTop:    'rgba(0, 0, 0, 0)',
        glowBottom: 'rgba(0, 0, 0, 0)',
        vignetteDark: 'rgba(0, 0, 0, 0)',
        gridColor:      isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
        gridColorBold:  isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
        axisColor:      isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
        axisLabelColor: isDark ? '#b4b6ba' : '#94a3b8',
        arrowColor:     isDark ? '#84868c' : '#cbd5e1',
        coordColor:     isDark ? '#d0d2d6' : '#475569',
        pointInnerColor:isDark ? '#1c2436' : '#ffffff',
        frozenOverlay:  'rgba(255, 59, 48, 0.8)'
    };
}

let tSvgReady = false;
let tDefs, tBgRect, tGlowRect, tVignetteRect, tGridGroup, tAxisGroup, tCurvesGroup, tFrozenGroup;
let tGridPath, tAxisPath, tArrowGroup, tZeroLabel;
let tLabelXPool, tLabelYPool;
let tLastThemeDark = null;
let tGridSig = '';

function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

// Tiny element pool: re-uses <text> nodes frame to frame instead of
// destroying and re-creating dozens of them on every pan/zoom tick.
function tMakePool(group, tag, attrs) {
    return { group, tag, attrs, els: [], n: 0 };
}
function tPoolBegin(p) { p.n = 0; }
function tPoolGet(p) {
    let el = p.els[p.n];
    if (!el) {
        el = svgEl(p.tag, p.attrs);
        p.group.appendChild(el);
        p.els.push(el);
    }
    p.n++;
    return el;
}
function tPoolEnd(p) {
    while (p.els.length > p.n) p.group.removeChild(p.els.pop());
}

function buildSvgScaffold() {
    if (!tcanvas) return;
    while (tcanvas.firstChild) tcanvas.removeChild(tcanvas.firstChild);

    tcanvas.setAttribute('preserveAspectRatio', 'none');

    const isDarkScaffold = document.body.classList.contains('dark-mode');

    tDefs = svgEl('defs');

    const bgGrad = svgEl('linearGradient', { id: 'tgraphBgGrad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    bgGrad.appendChild(svgEl('stop', {
        offset: '0%',
        'stop-color': isDarkScaffold ? '#1c2436' : '#eef4fb',
        class: 'tgraph-bg-stop-a'
    }));
    bgGrad.appendChild(svgEl('stop', {
        offset: '100%',
        'stop-color': isDarkScaffold ? '#171a20' : '#dfe7f1',
        class: 'tgraph-bg-stop-b'
    }));

    const vigGrad = svgEl('radialGradient', { id: 'tgraphVignetteGrad', cx: '50%', cy: '50%' });
    vigGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': 'rgba(0,0,0,0)' }));
    vigGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0)', class: 'tgraph-vignette-stop' }));

    const glowGrad = svgEl('radialGradient', { id: 'tgraphGlowGrad', cx: '50%', cy: '18%', r: '85%' });
    glowGrad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': 'rgba(0,0,0,0)', class: 'tgraph-glow-stop-a' }));
    glowGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0)', class: 'tgraph-glow-stop-b' }));

    tDefs.appendChild(bgGrad);
    tDefs.appendChild(vigGrad);
    tDefs.appendChild(glowGrad);
    tcanvas.appendChild(tDefs);

    tBgRect = svgEl('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#tgraphBgGrad)' });
    tcanvas.appendChild(tBgRect);

    tGlowRect = svgEl('rect', {
        x: 0, y: 0, width: '100%', height: '100%',
        fill: 'url(#tgraphGlowGrad)',
        'pointer-events': 'none'
    });
    tcanvas.appendChild(tGlowRect);

    // Grid: one persistent path + pooled labels (no per-frame DOM churn)
    tGridGroup = svgEl('g', { class: 'tgraph-grid' });
    tGridPath = svgEl('path', { fill: 'none', 'stroke-width': 1 });
    tGridGroup.appendChild(tGridPath);
    tcanvas.appendChild(tGridGroup);

    tAxisGroup = svgEl('g', { class: 'tgraph-axis' });
    const lblBase = { 'font-size': String(10 * (window.xenonChartScale ? window.xenonChartScale() : 1)), 'font-family': '"Segoe UI", sans-serif' };
    const gx = svgEl('g'), gy = svgEl('g');
    tAxisGroup.appendChild(gx);
    tAxisGroup.appendChild(gy);
    tLabelXPool = tMakePool(gx, 'text', Object.assign({ 'text-anchor': 'middle' }, lblBase));
    tLabelYPool = tMakePool(gy, 'text', Object.assign({ 'text-anchor': 'start' }, lblBase));
    tZeroLabel = svgEl('text', Object.assign({ 'text-anchor': 'end' }, lblBase));
    tZeroLabel.textContent = '0';
    tAxisGroup.appendChild(tZeroLabel);
    tAxisPath = svgEl('path', { fill: 'none', 'stroke-width': 1.5 });
    tAxisGroup.appendChild(tAxisPath);
    tArrowGroup = svgEl('g');
    tAxisGroup.appendChild(tArrowGroup);
    tcanvas.appendChild(tAxisGroup);

    tCurvesGroup = svgEl('g', { class: 'tgraph-curves' });
    tcanvas.appendChild(tCurvesGroup);

    tVignetteRect = svgEl('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#tgraphVignetteGrad)', 'pointer-events': 'none' });
    tcanvas.appendChild(tVignetteRect);

    tFrozenGroup = svgEl('g', { style: 'display:none' });
    const frozenRect = svgEl('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: 'rgba(255,59,48,0.8)' });
    const frozenText = svgEl('text', { x: '50%', y: '50%', fill: '#ffffff', 'font-weight': 'bold', 'font-size': String(16 * (window.xenonChartScale ? window.xenonChartScale() : 1)), 'font-family': 'sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    frozenText.textContent = '⚠️ Auto-recovering...';
    tFrozenGroup.appendChild(frozenRect);
    tFrozenGroup.appendChild(frozenText);
    tcanvas.appendChild(tFrozenGroup);

    // Everything we had cached in the old DOM is gone — force a rebuild.
    tGridSig = '';
    tLastThemeDark = null;
    for (const c of tcachedCompiled) { c.el = null; c.elLine = null; c.elOuter = null; c.elInner = null; c.view = null; c.tf = null; c.sig = ''; }

    tSvgReady = true;
}
function tgraphInit() {
    if (!tcanvas) return;
    try {
        const modalEl = document.getElementById('tgraphModal');
        if (modalEl && !modalEl.classList.contains('active')) return;

        if (tanimationId) {
            cancelAnimationFrame(tanimationId);
            tanimationId = null;
        }
        if (tDragLoopId) {
            cancelAnimationFrame(tDragLoopId);
            tDragLoopId = null;
        }
        if (zoomId) {
            cancelAnimationFrame(zoomId);
            zoomId = null;
        }

        const { w, h } = captureDisplayDims();

        if (w <= 0 || h <= 0) return;

        tcanvas.style.position = 'absolute';
        tcanvas.style.top = '0';
        tcanvas.style.left = '0';
        tcanvas.style.width = w + 'px';
        tcanvas.style.height = h + 'px';
        tcanvas.style.maxWidth = 'none';
        tcanvas.style.maxHeight = 'none';
        tcanvas.setAttribute('viewBox', `0 0 ${w} ${h}`);
        tcanvas.setAttribute('width', w);
        tcanvas.setAttribute('height', h);
        tcanvas.style.display = 'block';

        if (!tSvgReady) buildSvgScaffold();

        if (!tViewInitialized) {
            toffsetX = w / 2;
            toffsetY = h / 2;
            tViewInitialized = true;
        }

        terrorCount = 0;
        tisFrozen = false;
        tisRendering = false;
        tNeedsRender = true;

        compileEquations();
        startAnimation();
        tgraphRender();
    } catch(e) {
        console.warn('Graph init error:', e);
        terrorCount++;
        if (terrorCount > MAX_ERRORS) {
            emergencyReset();
        }
    }
}

let tFrozenDims = null;

function measureLiveDims() {
    try {
        const c = tcanvas.parentElement;
        let w = c.clientWidth || 0;
        let h = c.clientHeight || 0;
        if (w <= 0 || h <= 0) {
            const rect = c.getBoundingClientRect();
            w = rect.width || 300;
            h = rect.height || 200;
        }
        return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
    } catch(e) {
        return { w: 300, h: 200 };
    }
}

function captureDisplayDims() {
    tFrozenDims = measureLiveDims();
    return tFrozenDims;
}

function getDisplayDims() {
    if (!tFrozenDims) return captureDisplayDims();
    return tFrozenDims;
}

const ttoX = (px) => (px - toffsetX) / tscale;
const ttoY = (py) => (toffsetY - py) / tscale;
const ttoPxX = (x) => toffsetX + x * tscale;
const ttoPxY = (y) => toffsetY - y * tscale;

function emergencyReset() {
    console.warn('Emergency reset triggered');

    if (tanimationId) {
        cancelAnimationFrame(tanimationId);
        tanimationId = null;
    }
    if (tDragLoopId) {
        cancelAnimationFrame(tDragLoopId);
        tDragLoopId = null;
    }
    if (zoomId) {
        cancelAnimationFrame(zoomId);
        zoomId = null;
    }

    if (tDebounceTimer) {
        clearTimeout(tDebounceTimer);
        tDebounceTimer = null;
    }

    if (tRenderLockTimer) {
        clearTimeout(tRenderLockTimer);
        tRenderLockTimer = null;
    }

    tisDragging = false;
    tisFrozen = false;
    tisRendering = false;
    terrorCount = 0;
    tisPlaying = true;
    ttimeValue = 0;
    tPendingDX = 0;
    tPendingDY = 0;
    zoomDir = 0;
    zoomVel = 0;
    tlastSuccessfulRender = Date.now();

    // Measure the panel fresh (not the cached size from whenever it was last
    // measured). With the keyboard up/down the panel is a different height
    // than it was at the last init, and centring on the stale size left the
    // origin far off-centre once tgraphInit() below re-measured.
    const { w, h } = captureDisplayDims();
    toffsetX = w / 2;
    toffsetY = h / 2;
    tscale = defaultScale;

    tcachedCompiled = [];
    tcachedHash = '';

    tSvgReady = false;

    try { tgraphInit(); } catch(e) {
        compileEquations();
        startAnimation();
        setTimeout(() => { try { tgraphRender(); } catch(e2) {} }, 100);
    }
}

// ═════════════════════════════════════════════════════════════════════════
//  EXPRESSION COMPILER
//  Turns user text into tight JS *loops* ("kernels") that fill a whole grid /
//  sample array in one call. No `with(Math)` (it de-optimises V8), no
//  per-point function call, no per-point try/catch.
// ═════════════════════════════════════════════════════════════════════════
const T_MATH_NAMES = ['abs','acos','acosh','asin','asinh','atan','atan2','atanh','cbrt','ceil','cos','cosh',
    'exp','expm1','floor','hypot','log','log10','log1p','log2','max','min','pow','round','sign','sin','sinh',
    'sqrt','tan','tanh','trunc','fround'];
const T_FN_CH = {};
T_MATH_NAMES.forEach((n, i) => { T_FN_CH[n] = String.fromCharCode(0xE000 + i); });
const T_FN_RE = new RegExp('(^|[^A-Za-z_.])(' +
    T_MATH_NAMES.slice().sort((a, b) => b.length - a.length).join('|') + ')(?=\\()', 'g');

function tCleanExpr(src) {
    let s = String(src)
        .replace(/\^/g, '**')
        .replace(/²/g, '**2').replace(/³/g, '**3')
        .replace(/⁴/g, '**4').replace(/⁵/g, '**5').replace(/⁶/g, '**6');

    // Protect function names (so "log10(", "atan2(", "asin(" survive the
    // implicit-multiplication rules below untouched).
    s = s.replace(T_FN_RE, (m, pre, name) => pre + T_FN_CH[name]);

    const FN = '\\uE000-\\uE0FF';
    s = s
        .replace(new RegExp('(\\d)([a-zA-Z(' + FN + '])', 'g'), '$1*$2')            // 2x  2(  2sin(
        .replace(/([a-zA-Z])(\d)/g, '$1*$2')                                         // x2
        .replace(new RegExp('([a-zA-Z])([' + FN + '])', 'g'), '$1*$2')               // xsin(
        .replace(new RegExp('\\)([a-zA-Z\\d(' + FN + '])', 'g'), ')*$1')             // )x  )2  )(  )sin(
        .replace(/(^|[^A-Za-z_])([xyt])\(/g, '$1$2*(')                               // x(
        .replace(/\b[xyt]{2,}\b/g, m => m.split('').join('*'));                      // xy

    // JS forbids "-x**2" (unary minus before **): make it -(x**2).
    const BASE = '(?:[A-Za-z_]\\w*|\\d+(?:\\.\\d+)?|[' + FN + ']\\([^()]*\\)|\\([^()]*\\))';
    s = s.replace(new RegExp('-(' + BASE + ')\\*\\*(-?' + BASE + ')', 'g'), '-($1**$2)');

    s = s.replace(/\bpi\b/gi, 'Math.PI').replace(/\be\b/gi, 'Math.E');
    s = s.replace(/[\uE000-\uE0FF]/g, ch => 'Math.' + T_MATH_NAMES[ch.charCodeAt(0) - 0xE000]);
    return s;
}

// "lhs = rhs"  →  "(lhs)-(rhs)"   (so x²+y²=9 works as well as x²+y²-9)
function tImplicitExpr(raw) {
    const idx = raw.indexOf('=');
    if (idx > 0 && raw.indexOf('=', idx + 1) === -1 && !/[<>!]/.test(raw[idx - 1])) {
        const lhs = raw.slice(0, idx).trim(), rhs = raw.slice(idx + 1).trim();
        if (lhs && rhs) return tCleanExpr('(' + lhs + ')-(' + rhs + ')');
        if (lhs) return tCleanExpr(lhs);
    }
    return tCleanExpr(raw);
}

function tBuildKernel(args, body) {
    const attempt = (withMath) => {
        try {
            const f = new Function(...args, withMath ? `with(Math){${body}}` : body);
            // smoke test — a ReferenceError (unknown identifier) lands in catch
            const o = new Float64Array(16);
            f.length === 8 ? f(o, 2, 2, 0, 0, 1, 1, 0) : f(o, 2, 0, 1, 0);
            return f;
        } catch (e) { return null; }
    };
    return attempt(false) || attempt(true);
}

// Fills gw×gh grid: value at (i,j) = f(x0 + i*dx, y0 - j*dy, t)
function tCompileImplicitKernel(expr) {
    return tBuildKernel(['_o', '_gw', '_gh', '_x0', '_y0', '_dx', '_dy', 't'],
        `for(let _j=0;_j<_gh;_j++){const y=_y0-_j*_dy;let _k=_j*_gw;` +
        `for(let _i=0;_i<_gw;_i++,_k++){const x=_x0+_i*_dx;const _v=(${expr});` +
        `_o[_k]=(_v-_v===0)?_v:NaN;}}`);
}

// Fills n samples: value at i = f(x0 + i*dx, t)
function tCompileExplicitKernel(expr, vertical) {
    const iv = vertical ? 'y' : 'x';   // x=f(y) curves are written in terms of y
    return tBuildKernel(['_o', '_n', '_x0', '_dx', 't'],
        `for(let _i=0;_i<_n;_i++){const ${iv}=_x0+_i*_dx;const _v=(${expr});` +
        `_o[_i]=(_v-_v===0)?_v:NaN;}`);
}

const tHasVar = (str, v) => new RegExp('(^|[^A-Za-z_])' + v + '(?![A-Za-z_])', 'i').test(str);

function classifyEquation(raw) {
    const eq = raw.trim();

    if (/\(-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\)/.test(eq)) return { kind: 'points', raw: eq };

    const eqIdx = eq.indexOf('=');
    if (eqIdx !== -1) {
        const lhs = eq.slice(0, eqIdx).trim();
        const rhs = eq.slice(eqIdx + 1).trim();
        if (/^y$/i.test(lhs) && !tHasVar(rhs, 'y')) return { kind: 'explicit', expr: rhs, raw: eq };
        if (/^x$/i.test(lhs) && !tHasVar(rhs, 'x')) return { kind: 'explicit_x', expr: rhs, raw: eq };
    } else {
        if (!tHasVar(eq, 'y')) return { kind: 'explicit', expr: eq, raw: eq };
    }

    return { kind: 'implicit', raw: eq };
}

function compileEquations() {
    try {
        const eqStr = teqInput.value;
        const hash = eqStr;
        if (hash === tcachedHash) return;

        tcachedHash = hash;
        const equations = eqStr.split(';').map(e => e.trim()).filter(e => e);

        tcachedCompiled = equations.map((eq, i) => {
            const color = graphColors[i % graphColors.length];
            const cls = classifyEquation(eq);
            const usesTime = tHasVar(eq, 't');
            const base = { color, usesTime, el: null, view: null, tf: null, d: '', tStamp: NaN, sig: '' };

            if (cls.kind === 'points') {
                const pts = [];
                const regex = /\((-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\)/g;
                let m;
                while ((m = regex.exec(eq)) !== null)
                    pts.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
                return Object.assign(base, { type: 'points', points: pts, usesTime: false });
            }

            if (cls.kind === 'explicit' || cls.kind === 'explicit_x') {
                const expr = tCleanExpr(cls.expr);
                return Object.assign(base, {
                    type: cls.kind, expr: cls.expr,
                    kernel: tCompileExplicitKernel(expr, cls.kind === 'explicit_x')
                });
            }

            return Object.assign(base, {
                type: 'implicit',
                kernel: tCompileImplicitKernel(tImplicitExpr(eq))
            });
        });

        if (tCurvesGroup) while (tCurvesGroup.firstChild) tCurvesGroup.removeChild(tCurvesGroup.firstChild);
        tNeedsRender = true;
        terrorCount = 0;
    } catch(e) {
        console.warn('Compile error:', e);
        terrorCount++;
        if (terrorCount > MAX_ERRORS) {
            emergencyReset();
        }
    }
}
function startAnimation() {
    if (tanimationId) {
        cancelAnimationFrame(tanimationId);
        tanimationId = null;
    }

    let lastFrameTime = performance.now();
    tlastSuccessfulRender = Date.now();

    function animate(currentTime) {
        if (Date.now() - tlastSuccessfulRender > RENDER_TIMEOUT && !tisFrozen) {
            console.warn('Render timeout detected');
            emergencyReset();
            return;
        }

        const deltaTime = currentTime - lastFrameTime;

        if (deltaTime > 2000) {
            lastFrameTime = currentTime;
            tanimationId = requestAnimationFrame(animate);
            return;
        }

        if (tisFrozen || tisRendering) {
            tanimationId = requestAnimationFrame(animate);
            return;
        }

        const hasActiveTime = tisPlaying && tcachedCompiled.some(c => c.usesTime);
        const isInteracting = tisDragging || zoomDir !== 0;
        if (!hasActiveTime && !isInteracting && !tNeedsRender) {
            tlastSuccessfulRender = Date.now();
            lastFrameTime = currentTime;
            tanimationId = requestAnimationFrame(animate);
            return;
        }

        try {
            if (hasActiveTime) {
                ttimeValue += ttimeSpeed * ttimeDirection;
                if (Math.abs(ttimeValue) > ttimeRange) {
                    ttimeValue = -ttimeRange * Math.sign(ttimeValue);
                }
            }

            tgraphRender();
            tlastSuccessfulRender = Date.now();
            updateTimeDisplay();

            lastFrameTime = currentTime;
            terrorCount = 0;

        } catch(e) {
            console.warn('Animation error:', e);
            terrorCount++;
            if (terrorCount > MAX_ERRORS) {
                emergencyReset();
                return;
            }
        }

        tanimationId = requestAnimationFrame(animate);
    }

    tanimationId = requestAnimationFrame(animate);
}

function stopAnimation() {
    if (tanimationId) {
        cancelAnimationFrame(tanimationId);
        tanimationId = null;
    }
    if (tDragLoopId) {
        cancelAnimationFrame(tDragLoopId);
        tDragLoopId = null;
    }
    if (zoomId) {
        cancelAnimationFrame(zoomId);
        zoomId = null;
    }
    tisDragging = false;
    zoomDir = 0;
    zoomVel = 0;
}
window.tgraphStopAnimation = stopAnimation;

function tgraphTogglePlay() {
    tisPlaying = !tisPlaying;
}

function tgraphSetSpeed(speed) {
    ttimeSpeed = Math.max(0.001, Math.min(0.5, speed));
}

function tgraphSetTimeRange(range) {
    ttimeRange = Math.max(1, Math.min(100, range));
}

function tgraphResetTime() {
    ttimeValue = 0;
    tcachedHash = '';
    compileEquations();
}

// ═════════════════════════════════════════════════════════════════════════
//  RENDER PIPELINE
//
//  • Each equation owns ONE persistent <path>. Its geometry ("d") is solved
//    for a region slightly LARGER than the viewport (padding P).
//  • While you drag/zoom, the solved geometry is simply re-positioned with an
//    SVG transform (vector-effect keeps strokes crisp) — zero re-solving, so
//    it stays smooth no matter how many curves there are.
//  • Curves that become stale (exposed an edge, zoomed a lot, time changed, or
//    interaction ended) are re-solved at FULL quality in small time-sliced
//    chunks, most-urgent first, so a heavy scene never blocks a frame.
// ═════════════════════════════════════════════════════════════════════════
function updateTimeDisplay() {
    if (!ttimeDisplay) return;
    try {
        const txt = `⏱ t = ${ttimeValue.toFixed(3)} ${tisPlaying ? '▶' : '⏸'}${tisFrozen ? ' ⚠️' : ''}`;
        if (txt !== updateTimeDisplay._last) {
            updateTimeDisplay._last = txt;
            ttimeDisplay.innerText = txt;
        }
        const col = getTGraphTheme().coordColor;
        if (col !== updateTimeDisplay._col) {
            updateTimeDisplay._col = col;
            ttimeDisplay.style.color = col;
        }
    } catch(e) {}
}

let tRenderLockTimer = null;
function armRenderLockWatchdog() {
    if (tRenderLockTimer) clearTimeout(tRenderLockTimer);
    tRenderLockTimer = setTimeout(() => {
        if (tisRendering) {
            console.warn('tgraph: tisRendering stuck — force-unlocking');
            tisRendering = false;
        }
        tRenderLockTimer = null;
    }, 500);
}

function tgraphRender() {
    if (tisRendering || tisFrozen) return;
    if (!tcanvas) return;
    if (!tSvgReady) buildSvgScaffold();

    tisRendering = true;
    armRenderLockWatchdog();

    try {
        const { w, h } = getDisplayDims();

        if (w <= 0 || h <= 0) {
            tisRendering = false;
            return;
        }

        const curVB = tcanvas.getAttribute('viewBox');
        const wantVB = `0 0 ${w} ${h}`;
        if (curVB !== wantVB) {
            tcanvas.setAttribute('viewBox', wantVB);
            tcanvas.setAttribute('width', w);
            tcanvas.setAttribute('height', h);
        }

        updateVisBounds(w, h);

        const theme = getTGraphTheme();
        if (theme.isDark !== tLastThemeDark) {
            tLastThemeDark = theme.isDark;
            applyTheme(theme);
        }

        drawGrid(theme, w, h);
        const pending = tSyncEquations(w, h, theme);
        updateCoordText(theme, w, h);

        // stay in the render loop until every curve has caught up with the view
        tNeedsRender = pending;

    } catch(e) {
        console.warn('Render error:', e);
        terrorCount++;
        if (terrorCount > MAX_ERRORS) {
            tisFrozen = true;
            drawFrozenOverlay();
            setTimeout(() => {
                emergencyReset();
            }, 2000);
        }
    } finally {
        tisRendering = false;
    }
}

function applyTheme(theme) {
    if (!tDefs) return;
    const stopA = tDefs.querySelector('.tgraph-bg-stop-a');
    const stopB = tDefs.querySelector('.tgraph-bg-stop-b');
    const vigStop = tDefs.querySelector('.tgraph-vignette-stop');
    const glowA = tDefs.querySelector('.tgraph-glow-stop-a');
    const glowB = tDefs.querySelector('.tgraph-glow-stop-b');
    if (stopA) stopA.setAttribute('stop-color', theme.bgColor);
    if (stopB) stopB.setAttribute('stop-color', theme.bgGradientEnd);
    if (vigStop) vigStop.setAttribute('stop-color', theme.vignetteDark);
    if (glowA) glowA.setAttribute('stop-color', theme.glowTop);
    if (glowB) glowB.setAttribute('stop-color', theme.glowBottom);
}

function drawFrozenOverlay() {
    if (!tFrozenGroup) return;
    try { tFrozenGroup.style.display = ''; } catch(e) {}
}

function updateVisBounds(w, h) {
    tVisBounds = {
        minX: ttoX(0),
        maxX: ttoX(w),
        minY: ttoY(h),
        maxY: ttoY(0),
        pixW: w,
        pixH: h
    };
}

// ── Grid / axes (pooled, and skipped entirely when nothing moved) ─────────
function tSetText(el, str, fill, x, y) {
    if (el._t !== str) { el._t = str; el.textContent = str; }
    if (el._f !== fill) { el._f = fill; el.setAttribute('fill', fill); }
    el.setAttribute('x', x);
    el.setAttribute('y', y);
}

function drawGrid(theme, w, h) {
    if (!tGridGroup || w <= 0 || h <= 0) return;

    const sig = tscale + '|' + toffsetX + '|' + toffsetY + '|' + w + '|' + h + '|' + theme.isDark;
    if (sig === tGridSig) return;
    tGridSig = sig;

    try {
        const TARGET_PX = 80;
        const rawInterval = TARGET_PX / tscale;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        const normalised = rawInterval / magnitude;
        let spacing;
        if      (normalised < 1.5) spacing = 1   * magnitude;
        else if (normalised < 3.5) spacing = 2   * magnitude;
        else if (normalised < 7.5) spacing = 5   * magnitude;
        else                       spacing = 10  * magnitude;

        let majorD = '';
        const majSX = Math.floor(tVisBounds.minX / spacing) * spacing;
        const majEX = Math.ceil(tVisBounds.maxX  / spacing) * spacing;
        for (let x = majSX; x <= majEX; x += spacing) {
            const px = ttoPxX(x);
            if (px >= -10 && px <= w + 10) majorD += `M${px.toFixed(2)},0V${h}`;
        }
        const majSY = Math.floor(tVisBounds.minY / spacing) * spacing;
        const majEY = Math.ceil(tVisBounds.maxY  / spacing) * spacing;
        for (let y = majSY; y <= majEY; y += spacing) {
            const py = ttoPxY(y);
            if (py >= -10 && py <= h + 10) majorD += `M0,${py.toFixed(2)}H${w}`;
        }
        tGridPath.setAttribute('d', majorD);
        tGridPath.setAttribute('stroke', theme.gridColorBold);

        const decimals = Math.max(0, -Math.floor(Math.log10(spacing)));
        const fmtLabel = (v) => parseFloat(v.toFixed(decimals + 1)).toString();

        const labelY = Math.min(Math.max(toffsetY + 4, 4), h - 14);
        tPoolBegin(tLabelXPool);
        for (let x = majSX; x <= majEX; x += spacing) {
            if (Math.abs(x) < spacing * 0.01) continue;
            const px = ttoPxX(x);
            if (px > 20 && px < w - 10) {
                tSetText(tPoolGet(tLabelXPool), fmtLabel(x), theme.axisLabelColor, px.toFixed(2), (labelY + 9).toFixed(2));
            }
        }
        tPoolEnd(tLabelXPool);

        const labelX = Math.min(Math.max(toffsetX + 4, 4), w - 30);
        tPoolBegin(tLabelYPool);
        for (let y = majSY; y <= majEY; y += spacing) {
            if (Math.abs(y) < spacing * 0.01) continue;
            const py = ttoPxY(y);
            if (py > 10 && py < h - 4) {
                tSetText(tPoolGet(tLabelYPool), fmtLabel(y), theme.axisLabelColor, labelX.toFixed(2), (py - 10 + 9).toFixed(2));
            }
        }
        tPoolEnd(tLabelYPool);

        tSetText(tZeroLabel, '0', theme.axisLabelColor, (toffsetX - 4).toFixed(2), (toffsetY + 4 + 9).toFixed(2));

        tAxisPath.setAttribute('d',
            `M${toffsetX.toFixed(2)},${(-10).toFixed(2)}V${(h + 10).toFixed(2)}` +
            `M${(-10).toFixed(2)},${toffsetY.toFixed(2)}H${(w + 10).toFixed(2)}`);
        tAxisPath.setAttribute('stroke', theme.axisColor);

        while (tArrowGroup.firstChild) tArrowGroup.removeChild(tArrowGroup.firstChild);
        drawAxisArrows(theme, w, h);
    } catch(e) {}
}

function arrowPath(x1, y1, xt, yt, x2, y2) {
    return `M${x1.toFixed(2)},${y1.toFixed(2)}L${xt.toFixed(2)},${yt.toFixed(2)}L${x2.toFixed(2)},${y2.toFixed(2)}`;
}

function drawAxisArrows(theme, w, h) {
    try {
        const as = 8, lo = 20;
        const G = tArrowGroup;
        const arrow = (d) => G.appendChild(svgEl('path', {
            d, stroke: theme.arrowColor, 'stroke-width': 2, fill: 'none',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
        const label = (txt, x, y, anchor, size) => {
            const t = svgEl('text', {
                x: x.toFixed(2), y: y.toFixed(2), fill: theme.axisLabelColor,
                'font-weight': 'bold', 'font-size': String((+size || 13) * (window.xenonChartScale ? window.xenonChartScale() : 1)), 'font-family': 'sans-serif', 'text-anchor': anchor
            });
            t.textContent = txt;
            G.appendChild(t);
        };

        if (toffsetX < w - lo && toffsetY > lo && toffsetY < h - lo) {
            const xr = Math.min(w - lo, toffsetX + 100 * tscale);
            arrow(arrowPath(xr - as, toffsetY - as/2, xr, toffsetY, xr - as, toffsetY + as/2));
            label('x', xr - as - 4, toffsetY - 6, 'middle');
        }
        if (toffsetX > lo && toffsetY > lo && toffsetY < h - lo) {
            const xl = Math.max(lo, toffsetX - 100 * tscale);
            arrow(arrowPath(xl + as, toffsetY - as/2, xl, toffsetY, xl + as, toffsetY + as/2));
            label('-x', xl + as + 4, toffsetY - 6, 'middle');
        }
        if (toffsetY > lo && toffsetX > lo && toffsetX < w - lo) {
            const yt = Math.max(lo, toffsetY - 100 * tscale);
            arrow(arrowPath(toffsetX - as/2, yt + as, toffsetX, yt, toffsetX + as/2, yt + as));
            label('y', toffsetX + 8 + 26 * (window.xenonChartScale ? window.xenonChartScale() : 1), yt + as + 4, 'start');
        }
        if (toffsetY < h - lo && toffsetX > lo && toffsetX < w - lo) {
            const yb = Math.min(h - lo, toffsetY + 100 * tscale);
            arrow(arrowPath(toffsetX - as/2, yb - as, toffsetX, yb, toffsetX + as/2, yb - as));
            label('-y', toffsetX + 8 + 26 * (window.xenonChartScale ? window.xenonChartScale() : 1), yb - as - 4, 'start');
        }
    } catch(e) {}
}

// ── Curve cache bookkeeping ───────────────────────────────────────────────
const tPad = (w, h) => Math.round(Math.min(120, Math.max(24, 0.25 * Math.min(w, h))));

function tEnsureEl(comp) {
    if (comp.type === 'points') {
        if (!comp.elLine) {
            comp.elLine  = svgEl('path', { fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '6,3', 'stroke-linecap': 'round', stroke: comp.color });
            comp.elOuter = svgEl('path', { fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', stroke: comp.color });
            comp.elInner = svgEl('path', { fill: 'none', 'stroke-width': 4, 'stroke-linecap': 'round' });
            tCurvesGroup.appendChild(comp.elLine);
            tCurvesGroup.appendChild(comp.elOuter);
            tCurvesGroup.appendChild(comp.elInner);
        }
    } else if (!comp.el) {
        comp.el = svgEl('path', {
            fill: 'none', stroke: comp.color,
            'stroke-width': comp.type === 'implicit' ? 1.8 : 2,
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            'vector-effect': 'non-scaling-stroke'
        });
        tCurvesGroup.appendChild(comp.el);
        comp.view = null;
        comp.tf = null;
    }
}

// 0 = fresh · 1 = soft (refine when idle) · 2 = hard (blank edge visible / never solved)
function tStaleness(comp, w, h, interacting) {
    const v = comp.view;
    if (!v || v.w !== w || v.h !== h) return 2;
    const k = tscale / v.s;
    const tx = toffsetX - k * v.ox, ty = toffsetY - k * v.oy;
    const P = v.P;
    const covered = (tx - k * P <= 0.5) && (k * (w + P) + tx >= w - 0.5) &&
                    (ty - k * P <= 0.5) && (k * (h + P) + ty >= h - 0.5);
    if (!covered) return 2;
    if (comp.usesTime && comp.tStamp !== ttimeValue) return 1;
    if (Math.abs(k - 1) < 1e-9 && Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01) return 0;
    if (interacting) return (k > 1.5 || k < 0.67) ? 1 : 0;
    return 1;
}

function tApplyTransform(comp, w, h) {
    const v = comp.view;
    if (!v) return;
    const k = tscale / v.s;
    const tx = toffsetX - k * v.ox, ty = toffsetY - k * v.oy;
    let tf = '';
    if (!(Math.abs(k - 1) < 1e-9 && Math.abs(tx) < 0.001 && Math.abs(ty) < 0.001)) {
        tf = `matrix(${k} 0 0 ${k} ${tx} ${ty})`;
    }
    if (tf !== comp.tf) {
        comp.tf = tf;
        if (tf) comp.el.setAttribute('transform', tf); else comp.el.removeAttribute('transform');
    }
}

let tRR = 0;   // round-robin cursor so no curve is starved under heavy load

function tSyncEquations(w, h, theme) {
    if (!tCurvesGroup) return false;
    const comps = tcachedCompiled;
    const interacting = tisDragging || zoomDir !== 0;
    const hard = [], soft = [];

    for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        tEnsureEl(comp);
        if (comp.type === 'points') { tDrawPoints(comp, w, h, theme); continue; }
        if (!comp.kernel) continue;
        const st = tStaleness(comp, w, h, interacting);
        if (st === 2) hard.push(comp); else if (st === 1) soft.push(comp);
    }

    const rot = (list) => {
        if (list.length < 2) return list;
        const r = tRR % list.length;
        return list.slice(r).concat(list.slice(0, r));
    };
    const todo = rot(hard).concat(rot(soft));

    const t0 = performance.now();
    const budget = interacting ? T_BUDGET_INTERACT : T_BUDGET_IDLE;
    let done = 0;
    for (; done < todo.length; done++) {
        if (done > 0 && performance.now() - t0 > budget) break;
        const comp = todo[done];
        try {
            if (comp.type === 'implicit')        comp.d = tSolveImplicit(comp, w, h);
            else if (comp.type === 'explicit')   comp.d = tSolveExplicit(comp, w, h, false);
            else                                 comp.d = tSolveExplicit(comp, w, h, true);
        } catch(e) { comp.d = ''; tAdj0.fill(-1); tAdj1.fill(-1); }
        comp.el.setAttribute('d', comp.d);
        comp.tStamp = ttimeValue;
    }
    tRR += done;

    for (let i = 0; i < comps.length; i++) {
        if (comps[i].type !== 'points') tApplyTransform(comps[i], w, h);
    }
    return done < todo.length;
}

// ── Points ────────────────────────────────────────────────────────────────
function tDrawPoints(comp, w, h, theme) {
    const sig = tscale + '|' + toffsetX + '|' + toffsetY + '|' + w + '|' + h + '|' + theme.isDark;
    if (comp.sig === sig) return;
    comp.sig = sig;
    try {
        const { points } = comp;
        if (!points || !points.length) return;

        let d = '';
        if (points.length > 1) {
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i], p2 = points[i + 1];
                const x1 = ttoPxX(p1.x), y1 = ttoPxY(p1.y), x2 = ttoPxX(p2.x), y2 = ttoPxY(p2.y);
                if ((x1<-50&&x2<-50)||(x1>w+50&&x2>w+50)||(y1<-50&&y2<-50)||(y1>h+50&&y2>h+50)) continue;
                d += `M${x1.toFixed(2)},${y1.toFixed(2)}L${x2.toFixed(2)},${y2.toFixed(2)}`;
            }
        }
        comp.elLine.setAttribute('d', d);

        // dots = zero-length round-capped segments (2 elements for ANY number of points)
        let dots = '';
        for (const p of points) {
            const px = ttoPxX(p.x), py = ttoPxY(p.y);
            if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
            dots += `M${px.toFixed(2)},${py.toFixed(2)}h.01`;
        }
        comp.elOuter.setAttribute('d', dots);
        comp.elInner.setAttribute('d', dots);
        comp.elInner.setAttribute('stroke', theme.pointInnerColor);
    } catch(e) {}
}

// ═════════════════════════════════════════════════════════════════════════
//  SOLVERS
// ═════════════════════════════════════════════════════════════════════════
const tr2 = (v) => Math.round(v * 100) / 100;

function tEstimateStepMultiplier(expr) {
    if (!expr) return 1;
    let maxCoef = 1;
    const re = /(\d+(?:\.\d+)?)\s*\*?\s*x\b/g;
    let m;
    while ((m = re.exec(expr)) !== null) {
        const c = parseFloat(m[1]);
        if (isFinite(c) && c > maxCoef) maxCoef = c;
    }
    return Math.min(Math.max(1, maxCoef / 4), 25);
}


// Lossless-to-the-eye polyline simplifier: drops a vertex only if every
// vertex it replaces lies within T_EPS (0.1 px) of the replacing chord.
// Greedy sliding window (capped, so cost stays O(n) overall).
const T_EPS = 0.1, T_WIN = 64;
function tPolyline(xs, ys, from, to) {
    let d = 'M' + tr2(xs[from]) + ',' + tr2(ys[from]);
    const eps2 = T_EPS * T_EPS;
    let a = from;
    while (a < to) {
        let j = a + 1;
        const lim = Math.min(to, a + T_WIN);
        const ax = xs[a], ay = ys[a];
        while (j < lim) {
            const c = j + 1;
            const dx = xs[c] - ax, dy = ys[c] - ay;
            const len2 = dx * dx + dy * dy;
            let ok = true;
            for (let k = a + 1; k <= j; k++) {
                const px = xs[k] - ax, py = ys[k] - ay;
                if (len2 < 1e-12) { if (px * px + py * py > eps2) { ok = false; break; } continue; }
                const cr = px * dy - py * dx;
                if (cr * cr > eps2 * len2) { ok = false; break; }
                const tt = (px * dx + py * dy) / len2;
                if (tt < -0.02 || tt > 1.02) { ok = false; break; }
            }
            if (!ok) break;
            j = c;
        }
        d += 'L' + tr2(xs[j]) + ',' + tr2(ys[j]);
        a = j;
    }
    return d;
}
let tPX = new Float64Array(4096), tPY = new Float64Array(4096);

// ── Explicit  y=f(x)  /  x=f(y)  ─────────────────────────────────────────
let tExBuf = new Float64Array(4096);
let tExRaw = new Float64Array(4096);

function tSolveExplicit(comp, w, h, vertical) {
    const s = tscale, ox = toffsetX, oy = toffsetY;
    const P = tPad(w, h);
    const span = (vertical ? h : w) + 2 * P;
    const stepMult = tEstimateStepMultiplier(comp.expr);
    const STEPS = Math.max(2, Math.min(Math.round((vertical ? h : w) * 2 * stepMult) + Math.round(P * 4), 20000));
    const dpx = span / STEPS;
    if (tExBuf.length < STEPS + 1) tExBuf = new Float64Array(STEPS + 1);
    const out = tExBuf;

    // independent variable runs along screen X (or Y when vertical)
    const start = -P;
    const x0 = vertical ? (oy - start) / s : (start - ox) / s;
    const dx = vertical ? -dpx / s : dpx / s;
    comp.kernel(out, STEPS + 1, x0, dx, ttimeValue);

    const CLIP_PX = (vertical ? w : h) * 50;
    const mid = (vertical ? w : h) / 2;

    // pass 1 — screen position of every sample (NaN = pen up: gap, pole, far off-screen)
    if (tExRaw.length < STEPS + 1) tExRaw = new Float64Array(STEPS + 1);
    const raw = tExRaw;
    let prev = 0, hasPrev = false;
    for (let i = 0; i <= STEPS; i++) {
        const val = out[i];
        if (val !== val) { raw[i] = NaN; hasPrev = false; continue; }
        const r = vertical ? ox + val * s : oy - val * s;

        let isPole = false;
        if (hasPrev) {
            const signFlip = (prev > 0 && val < 0) || (prev < 0 && val > 0);
            const blowsUp = Math.abs(prev) > 1e3 || Math.abs(val) > 1e3;
            if (signFlip && blowsUp) isPole = true;
        }
        prev = val; hasPrev = true;
        raw[i] = (isPole || Math.abs(r - mid) > CLIP_PX) ? NaN : r;
    }

    // pass 2 — emit the path. Samples can be far denser than a pixel (fast
    // oscillations); inside each half-pixel column we keep only first / min /
    // max / last, which preserves the exact visual envelope but cuts the
    // vertex count — and the browser's rasterising cost — dramatically.
    let d = '', pen = false;
    if (tPX.length < STEPS + 2) { tPX = new Float64Array(STEPS + 2); tPY = new Float64Array(STEPS + 2); }
    const PX = tPX, PY = tPY;
    let runStart = 0, cnt = 0;
    const endRun = () => {
        if (cnt - runStart >= 2) d += tPolyline(PX, PY, runStart, cnt - 1);
        runStart = cnt;
    };
    const emit = (i) => {
        const al = start + i * dpx;
        if (vertical) { PX[cnt] = raw[i]; PY[cnt] = al; } else { PX[cnt] = al; PY[cnt] = raw[i]; }
        cnt++;
        pen = true;
    };
    let bucket = -1, first = -1, last = -1, mn = -1, mx = -1;
    const flush = () => {
        if (first < 0) return;
        if (last - first < 4) {
            for (let i = first; i <= last; i++) emit(i);
        } else {
            let a = first, b = mn, c = mx, e = last, t;
            if (b > c) { t = b; b = c; c = t; }
            emit(a);
            if (b !== a) emit(b);
            if (c !== b && c !== a) emit(c);
            if (e !== c && e !== b && e !== a) emit(e);
        }
        first = -1;
    };
    for (let i = 0; i <= STEPS; i++) {
        const r = raw[i];
        if (r !== r) { flush(); endRun(); pen = false; bucket = -1; continue; }
        const bk = Math.floor(i * dpx * 2);
        if (bk !== bucket) { flush(); bucket = bk; }
        if (first < 0) { first = mn = mx = i; }
        else { if (r < raw[mn]) mn = i; if (r > raw[mx]) mx = i; }
        last = i;
    }
    flush();
    endRun();

    comp.view = { s, ox, oy, w, h, P };
    return d;
}

// ── Implicit  f(x,y)=0  —  marching squares with exact edge stitching ────
let tVals = new Float64Array(1);
let tSegA = new Int32Array(1), tSegB = new Int32Array(1);
let tAdj0 = new Int32Array(1), tAdj1 = new Int32Array(1);
let tVis = new Uint8Array(1);
let tChain = new Int32Array(1);

function tGrowInt32(arr, n) {
    const out = new Int32Array(n);
    out.set(arr);
    return out;
}

function tSolveImplicit(comp, w, h) {
    const s = tscale, ox = toffsetX, oy = toffsetY;
    const P = tPad(w, h);

    let res = T_RES;
    let gw = Math.ceil((w + 2 * P) / res) + 1;
    let gh = Math.ceil((h + 2 * P) / res) + 1;
    if (gw * gh > T_MAX_CELLS) {
        res *= Math.sqrt(gw * gh / T_MAX_CELLS);
        gw = Math.ceil((w + 2 * P) / res) + 1;
        gh = Math.ceil((h + 2 * P) / res) + 1;
    }
    const V = gw * gh;

    if (tVals.length < V) tVals = new Float64Array(V);
    if (tAdj0.length < 2 * V) {
        tAdj0 = new Int32Array(2 * V).fill(-1);
        tAdj1 = new Int32Array(2 * V).fill(-1);
    }
    if (tSegA.length < 4096) { tSegA = new Int32Array(4096); tSegB = new Int32Array(4096); }

    const vals = tVals, adj0 = tAdj0, adj1 = tAdj1;

    // 1) evaluate the whole grid in one compiled loop
    comp.kernel(vals, gw, gh, (-P - ox) / s, (oy + P) / s, res / s, res / s, ttimeValue);

    // 2) marching squares → segments between *edge ids* (no float keys, no Map)
    //    edge id = 2*vertex + 0 (edge to the right) | 2*vertex + 1 (edge below)
    let ns = 0;
    let segA = tSegA, segB = tSegB;

    for (let gj = 0; gj < gh - 1; gj++) {
        let k = gj * gw;
        for (let gi = 0; gi < gw - 1; gi++, k++) {
            const v1 = vals[k], v2 = vals[k + 1], v3 = vals[k + gw + 1], v4 = vals[k + gw];
            if (v1 !== v1 || v2 !== v2 || v3 !== v3 || v4 !== v4) continue;
            const c = (v1 > 0 ? 1 : 0) | (v2 > 0 ? 2 : 0) | (v3 > 0 ? 4 : 0) | (v4 > 0 ? 8 : 0);
            if (c === 0 || c === 15) continue;

            const eT = 2 * k, eR = 2 * (k + 1) + 1, eB = 2 * (k + gw), eL = 2 * k + 1;
            let a1, b1, a2 = -1, b2 = -1;
            switch (c) {
                case 1: case 14: a1 = eL; b1 = eT; break;
                case 2: case 13: a1 = eT; b1 = eR; break;
                case 3: case 12: a1 = eL; b1 = eR; break;
                case 4: case 11: a1 = eR; b1 = eB; break;
                case 6: case 9:  a1 = eT; b1 = eB; break;
                case 7: case 8:  a1 = eB; b1 = eL; break;
                default: { // 5 / 10 — saddle, resolved with the cell-centre value
                    const centre = (v1 + v2 + v3 + v4) * 0.25;
                    if ((centre > 0) === (v1 > 0)) { a1 = eT; b1 = eR; a2 = eB; b2 = eL; }
                    else                           { a1 = eT; b1 = eL; a2 = eR; b2 = eB; }
                }
            }
            if (ns + 2 > segA.length) {
                const n2 = segA.length * 2;
                tSegA = segA = tGrowInt32(segA, n2);
                tSegB = segB = tGrowInt32(segB, n2);
            }
            segA[ns] = a1; segB[ns] = b1;
            if (adj0[a1] < 0) adj0[a1] = ns; else adj1[a1] = ns;
            if (adj0[b1] < 0) adj0[b1] = ns; else adj1[b1] = ns;
            ns++;
            if (a2 >= 0) {
                segA[ns] = a2; segB[ns] = b2;
                if (adj0[a2] < 0) adj0[a2] = ns; else adj1[a2] = ns;
                if (adj0[b2] < 0) adj0[b2] = ns; else adj1[b2] = ns;
                ns++;
            }
        }
    }

    let d = '';
    if (ns > 0) {
        if (tVis.length < ns) tVis = new Uint8Array(ns * 2);
        if (tChain.length < 2 * ns + 4) tChain = new Int32Array(2 * ns + 8);
        const vis = tVis, chain = tChain;
        vis.fill(0, 0, ns);
        const mid = ns + 2;
        const baseP = -P;

        // edge id → point on the curve (linear interpolation along that grid edge)
        const edgeX = (e) => {
            const kk = e >> 1, i = kk % gw;
            const a = vals[kk];
            if (e & 1) return baseP + i * res;
            const b = vals[kk + 1];
            return baseP + (i + a / (a - b)) * res;
        };
        const edgeY = (e) => {
            const kk = e >> 1, j = (kk / gw) | 0;
            if (!(e & 1)) return baseP + j * res;
            const a = vals[kk], b = vals[kk + gw];
            return baseP + (j + a / (a - b)) * res;
        };

        // 3) stitch segments into polylines by walking shared edges (O(n))
        for (let sI = 0; sI < ns; sI++) {
            if (vis[sI]) continue;
            vis[sI] = 1;
            let head = mid, tail = mid + 1;
            chain[head] = segA[sI];
            chain[tail] = segB[sI];

            let closed = false;
            let e = segB[sI], cur = sI;
            for (;;) {
                const nx = adj0[e] === cur ? adj1[e] : adj0[e];
                if (nx < 0) break;
                if (vis[nx]) { if (nx === sI) closed = true; break; }
                vis[nx] = 1;
                e = segA[nx] === e ? segB[nx] : segA[nx];
                chain[++tail] = e;
                cur = nx;
            }
            if (closed) {
                tail--;                       // last edge == first edge
            } else {
                e = segA[sI]; cur = sI;
                for (;;) {
                    const nx = adj0[e] === cur ? adj1[e] : adj0[e];
                    if (nx < 0 || vis[nx]) break;
                    vis[nx] = 1;
                    e = segA[nx] === e ? segB[nx] : segA[nx];
                    chain[--head] = e;
                    cur = nx;
                }
            }

            const m = tail - head + 1;
            if (tPX.length < m + 1) { tPX = new Float64Array(m * 2); tPY = new Float64Array(m * 2); }
            for (let q = 0; q < m; q++) { const eid = chain[head + q]; tPX[q] = edgeX(eid); tPY[q] = edgeY(eid); }
            if (closed) { tPX[m] = tPX[0]; tPY[m] = tPY[0]; }   // simplify the loop as a closed polyline
            d += tPolyline(tPX, tPY, 0, closed ? m : m - 1);
            if (closed) d += 'Z';
        }

        // leave the shared adjacency table clean for the next equation
        for (let q = 0; q < ns; q++) {
            const a = segA[q], b = segB[q];
            adj0[a] = -1; adj1[a] = -1; adj0[b] = -1; adj1[b] = -1;
        }
    }

    comp.view = { s, ox, oy, w, h, P };
    return d;
}

let tLastCoordText = '';
function updateCoordText(theme, w, h) {
    if (!tcoordDisplay) return;
    try {
        const txt = `📍 (${((w/2-toffsetX)/tscale).toFixed(2)}, ${((toffsetY-h/2)/tscale).toFixed(2)})`;
        if (txt !== tLastCoordText) { tLastCoordText = txt; tcoordDisplay.innerText = txt; }
        if (tcoordDisplay._c !== theme.coordColor) { tcoordDisplay._c = theme.coordColor; tcoordDisplay.style.color = theme.coordColor; }
    } catch(e) {}
}

function tgraphStart(e) {
    if (e.target.closest('button')) return;
    tisDragging = true;
    const p = e.touches ? e.touches[0] : e;
    tlastMouseX = p.clientX;
    tlastMouseY = p.clientY;
    tPendingDX = 0; tPendingDY = 0;
    if (!tDragLoopId) tDragLoopId = requestAnimationFrame(dragLoop);
    e.preventDefault();
}

function tgraphMove(e) {
    if (!tisDragging) return;
    try {
        const p = e.touches ? e.touches[0] : e;
        tPendingDX += p.clientX - tlastMouseX;
        tPendingDY += p.clientY - tlastMouseY;
        tlastMouseX = p.clientX;
        tlastMouseY = p.clientY;
    } catch(e) {}
    if (e.cancelable) e.preventDefault();
}

function dragLoop() {
    if (!tisDragging) { tDragLoopId = null; return; }
    try {
        if (tPendingDX || tPendingDY) {
            toffsetX += tPendingDX;
            toffsetY += tPendingDY;
            tPendingDX = 0; tPendingDY = 0;
            tNeedsRender = true;
        }
    } catch(e) {
        terrorCount++;
        if (terrorCount > MAX_ERRORS) { emergencyReset(); return; }
    }
    tDragLoopId = requestAnimationFrame(dragLoop);
}

function tgraphStop() {
    if (tisDragging) {
        tisDragging = false;
        tNeedsRender = true;   // refine every curve at full quality now that we've stopped
        setTimeout(() => { try { tgraphRender(); } catch(e) {} }, 50);
    }
}

let zoomId = null, zoomDir = 0, zoomVel = 0;

function startZoomIn(e) { e.preventDefault(); zoomDir=1; zoomVel=1.02; if(!zoomId) zoomLoop(); }
function startZoomOut(e) { e.preventDefault(); zoomDir=-1; zoomVel=0.98; if(!zoomId) zoomLoop(); }
function stopZoom() { zoomDir=0; zoomVel=0; tNeedsRender = true; }

function zoomLoop() {
    if (!zoomDir) { zoomId=null; return; }
    try {
        zoomVel = zoomDir===1 ? Math.min(zoomVel*1.002, 1.15) : Math.max(zoomVel*0.998, 1/1.15);
        tgraphChangeZoom(zoomVel);
    } catch(e) {}
    zoomId = requestAnimationFrame(zoomLoop);
}

function tgraphChangeZoom(factor) {
    try {
        const {w,h} = getDisplayDims();
        const ns = tscale*factor;
        if (ns<defaultScale/16 || ns>defaultScale*16) return;
        const cx=(w/2-toffsetX)/tscale, cy=(toffsetY-h/2)/tscale;
        tscale=ns;
        toffsetX=w/2-cx*tscale; toffsetY=h/2+cy*tscale;
        tNeedsRender = true;
        if (!tanimationId) tgraphRender();
    } catch(e) {}
}

function tgraphResetView() {
    try {
        const {w,h}=getDisplayDims();
        toffsetX=w/2; toffsetY=h/2; tscale=defaultScale;
        tgraphRender();
    } catch(e) {}
}

function onEquationInput() {
    if (tDebounceTimer) clearTimeout(tDebounceTimer);
    tDebounceTimer = setTimeout(() => {
        try { compileEquations(); tgraphRender(); } catch(e) {}
    }, DEBOUNCE_DELAY);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (tDragLoopId) { cancelAnimationFrame(tDragLoopId); tDragLoopId = null; }
    } else {
        if (tisDragging && !tDragLoopId) tDragLoopId = requestAnimationFrame(dragLoop);
        try { tgraphRender(); } catch(e) {}
    }
});

// ── Keep the canvas matched to its panel ─────────────────────────────────
// The panel's HEIGHT changes whenever the on-screen keyboard opens or closes
// (and on rotation). This used to only react to width changes, so the canvas
// kept whatever height it was measured at — close the keyboard and the graph
// stayed cut off at the old, shorter height with blank space underneath.
// Now any change to the panel's size re-fits the canvas, and the point that
// was at the middle of the view stays at the middle (so the graph doesn't
// jump when the keyboard comes and goes). Uses its own timer so it never
// cancels a pending equation-typing render.
let tResizeTimer = null;
function tgraphSyncSize() {
    try {
        if (!tcanvas) return;
        const modalEl = document.getElementById('tgraphModal');
        if (!modalEl || !modalEl.classList.contains('active')) return;
        const panel = tcanvas.parentElement;
        if (!panel || panel.clientWidth <= 0 || panel.clientHeight <= 0) return;
        const old = tFrozenDims;
        if (!old) return; // first sizing is done by toggleTgraphModal() -> tgraphInit()
        const w = Math.max(1, Math.floor(panel.clientWidth));
        const h = Math.max(1, Math.floor(panel.clientHeight));
        if (w === old.w && h === old.h) return;
        if (tViewInitialized) {
            toffsetX += (w - old.w) / 2;
            toffsetY += (h - old.h) / 2;
        }
        tgraphInit(); // re-measures, resizes the SVG, redraws
    } catch (e) {}
}
function tgraphScheduleSync() {
    if (tResizeTimer) clearTimeout(tResizeTimer);
    tResizeTimer = setTimeout(tgraphSyncSize, 120);
}
if (tcanvas && tcanvas.parentElement && window.ResizeObserver) {
    new ResizeObserver(tgraphScheduleSync).observe(tcanvas.parentElement);
}
window.addEventListener('resize', tgraphScheduleSync); // fallback / rotation

if (teqInput) {
    teqInput.addEventListener('input', onEquationInput);
    teqInput.addEventListener('change', () => {
        if (tDebounceTimer) clearTimeout(tDebounceTimer);
        try { compileEquations(); tgraphRender(); } catch(e) {}
    });
}

document.addEventListener('keydown', (e) => {
    if (!tcanvas || document.activeElement !== teqInput) return;
    try {
        if (e.key==='+'||e.key==='=') startZoomIn(e);
        else if (e.key==='-') startZoomOut(e);
        else if (e.key==='0') tgraphResetView();
        else if (e.key===' ') { e.preventDefault(); tgraphTogglePlay(); }
        else if (e.key==='ArrowRight') { e.preventDefault(); tgraphSetSpeed(ttimeSpeed*1.5); }
        else if (e.key==='ArrowLeft') { e.preventDefault(); tgraphSetSpeed(ttimeSpeed/1.5); }
        else if (e.key==='r'||e.key==='R') { e.preventDefault(); tgraphResetTime(); }
    } catch(e) {}
});

document.addEventListener('keyup', (e) => {
    if (e.key==='+'||e.key==='='||e.key==='-') stopZoom();
});

let themeChangeTimeout = null;
const themeObserver = new MutationObserver(() => {
    if (themeChangeTimeout) clearTimeout(themeChangeTimeout);
    themeChangeTimeout = setTimeout(() => {
        try {
            const theme = getTGraphTheme();
            applyTheme(theme);
            tNeedsRender = true;
            tgraphRender();
        } catch(e) {
            emergencyReset();
        }
    }, 150);
});

const bodyElement = document.body;
if (bodyElement) {
    themeObserver.observe(bodyElement, {
        attributes: true,
        attributeFilter: ['class']
    });
}

(function initTgraphVisibilityWatchdog() {
    const modal = document.getElementById('tgraphModal');
    if (!modal) return;
    const modalObserver = new MutationObserver(() => {
        if (!modal.classList.contains('active')) {
            stopAnimation();
        }
    });
    modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
})();