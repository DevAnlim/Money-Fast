const Route = require('express').Router();
const URL = require('url');
const Crypto = require('crypto');
const {Payments, Users, Sequelize, execConfig} = require('../app/database');
const {sendAll, sendToUser} = require('../app/websocket');
const {auth} = require('../app/middleware');
const {toUSD} = require('../app/helpers');

Route.post('/get', auth, async(req, res) => {

    let lang = req.cookies.lang || 'en';

    let order = await Payments.count()+1,
        cfg = await execConfig();

    let payment = await Payments.create({
        user_id : req.user.id,
        amount : req.body.amount,
        order : order,
        info : {
            email : '',
            phone : '',
            method : req.body.method,
            sign : '',
            intid : '',
            balanceBefore : req.user.balance,
            balanceBeforeTimeStamp : new Date().getTime()
        },
        type : 1,
        status : 0
    });

    sendToUser(req.user.id, {
        type : 'pay',
        payment : payment.get({plain:true})
    });

    let href = URL.format({
        protocol : 'https',
        hostname : 'free-kassa.ru',
        pathname : '/merchant/cash.php',
        query : {
            m : 105568,
            oa : req.body.amount,
            o : order,
            s : Crypto.createHash('md5').update(cfg.freekassa_id+':'+req.body.amount+':'+cfg.freekassa_secret1+':'+order).digest('hex'),
            i : (req.body.method != 'any') ? req.body.method : '',
            lang : lang,
            us_user : req.user.id
        }
    });
    return res.json({
        success : true,
        redirect : href
    });
});

Route.post('/info', async(req, res) => {
    let order = await Payments.findOne({
        where : {
            order : req.body['MERCHANT_ORDER_ID']
        }
    });

    if(order.status == 1) return res.send('YES');

    if(!order) return sendToUser(req.body.us_user, {
        type : 'message',
        user : req.body.us_user,
        msg : {
            success : false,
            msg : 'К сожалению, мы не обнаружили ваш платеж в базе данных! Обратитесь в поддержку с кодом платежа ' + req.body['MERCHANT_ORDER_ID'],
            msg_en : 'Unfortunately, we did not find your payment in the database! Contact support with payment code ' + req.body['MERCHANT_ORDER_ID']
        }
    });

    let user = await Users.findOne({
        where : {
            id : req.body.us_user
        }
    });

    // отправлять сообщение некому, депозитить тоже некому
    if(!user) return;

    // Всякое может быть в этой жизни) 
    if(user.id != req.body.us_user) return sendToUser(req.body.us_user, {
        type : 'message',
        user : req.body.us_user,
        msg : {
            success : false,
            msg : 'Вы не являетесь владельцем платежа!',
            msg_en : 'You are not the owner of the payment!'
        }
    });

    let info = order.info;
        info.email = req.body['P_EMAIL'];
        info.phone = req.body['P_PHONE'] || false;
        info.sign = req.body['SIGN'];
        info.intid = req.body['intid'];
        info.method = order.info.method;
        info.balanceBefore = user.balance;
        info.balanceBeforeTimeStamp = new Date().getTime();
        info.balanceAfter = user.balance+parseFloat(req.body['AMOUNT']);
        info.balanceAfterTimeStamp = new Date().getTime();


    await Payments.update({
        status : 1,
        info : info
    }, {
        where : {
            id : order.id
        }
    });

    let p = await Payments.findOne({
        where : {
            id : order.id
        }
    });

    sendToUser(user.id, {
        type : 'pay_update',
        payment : p
    });

    await Users.update({
        balance : Sequelize.literal('"balance"+' + req.body['AMOUNT']),
        lvl : Sequelize.literal('"lvl"+' + (parseFloat(req.body['AMOUNT']/1000)))
    }, {
        where : {
            id : user.id
        }
    });

    sendToUser(user.id, {
        type : 'lvl',
        value : user.lvl+parseFloat(req.body['AMOUNT']/1000)
    });

    sendToUser(user.id, {
        type : 'balance',
        user : user.id,
        balance : user.balance+parseFloat(req.body['AMOUNT']) 
    });

    sendToUser(user.id, {
        type : 'message',
        user : user.id,
        msg : {
            success : true,
            msg : 'Операция #' + p.order + ' прошла успешно! На ваш баланс зачислено ' + parseFloat(req.body['AMOUNT']) + ' руб.',
            msg_en : 'Transaction #' + p.order + ' was successful! Credited to your balance ' + (await toUSD(parseFloat(req.body['AMOUNT']), 2)) + ' USD.'
        }
    });

    // узнаем все о владельце реферала
    let refOwner = await Users.findOne({
        where : {
            ref_code : user.ref
        }
    });

    if(refOwner && user.ref.length >= 5)
    {
        // Опа, нашли владельца
        let count = await Users.count({
            where : {
                ref : refOwner.ref_code
            }
        });

        let m = 0;
        if(count >= 0 && count < 10) m = 0.02;
        if(count >= 10 && count < 100) m = 0.04;
        if(count >= 100 && count < 500) m = 0.06;
        if(count >= 500) m = 0.08;

        if(refOwner.youtube.active) m = 0.1;

        // youtuber - 0.1;
        // vip - false


        let finalyPrice = (parseFloat(req.body['AMOUNT'])*m).toFixed(2);

        refOwner.refs.price += parseFloat(finalyPrice);

        await Users.update({
            balance : Sequelize.literal('"balance"+'+finalyPrice),
            refs : refOwner.refs
        }, {
            where : {
                id : refOwner.id
            }
        });

        let payment = await Payments.create({
            user_id : refOwner.id,
            amount : parseFloat(finalyPrice),
            order : await Payments.count()+1,
            info : {
                email : '',
                phone : '',
                method : 'refs',
                sign : '',
                intid : ''
            },
            status : 1
        });

        sendToUser(refOwner.id, {
            type : 'pay',
            payment : payment.get({plain:true})
        });

        sendToUser(refOwner.id, {
            type : 'message',
            user : refOwner.id,
            msg : {
                success : true,
                msg : 'На ваш баланс зачислено ' + finalyPrice + ' руб. за пополнение игрока ' + user.username
            }
        });

        sendToUser(refOwner.id, {
            type : 'balance',
            user : refOwner.id,
            balance : refOwner.balance+parseFloat(finalyPrice)
        });

        sendToUser(refOwner.id, {
            type : 'update_refs_money',
            money : refOwner.refs.price
        });
    }

    return res.send('YES');

});

module.exports = Route;