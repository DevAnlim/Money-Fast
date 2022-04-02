// secret1 - 1ynrqz9f
// secret2 - 1ynrqz9f
// id - 105568

//F105664653 : F5A5402EF4DBD96B3E1E71C3921D6287

var lastUsage = 0;
const Requestify = require('requestify');
const {request} = require('../app/request');
const Url = require('url');
const XML2JSON = require('xml2json');
const Crypto = require('crypto');
const Request = require('request');
const {execConfig, Config} = require('../app/database');


exports.makeApiRequest = (query) => {
    return new Promise(async(res, rej) => {

        let RequestParams = Url.format({
            protocol : 'https',
            hostname : 'www.free-kassa.ru',
            pathname : '/api.php',
            query : query
        });

        let RequestResponse = false;
        try
        {
            RequestResponse = await Requestify.get(RequestParams.toString());
            RequestResponse = JSON.parse(XML2JSON.toJson(RequestResponse.body)).root;
        } catch(e) {
            return res({
                success : false,
                error : 'Ошибка при обращении к ' + RequestParams.toString()
            });
        }

        lastUsage = new Date().getTime(); // 

        if(RequestResponse.answer == 'info' && query.action == 'get_balance') return res({
            success : true,
            balance : parseFloat(RequestResponse.balance)
        });

        if(RequestResponse.answer == 'info' && query.action == 'payment') return res({
            success : true,
            PaymentId : RequestResponse.PaymentId
        });

        if(RequestResponse.answer == 'info' && query.action == 'check_order_status') return res({
            success : true,
            info : {
                status : RequestResponse.status,
                id : RequestResponse.id,
                date : RequestResponse.date,
                amount : RequestResponse.amount
            }
        });

        if(RequestResponse.answer == 'error') return res({
            success : false,
            error : RequestResponse.desc
        });
        
        return res({
            success : false,
            error : false
        });
    });
}

exports.makeRequest = (url, form) => {
    return new Promise((res, rej) => {
        let RequestResponse = Request.post({
            url : url,
            form : form
        }, (err, response, body) => {
            if(err) return res(false);
            return res(JSON.parse(body));
        });
    });
}

exports.makeApiV1Request = (query) => {
    return new Promise(async(res, rej) => {

        let RequestResponse = await this.makeRequest('https://www.fkwallet.ru/api_v1.php', query);

        lastUsage = new Date().getTime(); // 

        if(RequestResponse.status == 'info' && query.action == 'get_balance') return res({
            success : true,
            balance : RequestResponse.data.RUR
        });

        if(RequestResponse.status == 'info' && query.action == 'cashout') return res({
            success : true,
            id : RequestResponse.data.payment_id
        });

        if(RequestResponse.status == 'error') return res({
            success : false,
            error : RequestResponse.desc
        });
    });
}

exports._fkSend  = (order) => {
    return new Promise(async(res, rej) => {

        let RequestParams = {
            wallet_id : this.config.fkwallet_id,
            purse : order.info.wallet,
            amount : order.amount,
            desc : this.config.sitename + ' : Транзакция #' + order.id,
            disable_exchange : 1,
            currency : order.method,
            sign : Crypto.createHash('md5').update(this.config.fkwallet_id + order.method + '' + order.amount + '' + order.info.wallet + this.config.fkwallet_api).digest('hex'),
            action : 'cashout'
        }

        return res(await this.makeApiV1Request(RequestParams));
    });
}

exports._fkGetBalance = () => {
    return new Promise(async(res, rej) => {
        let RequestParams = {
            wallet_id : this.config.fkwallet_id,
            sign : Crypto.createHash('md5').update(this.config.fkwallet_id + this.config.fkwallet_api).digest('hex'),
            action : 'get_balance'
        }

        return res(await this.makeApiV1Request(RequestParams));
    });
}

exports.getBalance = () => {
    return new Promise(async(res, rej) => {
        let RequestParams = {
            merchant_id : this.config.freekassa_id,
            s : Crypto.createHash('md5').update(this.config.freekassa_id+this.config.freekassa_secret2).digest('hex'),
            action : 'get_balance'
        }
        
        return res(await this.makeApiRequest(RequestParams));
    });
}



exports.sendToWallet = (amount) => {
    return new Promise(async(res, rej) => {
        let RequestParams = {
            merchant_id : this.config.freekassa_id,
            s : Crypto.createHash('md5').update(this.config.freekassa_id+this.config.freekassa_secret2).digest('hex'),
            amount : amount,
            currency : 'fkw',
            action : 'payment'
        }
        
        return res(await this.makeApiRequest(RequestParams));
    });
}

exports.checkBalance = async() => {
    this.config = await execConfig();
    
    let attrs = ['freekassa_id', 'freekassa_secret1', 'freekassa_secret2', 'fkwallet_id', 'fkwallet_api'];
    for(let i in attrs) if(this.config[attrs[i]] === null || this.config[attrs[i]].length < 1) return this.log('Параметр ' + attrs[i] +  ' не указан в настройках! Отмена..');


    let balance = await this.getBalance();
    let fk_balance = await this._fkGetBalance();

    if(balance.success) console.log('[FreeKassa] Баланс : ' + balance.balance + 'руб.');
    if(fk_balance.success) console.log('[FKWallet] Баланс : ' + fk_balance.balance + 'руб.');

    if(balance.success && fk_balance.success)
    {
        let cfg = await execConfig();
        await Config.update({
            freekassa_balance : (fk_balance.balance)
        }, {
            where : {
                id : cfg.id
            }
        });
    }


    if(balance.success && balance.balance >= 50)
    {   
        setTimeout(async() => {
            let result = await this.sendToWallet(balance.balance);
            if(result.success) console.log('[FreeKassa] Перевели ' + balance.balance + 'руб. на FK кошелек!');
        }, 10001);
    }
}

exports.init = async() => {
    this.log('Инициализация...');
    this.config = await execConfig();
    this.interval = setInterval(async() => {
        if(new Date().getTime() - lastUsage >= 15000) this.checkBalance();
    }, 5000);
}

exports.log = (log) => {
    console.log('[FreeKassa] ' + log);
}