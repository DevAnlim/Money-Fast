const Route = require('express').Router();
const {buyFor, constructTrade, resetItems} = require('../app/market');
const {sendTrade, parseInventory, sendReceiveTrade} = require('../app/opskins');
const {Items, Users, getTransaction, Sequelize, execConfig, Payments} = require('../app/database');
const {sendAll, sendToUser, sendToAdmin} = require('../app/websocket');
const {getCurrency, toUSD} = require('../app/helpers');
const {auth} = require('../app/middleware');

Route.use(auth);

Route.post('/vgo/send', async(req, res) => {
    let items = JSON.parse(req.body.items);

    let result = await sendReceiveTrade({
        user : req.user.id,
        items : JSON.parse(req.body.items),
        steamid64 : req.body.steamid64
    });

    if(!result || typeof result == 'string') return res.json({
        success : false,
        msg : 'Ошибка при отправке обмена'+ ((!result) ? '!' : ' : ' + result),
        msg_en : 'Error when sending offer' + ((!result) ? '!' : ' : ' + result)
    });

    return res.json({
        success : true,
        msg : 'Обмен отправлен!',
        msg_en : 'Offer sent!'
    });
});

Route.post('/vgo/parse', async(req, res) => {
    let inv = await parseInventory(req.body.steamid64);
    if(!inv) return res.json({
        success : false,
        msg : 'Попробуйте позже..',
        msg_en : 'Try later...'
    });


    let list = [], key = 0;

    let cfg = await execConfig();

    for(let i in inv) 
    {
        list.push({
            appid : 'vgo',
            id : inv[i].item_id,
            classid : 'vgo',
            instanceid : inv[i].item_id,
            market_hash_name : inv[i].name,
            icon_url : inv[i].img,
            float : inv[i].float || 'not found',
            price : parseFloat(((inv[i].price*0.95)*cfg.usd).toFixed(2)) || 0,
            active : false,
            selected : false,
            key : key
        });

        key++;
    }


    return res.json({
        success : true,
        inv : list,
        id : req.body.steamid64
    });
});

Route.post('/cancel', async(req, res) => {
    let trade = await constructTrade(req.body.id);
    let delivery = 0;
    if(trade.appid == 'real') delivery = 300;

    if(trade.user.id != req.user.id) return res.json({
        success : false,
        msg : 'Вы не являетесь владельцем оффера!',
        msg_en : 'You are not the owner of the offer!'
    });

    for(let i in trade.itemsStatus) if(trade.itemsStatus[i] != 1) return res.json({
        success : false,
        msg : 'Один или несколько предметов отправляются, либо же не были одобрены!',
        msg_en : 'One or more items are sending or have not been accepted!'
    });

    await Items.update({
        status : 6
    }, {
        where : {
            withdraw : parseInt(trade.id)
        }
    });

    await Users.update({
        balance : Sequelize.literal('"balance"+'+(trade.price+delivery))
    }, {
        where : {
            id : trade.user.id
        }
    });

    sendToUser(req.user.id, {
        type : 'update_skins',
        offer: await constructTrade(parseInt(trade.id))
    });

    let user = await Users.findOne({
        where : {
            id : trade.user.id
        }
    });

    sendToUser(req.user.id, {
        type : 'balance',
        balance : user.balance
    });

    let resItems = await resetItems(parseInt(trade.id));

    return res.json({
        success : true,
        msg : 'Вывод #' + trade.id + ' был отменен! На ваш баланс зачислено ' + (trade.price+delivery) + ' руб.',
        msg_en : 'Conclusion #' + trade.id + 'has been canceled! On your balance credited '+ (await toUSD((trade.price+delivery), 2)) +' USD.'
    });
});

Route.post('/send', async(req, res) => {
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

    let items = await Items.findAll({
        where : {
            owner_id : req.user.id,
            withdraw : req.body.id
        }
    });

    let game = 'vgo';
    if(parseInt(items[0].appid) == 730) game = 'csgo';
    if(parseInt(items[0].appid) == 540) game = 'dota2';

    let trade = {
        items : [],
        game : game,
        trade : items[0].trade,
        user : {
            id : req.user.id
        },
        withdraw : items[0].withdraw
    }

    for(let i in items) 
    {
        if(items[i].status >= 3) return res.json({
            success : false,
            msg : 'Этот обмен был отправлен!',
            msg_en : 'This trade has been sent!'
        });

        if(parseInt(items[i].appid) == 540) return res.json({
            success : false,
            msg : 'Вы не можете забирать предметы из игры Dota2!',
            msg_en : 'You can not pick up items from the game Dota2!'
        });

        trade.items.push({
            dbid : items[i].id,
            id : items[i].itemid,
            market_hash_name : items[i].market_hash_name,
            price : items[i].price,
            withdraw : items[i].withdraw
        });
    }

    let result = false;
    if(game == 'csgo') result = await buyFor(trade);
    if(game == 'vgo') result = await sendTrade(trade);

    if(!result || typeof result == 'string') return res.json({
        success : false,
        msg : 'Ошибка при отправке обмена '+ ((!result) ? '!' : ' : ' + result),
        msg_en : 'Error when sending offer ' + ((!result) ? '!' : ' : ' + result)
    });

    if(result)
    {
        for(let i in items) await Items.update({
            status : 3
        }, {
            where : {
                id : items[i].id
            }
        });
    }

    sendToUser(req.user.id, {
        type : 'update_skins',
        offer: await constructTrade(items[0].withdraw)
    });

    return res.json({
        success : true,
        msg : 'Отправляем..',
        msg_en : 'Sending..'
    });
});

Route.post('/buy', async(req, res) => {
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

    let items = JSON.parse(req.body.items) || [],
        trade = JSON.parse(req.body.trade) || false;

    if(items.length < 1) return res.json({
        success : false,
        msg : 'Вы не выбрали предметы!',
        msg_en : 'You have not selected items!'
    });

    if(!trade) return res.json({
        success : false,
        msg : 'Не удалось определить ваши данные для передачи!',
        msg_en : 'Could not determine your data to transfer!'
    });

    let transaction = await getTransaction();
    let delivery = 0;

    let closed = [], total = 0, balance = false, withdrawID = false, isActiveTrade = false;
    try {
        for(let i in items)
        {
            let item = await Items.findOne({
                where : {
                    id : items[i].id,
                    appid : req.body.appid.toString(),
                    status : 0
                },
                transaction : transaction
            });

            if(!item || item.status > 0) closed.push(items[i].id); else total += item.price;
        }

        if(closed.length > 0) 
        {
            await transaction.rollback();
            return res.json({
                success : false,
                msg : 'Не удалось найти ' + closed.length + ' предмет(ов) из вашей корзины!',
                msg_en : 'Could not find ' + closed.length + ' item(s) from your cart!',
                closed : true,
                list : closed
            });
        }

        let user = await Users.findOne({
            where : {
                id : req.user.id
            },
            transaction : transaction
        });

        balance = user.balance; // :D

        if(user.balance < total) 
        {
            await transaction.rollback();
            return res.json({
                success : false,
                msg : 'Недостаточно баланса!',
                msg_en : 'Not enough balance!',
                total : total
            });
        }

        let UserWithdraw = await Items.findOne({
            where : {
                owner_id : user.id,
                status : 1,
                appid : req.body.appid
            },
            order : [['withdraw', 'desc']],
            transaction : transaction
        });

        let withID = (UserWithdraw) ? UserWithdraw.withdraw : false;

        if(req.body.appid == 'real') withID = false;

        if(!withID)
        {
            let withdraw = await Items.findOne({
                order : [['withdraw', 'desc']]
            });
    
            withID = (withdraw) ? withdraw.withdraw+1 : 1;
        } else {
            // активный вывод
            isActiveTrade = true;
        }

        withdrawID = withID;

        for(let i in items)
        {
            console.log(items[i].mhn);
            await Items.update({
                status : 1,
                owner_id : user.id,
                withdraw : withID,
                trade : trade,
                mhn: items[i].mhn
            }, {
                where : {
                    id : items[i].id
                },
                transaction : transaction
            });
            closed.push(items[i].id);
        }


        if(req.body.appid == 'real')
        {
            delivery = 300; // стоимость доставки

            // минимальная сумма 3к
            if(total < 3000)
            {
                await transaction.rollback();
                return res.json({
                    success: false,
                    msg: 'Минимальная сумма вывода - 3000руб',
                    msg_en : 'Minimum withdrawal amount - ' + (await toUSD(3000, 2))
                });
            }
        } else {
            delivery = 0;
        }


        await Users.update({
            balance : Sequelize.literal('"balance"-' + (total + delivery))
        }, {
            where : {
                id : user.id
            },
            transaction : transaction
        });

        await transaction.commit();
    } catch(e) {
        await transaction.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!',
            msg_en : 'Something went wrong!'
        });
    }

    if(balance !== false) sendToUser(req.user.id, {
        type : 'balance',
        balance : balance-(total+delivery)
    });

    sendToUser(req.user.id, {
        type : 'update_skins',
        offer: await constructTrade(withdrawID)
    });

    sendToAdmin({
        type : 'withdraw'
    });

    return res.json({
        success : true,
        msg : 'Ваш вывод отправлен на модерацию! ' + ((isActiveTrade) ? ' Ваши предметы добавлены к выводу #' + withdrawID + '!' : ''),
        msg_en : 'Your cashout has been sent to moderation! ' + ((isActiveTrade) ? ' Your items are added to cashout #' + withdrawID + '!' : ''),
        closed : true,
        list : closed,
        withID : withdrawID
    });
});

module.exports = Route;