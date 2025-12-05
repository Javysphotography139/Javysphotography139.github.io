/* 2025 Navigation, Modal, and Reveal Enhancements */
document.addEventListener("DOMContentLoaded", () => {
  // Navigation behavior (provided: accessibility, performance, no globals)
  (() => {
    'use strict';
    const nav = document.getElementById('myTopnav');
    const menuToggle = document.getElementById('menuToggle');
    if (!nav) return;

    const closeMobileNav = () => {
      nav.classList.remove('responsive');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    };

    // Toggle mobile menu
    if (menuToggle) {
      menuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        menuToggle.setAttribute('aria-expanded', String(next));
        nav.classList.toggle('responsive', next);
      });

      // Keyboard support for toggle
      menuToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          menuToggle.click();
        }
      });
    }

    // Close mobile nav when any nav link is clicked
    const navLinks = nav.querySelectorAll('a:not(.icon)');
    navLinks.forEach((a) => {
      a.addEventListener('click', () => {
        closeMobileNav();
      });
    });

    // Show/hide nav on scroll with rAF to reduce layout thrashing
    let navVisible = false;

    const applyVisibility = (visible) => {
      if (visible) {
        nav.style.visibility = 'visible';
        nav.style.opacity = '1';
      } else {
        nav.style.visibility = 'hidden';
        nav.style.opacity = '0';
      }
      nav.classList.toggle('scrolled', visible);
      nav.style.transition = 'visibility 0.5s, opacity 0.5s linear';
    };

    const updateNavVisibility = () => {
      const threshold = Math.max(window.innerHeight - 200, 0);
      const shouldShow = window.pageYOffset >= threshold;
      if (shouldShow !== navVisible) {
        navVisible = shouldShow;
        applyVisibility(navVisible);
      }
    };

    // Initialize state on load
    updateNavVisibility();

    // Accessibility: if nav or its children receive focus, ensure nav is visible
    nav.addEventListener('focusin', () => {
      navVisible = true;
      applyVisibility(true);
    });

    let ticking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            updateNavVisibility();
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'resize',
      () => {
        updateNavVisibility();
      },
      { passive: true }
    );

    // Close menu with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMobileNav();
    });
  })();

  // Image modal
  const modal = document.getElementById("myModal");
  const modalImg = document.getElementById("img01");
  const closeBtn = modal ? modal.querySelector(".close") : null;
  const mainEl = document.querySelector("main");
  let lastFocusedEl = null;
  let currentIndex = -1;


  function closeModal() {
    if (!modal || !modalImg) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    modalImg.src = "";
    document.body.style.overflow = "";
    if (mainEl) mainEl.removeAttribute("aria-hidden");
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  function openModalPreferOptimized(img) {
    const optimized = img.dataset.full || img.getAttribute("data-full");
    const fallback = img.dataset.fullOriginal || img.getAttribute("data-full-original") || img.src;
    if (!modal || !modalImg) return;
    lastFocusedEl = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (mainEl) mainEl.setAttribute("aria-hidden", "true");
    if (closeBtn) closeBtn.focus();
    // try optimized first, fallback on error
    if (optimized) {
      modalImg.onerror = () => {
        modalImg.onerror = null;
        modalImg.src = fallback;
        modalImg.alt = img.alt || "";
      };
      modalImg.src = optimized;
      modalImg.alt = img.alt || "";
    } else {
      modalImg.src = fallback;
      modalImg.alt = img.alt || "";
    }
  }

  // Show specified gallery image by index (wrap around)
  function showAtIndex(i) {
    const galleryImages = Array.from(document.querySelectorAll(".gallery-item__image"));
    if (!galleryImages.length) return;
    const len = galleryImages.length;
    currentIndex = ((i % len) + len) % len;
    const target = galleryImages[currentIndex];
    openModalPreferOptimized(target);
  }

  // Bind gallery images
  const galleryImages = Array.from(document.querySelectorAll(".gallery-item__image"));
  galleryImages.forEach((img, idx) => {
    // Make images keyboard-focusable and announce they open a dialog
    img.setAttribute("tabindex", "0");
    img.setAttribute("role", "button");
    img.setAttribute("aria-haspopup", "dialog");
    if (img.alt) {
      img.setAttribute("aria-label", `Open image: ${img.alt}`);
    } else {
      img.setAttribute("aria-label", "Open image");
    }

    img.addEventListener("click", () => {
      currentIndex = idx;
      openModalPreferOptimized(img);
    });

    img.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        currentIndex = idx;
        openModalPreferOptimized(img);
      }
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    const prevBtn = modal.querySelector(".modal-nav.prev");
    const nextBtn = modal.querySelector(".modal-nav.next");

    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentIndex < 0) currentIndex = 0;
        showAtIndex(currentIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentIndex < 0) currentIndex = 0;
        showAtIndex(currentIndex + 1);
      });
    }

    modal.addEventListener("click", (e) => {
      // Close when clicking backdrop (outside the image and close button)
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (!modal || !modal.classList.contains("open")) return;
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      showAtIndex(currentIndex + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      showAtIndex(currentIndex - 1);
    } else if (e.key === "Tab") {
      // Trap focus within modal
      const focusable = Array.from(
        modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !modal.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modal.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  // Scroll reveal animations
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  // Scrollspy: highlight active nav link for visible section
  const navLinkEls = Array.from(document.querySelectorAll("#primaryNav a[href^='#']"));
  const sectionSpecs = navLinkEls
    .map((link) => {
      const id = link.getAttribute("href").slice(1);
      const el = document.getElementById(id);
      return el ? { id, el, link } : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sectionSpecs.length) {
    const setActive = (activeId) => {
      sectionSpecs.forEach((s) => s.link.classList.toggle("active", s.id === activeId));
    };
    const spy = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (best) setActive(best.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sectionSpecs.forEach((s) => spy.observe(s.el));
  }

  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

});
