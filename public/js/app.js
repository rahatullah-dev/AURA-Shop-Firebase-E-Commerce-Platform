/* ============================================
   AURA – Main App JS  |  app.js
   Handles: navbar drawer, hero carousel, add-to-cart
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── MOBILE DRAWER ────────────────────────────
  const hamburger   = document.getElementById('hamburger');
  const drawer      = document.getElementById('drawer');
  const overlay     = document.getElementById('drawerOverlay');
  const closeBtn    = document.getElementById('drawerClose');

  if (hamburger && drawer) {
    function openDrawer() {
      drawer.classList.add('open');
      if (overlay) { overlay.style.display = 'block'; overlay.classList.add('active'); }
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => { if (!overlay.classList.contains('active')) overlay.style.display = 'none'; }, 300);
      }
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    if (overlay) overlay.style.display = 'none';
    hamburger.addEventListener('click', () => drawer.classList.contains('open') ? closeDrawer() : openDrawer());
    if (overlay) overlay.addEventListener('click', closeDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  }

  // ── HERO CAROUSEL ────────────────────────────
  const track = document.getElementById('carouselTrack');
  if (track) {
    const slides = Array.from(track.querySelectorAll('.slide'));
    const dots   = Array.from(document.querySelectorAll('.dot'));
    const total  = slides.length;
    let current  = 0;
    let timer    = null;
    let isPaused = false;

    function goTo(index) {
      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      if (dots[current]) { dots[current].classList.remove('active'); dots[current].setAttribute('aria-selected', 'false'); }
      current = (index + total) % total;
      slides[current].classList.add('is-active');
      slides[current].setAttribute('aria-hidden', 'false');
      if (dots[current]) { dots[current].classList.add('active'); dots[current].setAttribute('aria-selected', 'true'); }
      track.style.transform = `translateX(-${current * 100}%)`;
    }

    function startAuto() { timer = setInterval(() => { if (!isPaused) goTo(current + 1); }, 4000); }
    function resetTimer() { clearInterval(timer); startAuto(); }

    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => { goTo(current + 1); resetTimer(); });
    if (prevBtn) prevBtn.addEventListener('click', () => { goTo(current - 1); resetTimer(); });
    dots.forEach(dot => dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.index)); resetTimer(); }));

    const carousel = track.closest('.carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', () => { isPaused = true; });
      carousel.addEventListener('mouseleave', () => { isPaused = false; });
      let touchStartX = 0;
      carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
      carousel.addEventListener('touchend', e => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) { goTo(diff > 0 ? current + 1 : current - 1); resetTimer(); }
      });
      carousel.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { goTo(current - 1); resetTimer(); }
        if (e.key === 'ArrowRight') { goTo(current + 1); resetTimer(); }
      });
    }
    startAuto();
  }

  // ── FEATURED PRODUCTS ADD TO CART ────────────
  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card  = btn.closest('.product-card');
      if (!card || card.classList.contains('skeleton-card')) return;
      const name  = card.querySelector('.card-name')?.textContent?.trim();
      const price = card.querySelector('.card-price')?.textContent?.trim();
      if (!name) return;
      addToCart(name, price);
      const orig = btn.innerHTML;
      btn.innerHTML = `✓ Added!`;
      btn.style.background = '#16a34a';
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.disabled = false; }, 1500);
      showGlobalToast(`"${name}" added to cart!`);
    });
  });

  // ── PRODUCT CARD CLICK → product.html ─────────
  document.querySelectorAll('.product-card:not(.skeleton-card)').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.add-btn')) return;
      const name = card.querySelector('.card-name')?.textContent?.trim();
      if (name) window.location.href = `product.html?name=${encodeURIComponent(name)}`;
    });
  });

  // ── HERO PROD BUTTONS ─────────────────────────
  document.querySelectorAll('.prod-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card  = btn.closest('.prod-card');
      const name  = card?.querySelector('.prod-name')?.textContent?.trim();
      const price = card?.querySelector('.prod-price')?.textContent?.trim();
      if (!name) return;
      addToCart(name, price);
      const orig = btn.textContent;
      btn.textContent = '✓ ADDED!';
      btn.style.background = '#16a34a';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.disabled = false; }, 1500);
      showGlobalToast(`"${name}" added to cart!`);
    });
  });
  // ── TESTIMONIALS SLIDER ────────────────────────
  const sliderTrack = document.getElementById('track');
  if (sliderTrack) {
    const cards       = Array.from(sliderTrack.querySelectorAll('.card'));
    const dotsContainer = document.getElementById('dots');
    let perView = window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3;
    let idx = 0;
    const maxIdx = () => Math.max(0, cards.length - perView);

    function buildDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = '';
      for (let i = 0; i <= maxIdx(); i++) {
        const d = document.createElement('button');
        d.className = 'dot-t' + (i === 0 ? ' active-t' : '');
        d.addEventListener('click', () => { idx = i; render(); });
        dotsContainer.appendChild(d);
      }
    }

    function render() {
      const cardWidth = cards[0]?.offsetWidth + 20 || 0;
      sliderTrack.style.transform = `translateX(-${idx * cardWidth}px)`;
      dotsContainer?.querySelectorAll('.dot-t').forEach((d, i) => d.classList.toggle('active-t', i === idx));
    }

    document.getElementById('prev-btn')?.addEventListener('click', () => { idx = Math.max(0, idx - 1); render(); });
    document.getElementById('next-btn')?.addEventListener('click', () => { idx = Math.min(maxIdx(), idx + 1); render(); });
    window.addEventListener('resize', () => {
      perView = window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3;
      idx = Math.min(idx, maxIdx());
      buildDots(); render();
    });
    buildDots(); render();
  }

});
