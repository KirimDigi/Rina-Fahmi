jQuery(document).ready(function ($) {
  // Mencegah eksekusi ganda jika WDP Pro dan Elkit aktif bersamaan
  if (window.wdpScriptLoaded) return;
  window.wdpScriptLoaded = true;

  $(this).find(':submit').removeAttr("disabled");
  var WDP_data = (typeof WDP_WP !== 'undefined') ? WDP_WP : (typeof ELKIT_WP !== 'undefined' ? ELKIT_WP : {});
  var rawNonce = WDP_data.wdpNonce || WDP_data.elkitNonce || WDP_data.nonce || '';
  WDP = {
    ajaxurl: WDP_data.ajaxurl || window.ajaxurl || '/wp-admin/admin-ajax.php',
    nonce: rawNonce,
    textCounter: WDP_data.textCounter,
    textCounterNum: (WDP_data.textCounterNum !== '') ? WDP_data.textCounterNum : 300,
    jpages: WDP_data.jpages,
    numPerPage: (WDP_data.jPagesNum !== '') ? WDP_data.jPagesNum : 10,
    widthWrap: (WDP_data.widthWrap !== '') ? WDP_data.widthWrap : '',
    autoLoad: WDP_data.autoLoad,
    thanksComment: WDP_data.thanksComment,
    thanksReplyComment: WDP_data.thanksReplyComment,
    duplicateComment: WDP_data.duplicateComment,
    insertImage: WDP_data.insertImage,
    insertVideo: WDP_data.insertVideo,
    insertLink: WDP_data.insertLink,
    accept: WDP_data.accept,
    cancel: WDP_data.cancel,
    reply: WDP_data.reply,
    checkVideo: WDP_data.checkVideo,
    textWriteComment: WDP_data.textWriteComment,
    classPopularComment: WDP_data.classPopularComment,
    textNavPrev: WDP_data.textNavPrev || 'Prev',
    textNavNext: WDP_data.textNavNext || 'Next',
  };

  //Remove duplicate comment box
  jQuery('.wdp-wrap-comments').each(function (index, element) {
    var ids = jQuery('[id=\'' + this.id + '\']');
    if (ids.length > 1) {
      ids.slice(1).closest('.wdp-wrapper').remove();
    }
  });

  //Remove id from input hidden comment_parent and comment_post_ID. Para prevenir duplicados
  jQuery('.wdp-container-form [name="comment_parent"], .wdp-container-form [name="comment_post_ID"]').each(function (index, input) {
    $(input).removeAttr('id');
  });

  // Attendance Button click handler (Comment Kit 1)
  $(document).on('click', '.wdp-attendance-btn', function (e) {
    e.preventDefault();
    var $btn = $(this);
    var val = $btn.attr('data-value');
    var $group = $btn.closest('.wdp-attendance-btn-group');
    $group.find('.wdp-attendance-btn').removeClass('active');
    $btn.addClass('active');
    $group.siblings('.wdp-attendance-hidden-input').val(val).trigger('change');
  });


  // Textarea Counter Plugin
  if (typeof jQuery.fn.textareaCount == 'function' && WDP.textCounter == 'true') {
    $('.wdp-textarea').each(function () {
      var textCount = {
        'maxCharacterSize': WDP.textCounterNum,
        'originalStyle': 'wdp-counter-info',
        'warningStyle': 'wdp-counter-warn',
        'warningNumber': 20,
        'displayFormat': '#left'
      };
      $(this).textareaCount(textCount);
    });
  }

  // PlaceHolder Plugin
  if (typeof jQuery.fn.placeholder == 'function') {
    $('.wdp-wrap-form input, .wdp-wrap-form textarea, #wdp-modal input, #wdp-modal textarea').placeholder();
  }
  // Autosize Plugin
  if (typeof autosize == 'function') {
    autosize($('textarea.wdp-textarea'));
  }

  //Actualizamos alturas de los videos
  $('.wdp-wrapper').each(function () {
    rezizeBoxComments_WDP($(this));
    restoreIframeHeight($(this));
  });
  $(window).resize(function () {
    $('.wdp-wrapper').each(function () {
      rezizeBoxComments_WDP($(this));
      restoreIframeHeight($(this));
    });
  });

  // CAPTCHA
  if ($('.wdp-captcha').length) {
    captchaValues = captcha_WDP(9);
    $('.wdp-captcha-text').html(captchaValues.n1 + ' &#43; ' + captchaValues.n2 + ' = ');
  }

  // OBTENER COMENTARIOS
  // Guard: hanya daftarkan click handler SATU KALI meskipun WDP Pro & ELKIT Lite aktif bersamaan
  if (!window.wdpClickHandlerRegistered) {
    window.wdpClickHandlerRegistered = true;
    var wdpToggleLock = {};
    $(document).off('click.wdpLinkToggle', 'a.wdp-link').on('click.wdpLinkToggle', 'a.wdp-link', function (e) {
      e.preventDefault();
      var linkVars = getUrlVars_WDP($(this).attr('href'));
      var post_id = linkVars.post_id;
      if (wdpToggleLock[post_id]) {
        return false;
      }
      wdpToggleLock[post_id] = true;
      setTimeout(function() {
        delete wdpToggleLock[post_id];
      }, 250);

      var num_comments = linkVars.comments;
      var num_get_comments = linkVars.get;
      var order_comments = linkVars.order;
      $("#wdp-wrap-commnent-" + post_id).slideToggle(200);
      var $container_comment = $('#wdp-container-comment-' + post_id);
      if ($container_comment.length && $container_comment.html().length === 0) {
        getComments_WDP(post_id, num_comments, num_get_comments, order_comments);
      }
      return false;
    });
  }
  // CARGAR COMENTARIOS AUTOMÁTICAMENTE
  // Fungsi pembantu untuk membuka kotak komentar (dipanggil saat init & re-render)
  function wdpAutoOpenComments($scope) {
    var $links = $scope ? $scope.find('a.wdp-link') : $('a.wdp-link');
    $links.each(function () {
      var linkVars = getUrlVars_WDP($(this).attr('href'));
      var post_id = linkVars.post_id;
      if ($('body').hasClass('elementor-editor-active')) {
        // Di editor: selalu buka agar bisa preview style secara real-time
        $("#wdp-wrap-commnent-" + post_id).show();
        var $container_comment = $('#wdp-container-comment-' + post_id);
        if ($container_comment.length && $container_comment.html().length === 0) {
          getComments_WDP(post_id, linkVars.comments, linkVars.get, linkVars.order);
        }
      } else if ($(this).hasClass('auto-load-true')) {
        // Di frontend: hanya buka jika opsi auto_load aktif
        if (!$(this).data('wdp-auto-loaded')) {
          $(this).data('wdp-auto-loaded', true);
          $("#wdp-wrap-commnent-" + post_id).show();
          var $container_comment = $('#wdp-container-comment-' + post_id);
          if ($container_comment.length && $container_comment.html().length === 0) {
            getComments_WDP(post_id, linkVars.comments, linkVars.get, linkVars.order);
          }
        }
      }
    });
  }

  // Jalankan saat document ready
  if ($('a.wdp-link').length) {
    wdpAutoOpenComments(null);
  }

  // Jalankan ulang setiap kali Elementor me-render widget di editor (saat style berubah)
  if (typeof elementorFrontend !== 'undefined' && elementorFrontend.hooks) {
    elementorFrontend.hooks.addAction('frontend/element_ready/weddingpress-commentkit/default', function ($scope) {
      wdpAutoOpenComments($scope);
    });
  } else {
    jQuery(window).on('elementor/frontend/init', function () {
      elementorFrontend.hooks.addAction('frontend/element_ready/weddingpress-commentkit/default', function ($scope) {
        wdpAutoOpenComments($scope);
      });
    });
  }

  //Mostrar - Ocultar Enlaces de Responder, Editar
  $(document).delegate('li.wdp-item-comment', 'mouseover mouseout', function (event) {
    event.stopPropagation();
    if (event.type === 'mouseover') {
      $(this).find('.wdp-comment-actions:first').show();
    } else {
      $(this).find('.wdp-comment-actions').hide();
    }
  });

  //Cancelar acciones
  $(document).find('.wdp-container-form').keyup(function (tecla) {
    post_id = $(this).find('form').attr('id').replace('commentform-', '');
    if (tecla.which == 27) {
      cancelCommentAction_WDP(post_id);
    }
  });

  //Mostrar - Ocultar Enlaces de Responder, Editar
  $(document).delegate('input.wdp-cancel-btn', 'click', function (event) {
    event.stopPropagation();
    post_id = $(this).closest('form').attr('id').replace('commentform-', '');
    cancelCommentAction_WDP(post_id);
  });

  // RESPONDER COMENTARIOS
  $(document).delegate('.wdp-reply-link', 'click', function (e) {
    e.preventDefault();
    var linkVars = getUrlVars_WDP($(this).attr('href'));
    var comment_id = linkVars.comment_id;
    var post_id = linkVars.post_id;
    //Restauramos cualquier acción
    cancelCommentAction_WDP(post_id);
    var form = $('#commentform-' + post_id);
    form.find('[name="comment_parent"]').val(comment_id);//input oculto con referencia al padre
    form.find('.wdp-textarea').val('').attr('placeholder', WDP_WP.reply + '. ESC (' + WDP_WP.cancel + ')').focus();
    form.find('input[name="submit"]').addClass('wdp-reply-action');
    $('#commentform-' + post_id).find('input.wdp-cancel-btn').show();
    //scroll
    scrollThis_WDP(form);

    return false;
  });

  //EDITAR COMENTARIOS
  $(document).delegate('.wdp-edit-link', 'click', function (e) {
    e.preventDefault();
    var linkVars = getUrlVars_WDP($(this).attr('href'));
    var comment_id = linkVars.comment_id;
    var post_id = linkVars.post_id;
    //Restauramos cualquier acción
    cancelCommentAction_WDP(post_id);
    var form = $('#commentform-' + post_id);
    form.find('[name="comment_parent"]').val(comment_id);//input oculto con referencia al padre
    form.find('.wdp-textarea').val('').focus();
    form.find('input[name="submit"]').addClass('wdp-edit-action');
    //scroll
    scrollThis_WDP(form);
    getCommentText_WDP(post_id, comment_id);
  });

  //ELIMINAR COMENTARIOS
  $(document).delegate('.wdp-delete-link', 'click', function (e) {
    e.preventDefault();
    var linkVars = getUrlVars_WDP($(this).attr('href'));
    var comment_id = linkVars.comment_id;
    var post_id = linkVars.post_id;
    if (confirm(WDP_WP.textMsgDeleteComment)) {
      deleteComment_WDP(post_id, comment_id);
    }
  });

  $('input, textarea').focus(function (event) {
    $(this).removeClass('wdp-error');
    $(this).siblings('.wdp-error-info').hide();
  });

  // ENVIAR COMENTARIO
  $(document).on('submit', '.wdp-container-form form', function (event) {
    event.preventDefault();
    $(this).find(':submit').attr("disabled", "disabled");
    $('input, textarea').removeClass('wdp-error');
    var formID = $(this).attr('id');
    var post_id = formID.replace('commentform-', '');
    var form = $('#commentform-' + post_id);
    var link_show_comments = $('#wdp-link-' + post_id);
    var num_comments = link_show_comments.attr('href').split('=')[2];
    var form_ok = true;

    // VALIDAR COMENTARIO
    var $content = form.find('textarea').val().replace(/\s+/g, ' ');
    //Si el comentario tiene menos de 2 caracteres no se enviará
    if ($content.length < 2) {
      form.find('.wdp-textarea').addClass('wdp-error');
      form.find('.wdp-error-info-text').show();
      setTimeout(function () {
        form.find('.wdp-error-info-text').fadeOut(500);
      }, 2500);
      $(this).find(':submit').removeAttr('disabled');
      return false;
    }
    else {
      // VALIDAR CAMPOS DE TEXTO
      if ($(this).find('input#author').length) {
        var $author = $(this).find('input#author');
        var $authorVal = $author.val().replace(/\s+/g, ' ');
        var $authorRegEx = /^[^?%$=\/]{1,30}$/i;

        if ($authorVal == ' ' || !$authorRegEx.test($authorVal)) {
          $author.addClass('wdp-error');
          form.find('.wdp-error-info-name').show();
          setTimeout(function () {
            form.find('.wdp-error-info-name').fadeOut(500);
          }, 3000);
          form_ok = false;
        }
      }
      if ($(this).find('input#email').length) {
        var $emailRegEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,6}$/i;
        var $email = $(this).find('input#email');
        var $emailVal = $email.val().replace(/\s+/g, '');
        $email.val($emailVal);

        if (!$emailRegEx.test($emailVal)) {
          $email.addClass('wdp-error');
          form.find('.wdp-error-info-email').show();
          setTimeout(function () {
            form.find('.wdp-error-info-email').fadeOut(500);
          }, 3000);
          form_ok = false;
        }
      }
      if (!form_ok) {
        $(this).find(':submit').removeAttr('disabled');
        return false;
      }

      // VALIDAR CAPTCHA
      if ($('.wdp-captcha').length) {
        var captcha = $('#wdp-captcha-value-' + post_id);
        form_ok = true;
        if (captcha.val() != (captchaValues.n1 + captchaValues.n2)) {
          form_ok = false;
          captcha.addClass('wdp-error');
        }
        captchaValues = captcha_WDP(9);
        $('.wdp-captcha-text').html(captchaValues.n1 + ' &#43; ' + captchaValues.n2 + ' = ');
        captcha.val('');
      }

      //Si el formulario está validado
      if (form_ok === true) {
        //Si no existe campo lo creamos
        if (!form.find('input[name="comment_press"]').length) {
          form.find('input[name="submit"]').after('<input type="hidden" name="comment_press" value="true">');
        }
        comment_id = form.find('[name="comment_parent"]').val();
        //Insertamos un nuevo comentario
        if (form.find('input[name="submit"]').hasClass('wdp-edit-action')) {
          editComment_WDP(post_id, comment_id);
        }
        else if (form.find('input[name="submit"]').hasClass('wdp-reply-action')) {
          insertCommentReply_WDP(post_id, comment_id, num_comments);
        }
        else {
          insertComment_WDP(post_id, num_comments);
        }
        cancelCommentAction_WDP(post_id);
      }
      $(this).find(':submit').removeAttr('disabled');
    }
    return false;
  });//end submit

  function getComments_WDP(post_id, num_comments, num_get_comments, order_comments, _retried) {
    var status = $('#wdp-comment-status-' + post_id);
    var $container_comments = $("ul#wdp-container-comment-" + post_id);
    if (num_comments > 0) {
      jQuery.ajax({
        type: "POST",
        dataType: "html",
        url: WDP.ajaxurl,
        data: {
          action: 'wdp_get_comments',
          post_id: post_id,
          get: num_get_comments,
          order: order_comments,
          nonce: WDP.nonce
        },
        beforeSend: function () {
          status.addClass('wdp-loading').html('<span class="wdpo-loading"></span>').show();
        },
        success: function (data) {
          // Deteksi JSON error nonce_expired dari PHP → retry otomatis sekali
          if (typeof data === 'string' && data.indexOf('wdp_error') !== -1) {
            try {
              var parsed = JSON.parse(data);
              if (parsed.wdp_error === 'nonce_expired' && !_retried) {
                WDP.nonce = parsed.new_nonce; // perbarui nonce
                status.removeClass('wdp-loading').html('');
                getComments_WDP(post_id, num_comments, num_get_comments, order_comments, true);
                return;
              }
            } catch(e) { /* bukan JSON valid, lanjutkan normal */ }
          }
          status.removeClass('wdp-loading').html('').hide();
          $container_comments.html(data);
          highlightPopularComments_WDP(post_id, $container_comments);
          $container_comments.show();
          jPages_WDP(post_id, WDP.numPerPage);
          toggleMoreComments($container_comments);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          clog('ajax error');
          clog(jqXHR);
          clog(errorThrown);
          // Tampilkan pesan error yang informatif ke user
          var errMsg = 'Gagal memuat ucapan. Silakan muat ulang halaman.';
          if (jqXHR.status === 0) {
            errMsg = 'Tidak ada koneksi internet. Periksa koneksi Anda.';
          }
          status.removeClass('wdp-loading').html('<p class="wdp-ajax-error">' + errMsg + '</p>').show();
        },
        complete: function (jqXHR, textStatus) {
        }
      });
    }
    return false;
  }


  function highlightPopularComments_WDP(post_id, $container_comments) {
    var order = $container_comments.data('order');
    if (order == 'likes' && $container_comments.hasClass('wdp-multiple-comments wdp-has-likes')) {
      var top_likes = $container_comments.find('>.wdp-item-comment').eq(0).data('likes');
      var temp = false;
      $container_comments.find('>.wdp-item-comment').each(function (index, comment) {
        if (!temp && $(comment).data('likes') == top_likes) {
          $(comment).addClass(WDP.classPopularComment);
          temp = true;
        }
      });
    }
  }

  function jQFormSerializeArrToJson(formSerializeArr) {
    var jsonObj = {};
    jQuery.map(formSerializeArr, function (n, i) {
      jsonObj[n.name] = n.value;
    });

    return jsonObj;
  }

  function insertComment_WDP(post_id, num_comments) {
    var link_show_comments = $('#wdp-link-' + post_id);
    var comment_form = $('#commentform-' + post_id);
    var status = $('#wdp-comment-status-' + post_id);
    var form_data = comment_form.serialize();//obtenemos los datos

    $.ajax({
      type: 'post',
      method: 'post',
      url: comment_form.attr('action'),
      data: form_data,
      dataType: "html",
      beforeSend: function () {
        status.addClass('wdp-loading').html('<span class="wdpo-loading"></span>').show();
      },
      success: function (data, textStatus) {
        status.removeClass('wdp-loading').html('');
        if (data != "error") {
          status.html('<p class="wdp-ajax-success">' + WDP.thanksComment + '</p>');
          if (link_show_comments.find('span').length) {
            num_comments = String(parseInt(num_comments, 10) + 1);
            link_show_comments.find('span').html(num_comments);
          }
        }
        else {
          status.html('<p class="wdp-ajax-error">Error processing your form</p>');
        }
        //Agregamos el nuevo comentario a la lista
        var wrapper_wdp = comment_form.closest('.wdp-wrapper');
        var $ul_target_wdp = wrapper_wdp.length ? wrapper_wdp.find('ul.wdp-container-comments') : $('ul#wdp-container-comment-' + post_id);
        $ul_target_wdp.prepend(data).show();
        $ul_target_wdp.children().removeClass('animated jp-hidden').css('display', '');

        // Update statistik card kehadiran secara real-time (+1)
        var $val_konfirmasi_wdp = comment_form.find('[name="konfirmasi"]').val();
        if ($val_konfirmasi_wdp && wrapper_wdp.length) {
          var key_card_wdp = '';
          var val_lower_wdp = String($val_konfirmasi_wdp).toLowerCase();
          if (val_lower_wdp.indexOf('tidak') !== -1) {
            key_card_wdp = 'tidak_hadir';
          } else if (val_lower_wdp.indexOf('ragu') !== -1) {
            key_card_wdp = 'masih_ragu';
          } else if (val_lower_wdp.indexOf('hadir') !== -1) {
            key_card_wdp = 'hadir';
          }
          if (key_card_wdp) {
            var $card_target_wdp = wrapper_wdp.find('.wdp_card-' + key_card_wdp + ' span:first-child, .elkit_wdp_card-' + key_card_wdp + ' span:first-child, .cui_card-' + key_card_wdp + ' span:first-child, .elkit_cui_card-' + key_card_wdp + ' span:first-child');
            if ($card_target_wdp.length) {
              var current_count_wdp = parseInt($card_target_wdp.text(), 10) || 0;
              $card_target_wdp.text(current_count_wdp + 1);
            }
          }
        }

        //Actualizamos el Paginador
        jPages_WDP(post_id, WDP.numPerPage, true);
      },
      error: function (XMLHttpRequest, textStatus, errorThrown) {
        // Tentukan pesan error yang tepat berdasarkan jenis kegagalan
        var errMsg;
        if (XMLHttpRequest.status === 0) {
          errMsg = 'Tidak ada koneksi internet. Periksa koneksi Anda.';
        } else if (XMLHttpRequest.responseText &&
                   (XMLHttpRequest.responseText.indexOf('Busted') !== -1 ||
                    XMLHttpRequest.responseText.indexOf('nonce') !== -1)) {
          errMsg = 'Sesi habis. Silakan refresh halaman dan coba lagi.';
        } else if (XMLHttpRequest.status >= 500) {
          errMsg = 'Terjadi kesalahan pada server. Silakan coba lagi.';
        } else {
          errMsg = WDP.duplicateComment;
        }
        status.removeClass('wdp-loading').html('<p class="wdp-ajax-error">' + errMsg + '</p>');
      },
      complete: function (jqXHR, textStatus) {
        setTimeout(function () {
          status.removeClass('wdp-loading').fadeOut(600);
        }, 2500);
      }
    });//end ajax
    return false;
  }

  function insertCommentReply_WDP(post_id, comment_id, num_comments) {
    var link_show_comments = $('#wdp-link-' + post_id);
    var comment_form = $('#commentform-' + post_id);
    var status = $('#wdp-comment-status-' + post_id);
    var item_comment = $('#wdp-item-comment-' + comment_id);
    var form_data = comment_form.serialize();//obtenemos los datos

    $.ajax({
      type: 'post',
      method: 'post',
      url: comment_form.attr('action'),
      data: form_data,
      beforeSend: function () {
        status.addClass('wdp-loading').html('<span class="wdpo-loading"></span>').show();
      },
      success: function (data, textStatus) {
        status.removeClass('wdp-loading').html('');
        if (data != "error") {
          status.html('<p class="wdp-ajax-success">' + WDP.thanksReplyComment + '</p>');
          if (link_show_comments.find('span').length) {
            num_comments = parseInt(num_comments, 10) + 1;
            link_show_comments.find('span').html(num_comments);
          }
          if (!item_comment.find('ul').length) {
            item_comment.append('<ul class="children"></ul>');
          }
          //Agregamos el nuevo comentario a la lista
          item_comment.find('ul').append(data);

          //scroll
          setTimeout(function () {
            scrollThis_WDP(item_comment.find('ul li').last());
          }, 1000);
        }
        else {
          status.html('<p class="wdp-ajax-error">Error in processing your form.</p>');
        }
      },
      error: function (XMLHttpRequest, textStatus, errorThrown) {
        // Pesan error spesifik untuk reply komentar
        var errMsg;
        if (XMLHttpRequest.status === 0) {
          errMsg = 'Tidak ada koneksi internet. Periksa koneksi Anda.';
        } else if (XMLHttpRequest.status >= 500) {
          errMsg = 'Terjadi kesalahan pada server. Silakan coba lagi.';
        } else {
          errMsg = WDP.duplicateComment;
        }
        status.html('<p class="wdp-ajax-error">' + errMsg + '</p>');
      },
      complete: function (jqXHR, textStatus) {
        setTimeout(function () {
          status.removeClass('wdp-loading').fadeOut(600);
        }, 2500);
      }
    });//end ajax
    return false;

  }

  function editComment_WDP(post_id, comment_id) {
    var form = $("#commentform-" + post_id);
    var status = $('#wdp-comment-status-' + post_id);
    jQuery.ajax({
      type: "POST",
      //dataType: "html",
      url: WDP.ajaxurl,
      data: {
        action: 'edit_comment_wdp',
        post_id: post_id,
        comment_id: comment_id,
        comment_content: form.find('.wdp-textarea').val(),
        nonce: WDP.nonce
      },
      beforeSend: function () {
        status.addClass('wdp-loading').html('<span class="wdpo-loading"></span>').show();
      },
      success: function (result) {
        status.removeClass('wdp-loading').html('');
        var data = jQuery.parseJSON(result);
        if (data.ok === true) {
          $('#wdp-comment-' + comment_id).find('.wdp-comment-text').html(data.comment_text);
          //scroll
          setTimeout(function () {
            scrollThis_WDP($('#wdp-comment-' + comment_id));
          }, 1000);
        }
        else {
          console.log("Errors: " + data.error);
        }
      },//end success
      complete: function (jqXHR, textStatus) {
        setTimeout(function () {
          status.removeClass('wdp-loading').fadeOut(600);
        }, 2500);
      }
    });//end jQuery.ajax
    return false;
  }

  function getCommentText_WDP(post_id, comment_id) {
    var form = $("#commentform-" + post_id);
    var status = $('#wdp-comment-status-' + post_id);
    jQuery.ajax({
      type: "POST",
      dataType: "html",
      url: WDP.ajaxurl,
      data: {
        action: 'get_comment_text_wdp',
        post_id: post_id,
        comment_id: comment_id,
        nonce: WDP.nonce
      },
      beforeSend: function () {
        //status.addClass('wdp-loading').html('<span class="wdpo-loading"></span>').show();
      },
      success: function (data) {
        //status.removeClass('wdp-loading').html('');
        if (data !== 'wdp-error') {
          $('#wdp-textarea-' + post_id).val(data);
          autosize.update($('#wdp-textarea-' + post_id));
          //$('#commentform-'+post_id).find('input[name="submit"]').hide();
          $('#commentform-' + post_id).find('input.wdp-cancel-btn').show();
        }
        else {

        }
      },//end success
      complete: function (jqXHR, textStatus) {
        //setTimeout(function(){
        //status.removeClass('wdp-loading').hide();
        //},2500);
      }
    });//end jQuery.ajax
    return false;
  }//end function


  function deleteComment_WDP(post_id, comment_id) {
    jQuery.ajax({
      type: "POST",
      dataType: "html",
      url: WDP.ajaxurl,
      data: {
        action: 'delete_comment_wdp',
        post_id: post_id,
        comment_id: comment_id,
        nonce: WDP.nonce
      },
      beforeSend: function () {
      },
      success: function (data) {
        if (data === 'ok') {
          $('#wdp-item-comment-' + comment_id).remove();
        }
      }//end success
    });//end jQuery.ajax
    return false;
  }//end function

  //MOSTRAR/OCULTAR MÁS COMENTARIOS
  function toggleMoreComments($container_comments) {
    //console.log("======================= toggleMoreComments ", $container_comments.attr('id'));
    var liComments = $container_comments.find('>li.depth-1.wdp-item-comment');
    liComments.each(function (index, element) {
      var ulChildren = $(this).find('> ul.children');
      if (ulChildren.length && ulChildren.find('li').length > 3) {
        ulChildren.find('li:gt(2)').css('display', 'none');
        ulChildren.append('<a href="#" class="wdp-load-more-comments">' + WDP_WP.textLoadMore + '</a>');
      }
    });
  }

  $(document).delegate('a.wdp-load-more-comments', 'click', function (e) {
    e.preventDefault();
    $(this).parent().find('li.wdp-item-comment').fadeIn("slow");
    $(this).remove();
  });

  // $(document).delegate('.wdp-media-btns a', 'click', function (e) {
  //   e.preventDefault();
  //   var post_id = $(this).attr('href').split('=')[1].replace('&action', '');
  //   var $action = $(this).attr('href').split('=')[2];
  //   $('body').append('<div id="wdp-overlay"></div>');
  //   $('body').append('<div id="wdp-modal"></div>');
  //   $modalHtml = '<div id="wdp-modal-wrap"><span id="wdp-modal-close"></span><div id="wdp-modal-header"><h3 id="wdp-modal-title">Título</h3></div><div id="wdp-modal-content"><p>Hola</p></div><div id="wdp-modal-footer"><a id="wdp-modal-ok-' + post_id + '" class="wdp-modal-ok wdp-modal-btn" href="#">' + WDP.accept + '</a><a class="wdp-modal-cancel wdp-modal-btn" href="#">' + WDP.cancel + '</a></div></div>';
  //   $("#wdp-modal").append($modalHtml).fadeIn(250);

  //   switch ($action) {
  //     case 'url':
  //       $('#wdp-modal').removeClass().addClass('wdp-modal-url');
  //       $('#wdp-modal-title').html(WDP.insertLink);
  //       $('#wdp-modal-content').html('<input type="text" id="wdp-modal-url-link" class="wdp-modal-input" placeholder="' + WDP_WP.textUrlLink + '"/><input type="text" id="wdp-modal-text-link" class="wdp-modal-input" placeholder="' + WDP_WP.textToDisplay + '"/>');
  //       break;

  //     case 'image':
  //       $('#wdp-modal').removeClass().addClass('wdp-modal-image');
  //       $('#wdp-modal-title').html(WDP.insertImage);
  //       $('#wdp-modal-content').html('<input type="text" id="wdp-modal-url-image" class="wdp-modal-input" placeholder="' + WDP_WP.textUrlImage + '"/><div id="wdp-modal-preview"></div>');
  //       break;

  //     case 'video':
  //       $('#wdp-modal').removeClass().addClass('wdp-modal-video');
  //       $('#wdp-modal-title').html(WDP.insertVideo);
  //       $('#wdp-modal-content').html('<input type="text" id="wdp-modal-url-video" class="wdp-modal-input" placeholder="' + WDP_WP.textUrlVideo + '"/><div id="wdp-modal-preview"></div>');
  //       $('#wdp-modal-footer').prepend('<a id="wdp-modal-verifique-video" class="wdp-modal-verifique wdp-modal-btn" href="#">' + WDP.checkVideo + '</a>');
  //       break;
  //   }
  // });
  
  //
  //acción Ok
  $(document).delegate('.wdp-modal-ok', 'click', function (e) {
    e.preventDefault();
    $('#wdp-modal input, #wdp-modal textarea').removeClass('wdp-error');
    var $action = $('#wdp-modal').attr('class');
    var post_id = $(this).attr('id').replace('wdp-modal-ok-', '');
    switch ($action) {
      case 'wdp-modal-url':
        processUrl_WDP(post_id);
        break;
      case 'wdp-modal-image':
        processImage_WDP(post_id);
        break;
      case 'wdp-modal-video':
        processVideo_WDP(post_id);
        break;
    }
    autosize.update($('.wdp-textarea'));
    closeModal_WDP();
    return false;
  });
  //eliminamos errores
  $(document).delegate('#wdp-modal input, #wdp-modal textarea', 'focus', function (e) {
    $(this).removeClass('wdp-error');
  });

  function closeModal_WDP() {
    $('#wdp-overlay, #wdp-modal').remove();
    return false;
  }

  //acción cancelar
  $(document).delegate('#wdp-modal-close, .wdp-modal-cancel', 'click', function (e) {
    e.preventDefault();
    closeModal_WDP();
    return false;
  });

  function jPages_WDP(post_id, $numPerPage, $destroy) {
    var $idList = 'wdp-container-comment-' + post_id;
    var $holder = 'div.wdp-holder-' + post_id;
    var $wrap = jQuery('#wdp-wrap-commnent-' + post_id);
    
    // Ambil opsi dinamis dari data-attribute wrapper jika ada
    var jpagesAttr = $wrap.attr('data-jpages');
    var perPageAttr = $wrap.attr('data-perpage');
    var scrollTopAttr = $wrap.attr('data-scroll-to-top');
    var prevTextAttr = $wrap.attr('data-prev-text');
    var nextTextAttr = $wrap.attr('data-next-text');

    var isJpagesEnabled = (jpagesAttr !== undefined) ? jpagesAttr : WDP.jpages;
    var actualPerPage = (perPageAttr !== undefined && perPageAttr !== '') ? parseInt(perPageAttr, 10) : parseInt($numPerPage, 10);
    var isScrollToTopEnabled = (scrollTopAttr !== undefined) ? scrollTopAttr : 'true';
    var actualPrevText = (prevTextAttr !== undefined && prevTextAttr !== '') ? prevTextAttr : WDP.textNavPrev;
    var actualNextText = (nextTextAttr !== undefined && nextTextAttr !== '') ? nextTextAttr : WDP.textNavNext;

    // Jika paginasi aktif
    if (typeof jQuery.fn.jPages == 'function' && isJpagesEnabled == 'true') {
      var num_comments = jQuery('#' + $idList + ' > li').length;
      if (num_comments > actualPerPage) {
        if ($destroy) {
          jQuery('#' + $idList).children().removeClass('animated jp-hidden');
        }

        // Set flag HANYA jika tombol paginasi secara fisik diklik oleh pengguna
        $(document).off('click.jPagesUserNavWDP', $holder + ' a').on('click.jPagesUserNavWDP', $holder + ' a', function () {
          jQuery($holder).data('jpages-user-navigated', true);
        });

        jQuery($holder).show().jPages({
          containerID: $idList,
          previous: "← " + actualPrevText,
          next: actualNextText + " →",
          perPage: actualPerPage,
          minHeight: false,
          keyBrowse: true,
          direction: "forward",
          animation: "fadeIn",
          callback: function(pages, items) {
            // Callback ketika halaman ganti (hanya scroll jika diklik user secara langsung)
            var isUserNavigated = jQuery($holder).data('jpages-user-navigated');
            if (isUserNavigated === true && isScrollToTopEnabled == 'true' && !$destroy) {
              var $container = jQuery('#' + $idList);
              // Jika scroll area aktif, scroll di container list-nya saja. Jika tidak, scroll window.
              var $scrollArea = $container.css('max-height');
              if ($scrollArea && $scrollArea !== 'none') {
                $container.animate({ scrollTop: 0 }, 'slow');
              } else {
                scrollThis_WDP($container.parent());
              }
            }
            // Reset flag agar request lain (seperti ajax/re-init) tidak memicu scroll otomatis
            jQuery($holder).data('jpages-user-navigated', false);
          }
        });
      } else {
        jQuery($holder).hide();
      }
    } else {
      // Jika paginasi dinonaktifkan, pastikan semua komentar tampil dan sembunyikan pagination holder
      jQuery('#' + $idList).children().removeClass('animated jp-hidden');
      jQuery($holder).hide();
    }
    return false;
  }

  function captcha_WDP($max) {
    if (!$max) $max = 5;
    return {
      n1: Math.floor(Math.random() * $max + 1),
      n2: Math.floor(Math.random() * $max + 1),
    };
  }

  function scrollThis_WDP($this) {
    if ($this.length) {
      var $position = $this.offset().top;
      var $scrollThis = Math.abs($position - 200);
      $('html,body').animate({ scrollTop: $scrollThis }, 'slow');
    }
    return false;
  }

  function getUrlVars_WDP(url) {
    var query = url.substring(url.indexOf('?') + 1);
    var parts = query.split("&");
    var params = {};
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split("=");
      params[pair[0]] = pair[1];
    }
    return params;
  }

  function cancelCommentAction_WDP(post_id) {
    $('form#commentform-' + post_id).find('[name="comment_parent"]').val('0');
    $('form#commentform-' + post_id).find('.wdp-textarea').val('').attr('placeholder', WDP.textWriteComment).trigger('keyup');
    $('form#commentform-' + post_id).find('input[name="submit"]').removeClass();
    $('form#commentform-' + post_id).find('input.wdp-cancel-btn').hide();
    autosize.update($('#wdp-textarea-' + post_id));
    $('input, textarea').removeClass('wdp-error');
    captchaValues = captcha_WDP(9);
    $('.wdp-captcha-text').html(captchaValues.n1 + ' &#43; ' + captchaValues.n2 + ' = ');
  }

  function restoreIframeHeight(wrapper) {
    var widthWrapper = WDP.widthWrap ? parseInt(WDP.widthWrap, 10) : wrapper.outerWidth();
    // if(widthWrapper >= 321 ) {
    // 	wrapper.find('iframe').attr('height','250px');
    // } else {
    // 	wrapper.find('iframe').attr('height','160px');
    // }
  }

  function rezizeBoxComments_WDP(wrapper) {
    var widthWrapper = WDP.widthWrap ? parseInt(WDP.widthWrap, 10) : wrapper.outerWidth();
    if (widthWrapper <= 480) {
      wrapper.addClass('wdp-full');
    } else {
      wrapper.removeClass('wdp-full');
    }
  }

  function insertInTextArea_WDP(post_id, $value) {
    //Get textArea HTML control
    var $fieldID = document.getElementById('wdp-textarea-' + post_id);

    //IE
    if (document.selection) {
      $fieldID.focus();
      var sel = document.selection.createRange();
      sel.text = $value;
      return;
    }
    //Firefox, chrome, mozilla
    else if ($fieldID.selectionStart || $fieldID.selectionStart == '0') {
      var startPos = $fieldID.selectionStart;
      var endPos = $fieldID.selectionEnd;
      var scrollTop = $fieldID.scrollTop;
      $fieldID.value = $fieldID.value.substring(0, startPos) + $value + $fieldID.value.substring(endPos, $fieldID.value.length);
      $fieldID.focus();
      $fieldID.selectionStart = startPos + $value.length;
      $fieldID.selectionEnd = startPos + $value.length;
      $fieldID.scrollTop = scrollTop;
    }
    else {
      $fieldID.value += textArea.value;
      $fieldID.focus();
    }
  }

  function clog(msg) {
    console.log(msg);
  }

  function cc(msg, msg2) {
    console.log(msg, msg2);
  }

});//end ready




