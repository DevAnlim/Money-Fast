$(document).ready(function(){
	var load = function (url) {
		$("#app").html('');
		$.get(url).done(function (data) {
			$("#app").html(data.content);
		});
	};
	window.setTimeout(function () {
        window.addEventListener('popstate', function (e) {
            e.preventDefault();
            if(e.state && e.state.url) {
				var url = e.state.url;
				load(url, {no_change_link: 1});
				$('.leftbar .container a').removeClass('active');
				if(url == '/') $('.leftbar .container a.first').addClass('active');
				else $('.leftbar .container a[href*="'+ url +'"]').addClass('active');
				
			}
        }, false);
    }, 1);
	$(document).on('click', 'a[reactive]', function (e) {
		e.preventDefault();
		var link = $(this),
		url = link.attr('href'),
		title = link.attr('title');

		window.history.pushState({
		   url: url,
		   title: title
		}, title, url);
		load(url);
		$('.leftbar .container a').removeClass('active');
		if(url == '/') $('.leftbar .container a.first').addClass('active');
		else $('.leftbar .container a[href*="'+ url +'"]').addClass('active');
	});

	
	var close = document.querySelectorAll('[data-close="alert"]');
	for (var i = 0; i < close.length; i++) {
		close[i].onclick = function(){
			var div = this.parentElement;
			div.style.opacity = '0';
			setTimeout(function(){div.style.display = 'none';}, 400);
		}
	}
	$(window).resize(function(){
		if($('.chat .scroll').length) {
			
			$('.chat .scroll').slimScroll({ destroy: true }); 
			$('.chat .scroll').slimScroll({
				height: 'auto', 
				allowPageScroll: false,
				size: '4px',
				color: '#cdcdcd',
				opacity: 1,
				railColor: '#f4f3f8',
				railOpacity: 1,
				alwaysVisible: false,
				railVisible: true,
				start: 'bottom'
			});
		}

		if($('.leftbar .scroll').length) {
			
			$('.leftbar .scroll').slimScroll({ destroy: true }); 
			$('.leftbar .scroll').slimScroll({
				height: 'auto', 
				allowPageScroll: false,
				size: '4px',
				color: 'rgba(255,255,255,0.3)',
				opacity: 1,
				railColor: '#f4f3f8',
				railOpacity: 1,
				alwaysVisible: false,
				railVisible: false,
				start: 'top'
			});
		}
	}).resize();
	
	
	$('[rel=popup]').click(function() {
		showPopup($(this).attr('href'));
		return false;
	});
	
	$('[rel=close]').click(function(){
		closePopup();			 
	});
	
	$('.overlay').click(function(e) {
        var target = e.srcElement || e.target;
		if(!target.className.search('overlay')) {
			closePopup();
		}
    });
	
	$(document).on('click',function() {		
		if($('.leftbar').is('.active')) {
			$('.leftbar').removeClass('active');
		}
	});
	
	$(document).keyup(function(e) {
        if(e.keyCode === 27) {
			if($('.popup').is('.active')) {
                closePopup();
            }
			if($('.leftbar').is('.active')) {
				$('.leftbar').removeClass('active');
			}
        }
    });
	
	
	$(document).on('click','.payments .subitem', function(){
		if(!$(this).is('.active')) {
			$(this).parent().find('.subitem').removeClass('active');
			$(this).addClass('active');
			checkSystem();
			calcSum();
		}
		return false;
	});
	
	$('#value').on('change keydown paste input', function() {
		calcSum();
	});
	
	function calcSum() {
        if($('.payments .active').data('type') == 'qiwi') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'yandex') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'webmoney') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'visa') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'payeer') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'megafon') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'tele2') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'beeline') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'mts') {
            var perc = 0;
            var com = 0;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
            }
            $('#com').html(perc + '%');
        }
        var val = $('#value').val();
		var comission = Math.round((val-(val/100*perc)+(com*10))/10);
        if(!val) comission = 0;
        if(comission <= 1) comission = 0;
        $('#valwithcom').html(comission + ' руб.');
    }
	function checkSystem() {
		if($('.payments .active').data('type') == 'qiwi') {
            var perc = 0;
            var com = 0;
            var val = 1000;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 1000;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', '7900xxxxxxx');
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'yandex') {
            var perc = 0;
            var com = 0;
            var val = 100;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 100;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', '41001хххххххххх');
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'webmoney') {
            var perc = 0;
            var com = 0;
            var val = 100;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 100;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', 'R536xxxxxxxxx');
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'visa') {
            var perc = 0;
            var com = 0;
            var val = 10000;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 10000;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', '4700xxxxxxxxxxxx');
            $('#com').html(perc + '% + ' + com + 'руб.');
        } else if($('.payments .active').data('type') == 'payeer') {
            var perc = 0;
            var com = 0;
            var val = 100;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 100;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', 'P10xxxxxx');
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'megafon') {
            var perc = 0;
            var com = 0;
            var val = 1000;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 1000;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', '7900xxxxxxx');
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'tele2') {
            var perc = 0;
            var com = 0;
            var val = 1000;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 1000;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', '7900xxxxxxx');
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'beeline') {
            var perc = 0;
            var com = 0;
            var val = 1000;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 1000;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', '7900xxxxxxx');
            $('#com').html(perc + '%');
        } else if($('.payments .active').data('type') == 'mts') {
            var perc = 0;
            var com = 0;
            var val = 1000;
            if(youtuber == '1') {
                var perc = 0;
                var com = 0;
                var val = 1000;
            }
            $('#min_wid').html(val/10);
            $('#wallet').attr('placeholder', '7900xxxxxxx');
            $('#com').html(perc + '%');
        }
    }
	// $('#checkbox').click(function() {
    //     $('#checkbox').attr('checked', 'checked');
    //     if($(this).prop('checked') == true){
    //         $('#withBut').removeAttr('disabled');
    //     } else {
    //         $('#withBut').attr('disabled', 'false');
    //         $('#checkbox').removeAttr('checked');
    //     }
    // });
	$('#wallet').keydown(function(event) {
		if (event.shiftKey === true) return false;
        if (event.keyCode == 46 || event.keyCode == 8 || event.keyCode == 9 || event.keyCode == 27 || 
           (event.keyCode == 65 && event.ctrlKey === true) || 
           (event.keyCode >= 35 && event.keyCode <= 39)) {
                 return;
        } else {
            if ((event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 96 || event.keyCode > 105 ) && (event.keyCode < 65 || event.keyCode > 90 )) {
                event.preventDefault(); 
            }   
        }
    });
	$('#withBut').click(function(){
		var system = $('.payments .active').attr('data-type');
		var value = $('#value').val();
		var wallet = $('#wallet').val();
		if(!$('#checkbox').attr('checked')) {
			$.notify({
				position : 'top-right',
				type: 'error',
				message: 'Вы не подтвердили правильность введенных даных'
			});
			return false;
		}
		$.ajax({
            url : '/withdraw',
            type : 'post',
            data : {
                system : system,
                value : value,
				wallet : wallet
            },
			success : function(data) {
				$('.popup, .overlay, body').removeClass('active');
				if(data.success) {
					window.location.href = '/pay/history';
				} else {
					$.notify({
						position : 'top-right',
						type: data.type,
						message: data.msg
					});
				}
				
		        return false;
			},
            error : function(data) {
                console.log(data.responseText);
            }
        });
	});
	
	$('.sendButton').click(function(){
		var target = $('.targetID').val();
		var sum = $('.sumToSend').val();
        $('.sendButton').text('Переводим.....');
        $('.sendButton').attr('disabled', 'true');
		$.ajax({
            url : '/send/create',
            type : 'post',
            data : {
                target : target,
                sum : sum
            },
			success : function(data) {
				$.notify({
                    position : 'bottom-left',
                    type: data.type,
                    message: data.msg
                });
                $('.sendButton').text('Подтвердить перевод');
                $('.sendButton').removeAttr('disabled');
		        return false;
			},
            error : function(data) {
                console.log(data.responseText);
            }
        });
	});
	$('.sumToSend').on('change keydown paste input', function() {
        var sumToSend = $(this).val();
        var total = Math.floor(sumToSend*1.05);
        $('#minusSum').html(total);
    });
	$('.getBonus').click(function() {
		$.ajax({
            url : '/bonus/getBonus',
            type : 'post',
			data : {
				recapcha : $('#g-recaptcha-response').val()
			},
			success : function(data) {
				$.notify({
                    position : 'top-right',
                    type: data.type,
                    message: data.msg
                });
		        grecaptcha.reset();
				return false;
			},
            error : function(data) {
                console.log(data.responseText);
            }
        });
	});
	
	$(document).on('click','.action-leftbar', function(){
		if($('.leftbar').is('.small')) {
			$('.leftbar').removeClass('small');
			$('body').removeClass('leftsmall');
		} else {
			$('.leftbar').addClass('small');
			$('body').addClass('leftsmall');			
		}
		return false;
	});
	
	$(document).on('click','.rightbar-close', function(){
		if($('.rightbar').is('.small')) {
			$('.rightbar').removeClass('small');
			$('body').removeClass('rightsmall');
		} else {
			$('.rightbar').addClass('small');
			$('body').addClass('rightsmall');			
		}
		return false;
	});
	
	$('.nav-resize').on('click',function(){
		$('.leftbar').addClass('active');
		return false;
	});
	
	$(document).on('click','.close-leftbar', function(){
		$('.leftbar').removeClass('active');
		return false;
	});
	
});

function showPopup(el) {
	if($('.popup').is('.active')) {
		$('.popup').removeClass('active'); 
	}
	
	if($(document).height() > $(window).height()) {
		$('body, html, .overlay, .popup'+el).addClass('active');
	} else {
		$('.overlay, .popup'+el).addClass('active');
	}
	
}

function closePopup() {	
	$('body, html, .overlay, .popup').removeClass('active');
}