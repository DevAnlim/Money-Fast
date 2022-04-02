$(document).ready(function() {
    var ws = new WebSocket(((SSL) ? 'wss' : 'ws') + '://'+location.host+':2083');
    $.ajax({
        url : '/patterns',
        type : 'post',
        success : r => {
            r.href = (location.pathname == '/') ? 'jackpot' : location.pathname.replace('/', '');
            CreateApp(r);
        },
        error : () => console.error('Something went wrong!')
    });
  
    function CreateApp(data) {
        window.app = new Vue({
            el : '.page',
            data : data,
            methods : {
                switchChat: function(active) {
                  this.chat_active = active;
                  setTimeout(() => {
                      if(!active) $('.chat .scroll').slimScroll({ destroy: true }); 
                      if(active) $('.chat .scroll').slimScroll({
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
                  }, 50);
                },
                BonusReg: function() {
                  this.giveaway_disable = true;
                  $.ajax({
                      url: '/bonus/reg',
                      type: 'post',
                      success: r => {
                          this.giveaway_disable = false;
                          this.notify(r);
                      },
                      error: e => {
                          this.notify('Whoops... Looks like something wrong', 'error');
                          this.giveaway_disable = false;
                      }
                  });
                },
                // Конвертация в доллары
                money : function(number, afterDot, withoutSymbol) {
                    withoutSymbol = withoutSymbol || false;
                    if(this.ln == 'en') number = (number/this.currency[this.ln]).toFixed(3);
                    // number += 0.001;
                    number += '';
                    number = number.split('.');
  
                    let str = (this.ln == 'ru') ? '' : ((withoutSymbol) ? '' : '$');
                        str += number[0];
  
                    if(number.length >= 2)
                    {
                        if(afterDot > 0) str += '.';
                        for(let i = 0; i < afterDot; i++) if(typeof number[1][i] !== 'undefined') str += number[1][i];
                    }
  
                    return str;
                },
                getCurrency : function(number) {
                    if(this.ln == 'en')
                    {
                        let array = (number+'').split('.');
                        let num = array[0];
                        if(typeof array[1] !== 'undefined')
                        {
                            num += '.';
                            for(let i = 0; i < 2; i++) num += array[1][i];
                        }
  
                        // // console.log(num);
  
                        number = parseFloat(num);
                    }
                    // // console.log(number);
                    if(this.ln == 'ru') return number;
                    if(this.ln == 'en') return parseFloat((number*this.currency.en).toFixed(2));
                },
                // Запуск приложения
                init : async function(check) {
                    let auth = await this.checkAuth(true);
                    // await this.initTheme();
                    // Обновляем настройки рендера
                    this.href = (location.pathname == '/') ? 'jackpot' : location.pathname.replace('/', '');
                    this.updateTitle();
  
                    if(!auth) this.captchaInit();
                    
                    // Проверяем постояние авторизации
                    if(check && auth) return this.render(); 
  
                    if(this.href == 'crash') this.resize();
                    if(!auth && this.href == 'index')
                    {
                        $('body').removeClass('rightsmall');
                        if(!$('body').hasClass('loginPage')) $('body').addClass('loginPage');
                        $(".slimScrollBar,.slimScrollRail").remove();
                        $(".slimScrollDiv").contents().unwrap();
                        $(".wrap-login100").removeAttr('style');
                        $('.captcha').html(this.captcha);
                        return $('.loaderArea').fadeOut(300);
                    }
    
  
                    // Если функция вызывалась после загрузки (тригер на кнопки браузера)
                    if(this[this.href].rendered) return this.showTemplate(this.href, false, true);
    
                    // Отправляем в рендер
                    return this.render();
                },
                captchaInit : function() {
                    if(!this.login.isAuth) 
                    {
                        let divs = $('.captcha');
                        for(let i = 0; i < divs.length; i++) $(divs[i]).html(this.captcha[this.ln]);
                        // // // console.log(divs);
                        // $('.captcha').html(this.captcha);
                    }
                    if(this.href == 'ref' && this.login.user.method == 'vkontakte') $('.captcha').html(this.captcha[this.ln]);
                    if(this.href == 'bonus' && this.login.user.method == 'vkontakte') $('.captcha').html(this.captcha[this.ln]);
                },
                // Смена заголовка
                updateTitle : function() {
                    if(!this.rendered) return $('title').text(this.sitename + ' - ' + this.lang[this.ln].titles.load);
                    if(!this.login.isAuth) return $('title').text(this.sitename + ' - ' + this.lang[this.ln].titles.auth);
                    if(this.rendered && this.login.isAuth) return $('title').text(this.sitename + ' - ' + this[this.href].title);
                },
                RealSkinsCheckBox: function() {
                    this.skins.real_button = $('#1')[0].checked;
                },
                // Смена и подготовка шаблона
                showTemplate : function(template, render, popStateTarget) {
                    this.navResize(false);
                    // Если параметр не передался - устанавливаем отрицательное значение, чтобы добавился запрос в историю браузера
                    if(typeof popStateTarget === 'undefined') popStateTarget = false;
    
                    // Запрещаем переход пользователя на бонус и реф сис-му, если он вошел не через вк
                    // if((template == 'bonus' || template == 'ref') && this.login.user.method != 'vkontakte') return this.notify({
                    //     success : false,
                    //     msg : 'Сначала авторизируйтесь через VK'
                    // });
                    
    
                    // Очищаем поля в честной игре
                    if(this.href == 'fair' && this.href != template)
                    {
                        this.fair_result.checked = false;
                        this.fair_result.id = '';
                        this.fair_result.number = '';
                        this.fair_result.last_hash = '';
                        $('#fair_hash').val('');
                    }
    
                    // Закрываем модальные окна, если они открыты
                    if($('.overlay').hasClass('active')) $('.popup, .overlay').removeClass('active');
    
                    $('.loaderArea').fadeIn(100, () => {
                        this.lastPath = this.href;
                        this.href = template;
  
                        if(this.href != 'jackpot') this.jackpot.circle = false;
  
                        // Добавляем запись в историю
                        if(!popStateTarget) window.history.pushState('', '', '/' + ((template == 'jackpot') ? '' : template));
  
                        // Если страница не была в рендере - отправляем на рендер
                        if(this[this.href].rendered == false) 
                        {
                            this.rendered = false;
                            this.updateTitle();
                            return this.render();
                        }
  
                        setTimeout(() => {
                            if(template == 'crash') 
                            {
                                this.resize();
                                this.crash_check();
                            }
                            if(template == 'jackpot') this.jackpot_init();
                            $(window).resize();
                            $('.form-selector .form').click(function(e) {
                                if(!$(this).is('.active')) {
                                 $('.form-selector .form, .form-table').removeClass('active');
                                 $(this).addClass('active');
                                 $('.form-table:eq('+$(this).index()+')').addClass('active');
                                } 
                            });
  
                            if(this.href == 'dice')
                            {
                                $('.dice').find('.title').attr('style', '');
                                $('.dice').find('.ico-balance').attr('style', '');
                                $('.dice').find('.val').attr('style', '');
                            }
                            
                            if(this.href == 'fair')
                            {
                                $('#fixHeight').attr('style', '');
                            }
  
                            if(this.href == 'skins') this.parseItems();
  
                            if(this.href == 'pay/history') this.activeTrades = 0;
                            
                            this.captchaInit();
                        }, 100);
  
                        // Скрываем лоадер
                        if(!this.rendered) this.rendered = true;
  
                        $('.loaderArea').fadeOut(300);
  
                        this.updateTitle();
                    });
                },
                // Отрисовка шаблона
                render : function() {
                    // Запрашиваем данные
                    $.ajax({
                        url : '/render',
                        type : 'post',
                        data : {
                            path : this.href
                        },
                        success : r => {
                            // 404, not found
                            if(r.code == 404) return this.notify(this.lang[this.ln].alerts.notfound, 'error');
                            // 200, success
                            if(r.code == 200) 
                            {
  
                                // Обновляем настройки рендера и данные страницы
                                this.lastPath = this.href;
                                this[this.href] = r.pattern;
                                this[this.href].rendered = true;
                            }
    
                            // Меняем шаблон
                            // $('.template').hide();
                            // $('.template[name="'+this.href+'"]').show();
    
                            // Если краш, то вызываем ресайз, чтобы график отображался хорошо
                            if(this.href == 'crash') 
                            {
                                this.resize();
                            }
  
                            if(this.href == 'pay/history')
                            {
                                this.payHistory.deposits = this[this.href].deposits;
                                this.payHistory.withdraws = this[this.href].withdraws;
                                this.payHistory.skins = this[this.href].skins;
                                this.payHistory.vgo = this[this.href].vgo;
                            }
                            
                            if(this.href == 'jackpot/history') this.jackpotHistory.games = this[this.href].games;
  
                            if(this.href == 'jackpot') setTimeout(this.jackpot_init, 50);
                            $(window).resize();
                            if(!this.rendered) this.rendered = true;
                            this.updateTitle();
  
                            if(this.href == 'dice')
                            {
                                setTimeout(() => {
                                    $('.dice').find('.title').attr('style', '');
                                    $('.dice').find('.ico-balance').attr('style', '');
                                    $('.dice').find('.val').attr('style', '');
                                }, 30);
                            }
                            
                            setTimeout(this.captchaInit, 30);
  
                            $('.loaderArea').fadeOut(300);
  
                            if(this.href == 'skins') this.parseItems();
  
                            $('.form-selector .form').click(function(e) {
                                if(!$(this).is('.active')) {
                                 $('.form-selector .form, .form-table').removeClass('active');
                                 $(this).addClass('active');
                                 $('.form-table:eq('+$(this).index()+')').addClass('active');
                                } 
                            });
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                // Авторизация
                auth : function(method) {
                    // Открываем новую вкладку с редиректом на авторизацию
                    this.authModal = window.open('https://ebabki.com/auth/'+method, '_blank', 'https://ebabki.com/auth/'+method);
    
                    // Проверяем состояние окна
                    if(!this.authModal.closed) {
                        // Ждем, пока страница закроется
                        this.authTimeout = setInterval(async() => {
                            // Страница закрылась
                            if(this.authModal.closed)
                            {
                                // Показываем лоадер
                                $('.loaderArea').fadeIn(300);
  
                                // Удаляем интервал и проверяем состояние авторизации
                                clearInterval(this.authTimeout);
                                await app.checkAuth(true);
                                if(this[this.href].rendered) return this.showTemplate(this.href, true, false);
                                return this.render();
                            }
                        }, 100);
                    }
                },
                // Проверка состояния авторизации
                checkAuth : function(modal) {
                    // Запрашиваем состояние авторизации
                    return new Promise((res, rej) => {
                        $.ajax({
                            url : '/auth/check',
                            type : 'post',
                            success : r => {
                                // Обновляем настройки состояния авторизации
                                let loginState = app.login.isAuth;
                                this.login.isAuth = r.auth;
                                this.login.user = r.user || {};
                                
                                if(!$('body').hasClass('loginPage') && !this.login.isAuth) $('body').addClass('loginPage');                                if($('body').hasClass('loginPage') && this.login.isAuth) $('body').removeClass('loginPage');
  
  
                                regMe();
        
                                // Если состояние авторизации не изменилось, то убираем лоадер
                                $('.form-selector .form').click(function(e) {
                                    if(!$(this).is('.active')) {
                                     $('.form-selector .form, .form-table').removeClass('active');
                                     $(this).addClass('active');
                                     $('.form-table:eq('+$(this).index()+')').addClass('active');
                                    } 
                                });
                                // if(modal) $('.loaderArea').fadeOut(300); 
  
                                return res(this.login.isAuth);
                            },
                            error : e => this.notify(this.lang[this.ln].alerts.autherror, 'error')
                        });
                    });
                },
                authorize : function() {
                    let captcha2 = $('#authorize_form').find('.g-recaptcha-response').val();
                    if(typeof captcha2 == 'undefined') return this.captchaInit();
                    // if(captcha2.length < 1) return this.notify(this.lang[this.ln].alerts.captcha, 'error');
                    this.login.authorize = true;
                    $.ajax({
                        url : '/auth/local/auth',
                        type : 'post',
                        data : {
                            username : $('#login').val(),
                            password : $('#password').val(),
                            'g-recaptcha-response' : captcha2
                        },
                        success : r => {
                            if(r.success)
                            {
                                this.rendered = false;
                                this.updateTitle();
                                $('.loaderArea').fadeIn(300, () => {
                                    this.login.authorize = false;
                                    // this.checkAuth(true).then(() => {
                                    //     if(this[this.href].rendered) return this.showTemplate(this.href, true, false);
                                    //     return this.render();
                                    // });
                                    this.reloadApp();
                                });
                            } else {
                                this.notify(r);
                                this.login.authorize = false;
                                this.captchaInit();
                            }
                        },
                        error : e => {
                            this.login.authorize = false;
                            this.notify({
                                success : false,
                                msg : this.lang[this.ln].alerts.unauth,
                                msg_en : this.lang[this.ln].alerts.unauth
                            });
                            this.captchaInit();
                        }
                    });
                },
                register : function() {
                    let username = $('#reg_username').val(),
                        passwd = $('#reg_passwd').val(),
                        passwd_confirm = $('#reg_passwd_confirm').val();
                        
                    let captcha = $('#register_form').find('.g-recaptcha-response').val();
                    if(captcha.length < 1) return this.notify(this.lang[this.ln].alerts.captcha, 'error');
  
                    if(username.length <= 0) return this.notify(this.lang[this.ln].alerts.notlogin, 'error');
  
                    if(passwd.length <= 0) return this.notify(this.lang[this.ln].alerts.notpass, 'error');
  
                    if(passwd != passwd_confirm) return this.notify(this.lang[this.ln].alerts.notpass2, 'error');
  
                    this.login.registration = true;
                    $.ajax({
                        url : '/auth/reg',
                        type : 'post',
                        data : {
                            username : username,
                            password : passwd,
                            'g-recaptcha-response' : captcha
                        },
                        success : r => {
                            this.notify(r);
                            this.login.registration = false;
                            if(r.success)
                            {
                                $('#login').val(username);
                                $('#password').val(passwd);
                                $('#register').removeClass('active');
                                $('#register_form').removeClass('active');
                                $('#authorize').addClass('active');
                                $('#authorize_form').addClass('active');
                            }
                        },
                        error : e => {
                            // // console.log(e.responseText);
  //                            this.captcha = await this.getCaptcha();
                        }
                    });
                },
                // Выход из аккаунта
                logout : function(e) {
                    if(e !== undefined) e.preventDefault();
                    // Показываем лоадер
                    // $('.loaderArea').fadeIn(300, () => {
                        // Обновляем состояние авторизации
                    
                        $('.loaderArea').fadeIn(100, () => {
                            // loading...
                            this.rendered = false;
                            this.updateTitle();
  
                            $('body').removeClass('rightsmall');
  
  
                            this.login.isAuth = false;
                            this.login.user = {};
  
                            // Закрываем сессию и убираем лоадер
                            $.ajax({
                                url : '/auth/logout',
                                type : 'post',
                                success : e => {
                                    ws.send(JSON.stringify({
                                        type : 'logout'
                                    }));
                                    
                                    setTimeout(() => {
                                        $('.wrap-login100').slimScroll({ destroy: true }); 
                                        $('.wrap-login100').attr('style', '');	
                                        this.reloadApp();
                                    }, 100); 
                                },
                                error : e => this.notify(this.lang[this.ln].alerts.whoops, 'error')
                            });
                        });
                    // });p
                },
                // Сообщение
                notify : function(msg, type) {
                    if(typeof msg != 'string' && typeof msg == 'object')
                    {
                        type = (msg.success) ? 'success' : 'error';
                        if(this.ln == 'ru') msg = msg.msg || 'Неизвестная ошибка';
                        if(this.ln == 'en') msg = msg.msg_en || this.lang[this.ln].alerts.whoops;
                    }
  
                    $.notify({
                        position : 'top-right',
                        type: type,
                        message: msg
                    });
                },
                // Открытие модального окна
                showModal : function(id) {
                    if(id == 'exchange' && (!this.login.isAuth || !this.login.user.vip)) return this.notify(this.lang[this.ln].alerts.send_vip, 'error');
                    $('.popup').removeClass('active'); 
                    $('.overlay, #'+id).addClass('active');
                },
                // Закрытие модального окна
                closeModal : (e) => {
                    let className = e.target.className || e.srcElement.className;
                    if(className.indexOf('overlay') > -1 || className.indexOf('close') > -1) $('.popup, .overlay').removeClass('active'); 
                },
                // Кнопки (+/(1/2)/all)
                dice_input : function(value) {
                    if(value == 'all') value = this.login.user.balance
                    this.dice.bet = parseFloat(value.toFixed(2));
                    $('#stavka_dice').val(this.money(this.dice.bet, 2, true));
                    this.dice_calc();
                },
                // Изменение линии дайса (для стрелок)
                diceLine : function(val) {
                    let r1 = parseFloat($('#r1').val());
                        r1 += (val*0.5);
                        $('#r1').val(r1);
                        this.dice_calc();
                },
                // Рассчета дайса
                dice_calc : function() {
                    let val = $('.range').val();
                    $('.range').css({
                        'background': '-webkit-linear-gradient(left ,#F10260 0%,#F10260 ' + val + '%,#08E547 ' + val + '%, #08E547 100%)'
                    });
                    let chance = (100 - $('#r1').val()).toFixed(2);
                    let viplata = 99 / chance;
                    $('#one').html(chance);
                    $('#winner').html(viplata.toFixed(2));
                    let summ = this.getCurrency(parseFloat($("#stavka_dice").val()) || 0);
                    this.dice.bet = summ;
    
                    let win1 = $('#winner').html();
                    let summa = summ * win1;
                    $("#win").text(((this.ln == 'en') ? '$' : '') + parseFloat(this.money(summa, 2, true)));
                },
                // Игра дайса
                dice_play : function() {
                    if(this.dice.disableButton) return;
                    if(this.dice.lastEnterPlay < 1000) return;
  
                    this.dice.disableButton = true;
  
                    clearInterval(this.diamond);
    
                    
                    if(isNaN(parseFloat($('#r1').val()))) $('#r1').val(99);
                    this.dice_calc();
    
                    $.ajax({
                        url : '/dice/play',
                        type : 'post',
                        data : {
                            number : parseFloat($('#r1').val()) || 99,
                            price : this.dice.bet,
                            currency : this.ln
                        },
                        success : r => {
                            this.dice.disableButton = false;
                            if(!r.success)
                            {
                                this.notify(r);
                                return;
                            }
    
                            this.dice.hash = r.hash;
                            // this.login.user.balance = r.balance;
                            this.changeBalance(r.balance);
    
                            $('.index__home__indicator__inner').show();
                            $('.index__home__indicator__inner__number').animate({
                                'left': $('#r1').width() / 100 * r.number + 'px'
                            }, 100);
                            $('.index__home__indicator__inner__number__roll>span').html(r.number);
                            if(r.win)
                            {
                                $('.index__home__indicator__inner__number__roll').removeClass('is-negative');
                                $('.index__home__indicator__inner__number__roll').addClass('is-positive')
                            } else {
                                $('.index__home__indicator__inner__number__roll').addClass('is-negative');
                                $('.index__home__indicator__inner__number__roll').removeClass('is-positive')
                            }
    
                            this.diamond = setTimeout(() => {
                                $('.index__home__indicator__inner').fadeOut(500);
                            }, 10000);
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                // Отправка сообщения в чат
                chat_send : function() {
                    if((new Date().getTime()-this.chat_last) < 500) return this.notify(this.lang[this.ln].alerts.trylater, 'error');
    
                    let input = $('.send-form').find('input'),
                        val = input.val();
                        // if(val.replace(/\s/g, '').length < 10) return this.notify({
                        //     success : false,
                        //     msg : 'Минимальное кол-во символов в чате - 10'
                        // });
    
                    input.val('');
    
                    this.chat_last = new Date().getTime();
    
                    $.ajax({
                        url : '/chat/send',
                        type : 'post',
                        data : {
                            msg : val,
                            lang : this.ln,
                            currency : this.ln
                        },
                        success : r => this.notify(r),
                        error : () => console.error('Something went wrong!')
                    });
                },
                // Удаление сообщения в чате 
                chat_delete : function(id) {
                    if((new Date().getTime()-this.chat_delete_time) < 1000) return this.notify(this.lang[this.ln].alerts.trylater, 'error');
    
                    this.chat_delete_time = new Date().getTime();
    
                    $.ajax({
                        url : '/chat/delete',
                        type : 'post',
                        data : {
                            id : id
                        },
                        success : r => this.notify(r),
                        error : () => console.error('Something went wrong!')
                    });
    
                },
                // Переворот массива
                array_reverse : (array) => {
                    let ar = [];
                    for(var i in array) ar.unshift(array[i]);
                    return ar;
                },
                // Быстрых переход на проверку хэша
                reactiveFair : function(val) {
                    if(typeof val !== 'undefined' && typeof val === 'string') this.fair.hash = val;
                    this.showTemplate('fair', false);
                },
                fair_hash_edit: function() {
                  this.fair.hash = $("#fair_hash").val();
                },
                // Проверка хэша
                checkFair : function() {
                    if((new Date().getTime()-this.fair_result.last_ajax) <= 1000) 
                    {
                        return this.notify(this.lang[this.ln].alerts.trylater, 'error');
                    }
    
                    this.fair_result.last_ajax = new Date().getTime();
    
                    let hash = $('#fair_hash').val();
                        
                    if(hash.length < 40) 
                    {
                        this.fair_result.checked = false;
                        return this.notify(this.lang[this.ln].alerts.hashwrong, 'error');
                    }
    
    
                  //   if(hash == this.fair_result.last_hash) return this.notify(this.lang[this.ln].alerts.alreadycheckhash, 'error');
                    // this.fair_result.checked = true;
    
                    this.fair_result.last_hash = hash;
                    this.fair_result.disableButton = true;
    
                    $.ajax({
                        url : '/fair',
                        type : 'post',
                        data : {
                            hash : hash
                        },
                        success : r => {
                            console.log('hello');
                            this.fair_result.disableButton = false;
                            if(!r.success) 
                            {
                                this.fair_result.checked = false;
                                return this.notify(r);
                            }
                            this.fair_result.id = r.result.id;
                            this.fair_result.number = r.result.number;
                            this.fair_result.checked = true;
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                // Рассчет коммиссии при переводе
                sendInput : function(e) {
                    let val = this.getCurrency(parseFloat($('.sumToSend').val()) || 0);
                    $('#minusSum').text(this.money(val*(1+(this.send_comission/100)), 2));
                },
                // Перевод денег пользователю
                sendMoney : function() {
                    let TargetID = parseInt($('.targetID').val()) || false;
                    if(!TargetID) return this.notify(this.lang[this.ln].alerts.sendidwrong, 'error');
    
                    let sendSum = this.getCurrency(parseFloat($('.sumToSend').val()) ) || false;
                    if(!sendSum) return this.notify(this.lang[this.ln].alerts.sendsumwrong, 'error');
  
    
                    this.send.disableButton = true;
    
                    $.ajax({
                        url : '/send',
                        type : 'post',
                        data : {
                            target : TargetID,
                            price : sendSum,
                            currency : this.ln
                        },
                        success : r => {
                            this.notify(r);
                            this.send.disableButton = false;
                            if(r.success) this.changeBalance(r.balance);
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                // Анимация изменения баланса
                changeBalance : function(to) {
                    this.login.user.balance = parseFloat(to.toFixed(2));
                    regMe();
                },
                
                // Тест
                crash_create : function() {
                    let now = parseFloat(Math.pow(Math.E, 0.00006*this.crash.data.length*1000/20));
                    this.crash.multiplier = parseFloat(now.toFixed(2));
                    this.crash.options.yaxis.max = Math.max(now, 2);
                    this.crash.options.xaxis.max = Math.max(this.crash.data.length, 5000/2000);
                    this.crash.data.push([this.crash.data.length, now]);
                    this.crash_draw();
                },
                crash_start : function() {
                    this.crash.interval = setInterval(() => {
                        this.crash_create();
                    }, 50);
                },
                crash_stop : function() {
                    clearInterval(this.crash.interval);
                },
                crash_check : function() {
                    let count = 0, hasBet = false;
                    for(let i = 0; i < this.crash.bets.length; i++)
                    {
                        let bet = this.crash.bets[i];
                        if(bet.user_id == this.login.user.id && bet.status == 0) hasBet = true;
                        if(bet.round_id == this.crash.game_id) count++;
                    }
                    this.crash.betsCount = count;
                    this.crash.hasBet = hasBet;
                },
                // Ставка краша
                crash_bet : function() {
                    let bet = this.getCurrency(parseFloat(parseFloat($('#stavka_crash').val()).toFixed(2)) || 0);
                    if(!bet) return this.notify(this.lang[this.ln].alerts.crashbetwrong, 'error');
  
    
                    let withdraw = parseFloat($('#autowithdraw').val()) || 0; 
  
                    this.crash.disableButton = true;
    
                    $.ajax({
                        url : '/crash/bet',
                        type : 'post',
                        data : {
                            price : bet,
                            withdraw : withdraw,
                            currency : this.ln
                        },
                        success : r => {
                            this.crash.disableButton = false;
                            if(!r.success) this.notify(r);
                            if(!r.success && typeof r.bet !== 'undefined') this.crash.bet = r.bet;
                            if(r.success)
                            {
                                this.changeBalance(r.balance);
                                this.crash.bet = r.bet;
                                this.crash.cashout = r.cashout;
                            }
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                // Вывод ставки краша
                crash_cashout : function(id, key) {
                    if(this.crash.bets[key].cashouting) return;
                    this.crash.bets[key].cashouting = true;
    
                    $.ajax({
                        url : '/crash/cashout',
                        type : 'post',
                        data : {
                            id : id
                        },
                        success : r => {
                            if(!r.success) this.notify(r);
                            // this.notify(r);
                            if(r.success) this.changeBalance(r.balance);
                            if(!r.success) this.crash.bets[key].cashouting = false;
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                crash_cancel : function(id, key) {
                    if(this.crash.bets[key].canceling) return;
                    this.crash.bets[key].canceling = true;
                    
                    $.ajax({
                        url : '/crash/cancel',
                        type : 'post',
                        data : {
                            id : id
                        },
                        success : r => {
                            if(!r.success)
                            {
                                this.notify(r);
                                this.crash.bets[key].canceling = false;
                            }
                            if(r.success) this.changeBalance(r.balance);
                        }
                    });
                },
                crash_buttons : function(val) {
                    if(val == 'all') val = parseFloat(this.money(this.login.user.balance, 2, true));
                    this.crash.input = parseFloat(parseFloat(val).toFixed(2));
                    $('#stavka_crash').val(this.money(parseFloat(parseFloat(val).toFixed(2)) || 0, 2, true));
                },
                // Изменение окна
                resize : function() {
                    let width = $('.chart-block').width(),
                        height = $('.chart-block').height(),
                        minus = (0.624)-(height/width);
  
                    $('.divcrash')
                        .css('height', (height) + 'px');
  
                    let calc = (1-(0.624-(height/width)));
  
  
                    for(var i = 1; i <= 17; i++)
                    {
                        if(i > 0 && i < 4)
                        {
                            let line = $('.linescrash .l' + i);
                                line.css('top', parseFloat(line.attr('data-t'))*height);
                        }
  
                        let item = $('.divcrash').find('.p' + i),
                            point = item.find('.point');
  
                        point
                            .css('width', parseFloat(item.attr('data-w'))*width)
                            .css('height', parseFloat(item.attr('data-h'))*height);
                        item
                            .css('left', parseFloat(item.attr('data-l'))*width)
                            .css('top', parseFloat(item.attr('data-t'))*height)
                            .css('transform', 'rotate('+(parseFloat(item.attr('data-r'))*calc)+'deg)');
                    }
                },
                verifycation : function() {
                    if(!this.login.isAuth) return this.notify(this.lang[this.ln].alerts.auth, 'error');
                    if(this.verify.disableButton) return;
                    
                    let captcha = $('.verify-vk').find('.g-recaptcha-response').val();
                    if(captcha.length < 1) return this.notify(this.lang[this.ln].alerts.captcha, 'error');
  
                    this.verify.disableButton = true;
  
                    $.ajax({
                        url : '/verify',
                        type : 'post',
                        data : {
                            'g-recaptcha-response' : captcha
                        },
                        success : r => {
                            this.notify(r);
                            this.verify.disableButton = false;
                            if(!r.success) return this.captchaInit();
                            if(r.success) this.login.user.verify = true;
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                getBonus : function () {
                    if(this.bonus.disableButton) return;
                    
                    let captcha = $('.bonus').find('.g-recaptcha-response').val();
                    if(captcha.length < 1) return this.notify(this.lang[this.ln].alerts.captcha, 'error');
                    
                    this.bonus.disableButton = true;
  
                    $.ajax({
                        url : '/getBonus',
                        type : 'post',
                        data : {
                            'g-recaptcha-response' : captcha
                        },
                        success : r => {
                            this.bonus.disableButton = false;
                            this.notify(r);
                            if(r.success) this.changeBalance(r.balance);
                            if(!r.success) this.captchaInit();
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                refCopy : function() {
                    $('#code').select();
                    let result = document.execCommand("copy");
                    if(result) return this.notify(this.lang[this.ln].alerts.copy, 'success');
                    return this.notify(this.lang[this.ln].alerts.whoops, 'error');
                },
                activeRef : function() {
                    this.refs.disableButton = true;
                    $.ajax({
                        url : '/activeRef',
                        type : 'post',
                        data : {
                            code : $('#promoCode').val()
                        },
                        success : r => {
                            this.refs.disableButton = false;
                            if(r.success && r.type == 'ref') this.login.user.ref = r.code;
                            if(r.success) this.changeBalance(r.balance);
                            this.notify(r);
                        },
                        error : () => console.error('Something went wrong!')
                    })
                },
                dep_calc : function() {
                    let val = parseFloat($('#dep_value').val()) || 0;
                    // val += parseFloat((val*this.payment.methods[this.payment.deposit.method].comission).toFixed(2));
                    this.payment.deposit.amount = this.getCurrency(val);
                },
                dep_send : function() {
                    if(this.payment.deposit.amount <= 0) return this.notify(this.lang[this.ln].alerts.depositsumwrong, 'error');
                    this.payment.deposit.disableButton = true;
                    $.ajax({
                        url : '/payment/get',
                        type : 'post',
                        data : { 
                            method : this.payment.deposit.method,
                            amount : this.payment.deposit.amount
                        },
                        success : r => {
                            this.payment.deposit.disableButton = false;
                            if(r.success) 
                            {
                                $('.popup, .overlay').removeClass('active');
                                window.open(r.redirect);
                            } else {
                                this.notify(r);
                            }
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                withdraw_calc : function() {
                    let val = this.getCurrency(parseFloat($('#w_value').val()) || 0);
                    val -= parseFloat((val*this.payment.methods[this.payment.withdraw.method].comission.withdraw).toFixed(2));
                    this.payment.withdraw.amount = parseFloat((val).toFixed(2));
                },
                withdraw_check : function(e) {
                    if(this.payment.withdraw.disableButton) return;
                    // this.payment.withdraw.checked = (this.payment.withdraw.checked) ? false : true;
                    let checkbox = $('#checkbox');
                    // // // console.log($(checkbox).prop('checked'));
                    // // console.log(checkbox.prop('checked'));
                    if(checkbox.prop('checked') == true){
                        this.payment.withdraw.checked = false;
                        checkbox.removeAttr('checked');
                    } else {
                        this.payment.withdraw.checked = true;
                        checkbox.attr('checked', 'checked');
                    }
                    e.preventDefault();
                },
                withdraw_send : function() {
                    if(this.payment.withdraw.amount < this.withdraw_min) return this.notify(this.lang[this.ln].alerts.minwithdraw, 'error');
  
                    let wallet = $('#withdraw_wallet').val();
                    if(wallet.length < 1) return this.notify(this.lang[this.ln].alerts.withdrawwallet, 'error');
  
                    this.payment.withdraw.disableButton = true;
  
                    $.ajax({
                        url : '/withdraw',
                        type : 'post',
                        data : {
                            amount : parseFloat($('#w_value').val()) || 0,
                            wallet : wallet,
                            method : this.payment.withdraw.method
                        },
                        success : r => {
                            this.notify(r);
                            this.payment.withdraw.disableButton = false;
                            if(r.success) $('.popup, .overlay').removeClass('active');
                        },
                        error : () => console.error('Something went wrong!')
                    })
                },
                withdraw_decline : function(key, id) {
                    app.payHistory.withdraws[key].canceling = true;
                    $.ajax({
                        url : '/withdraw/cancel',
                        type : 'post',
                        data : {
                            id : id
                        },
                        success : r => {
                            app.payHistory.withdraws[key].canceling = false;
                            this.notify(r);
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                navResize : function(n) {
                    // // console.log('hello ' + n);
                    this.nav = n;
                    if(this.href == 'crash') this.resize();
                },
                jackpot_bet : function() {
                    let amount = parseFloat($('#jackpot_amount').val()) || false;
                    if(!amount) return this.notify(this.lang[this.ln].alerts.jackpotbetwrong, 'error');
  
                    amount = this.getCurrency(amount);
  
                    this.jackpot.disableButton = true;
  
                    $.ajax({
                        url : '/jackpot/bet',
                        type : 'post',
                        data : {
                            amount : amount,
                            currency : this.ln
                        },
                        success : r => {
                            // // console.log(r);
                            this.notify(r);
                            this.jackpot.disableButton = false;
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                jackpot_init : function() {
                    if(document.readyState != 'complete')
                    {
                        setTimeout(() => {
                            this.jackpot_init();
                        }, 50);
                        return;
                    }
                    try {
                        let data = [], labels = [];
                        let list = this.jackpot.game.users;
                        list.sort((a,b) => {
                            if(a.color > b.color) return 1;
                            if(a.color < b.color) return -1;
                            return 0
                        });
  
                        for(let i = 0; i < list.length; i++)
                        {
                            data.push(parseFloat(list[i].chance));
                            labels.push(list[i].user.username);
                        }
                        if(data.length == 0) 
                        {
                            data = [1];
                            labels = ['None'];
                        }
  
                        if(!this.jackpot.circle) 
                        {
                            let ctx = $('#doughnut')[0].getContext('2d');
                            ctx.width = 400;
                            ctx.height = 400;
                            this.jackpot.circle = new Chart(ctx, {
                                type : 'pie',
                                data : {
                                    labels : labels,
                                    datasets: [{ 
                                        data: data,
                                        backgroundColor : (list.length > 0) ? ["#ED4C67", "#FFC312", "#12CBC4", "#C4E538", "#FDA7DF", "#EE5A24", "#6F1E51", "#fff200", "#0652DD", "#2C3A47", "#25CCF7", "#ced6e0"] : ['#9999a9'],
                                        borderWidth : 0,
                                        hoverBackgroundColor : (list.length > 0) ? ["#ED4C67", "#FFC312", "#12CBC4", "#C4E538", "#FDA7DF", "#EE5A24", "#6F1E51", "#fff200", "#0652DD", "#2C3A47", "#25CCF7", "#ced6e0"] : ['#9999a9'],
                                        hoverBorderWidth : 0
                                    }]
                                },
                                options : this.jackpot.options
                            });
                        } else {
                            // // console.log('update');
                            this.jackpot.circle.data.datasets[0].data = data;                           this.jackpot.circle.data.labels = labels;
                            this.jackpot.circle.data.datasets[0].hoverBackgroundColor = (list.length > 0) ? ["#ED4C67", "#FFC312", "#12CBC4", "#C4E538", "#FDA7DF", "#EE5A24", "#6F1E51", "#fff200", "#0652DD", "#2C3A47", "#25CCF7", "#ced6e0"] : ['#9999a9'];
                            this.jackpot.circle.data.datasets[0].backgroundColor = (list.length > 0) ? ["#ED4C67", "#FFC312", "#12CBC4", "#C4E538", "#FDA7DF", "#EE5A24", "#6F1E51", "#fff200", "#0652DD", "#2C3A47", "#25CCF7", "#ced6e0"] : ['#9999a9'];
  
                            this.jackpot.circle.update();
                        }
  
                        if(this.jackpot.game.status == 2) $('.spinner').css('transform', 'rotate('+this.jackpot.game.rotate+'deg)');
                        if(this.jackpot.game.status < 2) $('.spinner').css('transform', 'rotate(0deg)');
                    } catch(e) {
                        setTimeout(this.jackpot_init, 10);
                    }
                },
                giveaway_send : function() {
                    $('#chat_input').val('/give 10');
                    this.notify(this.lang[this.ln].alerts.giveaway, 'success');
                },
                switchLang : function(lang) {
                    this.ln = lang;
                    $.cookie('lang', lang);
                    this.langModal = false;
                    this.captchaInit();
                },
                resetSkins : function() {
                    let total = 0;
                    for(let i in this.skins.pattern) if(this.skins.pattern[i].selected && this.skins.pattern[i].appid == this.skins.appid) total += this.skins.pattern[i].price;
                    this.skins.total = total;
                },
                selectItem : function(classid, instanceid, objKey, size) {
                    size = size || false;
                    let index = false;
                    for(let i = 0; i < this[this.href].pattern.length; i++) if(this[this.href].pattern[i].key == objKey) index = i;
                    if(index === false) return this.notify('Не удалось найти ключ предмета!', 'error');
  
                    let mhn = this[this.href].pattern[index].market_hash_name;
                    if(size && this[this.href].appid == 'real') mhn += ' ['+size+']';
  
                    this[this.href].pattern[index].selected = true;
                    this[this.href].total += this[this.href].pattern[index].price;
                    this.parseItems();
  
                    this[this.href].pattern[index].mhn = mhn;
  
                    let found = false, key = 0;
                    for(let i = 0; i < this[this.href].selected.length; i++) if(!found && this[this.href].selected[i].classid == classid && this[this.href].selected[i].instanceid == instanceid && this[this.href].selected[i].mhn == mhn)
                    {
                        found = true;
                        key = i;
                    }
  
                    if(!found) this[this.href].selected.push({
                        appid : this[this.href].pattern[index].appid,
                        mhn: mhn,
                        market_hash_name : this[this.href].pattern[index].market_hash_name,
                        classid : this[this.href].pattern[index].classid,
                        instanceid : this[this.href].pattern[index].instanceid,
                        icon_url : this[this.href].pattern[index].icon_url,
                        price : this[this.href].pattern[index].price,
                        keys : [index],
                        items : [
                            {
                                id : this[this.href].pattern[index].id,
                                price : this[this.href].pattern[index].price,
                                index : key
                            }
                        ],
                        total_price : this[this.href].pattern[index].price
                    }); 
  
                    if(found)
                    {
                        this[this.href].selected[key].total_price += this[this.href].pattern[index].price;
                        this[this.href].selected[key].keys.unshift(index);
                        this[this.href].selected[key].items.push({
                            id : this[this.href].pattern[index].id, 
                            price : this[this.href].pattern[index].price,
                            index : key
                        });
                    }
  
                    
  
                    // // console.log(JSON.stringify(this[this.href].selected));
                },
                removeItem : function(index) {
                    let item = this[this.href].selected[index];
                    // // console.log(JSON.stringify(item));
                    if(item.keys.length == 0) return; // на всякий)
                    let key = item.keys[0];
  
                    this[this.href].pattern[key].selected = false;
                    this.parseItems();
  
                    let newKeys = [];
                    for(let i = 1; i < item.keys.length; i++) newKeys.push(item.keys[i]);
                    this[this.href].selected[index].keys = newKeys;
  
                    let newItems = [];
                    for(let i = 1; i < item.items.length; i++) newItems.push(item.items[i]);
                    this[this.href].selected[index].items = newItems;
  
                    this[this.href].selected[index].total_price -= this[this.href].pattern[key].price;
                    this[this.href].total -= this[this.href].pattern[key].price;
                    if(this[this.href].total < 0) this[this.href].total = 0;
  
                },
                sortItems : function(how) {
                    this[this.href].sort = how;
                    this[this.href].pattern.sort((a, b) => {
                        if(a.price > b.price && how == 'desc') return -1;
                        if(a.price < b.price && how == 'desc') return 1;
                        if(a.price > b.price && how == 'asc') return 1;
                        if(a.price < b.price && how == 'asc') return -1;
                        return 0;
                    });
                    this.parseItems();
                },
                setItemsPrice : function(index) {
                    let schema = this.skins.schema[index][this.ln];
                    this[this.href].min = schema.from;
                    this[this.href].max = schema.to;
                    this[this.href].activeSchema = index;
                    this[this.href].priceSearch = ((schema.from+schema.to) == 0) ? false : true;
                    this[this.href].itemsCount = 12;
                    this.parseItems();
                },
                setItemsSearch : function() {
                    this[this.href].search = $('.itemsSearch').val();
                    this[this.href].itemsCount = 12;
                    this.parseItems();
                },
                parseItems : function() {
                    console.log(this[this.href]);
                    this[this.href].itemsShowed = 0;
                    this[this.href].searched = 0;
                    for(let i in this[this.href].pattern)
                    {
                        if(this[this.href].pattern[i].appid == this[this.href].appid)
                        {
  
                            let active = false;
                            let item = this[this.href].pattern[i]; 
  
                            if(this[this.href].search.length > 0) {
                                if(item.market_hash_name.toLowerCase().indexOf(this[this.href].search.toLowerCase()) >= 0) active = true; 
                            } else {
                                active = true;
                            }
  
                            if(this[this.href].priceSearch && ((item.price < this[this.href].min || item.price > this[this.href].max))) active = false;
  
                            if(active) 
                            {
                                this[this.href].searched++;
                                if(this[this.href].itemsShowed < this[this.href].itemsCount) this[this.href].itemsShowed++; else active = false;
                            }
  
                            this[this.href].pattern[i].active = active;
                        } else {
                            this[this.href].pattern[i].active = false;
                        }
                    }
                },
                moreItems : function() {
                    this[this.href].itemsCount += 12;
                    this.parseItems();
                },
                buyModal : function() {
                    let items = [];
                    for(let i in this[this.href].pattern) if(this[this.href].pattern[i].selected && this[this.href].pattern[i].appid == this[this.href].appid) items.push({
                        id : this[this.href].pattern[i].id,
                        market_hash_name : this[this.href].pattern[i].market_hash_name,
                        price : this[this.href].pattern[i].price,
                        icon_url : this[this.href].pattern[i].icon_url
                    });
  
                    if(items.length < 1) return this.notify({
                        success : false,
                        msg : 'Вы не выбрали предметы!',
                        msg_en : 'You have not selected items!'
                    });
  
                    return this.showModal('shop');
                },
                buyModalResolve : function() {
                    if(this.skinsModalDisable) return;
                    this.skinsModalDisable = true;
  
                    let apps = {
                        '730' : 'steam',
                        '540' : 'steam',
                        'vgo' : 'vgo',
                        'real' : 'real'
                    };
  
                    let inputs = {
                        'steam' : ['tradeurl'],
                        'vgo' : ['steamid64'],
                        'real' : ['fio', 'adress', 'post', 'phone']
                    }
  
                    let patterns = {
                        'steam' : '$tradeurl',
                        'vgo' : '$steamid64',
                        'real' : 'ФИО: $fio \nАдрес доставки : $adress \nПочтовый индекс : $post \nНомер телефона : $phone'
                    }
  
                    let returnValue = '';
                    let pattern = patterns[apps[this[this.href].appid]];
                    let cols = inputs[apps[this[this.href].appid]]
                    for(let i in cols) pattern = pattern.replace('$' + cols[i], $('#' + apps[this[this.href].appid] + '_' + cols[i]).val() || '$' + cols[i]);
  
                    for(let i in cols) if(pattern.indexOf('$' + cols[i]) > -1)
                    {
                        this.skinsModalDisable = false;
                        return this.notify({
                            success : false,
                            msg : 'Вы забыли указать некоторые данные!',
                            msg_en : 'You forgot to specify some data!'
                        });
  
                    }
  
                    this.skinsModalResult = pattern;
                    this.buyItems();
  
                    this.skinsModalDisable = false;
                    $('.popup, .overlay').removeClass('active');
                },
                buyItems : async function(trade) {
                    if(this[this.href].disableButton) return;
  
                    let items = [];
                    for(let i in this[this.href].pattern) if(this[this.href].pattern[i].selected && this[this.href].pattern[i].appid == this[this.href].appid) items.push({
                        id : this[this.href].pattern[i].id,
                        market_hash_name : this[this.href].pattern[i].market_hash_name,
                        mhn : this[this.href].pattern[i].mhn,
                        price : this[this.href].pattern[i].price,
                        icon_url : this[this.href].pattern[i].icon_url
                    });
  
                    if(items.length < 1) return this.notify({
                        success : false,
                        msg : 'Вы не выбрали предметы!',
                        msg_en : 'You have not selected items!'
                    });
  
                    if(this.href == 'vgo')
                    {
                        this[this.href].disableButton = true;
                        $.ajax({
                            url : '/market/vgo/send',
                            type : 'post',
                            data : {
                                items : JSON.stringify(items),
                                steamid64 : this.vgo.parsedID
                            },
                            success : r => {
                                this.notify(r);
                                this[this.href].disableButton = false;
                            },
                            error : () => console.error('Something went wrong!')
                        });
                        return;
                    }
  
                    let tradeUrl = this.skinsModalResult;
  
                    if(this.skins.appid == '730' || this.skins.appid == '540')
                    {
                        try {
                            tradeUrl = new URL(tradeUrl);
                        } catch(e) {
                            return this.notify({
                                success : false,
                                msg : 'Неверный формат ссылки!',
                                msg_en : 'Invalid link format!'
                            });
                        }
                    
                        let partner = tradeUrl.searchParams.get('partner') || false,
                            token = tradeUrl.searchParams.get('token') || false;
                        
                        if(!partner || !token) return this.notify({
                            success : false,
                            msg : 'Неверный формат ссылки!',
                            msg_en : 'Invalid link format!'
                        });
  
                        tradeUrl = {
                            partner : partner,
                            token : token
                        }
                    }
  
                    if(this.skins.appid == 'vgo')
                    {
                        if(typeof tradeUrl != 'string' || tradeUrl.length != 17) return this.notify({
                            success : false,
                            msg : 'SteamID64 состоит из 17 символов!',
                            msg_en : 'SteamID64 consists of 17 characters!'
                        });
                    }
                    
  
                    this.skins.disableButton = true;
  
                    $.ajax({
                        url : '/market/buy',
                        type : 'post',
                        data : {
                            items : JSON.stringify(items),
                            appid : this.skins.appid,
                            trade : JSON.stringify(tradeUrl),
                            currency: this.ln
                        },
                        success : r => {
                            if(typeof r.closed !== 'undefined' && r.closed)
                            {
                                for(let i in r.list)
                                {
                                    for(let s in this.skins.selected)
                                    {
                                        let newKeys = [];
                                        for(let k in this.skins.selected[s].keys)
                                        {
                                            let key = this.skins.selected[s].keys[k];
                                            if(this.skins.pattern[key].id == r.list[i])
                                            {
                                                this.skins.selected[s].total_price -= this.skins.pattern[key].price;
                                                if(this.skins.selected[s].total_price < 0) this.skins.selected[s].total_price = 0;
                                                this.skins.pattern[key].active = false;
                                                this.skins.pattern[key].selected = false;
                                            } else {
                                                newKeys.push(this.skins.selected[s].keys[k]);
                                            }
                                        }
                                        this.skins.selected[s].keys = newKeys;
                                    }
                                }
                                this.resetSkins();
                            }
                            this.skins.disableButton = false;
  
                            if(r.success) 
                            {
                                this.showTemplate('pay/history', true, true);
                                this.skins.rendered = false;
                            }
  
                            this.notify(r);
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                sendItems : function(id, index) {
                    if(this.payHistory.skins[index].accept) return;
                    this.payHistory.skins[index].accept = true;
  
                    $.ajax({
                        url : '/market/send',
                        type : 'post',
                        data : {
                            id : id
                        },
                        success : r => {
                            // // console.log(r);
                            this.notify(r);
                            this.payHistory.skins[index].accept = false;
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                parseInventory : function() {
                    if(this.vgo.parsing) return;
  
                    let steamid64 = $('#vgoSteamId64').val();
                    if(typeof steamid64 === 'undefined' || steamid64.length != 17) return this.notify({
                        success : false,
                        msg : 'SteamID64 состоит из 17 символов!',
                        msg_en : 'SteamID64 consists of 17 characters!'
                    });
  
                    for(let i = 0; i < 17; i++) 
                    {
                        let char = parseInt(steamid64[i]) || false;
                        if(isNaN(char)) return this.notify({
                            success : false,
                            msg : 'SteamID64 состоит только из цифр!',
                            msg_en : 'SteamID64 consists only of numbers!'
                        });
                    }
  
                    this.vgo.parsing = true;
  
                    $.ajax({
                        url : '/market/vgo/parse',
                        type : 'post',
                        data : {
                            steamid64 : steamid64
                        },
                        success : r => {
                            this.vgo.parsing = false;
                            if(!r.success) return this.notify(r);
                            
                            this.vgo.parsed = true;
                            this.vgo.pattern = r.inv;
                            this.vgo.parsedID = r.id;
                            this.parseItems();
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                reloadApp : function() {
                    $('.loaderArea').fadeIn(300, () => {
                        $.ajax({
                            url : '/patterns',
                            type : 'post',
                            success : r => {
                                for(i in r) if(typeof this[i] != 'undefined') 
                                {
                                    let notAvailable = ['login', 'chat'], detected = false;
                                    for(let u in notAvailable) if(notAvailable[u] == i) detected = true;
                                    if(!detected) this[i] = r[i];
                                }
                                this.init();
                            },
                            error : () => console.error('Something went wrong!')
                        });
                    });
                },
                cancelSkinsWithdraw : function(id, index) {
                    this.payHistory.skins[index].cancel = true;
                    $.ajax({
                        url : '/market/cancel',
                        type : 'post',
                        data : {
                            id : id
                        },
                        success : r => {
                            this.notify(r);
                            // // console.log(r);
                            this.payHistory.skins[index].cancel = false;
                        },
                        error : () => console.error('Something went wrong!')
                    })
                },
                buyVip : function(id) {
                    $.ajax({
                        url : '/chat/vip',
                        type : 'post',
                        data : {
                            id : id
                        },
                        success : r => {
                            this.notify(r);
                            // // console.log(r);
                        },
                        error : () => console.error('Something went wrong!')
                    });
                },
                changeTheme : async function() {
                    let theme = ($('#dn')[0].checked || false) ? 'dark' : 'light';
                    $.cookie('theme', theme);
                    await this.initTheme();
                },
                initTheme : function() {
                    return new Promise((res, rej) => {
                        let theme = $.cookie('theme') || 'light';
                        $('#style').attr('href', location.origin + '/public/css/'+((theme == 'light') ? 'style' : 'style_dark')+'.css');
                        if(theme == 'dark')
                        {
                            $('.loaderArea').addClass('dark');
                        } else {
                            $('.loaderArea').removeClass('dark');
                        }
                        setTimeout(() => {
                            window.onresize();
                            if(this.login.isAuth) $('#dn')[0].checked = (theme == 'dark') ? true : false;
                            return res(true);
                        }, 100);
                    });
                }
            },
            created : function() {
                this.init(true);
                $('.page').show();
            },
            mounted: function() {
                setTimeout(async() => {
                    await app.initTheme();
                    $('.loaderFull').fadeOut(300);
                }, 100);
            }
        });
  
    // Управление навигацией
    
    
    // Закрытие модальных окон Esc
  // $(document).keyup(function(e) {
    //     if(e.keyCode === 27) {
  // 		if($('.popup').is('.active')) {
    //             closePopup();
    //         }
  // 		if($('.leftbar').is('.active')) {
  // 			$('.leftbar').removeClass('active');
  // 		}
    //     }
    // });
  
    $('body').keydown((e) => {
        // Отправка сообщения по Enter
        if($(e.target)[0].localName == 'input' && e.which == 13 && $($(e.target)[0]).attr('data-own') == 'chat') 
        {
            app.chat_send();
            return e.preventDefault();
        }
  
        if(e.which == 27) $('.popup, .overlay').removeClass('active');
        // Dice, привязка стрелок к полю
        if(app.href == 'dice')
        {
            if(e.which == 37) app.diceLine(-1);
            if(e.which == 39) app.diceLine(1);
        }
  
        // Dice, зажатый Enter с интервалом с 1сек (1000)
        if(app.href == 'dice' && e.which == 13 && (new Date().getTime()-app.dice.lastEnterPlay) >= 1000) 
        {
            // // console.log((new Date().getTime()-app.dice.lastEnterPlay), (new Date().getTime()-app.dice.lastEnterPlay) >= 1000);
            app.dice.lastEnterPlay = new Date().getTime();
            app.dice_play();
            return;
        }
    });
  
    // Dice, клики Enter с интервалом в 0.3сек (300)
    $('body').keyup((e) => {
        if($(e.target)[0].localName == 'input') return e.preventDefault();
        if(app.href == 'dice' && e.which == 13) app.dice.lastEnterPlay = new Date().getTime()-700;
    });
  
    // Загружаем сообщения из чата
    $.ajax({
        url : '/chat/get',
        type : 'post',
        success : (r) => {
            app.chat = app.array_reverse(r.messages);
            if(r.giveaway) 
            {
                let g = r.giveaway;
                app.giveaway.active = true;
                app.giveaway.user = g.user;
                app.giveaway.amount = g.amount;
            }
        }
    });
  
    function WebSocketStart() {
        ws.onopen = () => {
            regMe();
        };
        ws.onclose = () => {
            app.notify(app.lang[app.ln].alerts.wsclose, 'error');
            $('.loaderArea').fadeIn(300);
            window.connectionInterval = setInterval(() => {
                if(ws.readyState == 1)
                {
                    clearInterval(window.connectionInterval);
                    location.reload();
                } else {
                    ws = new WebSocket(((SSL) ? 'wss' : 'ws') + '://'+location.host+':3031');
                }
            }, 1000);
        }
        ws.onmessage = (res) => {
            res = JSON.parse(res.data);
  
            if(res.type == 'update_vip' && login.isAuth) login.user.vip = res.vip;
            
            if(res.type == 'giveaway_timer') app.giveaway_timer = res.time;
  
            if(res.type == 'vgo_trade')
            {
                let found = false,
                    key = 0;
                for(let i = 0; i < app.payHistory.vgo.length; i++) if(app.payHistory.vgo[i].offer == res.trade.offer) 
                {
                    found = true;
                    app.payHistory.vgo[i].status = res.trade.status;
                }
  
                if(!found) 
                {
                    let cost = 0;
                    for(let i in res.trade.items) cost += res.trade.items[i].price;
                    app.payHistory.vgo.unshift({
                        id : res.trade.id,
                        offer : res.trade.offer,
                        items : res.trade.items,
                        price : parseFloat(cost.toFixed(2)) || 0,
                        status : res.trade.status
                    });
                }
            }
  
            if(res.type == 'activeTrades') app.activeTrades = res.count;
  
            if(res.type == 'update_skins')
            {
                if(app.href == 'pay/history')
                {
                    let found = false, key = 0;
                    for(let i in app.payHistory.skins)
                    {
                        let order = app.payHistory.skins[i];
                        if(order.id == res.offer.id)
                        {
                            found = true;
                            key = i;
                        }
                    }
  
                    if(!found) app.payHistory.skins.unshift(res.offer);
                    if(found) app.payHistory.skins[key].status = res.offer.status;
                } else {
                    app['pay/history'].rendered = false;
                }
            }
  
            // Проверка состояния окна
            if(res.type == 'ping') return // // console.log('pong');
            if(res.type == 'lvl' && app.login.isAuth) app.login.user.lvl = res.value;
            if(res.type == 'giveaway')
            {
                app.giveaway.active = true;
                app.giveaway.user = res.user;
                app.giveaway.amount = res.amount;
            }
            if(res.type == 'giveaway_close') app.giveaway.active = false;
  
            // История дайса
            if(res.type == 'dice')
            {
                app.dice.games = res.games;
                app.dice.today_bets = res.today_bets;
  
                // // console.log(res);
  
                let list = [];
                for(var i = 0; i < 9; i++) if(typeof app.dice.history[i] !== 'undefined') list.push(app.dice.history[i]);
                list.unshift(res);
                app.dice.history = list;
                return;
            }
  
            // Добавление нового сообщения
            if(res.type == 'chat_new')
            {
              console.log(res);
              app.chat = app.array_reverse(res.msg);
                setTimeout(() => {
                    $(window).resize();
                    $('.scroll').scrollTop(9999999999999);
                }, 10);
              return;
            }
  
            // Удаление сообщения
            if(res.type == 'chat_hide')
            {
                let list = [];
                for(var i = 0; i < app.chat.length; i++) if(app.chat[i].id != res.id) list.push(app.chat[i]);
                app.chat = list;
                return;
            }
  
            // Обновление баланса
            if(res.type == 'balance') 
            {
                // // console.log('BALANCE ALERT!');
                app.changeBalance(res.balance);
            }
            if(res.type == 'update_refs')
            {
                app.ref.refs = res.refs;
                // app.ref.money = res.money;
            }
  
            if(res.type == 'update_refs_money') app.ref.money = res.money;
  
            // Сообщение пользователю
            if(res.type == 'message')
            {
                // // console.log(res.msg);
                app.notify(res.msg);
            }
            if(res.type == 'crash_slider')
            {
                // Обновляем статус
                if(app.crash.status != 1) app.crash.status = 1;
  
                // Обновляем график
  
                // Множитель
                app.crash.multiplier = parseFloat(res.now.toFixed(2));
  
  
  
                // Автовывод
                // if(app.crash.multiplier >= app.crash.cashout && app.crash.bet > 0 && app.crash.cashout > 0) app.crash_cashout();
                for(let i = 0; i < app.crash.bets.length; i++) 
                {
                    let bet = app.crash.bets[i];
  
                    // && !bet.cashouting
                    if(app.login.isAuth && !bet.cashouting && bet.round_id == app.crash.game_id && bet.user_id == app.login.user.id && bet.cashout > 0 && bet.cashout <= app.crash.multiplier) app.crash_cashout(bet.id, i);
                }
  
                // Информация о множителе
                app.crash.chart = res.now.toFixed(2) + 'x';
                if(typeof res.crashed !== 'undefined') app.crash.crashed = res.crashed;
            }
            if(res.type == 'crash_timer') 
            {
                // Обновляем статус 
                if(app.crash.status != 0) app.crash.status = 0;
  
                // Выводим информацию таймера
                app.crash.chart = res.value + 's';
            }
            if(res.type == 'crash_reset') 
            {
                // Восстанавливаем краш в прежнее состояние
                app.crash.status = 0;
                app.crash.bets = res.bets;
                app.crash.multiplier = 0;
                app.crash.crashed = 0;
                app.crash.game_id = res.id;
  
                // Если мы получили ответ о прошлой игре, то выводим её в историю
                if(res.game.hash && res.game.number) app.crash.history.unshift(res.game);
                
                if(app.href == 'crash') app.crash_check();
            }
            if(res.type == 'crash_bet')
            {
                // обновление ставки
                let checked = false;
                for(var i in app.crash.bets)
                {
                    // // console.log(app.crash.bets[i].user_id);
                    if(app.crash.bets[i].id == res.bet.id)
                    {
                        checked = true;
                        app.crash.bets[i] = res.bet;
                    }
                }
  
                // если ставку мы не нашли, то суем её в начало массива
                if(!checked) app.crash.bets.unshift(res.bet);
                
                app.crash_check();
            }
            if(res.type == 'crash_remove')
            {
                let list = [];
                app.crash.bets.forEach(bet => {
                    if(bet.id != res.id) list.push(bet);
                });
  
                app.crash.bets = list;
                app.crash_check();
            }
            if(res.type == 'comission')
            {
                // // console.log(res);
            }
            if(res.type == 'online') 
            {
                // // console.log(res);
                app.online = res.online.ips.length+app.usersPattern;
            }
            if(res.type == 'pay')
            {
                app.payHistory.deposits.unshift(res.payment);
            }
            if(res.type == 'pay_update')
            {
                for(var i in app.payHistory.deposits) 
                {
                    if(app.payHistory.deposits[i].id == res.payment.id) 
                    {
                        app.payHistory.deposits[i].status = res.payment.status;
                        app.payHistory.deposits[i].info = res.payment.info;
                    }
                }
            }
            if(res.type == 'withdraw')
            {
                app.payHistory.withdraws.unshift(res.w);
            }
            if(res.type == 'withdraw_update')
            {
                for(var i in app.payHistory.withdraws) 
                {
                    // // console.log(app.payHistory.withdraws[i].id, res.w.id);
                    if(app.payHistory.withdraws[i].id == res.w.id) 
                    {
                        app.payHistory.withdraws[i].status = res.w.status;
                        app.payHistory.withdraws[i].info = res.w.info;
                    }
                }
            }
            if(res.type == 'jackpot_update')
            {
                // console.log(res);
                app.jackpot.game.users = res.response.users;
                app.jackpot.game.bets = res.response.bets;
                app.jackpot.game.price = res.response.price;
                if(app.href == 'jackpot') app.jackpot_init();
            }
  
            if(res.type == 'jackpot_timer')
            {
                app.jackpot.timer.sec = (res.time < 10) ? ('0'+res.time) : (res.time);   
            }
            if(res.type == 'jackpot_reset')
            {
                app.jackpot.timer.sec = res.time;
                app.jackpot.timer.mls = '000';
                app.jackpot.game = res.game;
                app.jackpot.winner.show = false;
                app.jackpotHistory.games.unshift(res.history);
  
                if(app.href == 'jackpot') app.jackpot_init();
            }
            if(res.type == 'jackpot_status')
            {
                app.jackpot.game.status = res.status;
            }
            if(res.type == 'jackpot_slider')
            {
                // app.jackpot.winner = res.winner;
                app.jackpot.game.rotate = res.rotate;
                if(app.href == 'jackpot' && app.jackpot.game.status == 2) $('.spinner').css('transform', 'rotate('+res.rotate+'deg)');
            }
            if(res.type == 'jackpot_winner')
            {
                app.jackpot.winner = res.winner;
            }
        }
    }
    WebSocketStart();
  
    function regMe() {
        if(app.login.isAuth) 
        {
            if(ws.readyState == 1)
            {
                ws.send(JSON.stringify({
                    type : 'auth',
                    user : app.login.user
                }));
            } else {
                setTimeout(regMe, 1000);
            }
        }
    }
  
  window.onresize = function() {
        if(document.readyState == 'complete')
        {
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
  
            $('.leftbar .scroll').slimScroll({ destroy: true }); 
            $('.leftbar .scroll').slimScroll({
                // height: 'auto', 
                height: $('.leftbar').height()-150 + 'px',
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
            
            if(app.href == 'crash') app.resize();
        } else {
            setTimeout(() => {
                window.onresize();
            }, 50);
        }
    }
    
  // $(document).on('click','.action-leftbar', function(){
  // 	if($('.leftbar').is('.small')) {
  // 		$('.leftbar').removeClass('small');
  // 		$('body').removeClass('leftsmall');
  // 	} else {
  // 		$('.leftbar').addClass('small');
  // 		$('body').addClass('leftsmall');			
    //     }
    //     app.resize();
  // 	return false;
  // });
  
  $(document).on('click','.rightbar-close', function(){
    if($('.rightbar').is('.small')) {
      $('.rightbar').removeClass('small');
            $('body').removeClass('rightsmall');
            app.chat_open = true;
    } else {
      $('.rightbar').addClass('small');
            $('body').addClass('rightsmall');
            app.chat_open = false;			
        }
        if(app.href == 'crash') app.resize();
    return false;
    });
  
    if($('body').hasClass('rightsmall')) app.chat_open = false; else app.chat_open = true;
  
  $('.nav-resize').on('click',function(){
    $('.leftbar').addClass('active');
    return false;
  });
  
  $(document).on('click','.close-leftbar', function(){
    $('.leftbar').removeClass('active');
    return false;
    });
    
    $('[data-close="alert"]').click(function() {
        $(this).parent().fadeOut(300, () => {
            $(this).hide();
        })
    });
  
    // Отлов состояния истории
    window.addEventListener('popstate', function (e) {
        e.preventDefault();
        app.init(false);
    }, false);  
  
    window.scrollvalues = [];
    window.onscroll = function() {
        let value = window.pageYOffset || document.documentElement.scrollTop,
            bottom = $('body').height()-screen.availHeight;
        
        if(value > bottom) 
        {
            if(app.href == 'skins' || app.href == 'vgo') 
            {
                // app[app.href].itemsCount += 12;
                // app.parseItems();
            }
        }
    }
  
    }
  });