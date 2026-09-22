/*!
 * WeddingPress Custom Nama Tamu (WDPCNT) & URL Normalizer
 * ========================================================
 * Compatible with WDP Pro & WDP Lite v4.0.1
 * 
 * Target Selector: .namatamu, #namatamu
 * Supported URL Params: to, dear, kepada, n, nama
 * 
 * Safety Guarantee:
 * - Hanya memproses Text Node pada elemen bertanda .namatamu / #namatamu
 * - Mencegah kerusakan tag HTML pembungkus (span, h2, dll) dan style Elementor
 * - Tidak menyentuh input form (Comment Kit 1 & 2, Guestbook) & elemen Guest Name
 * - Tidak menyentuh elemen yang dikelola Widget Elementor Guest Name (data-wdp-url-params)
 * - Tidak menyentuh elemen di dalam container form CUI/Comment Kit
 */
(function() {
	'use strict';

	const config = {
		selector: '.namatamu, #namatamu',
		urlParams: ['to', 'dear', 'kepada', 'n', 'nama'],
		defaultText: 'Tamu Undangan'
	};

	// --- FASE 1: Normalisasi URL (Encoder & Special Character Handler) ---
	var rawSearch = location.search;
	if ( rawSearch.indexOf('?') !== -1 ) {
		try {
			var params = new URLSearchParams(rawSearch);
			var needsRedirect = false;

			for (const key of config.urlParams) {
				if (rawSearch.indexOf('?' + key + '=') !== -1 || rawSearch.indexOf('&' + key + '=') !== -1) {
					var rawName = params.get(key);
					if ( rawName !== null ) {
						var decoded = rawName
							.replace(/&amp;/gi, '&')
							.replace(/&#38;/gi, '&')
							.replace(/&#x26;/gi, '&')
							.replace(/&apos;/gi, "'")
							.replace(/&#39;/gi, "'")
							.replace(/&quot;/gi, '"')
							.replace(/&#34;/gi, '"');

						if ( rawName !== decoded || rawSearch.indexOf('&' + key + '=') !== -1 ) {
							params.set(key, decoded);
							needsRedirect = true;
						}
					}
				}
			}

			if (needsRedirect) {
				var newSearch = '?' + params.toString();
				if ( newSearch !== rawSearch ) {
					location.replace(location.pathname + newSearch);
					return;
				}
			}
		} catch(e) {}
	}

	// --- FASE 2: Safe Text Node Replacement & Display ---
	function getRecipientName(params, keys) {
		for (const key of keys) {
			const value = params.get(key);
			if (value && value.trim()) {
				return value.trim();
			}
		}
		return '';
	}

	function escapeRegExp(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function replaceTextInNode(node, searchValue, replaceValue) {
		if (!node) return;
		if (node.nodeType === 1 || node.nodeType === 11) { // Element or Document Fragment
			// Skip input, textarea, select or form elements for safety
			var tagName = node.tagName ? node.tagName.toLowerCase() : '';
			if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'option') {
				return;
			}
			node.childNodes.forEach(function(child) {
				if (child.nodeType === 3) { // Text node
					var safeSearch = escapeRegExp(searchValue);
					var regex = new RegExp(safeSearch, 'gi');
					if (regex.test(child.textContent)) {
						var txtNode = document.createElement('textarea');
						txtNode.innerHTML = replaceValue;
						var decodedValue = txtNode.value;
						child.textContent = child.textContent.replace(regex, decodedValue);
					}
				} else {
					replaceTextInNode(child, searchValue, replaceValue);
				}
			});
		}
	}

	/**
	 * Cek apakah element berada di dalam container form Comment Kit / CUI
	 * untuk mencegah WDPCNT merusak placeholder atau label form.
	 */
	function isInsideFormContainer(element) {
		var el = element.parentElement;
		while (el) {
			var classes = el.className || '';
			if (
				classes.indexOf('cui-container') !== -1 ||
				classes.indexOf('cui-wrap') !== -1 ||
				classes.indexOf('cui-field') !== -1 ||
				classes.indexOf('wdp-guestbook') !== -1 ||
				el.tagName === 'FORM'
			) {
				return true;
			}
			el = el.parentElement;
		}
		return false;
	}

	function wdpDisplayCustomName() {
		try {
			const params = new URLSearchParams(window.location.search);
			const recipient = getRecipientName(params, config.urlParams);
			const targets = document.querySelectorAll(config.selector);

			if (targets.length === 0) return;

			targets.forEach(function(element) {
				// Guard 1: Jika elemen dikelola Widget Elementor Guest Name → skip sepenuhnya
				if (element.getAttribute('data-wdp-url-params') || (element.closest && element.closest('[data-wdp-url-params]'))) return;

				// Guard 2: Jika elemen berada di dalam container form → skip
				if (isInsideFormContainer(element)) return;

				if (recipient) {
					// Hanya ganti teks jika teks default "Tamu Undangan" ditemukan.
					// Jika tidak ditemukan (teks custom), biarkan untuk menjaga style typography.
					if (element.textContent.indexOf(config.defaultText) !== -1) {
						replaceTextInNode(element, config.defaultText, recipient);
					}
					// TIDAK melakukan fallback replace seluruh textContent — ini mencegah
					// kerusakan style typography Elementor pada elemen dengan teks custom.
				} else {
					if (!element.textContent.trim()) {
						element.textContent = config.defaultText;
					}
				}
			});
		} catch(e) {}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener('DOMContentLoaded', wdpDisplayCustomName);
	} else {
		wdpDisplayCustomName();
	}
})();
