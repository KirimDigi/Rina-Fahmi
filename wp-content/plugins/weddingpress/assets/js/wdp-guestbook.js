/**
 * WeddingPress Guestbook Module
 * Refactored using robust Event Delegation to survive Elementor initialization crashes.
 *
 * Fix v4.0.1:
 * - Tambahkan nonce ke AJAX request (sebelumnya selalu gagal karena check_ajax_referer)
 * - Auto-fill input[name="guestbook-name"] dari URL param ?to= via JS (client-side)
 * - Isi ulang nama setelah form.reset() agar field tidak kosong lagi
 */
jQuery(document).ready(function ($) {

    // ─── Helper: Pagify Initializer ──────────────────────────────────────────
    var pagify = {
        items: {},
        container: null,
        totalPages: 1,
        perPage: 3,
        currentPage: 0,
        createNavigation: function () {
            this.totalPages = Math.ceil(this.items.length / this.perPage);
            $(".pagination", this.container.parent()).remove();

            var pagination = $('<div class="pagination"></div>').append('<a class="nav prev disabled" data-next="false">←</a>');
            for (var i = 0; i < this.totalPages; i++) {
                var pageElClass = "page";
                if (!i) pageElClass = "page current";
                pagination.append('<a class="' + pageElClass + '" data-page="' + (i + 1) + '">' + (i + 1) + "</a>");
            }
            pagination.append('<a class="nav next" data-next="true">→</a>');
            this.container.after(pagination);

            var that = this;
            this.container.parent().off("click.paginav").on("click.paginav", ".nav", function () {
                that.navigate($(this).data("next"));
            });

            this.container.parent().off("click.pagipage").on("click.pagipage", ".page", function () {
                that.goToPage($(this).data("page"));
            });
        },
        navigate: function (next) {
            if (isNaN(next) || next === undefined) next = true;
            this.container.parent().find(".pagination .nav").removeClass("disabled");

            if (next) {
                this.currentPage++;
                if (this.currentPage > this.totalPages - 1) this.currentPage = this.totalPages - 1;
                if (this.currentPage == this.totalPages - 1) this.container.parent().find(".pagination .nav.next").addClass("disabled");
            } else {
                this.currentPage--;
                if (this.currentPage < 0) this.currentPage = 0;
                if (this.currentPage == 0) this.container.parent().find(".pagination .nav.prev").addClass("disabled");
            }
            this.showItems();
        },
        updateNavigation: function () {
            this.container.parent().find(".pagination .page").removeClass("current");
            this.container.parent().find('.pagination .page[data-page="' + (this.currentPage + 1) + '"]').addClass("current");
        },
        goToPage: function (page) {
            this.currentPage = page - 1;
            this.container.parent().find(".pagination .nav").removeClass("disabled");
            if (this.currentPage == this.totalPages - 1) this.container.parent().find(".pagination .nav.next").addClass("disabled");
            if (this.currentPage == 0) this.container.parent().find(".pagination .nav.prev").addClass("disabled");
            this.showItems();
        },
        showItems: function () {
            this.items.hide();
            var base = this.perPage * this.currentPage;
            this.items.slice(base, base + this.perPage).show();
            this.updateNavigation();
        },
        init: function (container, items, perPage) {
            this.container = container;
            this.currentPage = 0;
            this.totalPages = 1;
            this.perPage = perPage;
            this.items = items;
            this.createNavigation();
            this.showItems();
        }
    };

    $.fn.pagify = function (perPage, itemSelector) {
        var el = $(this);
        var items = $(itemSelector, el);
        if (isNaN(perPage) || perPage === undefined) perPage = 3;
        if (items.length <= perPage) return true;
        // Buat clone instance pagify untuk multiple widget
        var pagifyInstance = $.extend({}, pagify);
        pagifyInstance.init(el, items, perPage);
    };

    // ─── FIX #1: Auto-fill nama tamu dari URL param ke input guestbook-name ─
    function fillGuestbookNameFromUrl() {
        var urlParams = new URLSearchParams(window.location.search);
        // Cek param yang umum dipakai: to, dear, kepada
        var paramKeys = ['to', 'dear', 'kepada'];
        var guestName = '';
        for (var i = 0; i < paramKeys.length; i++) {
            var val = urlParams.get(paramKeys[i]);
            if (val && val.trim()) {
                guestName = val.trim();
                break;
            }
        }

        if (!guestName) return;

        // Isi semua input[name="guestbook-name"] yang value-nya masih kosong atau berupa hash mentah
        $('input[name="guestbook-name"]').each(function () {
            var $input = $(this);
            var currentVal = $input.val() || '';
            // Isi jika kosong, atau jika masih hash mentah (semua huruf kapital & angka, 4-12 karakter)
            if (!currentVal || /^[A-Z0-9]{4,12}$/.test(currentVal)) {
                $input.val(guestName);
            }
        });
    }

    // Jalankan langsung saat DOM ready
    fillGuestbookNameFromUrl();

    // Jalankan ulang via MutationObserver untuk menangani widget yang dimuat dinamis oleh Elementor
    if (typeof MutationObserver !== 'undefined' && !window._wdpGuestbookNameObserverActive) {
        window._wdpGuestbookNameObserverActive = true;
        var guestbookNameObserver = new MutationObserver(function () {
            fillGuestbookNameFromUrl();
        });
        guestbookNameObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ─── Initialize all existing guestbooks on page load ─────────────────────
    function initGuestbooks() {
        $(".guestbook-box-content").each(function () {
            var $content = $(this);
            var showPagination = $content.data('pagination') || 'no';
            var perPage = parseInt($content.data('per-page')) || 5;

            var $list = $content.find(".guestbook-list");
            if (showPagination === 'yes') {
                $list.pagify(perPage, ".user-guestbook");
            } else {
                $list.css({ "height": "270px", "overflow": "auto" });
            }
        });
    }

    // ─── FIX #2: Submit Guestbook — tambahkan nonce ──────────────────────────
    $(document).on("submit", ".wdp-guestbook-form", function (e) {
        e.preventDefault();

        var $form = $(this);
        var $content = $form.closest(".guestbook-box-content");

        var formId = $content.data("id") || '';
        var postId = $content.data("post-id") || '';
        var showPagination = $content.data('pagination') || 'no';
        var perPage = parseInt($content.data('per-page')) || 5;

        // Ambil nonce dari cevar yang sudah di-localize oleh PHP (elementor.php baris 475)
        var guestbookNonce = (typeof cevar !== 'undefined' && cevar.guestbook_nonce) ? cevar.guestbook_nonce : '';

        var query = "action=guestbook_box_submit" +
                    "&id=" + encodeURIComponent(formId) +
                    "&post_id=" + encodeURIComponent(postId) +
                    "&nonce=" + encodeURIComponent(guestbookNonce) +
                    "&avatar=" + encodeURIComponent($content.find("#hidden-avatar img").attr("src") || '') +
                    "&" + $form.serialize();

        var ajaxUrl = (typeof cevar !== 'undefined') ? cevar.ajax_url : (typeof ajaxurl !== 'undefined' ? ajaxurl : '/wp-admin/admin-ajax.php');

        $.post(ajaxUrl, query, function (response) {
            var $list = $content.find(".guestbook-list");
            $list.prepend(response);
            $form[0].reset();
            // Isi ulang nama setelah form reset agar field tidak kosong
            fillGuestbookNameFromUrl();

            if (showPagination === 'yes') {
                $list.pagify(perPage, ".user-guestbook");
            }
        });
    });

    // Run initializer
    initGuestbooks();

    // Support Elementor popup dynamic initialization
    $(window).on('elementor/frontend/init', function () {
        if (window.elementorFrontend && window.elementorFrontend.hooks) {
            window.elementorFrontend.hooks.addAction('frontend/element_ready/weddingpress-guestbook.default', function ($scope) {
                var $content = $scope.find(".guestbook-box-content");
                if ($content.length) {
                    var showPagination = $content.data('pagination') || 'no';
                    var perPage = parseInt($content.data('per-page')) || 5;
                    var $list = $content.find(".guestbook-list");
                    if (showPagination === 'yes') {
                        $list.pagify(perPage, ".user-guestbook");
                    } else {
                        $list.css({ "height": "270px", "overflow": "auto" });
                    }
                    // Isi nama tamu untuk instance baru
                    fillGuestbookNameFromUrl();
                }
            });
        }
    });

});
