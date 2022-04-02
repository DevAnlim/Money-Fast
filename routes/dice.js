const Route = require('express').Router();
const {Dice, Users, getTransaction, Op, execConfig} = require('../app/database');
const {sendAll} = require('../app/websocket');
const {Today} = require('../app/date');
const Crypto = require('crypto');
const {auth} = require('../app/middleware');
const {profitState, toUSD} = require('../app/helpers');
const { plus } = require('../app/profit');

Route.post('/play', auth, async(req, res) => {
    let price = parseFloat(req.body.price).toFixed(2),
        result = parseFloat((Math.random()*100).toFixed(2));
    max = 100-(100-parseFloat(req.body.number)),
        win = (result > max) ? true : false;

    let chance = (100 - req.body.number),
        multiplier = parseFloat((99/chance).toFixed(2)),
        won = parseFloat((price*multiplier).toFixed(2));

    let prod = 0;
    if(chance > 80) prod = 10;
    else if(chance > 60 && chance <= 80) prod = 20;
    else if(chance > 40 && chance <= 60) prod = 35;
    else if(chance > 20 && chance <= 40) prod = 50;
    else if(chance > 10 && chance <= 20) prod = 70;
    else if(chance > 5 && chance <= 10) prod = 80;
    else if(chance < 5) prod = 90;

    if(Math.floor(Math.random()*100)+1 <= prod) win = false;
    if(!win && result > max) result = parseFloat((Math.random()*max).toFixed(2));

    // let transaction = await getTransaction();
    let balance = req.user.balance;


    let lastGame = await Dice.findOne({
        where : {
            user_id : req.user.id
        },
        order : [['id', 'DESC']],
        limit : 1
    });

    let config = await execConfig();
    if((req.body.currency == 'en' && price < (parseFloat((await toUSD(config.dice_min_bet, 2)).replace('$', ''))*config.usd)) || (req.body.currency == 'ru' && price < config.dice_min_bet)) return res.json({
        success : false,
        msg : 'Минимальная ставка - ' + config.dice_min_bet + 'руб.',
        msg_en : 'Minimal bet - ' + (await toUSD(config.dice_min_bet, 2)) + ' USD'
    });

    if(config.dice_max_bet > 0 && ((req.body.currency == 'en' && price > (parseFloat((await toUSD(config.dice_max_bet, 2)).replace('$', ''))*config.usd)) || (req.body.currency == 'ru' && price > config.dice_max_bet))) return res.json({
        success : false,
        msg : 'Максимальная ставка - ' + config.dice_max_bet + 'руб.',
        msg_en : 'Maximal bet - ' + (await toUSD(config.dice_max_bet, 2)) + ' USD'
    });

    try {
        var user = await Users.findOne({
            where : {
                id : req.user.id
            }
        });

        if(user.balance < price) return res.json({
            success : false,
            msg : 'Недостаточно баланса!',
            msg_en : 'Not enough balance!'
        });

        balance = parseFloat((req.user.balance-price).toFixed(2))
        if(win) balance += won;
        await Users.update({
            balance : parseFloat(balance.toFixed(2))
        }, {
            where : {
                id : user.id
            }
        });

        let hash = (lastGame) ? lastGame.id.toString() : req.user.id.toString();

        let dice = await Dice.create({
            user_id : user.id,
            user : {
                username : user.username,
                avatar : user.username,
                profile_url : user.profile_url,
                vip : user.vip,
                youtube : user.youtube
            },
            price : price,
            number : result,
            multiplier : (win) ? multiplier : 0,
            chance : parseFloat(parseFloat(chance).toFixed(2)),
            won : (win) ? won : parseFloat('-'+price),
            hash : Crypto.createHash('sha1').update(hash+'_dice').digest('hex')
        });

        lastGame = dice.get({plain:true});

        await Dice.destroy({
            where: {
                id: {
                    [Op.lt]: dice.id-15
                }
            }
        });

        await plus((win) ? (price-won) : price, 'dice');

        

        // await transaction.commit();
    } catch(e) {
        console.log(e);
        // await transaction.rollback();
        return res.json({
            success : false,
            msg : 'Что-то пошло не так...',
            msg_en : 'Something went wrong...'
        });
    }

    sendAll({
        type : 'dice',
        user : {
            username : req.user.username,
            vip : req.user.vip,
            youtube : req.user.youtube
        },
        price : price,
        number : result,
        multiplier : (win) ? multiplier : 0,
        chance : chance,
        won : (win) ? won : parseFloat('-'+price),
        hash : lastGame.hash,
        games : await Dice.count() || 0,
        today_bets : await Dice.sum('price', {
            where : {
                createdAt : {
                    [Op.gte] : Today()
                }
            }
        }) || 0
    });
    
    return res.json({
        success : true,
        number : result,
        win : win,
        multiplier : multiplier,
        user : user,
        balance : balance,
        hash : Crypto.createHash('sha1').update((lastGame.id).toString()+'_dice').digest('hex')
    });
});

module.exports = Route;