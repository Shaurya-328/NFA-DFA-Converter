/* ================================================================
   nfa-dfa.js  —  NFA→DFA Converter  v5
   LAYOUT-ONLY improvements in renderStepFrame:
   • Hierarchical LR layout (rankdir=LR)
   • Bidirectional edges curve to opposite sides
   • Self-loops positioned at top of node
   • Straight start arrow
   • doublecircle via custom renderer
   • Larger fonts for readability
   Zero changes to colours, logic, or functionality.
   ================================================================ */

/* Famous regular language examples */
const EXAMPLES = {
  1:{ states:'q0,q1,q2,q3', alphabet:'a,b', start:'q0', final:'q3',
      transitions:'q0,a=q0,q1\nq0,b=q0\nq1,b=q2\nq2,b=q3' },
  2:{ states:'q0,q1',       alphabet:'a,b', start:'q0', final:'q0,q1',
      transitions:'q0,a=q0\nq0,b=q1\nq1,b=q1' },
  3:{ states:'q0,q1,q2',   alphabet:'a,b', start:'q0', final:'q2',
      transitions:'q0,a=q1\nq1,b=q2\nq2,a=q1' },
  4:{ states:'q0,q1,q2,q3', alphabet:'0,1', start:'q0', final:'q3',
      transitions:'q0,0=q0\nq0,1=q0,q1\nq1,0=q2\nq2,1=q3\nq3,0=q3\nq3,1=q3' },
  5:{ states:'q0,q1,q2',   alphabet:'0,1', start:'q0', final:'q2',
      transitions:'q0,0=q0,q1\nq0,1=q0\nq1,0=q2\nq2,0=q2\nq2,1=q2' },
  6:{ states:'q0,q1,q2',   alphabet:'a,b', start:'q0', final:'q2',
      transitions:'q0,b=q0\nq0,a=q0,q1\nq1,a=q2' },
};

window.addEventListener('DOMContentLoaded', () => {
  const ex = new URLSearchParams(location.search).get('example');
  if (ex && EXAMPLES[ex]) {
    const d = EXAMPLES[ex];
    document.getElementById('states').value      = d.states;
    document.getElementById('alphabet').value    = d.alphabet;
    document.getElementById('start').value       = d.start;
    document.getElementById('final').value       = d.final;
    document.getElementById('transitions').value = d.transitions;
    setTimeout(() => document.getElementById('convertBtn').click(), 400);
  }
});

/* ── Parse NFA ── */
function parseNFA() {
  const states   = document.getElementById('states').value.split(',').map(s => s.trim()).filter(Boolean);
  const alphabet = document.getElementById('alphabet').value.split(',').map(a => a.trim()).filter(Boolean);
  const start    = document.getElementById('start').value.trim();
  const finals   = document.getElementById('final').value.split(',').map(f => f.trim()).filter(Boolean);
  const rawLines = document.getElementById('transitions').value.split('\n');
  const nfaTrans = {};
  states.forEach(s => { nfaTrans[s] = {}; alphabet.forEach(a => { nfaTrans[s][a] = []; }); });
  rawLines.forEach(line => {
    line = line.trim(); if (!line) return;
    const parts = line.split('='); if (parts.length < 2) return;
    const left  = parts[0].split(','); if (left.length < 2) return;
    const from  = left[0].trim(), symbol = left[1].trim();
    const toList = parts[1].split(',').map(s => s.trim()).filter(Boolean);
    if (nfaTrans[from] && nfaTrans[from][symbol] !== undefined)
      nfaTrans[from][symbol].push(...toList);
  });
  return { states, alphabet, start, finals, trans: nfaTrans };
}

/* ── Render static NFA (uses drawGraph from script.js) ── */
function renderNFAGraph(nfa) {
  const rawNodes = nfa.states.map(s => ({ id: s, label: s }));
  const rawEdges = [];
  nfa.states.forEach(from => {
    nfa.alphabet.forEach(sym => {
      (nfa.trans[from]?.[sym] || []).forEach(to => rawEdges.push({ from, to, label: sym }));
    });
  });
  return drawGraph(rawNodes, rawEdges, 'nfaGraph', nfa.start, nfa.finals);
}

/* ================================================================
   SUBSET CONSTRUCTION  (unchanged)
   ================================================================ */
function subsetConstruct(nfa) {
  const { alphabet, start, finals, trans: nfaTrans } = nfa;
  const dfaTransitions = {}, dfaFinals = [], visited = [], queue = [[start]], frames = [];
  let curNodes = new Map(), curEdges = new Map(), curActive = null;

  function snapshot(text, type) {
    frames.push({ text, type, nodes: new Map(curNodes), edges: new Map(curEdges), activeNode: curActive });
  }
  function addNode(id, isFinal, isStart) {
    if (!curNodes.has(id)) curNodes.set(id, { isFinal, isStart });
  }
  function addEdge(from, to, label) {
    const key = from + '__' + to;
    if (curEdges.has(key)) {
      const e = curEdges.get(key);
      if (!e.label.split(', ').includes(label)) curEdges.set(key, { ...e, label: e.label + ', ' + label });
    } else { curEdges.set(key, { from, to, label }); }
  }

  const startName = '{' + start + '}';
  addNode(startName, finals.includes(start), true);
  if (finals.includes(start)) dfaFinals.push(startName);
  snapshot(`🚀 Initial DFA state <b>${startName}</b>${finals.includes(start) ? ' — also a <b>final</b> state ⭐' : ''}`, 'normal');

  while (queue.length > 0) {
    const current = queue.shift();
    const name    = '{' + current.join(',') + '}';
    if (visited.includes(name)) continue;
    visited.push(name);
    dfaTransitions[name] = {};
    curActive = name;
    snapshot(`🔍 Processing DFA state <b>${name}</b>`, 'highlight');

    alphabet.forEach(symbol => {
      let nextStates = [];
      current.forEach(state => { const r = (nfaTrans[state]?.[symbol]) || []; nextStates.push(...r); });
      nextStates = [...new Set(nextStates)].sort();
      const nextName  = nextStates.length ? '{' + nextStates.join(',') + '}' : '∅';
      dfaTransitions[name][symbol] = nextName;
      const isNew     = nextStates.length > 0 && !visited.includes(nextName) &&
                        !queue.some(q => '{' + q.join(',') + '}' === nextName);
      const nextFinal = nextStates.some(s => finals.includes(s));
      if (nextStates.length > 0 && !curNodes.has(nextName)) {
        addNode(nextName, nextFinal, false);
        if (nextFinal && !dfaFinals.includes(nextName)) dfaFinals.push(nextName);
      } else if (nextStates.length === 0 && !curNodes.has('∅')) {
        addNode('∅', false, false);
      }
      addEdge(name, nextName, symbol);
      const desc = nextStates.length === 0
        ? `δ(<b>${name}</b>, <b>${symbol}</b>) = <b>∅</b> — dead state`
        : isNew
          ? `δ(<b>${name}</b>, <b>${symbol}</b>) = <b>${nextName}</b>${nextFinal ? ' ⭐ new final state' : ' — new state'}`
          : `δ(<b>${name}</b>, <b>${symbol}</b>) = <b>${nextName}</b>`;
      snapshot(desc, nextFinal && isNew ? 'final-state' : 'normal');
      if (isNew) queue.push(nextStates);
    });
    curActive = null;
  }

  if ([...curNodes.keys()].includes('∅')) {
    visited.push('∅');
    dfaTransitions['∅'] = {};
    alphabet.forEach(sym => { dfaTransitions['∅'][sym] = '∅'; addEdge('∅', '∅', sym); });
    snapshot(`💀 Dead state <b>∅</b> traps all symbols`, 'highlight');
  }
  snapshot(`✅ Conversion complete — <b>${visited.length}</b> DFA state(s)`, 'done');
  return { dfaTransitions, dfaStates: visited, dfaFinals, alphabet, frames, startName };
}

/* ================================================================
   DFA STEP ANIMATION
   LAYOUT improvements applied here mirror those in drawGraph:
   • Hierarchical LR layout
   • Bidirectional pairs get CW/CCW curves
   • Self-loops use selfReference.angle = top of node
   • Custom doublecircle renderer for final states
   • Straight start arrow
   • Larger fonts
   All colours UNCHANGED.
   ================================================================ */
window._dfaNetwork = null;
// _dfaNetwork exposed via window._dfaNetwork

function initDFAStepNetwork() {
  const container = document.getElementById('dfaGraph');
  if (!container) return;
  container.innerHTML = '';
  container.style.height = '520px';
  const light = document.body.classList.contains('light');

  _dfaNetwork = window._dfaNetwork = new vis.Network(
    container,
    { nodes: new vis.DataSet([]), edges: new vis.DataSet([]) },
    {
      nodes: {
        chosen: true,
        shape: 'ellipse', size: 28,
        font: { color: light ? '#0f172a' : '#e2e8f0', size: 15, face: 'Space Mono, monospace' },
        borderWidth: 2,
        mass: 1.5,
      },
      edges: {
        chosen: false,
        color: { color: light ? '#334155' : '#00d4ff' },
        font: {
          color:      light ? '#0f172a' : '#e2e8f0',
          size: 14, face: 'Space Mono, monospace', align: 'middle',
          background: 'transparent',
          strokeWidth: 0,
        },
        width: 1.8,
        arrows: { to: { enabled: true, scaleFactor: 0.85 } },
        smooth: { type: 'dynamic', roundness: 0 },
        selectionWidth: 0, hoverWidth: 0.6,
      },
      interaction: {
        zoomView: true, dragView: true, dragNodes: true,
        hover: true, selectConnectedEdges: false,
      },
      /* LAYOUT: hierarchical LR for step panel too */
      layout: {
        hierarchical: {
          enabled:          true,
          direction:        'LR',
          sortMethod:       'directed',
          levelSeparation:  300,
          nodeSpacing:      180,
          treeSpacing:      180,
          shakeTowards:     'roots',
          edgeMinimization: true,
          blockShifting:    true,
          parentCentralization: true,
        },
      },
      physics: { enabled: false },
    }
  );
}

function renderStepFrame(frame, dfaFinals, dfaStartName) {
  if (!_dfaNetwork) return;
  const light = document.body.classList.contains('light');

  /* ── Nodes ── */
  const nodes = [];
  frame.nodes.forEach(({ isFinal, isStart }, id) => {
    const isActive = id === frame.activeNode;
    const isDead   = id === '∅';

    /* Colours: identical to v4 — NOT changed */
    let bg, border, fontCol, bw;
    let shadow = null;
    if (isActive) {
      bg = '#7c3aed'; border = '#a78bfa'; fontCol = '#fff'; bw = 3;
      shadow = { enabled: true, color: '#a78bfa', size: 12, x: 0, y: 0 };
    } else if (isDead) {
      bg = light ? '#fecaca' : '#2d0a0a'; border = light ? '#dc2626' : '#ef4444';
      fontCol = light ? '#7f1d1d' : '#fca5a5'; bw = 2;
    } else if (isStart && isFinal) {
      bg = light ? '#fef08a' : '#2d200a'; border = light ? '#ca8a04' : '#eab308';
      fontCol = light ? '#713f12' : '#fde047'; bw = 4;
      shadow = { enabled: true, color: light ? '#ca8a04' : '#eab308', size: 9, x: 0, y: 0 };
    } else if (isStart) {
      bg = light ? '#bbf7d0' : '#052e16'; border = light ? '#16a34a' : '#22c55e';
      fontCol = light ? '#14532d' : '#86efac'; bw = 3;
      shadow = { enabled: true, color: light ? '#16a34a' : '#22c55e', size: 5, x: 0, y: 0 };
    } else if (isFinal) {
      bg = light ? '#bfdbfe' : '#0c1a35'; border = light ? '#2563eb' : '#3b82f6';
      fontCol = light ? '#1e3a8a' : '#93c5fd'; bw = 4;
      shadow = { enabled: true, color: light ? '#2563eb' : '#3b82f6', size: 8, x: 0, y: 0 };
    } else {
      bg = light ? '#e2e8f0' : '#0d1f38'; border = light ? '#475569' : '#00d4ff';
      fontCol = light ? '#0f172a' : '#e2e8f0'; bw = 2;
    }

    const node = {
      id,
      label: id.replace(/[{}]/g, ''),
      title: id,
      /* LAYOUT: custom renderer for doublecircle on final states */
      shape: 'custom',
      ctxRenderer: buildStepNodeRenderer(bg, border, isFinal, isActive, id),
      size: isFinal ? 34 : 28,
      color: { background: bg, border,
               highlight: { background: bg, border },
               hover:      { background: bg, border } },
      font: { color: fontCol, size: 15, face: 'Space Mono, monospace' },
      borderWidth: bw,
      chosen: true,
      mass: 1.5,
    };
    if (shadow) node.shadow = shadow;
    nodes.push(node);
  });

  /* Ghost start node */
  nodes.push({
    id: '__ghost__', label: '', size: 2, shape: 'dot', chosen: false,
    color: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
             highlight: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' } },
    mass: 0.05, physics: true,
  });

  /* ── Edges ── */
  /* Merge parallel edges sharing same (from,to) into one with combined label
     — prevents multiple self-loops stacking at the same angle/position */
  const allEdges = [...frame.edges.values()];
  const stepMergeMap = new Map();
  allEdges.forEach(e => {
    const k = `${e.from}__${e.to}`;
    if (!stepMergeMap.has(k)) {
      stepMergeMap.set(k, { ...e });
    } else {
      const ex = stepMergeMap.get(k);
      const lbls = ex.label.split(', ');
      if (!lbls.includes(e.label)) ex.label = ex.label + ', ' + e.label;
    }
  });
  const stepEdgeList = [...stepMergeMap.values()];

  /* Group by (from, to) for slot-based curvature */
  const stepSlotMap = {};
  stepEdgeList.forEach((e, i) => {
    const k = `${e.from}__${e.to}`;
    if (!stepSlotMap[k]) stepSlotMap[k] = [];
    stepSlotMap[k].push(i);
  });

  /* Detect bidirectional pairs */
  const stepPairKeys = new Set(Object.keys(stepSlotMap));
  const stepHasPair  = {};
  Object.keys(stepSlotMap).forEach(k => {
    const [a, b] = k.split('__');
    if (stepPairKeys.has(`${b}__${a}`)) stepHasPair[k] = true;
  });

  /* Same curvature rules as drawGraph */
  function stepRoundness(slot, total, bidir, side) {
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

  const edges = [];
  let ei = 0;
  stepEdgeList.forEach(({ from, to, label }, i) => {
    const isSelf    = from === to;
    const pairKey   = `${from}__${to}`;
    const revKey    = `${to}__${from}`;
    const bidir     = !!stepHasPair[pairKey];
    const slot      = stepSlotMap[pairKey].indexOf(i);
    const total     = stepSlotMap[pairKey].length;
    const side      = bidir ? (pairKey < revKey ? 1 : -1) : 0;
    const isDead    = to === '∅';
    const col       = isDead ? deadEdgeColor : edgeColor;

    let smooth;
    if (isSelf) {
      smooth = { enabled: true, type: 'curvedCW', roundness: 0.5 };
    } else {
      const r = stepRoundness(slot, total, bidir, side);
      smooth  = r === 0
        ? { enabled: false }
        : { enabled: true, type: 'curvedCW', roundness: r };
    }

    const r            = isSelf ? 0 : stepRoundness(slot, total, bidir, side);
    const labelVadjust = isSelf ? -26 : r > 0 ? -10 : r < 0 ? 10 : -8;

    const edge = {
      id: 'fe_' + (ei++),
      from, to,
      label: label || '',
      smooth,
      arrows: { to: { enabled: true, scaleFactor: 0.95 } },
      color: { color: col, highlight: col, hover: col },
      font: {
        color:       labelColor,
        size:        14,
        face:        'Space Mono, monospace',
        align:       'middle',
        background:  labelBg,
        strokeWidth: 0,
        vadjust:     labelVadjust,
      },
      width: 1.8, chosen: false, selectionWidth: 0, hoverWidth: 0.6,
    };

    if (isSelf) {
      edge.selfReference = { size: 40, angle: Math.PI / 2, renderBehindTheNode: true };
      edge.font.vadjust  = -26;
    }

    edges.push(edge);
  });

  /* Start arrow */
  edges.push({
    id: '__startedge__',
    from: '__ghost__', to: dfaStartName,
    label: '', arrows: { to: { enabled: true, scaleFactor: 0.9 } },
    color: { color: light ? '#16a34a' : '#22c55e' }, width: 2.2,
    smooth: { enabled: true, type: 'straightCross', roundness: 0 },
    chosen: false, font: { size: 0 },
  });

  _dfaNetwork.setData({ nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) });

  /* After hierarchical layout computes, anchor ghost node and fit */
  _dfaNetwork.once('afterDrawing', () => {
    try {
      const sp = _dfaNetwork.getPosition(dfaStartName);
      _dfaNetwork.moveNode('__ghost__', sp.x - 70, sp.y);
    } catch (_) {}
    _dfaNetwork.fit({ animation: { duration: 250, easingFunction: 'easeInOutQuad' } });
  });
}

/* Custom renderer for step-panel nodes — same doublecircle logic as drawGraph */
function buildStepNodeRenderer(bg, border, isFinal, isActive, nodeId) {
  return ({ ctx, x, y, state, style }) => {
    const r = style.size || 28;
    if (isFinal) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = border;
      ctx.lineWidth   = isActive ? 2.5 : 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle   = bg;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth   = isFinal ? 3 : (isActive ? 3 : 2);
    ctx.stroke();

    /* ── Label drawn directly so it's always visible ── */
    const light = document.body.classList.contains('light');
    const fontCol = isActive ? '#ffffff' : (light ? '#0f172a' : '#e2e8f0');
    const displayLabel = String(nodeId || '').replace(/[{}]/g, '');
    if (displayLabel) {
      ctx.font         = '600 13px "Space Mono", monospace';
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

/* Build DFA transition table — unchanged */
function buildTable(dfa) {
  const s0  = dfa.dfaStates[0];
  let html  = '<table><thead><tr><th>DFA State</th>';
  dfa.alphabet.forEach(a => { html += `<th>${a}</th>`; });
  html += '</tr></thead><tbody>';
  dfa.dfaStates.forEach(state => {
    let lbl = state;
    if (dfa.dfaFinals.includes(state)) lbl = '* ' + lbl;
    if (state === s0)                  lbl = '→ ' + lbl;
    html += `<tr><td>${lbl}</td>`;
    dfa.alphabet.forEach(a => { html += `<td>${dfa.dfaTransitions[state][a] || '∅'}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('dfaTable').innerHTML = html;
}

/* ================================================================
   STEP CONTROLLER  (unchanged)
   ================================================================ */
let _dfa = null, _frames = [], _stepIdx = 0, _timer = null;

function getStepSpeed() {
  const s = document.getElementById('speedSlider'); return s ? parseInt(s.value) : 900;
}
function stopAutoplay() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  const btn = document.getElementById('playBtn');
  if (btn) { btn.textContent = '▶ Play'; btn.classList.remove('playing'); }
}
function goToStep(idx) {
  if (!_frames.length) return;
  idx = Math.max(0, Math.min(idx, _frames.length - 1));
  _stepIdx = idx;
  renderStepFrame(_frames[idx], _dfa.dfaFinals, _dfa.dfaStates[0]);
  const box = document.getElementById('stepBox');
  if (box) { box.innerHTML = _frames[idx].text; box.className = 'step-box ' + (_frames[idx].type || 'normal'); }
  document.getElementById('stepCounter').textContent = `Step ${idx + 1} / ${_frames.length}`;
  document.getElementById('prevBtn').disabled = idx <= 0;
  document.getElementById('nextBtn').disabled = idx >= _frames.length - 1;
  if (idx >= _frames.length - 1) stopAutoplay();
}
function wireStepControls() {
  document.getElementById('prevBtn').onclick    = () => { stopAutoplay(); goToStep(_stepIdx - 1); };
  document.getElementById('nextBtn').onclick    = () => { stopAutoplay(); goToStep(_stepIdx + 1); };
  document.getElementById('showAllBtn').onclick = () => { stopAutoplay(); goToStep(_frames.length - 1); };
  document.getElementById('playBtn').onclick = function () {
    if (_timer) { stopAutoplay(); }
    else {
      if (_stepIdx >= _frames.length - 1) goToStep(0);
      this.textContent = '⏸ Pause'; this.classList.add('playing');
      _timer = setInterval(() => goToStep(_stepIdx + 1), getStepSpeed());
    }
  };
  const slider = document.getElementById('speedSlider');
  if (slider) slider.oninput = () => {
    const lbl = document.getElementById('speedLabel');
    if (lbl) lbl.textContent = (slider.value / 1000).toFixed(1) + 's';
    if (_timer) {
      stopAutoplay(); _timer = setInterval(() => goToStep(_stepIdx + 1), getStepSpeed());
      document.getElementById('playBtn').textContent = '⏸ Pause';
      document.getElementById('playBtn').classList.add('playing');
    }
  };
}

/* ================================================================
   MAIN CONVERT BUTTON  (unchanged)
   ================================================================ */
document.getElementById('convertBtn').addEventListener('click', () => {
  stopAutoplay();
  const nfa = parseNFA();
  if (!nfa.states.length || !nfa.alphabet.length || !nfa.start || !nfa.finals.length) {
    document.getElementById('dfaTable').innerHTML =
      '<p style="color:var(--red);font-family:monospace;padding:12px;">⚠ Please fill all required fields.</p>';
    return;
  }

  renderNFAGraph(nfa);

  _dfa = subsetConstruct(nfa); _frames = _dfa.frames; _stepIdx = 0;

  document.getElementById('stepControls').style.display = 'flex';
  document.getElementById('dfaChecker').style.display   = 'block';

  initDFAStepNetwork();
  wireStepControls();
  goToStep(0);

  setTimeout(() => attachExpandStepButton('dfaGraph'), 400);

  buildTable(_dfa);
  showMinimizePanel();

  /* ── Expose DFA data globally so the simulator (in HTML) can access it ── */
  window._activeDFA = {
    trans:  _dfa.dfaTransitions,
    start:  _dfa.dfaStates[0],
    finals: _dfa.dfaFinals,
    states: _dfa.dfaStates,
  };

  /* ── Load button wires up the simulator ── */
  document.getElementById('checkBtn').onclick = () => {
    if (typeof dfaSimLoad === 'function') dfaSimLoad();
  };
});

/* ================================================================
   FULLSCREEN STEP MODAL  — shows step-by-step converter in fullscreen
   ================================================================ */
let _modalNetwork = null;
let _modalTimer   = null;
let _modalStepIdx = 0;

function attachExpandStepButton(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const old = container.querySelector('.graph-expand-btn');
  if (old) old.remove();
  const btn = document.createElement('button');
  btn.className = 'graph-expand-btn';
  btn.title     = 'Expand step-by-step converter fullscreen';
  btn.innerHTML = '⛶';
  container.appendChild(btn);
  btn.addEventListener('click', () => openStepModal());
}

function openStepModal() {
  if (!_frames || !_frames.length) return;

  const light = document.body.classList.contains('light');

  /* ── Overlay ── */
  const overlay = document.createElement('div');
  overlay.className = 'graph-modal-overlay';

  /* ── Box ── */
  const box = document.createElement('div');
  box.className = 'graph-modal-box step-modal-box';

  /* ── Header row ── */
  const header = document.createElement('div');
  header.className = 'step-modal-header';
  header.innerHTML = `
    <span class="step-modal-title">NFA → DFA  &nbsp;<span style="opacity:.5;font-size:11px;">Step-by-Step Converter</span></span>
  `;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'graph-modal-close';
  closeBtn.innerHTML = '✕ Close';
  header.appendChild(closeBtn);
  box.appendChild(header);

  /* ── Hint ── */
  const hint = document.createElement('div');
  hint.className   = 'graph-modal-hint';
  hint.textContent = 'Drag nodes • Scroll to zoom • Double-click canvas to fit';
  box.appendChild(hint);

  /* ── Step description ── */
  const stepBox = document.createElement('div');
  stepBox.className = 'step-box step-modal-stepbox';
  box.appendChild(stepBox);

  /* ── Canvas ── */
  const canvas = document.createElement('div');
  canvas.className = 'graph-modal-canvas step-modal-canvas';
  box.appendChild(canvas);

  /* ── Step controls ── */
  const ctrl = document.createElement('div');
  ctrl.className = 'step-modal-controls';
  ctrl.innerHTML = `
    <button id="mPrevBtn" disabled>◀ Prev</button>
    <button id="mPlayBtn">▶ Play</button>
    <button id="mNextBtn">Next ▶</button>
    <button id="mShowAllBtn">⏭ Show All</button>
    <span   id="mStepCounter" class="step-modal-counter">Step — / —</span>
    <div    class="speed-row">
      <span>Speed</span>
      <input type="range" id="mSpeedSlider" min="300" max="2000" value="900" step="100" style="-webkit-appearance:none;width:88px;height:4px;background:var(--border);border-radius:2px;outline:none;cursor:pointer;">
      <span  id="mSpeedLabel">0.9s</span>
    </div>
  `;
  box.appendChild(ctrl);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  /* ── Init vis.js network in modal ── */
  _modalNetwork = new vis.Network(
    canvas,
    { nodes: new vis.DataSet([]), edges: new vis.DataSet([]) },
    {
      nodes: {
        chosen: true,
        shape: 'ellipse', size: 28,
        font: { color: light ? '#0f172a' : '#e2e8f0', size: 15, face: 'Space Mono, monospace' },
        borderWidth: 2, mass: 1.5,
      },
      edges: {
        chosen: false,
        color: { color: light ? '#334155' : '#00d4ff' },
        font: { color: light ? '#0f172a' : '#e2e8f0', size: 14, face: 'Space Mono, monospace', align: 'middle', background: 'transparent', strokeWidth: 0 },
        width: 1.8,
        arrows: { to: { enabled: true, scaleFactor: 0.85 } },
        smooth: { type: 'dynamic', roundness: 0 },
        selectionWidth: 0, hoverWidth: 0.6,
      },
      interaction: { zoomView: true, dragView: true, dragNodes: true, hover: true, selectConnectedEdges: false },
      layout: {
        hierarchical: {
          enabled: true, direction: 'LR', sortMethod: 'directed',
          levelSeparation: 300, nodeSpacing: 180, treeSpacing: 180,
          shakeTowards: 'roots', edgeMinimization: true,
          blockShifting: true, parentCentralization: true,
        },
      },
      physics: { enabled: false },
    }
  );

  canvas.addEventListener('dblclick', () => _modalNetwork && _modalNetwork.fit({ animation: true }));

  /* ── Sync to current step index ── */
  _modalStepIdx = _stepIdx;

  function mRenderFrame(idx) {
    idx = Math.max(0, Math.min(idx, _frames.length - 1));
    _modalStepIdx = idx;
    /* Reuse renderStepFrame but targeting the modal network */
    const savedNet = _dfaNetwork;
    _dfaNetwork = window._dfaNetwork = _modalNetwork;
    renderStepFrame(_frames[idx], _dfa.dfaFinals, _dfa.dfaStates[0]);
    _dfaNetwork = window._dfaNetwork = savedNet;

    stepBox.innerHTML  = _frames[idx].text;
    stepBox.className  = 'step-box step-modal-stepbox ' + (_frames[idx].type || 'normal');
    document.getElementById('mStepCounter').textContent = `Step ${idx + 1} / ${_frames.length}`;
    document.getElementById('mPrevBtn').disabled = idx <= 0;
    document.getElementById('mNextBtn').disabled = idx >= _frames.length - 1;
    if (idx >= _frames.length - 1) mStopPlay();
  }

  function mStopPlay() {
    if (_modalTimer) { clearInterval(_modalTimer); _modalTimer = null; }
    const pb = document.getElementById('mPlayBtn');
    if (pb) { pb.textContent = '▶ Play'; pb.classList.remove('playing'); }
  }

  function mGetSpeed() {
    const s = document.getElementById('mSpeedSlider');
    return s ? parseInt(s.value) : 900;
  }

  document.getElementById('mPrevBtn').onclick    = () => { mStopPlay(); mRenderFrame(_modalStepIdx - 1); };
  document.getElementById('mNextBtn').onclick    = () => { mStopPlay(); mRenderFrame(_modalStepIdx + 1); };
  document.getElementById('mShowAllBtn').onclick = () => { mStopPlay(); mRenderFrame(_frames.length - 1); };
  document.getElementById('mPlayBtn').onclick = function () {
    if (_modalTimer) { mStopPlay(); }
    else {
      if (_modalStepIdx >= _frames.length - 1) mRenderFrame(0);
      this.textContent = '⏸ Pause'; this.classList.add('playing');
      _modalTimer = setInterval(() => mRenderFrame(_modalStepIdx + 1), mGetSpeed());
    }
  };
  const mSlider = document.getElementById('mSpeedSlider');
  if (mSlider) mSlider.oninput = () => {
    const lbl = document.getElementById('mSpeedLabel');
    if (lbl) lbl.textContent = (mSlider.value / 1000).toFixed(1) + 's';
    if (_modalTimer) {
      mStopPlay();
      _modalTimer = setInterval(() => mRenderFrame(_modalStepIdx + 1), mGetSpeed());
      const pb = document.getElementById('mPlayBtn');
      if (pb) { pb.textContent = '⏸ Pause'; pb.classList.add('playing'); }
    }
  };

  const dismiss = () => {
    mStopPlay();
    _modalNetwork = null;
    document.body.removeChild(overlay);
  };
  closeBtn.addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });

  /* Initial render */
  mRenderFrame(_modalStepIdx);
}

/* =========================================================
   DFA MINIMIZATION  —  Hopcroft / Table-Filling Algorithm
   ========================================================= */

/**
 * Minimise a DFA described by the result of subsetConstruct().
 * Returns { minStates, minFinals, minTransitions, alphabet,
 *           partitions, stateMap, mergedCount }
 */
function minimizeDFA(dfa) {
  const { dfaStates, dfaFinals, dfaTransitions, alphabet } = dfa;

  // Remove unreachable states first
  const reachable = new Set();
  const rq = [dfaStates[0]];
  reachable.add(dfaStates[0]);
  while (rq.length) {
    const s = rq.shift();
    alphabet.forEach(sym => {
      const t = (dfaTransitions[s] || {})[sym];
      if (t && !reachable.has(t)) { reachable.add(t); rq.push(t); }
    });
  }
  const states = dfaStates.filter(s => reachable.has(s));

  // Initial partition: finals | non-finals
  const isFinal = s => dfaFinals.includes(s);
  let partitions = [];
  const finals    = states.filter(isFinal);
  const nonFinals = states.filter(s => !isFinal(s));
  if (finals.length)    partitions.push(finals);
  if (nonFinals.length) partitions.push(nonFinals);

  // Helper: which partition index does state s belong to?
  function partIdx(s, parts) {
    for (let i = 0; i < parts.length; i++)
      if (parts[i].includes(s)) return i;
    return -1;
  }

  // Refine until stable
  let changed = true;
  while (changed) {
    changed = false;
    const next = [];
    for (const group of partitions) {
      if (group.length === 1) { next.push(group); continue; }
      // Split group: states that have the same signature stay together
      const sig = s => alphabet.map(sym => {
        const t = (dfaTransitions[s] || {})[sym];
        return t ? partIdx(t, partitions) : -1;
      }).join(',');
      const buckets = {};
      group.forEach(s => { const k = sig(s); (buckets[k] = buckets[k] || []).push(s); });
      const splits = Object.values(buckets);
      if (splits.length > 1) changed = true;
      splits.forEach(b => next.push(b));
    }
    partitions = next;
  }

  // Build minimized DFA
  // Representative of each partition = first state alphabetically
  const rep = g => g.slice().sort()[0];
  // Map every state → its representative
  const stateMap = {};
  states.forEach(s => { stateMap[s] = rep(partitions[partIdx(s, partitions)]); });

  const minStates = [...new Set(states.map(s => stateMap[s]))];
  const minFinals = [...new Set(dfaFinals.filter(s => reachable.has(s)).map(s => stateMap[s]))];
  const minStart  = stateMap[dfaStates[0]];

  const minTransitions = {};
  minStates.forEach(ms => {
    minTransitions[ms] = {};
    alphabet.forEach(sym => {
      const t = (dfaTransitions[ms] || {})[sym];
      if (!t || t === '∅') {
        minTransitions[ms][sym] = '∅';
      } else {
        minTransitions[ms][sym] = stateMap[t] !== undefined ? stateMap[t] : '∅';
      }
    });
  });

  // Sort minStates so start state is first
  minStates.sort((a, b) => (a === minStart ? -1 : b === minStart ? 1 : 0));

  const mergedCount = states.length - minStates.length;

  return { minStates, minFinals, minTransitions, alphabet,
           partitions, stateMap, mergedCount, minStart,
           originalCount: states.length };
}

/* ── Draw minimized DFA graph ──
   Delegates entirely to drawGraph() (script.js) — the same function
   used for the NFA and DFA graphs — so all features are identical:
   ctxRenderer double-circles, ghost start arrow, smart edge merging,
   bidirectional arc separation, hierarchical LR layout, expand button.
*/
function drawMinDFA(result) {
  const { minStates, minFinals, minTransitions, alphabet, minStart } = result;

  // Build rawNodes in the format drawGraph expects
  const rawNodes = minStates.map(s => ({ id: s, label: s }));

  // Build rawEdges — one entry per (from, symbol, to) triple;
  // drawGraph handles merging parallel edges itself
  const rawEdges = [];
  // Detect if any transition goes to ∅ (even if ∅ was merged into another state)
  const hasDeadEdges = minStates.some(s =>
    alphabet.some(sym => minTransitions[s][sym] === '∅')
  );
  // If ∅ is not already a named min-state but transitions lead to it, add it as a node
  const needsDeadNode = hasDeadEdges && !minStates.includes('∅');

  minStates.forEach(s => {
    alphabet.forEach(sym => {
      const t = minTransitions[s][sym];
      if (t && t !== '∅') rawEdges.push({ from: s, to: t, label: sym });
      else if (t === '∅') rawEdges.push({ from: s, to: '∅', label: sym });
    });
  });

  // Dead states (∅) — include in nodes/edges so dead-state styling applies
  const deadStates = [];
  if (minStates.includes('∅') || needsDeadNode) {
    deadStates.push('∅');
    if (needsDeadNode) {
      // Add ∅ as an explicit node and its self-loops
      rawNodes.push({ id: '∅', label: '∅' });
      alphabet.forEach(sym => rawEdges.push({ from: '∅', to: '∅', label: sym }));
    }
  }

  // drawGraph returns the vis.Network instance; store it so export works
  window._minNetRef = drawGraph(rawNodes, rawEdges, 'minDfaGraph', minStart, minFinals, deadStates);
}

/* ── Build minimized DFA transition table HTML ── */
function buildMinDFATable(result) {
  const { minStates, minFinals, minTransitions, alphabet, minStart } = result;
  let html = `<table><thead><tr><th>State</th>${alphabet.map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>`;
  minStates.forEach(s => {
    const isF = minFinals.includes(s);
    const isS = s === minStart;
    let lbl = '';
    if (isS) lbl += '→ ';
    if (isF) lbl += '* ';
    lbl += s;
    html += `<tr><td>${lbl}</td>`;
    alphabet.forEach(a => { html += `<td>${minTransitions[s][a] || '∅'}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('minDfaTable').innerHTML = html;
}

/* ── Stats bar HTML ── */
function buildMinStats(result) {
  const { originalCount, minStates, mergedCount } = result;
  const pct = originalCount > 0 ? Math.round((mergedCount / originalCount) * 100) : 0;
  document.getElementById('minimizeStats').innerHTML = `
    <div class="mstat"><strong>${originalCount}</strong>DFA states (before)</div>
    <div class="mstat highlight"><strong>${minStates.length}</strong>States (minimized)</div>
    <div class="mstat saved"><strong>${mergedCount > 0 ? '−'+mergedCount : '0'}</strong>States eliminated</div>
    <div class="mstat"><strong>${pct}%</strong>Reduction</div>
  `;
}

/* ── Wire up the Minimize button ── */
document.addEventListener('DOMContentLoaded', () => {
  const minimizeBtn = document.getElementById('minimizeBtn');
  if (!minimizeBtn) return;

  minimizeBtn.addEventListener('click', () => {
    if (!_dfa) {
      alert('Please convert an NFA to DFA first.');
      return;
    }
    const result = minimizeDFA(_dfa);

    buildMinStats(result);
    buildMinDFATable(result);

    // Show the result container FIRST so the graph div has real dimensions,
    // then draw the vis.js network in the next animation frame.
    document.getElementById('minimizeResult').style.display = 'block';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawMinDFA(result);
        setTimeout(() => {
          document.getElementById('minimizeResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    });
  });
});

/* ── Show minimize panel once DFA is ready ── */
function showMinimizePanel() {
  const panel = document.getElementById('minimizePanel');
  if (panel) {
    panel.style.display = 'block';
    // Reset result so user can re-minimize after a new conversion
    document.getElementById('minimizeResult').style.display = 'none';
  }
}
/* ── Build minimized DFA transition table HTML ── */
function buildMinDFATable(result) {
  const { minStates, minFinals, minTransitions, alphabet, minStart } = result;
  let html = `<table><thead><tr><th>State</th>${alphabet.map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>`;
  minStates.forEach(s => {
    const isF = minFinals.includes(s);
    const isS = s === minStart;
    let lbl = '';
    if (isS) lbl += '→ ';
    if (isF) lbl += '* ';
    lbl += s;
    html += `<tr><td>${lbl}</td>`;
    alphabet.forEach(a => { html += `<td>${minTransitions[s][a] || '∅'}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('minDfaTable').innerHTML = html;
}

/* ── Stats bar HTML ── */
function buildMinStats(result) {
  const { originalCount, minStates, mergedCount } = result;
  const pct = originalCount > 0 ? Math.round((mergedCount / originalCount) * 100) : 0;
  document.getElementById('minimizeStats').innerHTML = `
    <div class="mstat"><strong>${originalCount}</strong>DFA states (before)</div>
    <div class="mstat highlight"><strong>${minStates.length}</strong>States (minimized)</div>
    <div class="mstat saved"><strong>${mergedCount > 0 ? '−'+mergedCount : '0'}</strong>States eliminated</div>
    <div class="mstat"><strong>${pct}%</strong>Reduction</div>
  `;
}

/* ── Wire up the Minimize button ── */
document.addEventListener('DOMContentLoaded', () => {
  const minimizeBtn = document.getElementById('minimizeBtn');
  if (!minimizeBtn) return;

  minimizeBtn.addEventListener('click', () => {
    if (!_dfa) {
      alert('Please convert an NFA to DFA first.');
      return;
    }
    const result = minimizeDFA(_dfa);

    buildMinStats(result);
    buildMinDFATable(result);

    // Show the result container FIRST so the graph div has real dimensions,
    // then draw the vis.js network in the next animation frame.
    document.getElementById('minimizeResult').style.display = 'block';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawMinDFA(result);
        setTimeout(() => {
          document.getElementById('minimizeResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    });
  });
});

/* ── Show minimize panel once DFA is ready ── */
function showMinimizePanel() {
  const panel = document.getElementById('minimizePanel');
  if (panel) {
    panel.style.display = 'block';
    // Reset result so user can re-minimize after a new conversion
    document.getElementById('minimizeResult').style.display = 'none';
  }
}
