/* ================================================================
   interactions.js
   Features: ripple (3), confetti (2), quick examples (5)
   ================================================================ */

/* ══════════════════════════════════════
   3. BUTTON RIPPLE
══════════════════════════════════════ */
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn || btn.disabled) return;
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;` +
    `left:${e.clientX - rect.left - size/2}px;` +
    `top:${e.clientY  - rect.top  - size/2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
});

/* ══════════════════════════════════════
   2. CONFETTI on ACCEPTED verdict
══════════════════════════════════════ */
function launchConfetti() {
  let canvas = document.getElementById('_confettiCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = '_confettiCanvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
    document.body.appendChild(canvas);
  }
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#00d4ff','#7c3aed','#f59e0b','#10b981','#ffffff','#a78bfa','#fcd34d'];
  const pieces = Array.from({ length: 100 }, () => ({
    x:   Math.random() * canvas.width,
    y:  -10 - Math.random() * 100,
    w:   5 + Math.random() * 9,
    h:   3 + Math.random() * 5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx:  (Math.random() - 0.5) * 5,
    vy:   3 + Math.random() * 5,
    rot:  Math.random() * Math.PI * 2,
    vr:  (Math.random() - 0.5) * 0.18,
    alpha: 1
  }));

  let raf;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      if (p.alpha <= 0) return;
      alive = true;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > canvas.height * 0.65) p.alpha -= 0.022;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    if (alive) raf = requestAnimationFrame(draw);
    else { cancelAnimationFrame(raf); ctx.clearRect(0,0,canvas.width,canvas.height); canvas.remove(); }
  })();
}

/* Watch every .verdict element — fire confetti when it gets class "accepted" */
function watchVerdicts() {
  document.querySelectorAll('.verdict').forEach(el => {
    if (el._confettiWatched) return;
    el._confettiWatched = true;
    new MutationObserver(() => {
      if (el.classList.contains('accepted') && el.style.display !== 'none')
        launchConfetti();
    }).observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  });
}
document.addEventListener('DOMContentLoaded', () => {
  watchVerdicts();
  /* also re-scan after panels are shown dynamically */
  new MutationObserver(watchVerdicts)
    .observe(document.body, { childList: true, subtree: true });
});

/* ══════════════════════════════════════
   5. QUICK EXAMPLES DROPDOWN
   Reads EXAMPLES from nfa-dfa.js if present,
   otherwise uses page-specific presets.
══════════════════════════════════════ */
const PAGE_EXAMPLES = {
  /* NFA visualizer */
  'nfa-visual': [
    { label:'Simple 2-state NFA', states:'q0,q1', alphabet:'0,1', start:'q0', final:'q1', transitions:'q0,0=q1\nq1,1=q1' },
    { label:'3-state over {a,b}',  states:'q0,q1,q2', alphabet:'a,b', start:'q0', final:'q2', transitions:'q0,a=q0,q1\nq1,b=q2' },
    { label:'Ends in 01',          states:'q0,q1,q2', alphabet:'0,1', start:'q0', final:'q2', transitions:'q0,0=q0,q1\nq0,1=q0\nq1,1=q2' },
  ],
  /* DFA visualizer */
  'dfa-visual': [
    { label:'Even number of 0s',   states:'q0,q1', alphabet:'0,1', start:'q0', final:'q0', transitions:'q0,0=q1\nq0,1=q0\nq1,0=q0\nq1,1=q1' },
    { label:'Ends in 1',           states:'q0,q1', alphabet:'0,1', start:'q0', final:'q1', transitions:'q0,0=q0\nq0,1=q1\nq1,0=q0\nq1,1=q1' },
    { label:'Contains 101',        states:'q0,q1,q2,q3', alphabet:'0,1', start:'q0', final:'q3', transitions:'q0,0=q0\nq0,1=q1\nq1,0=q2\nq1,1=q1\nq2,0=q0\nq2,1=q3\nq3,0=q3\nq3,1=q3' },
  ],
  /* NFA table */
  'nfa-table': [
    { label:'Simple NFA',   states:'q0,q1,q2', alphabet:'a,b', start:'q0', final:'q2', transitions:'q0,a=q0,q1\nq1,b=q2' },
    { label:'Ends in 01',   states:'q0,q1,q2', alphabet:'0,1', start:'q0', final:'q2', transitions:'q0,0=q0,q1\nq0,1=q0\nq1,1=q2' },
  ],
  /* DFA table */
  'dfa-table': [
    { label:'Even 0s',  states:'q0,q1', alphabet:'0,1', start:'q0', final:'q0', transitions:'q0,0=q1\nq0,1=q0\nq1,0=q0\nq1,1=q1' },
    { label:'Ends in 1',states:'q0,q1', alphabet:'0,1', start:'q0', final:'q1', transitions:'q0,0=q0\nq0,1=q1\nq1,0=q0\nq1,1=q1' },
  ],
  /* NFA→DFA converter — famous regular language examples */
  'nfa-dfa': [
    { label:'(a|b)*abb — ends with abb',
      states:'q0,q1,q2,q3', alphabet:'a,b', start:'q0', final:'q3',
      transitions:'q0,a=q0,q1\nq0,b=q0\nq1,b=q2\nq2,b=q3' },
    { label:'a*b* — zero or more a\'s then b\'s',
      states:'q0,q1', alphabet:'a,b', start:'q0', final:'q0,q1',
      transitions:'q0,a=q0\nq0,b=q1\nq1,b=q1' },
    { label:'(ab)+ — one or more ab pairs',
      states:'q0,q1,q2', alphabet:'a,b', start:'q0', final:'q2',
      transitions:'q0,a=q1\nq1,b=q2\nq2,a=q1' },
    { label:'(0+1)*101(0+1)* — contains "101"',
      states:'q0,q1,q2,q3', alphabet:'0,1', start:'q0', final:'q3',
      transitions:'q0,0=q0\nq0,1=q0,q1\nq1,0=q2\nq2,1=q3\nq3,0=q3\nq3,1=q3' },
    { label:'(0+1)*00(0+1)* — contains "00"',
      states:'q0,q1,q2', alphabet:'0,1', start:'q0', final:'q2',
      transitions:'q0,0=q0,q1\nq0,1=q0\nq1,0=q2\nq2,0=q2\nq2,1=q2' },
    { label:'(a|b)*aa — ends with "aa"',
      states:'q0,q1,q2', alphabet:'a,b', start:'q0', final:'q2',
      transitions:'q0,b=q0\nq0,a=q0,q1\nq1,a=q2' },
  ],
};

function getPageKey() {
  const p = location.pathname.split('/').pop().replace('.html','');
  return p;
}

function injectQuickExamples() {
  const form = document.querySelector('.converter, .visualizer, .table-generator');
  if (!form || form.querySelector('.quick-examples')) return;

  const key = getPageKey();
  const list = PAGE_EXAMPLES[key];
  if (!list || !list.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'quick-examples';

  const sel = document.createElement('select');
  sel.innerHTML = '<option value="">⚡ Load a quick example…</option>' +
    list.map((ex, i) => `<option value="${i}">${ex.label}</option>`).join('');

  sel.addEventListener('change', () => {
    const idx = parseInt(sel.value);
    if (isNaN(idx)) return;
    const ex = list[idx];
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('states', ex.states);
    set('alphabet', ex.alphabet);
    set('start', ex.start);
    set('final', ex.final);
    set('transitions', ex.transitions);
    sel.value = '';   /* reset dropdown */

    /* flash the form to signal the fill */
    form.style.transition = 'box-shadow 0.3s';
    form.style.boxShadow = '0 0 0 2px var(--accent), 0 0 24px rgba(0,212,255,0.3)';
    setTimeout(() => { form.style.boxShadow = ''; }, 700);
  });

  wrapper.appendChild(sel);
  /* insert as first child of form */
  form.insertBefore(wrapper, form.firstChild);
}

document.addEventListener('DOMContentLoaded', injectQuickExamples);
