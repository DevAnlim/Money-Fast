



exports.getTransaction = function() {
    return Database.transaction({
        isolationLevel : Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
    });
}

exports.getCommitedTransaction = function() {
    return Database.transaction({
        isolationLevel : Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });
}

exports.execConfig = () => {
    return new Promise(async(res, rej) => {
        let cfg = await this.Config.findOne({
            order : [['id', 'desc']]
        });
        if(!cfg) 
        {
            cfg = await this.Config.create();
            cfg = cfg.get({plain:true});
        }
        return res(cfg);
    });
}

exports.Alerts = Database.define(name('alerts'), {
    ru : Sequelize.STRING,
    en : Sequelize.STRING
});


exports.Jackpot = Database.define(name('jackpot'), {
    winner_id : {
        type : Sequelize.INTEGER,
        defaultValue : null
    },
    winner_chance : {
        type : Sequelize.DOUBLE,
        defaultValue : null
    },
    winner_ticket : {
        type : Sequelize.INTEGER,
        defaultValue : null
    },
    max_bots: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    winner : Sequelize.JSON,
    isFake : {
        type : Sequelize.BOOLEAN,
        defaultValue : false
    },
    hash : Sequelize.STRING,
    price : {
        type : Sequelize.DOUBLE,
        defaultValue : 0
    },
    status : {
        type : Sequelize.INTEGER,
        defaultValue : 0
    },
    rotate : {
        type : Sequelize.DOUBLE,
        defaultValue : 0
    },
    comission : {
        type : Sequelize.DOUBLE,
        defaultValue : 0
    },
    send : {
        type : Sequelize.INTEGER,
        defaultValue : 0
    }
});

exports.JackpotBets = Database.define(name('jackpot_bets'), {
    user_id : Sequelize.INTEGER,
    game_id : Sequelize.INTEGER,
    user : Sequelize.JSON,
    amount : Sequelize.DOUBLE,
    fake : {
        type : Sequelize.BOOLEAN,
        defaultValue : false
    }
});

exports.Withdraw = Database.define(name('withdraws'), {
    user_id : Sequelize.INTEGER,
    user : Sequelize.JSON,
    info : Sequelize.JSON,
    amount : Sequelize.DOUBLE,
    price : Sequelize.DOUBLE,
    method : Sequelize.INTEGER,
    status : {
        type : Sequelize.INTEGER,
        defaultValue : 0
    }
});

exports.Dice = Database.define(name('dice'), {
    user_id : Sequelize.INTEGER,
    user : Sequelize.JSON,
    price : Sequelize.DOUBLE,
    number : Sequelize.DOUBLE,
    multiplier : Sequelize.DOUBLE,
    chance : Sequelize.DOUBLE,
    won : Sequelize.DOUBLE,
    hash : Sequelize.STRING,
    isFake : {
        type : Sequelize.BOOLEAN,
        defaultValue : false
    }
});


exports.Bots =
    }
});

exports.Sequelize = Sequelize;
exports.Op = Sequelize.Op;

exports.startDatabase = () => {
    return new Promise(async(res, rej) => {
        Database.sync().then(() => {
            this.log('База данных запущена!');
            return res(true);
        }, () => {
            this.log('Ошибка при подключении..');
            return res(false);
        });
    });
}

exports.log = (log) => console.log('[PostgreSQL] ' + log);