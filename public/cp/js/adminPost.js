$(document).ready(() => {
	window.ws = new WebSocket(((SSL) ? 'wss' : 'ws') + '://'+location.host+':2083');

	window.notify = (msg, type) => {
		if(typeof msg != 'string' && typeof msg == 'object')
		{
			type = (msg.success) ? 'success' : 'error';
			msg = msg.msg;
		}
		$.notify({
			position : 'top-right',
			type: type,
			message: msg
		});
	}

	window.appRendered = false;

	$.ajax({
		url : '/admin/patterns',
		type : 'post',
		success : r => {
			window.app = new Vue({
				el : '#app',
				data : r.patterns,
				methods : {
					init : function() {
						this.toogle_nav(null, true);
						this.path = location.pathname.split('/');
						this.template = (typeof this.path[2] == 'undefined') ? 'index' : this.path[2];
						if(typeof this.path[3] != 'undefined') 
						{
							if(this.template == 'users') this.template = 'user';
							if(this.template == 'bots') this.template = 'bot'
							this.template_query = {
								id : parseInt(this.path[3]),
								template : this.template
							}
						} else {
							this.template_query = {
								id : null,
								template : this.template
							}
						}
						this.render();
					},
					render : function() {
						$.ajax({
							url : '/admin/render',
							type : 'post',
							data : {
								path : this.template,
								id : this.template_query.id
							},
							success : r => {
								if(r.success) 
								{
									this.paths[r.path] = r.pattern;
									this.rendered = true;
									if(this.template == 'market') this.updateMarketGame();
									if(this.template == 'index')
									{
										let OnlineEmmit = setInterval(() => {
											if(ws.readyState == WebSocket.OPEN)
											{
												clearInterval(OnlineEmmit);
												ws.send(JSON.stringify({
													type : 'online'
												}));
											}
										}, 300);
									}
								} else {
									this.notify(r);
									if(!this.redirectedToLastPath)
									{
										this.react(this.lastPath);
										this.redirectedToLastPath = true;
									}
								}
							},
							error : e => console.error('Something went wrong')
						});
					},
					changeUser : function(type) {
						if(type == 'youtube') this.paths.user.youtube.active = (parseInt($('#youtube').val()) === 1) ? true : false;
						if(type == 'is_admin') this.paths.user.is_admin = parseInt($('#is_admin').val());
						if(type == 'vip') this.paths.user.vip = (parseInt($('#vip').val()) === 1) ? true : false;
						// if(type == 'balance') this.paths.user.balance = parseFloat($('#balance').val());
						if(type == 'href') this.paths.user.youtube.href = $('#href').val();
						if(type == 'ban') this.paths.user.ban.active = (parseInt($('#ban').val()) === 1) ? true : false;;
						if(type == 'ban_reason') this.paths.user.ban.reason = $('#ban_reason').val();


					},
					saveUser : function(e) {
						e.preventDefault(); 
						let balance = parseFloat($('#balance').val());
						if(isNaN(balance)) return this.notify('Неверный баланс!', 'error');
						this.paths.user.balance = balance;

						$.ajax({
							url : '/admin/user/save',
							type : 'post',
							data : {
								id : this.paths.user.id,
								balance  : balance,
								is_admin : this.paths.user.is_admin,
								vip : this.paths.user.vip,
								youtube_active : this.paths.user.youtube.active,
								youtube_href : this.paths.user.youtube.href,
								ban_active : this.paths.user.ban.active,
								ban_reason : this.paths.user.ban.reason
							},
							success : r => {
								this.notify(r);
							},
							error : e => console.error('Something went wrong')
						});
					},
					notify : (msg, type) => {
						if(typeof msg != 'string' && typeof msg == 'object')
						{
							type = (msg.success) ? 'success' : 'error';
							msg = msg.msg;
						}
						$.notify({
							position : 'top-right',
							type: type,
							message: msg
						});
					},
					react : function(path) {
						this.lastPath = location.pathname;

						window.history.pushState('', '', path);

						// remove datatables
						for(let i in this.tables) this.tables[i].destroy();
						this.tables = [];

						this.rendered = false;
						this.init();
					},
					changeSettings : function(event) {
						this.paths.settings[event.target.name] = $(event.target).val();
					},
					settingsSave : function(e) {
						e.preventDefault();
						$.ajax({
							url : '/admin/settingsSave',
							type : 'post',
							data : this.paths.settings,
							success : r => {
								this.notify(r);
							},
							error : e => console.error('Something went wrong')
						});
					},
					acceptWithdraw : function(id, index, acceptApi) {
						acceptApi = (typeof acceptApi === 'undefined') ? true : acceptApi;
						$.ajax({
							url : '/admin/acceptWithdraw',
							type : 'post',
							data : {
								id : id,
								acceptApi: acceptApi
							},
							success : r => {
								this.notify(r);
								this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					cancelWithdraw : function(id, index) {
						this.paths.withdraw.money[index].canceling = true;
						$.ajax({
							url : '/admin/cancelWithdraw',
							type : 'post',
							data : {
								id : id
							},
							success : r => {
								this.notify(r);
								this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					createPromo : function(e) {
						e.preventDefault();
						
						let promo = $('#promo_code').val(),
							amount = parseFloat($('#promo_amount').val()) || 0,
							count = parseFloat($('#promo_count').val()) || 0;

						if(promo.length < 1) return this.notify('Вы не ввели промокод!', 'error');
						if(amount < 1) return this.notify('Вы не ввели сумму!', 'error');
						if(count < 1) return this.notify('Вы не ввели кол-во активаций!', 'error');

						$.ajax({
							url : '/admin/promo/create',
							type : 'post',
							data : {
								promo : promo,
								amount : amount,
								count : count
							},
							success : r => {
								this.notify(r);
								if(r.success) 
								{
									$('#createPromo').modal('hide');
									this.render();
								}
							},
							error : e => console.error('Something went wrong')
						});
					},
					deletePromo : function(id) {
						$.ajax({
							url : '/admin/promo/delete',
							type : 'post',
							data : {
								id : id
							},
							success : r => {
								this.notify(r);
								if(r.success) this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					editPromo : function(p) {
						$('#edit_promo_id').val(p.id);
						$('#edit_promo_promo').val(p.promo);
						$('#edit_promo_amount').val(p.amount);
						$('#edit_promo_count').val(p.count);
						$('#editPromo').modal('show');
					},
					savePromo : function(e) {
						e.preventDefault();
						let promo = $('#edit_promo_promo').val(),
							amount = parseFloat($('#edit_promo_amount').val()) || 0,
							count = parseFloat($('#edit_promo_count').val()) || 0,
							id = parseFloat($('#edit_promo_id').val()) || 0;

						if(id < 1) return this.notify('Не удалось определить id промокода!', 'error');
						if(promo.length < 1) return this.notify('Вы не ввели промокод!', 'error');
						if(amount < 1) return this.notify('Вы не ввели сумму!', 'error');
						if(count < 1) return this.notify('Вы не ввели кол-во активаций!', 'error');

						$.ajax({
							url : '/admin/promo/save',
							type : 'post',
							data : {
								id : id,
								promo : promo,
								amount : amount,
								count : count
							},
							success : r => {
								this.notify(r);
								if(r.success) 
								{
									$('#editPromo').modal('hide');
									this.render();
								}
							},
							error : e => console.error('Something went wrong')
						})
					},
                    jackpotSetWinner : function(key, id) {
                        app.paths.index.jackpot_bets[key].disableButton = true;
                        $.ajax({
                            url : '/admin/setJackpotWinner',
                            type : 'post',
                            data : {
                                id : id
                            },
                            success : r => {
                                this.notify(r);
                                app.paths.index.jackpot_bets[key].disableButton = false;
                            },
                            error : e => console.error('Something went wrong')
                        });
                    },
                    toogle_nav : function(e, close) {
                        close = close || false;
                        if(close)
                        {
                            $('.wrapper').removeClass('open-right-sidebar open-setting-panel slide-nav-toggle');
                            return;
                        }
                        
                        $('.wrapper').removeClass('open-right-sidebar open-setting-panel').toggleClass('slide-nav-toggle');
					},
					datatable : function() {
						let access = ['promo', 'withdraw', 'users', 'market', 'index', 'bots'],
							denied = true;

						for(let i in access) if(access[i] == this.template) denied = false;
						if(denied) return;


						if(this.template == 'withdraw')
						{
							this.tables.push($('.withdraw_table1').DataTable());
							this.tables.push($('.withdraw_table2').DataTable());
							this.tables.push($('.withdraw_table3').DataTable());
						} else if(this.template == 'market') {
							this.tables.push($('.market_dota').DataTable());
							this.tables.push($('.market_csgo').DataTable());
							this.tables.push($('.market_real').DataTable());
						} else {
							this.tables.push($('.'+this.template+'_table').DataTable());
						}
					},
					createBot : function(e) {
						e.preventDefault();

						let username = $('#createBotForm').find('input').val();
						if(username.length < 1) return this.notify('Вы не указали имя пользователя!', 'error');

						if(this.paths.bots.create) return;
						this.paths.bots.create = true;

						$.ajax({
							url : '/admin/bots/create',
							type : 'post',
							data : {
								username : username
							},
							success : r => {
								this.paths.bots.create = false;
								this.notify(r);
								if(r.success) this.react('/admin/bots/' + r.id);
							},
							error : e => console.error('Something went wrong')
						});
					},
					parseBot : function(e) {
						e.preventDefault();

						let href = $('#parseBotForm').find('input').val();
						if(href.length < 1) return this.notify('Вы не указали ссылку!', 'error');

						if(this.paths.bots.parse) return;
						this.paths.bots.parse = true;
						$.ajax({
							url : '/admin/bots/parse',
							type : 'post',
							data : {
								href : href
							},
							success : r => {
								this.paths.bots.parse = false;
								this.notify(r);
								if(r.success) this.react('/admin/bots/' + r.id);
							},
							error : e => console.error('Something went wrong')
						});
					},
					changeBot : function(type) {
						if(type == 'vip') this.paths.bot.vip = (parseInt($('#bot_vip').val()) === 1) ? true : false;
						if(type == 'active') this.paths.bot.active = (parseInt($('#bot_active').val()) === 1) ? true : false;
						if(type.indexOf('bets') >= 0) this.paths.bot[type] = $('#'+type).val();
						
						if(type == 'bot_dice') this.paths.bot.dice = (parseInt($('#bot_dice').val()) === 1) ? true : false;
						if(type == 'bot_crash') this.paths.bot.crash = (parseInt($('#bot_crash').val()) === 1) ? true : false;
						if(type == 'bot_jackpot') this.paths.bot.jackpot = (parseInt($('#bot_jackpot').val()) === 1) ? true : false;


						if(type == 'time') this.paths.bot.time = parseInt($('#bot_time').val());
					},
					saveBot : function(e) {
						e.preventDefault();

						$.ajax({
							url : '/admin/bots/save',
							type : 'post',
							data : this.paths.bot,
							success : r => {
								this.notify(r);
								if(r.success) this.react(this.lastPath);
							},
							error : e => console.error('Something went wrong')
						});
					},
					deleteBot : function(id) {
						$.ajax({
							url : '/admin/bots/delete',
							type : 'post',
							data : {
								id : id
							},
							success : r => {
								this.notify(r);
								if(r.success) this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					updateMarketGame : function() {
						this.paths.market.game = $('#game').val();
					},
					createItem : function(e) {
						e.preventDefault();
						let market_hash_name = $('#market_hash_name').val(),
							price = parseFloat($('#item_price').val()) || false,
							game = $('#game').val(),
							count = (game == 'csgo') ? 0 : parseInt($('#count').val()) || false,
							icon_url = (game == 'real') ? $('#icon_url').val() : false,
							size = (game == 'real') ? $("#size").val() : '';
						if(market_hash_name.length < 1) return this.notify('Вы забыли ввести название предмета!', 'error');
						if(!price) return this.notify('Вы забыли ввести максимальную цену предмета!', 'error');
						if(count === false) return this.notify('Вы забыли указать количество товара!', 'error');
						if(game == 'real' && size.length < 1) return this.notify('Вы забыли указать размеры!', 'error');

						this.paths.market.disableButton = true;
						$.ajax({
							url : '/admin/market/create',
							type : 'post',
							data : {
								market_hash_name : market_hash_name,
								game : game,
								price : price,
								count : count,
								icon_url : icon_url,
								size: size
							},
							success : r => {
								this.paths.market.disableButton = false;
								this.notify(r);
								if(r.success) this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					deleteItem : function(id) {
						$.ajax({
							url : '/admin/market/delete',
							type : 'post',
							data : {
								id : id
							},
							success : r => {
								this.notify(r);
								if(r.success) this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					cancelTrade : function(id, index)
					{
						if(this.paths.withdraw.skins[index].accept || this.paths.withdraw.skins[index].cancel) return;
						this.paths.withdraw.skins[index].cancel = true;
						$.ajax({
							url : '/admin/withdraw/trade/cancel',
							type : 'post',
							data : {
								id : id
							},
							success : r => {
								this.notify(r);
								this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					acceptTrade : function(id, index, acceptApi) {
						if(this.paths.withdraw.skins[index].accept || this.paths.withdraw.skins[index].cancel) return;
						if(typeof acceptApi == 'undefined') acceptApi = true;
						this.paths.withdraw.skins[index].accept = true;
						$.ajax({
							url : '/admin/withdraw/trade/accept',
							type : 'post',
							data : {
								id : id,
								acceptApi: acceptApi
							},
							success : r => {
								this.notify(r);
								this.render();
							},
							error : e => console.error('Something went wrong')
						});
					},
					sendMessage : function(event) {
						event.preventDefault();

						let msg = $('#chatmessage').val(),
							bot = $('#botID').val();

						if(msg.length < 1) return this.notify('Вы забыли ввести сообщение!', 'error');

						$.ajax({
							url : '/admin/chat/send',
							type : 'post',
							data : {
								msg : msg,
								bot : bot,
								lang : this.paths.index.chatln
							},
							success : r => {
								this.notify(r);
							},
							error : e => console.error('Something went wrong')
						});
					},
					createAlert : function(e) {
                        e.preventDefault();
                        let en = $('#alert_en').val(),
                            ru = $('#alert_ru').val();

                        if(en.length < 1) return this.notify('Вы забыли ввести текст на английском языке!', 'error');
                        if(ru.length < 1) return this.notify('Вы забыли ввести текст на русском языке!', 'error');

                        this.paths.alerts.create = true;
                        $.ajax({
                            url : '/admin/alerts/create',
                            type : 'post',
                            data : {
                                en : en,
                                ru : ru
                            },
                            success : r => {
                                this.paths.alerts.create = false;
                                this.notify(r);
                                if(r.success) this.render();
                            },
                            error : e => console.error('Something went wrong')
                        });
                    },
                    deleteAlert : function(id, index) {
                        this.paths.alerts.list[index].delete = true;
                        $.ajax({
                            url : '/admin/alerts/delete',
                            type : 'post',
                            data : {
                                id : id
                            },
                            success : r => {
                                this.paths.alerts.list[index].delete = false;
                                this.notify(r);
                                if(r.success) this.render(); 
                            },
                            error : () => console.error('Something went wrong')
                        });
					},
					updateWithdrawStatus : function(id, index, status) {
						$.ajax({
							url : '/admin/market/update',
							type : 'post',
							data : {
								id : id,
								status : status
							},
							success : r => {
								this.notify(r);
								if(r.success) this.render();
							},
							error : e => console.error('Something went wrong!')
						});
					}
				},
				mounted : function() {
					appRendered = true;
				},
				created : function() {
					this.init();
				},
				updated : function() {
					if(this.rendered)
					{
						if(this.template == 'user')
						{
							$('#youtube').val((this.paths.user.youtube.active) ? 1 : 0);
							$('#is_admin').val(this.paths.user.is_admin);
							$('#vip').val((this.paths.user.vip) ? 1 : 0);
							$('#ban').val((this.paths.user.ban.active) ? 1 : 0);
						}

						if(this.template == 'bot')
						{
							$('#bot_vip').val((this.paths.bot.vip) ? 1 : 0);
							$('#bot_active').val((this.paths.bot.active) ? 1 : 0);
							$('#bot_time').val(this.paths.bot.time);

							$('#bot_crash').val((this.paths.bot.crash) ? 1 : 0);
							$('#bot_dice').val((this.paths.bot.dice) ? 1 : 0);
							$('#bot_jackpot').val((this.paths.bot.jackpot) ? 1 : 0);
						}

						this.datatable();
					}
				}
			});
		}, 
		error : e => console.error('Something went wrong')
	});

    window.addEventListener('popstate', function (e) {
        e.preventDefault();
        app.init();
    }, false);  
	
    function WebSocketStart()
    {
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type : 'is_admin'
            }));
        };
        ws.onclose = () => {
            app.notify('Соединение с серверов потеряно', 'error');
            window.connectionInterval = setInterval(() => {
                if(ws.readyState == 1)
                {
                    clearInterval(window.connectionInterval);
                    location.reload();
                } else {
                    ws = new WebSocket(((SSL) ? 'wss' : 'ws') + '://'+location.host+':3030');
                }
            }, 1000);
        }
        ws.onmessage = (res) => {
            res = JSON.parse(res.data);
            if(res.type == 'withdraw' && appRendered && app.template == 'withdraw') app.render();
            if(res.type == 'online' && appRendered && app.template == 'index') 
            {
                app.paths.index.online.users = res.online.users;
                app.paths.index.online.connections = res.online.connections;
            }
            if(res.type == 'jackpot_update' && app.template == 'index')
            {
                let found = false;
                for(let i in app.paths.index.jackpot_bets) if(app.paths.index.jackpot_bets[i].user_id == res.bet.user_id && app.paths.index.jackpot_bets[i].id == res.bet.game_id) found = true;
                if(!found) app.paths.index.jackpot_bets.unshift({
                    user_id : res.bet.user_id,
                    user : res.bet.user,
                    disableButton : false,
                    id : res.bet.game_id
                });


            }
			if(res.type == 'jackpot_reset' && app.template == 'index') app.paths.index.jackpot_id = res.game.id;
			
            if(res.type == 'chat_new')
            {
                let list = [];
                for(var i = 0; i < 24; i++) if(typeof app.paths.index.chat[i] !== 'undefined') list.push(app.paths.index.chat[i]);
                list.unshift(res.msg);
                app.paths.index.chat = list;
                // setTimeout(() => {
                //     $(window).resize();
                //     $('.scroll').scrollTop(9999999999999);
                // }, 10);
                return;
            }
        }
    }
    WebSocketStart();
});