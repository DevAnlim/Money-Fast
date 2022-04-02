const Route = require('express').Router();
const {Users, getTransaction, Sequelize, Jackpot, JackpotBets, execConfig} = require('../app/database');
const {sendAll, sendToUser} = require('../app/websocket');
const {checkStatus, updateJackpot} = require('../app/jackpot');
const {auth} = require('../app/middleware');
const Redis = require('redis').createClient({
    path : '/var/run/redis/redis.sock'
});
const {toUSD} = require('../app/helpers');

Route.post('/bet', auth, async(req, res) => {
    let amount = parseFloat(req.body.amount) || false;
    if(!amount) return res.json({
        success : false,
        msg : 'Сумма указана не верно!',
        msg_en : 'The amount indicated is not true!'
    });

    let game = await Jackpot.findOne({
        order : [['id', 'desc']]
    });

    if(!game || game.status > 1) return res.json({
        success : false,
        msg : 'Ставки в эту игру закрыты!',
        msg_en : 'Bets on this game are closed!'
    });

    if(req.user.balance < amount) return res.json({
        success : false,
        msg : 'Недостаточно баланса!',
        msg_en : 'Not enough balance!'
    });

    let config = await execConfig();
    if((req.body.currency == 'en' && amount < (parseFloat((await toUSD(config.jackpot_min_bet, 2)).replace('$', ''))*config.usd)) || (req.body.currency == 'ru' && amount < config.jackpot_min_bet)) return res.json({
        success : false,
        msg : 'Минимальная ставка - ' + config.jackpot_min_bet + 'руб.',
        msg_en : 'Minimal bet - ' + (await toUSD(config.jackpot_min_bet, 2)) + ' USD'
    });

    if((config.jackpot_max_bet != 0) && ((req.body.currency == 'en' && amount > (parseFloat((await toUSD(config.jackpot_max_bet, 2)).replace('$', ''))*config.usd)) || (req.body.currency == 'ru' && amount > config.jackpot_max_bet))) return res.json({
        success : false,
        msg : 'Максимальная ставка - ' + config.jackpot_max_bet + 'руб.',
        msg_en : 'Maximal bet - ' + (await toUSD(config.jackpot_max_bet, 2)) + ' USD'
    });

    let t = await getTransaction(), bet = false;

    try {
        let myBetsCount = await JackpotBets.findAll({
            where : {
                game_id : game.id,
                user_id : req.user.id,
                fake : false
            }
        });

        if(config.jackpot_maxbets > 0 && myBetsCount.length >= config.jackpot_maxbets) 
        {
            await t.rollback();
            return res.json({
                success : false,
                msg : 'Максимальная кол-во ставок за игру - ' + config.jackpot_maxbets,
                msg_en : 'Maximum number of bets per game - ' + config.jackpot_maxbets
            });
        }


        bet = await JackpotBets.create({
            user_id : req.user.id,
            game_id : game.id,
            user : {
                username : req.user.username,
                avatar : req.user.avatar,
                vip : req.user.vip,
                youtube : req.user.youtube
            },
            amount : amount
        }, {
            transaction : t
        });

        await Users.update({
            balance : Sequelize.literal('"balance"-'+amount)
        }, {
            where : {
                id : req.user.id
            }
        });

        bet = bet.get({plain:true});

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

    sendToUser(req.user.id, {
        type : 'balance',
        user : req.user.id,
        balance : parseFloat((req.user.balance-amount).toFixed(2))
    });

    sendAll({
        type: 'jackpot_update',
        response: await updateJackpot()
    });

    this.checkTimer(game.id);

    return res.json({
        success : true,
        msg : 'Ваша ставка одобрена!',
        msg_en : 'Your bet has been approved!',
        bet : amount
    });

});

exports.checkTimer = async function(id) {
    let bets = await JackpotBets.findAll({
        where : {
            game_id : id
        }
    });

    let users = [];
    bets.forEach(bet => {
        if(bet.fake) bet.user_id = parseInt('-'+bet.user_id);
        let UserExist = false;
        for(let i in users) if(users[i] ==  bet.user_id) UserExist = true;
        if(!UserExist) users.push(bet.user_id);
    });

    if(users.length >= 2) Redis.publish('jackpot.timer', '@p4r4p3t');
}

exports.parseJackpot = async function(id) {
    let game = await Jackpot.findOne({
        where : {
            id : id
        }
    });

    if(!game) return;

    let list = await JackpotBets.findAll({
        where : {
            game_id : game.id
        },
        order : [['id', 'desc']]
    });

    let bets = [], users = [];
    for(let i in list)
    {
        bets.push({
            user_id : list[i].user_id,
            user : list[i].user,
            amount : list[i].amount,
            from : list[i].from,
            to : list[i].to,
            color : list[i].color,
            chance : 0
        });

        let found = false, key = false;
        for(let u in users) if(users[u].user_id == list[i].user_id) 
        {
            found = true;
            key = u;
        }
        if(!found) users.push({
            user_id : list[i].user_id,
            user : list[i].user,
            chance : 0,
            price : list[i].amount
        });
        if(found && key) 
        {
            users[key].price += list[i].amount;
            users[key].chance = ((users[key].price/game.price)*100).toFixed(2);
        }
    }

    
    for(let u in bets) for(let i in users) if(bets[u].user_id == users[i].user_id) bets[u].chance = users[i].chance;


    sendAll({
        type : 'jackpot_update',
        game : {
            hash : game.hash,
            price : game.price,
            status : game.status,
            bets : bets,
            users : users
        }
    });
}

module.exports = Route;