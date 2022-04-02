const {request} = require('../app/request');
const {Items, getTransaction} = require('../app/database');
const {getprices} = require('steam-price-api');
const {readFileSync} = require('fs');
exports.key = 'VhxVO1TcGY9uJ2AFk1kj18umCn0';
exports.prices = JSON.parse(readFileSync('/var/www/html/app/prices.json'));

exports.getInventory = async(steamid64, appid, contextid) => {
    return new Promise(async(res, rej) => {
        let response = await request('https://api.steamapis.com/steam/inventory/'+steamid64+'/'+appid+'/'+contextid+'?api_key=' + this.key, 'steamapi');
        if(!response.success)
        {
            if(typeof response.result.error !== 'undefined') 
            {
                this.log(response.result.error);
                return res(false);
            }
        }

        let assets = response.result.assets;
        for(let a in assets) for(let i in response.result.descriptions) {
            let item = response.result.descriptions[i];
            if(response.result.descriptions[i].classid == assets[a].classid && response.result.descriptions[i].instanceid == assets[a].instanceid)
            {
                assets[a].market_hash_name = item.market_hash_name;
                assets[a].icon_url = item.icon_url
                assets[a].active = item.tradable && item.marketable;
            }
        }

        let t = await getTransaction();
        try {
            for(let i in assets)
            {
                let item = await Items.findOne({
                    where : {
                        assetid : assets[i].assetid
                    },
                    transaction : t
                });

                if(typeof this.prices[assets[i].market_hash_name] != 'undefined')
                {
                    let price = parseFloat(this.prices[assets[i].market_hash_name].price)*66;

                    // if(!item) 
                    await Items.create({
                        bot : 0,
                        appid : assets[i].appid,
                        assetid : assets[i].assetid,
                        classid : assets[i].classid,
                        instanceid : assets[i].instanceid,
                        market_hash_name : assets[i].market_hash_name,
                        icon_url : assets[i].icon_url,
                        price : price,
                        active : assets[i].active    
                    }, {
                        transaction : t
                    });
                }
            }

            await t.commit();
        } catch(e) {
            await t.rollback();
            console.log(e);
            return this.log('Ошибка при записи предметов в базу данных!');
        }

        return res(true);
    });
}

exports.log = log => console.log('[SteamAPI] ' + log);