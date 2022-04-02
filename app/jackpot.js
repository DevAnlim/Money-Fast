const {sendAll, sendToUser} = require('./websocket');
const {Users, Sequelize, getTransaction, Jackpot, JackpotBets, execConfig, Bots, Op} = require('./database');
const Crypto = require('crypto');
const {promisify} = require('util');
const {shuffle, toUSD, isTrue} = require('./helpers');
const { getTimeSchema, checkJackpotTimer } = require('./bots');
const { plus } = require('./profit');
const Redis = require('redis').createClient({
    path : '/var/run/redis/redis.sock'
});

Redis.subscribe('jackpot.timer');
Redis.on('message', (channel, message) => {
    if(channel == 'jackpot.timer') 
    {
        this.startTimer();
    }
});

exports.game = false;

exports.cvars = {
    timer : 0,
    slider : 0
}
exports.init = async function() {
    this.log('Jackpot init!');

    setTimeout(() => {
        this.fakeBet();
    }, Math.floor(Math.random()*12000));

    this.game = await Jackpot.findOne({
        order : [['id', 'desc']]
    });
    

    this.config = await execConfig();


    if(!this.game) return this.newGame();

    this.log('Игра #' + this.game.id + ' [' + this.game.status + ']');

    if(this.game.status == 0) this.checkTimer();
    if(this.game.status == 1) this.startTimer();
    if(this.game.status == 2) this.startSlider();
    if(this.game.status == 3) this.newGame();
    if(this.game.status < 2) 
    {
        this._fakeBetInterval = true;
        setTimeout(() => {
            this.fakeBet();
        }, Math.floor(Math.random()*10000));
    }
}

exports.checkTimer = async() => {
    let bets = await JackpotBets.findAll({
        where: {
            game_id: this.game.id
        }
    });

    let users = [];
    bets.forEach(bet => {
        if(bet.fake) bet.user_id = parseInt('-'+bet.user_id);
        let UserExist = false;
        for(let i in users) if(users[i] ==  bet.user_id) UserExist = true;
        if(!UserExist) users.push(bet.user_id);
    });

    if(users.length >= 2) return this.startTimer();
}

exports.updateJackpot = function() {
    return new Promise(async(resolve, reject) => {
        let game = await Jackpot.findOne({
            order: [['id', 'desc']]
        });

        if(!game) return resolve(false);

        let bets = await JackpotBets.findAll({
            where: {
                game_id: game.id
            },
            order: [['id', 'asc']]
        });

        let gameTotalPrice = 0,
            gameUsers = [],
            gameBets = [],
            betsColor = 0,
            from = 0,
            to = 0;

        bets.forEach(bet => {
            if(bet.fake) bet.user_id = parseInt('-' + bet.user_id);

            let UserExist = false,
                BetIndex = false,
                BetColor = betsColor;

            for(let i in gameUsers) if(gameUsers[i].user_id == bet.user_id)
            {
                UserExist = true;
                gameUsers[i].amount += bet.amount;
            }
            for(let i in gameBets) if(gameBets[i].user_id == bet.user_id) BetColor = gameBets[i].color;
            if(!UserExist)
            {
                gameUsers.push({
                    user_id: bet.user_id,
                    user: bet.user,
                    amount: bet.amount,
                    color: BetColor
                });
                betsColor++;
            }

            from = to+1;
            to = from+(bet.amount*100);


            gameBets.push({
                id: bet.id,
                user_id : bet.user_id,
                user : bet.user,
                amount : bet.amount,
                from : from,
                to : to,
                color : BetColor,
                total: bet.amount
            });

            gameTotalPrice += bet.amount;
        });

        for(let i in gameUsers)
        {
            gameUsers[i].chance = parseFloat(((gameUsers[i].amount/gameTotalPrice)*100).toFixed(2));
            for(let u in gameBets) if(gameBets[u].user_id == gameUsers[i].user_id) gameBets[u].chance = gameUsers[i].chance;
        }


        gameUsers.sort((a,b) => {
            if(parseFloat(a.chance) < parseFloat(b.chance)) return -1;
            if(parseFloat(a.chance) > parseFloat(b.chance)) return 1;
            return 0
        });

        gameBets.sort((a,b) => {
            if(a.id > b.id) return -1;
            if(a.id < b.id) return 1;
            return 0
        });

        return resolve({
            price: gameTotalPrice,
            bets: gameBets,
            users: gameUsers,
            rotate: game.rotate,
            hash: game.hash,
            status: game.status
        });
    });
}

exports._fakeBetInterval = false;
exports.fakeBet = async function() {
    if(this.cvars.slider) return;
    let alreadyBet = await isTrue(20);
    let Bets = await JackpotBets.findAll({
        where: {
            game_id: this.game.id
        }
    });
    if(Bets.length < 1) alreadyBet = false;
    let GameUsers = [];
    Bets.forEach(bet => {
        let UserExist = false,
            UserID = (bet.fake) ? (parseInt(bet.user_id)*-1) : parseInt(bet.user_id);
        for(let i in GameUsers) if(GameUsers[i] == UserID) UserExist = true;
        if(!UserExist) GameUsers.push(UserID);
    });
    if(GameUsers.length == 1 && GameUsers[0] < 0) alreadyBet = false;
    let bots = await Bots.findAll({
            where: {
                active: true,
                jackpot: true,
                time: await getTimeSchema()
            }
        });

    let BotsUsed = [], BotsFree = [];
    bots.forEach(fakeUser => {
        if(fakeUser.jackpot_used) BotsUsed.push(fakeUser);
        if(!fakeUser.jackpot_used) BotsFree.push(fakeUser);
    });

    let bot = (alreadyBet) ? (BotsUsed[Math.floor(Math.random()*BotsUsed.length)] || null) : (BotsFree[Math.floor(Math.random()*BotsFree.length)] || null);
    if(bot === null)
    {
        this.log('Не удалось найти бота!');
        if(this._fakeBetInterval)
        {
            setTimeout(() => {
                this.fakeBet();
            }, Math.floor(Math.random() * 10000));
        }
        return;
    }

    if(this.game.max_bots <= BotsUsed.length) 
    {
        this.log('Максимальное количество ботов!');
        if(this._fakeBetInterval)
        {
            setTimeout(() => {
                this.fakeBet();
            }, Math.floor(Math.random() * 10000));
        }
        return;
    }

    let amount = (bot) ? parseInt(bot.bets_jackpot.split(' ')[Math.floor(Math.random()*bot.bets_jackpot.split(' ').length)]) || false : false;

    if(!bot || !amount) 
    {
        if(this._fakeBetInterval)
        {
            setTimeout(() => {
                this.fakeBet();
            }, Math.floor(Math.random() * 10000));
        }
        return;
    }

    let bet = {
        user_id : bot.id,
        game_id : this.game.id,
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

    await JackpotBets.create(bet);

    sendAll({
        type: 'jackpot_update',
        response: await this.updateJackpot()
    });

    checkJackpotTimer(this.game.id);

    if(this._fakeBetInterval) return setTimeout(() => {
        this.fakeBet();
    }, Math.floor(Math.random() * 10000));
}

exports.startTimer = function() {
    if(this.cvars.timer) return;
    if(!this.updateStatus(1)) return;

    this.log('Запуск таймера..');
    this.cvars.timer = true;

    let time = this.config.jackpot_timer;
    this.timerInterval = setInterval(async() => {
        if(time <= 0)
        {
            clearInterval(this.timerInterval);
            this._fakeBetInterval = false;
            if(await this.updateStatus(2)) this.startSlider();
            return;
        }

        time--;
        sendAll({
            type : 'jackpot_timer',
            time : time
        });

        this.log('Таймер : ' + time + 'сек.');
    }, 1000);
}

exports.startSlider = async function() {
    if(this.cvars.slider) return;
    this.cvars.slider = true;
    
    this.game = await Jackpot.findOne({
        order : [['id', 'desc']]
    });

    let bets = await JackpotBets.findAll({
        where : {
            game_id : this.game.id
        }
    });

    // get fake winners games
    let id = this.game.id-(10*Math.floor(this.game.id/10));
    let fakeCount = await Jackpot.findAll({
        where : {
            id : {
                [Op.gte] : id
            },
            winner_id : {
                [Op.lt] : 0
            }
        }
    });

    let resultList = [];
    let fCount = (2-fakeCount.length),
        nCount = (10-id);
    if(fCount > 0) nCount -= fCount;

    for(let i = 0; i < fCount; i++) resultList.push(true);
    for(let i = 0; i < nCount; i++) resultList.push(false);
    resultList = shuffle(resultList);

    if(resultList.length > 0) if(!this.game.winner_ticket) this.game.isFake = resultList[Math.floor(Math.random()*resultList.length)];
    // {
    //     let GambResult = resultList[Math.floor(Math.random()*resultList.length)];
    //     GambResult = true;
    //     console.log(GambResult, this.game.winner_ticket);
    //     if(GambResult && !this.game.winner_ticket) this.game.isFake = resultList[Math.floor(Math.random()*resultList.length)];
    //     {
    //         // let bets = await JackpotBets.findAll({
    //         //     where : {
    //         //         game_id : this.game.id,
    //         //         fake : true
    //         //     }
    //         // });

    //         // console.log(bets.length);

    //         // if(bets.length > 0)
    //         // {
    //         //     let bet = bets[Math.floor(Math.random()*bets.length)];
    //         //     let max = bet.to,
    //         //         min = bet.from;
    //         //     if(bet) this.game.winner_ticket = min+Math.floor((max-min)*Math.random());
    //         //     if(bet) console.log(this.game.winner_ticket, bet.user.username);
    //         // }
    //     }
    // }   

    let price = 0, users = [], from = 0, to = 0;
    for(let i in bets)
    {
        let userID = (bets[i].fake) ? parseInt('-' + bets[i].user_id) : bets[i].user_id;
        price += bets[i].amount;
        let found = false, key = false;
        for(var u in users) if(users[u].user_id == userID) {
            found = true;
            key = u;
        }
        from = to+1;
        to = from+(bets[i].amount*100);
        if(!found) users.push({
            user_id : userID,
            user : bets[i].user,
            price : bets[i].amount,
            color : bets[i].color,
            from: from,
            to: to,
            isFake: bets[i].fake,
            chance : 0,
            start : false,
            end : false
        });
        if(found && key) users[key].price += bets[i].amount;
    }

    let maxTickets = to;

    for(let i in users) users[i].chance = parseFloat(((users[i].price/price)*100).toFixed(2));
    
    users.sort((a,b) => {
        if(a.color > b.color) return 1;
        if(a.color < b.color) return -1;
        return 0
    });

    let dia = [];
    let start = 0;
    for(let i in users)
    {
        users[i].start = start;
        users[i].end = start + (360*(users[i].chance/100));
        start = users[i].end;
    }

    let winnetTicket = (!this.game.winner_ticket) ? Math.floor(Math.random()*maxTickets) : this.game.winner_ticket,
        winnerInfo = false;

    if(this.game.isFake)
    {
        let list = []
        let from = 0, to = 0;
        for(let i in bets) 
        {
            from = to+1;
            to = from + (bets[i].amount*100);
            if(bets[i].fake) list.push({
                user_id: parseInt('-'+bets[i].user_id),
                from: from,
                to: to
            });
        }
        let winBet = list[Math.floor(Math.random()*list.length)] || false;
        if(winBet) winnetTicket = Math.floor(Math.random()*(winBet.to-winBet.from))+winBet.from-1;
    }

    let winner = false,
        fakeWinner = false;
    from = 0;
    to = 0;
    for(var i in bets) 
    {
        from = to+1;
        to = from + (bets[i].amount*100);
        if(from <= winnetTicket && to >= winnetTicket)
        {
            winner = (bets[i].fake) ? parseInt('-' + bets[i].user_id) : bets[i].user_id; 
            fakeWinner = bets[i].fake;
        }
    }

    if(!winner) return this.newGame();

    for(let i in users) if(users[i].user_id == winner && !winnerInfo) winnerInfo = users[i];
    let rotate = Math.floor(Math.random()*(winnerInfo.end-winnerInfo.start))+winnerInfo.start;


    let winnerPrice = parseFloat((price*(1-(this.config.jackpot_comission/100))).toFixed(2));

    // сделать прокрутку
    
    await Jackpot.update({
        winner_id : winner,
        winner_chance : winnerInfo.chance,
        winner_ticket : winnetTicket,
        winner : winnerInfo,
        isFake : fakeWinner,
        rotate : rotate + 1080,
        comission : parseFloat((price-winnerPrice).toFixed(2)),
        price: price
    }, {
        where : {
            id : this.game.id
        }
    });

    sendAll({
        type : 'jackpot_slider',
        rotate : rotate + 1080
    });

    this.game = await Jackpot.findOne({
        where : {
            id : this.game.id
        }
    });
    
    setTimeout(async() => {
        sendAll({
            type : 'jackpot_winner',
            winner : {
                username : this.game.winner.user.username,
                ticket : this.game.winner_ticket,
                chance : this.game.winner_chance,
                show : true
            }
        });
        
        if(!this.game.send && !fakeWinner)
        {
            await Users.update({
                balance : Sequelize.literal('"balance"+'+winnerPrice)
            }, {
                where : {
                    id : this.game.winner_id
                }
            });
            
            sendToUser(winner, {
                type : 'message',
                user : winner,
                msg : {
                    success : true,
                    msg : 'Поздравляем, вы победели в игре #' + this.game.id + '! На ваш баланс зачислено ' + winnerPrice + 'руб.',
                    msg_en : 'Congratulations, you won the game #' + this.game.id + '! Credited to your balance ' + (await toUSD(winnerPrice, 2)) + ' USD.'
                }
            });

            let user = await Users.findOne({
                where : {
                    id : winner
                }
            });

            sendToUser(winner, {
                type : 'balance',
                user : winner,
                balance : user.balance
            });

            await Jackpot.update({
                send : 1
            }, {
                where : {
                    id : this.game.id
                }
            });

            this.game = await Jackpot.findOne({
                where : {
                    id : this.game.id
                }
            });
        }

            setTimeout(async() => {
                await this.updateStatus(3);
                this.newGame();
            }, 3000);
    }, 4000);
}

exports.newGame = async function() {
    this.cvars.timer = false;
    this.cvars.slider = false;

    let lastGame = this.game;

    await plus(await this.currentGameProfit(), 'jackpot');

    let t = await getTransaction();

    try {
        let botsAvailable = await Bots.findAll({
            where: {
                active: true,
                jackpot: true,
                time: await getTimeSchema()
            }
        });

        let game = await Jackpot.create({
            hash : Crypto.createHash('sha1').update(( (this.game) ? (this.game.id+1).toString() : '1' )+'_jackpot').digest('hex'),
            max_bots: Math.floor(Math.random()*botsAvailable.length)+1
        });

        await t.commit();

        this.game = game.get({plain:true});
        this.config = await execConfig();
        this._fakeBetInterval = true;
        setTimeout(() => {
            this.fakeBet();
        }, Math.floor(Math.random()*10000));
    } catch(e) {
        console.log(e);
        this.log('Ошибка при создании новой игры!');
        await t.rollback();
        return setTimeout(() => {
            this.newGame();
        }, 1000);
    }

    await Bots.update({
        jackpot_used : false
    }, {
        where : {
            active : true,
            jackpot : true
        }
    });

    await JackpotBets.destroy({
        where: {
            game_id: {
                [Op.not]: this.game.id
            }
        }
    });

    await Jackpot.destroy({
        where: {
            id: {
                [Op.lt]: this.game.id-15
            }
        }
    });


    sendAll({
        type : 'jackpot_reset',
        game : {
            id : this.game.id,
            hash : this.game.hash,
            price : 0,
            status : 0,
            bets : [],
            users : []
        },
        history : lastGame,
        time : this.config.jackpot_timer
    });

    this.log('Игра #' + this.game.id);
}

exports.currentGameProfit = () => {
    return new Promise(async(res, rej) => {
        if(this.game === null) return res(0);
        let bets = await JackpotBets.findAll({
            where: {
                game_id: this.game.id
            }
        });
        let amount = 0, fake = 0;
        bets.forEach(bet => {
            if(bet.fake) fake += bet.amount;
            if(!bet.fake) amount += bet.amount;
            console.log(bet.amount);
        });

        if(this.game.isFake) return res(amount);
        if(this.config.jackpot_comission == null) return res(0);

        return res(amount*(this.config.jackpot_comission/100));
    });
}

exports.updateStatus = async function(status)
{
    return new Promise(async(res, rej) => {
        try {
            await Jackpot.update({
                status : status
            }, {
                where : {
                    id : this.game.id
                }
            });

            this.game = await Jackpot.findOne({
                where : {
                    id : this.game.id
                }
            });
        } catch(e) {
            this.log('Ошибка при обновлении баланса игры #' + this.game.id);
            console.log(e);
            return res(false);
        }

        sendAll({
            type : 'jackpot_status',
            status : status
        });

        this.log('Изменили статус игры на ' + status);
        return res(true);
    });
}

exports.log = (log) => console.log('[JACKPOT] ' + log);