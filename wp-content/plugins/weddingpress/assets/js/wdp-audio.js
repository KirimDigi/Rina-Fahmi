(function ($) {
    "use strict";

    // Track active YT players to allow pause on inactive
    var activeYoutubePlayers = {};

    var WidgetAudioHandler = function ($scope, $) {
        var $wrapper = $scope.find('.wdp-audio-wrapper');
        if (!$wrapper.length) {
            return;
        }

        // Get elements
        var $audio = $wrapper.find('audio.wdp-audio-player');
        var isYoutube = $wrapper.data('src-type') === 'youtube';
        var $ytContainer = $wrapper.find('.wdp-youtube-container');
        
        var $ring = $wrapper.find('.wdp-audio-progress-ring');
        var $iconBox = $wrapper.find('.elementor-icon');

        // Config from data attributes
        var config = {
            id: $wrapper.data('player-id'),
            autoplay: $wrapper.data('autoplay'),
            loop: $wrapper.data('loop') === 'yes' || $wrapper.data('loop') === true,
            start: parseFloat($wrapper.data('start')) || 0,
            hasEnd: parseFloat($wrapper.data('end')) > 0 && parseFloat($wrapper.data('end')) > (parseFloat($wrapper.data('start')) || 0),
            end: parseFloat($wrapper.data('end')) || 0,
            pauseInactive: $wrapper.data('pause-inactive') === 'yes',
            circumference: parseFloat($wrapper.data('circumference')) || 0,
            animEffect: $wrapper.data('anim-effect') || 'none',
            continuousAnim: $wrapper.data('continuous-anim') === 'true'
        };

        var ytPlayer = null;
        var progressInterval = null;
        var isPlaying = false;
        var duration = 0;

        // --- Init Init ---
        if ($ring.length && config.circumference > 0) {
            $ring.css({
                'stroke-dasharray': config.circumference,
                'stroke-dashoffset': config.circumference
            });
        }

        if (config.animEffect !== 'none' && config.continuousAnim) {
            $wrapper.addClass('song-anim-' + config.animEffect + '-continuous');
        }

        // --- Core Functions ---
        var updateProgressRing = function (currentTime, totalTime) {
            if (!$ring.length || config.circumference <= 0) return;
            var startVal = config.start;
            var endVal = config.hasEnd ? config.end : totalTime;
            var timeTotal = endVal - startVal;
            var timeCurrent = currentTime - startVal;
            
            if (timeTotal > 0) {
                var progress = timeCurrent / timeTotal;
                if (progress < 0) progress = 0;
                if (progress > 1) progress = 1;
                var offset = config.circumference - (progress * config.circumference);
                $ring.css('stroke-dashoffset', offset);
            }
        };

        var setPlayingState = function () {
            isPlaying = true;
            $wrapper.addClass('is-playing');
            
            if (config.animEffect !== 'none' && !config.continuousAnim) {
                $wrapper.removeClass('song-anim-' + config.animEffect);
                // trigger reflow
                void $wrapper[0].offsetWidth;
                $wrapper.addClass('song-anim-' + config.animEffect);
            }
        };

        var setPausedState = function () {
            isPlaying = false;
            $wrapper.removeClass('is-playing');
            if (config.animEffect !== 'none' && !config.continuousAnim) {
                $wrapper.removeClass('song-anim-' + config.animEffect);
            }
        };

        var doPlay = function () {
            if (isYoutube) {
                if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
                    if(config.start > 0 && ytPlayer.getCurrentTime() < config.start) {
                        ytPlayer.seekTo(config.start, true);
                    }
                    ytPlayer.playVideo();
                    setPlayingState();
                }
            } else if ($audio.length) {
                if(config.start > 0 && $audio[0].currentTime < config.start) {
                    $audio[0].currentTime = config.start;
                }
                var playPromise = $audio[0].play();
                if (playPromise !== undefined) {
                    playPromise.then(function() {
                        setPlayingState();
                    }).catch(function(error) {
                        console.log('Autoplay prevented by browser interactions logic.');
                        setPausedState();
                    });
                } else {
                     setPlayingState(); // fallback for old browsers
                }
            }
        };

        var doPause = function () {
            if (isYoutube) {
                if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                    ytPlayer.pauseVideo();
                    setPausedState();
                }
            } else if ($audio.length) {
                $audio[0].pause();
                setPausedState();
            }
        };

        var handleBoundary = function(currentTime, totalDur) {
            if (config.hasEnd && currentTime >= config.end) {
                if (config.loop) {
                    if (isYoutube) { ytPlayer.seekTo(config.start, true); } 
                    else { $audio[0].currentTime = config.start; }
                } else {
                    doPause();
                    if (isYoutube) { ytPlayer.seekTo(config.start, true); } 
                    else { $audio[0].currentTime = config.start; }
                }
            }
        };

        // --- Interaction ---
        $wrapper.on('click', function (e) {
            if (isPlaying) {
                doPause();
            } else {
                doPlay();
            }
        });

        // --- MP3 Setup ---
        if (!isYoutube && $audio.length) {
            $audio.on('loadedmetadata', function () {
                if (config.start > 0 && this.currentTime < config.start) {
                    this.currentTime = config.start;
                }
            });

            $audio.on('timeupdate', function () {
                var cTime = this.currentTime;
                var dTime = this.duration || 0;

                if (config.start > 0 && cTime < config.start && isPlaying) {
                    this.currentTime = config.start;
                    cTime = config.start;
                }

                handleBoundary(cTime, dTime);
                if(isPlaying) {
                    updateProgressRing(cTime, dTime);
                }
            });
            
            $audio.on('ended', function() {
                if(config.loop) {
                    this.currentTime = config.start;
                    doPlay();
                } else {
                    setPausedState();
                    this.currentTime = config.start;
                }
            });

            $audio.on('play', function() { setPlayingState(); });
            $audio.on('pause', function() { setPausedState(); });

            if (config.autoplay === 'yes') {
                doPlay();
            } else if (config.autoplay === 'interaction') {
                var playOnInteraction = function() {
                    doPlay();
                    document.removeEventListener('click', playOnInteraction);
                    document.removeEventListener('touchstart', playOnInteraction);
                    document.removeEventListener('keydown', playOnInteraction);
                };
                document.addEventListener('click', playOnInteraction);
                document.addEventListener('touchstart', playOnInteraction);
                document.addEventListener('keydown', playOnInteraction);
            }
        }

        // --- YouTube Setup (Optimized for Multi-Instance & Progress Ring) ---
        if (isYoutube && $ytContainer.length) {
            var ytVideoId = $ytContainer.data('video-id');
            activeYoutubePlayers[config.id] = { player: null, config: config };

            var initYT = function() {
                ytPlayer = new YT.Player($ytContainer[0], {
                    height: '20',
                    width: '20',
                    videoId: ytVideoId,
                    playerVars: {
                        autoplay: (config.autoplay === 'yes') ? 1 : 0,
                        controls: 0,
                        showinfo: 0,
                        modestbranding: 1,
                        rel: 0,
                        loop: config.loop ? 1 : 0,
                        start: config.start > 0 ? config.start : undefined,
                        end: config.end > 0 ? config.end : undefined,
                        playsinline: 1
                    },
                    events: {
                        'onReady': function(event) {
                            activeYoutubePlayers[config.id].player = ytPlayer;
                            if (config.autoplay === 'yes') {
                                ytPlayer.playVideo();
                            } else if (config.autoplay === 'interaction') {
                                var playOnInteractionYT = function() {
                                    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
                                        if(config.start > 0 && ytPlayer.getCurrentTime() < config.start) {
                                            ytPlayer.seekTo(config.start, true);
                                        }
                                        ytPlayer.playVideo();
                                        setPlayingState();
                                    }
                                    document.removeEventListener('click', playOnInteractionYT);
                                    document.removeEventListener('touchstart', playOnInteractionYT);
                                    document.removeEventListener('keydown', playOnInteractionYT);
                                };
                                document.addEventListener('click', playOnInteractionYT);
                                document.addEventListener('touchstart', playOnInteractionYT);
                                document.addEventListener('keydown', playOnInteractionYT);
                            }
                        },
                        'onStateChange': function(event) {
                            if (event.data === YT.PlayerState.PLAYING) {
                                setPlayingState();
                                if(progressInterval) clearInterval(progressInterval);
                                // Polling for Progress Ring (since YT doesn't have timeupdate)
                                progressInterval = setInterval(function() {
                                    duration = ytPlayer.getDuration();
                                    var currTime = ytPlayer.getCurrentTime();
                                    updateProgressRing(currTime, duration);
                                    handleBoundary(currTime, duration);
                                }, 500);
                            } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                                setPausedState();
                                if(progressInterval) clearInterval(progressInterval);
                                
                                if(event.data === YT.PlayerState.ENDED) {
                                    if(config.loop) {
                                        ytPlayer.seekTo(config.start, true);
                                        ytPlayer.playVideo();
                                    } else {
                                        ytPlayer.seekTo(config.start, true);
                                    }
                                }
                            }
                        }
                    }
                });
            };

            // Load YT Iframe API if not loaded
            if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
                if (window.ytApiLoading === undefined) {
                    window.ytApiLoading = true;
                    var tag = document.createElement('script');
                    tag.src = "https://www.youtube.com/iframe_api";
                    var firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                    
                    window.onYouTubeIframeAPIReady = function() {
                        initYT();
                        $(document).trigger('wdpYTReady');
                    };
                } else {
                    $(document).on('wdpYTReady', initYT);
                }
            } else {
                initYT();
            }
        }

        // --- Visibility Change (Pause on Inactive) ---
        if (config.pauseInactive) {
            document.addEventListener("visibilitychange", function() {
                if (document.visibilityState === "hidden") {
                    if (isPlaying) {
                        doPause();
                        $wrapper.data('resume-on-visible', true);
                    }
                } else if (document.visibilityState === "visible") {
                    if ($wrapper.data('resume-on-visible')) {
                        doPlay();
                        $wrapper.data('resume-on-visible', false);
                    }
                }
            });
        }

        // --- Global Backward Compatibility Bridge for Custom Cover Scripts ---
        var playerBridge = {
            playVideo: function () { doPlay(); },
            pauseVideo: function () { doPause(); },
            stopVideo:  function () { doPause(); }
        };
        window.player = playerBridge;
        window.wdpAudioPlayer = playerBridge;
        window.wdpPlayAudio = function () { doPlay(); };
        window.wdpPauseAudio = function () { doPause(); };

        $(document).on('wdpPlayAudio wdp_play_audio', function () {
            doPlay();
        });
        $(document).on('wdpPauseAudio wdp_pause_audio', function () {
            doPause();
        });
    };

    $(window).on('elementor/frontend/init', function () {
        elementorFrontend.hooks.addAction('frontend/element_ready/weddingpress-audio.default', WidgetAudioHandler);
    });

})(jQuery);
