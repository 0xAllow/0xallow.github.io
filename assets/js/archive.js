/* ============================================================
   blacksunCUBE — Archive
   Filtering (tag + title search), URL hash sync,
   Share-view button, and per-post share buttons.
   ============================================================ */
(function () {
  'use strict';

  var listEl   = document.getElementById('post-list');
  var searchEl = document.getElementById('post-search');
  var emptyEl  = document.getElementById('empty-state');
  var metaEl   = document.getElementById('result-meta');
  var resetEl  = document.getElementById('reset-filters');
  var shareBtn = document.getElementById('share-btn');
  var toastEl  = document.getElementById('share-toast');
  if (!listEl) return;

  var items = [].slice.call(listEl.querySelectorAll('.post-list__item'));
  var chips = [].slice.call(document.querySelectorAll('.tag-chip'));

  var activeTag = 'all';
  var query = '';
  var toastTimer;

  /* ---------- Toast ---------- */
  function showToast(message, isError) {
    if (!toastEl) return;
    var label = toastEl.querySelector('span');
    if (label && message) label.textContent = message;
    toastEl.classList.toggle('is-error', !!isError);
    toastEl.hidden = false;
    // force reflow so the animation replays on rapid clicks
    void toastEl.offsetWidth;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
      setTimeout(function () { toastEl.hidden = true; }, 300);
    }, 1800);
  }

  /* ---------- Clipboard ---------- */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        document.body.removeChild(ta);
        reject(e);
      }
    });
  }

  function shareOrCopy(url, title, toastMsg) {
    var isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
    if (navigator.share && isMobile) {
      navigator.share({ title: title || document.title, url: url })
        .catch(function () { /* user cancelled */ });
      return;
    }
    copyToClipboard(url).then(function () {
      showToast(toastMsg || 'Link copied to clipboard');
    }).catch(function () {
      showToast('Could not copy link', true);
    });
  }

  /* ---------- Counts per tag ---------- */
  function computeCounts() {
    var counts = { all: items.length };
    items.forEach(function (it) {
      (it.dataset.tags || '').split(',').forEach(function (t) {
        t = t.trim(); if (!t) return;
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }

  function paintCounts() {
    var c = computeCounts();
    var all = document.getElementById('count-all');
    if (all) all.textContent = c.all || 0;
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var n = c[el.dataset.count] || 0;
      el.textContent = n;
      var chip = el.closest('.tag-chip');
      if (chip) chip.classList.toggle('is-empty', n === 0);
    });
  }

  /* ---------- Apply filters ---------- */
  function apply() {
    var q = query.trim().toLowerCase();
    var visible = 0;

    items.forEach(function (it) {
      var matchesTag = activeTag === 'all' ||
                       (',' + (it.dataset.tags || '') + ',').indexOf(',' + activeTag + ',') !== -1;
      var matchesQuery = !q || (it.dataset.title || '').indexOf(q) !== -1;
      var show = matchesTag && matchesQuery;
      it.hidden = !show;
      if (show) visible++;
    });

    if (emptyEl) emptyEl.hidden = visible !== 0;

    if (metaEl) {
      if (activeTag === 'all' && !q) {
        metaEl.textContent = visible + ' post' + (visible === 1 ? '' : 's');
      } else {
        metaEl.textContent = visible + ' of ' + items.length + ' match' + (visible === 1 ? '' : 'es');
      }
    }
    if (resetEl) resetEl.hidden = activeTag === 'all' && !q;

    chips.forEach(function (c) {
      var on = c.dataset.tag === activeTag;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', String(on));
    });
  }

  /* ---------- URL hash sync (shareable filtered views) ---------- */
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    var params = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    if (params.tag && chips.some(function (c) { return c.dataset.tag === params.tag; })) {
      activeTag = params.tag;
    }
    if (params.q) {
      query = params.q;
      if (searchEl) searchEl.value = params.q;
    }
  }

  function writeHash() {
    var parts = [];
    if (activeTag !== 'all') parts.push('tag=' + encodeURIComponent(activeTag));
    if (query) parts.push('q=' + encodeURIComponent(query));
    if (parts.length) {
      history.replaceState(null, '', '#' + parts.join('&'));
    } else if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function buildViewUrl() {
    var url = location.origin + location.pathname;
    var parts = [];
    if (activeTag !== 'all') parts.push('tag=' + encodeURIComponent(activeTag));
    if (query) parts.push('q=' + encodeURIComponent(query));
    if (parts.length) url += '#' + parts.join('&');
    return url;
  }

  /* ---------- Event wiring ---------- */

  // Tag chips
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      activeTag = c.dataset.tag;
      writeHash();
      apply();
    });
  });

  // Search input
  if (searchEl) {
    var debounce;
    searchEl.addEventListener('input', function () {
      query = searchEl.value;
      clearTimeout(debounce);
      debounce = setTimeout(function () { writeHash(); apply(); }, 90);
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { searchEl.value = ''; query = ''; writeHash(); apply(); }
    });
  }

  // Reset filters
  if (resetEl) {
    resetEl.addEventListener('click', function () {
      activeTag = 'all';
      query = '';
      if (searchEl) searchEl.value = '';
      writeHash();
      apply();
    });
  }

  // Inline tag pills (click-to-filter) + per-post share buttons
  listEl.addEventListener('click', function (e) {
    // Per-post share button
    var shareEl = e.target.closest('.row-share');
    if (shareEl) {
      e.preventDefault();
      e.stopPropagation();
      var item = shareEl.closest('.post-list__item');
      if (!item) return;
      var url = item.dataset.shareUrl || '';
      var title = item.dataset.shareTitle || '';
      shareOrCopy(url, title, 'Post link copied');
      return;
    }
    // Inline tag pill
    var t = e.target.closest('.post-tag');
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      activeTag = t.dataset.tag;
      writeHash();
      apply();
      var side = document.querySelector('.archive__side');
      if (side) side.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Back/forward
  window.addEventListener('hashchange', function () {
    activeTag = 'all'; query = '';
    if (searchEl) searchEl.value = '';
    readHash();
    apply();
  });

  // Share-view button (copies URL of the currently filtered list)
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var url = buildViewUrl();
      var msg = (activeTag === 'all' && !query)
              ? 'Link copied to clipboard'
              : 'Filtered view link copied';
      shareOrCopy(url, 'blacksunCUBE — Public', msg);
    });
  }

  /* ---------- Init ---------- */
  readHash();
  paintCounts();
  apply();
})();
