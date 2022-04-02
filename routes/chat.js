const Route = require('express').Router();
const {Users, Chat, execConfig, Giveaway, getTransaction, Sequelize, Payments} = require('../app/database');
const {sendAll, sendToUser} = require('../app/websocket');
const {auth, moder} = require('../app/middleware');
const {toUSD, getCurrency} = require('../app/helpers');

Route.post('/get', async(req, res) => { 
    return res.json({
        messages : await Chat.findAll({
            order : [['id', 'desc']],
            limit : 20
        }),
        giveaway : await Giveaway.findOne({
            where : {
                status : 0
            },
            order : [['id', 'asc']]
        })
    });
});

Route.post('/vip', auth, async(req, res) => {
    let msg = await Chat.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!msg) return res.json({
        success : false,
        msg : 'Сообщение #' + req.body.id + ' не найдено!',
        msg_en : 'Message #' + req.body.id + ' not found!'
    });

    if(req.user.id == msg.user_id) return res.json({
        success : false,
        msg : 'Вы не можете покупать вип сами у себя!',
        msg_en : 'You can not buy VIP from yourself!'
    });

    if(req.user.vip) return res.json({
        success : false,
        msg : 'Вы уже являетесь VIP игроком!',
        msg_en : 'You are already a VIP player!'
    });

    if(req.user.balance < msg.vip_amount) return res.json({
        success : false,
        msg : 'Недостаточно баланса!',
        msg_en : 'Not enough balance!'
    });

    let t = await getTransaction();

    let user = null, moder = null;

    try {
        await Users.update({
            balance : Sequelize.literal('"balance"-'+msg.vip_amount),
            vip : true
        }, {
            where : {
                id : req.user.id
            },
            transaction : t
        });

        await Users.update({
            balance : Sequelize.literal('"balance"+'+msg.vip_amount)
        }, {
            where : {
                id : msg.user_id
            },
            transaction : t
        });

        user = await Users.findOne({
            where : {
                id : req.user.id
            },
            transaction : t
        });

        moder = await Users.findOne({
            where : {
                id : msg.user_id
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

    sendToUser(user.id, {
        type : 'update_vip',
        vip : user.vip
    });

    sendToUser(user.id, {
        type : 'balance',
        balance : user.balance
    });

    sendToUser(moder.id, {
        type : 'message',
        msg : {
            success : true,
            msg : 'Пользователь ' + user.username + '(' + user.id + ') купил у вас VIP за ' + msg.vip_amount + ' руб!',
            msg_en : 'Player ' + user.username + '(' + user.id + ') bought you a VIP for ' + (await toUSD(msg.vip_amount, 2)) + ' USD!'
        }
    });

    sendToUser(moder.id, {
        type : 'balance',
        balance : moder.balance
    });

    return res.json({
        success : true,
        msg : 'Поздравляем! Теперь вы VIP игрок!',
        msg_en : 'Congratulations! Now you are a VIP player!'
    });
});

Route.post('/send', auth, async(req, res) => {
    let config = await execConfig();

    if(req.user.chat_ban && (new Date().getTime() < parseInt(req.user.chat_ban_date))) return res.json({
        success : false,
        msg : 'Вы были заблокированы в чате!',
        msg_en: 'You were blocked in the chat!' 
    });

    let deps = await Payments.sum('amount', {
        where : {
            user_id : req.user.id,
            type : 1,
            status : 1
        }
    }) || 0;

    // if(deps < 10) return res.json({
    //     success : false,
    //     msg: 'Чтобы использовать чат - пополните баланс на 10 рублей!',
    //     msg_en: 'To use chat, top up your balance by '+ (await toUSD(10, 2)) +' USD!'
    // });

    if(!isNaN(parseInt(req.body.msg))) 
    {
        let give = await Giveaway.findOne({
            where : {
                status : 0
            },
            order : [['id', 'asc']]
        });

        if(give)
        {
            let num = parseFloat(req.body.msg);
            if(num == give.number)
            {
                let t = await getTransaction();
                try {
                    await Giveaway.update({
                        status : 1
                    }, {
                        where : {
                            id : give.id
                        },
                        transaction : t
                    });

                    await Users.update({
                        balance : Sequelize.literal('"balance"+'+give.amount)
                    }, {
                        where : {
                            id : req.user.id
                        },
                        transaction : t
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

                sendAll({
                    type : 'giveaway_close'
                });

                sendToUser(req.user.id, {
                    type : 'balance',
                    balance : req.user.balance + give.amount
                });

                let chatMsg = await Chat.create({
                    user_id : 0,
                    user : {
                        username : 'Розыгрыш',
                        avatar : 'https://pp.userapi.com/c851228/v851228527/52738/pe1IHBUQIBU.jpg',
                        id : 0,
                        is_admin : 0,
                        vip : false,
                        youtube : {
                            active: false,
                            href: ''
                        },
                        lvl : 0
                    },
                    message : req.user.username + ' выиграл розыгрыш, угадав число '+num+'!',
                    lang : 'ru'
                });
    
                chatMsg = await Chat.create({
                    user_id : 0,
                    user : {
                        username : 'Giveaway',
                        avatar : 'https://pp.userapi.com/c851228/v851228527/52738/pe1IHBUQIBU.jpg',
                        id : 0,
                        is_admin : 0,
                        vip : false,
                        youtube : {
                            active: false,
                            href: ''
                        },
                        lvl : 0
                    },
                    message : req.user.username + ' won the giveaway by guessing the number '+num+'!',
                    lang : 'en'
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
                    msg : 'Поздравляем, вы угадали число ' + give.number + '! На ваш баланс зачислено ' + give.amount + ' руб.',
                    msg_en : 'Congratulations, you guessed the number ' + give.number + ' ! Credited to your balance ' + (await toUSD(give.amount, 2)) + ' USD'
                });
            }
        }
    }
    
    if(req.body.msg.replace(/\s/g, '').length < config.chat_min) return res.json({
        success : false,
        msg : 'Минимально кол-во символов - ' + config.chat_min,
        msg_en : 'Minimum number of characters - ' + config.chat_min
    });

    if(req.body.msg.length > config.chat_max) return res.json({
        success : false,
        msg : 'Максимальное кол-во символов - ' + config.chat_max,
        msg_en : 'Maximum number of characters - ' + config.chat_max
    });

    if(req.body.msg.indexOf('/') === 0)
    {
        let msg = req.body.msg.replace('/', '').split(' ');

        if(msg[0] == 'give')
        {
            // let amount = Math.floor(parseFloat(msg[1]) || 0);
            let amount = await getCurrency(parseFloat(msg[1]) || 0, req.body.currency);
            if((req.body.currency == 'ru' && amount < config.giveaway_min) || (req.body.currency == 'en' && amount < (parseFloat((await toUSD(config.giveaway_min, 2)).replace('$', ''))*config.usd))) return res.json({
                success : false,
                msg : 'Минимальная сумма розыгрыша - '+config.giveaway_min+' руб.',
                msg_en : 'Minimum draw amount - ' + (await toUSD(config.giveaway_min, 2))
            });

            if(config.giveaway_max > 0 && ((req.body.currency == 'ru' && amount > config.giveaway_max) || (req.body.currency == 'en' && amount > (parseFloat((await toUSD(config.giveaway_max, 2)).replace('$', ''))*config.usd)))) return res.json({
                success : false,
                msg : 'Максимальная сумма розыгрыша - '+config.giveaway_max+' руб.',
                msg_en : 'Maximal draw amount - ' + (await toUSD(config.giveaway_max, 2))
            });



            if(amount > req.user.balance) return res.json({
                success : false,
                msg : 'Недостаточно баланса!',
                msg_en : 'Not enough balance!'
            });

            let give = await Giveaway.findOne({
                where : {
                    status : 0
                }
            });

            if(give) return res.json({
                success : false,
                msg : 'Розыгрыш от ' + give.user.username + ' еще не закончился!',
                msg_en : 'Giveaway from ' + give.user.username + ' is not over yet!'
            });

            let t = await getTransaction();
            let num = Math.floor(Math.random()*amount);

            try {
                await Users.update({
                    balance : Sequelize.literal('"balance"-'+amount)
                }, {
                    where : {
                        id : req.user.id
                    },
                    transaction : t
                });

                

                await Giveaway.create({
                    user_id : req.user.id,
                    user : {
                        username : req.user.username,
                        avatar : req.user.avatar,
                        vip : req.user.vip,
                        youtube : req.user.youtube
                    },
                    amount : amount,
                    number : num
                },{
                    transaction : t
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

            sendToUser(req.user.id, {
                type : 'balance',
                balance  : (req.user.balance-amount)
            });

            sendAll({
                type : 'giveaway',
                user : {
                    username : req.user.username,
                    avatar : req.user.avatar,
                    vip : req.user.vip,
                    youtube : req.user.youtube
                },
                amount : amount
            });

            return res.json({
                success : true,
                msg : 'Розыгрыш успешно создан!',
                msg_en : 'Giveaway has been successfully created!'
            });
        }

        if(msg[0] == 'ban' && req.user.is_admin > 0)
        {
            let user = await Users.findOne({
                where: {
                    id: parseInt(msg[1])
                }
            });

            if(!user) return res.json({
                success: false,
                msg: 'Не удалось найти пользователя #' + msg[1],
                msg_en: 'Could not find user #' + msg[1]
            });

            if(user.chat_ban && (new Date().getTime() < new Date(user.chat_ban_date).getTime())) return res.json({
                success: false,
                msg: 'Пользователь #'+user.id+' уже забанен в чате!',
                msg_en: 'User #'+user.id+' already banned in chat!'
            });

            await Users.update({
                chat_ban: true,
                chat_ban_date: (new Date().getTime()+(parseInt(msg[2])*60*1000)).toString()
            }, {
                where: {
                    id: user.id
                }
            });

            sendToUser(user.id, {
                type : 'message',
                user : user.id,
                msg : {
                    success : false,
                    msg : 'Вы были заблокированы в чате на ' + msg[2] + ' минут!',
                    msg_en: 'You were blocked in the chat on ' + msg[2] + ' minutes!' 
                }
            });

            let chatMsg = await Chat.create({
                user_id : req.user.id,
                user : {
                    username : req.user.username,
                    avatar : req.user.avatar,
                    id : 0,
                    is_admin : req.user.is_admin,
                    vip : req.user.vip,
                    youtube : req.user.youtube,
                    lvl : req.user.lvl
                },
                message : user.username + ' заблокирован в чате на ' + msg[2] + ' минут!',
                lang : 'ru'
            });
        
            sendAll({
                type : 'chat_new',
                msg : await Chat.findAll({
                    order : [['id', 'desc']],
                    limit : 20
                })
            });

            chatMsg = await Chat.create({
                user_id : req.user.id,
                user : {
                    username : req.user.username,
                    avatar : req.user.avatar,
                    id : 0,
                    is_admin : req.user.is_admin,
                    vip : req.user.vip,
                    youtube : req.user.youtube,
                    lvl : req.user.lvl
                },
                message : user.username + ' blocked in chat for '+msg[2]+' minutes!',
                lang : 'en'
            });

            sendAll({
                type : 'chat_new',
                msg : await Chat.findAll({
                    order : [['id', 'desc']],
                    limit : 20
                })
            });

            return res.json({
                success: true,
                msg: 'Пользователь #' + user.id + ' заблокирован в чате на ' + msg[2] + ' минут!',
                msg_en: 'User #' + user.id + ' blocked in the chat on ' + msg[2] + ' minutes!'
            });
        }

        if(msg[0] == 'unban' && req.user.is_admin > 0)
        {
            let user = await Users.findOne({
                where: {
                    id: parseInt(msg[1])
                }
            });

            if(!user) return res.json({
                success: false,
                msg: 'Не удалось найти пользователя #' + msg[1],
                msg_en: 'Could not find user #' + msg[1]
            });

            if(!user.chat_ban) return res.json({
                success: false,
                msg: 'Пользователь #'+user.id+' не заблокирован в чате!',
                msg_en: 'User #'+user.id+' not banned in chat!'
            });

            await Users.update({
                chat_ban: false,
                chat_ban_date: '0'
            }, {
                where: {
                    id: user.id
                }
            });

            sendToUser(user.id, {
                type : 'message',
                user : user.id,
                msg : {
                    success : true,
                    msg : 'Вы были разблокированы в чате!',
                    msg_en: 'You were unblocked in the chat!' 
                }
            });

            let chatMsg = await Chat.create({
                user_id : req.user.id,
                user : {
                    username : req.user.username,
                    avatar : req.user.avatar,
                    id : 0,
                    is_admin : req.user.is_admin,
                    vip : req.user.vip,
                    youtube : req.user.youtube,
                    lvl : req.user.lvl
                },
                message : user.username + ' разблокирован в чате!',
                lang : 'ru'
            });
        
            sendAll({
                type : 'chat_new',
                msg : await Chat.findAll({
                    order : [['id', 'desc']],
                    limit : 20
                })
            });

            chatMsg = await Chat.create({
                user_id : req.user.id,
                user : {
                    username : req.user.username,
                    avatar : req.user.avatar,
                    id : 0,
                    is_admin : req.user.is_admin,
                    vip : req.user.vip,
                    youtube : req.user.youtube,
                    lvl : req.user.lvl
                },
                message : user.username + ' unblocked in chat!',
                lang : 'en'
            });

            sendAll({
                type : 'chat_new',
                msg : await Chat.findAll({
                    order : [['id', 'desc']],
                    limit : 20
                })
            });

            return res.json({
                success: true,
                msg: 'Пользователь #' + user.id + ' разблокирован в чате!',
                msg_en: 'User #' + user.id + ' blocked in the unchat!'
            });
        }

        if(msg[0] == 'vip' && req.user.is_admin > 0)
        {
            let amount = parseFloat(msg[1]) || false;
            if(!amount || amount < 1) return res.json({
                success : false,
                msg : 'Неверная стоимость!',
                msg_en : 'Wrong price!'
            });

            let vip_msg = {
                en : config.vip_message_en,
                ru : config.vip_message_ru
            }

            for(let i in vip_msg) 
            {
                let msg = vip_msg[i].replace('{amount}', ((i == 'en') ? (await toUSD(amount,2)) : amount)).replace('{btn}', '<a v-on:click="buyVip('+amount+', '+req.body.id+')" class="btn">'+((i == 'en') ? 'Buy' : 'Купить')+'</a>');

                let chatMsg = await Chat.create({
                    user_id : req.user.id,
                    user : {
                        username : req.user.username,
                        avatar : req.user.avatar,
                        id : req.user.id,
                        is_admin : req.user.is_admin,
                        vip : req.user.vip,
                        youtube : req.user.youtube,
                        lvl : req.user.lvl
                    },
                    message : msg,
                    lang : i,
                    vip_message : true,
                    vip_amount : amount
                });
            
                sendAll({
                    type : 'chat_new',
                    msg : await Chat.findAll({
                        order : [['id', 'desc']],
                        limit : 20
                    })
                });
            }



            return res.json({
                success : true,
                msg : JSON.stringify(vip_msg),
                msg_en : JSON.stringify(vip_msg)
            });
        }
    }

    let chatMsg = await Chat.create({
        user_id : req.user.id,
        user : {
            username : req.user.username,
            avatar : req.user.avatar,
            id : req.user.id,
            is_admin : req.user.is_admin,
            vip : req.user.vip,
            youtube : req.user.youtube,
            lvl : req.user.lvl
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
        msg : 'Ваше сообщение отправлено!',
        msg_en : 'Your message has been sent!'
    });
});

Route.post('/delete', auth, moder, async(req, res) => {
    // if(req.user.is_admin <= 0) return res.json({
    //     success : false,
    //     msg : 'У вас нет прав на удаление сообщений!'
    // });

    let msg = await Chat.findOne({
        where : {
            id : req.body.id
        }
    });

    if(!msg) return res.json({
        success : false,
        msg : 'Не удалось найти сообщение #' + req.body.id,
        msg_en : 'Could not find message #' + req.body.id
    });

    await Chat.destroy({
        where : {
            id : req.body.id
        }
    });

    sendAll({
        type : 'chat_hide',
        id : msg.id
    });

    return res.json({
        success : true,
        msg : 'Сообщение #' + req.body.id + ' от игрока «'+msg.user.username+'» удалено',
        msg_en : 'Message #' + req.body.id + ' from player «'+msg.user.username+'» deleted!'
    });

});

module.exports = Route;