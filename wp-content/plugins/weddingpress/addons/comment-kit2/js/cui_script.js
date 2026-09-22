jQuery(document).ready(function ($) {
  $(this).find(':submit').removeAttr("disabled");
  var CUI_data = (typeof CUI_WP !== 'undefined') ? CUI_WP : (typeof ELKIT_CUI_WP !== 'undefined' ? ELKIT_CUI_WP : {});
  var rawNonce = CUI_data.cuiNonce || CUI_data.elkit_cuiNonce || CUI_data.elkitCuiNonce || CUI_data.nonce || '';
  CUI = {
    ajaxurl: CUI_data.ajaxurl || window.ajaxurl || '/wp-admin/admin-ajax.php',
    nonce: rawNonce,
    textCounter: CUI_data.textCounter,
    textCounterNum: (CUI_data.textCounterNum !== '') ? CUI_data.textCounterNum : 300,
    jpages: CUI_data.jpages,
    numPerPage: (CUI_data.jPagesNum !== '') ? CUI_data.jPagesNum : 10,
    widthWrap: (CUI_data.widthWrap !== '') ? CUI_data.widthWrap : '',
    autoLoad: CUI_data.autoLoad,
    thanksComment: CUI_data.thanksComment,
    thanksReplyComment: CUI_data.thanksReplyComment,
    duplicateComment: CUI_data.duplicateComment,
    insertImage: CUI_data.insertImage,
    insertVideo: CUI_data.insertVideo,
    insertLink: CUI_data.insertLink,
    accept: CUI_data.accept,
    cancel: CUI_data.cancel,
    reply: CUI_data.reply,
    checkVideo: CUI_data.checkVideo,
    textWriteComment: CUI_data.textWriteComment,
    classPopularComment: CUI_data.classPopularComment,
    textNavPrev: CUI_data.textNavPrev || 'Prev',
    textNavNext: CUI_data.textNavNext || 'Next',
  };

  //Remove duplicate comment box
  jQuery('.cui-wrap-comments').each(function (index, element) {
    var ids = jQuery('[id=\'' + this.id + '\']');
    if (ids.length > 1) {
      ids.slice(1).closest('.cui-wrapper').remove();
    }
  });

  //Remove id from input hidden comment_parent and comment_post_ID. Para prevenir duplicados
  jQuery('.cui-container-form [name="comment_parent"], .cui-container-form [name="comment_post_ID"]').each(function (index, input) {
    $(input).removeAttr('id');
  });


  // Textarea Counter Plugin
  if (typeof jQuery.fn.textareaCount == 'function' && CUI.textCounter == 'true') {
    $('.cui-textarea').each(function () {
      var textCount = {
        'maxCharacterSize': CUI.textCounterNum,
        'originalStyle': 'cui-counter-info',
        'warningStyle': 'cui-counter-warn',
        'warningNumber': 20,
        'displayFormat': '#left'
      };
      $(this).textareaCount(textCount);
    });
  }

  // PlaceHolder Plugin
  if (typeof jQuery.fn.placeholder == 'function') {
    $('.cui-wrap-form input, .cui-wrap-form textarea, #cui-modal input, #cui-modal textarea').placeholder();
  }
  // Autosize Plugin
  if (typeof autosize == 'function') {
    autosize($('textarea.cui-textarea'));
  }

  //Actualizamos alturas de los videos
  $('.cui-wrapper').each(function () {
    rezizeBoxComments_CUI($(this));
    restoreIframeHeight($(this));
  });
  $(window).resize(function () {
    $('.cui-wrapper').each(function () {
      rezizeBoxComments_CUI($(this));
      restoreIframeHeight($(this));
    });
  });

  // CAPTCHA
  if ($('.cui-captcha').length) {
    captchaValues = captcha_CUI(9);
    $('.cui-captcha-text').html(captchaValues.n1 + ' &#43; ' + captchaValues.n2 + ' = ');
  }

  // OBTENER COMENTARIOS
  // Guard: hanya daftarkan click handler SATU KALI meskipun WDP Pro & ELKIT Lite aktif bersamaan
  if (!window.cuiClickHandlerRegistered) {
    window.cuiClickHandlerRegistered = true;
    var cuiToggleLock = {};
    $(document).off('click.cuiLinkToggle', 'a.cui-link').on('click.cuiLinkToggle', 'a.cui-link', function (e) {
      e.preventDefault();
      var linkVars = getUrlVars_CUI($(this).attr('href'));
      var post_id = linkVars.post_id;
      if (cuiToggleLock[post_id]) {
        return false;
      }
      cuiToggleLock[post_id] = true;
      setTimeout(function() {
        delete cuiToggleLock[post_id];
      }, 250);

      var num_comments = linkVars.comments;
      var num_get_comments = linkVars.get;
      var order_comments = linkVars.order;
      $("#cui-wrap-commnent-" + post_id).slideToggle(200);
      var $container_comment = $('#cui-container-comment-' + post_id);
      if ($container_comment.length && $container_comment.html().length === 0) {
        getComments_CUI(post_id, num_comments, num_get_comments, order_comments);
      }
      return false;
    });
  }
  // CARGAR COMENTARIOS AUTOMÁTICAMENTE
  // Fungsi pembantu untuk membuka kotak komentar (dipanggil saat init & re-render)
  function cuiAutoOpenComments($scope) {
    var $links = $scope ? $scope.find('a.cui-link') : $('a.cui-link');
    $links.each(function () {
      var linkVars = getUrlVars_CUI($(this).attr('href'));
      var post_id = linkVars.post_id;
      if ($('body').hasClass('elementor-editor-active')) {
        // Di editor: selalu buka agar bisa preview style secara real-time
        $("#cui-wrap-commnent-" + post_id).show();
        var $container_comment = $('#cui-container-comment-' + post_id);
        if ($container_comment.length && $container_comment.html().length === 0) {
          getComments_CUI(post_id, linkVars.comments, linkVars.get, linkVars.order);
        }
      } else if ($(this).hasClass('auto-load-true')) {
        // Di frontend: hanya buka jika opsi auto_load aktif
        if (!$(this).data('cui-auto-loaded')) {
          $(this).data('cui-auto-loaded', true);
          $("#cui-wrap-commnent-" + post_id).show();
          var $container_comment = $('#cui-container-comment-' + post_id);
          if ($container_comment.length && $container_comment.html().length === 0) {
            getComments_CUI(post_id, linkVars.comments, linkVars.get, linkVars.order);
          }
        }
      }
    });
  }

  // Jalankan saat document ready
  if ($('a.cui-link').length) {
    cuiAutoOpenComments(null);
  }

  // Jalankan ulang setiap kali Elementor me-render widget di editor (saat style berubah)
  if (typeof elementorFrontend !== 'undefined' && elementorFrontend.hooks) {
    elementorFrontend.hooks.addAction('frontend/element_ready/weddingpress-kit2/default', function ($scope) {
      cuiAutoOpenComments($scope);
    });
  } else {
    jQuery(window).on('elementor/frontend/init', function () {
      elementorFrontend.hooks.addAction('frontend/element_ready/weddingpress-kit2/default', function ($scope) {
        cuiAutoOpenComments($scope);
      });
    });
  }

  //Mostrar - Ocultar Enlaces de Responder, Editar
  // $(document).delegate('li.cui-item-comment', 'mouseover mouseout', function (event) {
  //   event.stopPropagation();
  //   if (event.type === 'mouseover') {
  //     $(this).find('.cui-comment-actions:first').show();
  //   } else {
  //     $(this).find('.cui-comment-actions').hide();
  //   }
  // });

  //Cancelar acciones
  $(document).find('.cui-container-form').keyup(function (tecla) {
    post_id = $(this).find('form').attr('id').replace('commentform-', '');
    if (tecla.which == 27) {
      cancelCommentAction_CUI(post_id);
    }
  });

  //Mostrar - Ocultar Enlaces de Responder, Editar
  $(document).delegate('input.cui-cancel-btn', 'click', function (event) {
    event.stopPropagation();
    post_id = $(this).closest('form').attr('id').replace('commentform-', '');
    cancelCommentAction_CUI(post_id);
  });
  // RESPONDER COMENTARIOS
  $(document).on('click', '.cui-reply-link', function (e) {
    e.preventDefault();
    var linkVars = getUrlVars_CUI($(this).attr('href'));
    var comment_id = linkVars.comment_id;
    var container = $(this).closest('ul.cui-container-comments');
    var post_id = container.length ? container.attr('id').replace('cui-container-comment-', '') : linkVars.post_id;
    //Restauramos cualquier acción
    var form = $('#commentform-' + post_id);
    cancelCommentAction_CUI(post_id, form);
    form.find('[name="comment_parent"]').val(comment_id);//input oculto con referencia al padre
    form.find('.cui-textarea').val('').attr('placeholder', CUI_WP.reply + '. ESC (' + CUI_WP.cancel + ')').focus();
    form.find('input[name="submit"]').addClass('cui-reply-action');
    form.find('input.cui-cancel-btn').show();
    //scroll
    scrollThis_CUI(form);

    return false;
  });

  //EDITAR COMENTARIOS
  $(document).on('click', '.cui-edit-link', function (e) {
    e.preventDefault();
    var linkVars = getUrlVars_CUI($(this).attr('href'));
    var comment_id = linkVars.comment_id;
    var container = $(this).closest('ul.cui-container-comments');
    var post_id = container.length ? container.attr('id').replace('cui-container-comment-', '') : linkVars.post_id;
    //Restauramos cualquier acción
    var form = $('#commentform-' + post_id);
    cancelCommentAction_CUI(post_id, form);
    form.find('[name="comment_parent"]').val(comment_id);//input oculto con referencia al padre
    form.find('.cui-textarea').val('').focus();
    form.find('input[name="submit"]').addClass('cui-edit-action');
    //scroll
    scrollThis_CUI(form);
    getCommentText_CUI(post_id, comment_id);
    
    return false;
  });

  //ELIMINAR COMENTARIOS
  $(document).on('click', '.cui-delete-link', function (e) {
    e.preventDefault();
    var linkVars = getUrlVars_CUI($(this).attr('href'));
    var comment_id = linkVars.comment_id;
    var container = $(this).closest('ul.cui-container-comments');
    var post_id = container.length ? container.attr('id').replace('cui-container-comment-', '') : linkVars.post_id;
    if (confirm(CUI_WP.textMsgDeleteComment)) {
      deleteComment_CUI(post_id, comment_id);
    }
    return false;
  });

  $('input, textarea').focus(function (event) {
    $(this).removeClass('cui-error');
    $(this).siblings('.cui-error-info').hide();
  });

  // ENVIAR COMENTARIO
  $(document).on('submit', '.cui-container-form form', function (event) {
    event.preventDefault();
    $(this).find(':submit').attr("disabled", "disabled");
    $('input, textarea').removeClass('cui-error');
    var formID = $(this).attr('id');
    var post_id = formID.replace('commentform-', '');
    var form = $(this);
    var wrapper = form.closest('.cui-wrapper');
    var link_show_comments = wrapper.find('a.cui-link');
    var num_comments = link_show_comments.length ? link_show_comments.attr('href').split('=')[2] : '0';
    var form_ok = true;

    // VALIDAR COMENTARIO
    var $content = form.find('textarea').val().replace(/\s+/g, ' ');
    //Si el comentario tiene menos de 2 caracteres no se enviará
    if ($content.length < 2) {
      form.find('.cui-textarea').addClass('cui-error');
      form.find('.cui-error-info-text').show();
      setTimeout(function () {
        form.find('.cui-error-info-text').fadeOut(500);
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
          $author.addClass('cui-error');
          form.find('.cui-error-info-name').show();
          setTimeout(function () {
            form.find('.cui-error-info-name').fadeOut(500);
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
          $email.addClass('cui-error');
          form.find('.cui-error-info-email').show();
          setTimeout(function () {
            form.find('.cui-error-info-email').fadeOut(500);
          }, 3000);
          form_ok = false;
        }
      }
      if (!form_ok) {
        $(this).find(':submit').removeAttr('disabled');
        return false;
      }

      // VALIDAR CAPTCHA
      if ($('.cui-captcha').length) {
        var captcha = $('#cui-captcha-value-' + post_id);
        form_ok = true;
        if (captcha.val() != (captchaValues.n1 + captchaValues.n2)) {
          form_ok = false;
          captcha.addClass('cui-error');
        }
        captchaValues = captcha_CUI(9);
        $('.cui-captcha-text').html(captchaValues.n1 + ' &#43; ' + captchaValues.n2 + ' = ');
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
        if (form.find('input[name="submit"]').hasClass('cui-edit-action')) {
          editComment_CUI(post_id, comment_id, form);
        }
        else if (form.find('input[name="submit"]').hasClass('cui-reply-action')) {
          insertCommentReply_CUI(post_id, comment_id, num_comments, form);
        }
        else {
          insertComment_CUI(post_id, num_comments, form);
        }
        cancelCommentAction_CUI(post_id, form);
      }
      $(this).find(':submit').removeAttr('disabled');
    }
    return false;
  });//end submit

  function getComments_CUI(post_id, num_comments, num_get_comments, order_comments) {
    var status = $('#cui-comment-status-' + post_id);
    var $container_comments = $("ul#cui-container-comment-" + post_id);
    if (num_comments > 0) {
      jQuery.ajax({
        type: "POST",
        dataType: "html",// tipo de información que se espera de respuesta
        url: CUI.ajaxurl,
        data: {
          action: 'cui_get_comments',
          post_id: post_id,
          get: num_get_comments,
          order: order_comments,
          nonce: CUI.nonce
        },
        beforeSend: function () {
          status.addClass('cui-loading').html('<span class="cuio-loading"></span>').show();
        },
        success: function (data) {
          if (typeof data === 'object' && data.success === false && data.data.error === 'nonce_expired') {
            refreshNonceCK2(function() {
              getComments_CUI(post_id, num_comments, num_get_comments, order_comments);
            });
            return;
          }
          status.removeClass('cui-loading').html('').hide();
          $container_comments.html(data);
          highlightPopularComments_CUI(post_id, $container_comments);
          $container_comments.show();//Mostramos los Comentarios
          //Insertamos Paginación de Comentarios
          jPages_CUI(post_id, CUI.numPerPage);
          toggleMoreComments($container_comments);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          clog('ajax error');
          clog('jqXHR');
          clog(jqXHR);
          clog('errorThrown');
          clog(errorThrown);
        },
        complete: function (jqXHR, textStatus) {
        }
      });//end jQuery.ajax
    }//end if
    return false;
  }//end function


  function highlightPopularComments_CUI(post_id, $container_comments) {
    var order = $container_comments.data('order');
    if (order == 'likes' && $container_comments.hasClass('cui-multiple-comments cui-has-likes')) {
      var top_likes = $container_comments.find('>.cui-item-comment').eq(0).data('likes');
      var temp = false;
      $container_comments.find('>.cui-item-comment').each(function (index, comment) {
        if (!temp && $(comment).data('likes') == top_likes) {
          $(comment).addClass(CUI.classPopularComment);
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

  function insertComment_CUI(post_id, num_comments, form) {
    if (!form) form = $('#commentform-' + post_id);
    var wrapper = form.closest('.cui-wrapper');
    var link_show_comments = wrapper.find('a.cui-link');
    var comment_form = form;
    var status = wrapper.find('.cui-comment-status');
    var form_data = comment_form.serialize();//obtenemos los datos

    $.ajax({
      type: 'post',
      method: 'post',
      url: comment_form.attr('action'),
      data: form_data,
      dataType: "html",
      beforeSend: function () {
        status.addClass('cui-loading').html('<span class="cuio-loading"></span>').show();
      },
      success: function (data, textStatus) {
        
        // Handle JSON error for nonce expired
        try {
          var res = (typeof data === 'object') ? data : JSON.parse(data);
          if (res.success === false && res.data && res.data.error === 'nonce_expired') {
            refreshNonceCK2(function() {
              insertComment_CUI(post_id, num_comments, form);
            });
            return;
          }
        } catch (e) {}

        status.removeClass('cui-loading').html('');
        if (data != "error") {
          status.html('<p class="cui-ajax-success">' + CUI.thanksComment + '</p>');
          if (link_show_comments.find('span').length) {
            num_comments = String(parseInt(num_comments, 10) + 1);
            link_show_comments.find('span').html(num_comments);
          }
        }
        else {
          status.html('<p class="cui-ajax-error">Error processing your form</p>');
        }

        // Cari target UL list komentar presisi dari wrapper form
        var $ul_target = wrapper.find('ul.cui-container-comments');
        if (!$ul_target.length) {
          $ul_target = $('ul#cui-container-comment-' + post_id);
        }

        // Prepend komentar baru ke DOM list dan pastikan visibel
        $ul_target.prepend(data).show();
        $ul_target.children().removeClass('animated jp-hidden').css('display', '');

        // Update statistik card kehadiran secara real-time (+1)
        var $val_konfirmasi = comment_form.find('[name="konfirmasi"]').val();
        if ($val_konfirmasi) {
          var key_card = '';
          var val_lower = String($val_konfirmasi).toLowerCase();
          if (val_lower.indexOf('tidak') !== -1) {
            key_card = 'tidak_hadir';
          } else if (val_lower.indexOf('ragu') !== -1) {
            key_card = 'masih_ragu';
          } else if (val_lower.indexOf('hadir') !== -1) {
            key_card = 'hadir';
          }
          if (key_card) {
            var $card_target = wrapper.find('.cui_card-' + key_card + ' span:first-child, .elkit_cui_card-' + key_card + ' span:first-child');
            if ($card_target.length) {
              var current_count = parseInt($card_target.text(), 10) || 0;
              $card_target.text(current_count + 1);
            }
          }
        }

        // Actualizamos el Paginador
        jPages_CUI(post_id, CUI.numPerPage, true);
      },
      error: function (XMLHttpRequest, textStatus, errorThrown) {
        status.removeClass('cui-loading').html('<p class="cui-ajax-error" >' + CUI.duplicateComment + '</p>');
      },
      complete: function (jqXHR, textStatus) {
        setTimeout(function () {
          status.removeClass('cui-loading').fadeOut(600);
        }, 2500);
      }
    });//end ajax
    return false;
  }

  function insertCommentReply_CUI(post_id, comment_id, num_comments, form) {
    if (!form) form = $('#commentform-' + post_id);
    var wrapper = form.closest('.cui-wrapper');
    var link_show_comments = wrapper.find('a.cui-link');
    var comment_form = form;
    var status = wrapper.find('.cui-comment-status');
    var item_comment = $('#cui-item-comment-' + comment_id);
    var form_data = comment_form.serialize();//obtenemos los datos

    $.ajax({
      type: 'post',
      method: 'post',
      url: comment_form.attr('action'),
      data: form_data,
      beforeSend: function () {
        status.addClass('cui-loading').html('<span class="cuio-loading"></span>').show();
      },
      success: function (data, textStatus) {

        // Handle JSON error for nonce expired
        try {
          var res = (typeof data === 'object') ? data : JSON.parse(data);
          if (res.success === false && res.data && res.data.error === 'nonce_expired') {
            refreshNonceCK2(function() {
              insertCommentReply_CUI(post_id, comment_id, num_comments, form);
            });
            return;
          }
        } catch (e) {}

        status.removeClass('cui-loading').html('');
        if (data != "error") {
          status.html('<p class="cui-ajax-success">' + CUI.thanksReplyComment + '</p>');
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
            scrollThis_CUI(item_comment.find('ul li').last());
          }, 1000);
        }
        else {
          status.html('<p class="cui-ajax-error">Error in processing your form.</p>');
        }
      },
      error: function (XMLHttpRequest, textStatus, errorThrown) {
        status.html('<p class="cui-ajax-error" >' + CUI.duplicateComment + '</p>');
      },
      complete: function (jqXHR, textStatus) {
        setTimeout(function () {
          status.removeClass('cui-loading').fadeOut(600);
        }, 2500);
      }
    });//end ajax
    return false;

  }

  function editComment_CUI(post_id, comment_id, form) {
    if (!form) form = $("#commentform-" + post_id);
    var status = form.closest('.cui-wrapper').find('.cui-comment-status');
    jQuery.ajax({
      type: "POST",
      //dataType: "html",
      url: CUI.ajaxurl,
      data: {
        action: 'edit_comment_cui',
        post_id: post_id,
        comment_id: comment_id,
        comment_content: form.find('.cui-textarea').val(),
        nonce: CUI.nonce
      },
      beforeSend: function () {
        status.addClass('cui-loading').html('<span class="cuio-loading"></span>').show();
      },
      success: function (result) {
        var data = (typeof result === 'object') ? result : jQuery.parseJSON(result);

        // Handle JSON error for nonce expired
        if (data.success === false && data.data && data.data.error === 'nonce_expired') {
          refreshNonceCK2(function() {
            editComment_CUI(post_id, comment_id, form);
          });
          return;
        }

        status.removeClass('cui-loading').html('');
        if (data.ok === true) {
          $('#cui-comment-' + comment_id).find('.cui-comment-text').html(data.comment_text);
          //scroll
          setTimeout(function () {
            scrollThis_CUI($('#cui-comment-' + comment_id));
          }, 1000);
        }
        else {
          console.log("Errors: " + data.error);
        }
      },//end success
      complete: function (jqXHR, textStatus) {
        setTimeout(function () {
          status.removeClass('cui-loading').fadeOut(600);
        }, 2500);
      }
    });//end jQuery.ajax
    return false;
  }

  function getCommentText_CUI(post_id, comment_id) {
    var form = $("#commentform-" + post_id);
    var status = $('#cui-comment-status-' + post_id);
    jQuery.ajax({
      type: "POST",
      dataType: "html",
      url: CUI.ajaxurl,
      data: {
        action: 'get_comment_text_cui',
        post_id: post_id,
        comment_id: comment_id,
        nonce: CUI.nonce
      },
      beforeSend: function () {
        //status.addClass('cui-loading').html('<span class="cuio-loading"></span>').show();
      },
      success: function (data) {
        //status.removeClass('cui-loading').html('');
        if (data !== 'cui-error') {
          $('#cui-textarea-' + post_id).val(data);
          autosize.update($('#cui-textarea-' + post_id));
          //$('#commentform-'+post_id).find('input[name="submit"]').hide();
          $('#commentform-' + post_id).find('input.cui-cancel-btn').show();
        }
        else {

        }
      },//end success
      complete: function (jqXHR, textStatus) {
        //setTimeout(function(){
        //status.removeClass('cui-loading').hide();
        //},2500);
      }
    });//end jQuery.ajax
    return false;
  }//end function


  function deleteComment_CUI(post_id, comment_id) {
    jQuery.ajax({
      type: "POST",
      dataType: "html",
      url: CUI.ajaxurl,
      data: {
        action: 'delete_comment_cui',
        post_id: post_id,
        comment_id: comment_id,
        nonce: CUI.nonce
      },
      beforeSend: function () {
      },
      success: function (data) {
        // Handle JSON error for nonce expired
        try {
          var res = (typeof data === 'object') ? data : JSON.parse(data);
          if (res.success === false && res.data && res.data.error === 'nonce_expired') {
            refreshNonceCK2(function() {
              deleteComment_CUI(post_id, comment_id);
            });
            return;
          }
        } catch (e) {}

        if (data === 'ok' || (typeof res !== 'undefined' && res.success === true)) {
          $('#cui-item-comment-' + comment_id).remove();
          if (res && res.data) {
            if (res.data.counts) {
              var c = res.data.counts;
              $('.cui_card-hadir span:first-child, .elkit_cui_card-hadir span:first-child').text(c.hadir || 0);
              $('.cui_card-tidak_hadir span:first-child, .elkit_cui_card-tidak_hadir span:first-child').text(c.tidak_hadir || 0);
              $('.cui_card-masih_ragu span:first-child, .elkit_cui_card-masih_ragu span:first-child').text(c.masih_ragu || 0);
            }
            if (typeof res.data.total !== 'undefined') {
              $('.cui_header_comment_count span, .elkit_cui_header_comment_count span').text(res.data.total);
            }
          }
        }
      }//end success
    });//end jQuery.ajax
    return false;
  }//end function

  //MOSTRAR/OCULTAR MÁS COMENTARIOS
  function toggleMoreComments($container_comments) {
    //console.log("======================= toggleMoreComments ", $container_comments.attr('id'));
    var liComments = $container_comments.find('>li.depth-1.cui-item-comment');
    liComments.each(function (index, element) {
      var ulChildren = $(this).find('> ul.children');
      if (ulChildren.length && ulChildren.find('li').length > 3) {
        ulChildren.find('li:gt(2)').css('display', 'none');
        ulChildren.append('<a href="#" class="cui-load-more-comments">' + CUI_WP.textLoadMore + '</a>');
      }
    });
  }

  $(document).delegate('a.cui-load-more-comments', 'click', function (e) {
    e.preventDefault();
    $(this).parent().find('li.cui-item-comment').fadeIn("slow");
    $(this).remove();
  });

  $(document).delegate('.cui-media-btns a', 'click', function (e) {
    e.preventDefault();
    var post_id = $(this).attr('href').split('=')[1].replace('&action', '');
    var $action = $(this).attr('href').split('=')[2];
    $('body').append('<div id="cui-overlay"></div>');
    $('body').append('<div id="cui-modal"></div>');
    $modalHtml = '<div id="cui-modal-wrap"><span id="cui-modal-close"></span><div id="cui-modal-header"><h3 id="cui-modal-title">Título</h3></div><div id="cui-modal-content"><p>Hola</p></div><div id="cui-modal-footer"><a id="cui-modal-ok-' + post_id + '" class="cui-modal-ok cui-modal-btn" href="#">' + CUI.accept + '</a><a class="cui-modal-cancel cui-modal-btn" href="#">' + CUI.cancel + '</a></div></div>';
    $("#cui-modal").append($modalHtml).fadeIn(250);

    switch ($action) {
      case 'url':
        $('#cui-modal').removeClass().addClass('cui-modal-url');
        $('#cui-modal-title').html(CUI.insertLink);
        $('#cui-modal-content').html('<input type="text" id="cui-modal-url-link" class="cui-modal-input" placeholder="' + CUI_WP.textUrlLink + '"/><input type="text" id="cui-modal-text-link" class="cui-modal-input" placeholder="' + CUI_WP.textToDisplay + '"/>');
        break;

      case 'image':
        $('#cui-modal').removeClass().addClass('cui-modal-image');
        $('#cui-modal-title').html(CUI.insertImage);
        $('#cui-modal-content').html('<input type="text" id="cui-modal-url-image" class="cui-modal-input" placeholder="' + CUI_WP.textUrlImage + '"/><div id="cui-modal-preview"></div>');
        break;

      case 'video':
        $('#cui-modal').removeClass().addClass('cui-modal-video');
        $('#cui-modal-title').html(CUI.insertVideo);
        $('#cui-modal-content').html('<input type="text" id="cui-modal-url-video" class="cui-modal-input" placeholder="' + CUI_WP.textUrlVideo + '"/><div id="cui-modal-preview"></div>');
        $('#cui-modal-footer').prepend('<a id="cui-modal-verifique-video" class="cui-modal-verifique cui-modal-btn" href="#">' + CUI.checkVideo + '</a>');
        break;
    }
  });//
  //acción Ok
  $(document).delegate('.cui-modal-ok', 'click', function (e) {
    e.preventDefault();
    $('#cui-modal input, #cui-modal textarea').removeClass('cui-error');
    var $action = $('#cui-modal').attr('class');
    var post_id = $(this).attr('id').replace('cui-modal-ok-', '');
    switch ($action) {
      case 'cui-modal-url':
        processUrl_CUI(post_id);
        break;
      case 'cui-modal-image':
        processImage_CUI(post_id);
        break;
      case 'cui-modal-video':
        processVideo_CUI(post_id);
        break;
    }
    autosize.update($('.cui-textarea'));
    closeModal_CUI();
    return false;
  });
  //eliminamos errores
  $(document).delegate('#cui-modal input, #cui-modal textarea', 'focus', function (e) {
    $(this).removeClass('cui-error');
  });

  function processUrl_CUI(post_id) {
    var $ok = true;
    var $urlField = $('#cui-modal-url-link');
    var $textField = $('#cui-modal-text-link');
    if ($urlField.val().length < 1) {
      $ok = false;
      $urlField.addClass('cui-error');
    }
    if ($textField.val().length < 1) {
      $ok = false;
      $textField.addClass('cui-error');
    }
    if ($ok) {
      var $urlVal = $urlField.val().replace(/https?:\/\//gi, '');
      var link_show_comments = '<a href="http://' + $urlVal + '" title="' + $textField.val() + '" rel="nofollow" target="_blank">' + $textField.val() + '</a>';
      insertInTextArea_CUI(post_id, link_show_comments);
    }
    return false;
  }

  function processImage_CUI(post_id) {
    var $ok = true;
    var $urlField = $('#cui-modal-url-image');
    if ($urlField.val().length < 1) {
      $ok = false;
      $urlField.addClass('cui-error');
    }
    if ($ok) {
      var $urlVal = $urlField.val();
      var $image = '<img src="' + $urlVal + '" />';
      insertInTextArea_CUI(post_id, $image);
    }
    return false;
  }

  //vista previa de imagen
  $(document).delegate('#cui-modal-url-image', 'change', function (e) {
    setTimeout(function () {
      $('#cui-modal-preview').html('<img src="' + $('#cui-modal-url-image').val() + '" />');
    }, 200);
  });

  function processVideo_CUI(post_id) {
    var $ok = true;
    var $urlField = $('#cui-modal-url-video');
    if (!$('#cui-modal-preview').find('iframe').length) {
      $ok = false;
      $('#cui-modal-preview').html('<p class="cui-modal-error">Please check the video url</p>');
    }
    if ($ok) {
      var $video = '<p>' + $('#cui-modal-preview').find('input[type="hidden"]').val() + '</p>';
      insertInTextArea_CUI(post_id, $video);
    }
    return false;
  }

  //vista previa de video
  $(document).delegate('#cui-modal-verifique-video', 'click', function (e) {
    e.preventDefault();
    var $urlVideo = $('#cui-modal-url-video');
    var $urlVideoVal = $urlVideo.val().replace(/\s+/g, '');
    $urlVideo.removeClass('cui-error');
    $(this).attr('id', '');//desactivamos el enlace

    if ($urlVideoVal.length < 1) {
      $urlVideo.addClass('cui-error');
      $('.cui-modal-video').find('a.cui-modal-verifique').attr('id', 'cui-modal-verifique-video');//activamos el enlace
      return false;
    }

    var data = 'url_video=' + $urlVideoVal;
    $.ajax({
      url: CUI.ajaxurl,
      data: data + '&action=verificar_video_CUI',
      type: "POST",
      dataType: "html",
      beforeSend: function () {
        $('#cui-modal-preview').html('<div class="cui-loading cui-loading-2"></div>');
      },
      success: function (data) {
        if (data != 'error') {
          $('#cui-modal-preview').html(data);
        } else {
          $('#cui-modal-preview').html('<p class="cui-modal-error">Invalid video url</p>');
        }
      },
      error: function (xhr) {
        $('#cui-modal-preview').html('<p class="cui-modal-error">Failed to process, try again</p>');
      },
      complete: function (jqXHR, textStatus) {
        $('.cui-modal-video').find('a.cui-modal-verifique').attr('id', 'cui-modal-verifique-video');//activamos el enlace
      }
    });//end ajax
  });

  function closeModal_CUI() {
    $('#cui-overlay, #cui-modal').remove();
    return false;
  }

  //acción cancelar
  $(document).delegate('#cui-modal-close, .cui-modal-cancel', 'click', function (e) {
    e.preventDefault();
    closeModal_CUI();
    return false;
  });

  function jPages_CUI(post_id, $numPerPage, $destroy) {
    var $idList = 'cui-container-comment-' + post_id;
    var $holder = 'div.cui-holder-' + post_id;
    var $wrap = jQuery('#cui-wrap-commnent-' + post_id);
    
    // Ambil opsi dinamis dari data-attribute wrapper jika ada
    var jpagesAttr = $wrap.attr('data-jpages');
    var perPageAttr = $wrap.attr('data-perpage');
    var scrollTopAttr = $wrap.attr('data-scroll-to-top');
    var prevTextAttr = $wrap.attr('data-prev-text');
    var nextTextAttr = $wrap.attr('data-next-text');

    var isJpagesEnabled = (jpagesAttr !== undefined) ? jpagesAttr : CUI.jpages;
    var actualPerPage = (perPageAttr !== undefined && perPageAttr !== '') ? parseInt(perPageAttr, 10) : parseInt($numPerPage, 10);
    var isScrollToTopEnabled = (scrollTopAttr !== undefined) ? scrollTopAttr : 'true';
    var actualPrevText = (prevTextAttr !== undefined && prevTextAttr !== '') ? prevTextAttr : CUI.textNavPrev;
    var actualNextText = (nextTextAttr !== undefined && nextTextAttr !== '') ? nextTextAttr : CUI.textNavNext;

    // Jika paginasi aktif
    if (typeof jQuery.fn.jPages == 'function' && isJpagesEnabled == 'true') {
      var num_comments = jQuery('#' + $idList + ' > li').length;
      if (num_comments > actualPerPage) {
        if ($destroy) {
          try {
            jQuery($holder).jPages("destroy");
          } catch(e) {}
          jQuery('#' + $idList).children().removeClass('animated jp-hidden').css('display', '');
        }

        // Set flag HANYA jika tombol paginasi secara fisik diklik oleh pengguna
        $(document).off('click.jPagesUserNavCUI', $holder + ' a').on('click.jPagesUserNavCUI', $holder + ' a', function () {
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
                scrollThis_CUI($container.parent());
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

  function captcha_CUI($max) {
    if (!$max) $max = 5;
    return {
      n1: Math.floor(Math.random() * $max + 1),
      n2: Math.floor(Math.random() * $max + 1),
    };
  }

  function scrollThis_CUI($this) {
    if ($this.length) {
      var $position = $this.offset().top;
      var $scrollThis = Math.abs($position - 200);
      $('html,body').animate({ scrollTop: $scrollThis }, 'slow');
    }
    return false;
  }

  function getUrlVars_CUI(url) {
    var query = url.substring(url.indexOf('?') + 1);
    var parts = query.split("&");
    var params = {};
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split("=");
      params[pair[0]] = pair[1];
    }
    return params;
  }

  function cancelCommentAction_CUI(post_id, form) {
    if (!form) form = $('form#commentform-' + post_id);
    var wrapper = form.closest('.cui-wrapper');
    form.find('[name="comment_parent"]').val('0');
    var writeCommentTxt = form.closest('.cui-wrap-comments').data('text-write-comment') || (typeof CUI !== 'undefined' && CUI.textWriteComment ? CUI.textWriteComment : (typeof CUI_WP !== 'undefined' && CUI_WP.textWriteComment ? CUI_WP.textWriteComment : 'Ucapan'));
    form.find('.cui-textarea').val('').attr('placeholder', writeCommentTxt);
    form.find('input[name="submit"]').removeClass();
    form.find('input.cui-cancel-btn').hide();
    autosize.update(form.find('.cui-textarea'));
    form.find('input, textarea').removeClass('cui-error');
    captchaValues = captcha_CUI(9);
    wrapper.find('.cui-captcha-text').html(captchaValues.n1 + ' &#43; ' + captchaValues.n2 + ' = ');
  }

  function restoreIframeHeight(wrapper) {
    var widthWrapper = CUI.widthWrap ? parseInt(CUI.widthWrap, 10) : wrapper.outerWidth();
    // if(widthWrapper >= 321 ) {
    // 	wrapper.find('iframe').attr('height','250px');
    // } else {
    // 	wrapper.find('iframe').attr('height','160px');
    // }
  }

  function refreshNonceCK2(callback) {
    jQuery.ajax({
      url: CUI.ajaxurl,
      type: 'post',
      data: {
        action: 'cui_refresh_nonce_WDP'
      },
      success: function(response) {
        if (response.success) {
          CUI.nonce = response.data.nonce;
          if (callback) callback();
        }
      }
    });
  }

  function rezizeBoxComments_CUI(wrapper) {
    var widthWrapper = CUI.widthWrap ? parseInt(CUI.widthWrap, 10) : wrapper.outerWidth();
    if (widthWrapper <= 480) {
      wrapper.addClass('cui-full');
    } else {
      wrapper.removeClass('cui-full');
    }
  }

  function insertInTextArea_CUI(post_id, $value) {
    //Get textArea HTML control
    var $fieldID = document.getElementById('cui-textarea-' + post_id);

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

  // LIKE COMMENTS
  $(document).delegate('a.cui-rating-link', 'click', function (e) {
    e.preventDefault();
    var comment_id = $(this).attr('href').split('=')[1].replace('&method', '');
    var $method = $(this).attr('href').split('=')[2];
    commentRating_CUI(comment_id, $method);
    return false;
  });

  function commentRating_CUI(comment_id, $method) {
    var $ratingCount = $('#cui-comment-' + comment_id).find('.cui-rating-count');
    var $currentLikes = $ratingCount.text();
    jQuery.ajax({
      type: 'POST',
      url: CUI.ajaxurl,
      data: {
        action: 'cui_comment_rating',
        comment_id: comment_id,
        method: $method,
        nonce: CUI.nonce
      },
      beforeSend: function () {
        $ratingCount.html('').addClass('cuio-loading');
      },
      success: function (result) {
        var data = $.parseJSON(result);
        if (data.success === true) {
          $ratingCount.html(data.likes).attr('title', data.likes + ' ' + CUI_WP.textLikes);
          if (data.likes < 0) {
            $ratingCount.removeClass().addClass('cui-rating-count cui-rating-negative');
          }
          else if (data.likes > 0) {
            $ratingCount.removeClass().addClass('cui-rating-count cui-rating-positive');
          }
          else {
            $ratingCount.removeClass().addClass('cui-rating-count cui-rating-neutral');
          }
        } else {
          $ratingCount.html($currentLikes);
        }
      },
      error: function (xhr) {
        $ratingCount.html($currentLikes);
      },
      complete: function (data) {
        $ratingCount.removeClass('cuio-loading');
      }//end success

    });//end jQuery.ajax
  }

  function clog(msg) {
    console.log(msg);
  }

  function cc(msg, msg2) {
    console.log(msg, msg2);
  }

  // show and hide note
    $(document).delegate('a.cui_note_button','click',function (e) {
        e.preventDefault();
       var note_area = $(this).closest('.cui-select-attending').find('.cui_note_texarea');
        note_area.toggleClass('active');
    })
});//end ready


function gotoTop() {
    var elmnt = document.getElementById("cui-box");
    elmnt.scrollTop = 0;
}


jQuery("document").ready(function() {
  // var iHeight = $("#cui-box").height();
  // $(this).addClass("jp-show");
  // $(this).removeClass("jp-hidden");

  // $('.li').removeClass('jp-hidden');
  // $('.li').addClass("jp-show");

 jQuery('.cui-container-comments li.comment').addClass('jp-show');
  // $(this).parent().addClass('jp-hidden');

 



  // var msg = 'DIV height is :<b> ' + iHeight + 'px</b> and ScrollHeight is :<b>' + iScrollHeight + 'px</b>';

  // $("span").html(msg);

});
