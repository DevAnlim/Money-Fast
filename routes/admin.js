const Route = require('express').Router();
const {reactAdmin, random, toUSD} = require('../app/helpers');
const {adminPatterns, adminRender} = require('../app/render');
const {Users, getTransaction, Sequelize, Withdraw, Jackpot, Alerts, JackpotBets, Config, execConfig, Promo, Bots, MarketItems, Items, Chat} = require('../app/database');
const {auth,admin} = require('../app/middleware');
const {sendToUser, sendAll} = require('../app/websocket');
const {_fkSend} = require('../app/freekassa');
const url = require('url');
const {parseVkontakteUser} = require('../app/vk');
const {parseSteamUser} = require('../app/steam');
const {constructTrade, activeTrades, resetItems} = require('../app/market');
const {site} = require('../config');

Route.use(auth);
Route.use(admin);

for(var i in reactAdmin)
{
    Route.get('/' + ((reactAdmin[i] == 'index') ? '' : reactAdmin[i]), async(req, res) => {
        return res.render('admin', {
            domain : site.domain,
            ssl : (site.enableSSL) ? 1 : 0
        });
    });
}

Route.post('/market/update', async(req, res) => {
    await Items.update({
        status : req.body.status
    }, {
        where : {
            withdraw : req.body.id
        }
    });

    return res.json({
        success : true,
        msg : 'Изменили статус вывода #' + req.body.id + ' на ' + req.body.status
    });
});

Route.post('/alerts/create', async(req, res) => {
    await Alerts.create(req.body);
    return res.json({
        success : true,
        msg : 'Новый баннер успешно создан!'
    });
});

Route.post('/alerts/delete', async(req, res) => {
    let alert = await Alerts.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!alert) return res.json({
        success : false,
        msg : 'Не удалось найти баннер #' + req.body.id
    });

    await Alerts.destroy({
        where : {
            id : alert.id
        }
    });

    return res.json({
        success : true,
        msg : 'Баннер #' + alert.id + ' успешно удален!'
    });
});

Route.post('/chat/send',async(req, res) => {
    
    let bot = await Bots.findOne({
        where : {
            id : parseInt(req.body.bot) || 0
        }
    });

    if(!bot) return res.json({
        success : false,
        msg : 'Не удалось найти бота #' + req.body.bot
    });

    let chatMsg = await Chat.create({
        user_id : bot.id,
        user : {
            username : bot.username,
            avatar : bot.avatar,
            id : bot.id,
            is_admin : 0,
            vip : bot.vip,
            youtube : {
                active : false,
                href : ''
            }
        },
        message : req.body.msg,
        lang : req.body.lang
    });

    sendAll({
        type : 'chat_new',
        msg : await Chat.findAll({
            order : [['id', 'desc']],
            limit : 20
        })
    });

    return res.json({
        success : true,
        msg : 'Сообщение отправлено от имени ' + bot.username
    });
});

Route.post('/withdraw/trade/cancel', async(req, res) => {
    let trade = await constructTrade(req.body.id);
    let delivery = 0;
    if(trade.appid == 'real') delivery = 300;

    let t = await getTransaction();
    try {
        await Items.update({
            status : 6,
        }, {
            where : {
                withdraw : trade.id
            },
            transaction : t
        });

        await Users.update({
            balance : Sequelize.literal('"balance"+' + (trade.price+delivery))
        }, {
            where : {
                id : trade.user.id
            },
            transaction : t
        });

        trade.user = await Users.findOne({
            where : {
                id : trade.user.id
            },
            transaction : t
        });

        await t.commit();
    } catch(e) {
        await t.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Ошибка при отмене вывода #' + req.body.id
        });
    }

    sendToUser(trade.user.id, {
        type : 'update_skins',
        offer : await constructTrade(trade.id)
    });

    sendToUser(trade.user.id, {
        type : 'balance',
        balance : trade.user.balance
    });

    sendToUser(trade.user.id, {
        type : 'message',
        msg : {
            success : false,
            msg : 'Вывод #' + trade.id + ' был отменен! На ваш баланс зачислено ' + (trade.price+delivery) + ' руб.',
            msg_en : 'Withdraw #' + trade.id + ' has been canceled. Credited to your balance' + (await toUSD((trade.price+delivery), 2)) + ' USD'
        }
    });

    let resItems = await resetItems(trade.id);

    return res.json({
        success : true,
        msg : 'Вывод #' + req.body.id + ' отменен!'
    });
});

Route.post('/withdraw/trade/accept', async(req, res) => {
    let trade = await constructTrade(req.body.id),
        AcceptAPI = (req.body.acceptApi === 'false') ? false : true;

    let ItemStatus = (trade.appid == 540) ? 5 : 2;
    if(!AcceptAPI) ItemStatus = 5;

    let t = await getTransaction();
    try {
        await Items.update({
            status : ItemStatus
        }, {
            where : {
                withdraw : trade.id
            },
            transaction : t
        });

        await t.commit();
    } catch(e) {
        await t.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Ошибка при подтверждении вывода #' + req.body.id
        });
    }

    sendToUser(trade.user.id, {
        type : 'activeTrades',
        count : await activeTrades(trade.user.id)
    });
    
    sendToUser(trade.user.id, {
        type : 'message',
        msg : {
            success : true,
            msg : 'Ваш вывод одобрили! Вы можете забрать его в разделе "История счета"',
            msg_en : 'Your withdraw is approved! You can pick it up in the "Pay History" section.'
        }
    });
    
    sendToUser(trade.user.id, {
        type : 'update_skins',
        offer : await constructTrade(trade.id)
    });

    return res.json({
        success : true,
        msg : 'Вывод #' + req.body.id + ' подтвержден!'
    });
});

Route.post('/market/delete', async(req, res) => {
    let item = await MarketItems.findOne({
        where : req.body
    });

    if(!item) return res.json({
        success : false,
        msg : 'Не удалось найти предмет #' + req.body.id
    }); 

    await MarketItems.destroy({
        where : req.body
    });

    await Items.destroy({
        where : {
            market_hash_name : item.market_hash_name
        }
    });

    return res.json({
        success : true,
        msg : item.market_hash_name + ' удален!'
    });
});

Route.post('/market/create', async(req, res) => {
    let item = await MarketItems.findOne({
        where : {
            market_hash_name : req.body.market_hash_name,
            game : req.body.game
        }
    });

    if(item && req.body.game != 'dota2' && req.body.game != 'real') return res.json({
        success : false,
        msg : item.market_hash_name + ' уже существует!'
    });

    // if(req.body.game == 'dota2' && !item)
    // {
    //     item = await MarketItems.findOne({
    //         where : {
    //             market_hash_name : req.body.market_hash_name,
    //             game : req.body.game
    //         }
    //     });
    // }

    if(!item) await MarketItems.create({
        market_hash_name : req.body.market_hash_name,
        game : req.body.game, 
        price : req.body.price,
        icon_url : (req.body.game == 'real') ? req.body.icon_url : 'null',
        count : (req.body.game == 'csgo') ? 0 : parseInt(req.body.count),
        size: req.body.size
    });

    if(req.body.game == 'dota2' || req.body.game == 'real')
    {
        for(let i = 0; i < req.body.count; i++) await Items.create({
            appid : (req.body.game == 'dota2') ? '540' : 'real',
            itemid : req.body.game + '_' + req.body.market_hash_name,
            market_hash_name : req.body.market_hash_name,
            icon_url : (req.body.game == 'real') ? req.body.icon_url : 'https://cdn.dota2.net/item/' + req.body.market_hash_name + '/300.png',
            class : req.body.game + '_' + req.body.market_hash_name,
            instance : req.body.game + '_' + req.body.market_hash_name,
            price : (item) ? item.price : req.body.price,
            real_price : (item) ? item.real_price : parseInt(req.body.price),
            extra : {},
            size: req.body.size
        });
    }

    if(item && (req.body.game == 'dota2' || req.body.game == 'real')) 
    {
        await MarketItems.update({
            count : Sequelize.literal('"count"+'+req.body.count)
        }, {
            where : {
                market_hash_name : req.body.market_hash_name,
                game : req.body.game
            }
        });
        return res.json({
            success : true,
            msg : 'Добавили ' + req.body.count + ' к '+ item.market_hash_name
        });
    }

    return res.json({
        success : true,
        msg : req.body.market_hash_name + ' добавлен!'
    });
});

Route.post('/bots/delete', async(req, res) => {
    let bot = await Bots.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!bot) return res.json({
        success : false,
        msg : 'Не удалось найти бота #' + req.body.id
    });

    await Bots.destroy({
        where : {
            id : bot.id
        }
    });

    return res.json({
        success : true,
        msg : 'Бот #' + bot.id + ' удален!'
    });
});

Route.post('/bots/create', async(req, res) => {
    if(req.body.length < 1) return res.json({
        success : false,
        msg : 'Вы забыли ввести имя пользователя!'
    });

    let available = 'abcdefghijklmnopqrstuvwxyz0123456789._';
    for(let i = 0; i < req.body.username.length; i++) 
    {
        let found = false;
        for(let u = 0; u < available.length; u++) if(available[u] == req.body.username[i].toLowerCase()) found = true; 
            
        if(!found) return res.json({
            success : false,
            msg : 'В имене бота был найден запрещенный символ «'+req.body.username[i]+'»'
        });
    }

    let bot = await Bots.create({
        username : req.body.username,
        avatar : 'https://pp.userapi.com/c851228/v851228527/52738/pe1IHBUQIBU.jpg',
        method : 'local',
        vip : false,
        time : 0,
        count : 0,
        active : false
    });

    bot = bot.get({plain:true});

    return res.json({
        success : true,
        msg : 'Пользователь ' + req.body.username + ' добавлен! [local]',
        id : bot.id
    });
});

Route.post('/bots/parse', async(req, res) => {
    let parseURL = req.body.href;

    let user = {
        username : '',
        avatar : '',
        method : ''
    }

    try {
        parseURL = new URL(parseURL);
    } catch(e) {
        console.log(e);
        return res.json({
            success : false,
            msg : 'Не верный формат ссылки!'
        });
    }

    parseURL = url.parse(req.body.href);

    if(parseURL.protocol != 'http:' && parseURL.protocol != 'https:') return res.json({
        success : false,
        msg : 'Доступные протоколы - [http/https]'
    });

    if(parseURL.host != 'vk.com' && parseURL.hostname != 'vk.com' && parseURL.host != 'steamcommunity.com' && parseURL.hostname != 'steamcommunity.com') return res.json({
        success : false,
        msg : 'Доступные хосты - [vk.com/steamcommunity.com]'
    });


    // парсим юзера из вк
    if(parseURL.host == 'vk.com' || parseURL.hostname == 'vk.com')
    { 
        // проверяем pathname
        let id = false;
        if(parseURL.pathname.indexOf('/id') === 0) id = parseURL.pathname.replace('/id', ''); else id = parseURL.pathname.replace('/','');

        // берем любой токен
        let tokenUser = await Users.findOne({
            where : {
                method : 'vkontakte'
            },
            order : [['updatedAt', 'desc']]
        });

        if(!tokenUser) return res.json({
            success : false,
            msg : 'Не удалось найти пользователя с активным access_token!'
        });

        let parseResult = await parseVkontakteUser(id, tokenUser.access_token);
        if(!parseResult) return res.json(parseResult);
        if(parseResult.success) parseResult = parseResult.result;

        if(typeof parseResult.result != 'undefined' && typeof parseResult.result.error != 'undefined')
        {
            if(typeof parseResult.result.error.error_code != 'undefined')
            {
                if(parseResult.result.error.error_code == 5) return res.json({
                    success : false,
                    msg : 'Недействительный access_token!'
                });

                return res.json({
                    success : false,
                    msg : 'Неизвестная ошибка (' + parseResult.result.error.error_code + ') : ' + parseResult.result.error.error_msg
                });
            }
        } else {
            parseResult = parseResult.result.response;
            if(typeof parseResult[0] == 'undefined') return res.json({
                success : false,
                msg : 'Не удалось найти пользователя [' + id + ']'
            });
            parseResult = parseResult[0];
        }

        user.username = parseResult.first_name + ' ' + parseResult.last_name;
        user.avatar = parseResult.photo_100;
        user.method = 'vkontakte';
    } else if(parseURL.host == 'steamcommunity.com' || parseURL.hostname == 'steamcommunity.com') {
        let steamid64 = parseURL.pathname.split('/');
        if(steamid64[1] !== 'profiles' || typeof steamid64[2] == 'undefined' || steamid64[2].length != 17) return res.json({
            success : false,
            msg : 'Неверный формат steam ссылки!'
        });

        let parseResult = await parseSteamUser(steamid64[2], 'E9FD869500CCA696633659AC2DC66B3F');
        if(!parseResult) return res.json(parseResult);
        if(parseResult.success) parseResult = parseResult.result.result.response.players;
        if(parseResult.length < 1) return res.json({
            success : false,
            msg : 'Не удалось найти пользователя [' + steamid64[2] + ']'
        });


        user.username = parseResult[0].personaname;
        user.avatar = parseResult[0].avatarfull;
        user.method = 'steam';
    }

    let bot = await Bots.create({
        username : user.username,
        avatar : user.avatar,
        method : user.method,
        vip : false,
        time : 0,
        count : 0,
        active : false
    });

    bot = bot.get({plain:true});

    return res.json({
        success : true,
        msg : 'Пользователь ' + user.username + ' добавлен! [' + user.method + ']',
        id : bot.id
    });
});

Route.post('/bots/save', async(req, res) => {
    let bot = await Bots.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!bot) return res.json({
        success : false,
        msg : 'Не удалось найти бота #' + req.body.id
    });

    await Bots.update(req.body, {
        where : {
            id : req.body.id
        }
    });

    return res.json({
        success : true,
        msg : 'Бот #' + req.body.id + ' сохранен!'
    });
});

Route.post('/setJackpotWinner', async(req, res) => {
    let isFake = (parseInt(req.body.id) < 0) ? true : false,
        UserID = Math.abs(parseInt(req.body.id));

    let user = (!isFake) ? await Users.findOne({
        where: {
            id: UserID
        }
    }) : await Bots.findOne({
        where: {
            id: UserID
        }
    })
    
    if(!user) return res.json({
        success : false,
        msg : 'Не удалось найти пользователя #' + req.body.id
    });
    
    let game = await Jackpot.findOne({
        order : [['id', 'desc']]
    });
    
    if(game.status > 1) return res.json({
        success : false,
        msg : 'Прокрутка уже началась!'
    });
    
    let bets = await JackpotBets.findAll({
        where: {
            game_id: game.id
        },
        order: [['id', 'asc']]
    });

    let from = 0, to = 0, userBets = [];
    for(let i in bets)
    {
        from = to+1;
        to = from + (bets[i].amount*100);
        bets[i].from = from;
        bets[i].to = to;
        if(bets[i].fake == isFake && bets[i].user_id == UserID) userBets.push(bets[i]);
    }

    if(userBets.length < 1) return res.json({
        success: false,
        msg: 'Нет ставок от этого игрока!'
    });

    let winnerBet = userBets[Math.floor(Math.random()*userBets.length)];
    let winnerTicket = Math.floor(Math.random()*(winnerBet.to-winnerBet.from))+winnerBet.from;

    if(winnerBet === null && winnerTicket === false) return res.json({
        success: false,
        msg: 'Неизвестная ошибка!'
    });
    
    let t = await getTransaction();
    try {
        await Jackpot.update({
            winner_ticket : winnerTicket
        }, {
            where : {
                id : game.id
            },
            transaction : t
        });
        
        await t.commit();
    } catch(e) {
        await t.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!'
        });
    }
    
    return res.json({
        success : true,
        msg : user.username + ' победит в игре #' + game.id + '. Билет #' + winnerTicket
    });
});

Route.post('/promo/save', async(req, res) => {
    let promo = await Promo.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!promo) return res.json({
        success : false,
        msg : 'Не удалось найти промокод #' + req.body.id
    });

    await Promo.update(req.body, {
        where : {
            id : req.body.id
        }
    });

    return res.json({
        success : true,
        msg : 'Промокод «'+promo.promo+'» сохранен!'
    });
});

Route.post('/promo/delete', async(req, res) => {
    let promo = await Promo.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!promo) return res.json({
        success : false,
        msg : 'Не удалось найти промокод #' + req.body.id
    });

    await Promo.destroy({
        where : {
            id : promo.id
        }
    });

    return res.json({
        success : true,
        msg : 'Промокод «'+promo.promo+'» удален!'
    });
}); 

Route.post('/cancelWithdraw', async(req, res) => {
    let order = await Withdraw.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!order) return res.json({
        success : false,
        msg : 'Не удалось найти вывод #' + req.body.id
    });

    if(order.status != 0) return res.json({
        success : false,
        msg : 'Этот вывод уже обработан [' + ((order.status == 1) ? 'Одобрен' : 'Октлонен') + ']'
    });

    let t = await getTransaction();

    try {
        await Withdraw.update({
            status : 2
        }, {
            where : {
                id : order.id
            },
            transaction : t
        });

        await Users.update({
            balance : Sequelize.literal('"balance"+'+order.price)
        }, {
            where : {
                id : order.user_id
            },
            transaction : t
        });

        sendToUser(order.user_id, {
            type : 'withdraw_update',
            w : await Withdraw.findOne({
                where : {
                    id : order.id
                },
                transaction : t
            })
        });

        let user = await Users.findOne({
            where : {
                id : order.user_id
            },
            transaction : t
        });

        sendToUser(user.id, {
            type : 'balance',
            balance : user.balance
        });

        await t.commit();
    } catch(e) {
        console.log(e);
        await t.rollback();
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!'
        });
    }

    return res.json({
        success : true,
        msg : 'Вывод #' + order.id + ' успешно отклонен!'
    });
});

Route.post('/acceptWithdraw', async(req, res) => {
    let order = await Withdraw.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!order) return res.json({
        success : false,
        msg : 'Не удалось найти вывод #' + req.body.id
    });

    let AcceptApi = (req.body.acceptApi === 'false') ? false : true;


    try {
        if(AcceptApi) {
            let result = await _fkSend(order);
            if(result.success)
            {
                order.info.paymentid = result.id;
                await Withdraw.update({
                    status : 1,
                    info : order.info
                }, {
                    where : {
                        id : order.id
                    }
                });
            } else {
                return res.json({
                    success : false,
                    msg : 'Ошибка при выводе : ' + result.error
                });
            }
        } else {
            await Withdraw.update({
                status : 1,
                info : order.info
            }, {
                where : {
                    id : order.id
                }
            });
        }
    } catch(e) {
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!'
        });
    }
    
    // let t = await getTransaction();


    // try {
    //     await Withdraw.update({
    //         status : 1
    //     }, {
    //         where : {
    //             id : order.id
    //         },
    //         transaction : t
    //     });

    //     sendToUser(order.user_id, {
    //         type : 'withdraw_update',
    //         w : await Withdraw.findOne({
    //             where : {
    //                 id : order.id
    //             }
    //         })
    //     });

    //     await t.commit();
    // } catch(e) {
    //     console.log(e);
    //     await t.rollback();
    //     return res.json({
    //         success : false,
    //         msg : 'Что-то пошло не так!'
    //     });
    // }

    return res.json({
        success : true,
        msg : 'Вывод #' + order.id + ' одобрен! Транзакция #' + order.info.paymentid
    });
});

Route.post('/settingsSave', async(req, res) => {
    let cfg = await execConfig();
    try {
        await Config.update(req.body, {
            where : {
                id : cfg.id
            }
        });
    } catch(e) {
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!'
        });
    }

    return res.json({
        success : true,
        msg : 'Настройки успешно сохранены!'
    });
});

Route.post('/patterns', async(req, res) => {
    let patterns = adminPatterns;
        patterns.user = req.user;
    return res.json({
        code : 200,
        patterns : patterns
    });
});

Route.post('/promo/create', async(req, res) => {
    let promo = await Promo.findOne({
        where : {
            promo : req.body.promo,
            status : 0
        }
    });

    if(promo) return res.json({
        success : false,
        msg : 'Промокод «'+req.body.promo+'» уже существует!'
    });

    await Promo.create({
        promo : req.body.promo,
        amount : req.body.amount,
        count : req.body.count,
        users : []
    });

    return res.json({
        success : true,
        msg : 'Создали промокод «'+req.body.promo+'»'
    });
});

Route.post('/render', async(req, res) => {
    let resp = await adminRender(req.user, req.body.path, req.body.id);
    return res.json(resp);
});

Route.post('/user/save', async(req, res) => {
    let user = await Users.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!user) return res.json({
        success : false,
        msg : 'Не удалось найти пользователя #' +  req.body.id
    });

    await Users.update({
        balance : req.body.balance,
        is_admin : req.body.is_admin,
        vip : req.body.vip,
        youtube : {
            active : (req.body.youtube_active == 'true') ? true : false,
            href : req.body.youtube_href
        },
        ban : {
            active : (req.body.ban_active == 'true') ? true : false,
            reason : req.body.ban_reason
        }
    }, {
        where : {
            id : req.body.id
        }
    });

    if(!user.ban.active && ((req.body.ban_active == 'true') ? true : false)) await sendToUser(user.id, {
        type : 'message',
        msg : {
            success : false,
            msg : 'Вы были заблокированы. Причина : ' + req.body.ban_reason,
            msg_en : 'You have been blocked. Reason :' + req.body.ban_reason
        }
    });

    if(user.ban.active && !((req.body.ban_active == 'true') ? true : false)) await sendToUser(user.id, {
        type : 'message',
        msg : {
            success : true,
            msg : 'Вы были разблокированы.',
            msg_en : 'You have been unblocked.'
        }
    });

    await sendToUser(user.id, {
        type : 'balance',
        balance  : parseFloat(req.body.balance)
    });

    return res.json({
        success : true,
        msg : 'Пользователь ' + user.username + ' сохранен!'
    });
});

module.exports = Route;