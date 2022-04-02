exports.log = (log) => console.log('[APP:'+(new Date().toISOString().replace('T', ' ').replace('Z', ''))+'] ' + log);

const {Payments, Users, execConfig} = require('../app/database');

// react locations
exports.reactPaths = [
        'dice',
        'profile', 
        'auth', 
        'terms', 
        'faq', 
        'support', 
        'bonus', 
        'fair', 
        'youtube',
        'pay/history',
        'ref',
        'crash',
        'jackpot',
        'jackpot/history',
        'jackpot/myhistory',
        'coin',
        'skins',
        'vgo'
];

exports.random = (min, max) => {
    if(max <= min) return new Error('Max can not be less min');
    return Math.floor(Math.random()*(max-min))+min;
}

exports.profitState = (sum) => {
    return new Promise(async(res, rej) => {
        if(sum == 0) return res(false);

        let deposits = await Payments.sum('amount', {
            where : {
                type : 1,
                status : 1
            }
        });

        let users = await Users.sum('balance');
        let need = users-deposits;

        if(users > deposits && users > 0 && deposits > 0)
        {
            if(sum > need) return res(true);
            if((sum/need)*100 > 10) return res(true);

            let list = [];
            for(let i = 0; i < 35; i++) list.push(true);
            for(let i = 0; i < 65; i++) list.push(false);
            return res(this.shuffle(list)[Math.floor(Math.random()*list.length)]);
        }

        let list = [];
        for(let i = 0; i < 30; i++) list.push(true);
        for(let i = 0; i < 70; i++) list.push(false);
        return res(this.shuffle(list)[Math.floor(Math.random()*list.length)]);
    });
}

exports.reactAdmin = [
    'index',
    'settings',
    'users',
    'users/:id',
    'withdraw',
    'promo',
    'bots',
    'bots/:id',
    'market',
    'alerts',
    'payments'
];

exports.toUSD = (number, afterDot) => {
    return new Promise(async(res, rej) => {
        let cfg = await execConfig();
        number = (parseFloat(number)/cfg.usd).toString().split('.');

        let str = '$' + number[0];

        if(number.length >= 2)
        {
            if(afterDot > 0) str += '.';
            for(let i = 0; i < afterDot; i++) if(typeof number[1][i] !== 'undefined') str += number[1][i];
        }

        return res(str);
    });
}

exports.getCurrency = (number, lang) => {
    return new Promise(async(res, rej) => {
        let cfg = await execConfig();
        if(lang == 'en')
        {
            let array = (number+'').split('.');
            let num = array[0];
            if(typeof array[1] !== 'undefined')
            {
                num += '.';
                for(let i = 0; i < 2; i++) num += array[1][i];
            }

            number = parseFloat(num);
        }
        if(lang == 'ru') return res(number);
        if(lang == 'en') return res(parseFloat(number.toFixed(2))*cfg.usd);
        return res(0);
    });
}

exports.toRUB = (number) => {
    return new Promise(async(res, rej) => {
        let cfg = await execConfig(),
            number = parseFloat(number)*cfg.usd;

        return res(parseFloat(number.toFixed(2)));
    });
}

exports.shuffle = (array) => {
    let list = [],
        keys = [];
    for(let i = 0; i < array.length; i++)
    {
        keys = [];
        for(let u = 0; u < array.length; u++) if(typeof list[u] == 'undefined') keys.push(u);
        let key = Math.floor(Math.random()*keys.length);
        list[keys[key]] = array[i];
    }

    return list;
}

exports.isTrue = (chance) => {
    return new Promise((resolve, reject) => {
        let returnValues = [];
        for(let i = 0; i < parseInt(chance); i++) returnValues.push(true);
        for(let i = 0; i < (100-parseInt(chance)); i++) returnValues.push(false);
        returnValues = this.shuffle(returnValues);
        return resolve(returnValues[Math.floor(Math.random()*returnValues.length)]);
    });
}

exports.methods = {
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
            withdraw : 0.04,
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
    }
}

exports.calcComission = (method, sum) => {
    let comission = this.methods[method].comission.withdraw;
    sum -= sum*comission;
    return parseFloat(sum.toFixed(2));
}