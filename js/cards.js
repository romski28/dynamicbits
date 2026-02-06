/**
 * Fanned Card Animation
 * Used on: cards.html, index.html (cardhand section)
 */
(function () {
  'use strict';

  /**
   * Initialize card fan animation for a given container
   * @param {string} fanSelector - ID of the fan container element
   * @param {string} tableSelector - ID of the table/parent container element
   */
  function initCardFan(fanSelector, tableSelector) {
    const fanEl = document.getElementById(fanSelector);
    const tableEl = document.getElementById(tableSelector);

    if (!fanEl || !tableEl) {
      console.warn(`Card fan not initialized: fan="${fanSelector}" or table="${tableSelector}" not found`);
      return;
    }

    // Configuration
    const IMAGE_COUNT = 5;
    const BASE_PATH = 'assets/img/';
    const IMAGE_FILENAMES = Array.from(
      { length: IMAGE_COUNT },
      (_, i) => `${BASE_PATH}${i + 1}.webp`
    );

    const ANGLE_STEP = 30;
    const CENTER_INDEX = Math.floor(IMAGE_COUNT / 2);
    const rootStyles = getComputedStyle(document.documentElement);
    const RADIUS_PER_STEP =
      parseFloat(rootStyles.getPropertyValue('--fan-radius-per-step')) || 70;
    const PAUSE_MS = parseInt(rootStyles.getPropertyValue('--pause-ms'), 10) || 1000;

    const fanOutDuration = parseTimeVar('--fan-out-duration') || 600;
    const fanInDuration = parseTimeVar('--fan-in-duration') || 450;

    /**
     * Parse CSS time variables (e.g., "600ms", "0.6s")
     */
    function parseTimeVar(varName) {
      const v = rootStyles.getPropertyValue(varName).trim();
      if (!v) return 0;
      if (v.endsWith('ms')) return parseFloat(v);
      if (v.endsWith('s')) return parseFloat(v) * 1000;
      return parseFloat(v);
    }

    /**
     * Create and insert the cards
     */
    const cards = IMAGE_FILENAMES.map((src, idx) => {
      const img = new Image();
      img.src = src;
      img.alt = `Card ${idx + 1}`;
      img.className = 'card-img';

      img.style.transform = 'translate(-50%, -50%) rotate(0deg)';
      img.style.zIndex = String(100 + idx);

      fanEl.appendChild(img);
      return img;
    });

    /**
     * Compute transform for fanned position
     */
    function computeFanTransform(idx) {
      const delta = idx - CENTER_INDEX;
      const angle = delta * ANGLE_STEP;
      const radius = Math.abs(delta) * RADIUS_PER_STEP;
      // Move center card up proportionally with the spread
      const centerUpward = RADIUS_PER_STEP * CENTER_INDEX * 0.5;
      const translateY = -(radius || centerUpward);
      return `translate(-50%, -50%) rotate(${angle}deg) translateY(${translateY}px)`;
    }

    /**
     * Apply fan transforms
     */
    function applyFanTransforms() {
      fanEl.classList.add('is-fanned');
      cards.forEach((card, idx) => {
        card.style.transform = computeFanTransform(idx);
        // Simple left-to-right stacking: leftmost at bottom, rightmost on top
        card.style.zIndex = String(1000 + idx);
      });
    }

    /**
     * Bring cards back to stacked position
     */
    function fanIn() {
      fanEl.classList.remove('is-fanned');
      fanEl.style.transform = 'scale(1)';
      cards.forEach((card, idx) => {
        card.style.transform = 'translate(-50%, -50%) rotate(0deg)';
        // Keep the last card (idx 4) on top at the end to match the start
        card.style.zIndex = String(100 + idx);
      });
    }

    /**
     * Auto-fit the fanned layout to stay inside container
     */
    function autoFitFan() {
      applyFanTransforms();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const fanRect = fanEl.getBoundingClientRect();
          const tableRect = tableEl.getBoundingClientRect();

          const safety = 0.02; // 2% inward padding to prevent scrollbar
          const targetWidth = tableRect.width * (1 - safety * 2);
          const targetHeight = tableRect.height * (1 - safety * 2);

          const widthScale = targetWidth / fanRect.width;
          const heightScale = targetHeight / fanRect.height;
          const scale = Math.min(1, widthScale, heightScale);

          fanEl.style.transform = `scale(${scale.toFixed(3)})`;
        });
      });
    }

    /**
     * Loop animation: out → pause → in → pause → repeat
     */
    function loop() {
      autoFitFan();

      setTimeout(() => {
        fanIn();
        setTimeout(loop, fanInDuration + PAUSE_MS);
      }, fanOutDuration + PAUSE_MS);
    }

    /**
     * Start the animation on page load
     */
    if (document.readyState === 'loading') {
      window.addEventListener('load', () => {
        setTimeout(loop, 250);
      });
    } else {
      // Page already loaded
      setTimeout(loop, 250);
    }

    /**
     * Handle window resize
     */
    window.addEventListener('resize', () => {
      if (fanEl.classList.contains('is-fanned')) {
        applyFanTransforms();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const fanRect = fanEl.getBoundingClientRect();
            const tableRect = tableEl.getBoundingClientRect();

            const safety = 0.02;
            const targetWidth = tableRect.width * (1 - safety * 2);
            const targetHeight = tableRect.height * (1 - safety * 2);

            const widthScale = targetWidth / fanRect.width;
            const heightScale = targetHeight / fanRect.height;
            const scale = Math.min(1, widthScale, heightScale);
            fanEl.style.transform = `scale(${scale.toFixed(3)})`;
          });
        });
      }
    });
  }

  // Expose to global scope
  window.initCardFan = initCardFan;
})();
