const Route = require('express').Router();
const {Users, CrashBets, Crash, getTransaction, Sequelize, getCommitedTransaction, execConfig} = require('../app/database');
const {auth} = require('../app/middleware');
const {sendAll} = require('../app/websocket');
const Redis = require('redis').createClient({
    path : '/var/run/redis/redis.sock'
});
const {promisify} = require('util');
const getAsync = promisify(Redis.get).bind(Redis);
const {toUSD} = require('../app/helpers');

Route.post('/bet', auth, async(req, res) => {

    let game = await Crash.findOne({
        order : [['id', 'DESC']]
    });

    let bet = await CrashBets.findOne({
        where : {
            user_id : req.user.id,
            round_id : game.id
        }
    });

    let game_id = game.id;
    if(game.status > 0) game_id++;

    let price = parseFloat(req.body.price);
    if(req.user.balance < price) return res.json({
        success : false,
        msg : 'Недостаточно баланса!',
        msg_en : 'Not enough balance!'
    });

    let config = await execConfig();
    if((req.body.currency == 'en' && price < (parseFloat((await toUSD(config.crash_min_bet, 2)).replace('$', ''))*config.usd)) || (req.body.currency == 'ru' && price < config.crash_min_bet)) return res.json({
        success : false,
        msg : 'Минимальная ставка - ' + config.crash_min_bet + 'руб.',
        msg_en : 'Minimal bet - ' + (await toUSD(config.crash_min_bet, 2)) + ' USD '
    });

    if(config.crash_max_bet > 0 && ((req.body.currency == 'en' && price > (parseFloat((await toUSD(config.crash_max_bet, 2)).replace('$', ''))*config.usd)) || (req.body.currency == 'ru' && price > config.crash_max_bet))) return res.json({
        success : false,
        msg : 'Максимальная ставка - ' + config.crash_max_bet + 'руб.',
        msg_en : 'Maximum bet - ' + (await toUSD(config.crash_max_bet, 2)) + ' USD.'
    });

    let betsCount = await CrashBets.count({
        where: {
            user_id: req.user.id,
            round_id: game_id
        }
    });

    if(config.crash_bets > 0 && betsCount >= config.crash_bets) return res.json({
        success: false,
        msg: 'Максимальное кол-во ставок за раунд - ' + config.crash_bets,
        msg_en : 'Maximum number of bets per round - ' + config.crash_bets
    });

    let t = await getTransaction();
    let balance = 0;
    try {
        balance = parseFloat((req.user.balance-price).toFixed(2));
        await Users.update({
            balance : balance
        }, {
            where : {
                id : req.user.id
            },
            transaction : t
        });

        bet = await CrashBets.create({
            user_id : req.user.id,
            round_id : game_id,
            user : {
                username  : req.user.username,
                avatar : req.user.avatar,
                vip : req.user.vip,
                youtube : req.user.youtube
            },
            price : price,
            cashout : parseFloat(req.body.withdraw),
            won : 0
        }, {
            transaction : t
        });

        bet = bet.get({plain:true});

        sendAll({
            type : 'crash_bet',
            bet : {
                id : bet.id,
                user_id : bet.user_id,
                round_id : game_id,
                user : bet.user,
                price : bet.price,
                status : bet.status,
                cashout : bet.cashout,
                cashouting : false,
                canceling : false
            }
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
        msg : (game_id == game.id) ? 'Ваша ставка принята!' : 'Ваша ставка перешла в следующий раунд!',
        msg_en : (game_id == game.id) ? 'Your bet has been accepted!' : 'Your bet has moved to the next round!',
        balance : balance,
        cashout : bet.cashout,
        bet : price
    });
});

Route.post('/cashout', auth, async(req, res) => {
    let game = await Crash.findOne({
        order : [['id', 'DESC']]
    });

    let bet = await CrashBets.findOne({
        where : {
            user_id : req.user.id,
            round_id : game.id,
            status : 0,
            id : req.body.id
        }
    });

    if(!bet) return res.json({
        success : false,
        msg : 'Не удалось найти вашу ставку в раунде #' + game.id,
        msg_en : 'Could not find your bet in the round #' + game.id
    });

    if(game.status == 0) return res.json({
        success : false,
        msg : 'Дождитесь начала раунда!',
        msg_en : 'Wait for the start of the round!'
    });

    if(game.status == 2 && (bet.cashout <= 1)) return res.json({
        success : false,
        msg : 'Раунда закончился!',
        msg_en : 'Round is over!'
    });

    let canCashout = parseFloat(await getAsync('cashout')) || 0;
    if(!canCashout || canCashout === 0) return res.json({
        success : false,
        msg : 'Вы не можете вывести ставку!',
        msg_en : 'You cannot withdraw your bet!'
    });

    let float = parseFloat(await getAsync('float')) || 0;
    if(float <= 0) return res.json({
        success : false,
        msg : 'Что-то пошло не так!',
        msg_en : 'Something went wrong!'
    });

    if(bet.cashout > 1 &&  bet.cashout <= float) float = bet.cashout;

    let t = await getCommitedTransaction();
        // t2 = await getTransaction();

    let {won, balance} = 0;

    try {

        won = parseFloat((bet.price*float).toFixed(2));
        await Users.update({
            balance : Sequelize.literal('"balance"+' + won)
        }, {
            where : {
                id : bet.user_id
            },
            transaction : t
        });

        await CrashBets.update({
            cashout : float,
            won : won,
            status : 1
        }, {
            where : {
                id : bet.id
            },
            transaction : t
        });

        sendAll({
            type : 'crash_bet',
            bet : {
                id : bet.id,
                user_id : bet.user_id,
                round_id : bet.round_id,
                user : bet.user,
                price : bet.price,
                cashout : float,
                won : won,
                status : 1,
                cashouting : true,
                canceling : true
            }
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

    let user = await Users.findOne({
        where : {
            id : req.user.id
        }
    });

    return res.json({
        success : true,
        msg : 'Вы вывели ' + won + ' рублей! Ваш баланс обновится после окончания раунда!',
        msg_en : 'You brought out ' + (await toUSD(won, 2)) +' USD! Your balance will be updated after the end of the round!',
        balance : user.balance
    });
});

Route.post('/cancel', auth, async(req, res) => {
    let bet = await CrashBets.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!bet) return res.json({
        success : false,
        msg : 'Не удалось найти ставку #' + req.body.id,
        msg_en : 'Could not find bet #' + req.body.id
    });

    let game = await Crash.findOne({
        where : {
            id : bet.round_id
        }
    });

    if(game && game.status > 0) return res.json({
        success : false,
        msg : 'Раунд уже начался! Отменить ставку невозможно!',
        msg_en : 'The round has already begun! Cancellation is not possible!'
    });

    let t = await getTransaction();
    try {
        await CrashBets.destroy({
            where : {
                id : bet.id
            }
        }, {
            transaction : t
        });
    
        await Users.update({
            balance : Sequelize.literal('"balance"+' + bet.price)
        }, {
            where : {
                id : bet.user_id
            },
            transaction : t
        });

        await t.commit();
    } catch(e) {
        console.log(e);
        await t.rollback();
        return res.json({
            success : false,
            msg : 'Что-то пошло не так!',
            msg_en : 'Something went wrong!'
        });
    }

    sendAll({
        type : 'crash_remove',
        id : bet.id
    });

    let user = await Users.findOne({
        where : {
            id : bet.user_id
        }
    });

    return res.json({
        success : true,
        balance : user.balance
    });
});

module.exports = Route;