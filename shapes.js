// ── Geometric shape drawer ──────────────────────────────────────────
// Commands:
//   /triangle3(a):4(b):5(c)   → triangle with side a=BC, b=CA, c=AB
//   /square5                  → square, all four sides = 5
//   /box6:4  or  /box6(w):4(h) → rectangle, width:height
//   /circle5                  → circle, radius 5
//
// Side-naming convention for the triangle (matches standard geometry
// notation): side a is opposite vertex A (i.e. BC), side b is opposite
// vertex B (i.e. CA), side c is opposite vertex C (i.e. AB).
//
// Output is a self-contained inline SVG. The word-reveal animation in
// chat2.js explicitly skips <svg> subtrees, so these diagrams render in
// full immediately rather than trying to fade in vertex-by-vertex.

const SHAPE_SVG_SIZE = 240;      // square viewBox, px
const SHAPE_PAD = 42;            // padding inside viewBox for labels — kept
                                  // generous so label text has clear room
                                  // and never sits on top of the shape's
                                  // own outline

function shapeNumLetterPairs(str) {
    // Matches "3(a)", "4.5(b)", etc. — a number optionally tagged with a
    // letter in parentheses. Letters are optional so plain "/box6:4"
    // (no tags) still works positionally.
    const out = [];
    const re = /(\d+(?:\.\d+)?)(?:\(([a-zA-Z]+)\))?/g;
    let m;
    while ((m = re.exec(str)) !== null) {
        out.push({ value: parseFloat(m[1]), letter: m[2] ? m[2].toLowerCase() : null });
    }
    return out;
}

function shapeWrap(innerSVG, viewSize = SHAPE_SVG_SIZE) {
    return `<div class="xetex-shape-wrap"><svg class="xetex-shape-svg" viewBox="0 0 ${viewSize} ${viewSize}" xmlns="http://www.w3.org/2000/svg">${innerSVG}</svg></div>`;
}

function shapeError(msg) {
    return `<div class="xetex-shape-error">${msg}</div>`;
}

// ── Triangle ─────────────────────────────────────────────────────────
function buildTriangleSVG(text) {
    const pairs = shapeNumLetterPairs(text);
    const bySide = {};
    pairs.forEach(p => { if (p.letter === 'a' || p.letter === 'b' || p.letter === 'c') bySide[p.letter] = p.value; });

    if (bySide.a == null || bySide.b == null || bySide.c == null) {
        return shapeError("Triangle needs all three sides tagged, like <code>/triangle3(a):4(b):5(c)</code>.");
    }

    const a = bySide.a, b = bySide.b, c = bySide.c; // a=BC, b=CA, c=AB
    if (a <= 0 || b <= 0 || c <= 0) return shapeError("Side lengths must be greater than 0.");
    if (a + b <= c || a + c <= b || b + c <= a) {
        return shapeError(`Sides a=${a}, b=${b}, c=${c} can't form a triangle — each side must be shorter than the sum of the other two.`);
    }

    // B at origin, C along +x at distance a (side BC = a).
    // A is at distance c from B (side AB = c) and distance b from C (side CA = b).
    const B = { x: 0, y: 0 };
    const C = { x: a, y: 0 };
    const cosB = (a * a + c * c - b * b) / (2 * a * c);
    const sinB = Math.sqrt(Math.max(0, 1 - cosB * cosB));
    const A = { x: c * cosB, y: c * sinB };

    // Fit to viewBox: flip Y (SVG grows downward) and scale/translate the
    // triangle's bounding box into the padded drawing area.
    const pts = { A, B, C };
    const xs = [A.x, B.x, C.x], ys = [A.y, B.y, C.y];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const drawSize = SHAPE_SVG_SIZE - SHAPE_PAD * 2;
    const scale = Math.min(drawSize / (maxX - minX || 1), drawSize / (maxY - minY || 1));
    const offX = SHAPE_PAD + (drawSize - (maxX - minX) * scale) / 2;
    const offY = SHAPE_PAD + (drawSize - (maxY - minY) * scale) / 2;

    function toSvg(p) {
        return { x: offX + (p.x - minX) * scale, y: SHAPE_SVG_SIZE - (offY + (p.y - minY) * scale) };
    }
    const sA = toSvg(A), sB = toSvg(B), sC = toSvg(C);

    function mid(p1, p2) { return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; }
    // Push a side's label outward, away from the triangle's centroid, so
    // it doesn't sit on top of the line itself.
    const centroid = { x: (sA.x + sB.x + sC.x) / 3, y: (sA.y + sB.y + sC.y) / 3 };
    function labelPos(p1, p2) {
        const m = mid(p1, p2);
        const dx = m.x - centroid.x, dy = m.y - centroid.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: m.x + (dx / len) * 20, y: m.y + (dy / len) * 20 };
    }
    function vertexLabelPos(p) {
        const dx = p.x - centroid.x, dy = p.y - centroid.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: p.x + (dx / len) * 22, y: p.y + (dy / len) * 22 };
    }

    const lAB = labelPos(sA, sB), lBC = labelPos(sB, sC), lCA = labelPos(sC, sA);
    const vA = vertexLabelPos(sA), vB = vertexLabelPos(sB), vC = vertexLabelPos(sC);

    return shapeWrap(`
        <polygon points="${sA.x},${sA.y} ${sB.x},${sB.y} ${sC.x},${sC.y}" class="xetex-shape-fill" />
        <line x1="${sA.x}" y1="${sA.y}" x2="${sB.x}" y2="${sB.y}" class="xetex-shape-line" />
        <line x1="${sB.x}" y1="${sB.y}" x2="${sC.x}" y2="${sC.y}" class="xetex-shape-line" />
        <line x1="${sC.x}" y1="${sC.y}" x2="${sA.x}" y2="${sA.y}" class="xetex-shape-line" />
        <circle cx="${sA.x}" cy="${sA.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${sB.x}" cy="${sB.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${sC.x}" cy="${sC.y}" r="3" class="xetex-shape-vertex" />
        <text x="${vA.x}" y="${vA.y}" class="xetex-shape-vlabel">A</text>
        <text x="${vB.x}" y="${vB.y}" class="xetex-shape-vlabel">B</text>
        <text x="${vC.x}" y="${vC.y}" class="xetex-shape-vlabel">C</text>
        <text x="${lAB.x}" y="${lAB.y}" class="xetex-shape-slabel">${c}</text>
        <text x="${lBC.x}" y="${lBC.y}" class="xetex-shape-slabel">${a}</text>
        <text x="${lCA.x}" y="${lCA.y}" class="xetex-shape-slabel">${b}</text>
    `);
}

// ── Square ───────────────────────────────────────────────────────────
function buildSquareSVG(text) {
    const pairs = shapeNumLetterPairs(text);
    if (pairs.length === 0) return shapeError("Give a side length, like <code>/square5</code>.");
    const side = pairs[0].value;
    if (side <= 0) return shapeError("Side length must be greater than 0.");

    const drawSize = SHAPE_SVG_SIZE - SHAPE_PAD * 2;
    const x0 = SHAPE_PAD, y0 = SHAPE_PAD, x1 = SHAPE_PAD + drawSize, y1 = SHAPE_PAD + drawSize;
    // A top-left, B top-right, C bottom-right, D bottom-left (clockwise)
    const A = { x: x0, y: y0 }, B = { x: x1, y: y0 }, C = { x: x1, y: y1 }, D = { x: x0, y: y1 };

    return shapeWrap(`
        <polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}" class="xetex-shape-fill" />
        <rect x="${x0}" y="${y0}" width="${drawSize}" height="${drawSize}" class="xetex-shape-line" fill="none" />
        <circle cx="${A.x}" cy="${A.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${B.x}" cy="${B.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${C.x}" cy="${C.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${D.x}" cy="${D.y}" r="3" class="xetex-shape-vertex" />
        <text x="${A.x - 16}" y="${A.y - 12}" class="xetex-shape-vlabel">A</text>
        <text x="${B.x + 16}" y="${B.y - 12}" class="xetex-shape-vlabel">B</text>
        <text x="${C.x + 16}" y="${C.y + 18}" class="xetex-shape-vlabel">C</text>
        <text x="${D.x - 16}" y="${D.y + 18}" class="xetex-shape-vlabel">D</text>
        <text x="${(A.x + B.x) / 2}" y="${y0 - 14}" class="xetex-shape-slabel">${side}</text>
        <text x="${x1 + 14}" y="${(B.y + C.y) / 2}" class="xetex-shape-slabel">${side}</text>
        <text x="${(C.x + D.x) / 2}" y="${y1 + 24}" class="xetex-shape-slabel">${side}</text>
        <text x="${x0 - 14}" y="${(D.y + A.y) / 2}" class="xetex-shape-slabel" text-anchor="end">${side}</text>
    `);
}

// ── Box (rectangle) ─────────────────────────────────────────────────
function buildBoxSVG(text) {
    const pairs = shapeNumLetterPairs(text);
    if (pairs.length < 2) return shapeError("Give width and height, like <code>/box6:4</code> or <code>/box6(w):4(h)</code>.");

    let width, height;
    const byLetter = {};
    pairs.forEach(p => { if (p.letter === 'w' || p.letter === 'h') byLetter[p.letter] = p.value; });
    if (byLetter.w != null || byLetter.h != null) {
        width = byLetter.w != null ? byLetter.w : pairs[0].value;
        height = byLetter.h != null ? byLetter.h : pairs[1].value;
    } else {
        width = pairs[0].value;
        height = pairs[1].value;
    }
    if (width <= 0 || height <= 0) return shapeError("Width and height must be greater than 0.");

    const drawW = SHAPE_SVG_SIZE - SHAPE_PAD * 2;
    const drawH = SHAPE_SVG_SIZE - SHAPE_PAD * 2;
    // Scale to fit the box's aspect ratio inside the drawing area.
    const scale = Math.min(drawW / width, drawH / height);
    const w = width * scale, h = height * scale;
    const x0 = (SHAPE_SVG_SIZE - w) / 2, y0 = (SHAPE_SVG_SIZE - h) / 2;
    const x1 = x0 + w, y1 = y0 + h;
    const A = { x: x0, y: y0 }, B = { x: x1, y: y0 }, C = { x: x1, y: y1 }, D = { x: x0, y: y1 };

    return shapeWrap(`
        <polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}" class="xetex-shape-fill" />
        <rect x="${x0}" y="${y0}" width="${w}" height="${h}" class="xetex-shape-line" fill="none" />
        <circle cx="${A.x}" cy="${A.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${B.x}" cy="${B.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${C.x}" cy="${C.y}" r="3" class="xetex-shape-vertex" />
        <circle cx="${D.x}" cy="${D.y}" r="3" class="xetex-shape-vertex" />
        <text x="${A.x - 16}" y="${A.y - 12}" class="xetex-shape-vlabel">A</text>
        <text x="${B.x + 16}" y="${B.y - 12}" class="xetex-shape-vlabel">B</text>
        <text x="${C.x + 16}" y="${C.y + 18}" class="xetex-shape-vlabel">C</text>
        <text x="${D.x - 16}" y="${D.y + 18}" class="xetex-shape-vlabel">D</text>
        <text x="${(A.x + B.x) / 2}" y="${y0 - 14}" class="xetex-shape-slabel">${width}</text>
        <text x="${x1 + 14}" y="${(B.y + C.y) / 2}" class="xetex-shape-slabel">${height}</text>
        <text x="${(C.x + D.x) / 2}" y="${y1 + 24}" class="xetex-shape-slabel">${width}</text>
        <text x="${x0 - 14}" y="${(D.y + A.y) / 2}" class="xetex-shape-slabel" text-anchor="end">${height}</text>
    `);
}

// ── Circle ───────────────────────────────────────────────────────────
function buildCircleSVG(text) {
    const pairs = shapeNumLetterPairs(text);
    if (pairs.length === 0) return shapeError("Give a radius, like <code>/circle5</code>.");
    const r = pairs[0].value;
    if (r <= 0) return shapeError("Radius must be greater than 0.");

    const cx = SHAPE_SVG_SIZE / 2, cy = SHAPE_SVG_SIZE / 2;
    const drawR = (SHAPE_SVG_SIZE - SHAPE_PAD * 2) / 2;

    return shapeWrap(`
        <circle cx="${cx}" cy="${cy}" r="${drawR}" class="xetex-shape-fill xetex-shape-line" />
        <circle cx="${cx}" cy="${cy}" r="2.5" class="xetex-shape-vertex" />
        <line x1="${cx}" y1="${cy}" x2="${cx + drawR}" y2="${cy}" class="xetex-shape-line" />
        <text x="${cx - 16}" y="${cy - 12}" class="xetex-shape-vlabel">O</text>
        <text x="${cx + drawR / 2}" y="${cy - 14}" class="xetex-shape-slabel">${r}</text>
    `);
}

// ── Command router ───────────────────────────────────────────────────
// Returns null if the text isn't a shape command, otherwise
// { responseStr, responseIsHTML: true }.
function computeShapeResponse(rawText) {
    const text = rawText.trim();
    let m;

    if ((m = text.match(/^\/triangle\s*(.+)$/i))) {
        return { responseStr: buildTriangleSVG(m[1]), responseIsHTML: true };
    }
    if ((m = text.match(/^\/square\s*(.+)$/i))) {
        return { responseStr: buildSquareSVG(m[1]), responseIsHTML: true };
    }
    if ((m = text.match(/^\/(?:box|rectangle)\s*(.+)$/i))) {
        return { responseStr: buildBoxSVG(m[1]), responseIsHTML: true };
    }
    if ((m = text.match(/^\/circle\s*(.+)$/i))) {
        return { responseStr: buildCircleSVG(m[1]), responseIsHTML: true };
    }
    return null;
}
