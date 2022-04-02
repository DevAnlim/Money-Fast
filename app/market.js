const {request} = require('./request');
const {MarketItems, MarketBuys, Users, Sequelize, execConfig, Items} = require('./database');
const Crypto = require('crypto');
const {sendToUser} = require('./websocket');
const {toUSD} = require('../app/helpers');
const {market} = require('../config');

exports.apikey = market.apikey;

// LaE76haL47OIBf29ssBx5tvr6bFH2pw - dota2
exports.check = [];
exports.actions = [];
exports.actions_check = false;

exports.init = async() => {
    this.config = await execConfig();
    // let ping = await this.ping();
    this.actions.push({
        action : 'ping'
    });
    // let balance = await this.getMoney();
    this.actions.push({
        action : 'balance'
    });
    let items = await MarketBuys.findAll({
        where : {
            status : 1
        }
    });

    for(let i in items) this.actions.push({
        action : 'signature',
        signature : items[i].custom_id
    });

    let itemsToBuy = await MarketBuys.findAll({
        where : {
            status : 0
        }
    });

    for(let i in itemsToBuy)
    {
        this.actions.push({
            action : 'buy_item',
            trade : {
                item : itemsToBuy[i].item,
                offer : itemsToBuy[i].offer,
                custom : itemsToBuy[i].custom_id,
                user : {
                    id : itemsToBuy[i].user_id
                }
            }
        });
    }

    this.actions.push({
        action : 'updateItems',
        game : 'all'
    });

    setInterval(() => {
        this.actions.push({
            action : 'updateItems',
            game : 'all'
        });
    }, 20000);

    setInterval(() => {
        this.actions.push({
            action : 'ping'
        });
    }, (3*60*1000));

    this.checkActions();
}

exports.activeTrades = (user_id) => {
    return new Promise(async(res, rej) => {
        let items = await Items.findAll({
            where : {
                owner_id : user_id,
                status : 2
            }
        });

        let ids = [];
        for(let i in items)
        {
            let found = false;
            for(let u in ids) if(ids[u] == items[i].withdraw) found = true;
            if(!found) ids.push(items[i].withdraw);
        }

        return res(ids.length);
    });
}

exports.constructTrade = (withID) => {
    return new Promise(async(res, rej) => {
        let items = await Items.findAll({
            where : {
                withdraw : withID
            }
        });

        let game = 'vgo';
        if(parseInt(items[0].appid) == 730) game = 'CS:GO';
        if(parseInt(items[0].appid) == 540) game =' Dota 2';
        if(items[0].appid == 'real')
        {
            let cfg = await execConfig();
            // game = cfg.sitename;
            game = 'EBABKI';
        }


        let withdraw = {};
            withdraw.id = withID;
            withdraw.items = [];
            withdraw.price = 0;
            withdraw.game = game;
            withdraw.appid = parseInt(items[0].appid) || (items[0].appid == 'vgo') ? 'vgo' : 'real';
            withdraw.user = await Users.findOne({
                where : {
                    id : items[0].owner_id
                }
            });
            withdraw.cancel = false;
            withdraw.accept = false;
            withdraw.trade = items[0].trade;


        let status = [];    
        for(let i in items)
        {
            withdraw.items.push({
                market_hash_name : items[i].market_hash_name,
                icon_url : items[i].icon_url,
                price : items[i].price,
                status : items[i].status,
                mhn: items[i].mhn
            });

            withdraw.price += items[i].price;
            status.push(items[i].status);
        }

        status.sort((a, b) => {
            if(a < b) return -1;
            if(a > b) return 1;
            return 0;
        });

        withdraw.status = status[0];
        withdraw.itemsStatus = status;

        return res(withdraw);
    });
}

exports.getGame = (appid) => {
    if(appid == 730 || appid == '730') return 'csgo';
    if(appid == 540 || appid == '540') return 'dota2';
    return false;
}

exports.getAppId = (game) => {
    if(game == 'csgo') return 730;
    if(game == 'dota2') return 540;
    if(game == 'real') return 'real';
    return false;
}

exports.checkActions = async() => {
    if(this.actions.length < 1) 
    {
        this.actions_check = false;
        setTimeout(this.checkActions, 1000);
        return;
    }

    this.actions_check = true;

    let action = this.actions[0];

    let newActions = [];
    for(let i = 1; i < this.actions.length; i++) newActions[(i-1)] = this.actions[i];
    this.actions = newActions;


    let result = false;

    switch(action.action)
    {
        case 'balance' : 
            result = await this.getMoney();
            break;

        case 'ping' :
            result = await this.ping();
            break;

        case 'updateItems' :
            if(action.game == 'all')
            {
                this.actions.push({
                    action : 'updateItems',
                    game : 'csgo'
                });
                this.actions.push({
                    action : 'updateItems',
                    game : 'dota2'
                });
                this.actions.push({
                    action : 'updateItems',
                    game : 'real'
                });

                result = true;
            } else {
                result = await this.updateItems(action.game);
            }
            break;

        case 'signature' :
            result = await this.checkSignature(action.signature);
            break;
        case 'searchItemsByHashnames' : 
            result = await this.searchItemsByHashnames(action.names, action.game);
            break;
        case 'buy_item' :
            result = await this.buyItem(action.trade);
            break;
    }

    if(!result) this.actions.push(action);

    setTimeout(this.checkActions, 500);
}


exports.checkSignature = async(signature) => {
    return new Promise(async(res, rej) => {
        let checkResult = await this.getItemState(signature);
        if(checkResult.success)
        {
            let stage = parseInt(checkResult.data.stage);

            let order = await MarketBuys.findOne({
                where : {
                    custom_id : signature
                }
            });
            if(!order) return;

            let item = await Items.findOne({
                where : {
                    sign : signature
                }
            });

            let offer_id = order.offer_id,
                new_offer_id = (offer_id > 0) ? offer_id : (checkResult.data.trade_id || 0);

            await MarketBuys.update({
                status : stage,
                item : checkResult.data,
                offer_id : new_offer_id
            }, {
                where : {
                    custom_id : signature
                }
            });

            let status = 3;
            if(stage == 1) status = 3;
            if(stage == 1 && offer_id > 0) status = 4;
            if(stage == 2) status = 5;
            if(stage == 5) status = 6;

            await Items.update({
                status : status
            }, {
                where : {
                    id : item.id
                }
            });

            sendToUser(order.user_id, {
                type : 'update_skins',
                offer: await this.constructTrade(item.withdraw)
            });

            if(offer_id != new_offer_id) 
            {
                sendToUser(order.user_id, {
                    type : 'message',
                    msg : {
                        success : true,
                        msg : 'Обмен отправлен!',
                        msg_en : 'Offer sent!'
                    }
                });
                this.log('Обмен отправлен!');
            }

            this.log('['+checkResult.data.item_id+'] ' + checkResult.data.market_hash_name + ' : ' + stage);
            this.log('['+checkResult.data.item_id+'] TradeID : ' + (checkResult.data.trade_id || 'none') + ' Send Until : ' + (checkResult.data.send_until || 'not sent'));

            if(stage == 5 && offer_id == 0)
            {
                await Users.update({
                    balance : Sequelize.literal('"balance"+' + order.price)
                }, {
                    where : {
                        id : order.user_id
                    }
                });

                sendToUser(order.user_id, {
                    type : 'message',
                    msg : {
                        success : true,
                        msg : 'Владелец не принял предложение. На ваш баланс зачислено ' + order.price + ' руб.',
                        msg_en : 'The owner did not accept the offer. Credited to your balance ' + (await toUSD(order.price, 2)) + ' USD.'
                    }
                });
            } else if(stage == 5 && offer_id > 0) {
                sendToUser(order.user_id, {
                    type : 'message',
                    msg : {
                        success : false,
                        msg : 'Вы не успели принять предложение обмена!'
                    }
                });
            }

            if(stage != 1) return res(true);
        }

        return res(false);
    });
}

exports.resetItems = (withID) => {
    return new Promise(async(res, rej) => {
        let resetItems = await Items.findAll({
            where : {
                withdraw : withID
            }
        });

        for(let i in resetItems)
        {
            let item = resetItems[i];
            await Items.create({
                owner_id : 0,
                offer : {},
                offer_id : 0,
                sign : '',
                appid : item.appid,
                itemid : item.itemid,
                market_hash_name : item.market_hash_name,
                icon_url : item.icon_url,
                class : item.class,
                instance : item.instance,
                price : item.price,
                real_price : item.real_price,
                extra : item.extra,
                trade : {},
                withdraw : 0,
                status : 0,
                size: item.size
            });
        }

        return res(true);
    });
}

exports.updateItems = async(game) => {
    return new Promise(async(res, rej) => {
        let items = await MarketItems.findAll({
            where : {
                game : game
            }
        });

        if(game == 'dota2' || game == 'real')
        {
            for(let i in items) 
            {
                let count = await Items.findAll({
                    where : {
                        market_hash_name : items[i].market_hash_name,
                        appid : this.getAppId(game).toString(),
                        status : 0
                    }
                });

                await MarketItems.update({
                    count : count.length
                }, {
                    where : {
                        id : items[i].id
                    }
                });
            }
        }

        if(game == 'csgo')
        {
            let names = [], key = -1, anotherI = 0;
            for(let i = 0; i < items.length; i++)
            {
                if((i/50) == Math.floor(i/50)) 
                {
                    names.push({});
                    key++;
                    anotherI = 0;
                }

                names[key]['list_hash_name['+anotherI+']'] = items[i].market_hash_name;

                anotherI++;
            }
            for(let i = 0; i < names.length; i++) this.actions.push({
                action : 'searchItemsByHashnames',
                names : names[i],
                game : game
            });
        }
        return res(true);
    });
}    

exports.getMoney = () => {
    return new Promise(async(res, rej) => {
        let result = await this.marketApi('/api/v2/get-money', {}, 'any');
        if(!result) return;

        this.config.market_balance = parseFloat(result.money)*100;
        await this.config.save();
        
        this.log('Баланс market.csgo : ' + result.money + ' ' + result.currency);

        return res(true);
    });
}

exports.buyFor = async(trade) => {
    return new Promise(async(res, rej) => {
        let promises = [];

        let i = 0;
        while(i < trade.items.length) 
        {
            let CustomID = Crypto.randomBytes(25).toString('hex');

            await Items.update({
                sign : CustomID
            }, {
                where : {
                    id : trade.items[i].dbid
                }
            });

            await MarketBuys.create({
                user_id : trade.user.id,
                custom_id : CustomID,
                item : trade.items[i],
                price : trade.items[i].price,
                offer : trade.trade,
                status : 0
            });

            this.actions.push({
                action : 'buy_item',
                trade : {
                    item : trade.items[i],
                    offer : trade.trade,
                    custom : CustomID,
                    user : trade.user
                }
            });

            i++;
        }

        return res(true);
    });
}

exports.getItemState = (signature, game) => {
    return new Promise(async(res, rej) => {
        let result = await this.marketApi('/api/v2/get-buy-info-by-custom-id', {
            custom_id : signature
        }, game);
        return res(result);
    });
}

exports.buyItem = async(data) => {
    return new Promise(async(res, rej) => {
        let result = await this.marketApi('/api/v2/buy-for', {
            // id : data.item.id,
            hash_name : data.item.market_hash_name,
            price : data.item.price*100,
            partner : data.offer.partner,
            token : data.offer.token,
            custom_id : data.custom
        }, this.getGame(data.item.appid));

        if(result && result.success)
        {
            await MarketBuys.update({
                user_id : data.user.id,
                custom_id : data.custom,
                item : result.data,
                price : data.item.price,
                status : 1
            }, {
                where : {
                    custom_id : data.custom
                }
            });
            this.actions.push({
                action : 'signature',
                signature : data.custom
            });

            return res(true);
        } else {

            await Users.update({
                balance : Sequelize.literal('"balance"+' + data.item.price)
            }, {
                where : {
                    id : data.user.id
                }
            });

            await Items.update({
                status : 7
            },{
                where : {
                    id : data.item.dbid
                }
            });

            sendToUser(data.user.id, {
                type : 'update_skins',
                offer: await this.constructTrade(data.item.withdraw)
            });

            let user = await Users.findOne({
                where : {
                    id : data.user.id
                }
            });

            sendToUser(user.id, {
                type : 'balance',
                balance : user.balance
            });
            
            sendToUser(data.user.id, {
                type : 'message',
                msg : {
                    success : false,
                    msg : 'Ошибка при покупке предмета ' + data.item.market_hash_name,
                    msg_en : 'Error when buying item ' + data.item.market_hash_name
                }
            });
            return res(true);
        }

        return res(true);
    });
}

exports.searchItemsByHashnames = (hashnames, game) => {
    return new Promise(async(res, rej) => {
        let result = await this.marketApi('/api/v2/search-list-items-by-hash-name-all', hashnames, game);
        if(!result) return;
        if(result.success)
        {
            let deleted = 0,
                created = 0,
                updated = 0;

            let dbItems = await Items.findAll({
                where : {
                    appid : ((game == 'csgo') ? 730 : 540).toString()
                }
            });

            let doneItems = [];

            for(let i in result.data) 
            {
                let dbItem = await MarketItems.findOne({
                    where : {
                        market_hash_name : i,
                        game : game
                    }
                });

                let dbItemCount = 0;


                if(dbItem)
                {
                    let CurrentItem = 0;
                    while(CurrentItem < result.data[i].length)
                    {

                        let item = result.data[i][CurrentItem], 
                            found = false,
                            itemPrice = parseFloat((parseInt(item.price)/100).toFixed(2));
                        for(let u in dbItems) if(dbItems[u].itemid == item.id) found = true;
                        
                        if((found && itemPrice <= dbItem.price))
                        {
                            await Items.update({
                                price : dbItem.price
                            }, {
                                where : {
                                    itemid : item.id.toString()
                                }
                            });
                            doneItems.push(item.id);
                            updated++;

                            dbItemCount++;
                        } else if(itemPrice <= dbItem.price) {
                            await Items.create({
                                appid : (game == 'csgo') ? 730 : 540,
                                itemid : item.id,
                                market_hash_name : i,
                                icon_url : 'https://cdn.csgo.com/item/' + i + '/300.png',
                                class : item.class.toString(),
                                instance : item.instance.toString(),
                                price : dbItem.price,
                                real_price : parseInt(item.price)*100,
                                extra : {},
                            });
                            doneItems.push(item.id);
                            created++;
                            dbItemCount++;
                        } else if(item.status != 0) {
                            doneItems.push(item.id);
                        }

                        CurrentItem++;
                    }

                    await MarketItems.update({
                        count : dbItemCount
                    }, {
                        where : {
                            id : dbItem.id
                        }
                    });
                }
            }

            for(let i = 0; i < dbItems.length; i++)
            {
                let found = false;
                for(let u in doneItems) if(dbItems[i].itemid == doneItems[u]) found = true;
                if(!found && dbItems[i].status == 0) 
                {
                    await Items.destroy({
                        where : {
                            itemid : dbItems[i].itemid.toString()
                        }
                    });
                    deleted++;
                }
            }

            this.log('Created : ' + created + ' Updated : ' + updated + ' Deleted : ' + deleted);

            return res(true);
        } else {
            return res(false);
        }
    });
}

exports.ping = async(game) => {
    return new Promise(async(res, rej) => {
        let result = await this.marketApi('/api/v2/ping', {}, game);
        if(!result) return;
        return res(true);
    });
}

setInterval(() => {
    this.ping();
}, (3*60*1000));

exports.test = async(game) => {
    return new Promise(async(res, rej) => {
        let result = await this.marketApi('/api/v2/test', {}, game);
        if(!result) return;
    });
}

exports.parseNames = async() => {
    if(typeof this.names[0] == 'undefined') return;

    let nowItem = this.names[0],
        newNames = [];
    for(let i = 1; i < this.names.length; i++) newNames.push(this.names[i]);
    this.names = newNames;

    return this.searchItemsByHashnames(nowItem);
}

exports.getPrices = (currency) => {
    return new Promise(async(res, rej) => {
        let result = await this.marketApi('https://market.csgo.com/api/v2/prices/'+currency+'.json');
        if(!result) return;

        if(result.success)
        {
            let names = [], key = -1, anotherI = 0;
            for(let i = 0; i < result.items.length; i++)
            {
                if((i/50) == Math.floor(i/50)) 
                {
                    names.push({});
                    key++;
                    anotherI = 0;
                }

                names[key]['list_hash_name['+anotherI+']'] = result.items[i].market_hash_name;

                anotherI++;
            }

            this.names = names;
            this.parseNames();
            
        }
    });
}

exports.marketApi = (href, querySearch, game) => {
    return new Promise(async(res, rej) => {
        game = game || 'csgo';
        if(game == 'any')
        {
            let games = ['dota2', 'csgo'];
            game = games[Math.floor(Math.random()*games.length)];
        }

        if(game == 'dota2') href = 'https://market.dota2.net' + href;
        if(game == 'csgo') href = 'https://market.csgo.com' + href;

        href = new URL(href);
        let query = (href.search.length > 0) ? new URLSearchParams(href.searchParams) : new URLSearchParams(querySearch);

        // добавляем поиск из массива @querySearch
        if(querySearch) for(let i in querySearch) query.append(i, querySearch[i]);
        

        // добавляем апи ключ к запросу
        query.append('key', this.apikey);
        
        // обновляем запрос
        href.search = query;
        
        let response = await request(href.href, 'market', 'post');
        if(response.success) return res(response.result);
        this.log(response.msg);
        return res(false, response.msg);
    });
}

exports.log = (log) => console.log('[Market] ' + log);