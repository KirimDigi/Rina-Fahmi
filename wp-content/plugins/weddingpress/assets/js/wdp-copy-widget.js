/**
 * WDP Copy Text Widget - Frontend Script
 * Widget: weddingpress-copy-text
 * Version: 3.2.1.2
 *
 * Changelog v3.2.1.2:
 * - Replaced deprecated document.execCommand("copy") with Clipboard API (navigator.clipboard)
 * - Added legacy fallback for browsers that don't support Clipboard API
 * - Fixed memory leak: setInterval now calls clearInterval after completion
 * - Removed global function copyText() — replaced with event delegation (namespaced)
 */

(function ($) {
    'use strict';

    /**
     * Core copy handler — namespaced, tidak polusi global scope.
     * Mendukung Clipboard API modern + fallback legacy execCommand.
     *
     * @param {HTMLElement} el - Elemen <a> tombol yang diklik
     */
    function wdpDoCopy(el) {
        var $el      = $(el);
        var message  = $el.data('message');
        var origHtml = $el.html();

        /**
         * FIX PHONE-NUMBER DETECTION:
         * Baca teks dari data-clipboard-text (di-set server-side via PHP add_render_attribute).
         * Atribut ini berisi teks MENTAH sebelum browser memodifikasi DOM (auto-link ke tel:).
         *
         * Kenapa ini diperlukan:
         * - iOS Safari & beberapa Android browser otomatis wrap angka panjang
         *   (seperti no. rekening 10-16 digit) menjadi <a href="tel:..."> di DOM.
         * - jQuery .text() pada .copy-content tetap mengambil teks dari dalam <a> tersebut
         *   dan hasilnya terlihat benar, NAMUN Clipboard API di iOS kadang mengambil
         *   "selected content" yang masih terikat dengan format tel: dari browser.
         * - Membaca dari data attribute (yang tidak bisa dimodifikasi browser) adalah sumber paling aman.
         *
         * Fallback: jika data-clipboard-text tidak ada (widget lama), pakai .text() biasa.
         */
        var content = $el.data('clipboard-text') || $el.siblings('div.copy-content').text();

        function showFeedback() {
            $el.html(message);
            var counter  = 0;
            var interval = setInterval(function () {
                counter++;
                if (counter === 1) {
                    $el.html(origHtml);
                    clearInterval(interval); // FIXED: clear interval setelah selesai
                }
            }, 1500);
        }

        // Clipboard API modern (Chrome 66+, Firefox 63+, Safari 13.1+)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(content)
                .then(function () {
                    showFeedback();
                })
                .catch(function () {
                    // Fallback jika permission clipboard ditolak browser
                    wdpLegacyCopy(content, showFeedback);
                });
        } else {
            // Fallback untuk browser lama
            wdpLegacyCopy(content, showFeedback);
        }
    }

    /**
     * Fallback copy menggunakan textarea sementara.
     * Digunakan jika browser tidak mendukung Clipboard API.
     *
     * @param {string}   text     - Teks yang akan disalin
     * @param {Function} callback - Dipanggil setelah copy selesai
     */
    function wdpLegacyCopy(text, callback) {
        var $temp = $('<textarea>');
        $('body').append($temp);
        $temp.val(text).select();
        try {
            document.execCommand('copy'); // legacy only — masih digunakan sebagai fallback
        } catch (e) {
            // silent fail
        }
        $temp.remove();
        if (typeof callback === 'function') {
            callback();
        }
    }

    /**
     * Event delegation — satu handler untuk semua instance widget di halaman.
     * Tidak memerlukan registrasi per-instance.
     */
    $(document).on('click', '.wdp-copy-btn', function (e) {
        e.preventDefault();
        wdpDoCopy(this);
    });

})(jQuery);
