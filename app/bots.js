const {Bots, getTransaction, Crash, CrashBets, execConfig, Dice, Op, Jackpot, JackpotBets, Sequelize} = require('../app/database');
const {sendAll} = require('../app/websocket');
const {shuffle} = require('../app/helpers');
const {Today} = require('../app/date');
const Crypto = require('crypto');
const Redis = require('redis').createClient({
    path : '/var/run/redis/redis.sock'
});

// time
exports.getTimeSchema = () => {
    return new Promise((res, rej) => {
        let h = new Date().getHours();
        if(h >= 0 && h < 6) return res(0); // 0:00-6:00
        if(h >= 6 && h < 12) return res(1); // 6:00-12:00
        if(h >= 12 && h < 18) return res(2); // 12:00-18:00
        return res(3); // 18:00-00:00 
    });
}


// CRASH

exports.CrashInit = async() => {
    this.log('Расстановка ботов Crash приложения..');
    return new Promise(async(res, rej) => {
        let game = await Crash.findOne({
            order : [['id', 'desc']]
        });

        if(!game) return res(false);

        let bets = await CrashBets.findAll({
            where : {
                round_id : game.id,
                fake : true
            }
        });

        let list = [];
        for(let i in bets) list.push({
            id : bets[i].user_id,
            v : bets[i].cashout,
            cashout : bets[i].status
        });

        return res(list);
    });
}

exports.CrashBots = async() => {
    return new Promise(async(res, rej) => {
        let config = await execConfig();

        let bots = await Bots.findAll({
            where : {
                crash : true,
                active : true,
                time : await this.getTimeSchema()
            }
        });

        let list = [];

        for(let i in bots) if(Math.random()*100 > 50) {
            let id = bots[i].id,
                cashouts = bots[i].bets_crash_cashout.split(' '),
                schema = this.createSchema(cashouts[Math.floor(Math.random()*cashouts.length)] || 'rand');

            list.push({
                id : id,
                v : schema,
                cashout : false
            });

            setTimeout(() => {
                this.CrashBet(id, schema);
            }, Math.floor(Math.random()*(config.crash_timer*1000)));
        }

        return res(list);
    });
}

exports.CrashBet = async(id, schema) => {
    let game = await Crash.findOne({
        order : [['id', 'desc']]
    });

    let bot = await Bots.findOne({
        where : {
            id : id,
            crash : true,
            active : true
        }
    });

    if(!bot || !game) return;

    let bets = bot.bets_crash.split(' '),
        amount = parseFloat(bets[Math.floor(Math.random()*bets.length)]) || 10

    let t = await getTransaction(), bet = false;
    try {
        bet = await CrashBets.create({
            user_id : bot.id,
            round_id : game.id,
            user : {
                username  : bot.username,
                avatar : bot.avatar,
                vip : bot.vip,
                youtube : {
                    active : false,
                    href : ''
                }
            },
            price : amount,
            cashout : schema,
            won : 0,
            fake : true
        }, {
            transaction : t
        });

        await t.commit();
    } catch(e) {
        await t.rollback();
        return console.log(e);
        // return this.log('Ошибка при ставке бота!');
    }

    bet = bet.get({plain:true});

    sendAll({
        type : 'crash_bet',
        bet : {
            id : bet.id,
            user_id : parseInt('-'+bet.user_id),
            round_id : game.id,
            user : bet.user,
            price : bet.price,
            status : bet.status,
            won : bet.won,
            cashout : bet.cashout,
            cashouting : false,
            canceling : false
        }
    });

    // this.log('Ставка от бота #' + bot.id + ' вошла в игру #' + game.id);
}

exports.CrashCashout = async(id) => {
    let game = await Crash.findOne({
        order : [['id', 'desc']]
    });

    if(!game) return;

    let bet = await CrashBets.findOne({
        where : {
            round_id : game.id,
            user_id : id,
            fake : true
        }
    });

    if(!bet) return;

    let t = await getTransaction(),
        won = parseFloat((bet.price*bet.cashout).toFixed(2));

    try {
        await CrashBets.update({
            won : won,
            status : 1
        }, {
            where : {
                id : bet.id
            },
            transaction : t
        });

        await t.commit();
    } catch(e) {
        await t.rollback();
        return console.log(e);
        // this.log('Ошибка при выводе ставки #' + id);
    }

    sendAll({
        type : 'crash_bet',
        bet : {
            id : bet.id,
            user_id : parseInt('-'+bet.user_id),
            round_id : bet.round_id,
            user : bet.user,
            price : bet.price,
            cashout : bet.cashout,
            won : won,
            status : 1,
            cashouting : true,
            canceling : true
        }
    });
}

exports.createSchema = (schema) => {
    if(schema == '1') return 1;
    if(schema == '1.xx') return parseFloat('1.'+Math.floor(Math.random()*10)+Math.floor(Math.random()*10));
    if(schema == '1.0x') return parseFloat('1.0'+Math.floor(Math.random()*10));
    if(schema == 'rand') 
    {
        let numList = [100];
        for(let x = 0; x < 10; x++) numList.push(20);
        for(let x = 0; x < 89; x++) numList.push(5);
        // numList = shuffle(numList)[Math.floor(Math.random()*numList.length)];
        return parseFloat((Math.floor(Math.random()*shuffle(numList)[Math.floor(Math.random()*numList.length)])+2)+'.'+Math.floor(Math.random()*10)+Math.floor(Math.random()*10));
    }
    return this.createSchema('1.xx');
}

// DICE
exports.DiceBots = async() => {
    // this.log('Расставляем ботов в дайсе!');

    let time = 0,
        diceBots = await Bots.findAll({
            where : {
                active : true,
                dice : true,
                time : await this.getTimeSchema()
            }
        });

    let y = 0;
    for(let d in diceBots) if(Math.random()*100 > 50)
    {
        let id = diceBots[d].id;

        time += Math.floor(Math.random()*10000);
        setTimeout(() => {
            this.DicePlay(id);
        }, time);
    }

    if(time > 0) return setTimeout(this.DiceBots, time);
    return setTimeout(this.DiceBots, 10000);
}

exports.DicePlay = async(id) => {
    let bot = await Bots.findOne({
        where : {
            id : id,
            dice : true
        }
    });

    if(!bot) return;

    let amounts = bot.bets_dice.split(' '),
        amount = parseFloat(amounts[Math.floor(Math.random()*amounts.length)]) || 10;

    let result = parseFloat((Math.random()*100).toFixed(2));
        number = parseFloat((Math.random()*100).toFixed(2)),
        max = 100-(100-number),
        win = (result > max) ? true : false;

    let chance = (100 - number),        
        multiplier = parseFloat((99/chance).toFixed(2)),
        won = parseFloat((amount*multiplier).toFixed(2));

    let count = await Dice.count() || 0;

    let dice = false;
    try {
        dice = await Dice.create({
            user_id : bot.id,
            user : {
                username : bot.username,
                avatar : bot.avatar,
                profile_url : '',
                vip : bot.vip,
                youtube : {
                    active : false,
                    href : ''
                }
            },
            price : amount,
            number : result,
            multiplier : (win) ? multiplier : 0,
            chance : parseFloat(parseFloat(chance).toFixed(2)),
            won : (win) ? won : parseFloat('-'+amount),
            hash : Crypto.createHash('sha1').update(count+'_dicebot').digest('hex'),
            isFake : true
        });
    } catch(e) {
        return console.log(e);
        // return this.log('Ошибка при ставке в дайсе!');
    }

    dice = dice.get({
        plain : true
    });

    sendAll({
        type : 'dice',
        user : dice.user,
        price : dice.price,
        number : dice.number,
        multiplier : dice.multiplier,
        chance : dice.chance,
        won : dice.won,
        hash : dice.hash,
        games : await Dice.count() || 0,
        today_bets : await Dice.sum('price', {
            where : {
                createdAt : {
                    [Op.gte] : Today()
                }
            }
        }) || 0
    });

    // this.log('Бот #' + id + ' сделал ставку в дайсе и ' + ((win) ? 'победил' : 'проиграл')); 
}

exports.jackpotBots = (status) => {
    if(typeof this.jackpotInterval === 'undefined') this.jackpotInterval = false;
    if(status < 2 && !this.jackpotInterval) 
    {
        this.jackpotInterval = true;
        let time = 0;
        this.jackpot_interval = setInterval(() => {
            time += Math.floor(Math.random()*10000);
            setTimeout(this.jackpotCheckBets, time);
        }, 2000);
        return;
    }
    this.jackpotInterval = false;
    clearInterval(this.jackpot_interval);
}

exports.jackpotCheckBets = async() => {
    let bot = await Bots.findOne({
        where : {
            active : true,
            jackpot : true,
            // time : await this.getTimeSchema(),
            jackpot_used : false
        }
    });


    if(!bot) return;
    // if(!bot) return this.log('bot not found!');

    let game = await Jackpot.findOne({
        order : [['id', 'desc']]
    });

    if(!game) return;
    // if(!game) return this.log('game not found');

    if(game.status > 1) return;

    let bets = await JackpotBets.findAll({
        where : {
            game_id : game.id,
            fake : false
        }
    });

    let fakeBet = await JackpotBets.findAll({
        where : {
            game_id : game.id,
            fake : true
        }
    });

    let canBet = false;

    // если нет ставок вообще
    if(bets.length == 0 && fakeBet.length == 0) canBet = true;
    
    // Если ставки только от реального пользователя
    if(bets.length > 0 && fakeBet.length == 0) canBet = true;
    
    // Если ставки от ботов и реальных пользователей в игре
    if(bets.length > 0 && fakeBet.length > 0) canBet = true;

    if(canBet)
    {
        let amounts = bot.bets_jackpot.split(' '),
            amount = parseInt(amounts[Math.floor(Math.random()*amounts.length)]) || 0;

        if(amount < 1) return;


        let bet = {
            user_id : bot.id,
            game_id : game.id,
            user : {
                username : bot.username,
                avatar : bot.avatar,
                vip : bot.vip,
                youtube : {
                    active : false,
                    href : ''
                }
            },
            amount : amount,
            fake : true
        }

        await Bots.update({
            jackpot_used : true
        }, {
            where : {
                id : bot.id
            }
        });

        await Jackpot.update({
            price : Sequelize.literal('"price"+'+amount)
        }, {
            where : {
                id : game.id
            }
        });

        await JackpotBets.create(bet);

        bet.user_id = parseInt('-'+bet.user_id);
        sendAll({
            type : 'jackpot_update',
            bet : bet
        });

        this.checkJackpotTimer(game.id);

        return this.log('true');
    }

}

exports.jackpotChecker = () => {
    this.jackpot_interval = setInterval(this.jackpotCheckBets, 2000);
}

exports.stopJackpotChecker = () => {
    clearInterval(this.jackpot_interval);
}

exports.checkJackpotTimer = async(id) => {
    let bets = await JackpotBets.findAll({
        where : {
            game_id : id
        }
    });

    let users = [];
    for(var i in bets)
    {
        let found = false;
        for(var u in users) if(users[u] == bets[i].user_id) found = true;
        if(!found) users.push(bets[i].user_id);
    }

    if(users.length >= 2) Redis.publish('jackpot.timer', '@p4r4p3t');
}


exports.log = log => console.log('[Bots] ' + log);