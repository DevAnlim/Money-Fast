const Route = require('express').Router();
const {Users, getTransaction, Dice, Op, Chat, Crash, CrashBets, Promo, Payments, Sequelize, Withdraw, Sends, execConfig, Config, Jackpot, Items, GiveawayHour} = require('../app/database');
const {RenderList} = require('../app/middleware');
const {reactPaths, getPattern, calcComission, shuffle, toUSD} = require('../app/helpers');
const {Today, Week} = require('../app/date');
const {sendAll, sendToUser, sendToAdmin} = require('../app/websocket');
const Crypto = require('crypto');
const render = require('../app/render');
const {isMember, hasRepost, isMember2} = require('../app/vk');
const {auth} = require('../app/middleware');
const {CaptchaVerify} = require('../app/captcha');
const {activeTrades} = require('../app/market');
const {site} = require('../config');
const {plus} = require('../app/profit');

Route.get('/ebabki', (req, res) => {
    return res.sendFile('/var/www/ebabki/ebabki.zip');
});

async function initReact() {
    let config = await execConfig();
    console.log(config.keywords);
    for(var i in reactPaths) Route.get((reactPaths[i] == 'jackpot') ? '/' : ('/' + reactPaths[i]), auth, async(req, res) => {
        return res.render('layout', {
            descriptions : config.descriptions,
            keywords : config.keywords,
            domain : site.domain,
            ssl : (site.enableSSL) ? 1 : 0
        });
    });
}

initReact();

Route.get('/navigator', async(req, res) => {
    console.log(req);
    return res.json({
        userAgent : req.headers['user-agent']
    });
});

Route.post('/render', RenderList, async(req, res) => {
    return res.json({
        code : 200,
        path : req.body.path,
        pattern : await render.get(req.body.path, req.user)
    });
});

Route.get('/t', async(req, res) => {
    let game = await Crash.findOne({
        order : [['id', 'desc']]
    });
    let sceneStart = (Math.floor(game.id/10)*10),
        schema = {
            '1' : 1,
            '1.0x' : 2,
            '1.xx' : 5,
            'rand' : 3
        }
    let lastRounds = await Crash.findAll({
        where : {
            status : 2,
            id : {
                [Op.gte] : sceneStart
            }
        }
    });
    let lastOne = await Crash.findOne({
        where : {
            status : 2,
            number : 1,
            id : {
                [Op.gte] : sceneStart
            }
        }
    });

    // for(var i in lastRounds)
    // {
    //     if(lastRounds[i].number == 1) schema['1']--;
    //     if(lastRounds[i].number > 1 && lastRounds[i].number < 2) schema['1.xx']--;
    //     if(lastRounds[i].number > 2) schema['rand']--;
    //     if(lastRound[i].number > 1 && lastRounds[i].number < 1.11) schema['1.0x']--;
    // }

    let list = [];
    for(var i in schema) for(var u = 0; u < schema[i]; u++) 
    {
        if(i == '1') list.push(1);
        if(i == '1.xx') list.push(parseFloat('1.'+Math.floor(Math.random()*10)+Math.floor(Math.random()*10)));
        if(i == '1.0x') list.push(parseFloat('1.0'+Math.floor(Math.random()*10)));
        if(i == 'rand') 
        {
            let numList = [100];
            for(let x = 0; x < 10; x++) numList.push(20);
            for(let x = 0; x < 89; x++) numList.push(5);
            // numList = shuffle(numList)[Math.floor(Math.random()*numList.length)];
            list.push(parseFloat((Math.floor(Math.random()*shuffle(numList)[Math.floor(Math.random()*numList.length)])+2)+'.'+Math.floor(Math.random()*10)+Math.floor(Math.random()*10)));
        }
    }

    return res.json(shuffle(list));

    return res.json(schema);
});

Route.post('/bonus/reg', auth, async(req, res) => {
    if(req.user.method != 'vkontakte') return res.json({
        success : false,
        msg : 'Вы должны войти через VK',
        msg_en : 'You must log in via VKontakte'
    });

    let game = await GiveawayHour.findOne({
        where: {
            status: 0
        }
    });

    if(!game) return res.json({
        success: false,
        msg: 'Не удалось найти последнюю раздачу!',
        msg_en: 'Could not find the last giveaway!'
    });

    for(let i in game.users) if(game.users[i].id == req.user.id) return res.json({
        success: false,
        msg: 'Вы уже участвуете в розыгрыше!',
        msg_en: 'You already participate in the giveaway!'
    });

    game.users.push({
        id: req.user.id,
        user: {
            username: req.user.username,
            avatar: req.user.avatar
        }
    });

    let deps = await Payments.sum('amount', {
        where : {
            user_id : req.user.id,
            type : 1,
            status : 1,
            updatedAt: {
                [Op.gte]: Week()
            }
        }
    }) || 0;

    // if(deps < 100) return res.json({
    //     success : false,
    //     msg: 'Вы пополнили меньше 100 рублей за неделю!',
    //     msg_en: 'You replenished less than '+(await toUSD(100, 2))+' USD per week!'
    // });

    let groups = ['ebabkivk', 'ebaboi', 'ebasmeh'];

    for(let i in groups)
    {
        let member = await isMember2(req.user.second_id, req.user.access_token, groups[i]);
        if(!member.success) return res.json(member);
        if(!member.result) return res.json({
            success : false,
            msg : 'Вы вступили не во все группы!',
            msg_en : 'You did not join all groups!'
        });
    }

    await GiveawayHour.update({
        users: game.users
    }, {
        where: {
            id: game.id
        }
    });

    return res.json({
        success: true,
        msg: 'Вы зарегистрированы в раздаче!',
        msg_en: 'Are you registered in giveaway!'
    });
    
});

Route.post('/getBonus', auth, CaptchaVerify, async(req, res) => {
    if(req.user.method != 'vkontakte') return res.json({
        success : false,
        msg : 'Вы должны войти через VK',
        msg_en : 'You must log in via VK'
    });

    if(req.user.bonus.lastUsage > new Date().getTime())
    {
        let time = req.user.bonus.lastUsage-new Date().getTime();

        let iHours = Math.floor(time/(60*60*1000));
        let iMinutes = Math.floor((time-(iHours*60*60*1000))/(60*1000));

        return res.json({
            success : false,
            msg : 'Следующий бонус вы сможете получить через ' + iHours + 'ч. ' + iMinutes + 'мин.',
            msg_en : 'The next bonus you can get through ' + iHours + 'h. ' + iMinutes + 'm.'
        });
    }

    let t = await getTransaction();

    try {
        let groups = ['ebabkivk', 'ebaboi', 'ebasmeh'];

        for(let i in groups)
        {
            let member = await isMember2(req.user.second_id, req.user.access_token, groups[i]);
            if(!member.success) return res.json(member);
            if(!member.result) return res.json({
                success : false,
                msg : 'Вы вступили не во все группы!',
                msg_en : 'You did not join all groups!'
            });
        }

        let repost = await hasRepost(req.user.second_id, req.user.access_token);
        if(!repost.success && !repost.result) return res.json({
            success: false,
            msg: 'Что-то пошло не так!',
            msg_en: 'Something went wrong!'
        });
        if(!repost.success) return res.json(repost);
        if(!repost.result) return res.json({
            success : false,
            msg : 'Вы не сделали репост записи!',
            msg_en : 'You did not repost!'
        });

        req.user.bonus.lastUsage = new Date().getTime()+(24*60*60*1000);
        req.user.bonus.price += Math.floor(req.user.lvl);

        await Users.update({
            balance : Sequelize.literal('"balance"+' + Math.floor(req.user.lvl)),
            bonus : req.user.bonus
        }, {
            where : {
                id : req.user.id
            }
        });

        let payment = await Payments.create({
            user_id : req.user.id,
            amount : Math.floor(req.user.lvl),
            order : await Payments.count()+1,
            info : {
                email : '',
                phone : '',
                method : 'bonus',
                sign : '',
                intid : ''
            },
            status : 1
        });

        sendToUser(req.user.id, {
            type : 'pay',
            payment : payment.get({plain:true})
        });

        await t.commit();
    } catch(e) {
        await t.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!',
            msg_en : 'Something went wrong!'
        });
    }

    return res.json({
        success : true,
        msg : 'Вы получили '+Math.floor(req.user.lvl)+' руб. на ваш баланс!',
        msg_en : 'You received ' + (await toUSD(Math.floor(req.user.lvl), 2)) + ' USD to your balance!',
        balance : req.user.balance+Math.floor(req.user.lvl)
    });
});

Route.post('/verify', auth, CaptchaVerify, async(req, res) => {
    if(req.user.method != 'vkontakte') return res.json({
        success : false,
        msg : 'Вы должны войти через VK',
        msg_en : 'You must log in via VKontakte'
    });

    let groups = ['ebabkivk', 'ebaboi', 'ebasmeh'];

    for(let i in groups)
    {
        let member = await isMember2(req.user.second_id, req.user.access_token, groups[i]);
        if(!member.success) return res.json(member);
        if(!member.result) return res.json({
            success : false,
            msg : 'Вы вступили не во все группы!',
            msg_en : 'You did not join all groups!'
        });
    }

    let repost = await hasRepost(req.user.second_id, req.user.access_token, '-170688525_9');
    if(!repost.success) return res.json(repost);
    if(!repost.result) return res.json({
        success : false,
        msg : 'Вы не сделали репост записи!',
        msg_en : 'You did not repost!'
    });

    // await Users.update({
    //     verify : true
    // }, {
    //     where : {
    //         id : req.user.id
    //     }
    // });

    return res.json({
        success : true,
        msg : 'Проверка прошла успешно!'
    });
});

Route.post('/activeRef', auth, async(req, res) => {
    if(req.user.method != 'vkontakte') return res.json({
        success : false,
        msg : 'Вы должны войти через VK',
        msg_en : 'You must log in via VK'
    });
    
    if(req.body.code.length < 3) return res.json({
        success : false,
        msg : 'Такого кода не существует!',
        msg_en : 'This code does not exist!'
    });

    let owner = await Users.findOne({
        where : {
            ref_code : req.body.code
        }
    });

    // promo
    if(!owner) 
    {
        let promo = await Promo.findOne({
            where : {
                promo : req.body.code,
                status : 0
            }
        });

        if(!promo) return res.json({
            success : false,
            msg : 'Такого кода не существует!',
            msg_en : 'This code does not exist!'
        });

        let found = false;
        for(let u in promo.users) if(promo.users[u] == req.user.id) found = true;
        if(found) return res.json({
            success : false,
            msg : 'Вы уже активировали промокод «'+promo.promo+'»',
            msg_en : 'You have already activated the promocode «'+promo.promo+'»'
        });

        promo.users.push(req.user.id);
        if(promo.users.length >= promo.count) promo.status = 1;

        await Promo.update({
            users : promo.users,
            status : promo.status
        }, {
            where : {
                id : promo.id
            }
        });

        await Users.update({
            balance : req.user.balance + promo.amount
        }, {
            where : {
                id : req.user.id
            }
        });

        let payment = await Payments.create({
            user_id : req.user.id,
            amount : promo.amount,
            order : await Payments.count()+1,
            info : {
                phone : null,
                email : null,
                method : 'promo',
                sign : null
            },
            status : 1
        });

        sendToUser(req.user.id, {
            type : 'pay',
            payment : payment.get({plain:true})
        });



        return res.json({
            success : true,
            msg : 'Вы активировали промокод «'+promo.promo+'» и получили ' + promo.amount + 'р. на ваш счет!',
            msg_en : 'You activated the promocode «'+promo.promo+'» and got ' + (await toUSD(promo.amount, 2)) + ' USD. to your account!',
            type : 'promo',
            balance : parseFloat((req.user.balance+promo.amount).toFixed(2))
        });
    }

    // if(owner.id == req.user.id) return res.json({
    //     success : false,
    //     msg : 'Вы не можете активировать свой реферальный код!'
    // });

    if(req.user.ref !== null && req.user.ref.length != 0) return res.json({
        success : false,
        msg : 'Вы уже активировали реферальный код!',
        msg_en : 'You have already activated the referral code!'
    });

    await Users.update({
        ref : req.body.code,
        balance : Sequelize.literal('"balance"+5')
    }, {
        where : {
            id : req.user.id
        }
    });

    let payment = await Payments.create({
        user_id : req.user.id,
        amount : 5,
        order : await Payments.count()+1,
        info : {
            phone : null,
            email : null,
            method : 'ref',
            sign : null
        },
        status : 1
    });

    sendToUser(req.user.id, {
        type : 'pay',
        payment : payment.get({plain:true})
    });

    owner.refs.count++;
    await Users.update({
        refs : owner.refs
    }, {
        where : {
            id : owner.id
        }
    });

    sendToUser(owner.id, {
        type : 'update_refs',
        refs : owner.refs.count,
        owner : owner.id
    });

    sendToUser(owner.id, {
        type : 'message',
        user : owner.id,
        msg : {
            success : true,
            msg : req.user.username + ' активировал ваш реферальный код!',
            msg_en : req.user.username + ' activated your referral code!'
        }
    });

    return res.json({
        success : true,
        msg : 'Вы активировали реферальный код игрока «'+owner.username+'»',
        msg_en : 'You activated the player referral code «'+owner.username+'»',
        code : req.body.code,
        type : 'ref',
        balance : req.user.balance+5
    });
});

Route.post('/patterns', async(req, res) => {
    let pattern = await render.patterns(false, false, req.cookies.lang || false);

    if(req.user) pattern.activeTrades = await activeTrades(req.user.id);

    return res.json(pattern);
});

Route.post('/fair', auth, async(req, res) => {
    // dice check
    let dice = await Dice.findOne({
        where : {
            hash : req.body.hash
        }
    });

    let crash = await Crash.findOne({
        where : {
            status : 2,
            hash : req.body.hash
        }
    });

    let jackpot = await Jackpot.findOne({
        where : {
            status : 3,
            hash : req.body.hash
        }
    });

    if(!dice && !crash && !jackpot) return res.json({
        success : false,
        msg : 'Не удалось найти игру с таким хэшем!',
        msg_en : 'Could not find a game with such a hash!'
    });

    let {id, number} = 0;
    if(dice)
    {
        id = dice.id;
        number = dice.number.toFixed(2);
    } else if(crash) {
        id = crash.id;
        number = crash.number.toFixed(2);
    } else if(jackpot) {
        id = jackpot.id;
        number = jackpot.winner_ticket;
    }

    return res.json({
        success : true,
        result : {
            id : id,
            number : number
        }
    });
});

Route.post('/withdraw', auth, async(req, res) => {
    if(req.user.balance < req.body.amount) return res.json({
        success : false,
        msg : 'Недостаточно баланса!',
        msg_en : 'Not enough balance!'
    });

    let config = await execConfig();

    let deps = await Payments.sum('amount', {
        where : {
            user_id : req.user.id,
            type : 1,
            status : 1
        }
    }) || 0;

    if(deps < config.dep_before_withdraw) return res.json({
        success : false,
        msg : 'Вывод доступен после депозита в ' + config.dep_before_withdraw + 'руб.',
        msg_en : 'Withdrawal is available after deposit in ' + (await toUSD(config.dep_before_withdraw, 2)) + ' USD.'
    });

    let t = await getTransaction();

    try {

        let w = await Withdraw.create({
            user_id : req.user.id,
            user : {
                username : req.user.username,
                avatar : req.user.avatar
            },
            info : {
                amount : req.body.amount,
                wallet : req.body.wallet,
                paymentid : null
            },
            amount : calcComission(req.body.method, req.body.amount),
            price : req.body.amount,
            method : req.body.method,
        }, {
            transaction : t
        });

        await Users.update({
            balance : Sequelize.literal('"balance"-' + req.body.amount)
        }, {
            where : {
                id : req.user.id
            },
            transaction : t
        });

        await t.commit();

        w = w.get({
            plain : true
        });

        sendToUser(req.user.id, {
            type : 'withdraw',
            w : {
                id : w.id,
                user_id : w.user_id,
                user : w.user,
                info : w.info,
                amount : w.amount,
                method : w.method,
                status : w.status,
                canceling : false
            }
        });

        sendToAdmin({
            type : 'withdraw'
        });

        sendToUser(req.user.id, {
            type : 'balance',
            user : req.user.id,
            balance : parseFloat((req.user.balance-parseFloat(req.body.amount)).toFixed(2))
        });
    } catch(e) {
        await t.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!',
            msg_en : 'Something went wrong!'
        });
    }

    return res.json({
        success : true,
        msg : req.body.amount + 'руб. отправлены на вывод!',
        msg_en :  (await toUSD(req.body.amount, 2)) + ' USD sent to cashout!'
    });
});

Route.post('/withdraw/cancel', auth, async(req, res) => {
    let order = await Withdraw.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!order) return res.json({
        success : false,
        msg : 'Не удалось найти вывод #' + req.body.id,
        msg_en : 'Could not find cashout #' + req.body.id
    });

    if(order.status != 0) return res.json({
        success : false,
        msg : 'Этот вывод уже обработан [' + ((order.status == 1) ? 'Одобрен' : 'Отклонен') + ']',
        msg_en : 'This cashout has already been processed. [' + ((order.status == 1) ? 'Approved' : 'Rejected') + ']'
    });

    let t = await getTransaction();

    try {
        await Users.update({
            balance : Sequelize.literal('"balance"+'+order.info.amount)
        }, {
            where : {
                id : order.user_id
            },
            transaction : t
        });

        await Withdraw.update({
            status : 2
        }, {
            where : {
                id : order.id
            },
            transaction : t
        });

        await t.commit();

        sendToUser(order.user_id, {
            type : 'withdraw_update',
            w : await Withdraw.findOne({
                where : {
                    id : order.id
                }
            })
        });

        let user = await Users.findOne({
            where : {
                id : order.user_id
            }
        });

        sendToUser(order.user_id, {
            type : 'balance',
            user : order.user_id,
            balance : user.balance
        });
    } catch(e) {
        await t.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Что-то пошло не так',
            msg_en : 'Something went wrong'
        });
    }

    return res.json({
        success : true,
        msg : 'Вывод #' + order.id + ' отменен. На ваш баланс зачислено ' + order.info.amount + ' руб.',
        msg_en : 'Cashout #' + order.id + ' rejected. Credited to your balance ' + (await toUSD(order.info.amount,2)) + ' USD.'
    });
});

Route.post('/send', auth, async(req, res) => {

    if(!req.user.vip) return res.json({
        success : false,
        msg : 'Перевод доступен только для вип игроков!',
        msg_en : 'Money transactions is available only for VIP players!'
    });

    let target = await Users.findOne({
        where : {
            id : req.body.target
        }
    });

    if(!target) return res.json({
        success : false,
        msg : 'Пользователь #' + req.body.target + ' не найден!',
        msg_en : 'User #' + req.body.target + ' does not exist!'
    });

    let cfg = await execConfig();

    let deps = await Payments.sum('amount', {
        where : {
            user_id : req.user.id,
            type : 1,
            status : 1
        }
    }) || 0;

    if(deps < cfg.dep_before_send) return res.json({
        success : false,
        msg : 'Перевод доступен после депозита в ' + cfg.dep_before_send + 'руб.',
        msg_en : 'Money transactions is available after deposit in ' + (await toUSD(cfg.dep_before_send, 2)) + ' USD.'
    });

    let sendPrice = parseFloat(req.body.price) || 0,
        price = parseFloat((sendPrice*(1+(cfg.send_comission/100))).toFixed(2)) || 0;

    if((req.body.currency == 'ru' && sendPrice < cfg.send_min) || (req.body.currency && sendPrice < ((parseFloat((await toUSD(cfg.send_min, 2)).replace('$', ''))*cfg.usd)))) return res.json({
        success : false,
        msg : 'Минимальная сумма перевода - '+cfg.send_min+' рублей',
        msg_en : 'Minimum transfer amount - ' + (await toUSD(cfg.send_min, 2))
    });

    if(req.user.balance < price) return res.json({
        success : false,
        msg : 'Недостаточно баланса!',
        msg_en : 'Not enough balance!'
    });

    // проверка на бан юзера

    await Sends.create({
        user_id : req.user.id,
        target_id : target.id,
        target : {
            username : target.username,
            avatar : target.avatar
        },
        amount : sendPrice,
        comission : parseFloat((price-sendPrice).toFixed(2))
    });

    await plus(parseFloat((price-sendPrice).toFixed(2)), 'send');

    // снимаем баланс с юзера
    await Users.update({
        balance : parseFloat((req.user.balance-price).toFixed(2))
    }, {
        where : {
            id : req.user.id
        }
    });

     // обновляем таргета
     await Users.update({
         balance : parseFloat((target.balance+sendPrice).toFixed(2))
     }, {
         where : {
             id : target.id
         }
     });

     // отправляем уведомление таргету о том, что его баланс был изменен. Так же обновляем баланс
     sendToUser(target.id, {
         type : 'balance',
         user : target.id,
         balance : parseFloat((target.balance+sendPrice).toFixed(2))
     });

     sendToUser(target.id, {
         type : 'message',
         user : target.id,
         msg : {
             success : true,
             msg : req.user.username + ' перевел вам ' + sendPrice.toFixed(2) + ' рублей',
             msg_en : req.user.username + ' send you ' + (await toUSD(sendPrice, 2)) + ' USD',
         }
     });

     // отправляем коммиссию в админку
     sendAll({
         type : 'comission',
         from : 'send',
         value : (price-sendPrice)
     });

     return res.json({
         success : true,
         msg : 'Вы перевели ' + sendPrice + ' игроку ' + target.username,
         msg_en : 'You transfered ' + (await toUSD(sendPrice,2)) + ' to ' + target.username,
         balance : parseFloat((req.user.balance-sendPrice).toFixed(2))
     });
});

Route.get('/clear', async(req, res) => {
    return res.render('pages/clear');
});

module.exports = Route;