/**
 * animations.js — Shared animation utilities
 * Injected via script tag in all tool pages
 */
(function() {
  /* ── Page fade-in ── */
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.4s ease';
    document.body.style.opacity = '1';
  });

  /* ── Scroll reveal observer ── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
    revealObserver.observe(el);
  });

  /* ── h2 bar reveal ── */
  const h2Observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        h2Observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.theory h2').forEach(el => h2Observer.observe(el));

  /* ── Button ripple effect ── */
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const ripple = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `
      position:absolute; border-radius:50%;
      width:${size}px; height:${size}px;
      left:${e.clientX - rect.left - size/2}px;
      top:${e.clientY - rect.top - size/2}px;
      background:rgba(255,255,255,0.2);
      pointer-events:none; z-index:10;
      animation: rippleAnim 0.5s linear;
    `;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  });

  /* ── Input label focus glow ── */
  document.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('focus', () => {
      const label = el.previousElementSibling;
      if (label && label.tagName === 'LABEL') {
        label.style.color = 'var(--accent)';
        label.style.letterSpacing = '3px';
      }
    });
    el.addEventListener('blur', () => {
      const label = el.previousElementSibling;
      if (label && label.tagName === 'LABEL') {
        label.style.color = '';
        label.style.letterSpacing = '';
      }
    });
  });

  /* ── Graph reveal on populate ── */
  function watchGraphArea() {
    const graphArea = document.getElementById('graphArea');
    if (!graphArea) return;
    const mo = new MutationObserver(() => {
      if (graphArea.querySelector('canvas, svg')) {
        graphArea.classList.add('populated');
      }
    });
    mo.observe(graphArea, { childList: true, subtree: true });
  }
  watchGraphArea();

  /* ── mstat animate in ── */
  function animateStats() {
    document.querySelectorAll('.mstat').forEach((el, i) => {
      setTimeout(() => el.classList.add('animate-in'), i * 80);
    });
  }
  /* Watch for minimize panel */
  const minPanel = document.querySelector('.minimize-panel');
  if (minPanel) {
    const mo2 = new MutationObserver(animateStats);
    mo2.observe(minPanel, { childList: true, subtree: true });
  }

  /* ── Nav link fade transition ── */
  window.navigateTo = function(url) {
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity = '0';
    setTimeout(() => { location.href = url; }, 300);
  };

  /* ── Back button arrow slide ── */
  document.querySelectorAll('button[onclick*="homepage"]').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateX(-4px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

})();
