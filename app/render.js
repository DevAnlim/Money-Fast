const {Users, Dice, Op, ProfitLine, Chat, Crash, CrashBets, Alerts, Sequelize, Payments, Withdraw, Jackpot, JackpotBets, Sends, execConfig, Promo, Bots, Items, MarketItems, VGOTrades} = require('../app/database');
const {Today, Week, Month} = require('../app/date');
const Crypto = require('crypto');
const {getCurrency} = require('../app/helpers');
const {CaptchaRender} = require('../app/captcha');
const {langPattern} = require('../app/lang');
const {readFileSync} = require('fs');
const {constructTrade} = require('../app/market');
const {site} = require('../config');
const {getTimeSchema} = require('../app/bots');
const { updateJackpot } = require('../app/jackpot');

exports.adminRender = function(user, path, id) {
    return new Promise(async(res, rej) => {
        let cfg = await execConfig();
        if(path == 'user')
        {
            let iUser = await Users.findOne({
                where : {
                    id : id
                }
            });

            if(!iUser) return res({
                success : false,
                msg : 'Не удалось найти пользователя #' + id
            });

            let send = await Sends.findAll({
                where : {
                    user_id : id
                }
            });

            let deposits = await Payments.sum('amount', {
                where : {
                    user_id : id,
                    type : 1,
                    status : 1
                }
            }) || 0;

            let withdrawsSuccess = await Withdraw.sum('amount', {
                where : {
                    user_id : id,
                    status : 1
                }
            }) || 0;

            let withdrawWait = await Withdraw.sum('amount', {
                where : {
                    user_id : id,
                    status : 0
                }
            }) || 0;
            
            let IPadress = '';
            for(let i = 0; i < iUser.ips.length; i++)
            {
                IPadress = IPadress + iUser.ips[i];
                if(i != (iUser.ips.length-1)) IPadress = IPadress + ' ';
            }
 
            return res({
                success : true,
                path : path,
                pattern : {
                    id : iUser.id,
                    is_admin : iUser.is_admin,
                    balance : iUser.balance,
                    vip : iUser.vip,
                    ban : iUser.ban,
                    youtube : iUser.youtube,
                    username : iUser.username,
                    avatar : iUser.avatar,
                    profile_url : iUser.profile_url,
                    sends : send,
                    deposits : deposits,
                    withdrawsSuccess : withdrawsSuccess,
                    withdrawWait : withdrawWait,
                    bonus : iUser.bonus,
                    refs : iUser.refs,
                    ips : IPadress
                }
            });
        }

        if(path == 'users')
        {
            let users = await Users.findAll({
                order : [['id', 'desc']]
            });

            for(let i in users)
            {
                let IPadress = '';
                for(let u = 0; u < users[i].ips.length; u++)
                {
                    IPadress = IPadress + users[i].ips[u];
                    if(u != (users[i].ips.length-1)) IPadress = IPadress + ' ';
                }
                users[i].ips = IPadress;
            }

            return res({
                success : true,
                path : path,
                pattern : users
            });
        }

        if(path == 'settings')
        {
            return res({
                success : true,
                path : path,
                pattern : await execConfig()
            });
        }

        if(path == 'payments')
        {
            let payments = await Payments.findAll({
                where : {
                    status : 1
                }
            });

            let list = [];
            for(let i in payments)
            {
                let p = payments[i];

                let user = await Users.findOne({
                    where : {
                        id : p.user_id
                    }
                });

                if(user)
                {
                    list.push({
                        id : p.order,
                        user : {
                            avatar : user.avatar,
                            username : user.username,
                            id : user.id
                        },
                        bal1 : p.info.balanceBefore,
                        bal2 : p.info.balanceAfter,
                        time : p.updatedAt,
                        amount : p.amount,
                        items: null,
                        date: new Date(p.updatedAt).getTime()
                    });
                }
            }

            let vgo = await VGOTrades.findAll({
                where: {
                    status: 5
                }
            });

            for(let i in vgo)
            {
                let user = await Users.findOne({
                    where: {
                        id: vgo[i].user_id
                    }
                });

                if(user)
                {
                    list.push({
                        id: vgo[i].offer,
                        user: {
                            username: user.username,
                            avatar: user.avatar,
                            id: user.id
                        },
                        bal1: vgo[i].balance_before,
                        bal2: vgo[i].balance_after,
                        time: vgo[i].updatedAt,
                        amount: vgo[i].price,
                        items: vgo[i].items,
                        date: new Date(vgo[i].updatedAt).getTime()
                    });
                }
            }

            list.sort((a, b) => {
                if(a.date > b.date) return -1;
                if(a.date < b.date) return 1;
                return 0
            });

            return res({
                success : true,
                path : path,
                pattern : {
                    list : list
                }
            })
        }

        if(path == 'withdraw')
        {
            let list = [],
                wlist = await Withdraw.findAll({
                    order : [['id', 'desc']]
                });

            wlist.forEach(w => {
                list.push({
                    id : w.id,
                    user_id : w.user_id,
                    user : w.user,
                    info : w.info,
                    amount : w.amount,
                    method : w.method,
                    status : w.status,
                    canceling : false
                });
            });

            let skins = [],
                items = await Items.findAll({
                    where : {
                        status : {
                            [Op.gt] : 0,
                            [Op.lt] : 6
                        }
                    }
                });

            let ids = [];
            for(let i in items) 
            {
                let found = false;
                for(let u in ids) if(items[i].withdraw == ids[u]) found = true;
                if(!found) ids.push(items[i].withdraw);
            }

            for(let i in ids) skins.push(await constructTrade(ids[i]));

            return res({
                success : true,
                path : path,
                pattern : {
                    money : list,
                    skins : skins
                }
            });
        }

        if(path == 'alerts')
        {
            let alerts = await Alerts.findAll({
                order : [['id', 'desc']]
            });

            let list = [];

            for(let i in alerts)
            {
                let a = alerts[i];
                list.push({
                    en : a.en,
                    ru : a.ru,
                    id : a.id,
                    delete : false
                });
            }


            return res({
                success : true,
                path : path,
                pattern : {
                    list : list,
                    create : false
                }
            });
        }

        if(path == 'index')
        {
            // последние депозиты
            let last_deps = [];
            let depsList = await Payments.findAll({
                order : [['id', 'desc']],
                where : {
                    status : 1,
                    type : 1
                },
                limit : 10
            });

            for(let i in depsList)
            {
                let depUser = await Users.findOne({
                    where : {
                        id : depsList[i].user_id
                    }
                });

                if(depUser) last_deps.push({
                    id : depUser.id,
                    username : depUser.username,
                    avatar : depUser.avatar,
                    amount : depsList[i].amount
                });
            }
            
            // jackpot подкрутка
            let jackpotGame = await Jackpot.findOne({
                order : [['id', 'desc']]
            }),
                jackpotBets = [];
            
            if(jackpotGame)
            {
                let list = await JackpotBets.findAll({
                    where : {
                        game_id : jackpotGame.id
                    }
                });
                
                for(let i in list)
                {
                    list[i].user_id = (list[i].fake) ? parseInt('-'+list[i].user_id) : list[i].user_id;
                    let found = false;
                    for(var u in jackpotBets) if(jackpotBets[u].user_id == list[i].user_id) found = true;
                    if(!found) jackpotBets.push({
                        user_id : list[i].user_id,
                        user : list[i].user,
                        disableButton : false,
                        id : jackpotGame.id
                    });
                }
            }

            return res({
                success : true,
                path : path,
                pattern : {
                    jackpot: await ProfitLine.sum('value', {
                        where: {
                            type: 'jackpot',
                            date: Today()
                        }
                    }) || 0,
                    dice: await ProfitLine.sum('value', {
                        where: {
                            type: 'dice',
                            date: Today()
                        }
                    }) || 0,
                    crash: await ProfitLine.sum('value', {
                        where: {
                            type: 'crash',
                            date: Today()
                        }
                    }) || 0,
                    send: await ProfitLine.sum('value', {
                        where: {
                            type: 'send',
                            date: Today()
                        }
                    }) || 0,
                    toWithdraw : await Withdraw.sum('amount', {
                        where : {
                            status : 0
                        }
                    }) || 0,
                    online : {
                        connections : 0,
                        ips : [],
                        users : []
                    },
                    freekassa_balance : cfg.freekassa_balance || 0,
                    p_today : await Payments.sum('amount', {
                        where : {
                            status : 1,
                            type : 1,
                            updatedAt : {
                                [Op.gte] : Today()
                            }
                        }
                    }) || 0,
                    p_week : await Payments.sum('amount', {
                        where : {
                            status : 1,
                            type : 1,
                            updatedAt : {
                                [Op.gte] : Week()
                            }
                        }
                    }) || 0,
                    p_month : await Payments.sum('amount', {
                        where : {
                            status : 1,
                            type : 1,
                            updatedAt : {
                                [Op.gte] : Month()
                            }
                        }
                    }) || 0,
                    p_all : await Payments.sum('amount', {
                        where : {
                            status : 1,
                            type : 1
                        }
                    }) || 0,
                    top_users : await Users.findAll({
                        order : [['balance', 'desc']],
                        limit : 10
                    }),
                    last_deps : last_deps,
                    last_users : await Users.findAll({
                        order : [['createdAt', 'desc']],
                        limit : 10
                    }),
                    jackpot_bets : jackpotBets,
                    jackpot_id : jackpotGame.id,
                    bots : await Bots.findAll(),
                    chat : await Chat.findAll({
                        order : [['id', 'desc']],
                        limit : 20
                    }),
                    chatln : 'ru'
                }
            });
        }

        if(path == 'promo')
        {
            return res({
                success : true,
                path : path,
                pattern : await Promo.findAll({
                    where : {
                        status : 0
                    },
                    order : [['id', 'desc']]
                })
            })
        }

        if(path == 'bots') 
        {
            return res({
                success : true,
                path : path,
                pattern : {
                    create : false,
                    parse : false,
                    list : await Bots.findAll({
                        order : [['id', 'desc']]
                    })
                }
            });
        }

        if(path == 'bot')
        {
            let bot = await Bots.findOne({
                where : {
                    id : id
                }
            });

            if(!bot) return res({
                success : false,
                msg : 'Не удалось найти бота #' + id
            });

            return res({
                success : true,
                path : path,
                pattern : bot
            });
        }

        if(path == 'market')
        {
            return res({
                success : true,
                path : path,
                pattern : {
                    items : await MarketItems.findAll(),
                    disableButton : false,
                    game : 'csgo'
                }
            });
        }

        return res({
            success : false,
            msg : 'Не удалось определить шаблон : ' + path
        });
    });
}

exports.adminPatterns = {
    domain : site.domain,
    rendered : false,
    tables : [],
    template : false,
    path : false,
    lastPath : '/admin',
    redirectedToLastPath : false,
    template_query : {},
    user : {},
    paths : {
        'payments' : {
            list : []
        },
        'alerts' : {
            list : [],
            create : false
        },
        'market' : {
            items : [],
            disableButton : false,
            game : 'csgo'
        },
        'promo' : [],
        'user' : {
            profile_url : '',
            method : '',
            username : '',
            avatar : '',
            balance : 0,
            is_admin : 0,
            ref : '',
            ref_code : '',
            verify : '',
            lvl : 0,
            vip : false,
            youtube : {
                active  : false,
                href : ''
            },
            ban : {
                active : false,
                reason : ''
            },
            refs : {
                price : 0
            },
            bonus : {
                price : 0
            },
            deposits : 0,
            withdrawsSuccess : 0,
            withdrawWait : 0,
            ips : []
        },
        'users' : [{
            profile_url : '',
            method : '',
            username : '',
            avatar : '',
            balance : 0,
            is_admin : 0,
            ref : '',
            ref_code : '',
            verify : '',
            lvl : 0,
            vip : false,
            youtube : {
                active  : false,
                href : ''
            },
            ban : {
                active : false,
                reason : ''
            }
        }],
        'bots' : {
            list : [{
                username : '',
                avatar : '',
                lvl : 0,
                vip : false,
                active : true
            }],
            create : false,
            parse : false
        },
        'bot' : {
            id : 0,
            username : '',
            avatar : '',
            vip : false,
            active : true,
            time : 0,
            bets : '',
            count : 0
        },
        'settings' : {
            domain : '',
            descriptions : '',
            keywords : '',
            sitename : '',
            dice_min_bet : 0,
            dice_max_bet : 0,
            crash_min_bet : 0,
            crash_max_bet : 0,
            crash_timer : 0,
            jackpot_min_bet : 0,
            jackpot_max_bet : 0,
            jackpot_timer : 0,
            jackpot_comission : 0,
            freekassa_id : '',
            freekassa_secret1 : '',
            freekassa_secret2 : '',
            fkwallet_id : '',
            fkwallet_api : '',
            chat_min : 0,
            chat_max : 0,
            dep_before_withdraw : 0,
            koef : 0
        },
        'withdraw' : [{
            user_id : 0,
            user : {
                username : '',
                avatar : ''
            },
            info : {
                method : 0,
                phone : '',
                email : ''
            },
            amount : 0,
            method : 0,
            status : 0
        }],
        'index' : {
            jackpot : 0,
            crash : 0,
            dice : 0,
            send : 0,
            online : {
                connections : 0,
                ips : [],
                users : []
            },
            jackpot_bets : [],
            chat : [],
            bots : [],
            chatln : 'ru'
        }
    }
}

exports.get = function(path, user) {
    return new Promise(async(res, rej) => {
        let pattern = await this.patterns(true, path) || {},
            config = await execConfig();

        if(path == 'crash')
        {
            let game = await Crash.findOne({
                order : [['id', 'desc']]
            });

            if(!game) return res({
                success : false
            });

            pattern.status = game.status;
            pattern.game_id = game.id
            pattern.timer = config.crash_timer;
            pattern.bets = [];
            let bets = await CrashBets.findAll({
                where : {
                    round_id : {
                        [Sequelize.Op.gte] : game.id
                    }
                },
                order : [['id', 'asc']]
            });
    
            for(let i in bets) 
            {
                pattern.bets.unshift({
                    id : bets[i].id,
                    price : bets[i].price,
                    round_id : bets[i].round_id,
                    cashout : bets[i].cashout,
                    user : bets[i].user,
                    user_id : (bets[i].fake) ? parseInt('-' + bets[i].user_id) : bets[i].user_id,
                    won : bets[i].won,
                    status : bets[i].status,
                    cashouting : (bets[i].status == 0) ? false : true,
                    canceling : (bets[i].status == 0) ? false : true
                });
                if(user && bets[i].user_id == user.id) pattern.hasBet = true;
                if(bets[i].round_id == game.id) pattern.betsCount++;
            }
    
            pattern.history = await Crash.findAll({
                where : {
                    status : 2
                },
                order : [['id', 'desc']],
                limit : 15
            });
        }

        if(path == 'dice')
        {
            pattern.history = await Dice.findAll({
                order : [['id', 'DESC']],
                limit : 10
            });
    
            pattern.today_bets = await Dice.sum('price', {
                where : {
                    createdAt : {
                        [Op.gte] : Today()
                    }
                }
            }) || 0;
    
            pattern.games = await Dice.count() || 0;
    
            if(user)
            {
                let lastGame = await Dice.findOne({
                    where : {
                        user_id : user.id
                    },
                    order : [['id', 'DESC']],
                    limit : 1
                });

                let hash = (lastGame) ? lastGame.id.toString() : user.id.toString();

                pattern.hash = Crypto.createHash('sha1').update(hash+'_dice').digest('hex');
            }
        }

        if(path == 'jackpot')
        {
            let data = await updateJackpot();

            // Игра
            pattern.game = {
                hash : data.hash,
                status : data.status,
                price : data.price,
                rotate : data.rotate
            }
            pattern.timer.sec = config.jackpot_timer;
            pattern.game.bets = data.bets;
            pattern.game.users = data.users;
        }

        if(path == 'ref' && user)
        {
            pattern.refs = user.refs.count;
            pattern.money = user.refs.price;
        }

        if(path == 'pay/history' && user)
        {
            pattern.deposits = await Payments.findAll({
                where : {
                    user_id : user.id,
                    status: {
                        [Op.not]: 0
                    }
                },
                order : [['id', 'desc']]
            });

            pattern.withdraws = [];
            let list = await Withdraw.findAll({
                where : {
                    user_id : user.id
                },
                order : [['id', 'desc']]
            });

            for(var i in list) pattern.withdraws.push({
                id : list[i].id,
                user_id : list[i].user_id,
                user : list[i].user,
                info : list[i].info,
                amount : list[i].amount,
                method : list[i].method,
                status : list[i].status,
                canceling : false
            });

            let skins = [],
                items = await Items.findAll({
                    where : {
                        owner_id : user.id 
                    },
                    order : [['withdraw', 'desc']]
                });

            let ids = [];
            for(let i in items) 
            {
                let found = false;
                for(let u in ids) if(items[i].withdraw == ids[u]) found = true;
                if(!found) ids.push(items[i].withdraw);
            }

            for(let i in ids) skins.push(await constructTrade(ids[i]));

            pattern.skins = skins;
            pattern.vgo = [];
            let vgo = await VGOTrades.findAll({
                where : {
                    user_id : user.id
                },
                order : [['id', 'desc']]
            });

            for(let i in vgo)
            {
                let cost = 0;
                for(let u in vgo[i].items) cost += vgo[i].items[u].price;
                pattern.vgo.push({
                    id : vgo[i].id,
                    offer : vgo[i].offer,
                    user_id : vgo[i].user_id,
                    status : vgo[i].status,
                    price : parseFloat(cost.toFixed(2)),
                    items : vgo[i].items
                });
            }

        }

        if(path == 'jackpot/history')
        {
            pattern.games = await Jackpot.findAll({
                where : {
                    // createdAt : {
                    //     [Op.gte] : Today()
                    // },
                    status : 3
                },
                order :[['id', 'desc']]
            });
        }

        if(path == 'skins')
        {
            let items = await Items.findAll({
                where : {
                    status : 0
                }
            }),
                list = [],
                key = 0;

            for(let i in items)
            {
                list.push({
                    appid : items[i].appid,
                    id : items[i].id,
                    // real_price : items[i].data[y].price,
                    classid : items[i].class,
                    instanceid : items[i].instance,
                    market_hash_name : items[i].market_hash_name,
                    icon_url : items[i].icon_url,
                    float : items[i].extra.float || 'not found',
                    price : items[i].price,
                    active : false,
                    selected : false,
                    key : key,
                    size: items[i].size.split(' ')
                });

                key++;
            }

            // let list = [],
            //     secondlist = [],
            //     itemKey = 0;
            // for(let i = 0; i < items.length; i++) for(let y = 0; y < items[i].data.length; y++) if(items[i].data[y].price <= config.market_balance)
            // {
            //     // let found = false, key = 0;
            //     // for(let u = 0; u < list.length; u++) if(list[u].classid == items[i].data[y].class && list[u].instanceid == items[i].data[y].instance)
            //     // {
            //     //     found = true;
            //     //     key = u;
            //     // }

            //     // if(!found) list.push({
            //     //     classid : items[i].data[y].class,
            //     //     instanceid : items[i].data[y].instance,
            //     //     count : 1
            //     // });

            //     // if(found) list[key].count++;

            //     secondlist.push({
            //         appid : (items[i].game == 'csgo') ? 730 : 540,
            //         id : items[i].data[y].id,
            //         real_price : items[i].data[y].price,
            //         classid : items[i].data[y].class,
            //         instanceid : items[i].data[y].instance,
            //         market_hash_name : items[i].market_hash_name,
            //         icon_url : 'https://cdn.'+((items[i].game == 'csgo') ? 'csgo.com' : 'dota2.net')+'/item/'+items[i].market_hash_name+'/300.png',
            //         float : items[i].data[y].extra.float || 'not found',
            //         price : parseFloat((items[i].data[y].price/100).toFixed(2)),
            //         active : false,
            //         selected : false,
            //         key : itemKey
            //     });

            //     itemKey++;
            // }

            // let vgo = await VGO.findAll({
            //     where : {
            //         status : 0
            //     }
            // });

            // for(let i in vgo) 
            // {
            //     secondlist.push({
            //         appid : 'vgo',
            //         id : vgo[i].item_id,
            //         real_price : vgo[i].price*100,
            //         classid : 'vgo',
            //         instanceid : vgo[i].item_id,
            //         market_hash_name : vgo[i].name,
            //         icon_url : vgo[i].img,
            //         float : vgo[i].float,
            //         price : vgo[i].price,
            //         active : false,
            //         selected : false,
            //         key : itemKey
            //     });
            //     itemKey++;
            // }

            pattern.pattern = list;
            pattern.market_price = config.market_balance;

            pattern.pattern.sort((a, b) => {
                if(a.price > b.price) return -1;
                if(a.price < b.price) return 1;
                return 0;
            });
        }

        return res(pattern);
    });
}

exports.patterns = async(get, path, lang) => {
    return new Promise(async(res, rej) => {
        get = get || false;
        let cfg = await execConfig();
        let bots = await Bots.findAll({
            where : {
                active : true,
                time : await getTimeSchema()
            }
        });
        let alerts = await Alerts.findAll();

        let pattern = {
            domain : site.domain,
            nav : false,
            activeTrades : 0,
            usersPattern : bots.length,
            alert : alerts[Math.floor(Math.random()*alerts.length)] || false,
            online : 0,
            title : 'loading..',
            sitename : cfg.sitename,
            href : '',
            rendered : false,
            lastPath : 'index',
            send_comission : cfg.send_comission,
            withdraw_min: cfg.withdraw_min,
            vksend : cfg.vksend,
            vkgroup : cfg.vkgroup,
            login : {
                isAuth : false,
                user : {},
                authorize : false,
                registration : false
            },
            'dice' : {
                rendered : false,
                title : 'Dice',
                bet : 0,
                disableButton : false,
                win : false,
                history : [],
                lastEnterPlay : new Date().getTime(),
                diamond : false,
                games : 0,
                today_bets : 0,
                hash : ''
            },
            'crash' : {
                hasBet  : false,
                betsCount : 0,
                crashed : false,
                rendered : false,
                title : 'Crash',
                isAnimation : false,
                multiplier : 0,
                chart : 'Loading..',
                disableButton : false,
                input : 0,
                status : 0,
                bets : [],
                history : [],
                game_id : 0
            },
            'vgo' : {
                rendered : false,
                title : 'VGO',
                items : [],
                pattern : [],
                vgo : [],
                total : 0,
                selected : [],
                min : 0,
                max : 99999999999,
                search : '',
                sort : 'desc',
                priceSearch : false,
                itemsCount : 12,
                itemsShowed : 0,
                appid : 'vgo',
                market_price : 0,
                activeSchema : 0,
                parsed : false,
                parsing : false,
                disableButton : false,
                searched : 0
            },
            skinsModalDisable : false,
            skinsModalResult : {},
            'skins' : {
                rendered : false,
                title : 'Skins',
                items : [],
                pattern : [],
                vgo : [],
                total : 0,
                selected : [],
                min : 0,
                max : 99999999999,
                search : '',
                sort : 'desc',
                priceSearch : false,
                itemsCount : 12,
                itemsShowed : 0,
                appid : 'vgo',
                market_price : 0,
                activeSchema : 0,
                searched : 0,
                real_button: false,
                schema : [
                    {
                        'ru' : {
                            name : 'Все',
                            from : 0,
                            to : 99999999
                        },
                        'en' : {
                            name : 'All',
                            from : 0,
                            to : 99999999
                        }
                    },
                    {
                        'ru' : {
                            name : '0 - 10K',
                            from : 0,
                            to : 10000
                        },
                        'en' : {
                            name : '$0 - $100',
                            from : 0,
                            to : await getCurrency(100, 'en')
                        }
                    },
                    {
                        'ru' : {
                            name : '10K - 25K',
                            from : 10000,
                            to : 25000
                        },
                        'en' : {
                            name : '$100 - $250',
                            from : await getCurrency(100, 'en'),
                            to : await getCurrency(250, 'en')
                        }
                    },
                    {
                        'ru' : {
                            name : '25K - 50K',
                            from : 25000,
                            to : 25000
                        },
                        'en' : {
                            name : '$250 - $500',
                            from : await getCurrency(250, 'en'),
                            to : await getCurrency(500, 'en')
                        }
                    },
                    {
                        'ru' : {
                            name : '50K - 100K',
                            from : 50000,
                            to : 100000
                        },
                        'en' : {
                            name : '$500 - $1k',
                            from : await getCurrency(500, 'en'),
                            to : await getCurrency(1000, 'en')
                        }
                    },
                    {
                        'ru' : {
                            name : '100K+',
                            from : 100000,
                            to : 99999999999
                        },
                        'en' : {
                            name : '$1k+',
                            from : await getCurrency(1000, 'en'),
                            to : 99999999999
                        }
                    }
                ],
                disableButton : false
            },
            'jackpot' : {
                rendered : false,
                title : 'Jackpot',
                circle : false,
                canvas : null,
                options : {
                    cutoutPercentage : 60,
                    responsive: !0,
                    responsiveAnimationDuration: 0,
                    maintainAspectRatio: !0,
                    events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
                    onClick: null,
                    defaultColor: "rgba(0,0,0,0.1)",
                    defaultFontColor: "#666",
                    defaultFontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                    defaultFontSize: 12,
                    defaultFontStyle: "normal",
                    showLines: !0,
                    elements: {},
                    layout: {
                        padding: {
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0
                        }
                    },
                    legend : {
                        display : false
                    }
                },
                game : {
                    hash : '',
                    status : 0,
                    price : 0,
                    bets : [],
                    users : [],
                    rotate : 0
                },
                winner : {
                    username : '',
                    ticket : '',
                    chance : '',
                    show : false
                },
                timer : {
                    min : '00',
                    sec : '00',
                    mls : '000'
                },  
                disableButton : false,
                colors : ["#ED4C67", "#FFC312", "#12CBC4", "#C4E538", "#FDA7DF", "#EE5A24", "#6F1E51", "#fff200", "#0652DD", "#2C3A47", "#25CCF7", "#ced6e0"]
            },
            'jackpot/history' : {
                rendered : false,
                title : 'история игр',
                games : []
            },
            jackpotHistory : {
                games : []
            },
            'jackpot/myhistory' : {
                rendered : false,
                title : 'мои победы'
            },
            'ref' : {
                rendered : false,
                title : 'Dice',
                refs : 0,
                money : 0
            },
            'pay/history' : {
                rendered : false,
                title : 'История счета'
            },
            payHistory : {
                deposits : [],
                withdraws : [],
                skins : [],
                vgo : []
            },
            'coin' : {
                rendered : false,
                title : 'Coin'
            },
            'fair' : {
                rendered : true,
                title : 'Честная игра',
                hash : ''
            },
            'youtube' : {
                rendered : true,
                title : 'Ютуберам',
            },
            'terms' : {
                rendered : true,
                title : 'Соглашение'
            },
            'bonus' : {
                rendered : true,
                title : 'Ежедневный бонус',
                disableButton : false,
                history : []
            },
            'faq' : {
                rendered : true,
                title : 'FAQ'
            },
            'support' : {
                rendered: true,
                title: 'Support'
            },
            chat : [],
            giveaway : {
                active : false,
                user : {
                    username : '',
                    avatar : '',
                    youtube : {
                        active : false,
                        href : ''
                    },
                    vip : false
                },
                amount : 0
            },
            chat_open : true,
            chat_active: true,
            giveaway_disable: false,
            giveaway_timer: '59:59',
            chat_last : new Date().getTime(),
            chat_delete_time : new Date().getTime(),
            fair_result : {
                checked : false,
                id : '',
                number : '',
                last_ajax : new Date().getTime(),
                disableButton : false,
                last_hash : ''
            },
            send : {
                disableButton : false
            },
            verify : {
                disableButton : false
            },
            refs : {
                disableButton : false
            },
            payment : {
                deposit : {
                    method : 63,
                    disableButton : false,
                    amount : 0
                },
                withdraw : {
                    method : 63,
                    disableButton : false,
                    amount : 0,
                    checked : false 
                },
                methods : {
                    'any' : {
                        name : 'Другие системы',
                        comission : {
                            deposit : 0
                        }
                    },
                    154 : {
                        name : 'Skinpay',
                        comission : {
                            withdraw : 0,
                            deposit : 0,
                            pattern : '0'
                        }
                    },
                    63 : {
                        name : 'Qiwi',
                        comission : {
                            withdraw : 0.04,
                            deposit : 0.088,
                            pattern : '+7xxxxxxxxxx'
                        } // 4%
                    },
                    45 : {
                        name : 'Yandex Money',
                        comission : {
                            withdraw : 0,
                            deposit : 0.093,
                            pattern : 'xxxxxxxxxxxxxx'
                        }
                    },
                    1 : {
                        name : 'Web Money WMR',
                        comission : {
                            withdraw : 0.05,
                            deposit : 0.05,
                            pattern : 'Rxxxxxxxxxxx'
                        }
                    },
                    114 : {
                        name : 'Payeer RUB',
                        comission : {
                            withdraw : 0.045,
                            deposit : 0.088,
                            pattern : 'xxxxxxxxxx'
                        }
                    },
                    94 : {
                        name : 'Visa/MasterCard RUB',
                        comission : {
                            withdraw : 0.1,
                            deposit : 0.04,
                            pattern : 'xxxxxxxxxxxxxxxx'
                        }
                    },
                    82 : {
                        name : 'Мегафон',
                        comission : {
                            withdraw : 0.01,
                            deposit : 0.437,
                            pattern : '+7xxxxxxxxxx'
                        }
                    },
                    132 : {
                        name : 'Tele2',
                        comission : {
                            withdraw : 0.01,
                            deposit : 0.437,
                            pattern : '+7xxxxxxxxxx'
                        }
                    },
                    83 : {
                        name : 'Beeline',
                        comission : {
                            withdraw : 0.01,
                            deposit : 0.508,
                            pattern : '+7xxxxxxxxxx'
                        }
                    },
                    84 : {
                        name : 'МТС',
                        comission : {
                            withdraw : 0.01,
                            deposit : 0.437,
                            pattern : '+7xxxxxxxxxx'
                        }
                    },
                    116 : {
                        name : 'Bitcoin',
                        comission: {
                            withdraw: 0.02,
                            deposit: 0.01,
                            pattern: '....'
                        }
                    }
                }
            },
            captcha : {
                'en' : CaptchaRender('en'),
                'ru' : CaptchaRender('ru')
            },
            lang : await langPattern(),
            ln : (lang) ? lang : 'en',
            langModal : (lang) ? false : true,
            currency : {
                'en' : cfg.usd,
                'ru' : 1
            }
        };

        if(get) return res(pattern[path]);

        return res(pattern);
    });
} 