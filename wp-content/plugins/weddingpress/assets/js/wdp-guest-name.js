/**
 * WeddingPress — Guest Name JS
 * Handle: wdp-guest-name
 *
 * Fitur:
 * - Mode BukuTamu Pro: fetch data tamu dari API BP, dijalankan langsung di DOMContentLoaded
 *   (tidak bergantung pada Elementor widget hook, menghindari race condition).
 * - Mode URL Parameter: baca nama tamu dari URL query string, via Elementor hook.
 * - Mendukung multi-widget Guest Name dalam satu halaman.
 * - Diload hanya saat widget digunakan (via get_script_depends).
 *
 * @package WeddingPress
 * @version 4.0.0
 */

(function () {
    'use strict';

    // ─── Utility: Escape regex special chars ────────────────────────────────

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ─── Core: Replace text di TextNode saja (tidak merusak struktur HTML) ──

    function replaceTextInNode(node, searchValue, replaceValue) {
        if (!searchValue) return;
        if (node.nodeType === 1 || node.nodeType === 11) {
            node.childNodes.forEach(function (child) {
                if (child.nodeType === 3) {
                    var safe = escapeRegExp(searchValue);
                    var regex = new RegExp(safe, 'gi');
                    child.textContent = child.textContent.replace(regex, replaceValue);
                } else {
                    replaceTextInNode(child, searchValue, replaceValue);
                }
            });
        }
    }

    // ─── Core: Ambil nama penerima/tamu dari URL params ─────────────────────

    function getRecipientName(urlSearchParams, paramKeys) {
        for (var i = 0; i < paramKeys.length; i++) {
            var key = paramKeys[i].trim();
            var value = urlSearchParams.get(key);
            if (value && value.trim()) {
                return value.trim();
            }
        }
        return '';
    }

    // ─── Helper: Baca settings animasi dari data-* element ──────────────────

    function readElSettings(el) {
        return {
            animStyle: el.getAttribute('data-wdp-anim-style') || 'none',
            duration: parseInt(el.getAttribute('data-wdp-anim-duration')) || 1500,
            animMode: el.getAttribute('data-wdp-anim-mode') || 'whole',
            delay: parseInt(el.getAttribute('data-wdp-anim-delay')) || 0
        };
    }

    // ─── Helper: Menjalankan animasi visual secara penuh ────────────────────

    function startAnimation(el, finalName, settings) {
        var animStyle = settings.animStyle;
        var duration = settings.duration;
        var animMode = settings.animMode;

        el.textContent = '';
        el.style.removeProperty('--wdp-anim-duration');
        el.style.removeProperty('--wdp-anim-delay');
        el.className = el.className.replace(/\bwdp-anim-active\b/g, '')
                                   .replace(/\bwdp-typing-cursor\b/g, '')
                                   .replace(/\bwdp-anim-mode-word\b/g, '')
                                   .replace(/\bwdp-anim-mode-letter\b/g, '');
        el.classList.add('wdp-anim-waiting');
        el.innerHTML = '';

        setTimeout(function () {
            el.classList.remove('wdp-anim-waiting');

            if (animStyle === 'typing') {
                if (el.dataset.wdpIntervalId) {
                    clearInterval(parseInt(el.dataset.wdpIntervalId));
                }
                el.classList.add('wdp-typing-cursor');
                var i = 0;
                var intervalTime = Math.max(20, Math.floor(duration / Math.max(1, finalName.length)));
                var timer = setInterval(function () {
                    if (i < finalName.length) {
                        el.textContent += finalName.charAt(i);
                        i++;
                    } else {
                        clearInterval(timer);
                        el.classList.remove('wdp-typing-cursor');
                        el.classList.add('wdp-anim-active');
                        delete el.dataset.wdpIntervalId;
                    }
                }, intervalTime);
                el.dataset.wdpIntervalId = timer.toString();

            } else if (animMode === 'word' && animStyle !== 'clip') {
                el.classList.add('wdp-anim-mode-word');
                var words = finalName.split(' ');
                var wordSpans = [];

                words.forEach(function (word, index) {
                    var span = document.createElement('span');
                    span.className = 'wdp-anim-token';
                    span.textContent = word;
                    var tokenDelay = Math.floor((duration / Math.max(1, words.length)) * index);
                    span.style.setProperty('--wdp-anim-duration', Math.floor(duration / words.length) + 'ms');
                    span.style.setProperty('--wdp-anim-delay', tokenDelay + 'ms');
                    el.appendChild(span);
                    wordSpans.push(span);
                    if (index < words.length - 1) {
                        el.appendChild(document.createTextNode(' '));
                    }
                });

                setTimeout(function () {
                    wordSpans.forEach(function (span) { span.classList.add('wdp-token-active'); });
                }, 20);

            } else if (animMode === 'letter' && animStyle !== 'clip') {
                el.classList.add('wdp-anim-mode-letter');
                var letters = finalName.split('');
                var letterSpans = [];

                letters.forEach(function (char, index) {
                    var span = document.createElement('span');
                    span.className = 'wdp-anim-token';
                    span.innerHTML = char === ' ' ? '&nbsp;' : char;
                    var tokenDelay = Math.floor((duration / Math.max(1, letters.length)) * index);
                    span.style.setProperty('--wdp-anim-duration', Math.min(duration, 500) + 'ms');
                    span.style.setProperty('--wdp-anim-delay', tokenDelay + 'ms');
                    el.appendChild(span);
                    letterSpans.push(span);
                });

                setTimeout(function () {
                    letterSpans.forEach(function (span) { span.classList.add('wdp-token-active'); });
                }, 20);

            } else {
                el.textContent = finalName;
                el.style.setProperty('--wdp-anim-duration', duration + 'ms');
                el.style.setProperty('--wdp-anim-delay', '0ms');
                el.classList.add('wdp-anim-active');
            }
        }, 50);
    }

    // ─── Helper: Apply final name dan trigger animasi ────────────────────────

    function applyFinalName(el, finalName, defaultText, settings, delay) {
        el.classList.remove('wdp-bp-loading');
        el.style.opacity = '';

        var targetText = finalName || defaultText;
        if (targetText && targetText !== defaultText) {
            // Priority 1: Ganti defaultText jika ditemukan di node text
            var textBefore = el.textContent;
            replaceTextInNode(el, defaultText, targetText);

            // Priority 2: Jika replaceTextInNode gagal (karena teks di HTML beda formatting), ganti textContent murni jika tidak ada HTML child bermotif
            if (el.textContent === textBefore) {
                if (el.children.length === 0) {
                    el.textContent = targetText;
                } else {
                    // Jika ada child (misal span), ganti textContent dari first/last text child atau node paling dalam
                    replaceTextInNode(el, el.textContent.trim(), targetText);
                }
            }
        }

        if (settings.animStyle !== 'none') {
            setTimeout(function () {
                startAnimation(el, targetText, settings);

                var animLoop = el.getAttribute('data-wdp-anim-loop') || 'no';
                var animLoopDelay = parseInt(el.getAttribute('data-wdp-anim-loop-delay')) || 3000;
                if (animLoop === 'yes') {
                    var totalAnimationTime = settings.duration;
                    function runLoop() {
                        var timeoutId = setTimeout(function () {
                            startAnimation(el, targetText, settings);
                            runLoop();
                        }, totalAnimationTime + animLoopDelay);
                        el.dataset.wdpLoopTimeoutId = timeoutId.toString();
                    }
                    runLoop();
                }
            }, delay);
        } else {
            el.classList.remove('wdp-anim-waiting');
        }
    }

    // Helper untuk sinkronisasi input nama pengirim komentar (Comment Kit & Guestbook)
    function syncAuthorInputFields(hashValue, resolvedName) {
        if (!hashValue || !resolvedName) return;

        function checkAndReplace() {
            var authorInputs = document.querySelectorAll('input#author, input[name="author"], input[name="guestbook-name"], input.wdp-input, input.cui-input');
            authorInputs.forEach(function (input) {
                if (input.value === hashValue) {
                    input.value = resolvedName;
                    // Trigger events
                    if (typeof Event !== 'undefined') {
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });
        }

        // Jalankan langsung
        checkAndReplace();

        // Inisialisasi MutationObserver untuk menangani element yang dimuat dinamis
        if (typeof MutationObserver !== 'undefined' && !window._wdpAuthorObserverActive) {
            window._wdpAuthorObserverActive = true;
            var observer = new MutationObserver(function () {
                checkAndReplace();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ─── BP Mode: Fetch sekali per halaman (langsung dari DOMContentLoaded) ─

    function runWdpBpFetch() {
        // Edit mode guard
        if (typeof elementorFrontend !== 'undefined' &&
            elementorFrontend.isEditMode && elementorFrontend.isEditMode()) return;

        var bpBaseUrl = (typeof wdpGuestNameConfig !== 'undefined' && wdpGuestNameConfig.bp_base_url)
            ? wdpGuestNameConfig.bp_base_url.replace(/\/$/, '') : '';

        if (!bpBaseUrl) return; // Integrasi BP tidak dikonfigurasi

        // Cari semua elemen Guest Name / .namatamu yang punya data-wdp-bp-event-id
        var bpTargets = Array.prototype.filter.call(
            document.querySelectorAll('[data-wdp-url-params], .namatamu'),
            function (el) { 
                var eid = el.getAttribute('data-wdp-bp-event-id');
                return eid && eid.trim(); 
            }
        );

        if (!bpTargets.length) return;

        // Tandai elemen agar tidak disentuh oleh mode URL parameter biasa
        bpTargets.forEach(function (el) {
            el.setAttribute('data-wdp-bp-handling', '1');
            el.setAttribute('data-wdp-init', '1');
        });

        // Kelompokkan per event_id
        var eventGroups = {};
        bpTargets.forEach(function (el) {
            var eid = el.getAttribute('data-wdp-bp-event-id').trim();
            if (!eventGroups[eid]) eventGroups[eid] = [];
            eventGroups[eid].push(el);
        });

        // Ambil hash dari URL params menggunakan konfigurasi element pertama
        var firstEl = bpTargets[0];
        var paramKeys = (firstEl.getAttribute('data-wdp-url-params') || 'to,dear,kepada').split(',');
        var urlParams = new URLSearchParams(window.location.search);
        var hashValue = getRecipientName(urlParams, paramKeys);

        Object.keys(eventGroups).forEach(function (eventId) {
            var group = eventGroups[eventId];

            // Cek coexistence: jika bukutamupro-elementor sudah handle event ini → skip
            if (typeof bpConfig !== 'undefined' && bpConfig.event_id &&
                String(bpConfig.event_id) === String(eventId)) {
                return;
            }

            // Cek global cache
            var cacheKey = eventId + ':' + hashValue;
            if (window._wdpBpCache && window._wdpBpCache[cacheKey]) {
                var cachedName = window._wdpBpCache[cacheKey];
                group.forEach(function (el) {
                    var settings = readElSettings(el);
                    applyFinalName(el, cachedName,
                        el.getAttribute('data-wdp-default-text') || 'Tamu Undangan', settings, settings.delay);
                });
                if (cachedName) {
                    syncAuthorInputFields(hashValue, cachedName);
                }
                return;
            }

            if (!hashValue) {
                // Tidak ada hash di URL → tampilkan default text
                group.forEach(function (el) {
                    var defaultText = el.getAttribute('data-wdp-default-text') || 'Tamu Undangan';
                    var settings = readElSettings(el);
                    applyFinalName(el, defaultText, defaultText, settings, 0);
                });
                return;
            }

            // Anti-FOUC: sembunyikan sementara
            group.forEach(function (el) {
                el.classList.add('wdp-bp-loading');
                el.style.opacity = '0';
            });

            var apiUrl = bpBaseUrl + '/api/v1/event/' + encodeURIComponent(eventId)
                       + '/guest/' + encodeURIComponent(hashValue);

            var fetchTimeout = new Promise(function (_, reject) {
                setTimeout(function () { reject(new Error('timeout')); }, 6000);
            });

            Promise.race([
                fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } }),
                fetchTimeout
            ])
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                var resolvedName = null;
                if (data.success && data.data && data.data.name) {
                    resolvedName = data.data.name;
                    if (!window._wdpBpCache) window._wdpBpCache = {};
                    window._wdpBpCache[cacheKey] = resolvedName;
                }
                group.forEach(function (el) {
                    var defaultText = el.getAttribute('data-wdp-default-text') || 'Tamu Undangan';
                    var settings = readElSettings(el);
                    applyFinalName(el, resolvedName || defaultText, defaultText, settings, settings.delay);
                });
                if (resolvedName) {
                    syncAuthorInputFields(hashValue, resolvedName);
                }
            })
            .catch(function () {
                group.forEach(function (el) {
                    var defaultText = el.getAttribute('data-wdp-default-text') || 'Tamu Undangan';
                    var settings = readElSettings(el);
                    applyFinalName(el, defaultText, defaultText, settings, 0);
                });
            });
        });
    }

    // ─── URL Parameter Mode: proses per-element ──────────────────────────────

    function initGuestNameUrlMode($scope) {
        var targets = [];
        if ($scope && typeof $scope.find === 'function') {
            // Cari berdasarkan data-wdp-url-params (menggunakan .addBack() agar jika $scope adalah elemen itu sendiri, tetap terpilih)
            targets = $scope.find('[data-wdp-url-params]').addBack('[data-wdp-url-params]').toArray();
            if (targets.length === 0) {
                targets = $scope.find('.namatamu').addBack('.namatamu').toArray();
            }
        }
        
        if (!targets || targets.length === 0) {
            targets = Array.prototype.slice.call(document.querySelectorAll('[data-wdp-url-params]'));
            if (targets.length === 0) {
                targets = Array.prototype.slice.call(document.querySelectorAll('.namatamu'));
            }
        }

        if (!targets || targets.length === 0) return;

        var bpBaseUrl = (typeof wdpGuestNameConfig !== 'undefined' && wdpGuestNameConfig.bp_base_url)
            ? wdpGuestNameConfig.bp_base_url : '';
        var urlParams = new URLSearchParams(window.location.search);

        targets.forEach(function (el) {
            var bpEid = el.getAttribute('data-wdp-bp-event-id');
            // Skip: sudah di-handle oleh BP fetch
            if (el.getAttribute('data-wdp-bp-handling') || (bpBaseUrl && bpEid && bpEid.trim())) return;
            if (el.getAttribute('data-wdp-init')) return; // sudah diinit

            el.setAttribute('data-wdp-init', '1');

            if (el.dataset.wdpLoopTimeoutId) {
                clearTimeout(parseInt(el.dataset.wdpLoopTimeoutId));
                delete el.dataset.wdpLoopTimeoutId;
            }
            if (el.dataset.wdpIntervalId) {
                clearInterval(parseInt(el.dataset.wdpIntervalId));
                delete el.dataset.wdpIntervalId;
            }

            var defaultText = (el.getAttribute('data-wdp-default-text') || 'Tamu Undangan').trim();
            var paramKeys = (el.getAttribute('data-wdp-url-params') || 'to,dear,kepada').split(',');
            var settings = readElSettings(el);

            var recipient = getRecipientName(urlParams, paramKeys);
            var finalName = defaultText;

            if (recipient) {
                finalName = recipient;
            }

            applyFinalName(el, finalName, defaultText, settings, settings.delay);
        });
    }

    // ─── Entry Points ────────────────────────────────────────────────────────

    // 1. BP Fetch — langsung di DOMContentLoaded (tidak bergantung pada Elementor hook)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runWdpBpFetch);
    } else {
        runWdpBpFetch();
    }

    // 2. URL Parameter Mode — via Elementor widget hook
    function registerElementorHook() {
        if (window.elementorFrontend && window.elementorFrontend.hooks) {
            window.elementorFrontend.hooks.addAction(
                'frontend/element_ready/weddingpress-guest-name.default',
                function ($scope) {
                    if (window.elementorFrontend && window.elementorFrontend.isEditMode()) {
                        // Di editor: reset guard agar bisa re-preview
                        var $targets = $scope.find('[data-wdp-url-params]').addBack('[data-wdp-url-params]');
                        if ($targets.length === 0) {
                            $targets = $scope.find('.namatamu').addBack('.namatamu');
                        }
                        $targets.each(function () {
                            this.removeAttribute('data-wdp-init');
                            this.removeAttribute('data-wdp-bp-handling');
                        });
                        runWdpBpFetch(); // Refresh BP fetch untuk preview editor
                    }
                    initGuestNameUrlMode($scope);
                }
            );
        }
    }

    window.addEventListener('elementor/frontend/init', registerElementorHook);
    if (window.elementorFrontend) {
        registerElementorHook();
    }

    // 3. Fallback URL mode untuk halaman non-Elementor atau timing issue
    // Jalankan setelah semua script selesai di-execute untuk mencegah race condition
    function runFallback() {
        var hasWidget = document.querySelectorAll('[data-wdp-url-params]').length > 0;
        if (hasWidget) {
            initGuestNameUrlMode(null);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            // Delay kecil: tunggu script lain (namatamu.js) selesai sebelum kita proses
            setTimeout(runFallback, 50);
        });
    } else {
        setTimeout(runFallback, 50);
    }

})();
