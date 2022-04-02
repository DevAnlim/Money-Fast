const {sendAll, sendToUser} = require('./websocket');
const {Users,Crash,CrashBets, Sequelize, getTransaction, execConfig, Op, Config, Bots} = require('./database');
const {CrashCashout, CrashBots, CrashInit} = require('./bots');
const Crypto = require('crypto');
const Redis = require('redis').createClient({
    path : '/var/run/redis/redis.sock'
});
const {promisify} = require('util');
const {shuffle, profitState} = require('./helpers');
const getAsync = promisify(Redis.get).bind(Redis);
const setAsync = promisify(Redis.set).bind(Redis);
const { plus } = require('./profit');

exports.game = null;
exports.timer = false;
exports.timer_end = true;
exports.bots = [];



exports.init = async() => {
    this.log('Запуск приложения..');

    // need it
    this._now = 0;
    this._data = [];

    this.game = await Crash.findOne({
        order : [['id', 'DESC']]
    });

    if(!this.game || this.game === null) 
    {
        return this.newGame();
    }

    this.config = await execConfig();
    this.bots = await CrashInit();

    this.log('Игра #' + this.game.id + ' [' + this.game.status + ']');
    if(this.game.status == 0) this.startTimer();
    if(this.game.status == 1) this.startSlider();
    if(this.game.status == 2) this.newGame();
}

exports.startTimer = async() => {
    if(this.timer || !this.timer_end) return;
    this.timer_end = false;
    this.timer = true;
    this.log('Запуск таймера..');
    this.time = this.config.crash_timer*100;
    this.timerInterval = setInterval(() => {
        this.time -= 10;
        sendAll({
            type : 'crash_timer', 
            value : (this.time/100).toFixed(1)
        });
        // if(this.time%100 == 0) this.log('Start in ' + Math.floor(this.time/100) + 's.');
        if(this.time <= 0 || parseInt(this.time) <= 0)
        {
            this.log('Остановка таймера..');
            clearInterval(this.timerInterval);
            this.startSlider();
        }
    }, 100);
}

exports.updateStatus = status => {
    return new Promise(async(res, rej) => {
        await Crash.update({
            status : status
        }, {
            where : {
                id : this.game.id
            }
        });
        return res(true);
    });
}

exports.getFloat = () => {
    return new Promise(async(res, rej) => {
        let game = await Crash.findOne({
            order : [['id', 'desc']]
        });

        let schema = {
            '1' : 20,
            '1.0x' : 200,
            '1.xx' : 550,
            'rand' : 230
        }
    
        let list = [];
        for(var i in schema) for(var u = 0; u < schema[i]; u++) list.push(this.createSchema(i));
    
        return res(shuffle(list));
    });
}

exports.getSchema = (num) => {
    let schema = '1';
    if(num > 1 && num < 2) schema = '1.xx';
    if(num > 2) schema = 'rand';
    if(num > 1 && num < 1.11)  schema = '1.0x';
    return schema;
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
        return parseFloat((Math.floor(Math.random()*shuffle(numList)[Math.floor(Math.random()*numList.length)])+2)+'.'+Math.floor(Math.random()*10)+Math.floor(Math.random()*10));
    }
    return this.createSchema('1.xx');
}

exports.startSlider = async() => {
    await this.updateStatus(1);
    this.timer_end = true;

    this.log('Запуск линии..');

    if(this.config.crash_line.length <= 0)
    {
        let list = await this.getFloat();
        await Config.update({
            crash_line : list
        }, {
            where : {
                id : this.config.id
            }
        });
        this.config = await execConfig();
        return this.startSlider();
    }

    this.config.crash_line = shuffle(this.config.crash_line);
    let float = this.config.crash_line[0];
    let list = [];
    for(var i = 1; i < this.config.crash_line.length; i++) list.push(this.config.crash_line[i]);

    await Crash.update({
        number : float
    }, {
        where : {
            id : this.game.id
        }
    });

    await Config.update({
        crash_line : list
    }, {
        where : {
            id : this.config.id
        }
    });

    this.game.number = float;

    await setAsync('cashout', 1);

    this._i = 0;
    this.animateInterval = setInterval(async() => {
        this._i++;
        this._now = parseFloat(Math.pow(Math.E, 0.00006*this._i*1000/20));
        sendAll({
            type : 'crash_slider',
            now : this._now
        });

        await setAsync('float', this._now.toFixed(2));

        for(let x = 0; x < this.bots.length; x++) if(!this.bots[x].cashout && parseFloat(this.bots[x].v) <= this._now) 
        {
            this.bots[x].cashout = true;
            CrashCashout(this.bots[x].id);
        }

        if(this._now >= this.game.number) 
        {
            await this.updateStatus(2);
            this._now = this.game.number;
            sendAll({
                type : 'crash_slider',
                now : this._now,
                crashed : true
            });
            clearInterval(this.animateInterval);

            this._now = 0;
            setTimeout(() => {
                this.newGame();
            }, 3000);
        } else {
            if((parseFloat(Math.pow(Math.E, 0.00006*(this._i+3)*1000/20))) >= this.game.number)
            {
                await setAsync('cashout', 0);
            }
        }
    }, 50);  
}

exports.newGame = async() => {
    let lastGame = await Crash.findOne({
        order : [['id', 'DESC']]
    });

    if(lastGame)
    {
        let t = await getTransaction();

        let bets = await CrashBets.findAll({
            where : {
                round_id : lastGame.id,
                status : 0
            }
        });

        try {
            for(var i in bets) if(bets[i].cashout > 0 && bets[i].cashout < lastGame.number) {
                let user = await Users.findOne({
                    where : {
                        id : bets[i].user_id
                    }
                });
    
                if(user)
                {
                    let won = parseFloat((bets[i].price*bets[i].cashout).toFixed(2)),
                        balance = user.balance+won;
    
                    await Users.update({
                        balance : balance
                    }, {
                        where : {
                            id : user.id
                        },
                        transaction : t
                    });
    
                    await CrashBets.update({
                        status : 1,
                        won : won
                    }, {
                        where : {
                            id : bets[i].id
                        },
                        transaction : t
                    });

                    sendToUser(bets[i].user_id, {
                        type : 'balance',
                        user : bets[i].user_id,
                        balance : balance
                    });
                }
            }

            await t.commit();
        } catch(e) {
            await t.rollback();
        }
    }

    if(this.game !== null)
    {
        console.log('Current game profit : ' + await this.currentGameProfit());
        await plus(await this.currentGameProfit(), 'crash');
    }



    let game = await Crash.create({
        hash : Crypto.createHash('sha1').update(((lastGame) ? lastGame.id.toString() : '0') + '_crash').digest('hex'),
        number : 0
    });

    this.game = game.get({plain:true});
    this.config = await execConfig();

    this.bots = await CrashBots(); // запрашиваем карту ботов

    let bets = await CrashBets.findAll({
        where : {
            round_id : {
                [Sequelize.Op.gte] : game.id
            }
        },
        order : [['id', 'desc']]
    }),
    betsList = [];

    for(var i in bets) betsList.unshift({
        id : bets[i].id,
        price : bets[i].price,
        round_id : bets[i].round_id,
        cashout : bets[i].cashout,
        user : bets[i].user,
        user_id : bets[i].user_id,
        won : bets[i].won,
        status : bets[i].status,
        cashouting : false,
        canceling : false
    });

    sendAll({
        type : 'crash_reset',
        hash : this.game.hash,
        id : this.game.id,
        game : {
            number : (lastGame) ? lastGame.number : false,
            hash : (lastGame) ? lastGame.hash : false
        },
        bets : betsList
    });

    this.timer = false;
    this.startTimer();

    this.log('Новая игра #' + this.game.id);
}

exports.currentGameProfit = () => {
    return new Promise(async(res, rej) => {
        if(this.game == null) return res(0);
        let bets = await CrashBets.findAll({
            where: {
                round_id: this.game.id,
                fake: false
            }
        });

        let won = 0, amount = 0;
        bets.forEach(bet => {
            amount += bet.price;
            won += bet.won
        });

        return res(amount-won);
    });
}

exports.log = (log) => console.log('[CRASH] ' + log);