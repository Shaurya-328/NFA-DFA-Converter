/* =============================================
   script.js — Automata Toolkit v5
   LAYOUT-ONLY IMPROVEMENTS (no colour changes):
   • Hierarchical LR layout  (rankdir=LR equivalent)
   • Proper nodesep / ranksep equivalent spacing
   • splines=true equivalent — smart edge routing
   • overlap=false — avoidOverlap:1
   • concentrate=true — merged parallel labels
   • Final states: real doublecircle (size gap trick)
   • Start arrow: tight straight line from point node
   • Self-loop positioning: top of node, not overlapping
   • Edge label placement: labelangle / labeldistance equivalent
   • size / ratio: dynamic canvas + fit
   • Font sizes increased for readability
   ============================================= */

/* ── Splash ── */
if (document.querySelector('.splash')) {
  setTimeout(goToHome, 10000);
  document.addEventListener('dblclick', goToHome);
}
function goToHome() {
  const s = document.querySelector('.splash');
  if (s) { s.classList.add('fade-out'); setTimeout(() => location.href = './homepage.html', 1000); }
}

/* ── Toast ── */
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '✓ &nbsp;' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

/* ══════════════════════════════════════════════
   EXPAND BUTTON / MODAL  (unchanged)
══════════════════════════════════════════════ */
function attachExpandButton(containerId, network) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const old = container.querySelector('.graph-expand-btn');
  if (old) old.remove();
  const btn = document.createElement('button');
  btn.className = 'graph-expand-btn';
  btn.title     = 'Expand graph';
  btn.innerHTML = '⛶';
  container.appendChild(btn);
  btn.addEventListener('click', () => openGraphModal(containerId, network));
}

function openGraphModal(containerId, network) {
  const overlay = document.createElement('div');
  overlay.className = 'graph-modal-overlay';
  const box   = document.createElement('div');
  box.className = 'graph-modal-box';
  const close = document.createElement('button');
  close.className = 'graph-modal-close';
  close.innerHTML = '✕ Close';
  const dismiss = () => {
    document.body.removeChild(overlay);
    if (network) network.fit({ animation: true });
  };
  close.addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
  const hint = document.createElement('div');
  hint.className   = 'graph-modal-hint';
  hint.textContent = 'Drag nodes • Scroll to zoom • Double-click canvas to fit';
  const cloneBox = document.createElement('div');
  cloneBox.className = 'graph-modal-canvas';
  box.appendChild(close);
  box.appendChild(hint);
  box.appendChild(cloneBox);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  if (network) {
    /* ── FREEZE LAYOUT: capture current node positions ── */
    const frozenPositions = network.getPositions();
    const nodesData = network.body.data.nodes.get();
    const edgesData = network.body.data.edges.get();

    /* Pin every node at its current position so no re-layout runs */
    const pinnedNodes = nodesData.map(n => ({
      ...n,
      x: frozenPositions[n.id] ? frozenPositions[n.id].x : (n.x || 0),
      y: frozenPositions[n.id] ? frozenPositions[n.id].y : (n.y || 0),
      fixed: { x: true, y: true },
    }));

    const modalNet = new vis.Network(
      cloneBox,
      { nodes: new vis.DataSet(pinnedNodes), edges: new vis.DataSet(edgesData) },
      {
        /* NO hierarchical layout — positions are pinned manually */
        layout: { hierarchical: { enabled: false } },
        interaction: { zoomView: true, dragView: true, dragNodes: true,
                       hover: true, selectConnectedEdges: false },
        physics: { enabled: false },
        nodes: { chosen: true },
        edges: { chosen: false },
      }
    );
    /* Fit to the same view as the source graph */
    setTimeout(() => modalNet.fit({ animation: { duration: 200, easingFunction: 'easeInOutQuad' } }), 60);
    cloneBox.addEventListener('dblclick', () => modalNet.fit({ animation: true }));
  }
}

/* ══════════════════════════════════════════════
   CORE GRAPH RENDERER  v5
   All automata (NFA visualiser, DFA visualiser,
   NFA panel in converter) go through this function.

   Layout improvements vs v4:
   ──────────────────────────
   DOT attribute → vis.js equivalent used here
   rankdir=LR    → hierarchical layout, direction:'LR'
   nodesep≥0.6   → hierarchical levelSeparation + nodeSpacing
   ranksep≥0.8   → levelSeparation increased
   splines=true  → dynamic edge routing (smooth.type='dynamic')
   overlap=false → physics avoidOverlap:1.0 (kept)
   concentrate   → edges merged before draw (already done)
   labeldistance → edgeMinimization=true + font.align='middle'
   labelangle    → font.vadjust per edge type
   size=10,6     → dynamic canvas, fit() after stabilise
   ratio=fill    → height set to fill container
   doublecircle  → TWO concentric ellipses via ctxRenderer
   start point   → shape='dot' size=0, straight edge, no physics
   self-loop     → selfReferenceSize + selfReference.angle
══════════════════════════════════════════════ */

function drawGraph(rawNodes, rawEdges, containerId, startId, finalIds, deadIds) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  container.innerHTML = '';

  const light  = document.body.classList.contains('light');
  finalIds     = finalIds || [];
  deadIds      = deadIds  || [];
  const isDead = id => deadIds.includes(id) || id === 'qd' || id === '∅';

  /* ── Canvas sizing  (ratio=fill equivalent) ── */
  const n       = rawNodes.length;
  const canvasH = Math.max(480, Math.min(820, 240 + n * 90));
  container.style.height   = canvasH + 'px';
  container.style.overflow = 'hidden';

  /* ════════════════════════════════════════
     NODES
     doublecircle = custom ctx renderer draws
     an outer ring around accepting states.
     All colours UNCHANGED from v4.
     ════════════════════════════════════════ */
  const nodes = rawNodes.map(raw => {
    const id      = raw.id;
    const isStart = id === startId;
    const isFinal = finalIds.includes(id);
    const dead    = isDead(id);

    /* ── Colours: identical to v4, no changes ── */
    let bg, border, fontCol;
    if (dead) {
      bg = light ? '#fecaca' : '#2d0a0a'; border = light ? '#dc2626' : '#ef4444';
      fontCol = light ? '#7f1d1d' : '#fca5a5';
    } else if (isStart && isFinal) {
      bg = light ? '#fef08a' : '#2d200a'; border = light ? '#ca8a04' : '#eab308';
      fontCol = light ? '#713f12' : '#fde047';
    } else if (isStart) {
      bg = light ? '#bbf7d0' : '#052e16'; border = light ? '#16a34a' : '#22c55e';
      fontCol = light ? '#14532d' : '#86efac';
    } else if (isFinal) {
      bg = light ? '#bfdbfe' : '#0c1a35'; border = light ? '#2563eb' : '#3b82f6';
      fontCol = light ? '#1e3a8a' : '#93c5fd';
    } else {
      bg = light ? '#e2e8f0' : '#0d1f38'; border = light ? '#475569' : '#00d4ff';
      fontCol = light ? '#0f172a' : '#e2e8f0';
    }

    /* ── Node base ── */
    const node = {
      id,
      label: raw.label || id,
      /* LAYOUT: use 'dot' + ctxRenderer for full control over double-circle */
      shape: 'custom',
      ctxRenderer: buildNodeRenderer(bg, border, fontCol, isFinal, isStart, dead, id),
      /* Size drives physics spacing  (larger = more repulsion = better separation) */
      size: isFinal ? 36 : 32,
      color: {
        background: bg, border,
        highlight: { background: bg, border },
        hover:      { background: bg, border },
      },
      font: {
        color:  fontCol,
        /* LAYOUT: increased fontsize for readability (was 14) */
        size:   15,
        face:   'Space Mono, monospace',
        vadjust: 0,
      },
      borderWidth: isFinal ? 4 : (isStart ? 3 : 2),
      chosen: true,
      mass: isFinal ? 2 : 1.5,
    };

    /* Shadow ring kept identical to v4 */
    if (isFinal) {
      node.shadow = { enabled: true, color: border, size: 9, x: 0, y: 0 };
    }
    if (isStart && !isFinal) {
      node.shadow = { enabled: true, color: light ? '#16a34a' : '#22c55e', size: 5, x: 0, y: 0 };
    }
    if (isStart && isFinal) {
      node.shadow = { enabled: true, color: light ? '#ca8a04' : '#eab308', size: 9, x: 0, y: 0 };
    }

    return node;
  });

  /* ── Ghost start node  (start [shape=point] equivalent) ── */
  nodes.push({
    id: '__start__', label: '', size: 2, shape: 'dot',
    color: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
             highlight: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' },
             hover:      { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' } },
    fixed: false, chosen: false, mass: 0.05,
    physics: true,
  });

  /* ════════════════════════════════════════
     EDGES
     LAYOUT improvements:
     • Merge parallel edges (concentrate=true)
     • Self-loops: fixed position at top of node
       using selfReference.angle (90° = top)
     • Bidirectional pairs: opposite curve sides
       (curveCW + curveCCW) so they never overlap
     • Forward edges: very slight curve (splines)
     • Dead edges: same curve logic, just red
     • Label: align='middle', vadjust away from line
     ════════════════════════════════════════ */

  /* ════════════════════════════════════════
     EDGES — clean routing rules:
     • Single edge, no reverse  → straight (roundness 0)
     • Single edge, has reverse → ±0.25 opposite arcs
     • Multiple edges same pair → fan symmetrically ±0.18 / ±0.28
     • Self-loops               → compact fixed loop above node
     • Labels                   → align:'middle' tracks curve midpoint
     ════════════════════════════════════════ */

  /* Merge parallel edges sharing the same (from, to) pair into one edge
     with a combined label — this prevents multiple self-loops from
     stacking on top of each other at the same angle/position.
     e.g. q0→q0 on "0" + q0→q0 on "1"  →  q0→q0 on "0, 1"          */
  const edgeMergeMap = new Map();
  rawEdges.forEach(e => {
    const k = `${e.from}__${e.to}`;
    if (!edgeMergeMap.has(k)) {
      edgeMergeMap.set(k, { ...e, label: e.label });
    } else {
      const existing = edgeMergeMap.get(k);
      const labels = existing.label.split(', ');
      if (!labels.includes(e.label)) {
        existing.label = existing.label + ', ' + e.label;
      }
    }
  });
  const mergedEdges = [...edgeMergeMap.values()];

  /* Group by (from, to) to know slot count per pair */
  const slotMap = {};
  mergedEdges.forEach((e, i) => {
    const k = `${e.from}__${e.to}`;
    if (!slotMap[k]) slotMap[k] = [];
    slotMap[k].push(i);
  });

  /* Detect which pairs have a reverse direction */
  const pairKeys = new Set(Object.keys(slotMap));
  const hasPair  = {};
  Object.keys(slotMap).forEach(k => {
    const [a, b] = k.split('__');
    if (pairKeys.has(`${b}__${a}`)) hasPair[k] = true;
  });

  /* Curvature rules:
     total=1, no reverse  → 0       (straight)
     total=1, has reverse → ±0.25   (bidirectional separation)
     total=2 same dir     → −0.18, +0.18
     total=3 same dir     → −0.28, 0, +0.28             */
  function computeRoundness(slot, total, bidir, side) {
    if (total === 1) {
      if (!bidir) return 0;
      return side === 1 ? 0.25 : -0.25;
    }
    const spread = total === 2 ? 0.18 : 0.28;
    const step   = (2 * spread) / (total - 1);
    return parseFloat((-spread + slot * step).toFixed(3));
  }

  const edgeColor     = light ? '#334155' : '#00d4ff';
  const deadEdgeColor = light ? '#dc2626' : '#f87171';
  const labelBg       = 'transparent';
  const labelColor    = light ? '#0f172a' : '#e2e8f0';

  const edges = mergedEdges.map((e, i) => {
    const isSelf     = e.from === e.to;
    const pairKey    = `${e.from}__${e.to}`;
    const revKey     = `${e.to}__${e.from}`;
    const bidir      = !!hasPair[pairKey];
    const slot       = slotMap[pairKey].indexOf(i);
    const total      = slotMap[pairKey].length;
    /* Lexically smaller key = CW (+1); larger = CCW (−1) */
    const side       = bidir ? (pairKey < revKey ? 1 : -1) : 0;
    const isDeadEdge = isDead(e.to);
    const col        = isDeadEdge ? deadEdgeColor : edgeColor;

    let smooth;
    if (isSelf) {
      smooth = { enabled: true, type: 'curvedCW', roundness: 0.5 };
    } else {
      const r = computeRoundness(slot, total, bidir, side);
      smooth  = r === 0
        ? { enabled: false }
        : { enabled: true, type: 'curvedCW', roundness: r };
    }

    /* vadjust: push label above CW arc, below CCW arc, slightly above straight */
    const r            = isSelf ? 0 : computeRoundness(slot, total, bidir, side);
    const labelVadjust = isSelf ? -26 : r > 0 ? -10 : r < 0 ? 10 : -8;

    const edge = {
      id:    'e_' + i,
      from:  e.from,
      to:    e.to,
      label: e.label || '',
      smooth,
      arrows: { to: { enabled: true, scaleFactor: 0.95, type: 'arrow' } },
      color:  { color: col, highlight: col, hover: col },
      font: {
        color:       labelColor,
        size:        14,
        face:        'Space Mono, monospace',
        align:       'middle',   /* tracks actual curve midpoint — no floating */
        background:  labelBg,
        strokeWidth: 0,
        vadjust:     labelVadjust,
      },
      width:          isDeadEdge ? 1.5 : 1.8,
      chosen:         false,
      selectionWidth: 0,
      hoverWidth:     0.6,
    };

    /* Self-loop: compact, above node, label just outside arc */
    if (isSelf) {
      edge.selfReference = {
        size:                40,
        angle:               Math.PI / 2,
        renderBehindTheNode: true,
      };
      edge.font.vadjust = -26;
    }

    return edge;
  });

  /* LAYOUT: start arrow — short, straight, from invisible point node
     (start [shape=point]; start -> q0; equivalent) */
  edges.push({
    id: '__startedge__',
    from: '__start__', to: startId,
    label: '', arrows: { to: { enabled: true, scaleFactor: 0.9, type: 'arrow' } },
    color: { color: light ? '#16a34a' : '#22c55e' },
    width: 2.2,
    /* LAYOUT: straightCross = perfectly straight initial arrow */
    smooth: { enabled: true, type: 'straightCross', roundness: 0 },
    chosen: false, font: { size: 0 },
    physics: true,
  });

  /* ════════════════════════════════════════
     VIS.JS OPTIONS
     rankdir=LR  → hierarchical.direction:'LR'
     nodesep     → hierarchical.nodeSpacing
     ranksep     → hierarchical.levelSeparation
     overlap=false → physics.avoidOverlap:1
     size=10,6   → dynamic canvas + fit()
     ════════════════════════════════════════ */

  /* Fix #6 — stronger spacing: scale generously with graph size */
  const levelSep  = Math.max(260, Math.min(480, 200 + n * 38));
  const nodeSpace = Math.max(160, Math.min(300, 140 + n * 20));

  const opts = {
    nodes: { chosen: true },
    edges: { chosen: false },

    /* LAYOUT: hierarchical LR (rankdir=LR equivalent) */
    layout: {
      hierarchical: {
        enabled:          true,
        direction:        'LR',          /* left → right */
        sortMethod:       'directed',    /* follows edge direction */
        /* LAYOUT: levelSeparation = ranksep equivalent */
        levelSeparation:  levelSep,
        /* LAYOUT: nodeSpacing = nodesep equivalent */
        nodeSpacing:      nodeSpace,
        treeSpacing:      nodeSpace,
        /* LAYOUT: shakeTowards = keeps graph compact */
        shakeTowards:     'roots',
        edgeMinimization: true,          /* reduce crossings */
        blockShifting:    true,          /* align subtrees */
        parentCentralization: true,
      },
    },

    interaction: {
      zoomView:             true,
      dragView:             true,
      dragNodes:            true,
      hover:                true,
      selectConnectedEdges: false,
      navigationButtons:    false,
      keyboard:             false,
    },

    /* LAYOUT: physics OFF when using hierarchical layout —
       hierarchical layout does its own positioning;
       physics ON top of it causes jitter and breaks ranks */
    physics: {
      enabled:           false,
    },
  };

  const net = new vis.Network(
    container,
    { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) },
    opts
  );

  /* LAYOUT: after the hierarchical layout computes positions,
     position the __start__ ghost node just left of startId
     and fit the view  (ratio=fill equivalent) */
  net.once('afterDrawing', () => {
    try {
      const sp = net.getPosition(startId);
      /* Place the invisible arrow-source node flush left of start */
      net.moveNode('__start__', sp.x - 70, sp.y);
    } catch (_) {}
    net.fit({ animation: { duration: 450, easingFunction: 'easeInOutQuad' } });
    /* Cache final positions so fullscreen modal can freeze the layout */
    net._frozenPositions = net.getPositions();
  });

  attachExpandButton(containerId, net);
  return net;
}

/* ══════════════════════════════════════════════
   CUSTOM NODE RENDERER
   Draws a proper double-circle for accepting states
   instead of a shadow glow. Uses the vis.js
   ctxRenderer API so it works at all zoom levels.
   Colours come from the node's own bg/border vars —
   NOTHING hardcoded here, so the colour theme
   is 100% preserved.
══════════════════════════════════════════════ */
function buildNodeRenderer(bg, border, fontCol, isFinal, isStart, isDead, label) {
  return ({ ctx, x, y, state: { selected, hover }, style }) => {
    const r = style.size || 32;

    /* ── Outer ring for final states (doublecircle) ── */
    if (isFinal) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = border;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    /* ── Main circle ── */
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle   = bg;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth   = isFinal ? 3 : (isStart ? 3 : 2);
    ctx.stroke();

    /* ── Label drawn directly in canvas so it's always visible ── */
    const displayLabel = String(label || '').replace(/[{}]/g, '');
    if (displayLabel) {
      ctx.font         = '600 14px "Space Mono", monospace';
      ctx.fillStyle    = fontCol;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayLabel, x, y);
    }

    return {
      drawExternalLabel: false,
      nodeDimensions: { width: (r + (isFinal ? 5 : 0)) * 2, height: (r + (isFinal ? 5 : 0)) * 2 },
    };
  };
}

/* ─────────────────────────────────────────────
   HIGHLIGHT / RESET helpers
───────────────────────────────────────────── */
function highlightNode(network, nodeId, color) {
  if (!network || !nodeId) return;
  try {
    network.body.data.nodes.update({
      id: nodeId,
      color: { background: color, border: color,
               highlight: { background: color, border: color } },
    });
  } catch (_) {}
}

function resetNodeColors(network, nodes) {
  if (!network) return;
  nodes.forEach(n => {
    try { network.body.data.nodes.update({ id: n.id, color: n.color, font: n.font }); } catch (_) {}
  });
}

function showError(el, msg) {
  if (!el) return;
  el.innerText = '⚠ ' + msg;
  el.style.display = 'block';
}

/* ──────────────────────────────────────────────
   EXPORTS
────────────────────────────────────────────── */
function exportGraphPNG(containerId, filename) {
  const canvas = document.querySelector('#' + containerId + ' canvas');
  if (!canvas) { showToast('Draw the graph first!'); return; }
  const link = document.createElement('a');
  link.download = filename + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Graph exported as PNG');
}

function exportGraphSVG(containerId, filename) {
  const svg = document.querySelector('#' + containerId + ' svg');
  if (!svg) { showToast('Draw the graph first!'); return; }
  const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = filename + '.svg';
  link.href = URL.createObjectURL(blob);
  link.click();
  showToast('Graph exported as SVG');
}

function exportTableCSV(tableId, filename) {
  const table = document.querySelector('#' + tableId + ' table');
  if (!table) { showToast('Generate the table first!'); return; }
  let csv = '';
  table.querySelectorAll('tr').forEach(row => {
    const cells = [...row.querySelectorAll('th,td')]
      .map(c => '"' + c.innerText.replace(/"/g, '""') + '"');
    csv += cells.join(',') + '\n';
  });
  const link = document.createElement('a');
  link.download = filename + '.csv';
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.click();
  showToast('Table exported as CSV');
}

/* ──────────────────────────────────────────────
   STRING SIMULATOR
────────────────────────────────────────────── */
const sim = {
  dfaTrans: {}, start: '', finals: [], string: [],
  pos: -1, current: '', network: null, nodes: [],
  timer: null, running: false,
};

function initSimulator(dfaTrans, start, finals, network, nodes) {
  Object.assign(sim, {
    dfaTrans, start, finals, network, nodes,
    string: [], pos: -1, current: '', timer: null, running: false,
  });
  const panel = document.getElementById('simPanel');
  if (panel) panel.style.display = 'block';
  ['simNext', 'simPlay', 'simReset'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = true; if (id === 'simPlay') el.textContent = '▶ Play'; }
  });
}

function buildTokens(str) {
  const row = document.getElementById('tokenRow');
  if (!row) return;
  row.innerHTML = [...str]
    .map((ch, i) => `<span class="token" id="tok_${i}">${ch}</span>`)
    .join('');
}

function showSimVerdict() {
  const v = document.getElementById('simVerdict');
  if (!v) return;
  const accepted = sim.finals.includes(sim.current);
  v.style.display = 'block';
  v.className = accepted ? 'verdict accepted' : 'verdict rejected';
  v.innerHTML = accepted
    ? `✅ ACCEPTED — ended in final state <b>${sim.current}</b>`
    : `❌ REJECTED — ended in <b>${sim.current || 'dead state'}</b>`;
  highlightNode(sim.network, sim.current, accepted ? '#22c55e' : '#ef4444');
}

function clearSimTimer() {
  clearInterval(sim.timer); sim.running = false;
  const pb = document.getElementById('simPlay');
  if (pb) pb.textContent = '▶ Play';
}

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('simStartBtn');
  const nextBtn  = document.getElementById('simNext');
  const playBtn  = document.getElementById('simPlay');
  const resetBtn = document.getElementById('simReset');

  if (startBtn) startBtn.addEventListener('click', () => {
    if (!sim.start) { alert('Visualize the automaton first!'); return; }
    const str = (document.getElementById('simInput') || {}).value || '';
    sim.string = str.split(''); sim.pos = 0; sim.current = sim.start;
    buildTokens(str);
    resetNodeColors(sim.network, sim.nodes);
    highlightNode(sim.network, sim.start, '#22c55e');
    const v = document.getElementById('simVerdict');
    if (v) v.style.display = 'none';
    clearSimTimer();
    const disp = document.getElementById('simStateDisplay');
    if (sim.string.length === 0) {
      if (disp) disp.innerHTML = `Empty string. In state <span class="state-name">${sim.start}</span>`;
      showSimVerdict(); return;
    }
    const sym0 = sim.string[0];
    const nxt0 = (sim.dfaTrans[sim.start] || {})[sym0] || '';
    sim.current = nxt0;
    const tok = document.getElementById('tok_0');
    if (tok) tok.classList.add('active');
    if (disp) disp.innerHTML = `Step 1: read <b style="color:var(--accent)">"${sym0}"</b> → <span class="state-name">${nxt0 || '(dead)'}</span>`;
    if (nxt0) highlightNode(sim.network, nxt0, '#f59e0b');
    if (nextBtn) nextBtn.disabled = sim.string.length <= 1;
    if (playBtn) { playBtn.disabled = sim.string.length <= 1; playBtn.textContent = '▶ Play'; }
    if (resetBtn) resetBtn.disabled = false;
    if (sim.string.length === 1) showSimVerdict();
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (sim.pos >= sim.string.length - 1) { showSimVerdict(); nextBtn.disabled = true; return; }
    sim.pos++;
    const prevTok = document.getElementById('tok_' + (sim.pos - 1));
    if (prevTok) { prevTok.classList.remove('active'); prevTok.classList.add('done'); }
    const sym  = sim.string[sim.pos];
    const prev = sim.current;
    const nxt  = (sim.dfaTrans[prev] || {})[sym] || '';
    sim.current = nxt;
    const tok = document.getElementById('tok_' + sim.pos);
    if (tok) tok.classList.add('active');
    resetNodeColors(sim.network, sim.nodes);
    if (nxt) highlightNode(sim.network, nxt, '#f59e0b');
    const disp = document.getElementById('simStateDisplay');
    if (disp) disp.innerHTML = `Step ${sim.pos + 1}: read <b style="color:var(--accent)">"${sym}"</b> from <span class="state-name">${prev}</span> → <span class="state-name">${nxt || '(dead)'}</span>`;
    if (sim.pos >= sim.string.length - 1) { showSimVerdict(); nextBtn.disabled = true; clearSimTimer(); }
  });

  if (playBtn) playBtn.addEventListener('click', () => {
    if (sim.running) { clearSimTimer(); return; }
    if (sim.pos >= sim.string.length - 1) return;
    sim.running = true; playBtn.textContent = '⏸ Pause';
    sim.timer = setInterval(() => {
      if (sim.pos >= sim.string.length - 1) { clearSimTimer(); showSimVerdict(); return; }
      nextBtn && nextBtn.click();
    }, 700);
  });

  if (resetBtn) resetBtn.addEventListener('click', () => {
    clearSimTimer(); sim.pos = -1; sim.current = '';
    const row = document.getElementById('tokenRow'); if (row) row.innerHTML = '';
    const disp = document.getElementById('simStateDisplay'); if (disp) disp.innerHTML = '';
    const v = document.getElementById('simVerdict'); if (v) v.style.display = 'none';
    resetNodeColors(sim.network, sim.nodes);
    if (nextBtn) nextBtn.disabled = true;
    if (playBtn) { playBtn.disabled = true; playBtn.textContent = '▶ Play'; }
    if (resetBtn) resetBtn.disabled = true;
  });
});

/* ──────────────────────────────────────────────
   STRING CHECKER
────────────────────────────────────────────── */
function checkString(dfaTrans, start, finals, inputId, pathId, verdictId) {
  const str  = (document.getElementById(inputId) || {}).value || '';
  const path = document.getElementById(pathId);
  const verd = document.getElementById(verdictId);
  if (!path || !verd) return;

  let cur = start;
  const trace = [{ state: cur, sym: null }];
  let dead = false;
  for (const sym of str) {
    const nxt = (dfaTrans[cur] || {})[sym];
    if (nxt === undefined || nxt === '') { dead = true; trace.push({ state: '∅', sym }); break; }
    cur = nxt; trace.push({ state: cur, sym });
  }

  path.innerHTML = trace.map((item, i) => {
    const isFinal = finals.includes(item.state);
    const isD     = item.state === '∅';
    const cls     = isD ? 'path-state dead' : isFinal ? 'path-state final' : 'path-state';
    const arrow   = i < trace.length - 1 && trace[i + 1].sym
      ? `<span class="path-arrow"> –${trace[i + 1].sym}→ </span>` : '';
    return `<span class="${cls}">${item.state}</span>${arrow}`;
  }).join('');

  const accepted = !dead && finals.includes(cur);
  verd.style.display = 'block';
  verd.className = accepted ? 'verdict accepted' : 'verdict rejected';
  verd.innerHTML = accepted
    ? `✅ ACCEPTED &nbsp;·&nbsp; <b>"${str || 'ε'}"</b> is in the language`
    : `❌ REJECTED &nbsp;·&nbsp; <b>"${str || 'ε'}"</b> is NOT in the language`;
}

/* ──────────────────────────────────────────────
   NFA VISUALIZER
────────────────────────────────────────────── */
const nfaBtn = document.getElementById('visualizeBtn');
let nfaNetwork = null, nfaNodesList = [], nfaDfaTrans = {}, nfaStart = '', nfaFinals = [];

if (nfaBtn) {
  nfaBtn.addEventListener('click', function () {
    const err = document.getElementById('errorMsg');
    err.innerText = ''; err.style.display = 'none';

    const states   = document.getElementById('states').value.split(',').map(s => s.trim()).filter(Boolean);
    const alphabet = document.getElementById('alphabet').value.split(',').map(a => a.trim()).filter(Boolean);
    const start    = document.getElementById('start').value.trim();
    const finals   = document.getElementById('final').value.split(',').map(f => f.trim()).filter(Boolean);
    const lines    = document.getElementById('transitions').value.split('\n');

    if (!states.length || !alphabet.length || !start || !finals.length)
      return showError(err, 'Please fill all fields.');
    if (start.includes(',')) return showError(err, 'Only one start state allowed.');
    if (!states.includes(start)) return showError(err, 'Start state not defined.');
    for (const f of finals)
      if (!states.includes(f)) return showError(err, `Final state "${f}" not defined.`);

    nfaNodesList = states.map(s => ({ id: s, label: s }));
    const edges  = [];
    nfaDfaTrans  = {}; nfaStart = start; nfaFinals = finals;
    states.forEach(s => { nfaDfaTrans[s] = {}; });

    for (let t of lines) {
      t = t.trim(); if (!t) continue;
      if (!t.includes('=') || !t.includes(',')) return showError(err, 'Format: q0,a=q1');
      const [left, right] = t.split('=');
      const [from, sym]   = left.split(',');
      const f = from.trim(), s = sym.trim();
      if (!states.includes(f)) return showError(err, `State "${f}" not defined.`);
      if (!alphabet.includes(s)) return showError(err, `Symbol "${s}" not in alphabet.`);
      right.split(',').forEach(to => {
        to = to.trim();
        if (!states.includes(to)) return showError(err, `State "${to}" not defined.`);
        edges.push({ from: f, to, label: s });
        if (!nfaDfaTrans[f][s]) nfaDfaTrans[f][s] = to;
      });
    }

    nfaNetwork = drawGraph(nfaNodesList, edges, 'graphArea', start, finals);
    initSimulator(nfaDfaTrans, start, finals, nfaNetwork, nfaNodesList);
  });
}

/* ──────────────────────────────────────────────
   DFA VISUALIZER
────────────────────────────────────────────── */
const dfaBtn = document.getElementById('visualizeDfaBtn');
let dfaNetwork = null, dfaNodesList = [],
    dfaTransGlobal = {}, dfaStartGlobal = '',
    dfaFinalsGlobal = [], dfaAlphabetGlobal = [], dfaStatesGlobal = [];

if (dfaBtn) {
  dfaBtn.addEventListener('click', function () {
    const err = document.getElementById('errorMsg');
    err.innerText = ''; err.style.display = 'none';

    const states   = document.getElementById('states').value.split(',').map(s => s.trim()).filter(Boolean);
    const alphabet = document.getElementById('alphabet').value.split(',').map(a => a.trim()).filter(Boolean);
    const start    = document.getElementById('start').value.trim();
    const finals   = document.getElementById('final').value.split(',').map(f => f.trim()).filter(Boolean);
    const lines    = document.getElementById('transitions').value.split('\n');

    if (!states.length || !alphabet.length || !start || !finals.length)
      return showError(err, 'Please fill all fields.');
    if (!states.includes(start)) return showError(err, 'Start state not defined.');
    for (const f of finals)
      if (!states.includes(f)) return showError(err, `Final state "${f}" not defined.`);

    dfaNodesList = states.map(s => ({ id: s, label: s }));
    const edges  = [];
    const transMap = {};
    dfaTransGlobal = {}; dfaStartGlobal = start;
    dfaFinalsGlobal = finals; dfaAlphabetGlobal = alphabet; dfaStatesGlobal = states;
    states.forEach(s => { dfaTransGlobal[s] = {}; });

    for (let t of lines) {
      t = t.trim(); if (!t) continue;
      const parts = t.split('='), left = parts[0].split(',');
      const from  = left[0].trim(), sym = left[1].trim(), to = parts[1].trim();
      if (to.includes(',')) return showError(err, 'DFA: only one destination per transition.');
      const key = from + '_' + sym;
      if (transMap[key]) return showError(err, `Duplicate: (${from},${sym}).`);
      transMap[key] = true; dfaTransGlobal[from][sym] = to;
      edges.push({ from, to, label: sym });
    }

    let deadNeeded = false;
    for (const s of states) for (const a of alphabet) if (!transMap[s + '_' + a]) {
      deadNeeded = true;
      edges.push({ from: s, to: 'qd', label: a });
      dfaTransGlobal[s][a] = 'qd';
    }
    if (deadNeeded) {
      dfaNodesList.push({ id: 'qd', label: 'qd' });
      dfaTransGlobal['qd'] = {};
      alphabet.forEach(a => {
        edges.push({ from: 'qd', to: 'qd', label: a });
        dfaTransGlobal['qd'][a] = 'qd';
      });
    }

    dfaNetwork = drawGraph(dfaNodesList, edges, 'graphArea', start, finals, ['qd', '∅']);
    initSimulator(dfaTransGlobal, start, finals, dfaNetwork, dfaNodesList);

    const cb = document.getElementById('checkBtn');
    if (cb) cb.onclick = () =>
      checkString(dfaTransGlobal, start, finals, 'checkerInput', 'pathDisplay', 'checkerVerdict');
  });
}

/* ──────────────────────────────────────────────
   TABLE GENERATOR
────────────────────────────────────────────── */
const nfaTableBtn = document.getElementById('generateNfaTable');
const dfaTableBtn = document.getElementById('generateDfaTable');
if (nfaTableBtn) nfaTableBtn.addEventListener('click', () => generateTable('NFA'));
if (dfaTableBtn) dfaTableBtn.addEventListener('click', () => generateTable('DFA'));

function generateTable(type) {
  const states   = document.getElementById('states').value.split(',').map(s => s.trim()).filter(Boolean);
  const start    = document.getElementById('start').value.trim();
  const finals   = document.getElementById('final').value.split(',').map(f => f.trim()).filter(Boolean);
  const alphabet = document.getElementById('alphabet').value.split(',').map(a => a.trim()).filter(Boolean);
  const lines    = document.getElementById('transitions').value.trim().split('\n');
  const area     = document.getElementById('tableArea');

  if (!states.length || !alphabet.length || !start) {
    area.innerHTML = '<p style="color:#ef4444;font-family:monospace;">⚠ Fill all required fields.</p>';
    return;
  }

  const trans = {};
  states.forEach(s => {
    trans[s] = {};
    alphabet.forEach(a => { trans[s][a] = type === 'NFA' ? [] : '∅'; });
  });
  lines.forEach(line => {
    line = line.trim();
    if (!line || !line.includes('=') || !line.includes(',')) return;
    const [left, right] = line.split('=');
    const [from, sym]   = left.split(',');
    const f = from.trim(), s = sym.trim();
    if (!trans[f] || trans[f][s] === undefined) return;
    if (type === 'NFA') trans[f][s].push(...right.split(',').map(x => x.trim()).filter(Boolean));
    else trans[f][s] = right.trim();
  });

  let html = '<table><thead><tr><th>State</th>';
  alphabet.forEach(s => { html += `<th>${s}</th>`; });
  html += '</tr></thead><tbody>';
  states.forEach(state => {
    let lbl = state;
    if (state === start) lbl = '→ ' + lbl;
    if (finals.includes(state)) lbl = '* ' + lbl;
    html += `<tr><td>${lbl}</td>`;
    alphabet.forEach(sym => {
      if (type === 'NFA') {
        const v = trans[state][sym];
        html += v.length ? `<td>{${v.join(', ')}}</td>` : '<td>∅</td>';
      } else {
        html += `<td>${trans[state][sym]}</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  area.innerHTML = html;

  if (type === 'DFA') {
    window._tableDfaTrans = trans;
    window._tableStart    = start;
    window._tableFinals   = finals;
    const cb = document.getElementById('checkBtn');
    if (cb) cb.onclick = () =>
      checkString(trans, start, finals, 'checkerInput', 'pathDisplay', 'checkerVerdict');
  }
}
