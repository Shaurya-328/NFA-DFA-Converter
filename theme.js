/* =============================================
   theme.js  —  Dark/Light mode + Navbar inject
   ============================================= */

(function () {

  /* ── Inject navbar ── */
  const page = location.pathname.split('/').pop() || 'index.html';

  const navHTML = `
  <nav class="navbar">
    <a class="navbar-brand" href="homepage.html">⚡ Automata Toolkit</a>
    <div class="navbar-links">
      <a href="theory.html"    ${page==='theory.html'?'class="active"':''}>Theory</a>
      <a href="nfa-visual.html" ${page==='nfa-visual.html'?'class="active"':''}>NFA</a>
      <a href="dfa-visual.html" ${page==='dfa-visual.html'?'class="active"':''}>DFA</a>
      <a href="nfa-dfa.html"   ${page==='nfa-dfa.html'?'class="active"':''}>Convert</a>
      <a href="nfa-table.html" ${page==='nfa-table.html'?'class="active"':''}>NFA Table</a>
      <a href="dfa-table.html" ${page==='dfa-table.html'?'class="active"':''}>DFA Table</a>
      <a href="examples.html"  ${page==='examples.html'?'class="active"':''}>Examples</a>
    </div>
  </nav>`;

  /* Inject after <body> opens — only on non-splash pages */
  if (!document.querySelector('.splash')) {
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  /* ── Theme toggle button ── */
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.innerHTML = '<span class="toggle-icon">🌙</span><span class="toggle-label">Dark</span>';
  document.body.appendChild(btn);

  /* ── Apply saved theme ── */
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);

  btn.addEventListener('click', () => {
    const current = document.body.classList.contains('light') ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light');
      btn.innerHTML = '<span class="toggle-icon">☀️</span><span class="toggle-label">Light</span>';
    } else {
      document.body.classList.remove('light');
      btn.innerHTML = '<span class="toggle-icon">🌙</span><span class="toggle-label">Dark</span>';
    }
  }

})();
