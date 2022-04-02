const expresstrade = require('expresstrade');
const {execConfig, Items, VGOTrades, Sequelize, Op, Users} = require('./database');
const {sendToUser} = require('./websocket');
const {constructTrade} = require('../app/market');
const {toUSD} = require('../app/helpers');
const {opskins} = require('../config');
exports.opskins = new expresstrade({
    apikey : opskins.apikey,
    twofactorsecret : opskins.twofactorsecret,
    pollInterval : 1000
});

exports.getInvetory = (steamid64) => {
    return new Promise(async(res, rej) => {
        if(!steamid64 || steamid64 == 'me')
        {
            this.opskins.IUser.GetInventory({app_id : 1}, (err, result) => {
                return res({
                    error : err,
                    result : result
                });
            });
        } else {
            this.opskins.ITrade.GetUserInventoryFromSteamId({steam_id: steamid64}, (err, result) => {
                return res({
                    error : err,
                    result : result
                });
            });
        }
    });
}

exports.parseInventory = (steamid64) => {
    return new Promise(async(res, rej) => {
        let inv = await this.getInvetory(steamid64),
            items = (inv.error === null) ? inv.result.response.items : false;
            
        if(!items) 
        {
            this.log('Ошибка при загрузке предметов! [steamid:' + steamid64 + ']');
            return res(false);
        }

        let list = [];
        for(let i in items) if(items[i].tradable && items[i].internal_app_id == 1) list.push({
            item_id : items[i].id,
            name : items[i].name,
            img : items[i].image['300px'],
            price : (items[i].suggested_price/100)*((steamid64 == 'me') ? 1.1 : 0.90),
            float : items[i].wear
        });

        return res(list);
    });
}

// this.opskins.on

exports.sendReceiveTrade = (trade) => {
    return new Promise(async(res, rej) => {
        console.log(trade);
        let itemsString = '';
        for(let i = 0; i < trade.items.length; i++) itemsString += trade.items[i].id + ((i < (trade.items.length-1)) ? ',' : '');
        this.opskins.ITrade.SendOfferToSteamId({steam_id: trade.steamid64, items_to_receive: itemsString}, async(err, body) => {
            if(err) return res(false);
            if(typeof body.response == 'undefined') return res(body.message);

            let offer = await VGOTrades.create({
                offer : body.response.offer.id,
                user_id : trade.user,
                items : trade.items
            });

            sendToUser(offer.user_id, {
                type : 'vgo_trade',
                trade : offer.get({plain:true})
            });

            return res(true);
        });
    });
}

exports.sendTrade = (trade) => {
    return new Promise(async(res, rej) => {
        console.log(trade);
        let itemsString = '';
        for(let i = 0; i < trade.items.length; i++) itemsString += trade.items[i].id + ((i < (trade.items.length-1)) ? ',' : '');
        this.opskins.ITrade.SendOfferToSteamId({steam_id: trade.trade, items_to_send: itemsString}, async(err, body) => {
            if(err) return res(false);
            if(typeof body.response == 'undefined') return res(body.message);

            for(let i in trade.items) await Items.update({
                offer_id : body.response.offer.id
            }, {
                where : {
                    id : trade.items[i].dbid
                }
            });
            return res(true);
        });
    });
}

exports.updateItems = () => {
    return new Promise(async(res, rej) => {
        let cfg = await execConfig();
        let items = await this.parseInventory('me');
        for(let i in items)
        {
            let item = await Items.findOne({
                where: {
                    appid: 'vgo',
                    itemid: items[i].item_id.toString()
                }
            });

            if(!item || item.status == 6)
            {
                await Items.create({
                    appid : 'vgo',
                    itemid : items[i].item_id.toString(),
                    market_hash_name : items[i].name,
                    icon_url : items[i].img,
                    class : 'vgo',
                    instance : items[i].item_id.toString(),
                    price : parseFloat((items[i].price*cfg.usd).toFixed(2)),
                    real_price : Math.floor(items[i].price*10000),
                    extra : []
                }); 
            }
        }

        this.log('VGO skins updated!');
        return res(true);
        // let skins = await Items.findAll({
        //     where : {
        //         appid : 'vgo'
        //     }
        // }),
        // myitems = await this.parseInventory('me');
        // done = [];

        // let deleted = 0,
        //     updated = 0,
        //     created = 0;
            
        // for(let i in myitems)
        // {
        //     let item_id = myitems[i].item_id, 
        //         found = false,
        //         dbKey = 0;
        //     for(let u = 0; u < skins.length; u++) if(skins[u].itemid == item_id) 
        //     {
        //         found = true;
        //         dbKey = u;
        //     }

        //     if(found && skins[dbKey].status > 5) 
        //     {
        //         let itemWithZeroStatus = await Items.findOne({
        //             where : {
        //                 itemid : item_id.toString(),
        //                 appid : 'vgo',
        //                 status : 0
        //             }
        //         });

        //         if(!itemWithZeroStatus)
        //         {
        //             done.push(item_id);
        //             found = false;
        //         }
        //     }

        //     if(found) 
        //     {
        //         await Items.update({
        //             price : parseFloat((myitems[i].price*66).toFixed(2)),
        //             real_price : Math.floor(myitems[i].price*10000)
        //         }, {
        //             where : {
        //                 itemid : item_id.toString()
        //             }
        //         });
        //         done.push(item_id);
        //         updated++;
        //     }

        //     if(!found)
        //     {
        //         await Items.create({
        //             appid : 'vgo',
        //             itemid : item_id.toString(),
        //             market_hash_name : myitems[i].name,
        //             icon_url : myitems[i].img,
        //             class : 'vgo',
        //             instance : myitems[i].item_id.toString(),
        //             price : parseFloat((myitems[i].price*66).toFixed(2)),
        //             real_price : Math.floor(myitems[i].price*10000),
        //             extra : []
        //         });
        //         created++;
        //     }
        // }

        // for(let i in skins)
        // {
        //     let found = false;
        //     for(let u in done) if(done[u] == skins[i].itemid) found = true;
        //     if(!found) 
        //     {
        //         await Items.destroy({
        //             where : {
        //                 itemid : skins[i].itemid
        //             }
        //         });
        //         deleted++;
        //     }
        // }

        // this.log('Created : ' + created + ' Updated : ' + updated + ' Deleted : ' + deleted);

        // return res(true);
    });
}

exports.init = async() => {
    this.config = await execConfig();
    let result = await this.updateItems();
    setTimeout(this.init, (2*60*1000));
}

exports.updateOfferStatus = (offer, status) => {
    return new Promise(async(res, rej) => {
        if(offer.sent_by_you && offer.sender.items.length > 0 && offer.recipient.items.length == 0)
        {
            let items = await Items.findAll({
                where : {
                    offer_id : offer.id
                }
            });

            if(items.length < 1) return;
            
            for(let i in items) await Items.update({
                status : status
            }, {
                where : {
                    id : items[i].id
                }
            });

            sendToUser(items[0].owner_id, {
                type : 'update_skins',
                offer : await constructTrade(items[0].withdraw)
            });
            
            if(status == 4)
            {
                sendToUser(items[0].owner_id, {
                    type : "message",
                    msg : {
                        success : true,
                        msg : 'Обмен отправлен!',
                        msg_en : 'Offer sent!'
                    }
                });
            }
        }

        if(offer.sent_by_you && offer.sender.items.length == 0 && offer.recipient.items.length > 0)
        {
            let trade = await VGOTrades.findOne({
                where : {
                    offer : offer.id
                }
            });

            if(!trade) return;

            await VGOTrades.update({
                status : status
            }, {
                where : {
                    id : trade.id
                }
            });

            if(status == 5)
            {
                let cfg = await execConfig();

                let items = offer.recipient.items,
                    cost = 0;

                for(let i in items) cost += (items[i].suggested_price*0.90)*cfg.usd;
                cost = parseFloat((cost/100).toFixed(2));

                let user = await Users.findOne({
                    where: {
                        id: trade.user_id
                    }
                });

                trade.balance_before = user.balance;
                trade.balance_after = user.balance+cost;
                trade.price = cost;

                await Users.update({
                    balance : Sequelize.literal('"balance"+' + cost)
                }, {
                    where : {
                        id : trade.user_id
                    }
                });

                sendToUser(trade.user_id, {
                    type : 'balance',
                    user : trade.user_id,
                    balance : trade.balance_after
                });

                sendToUser(trade.user_id, {
                    type : 'message',
                    msg : {
                        success : true,
                        msg : 'Транзакция #' + offer.id + ' прошла успешно! На ваш баланс зачислено ' + cost.toFixed(2) + ' руб!',
                        msg_en : 'Транзакция #' + offer.id + ' прошла успешно! На ваш баланс зачислено ' + (await toUSD(cost, 2)) + ' руб!'
                    }
                });
            }

            trade.status = status;

            sendToUser(trade.user_id, {
                type : 'vgo_trade',
                trade : trade
            });

            await trade.save();
        }

        await this.updateItems();
    });
}

exports.notify = () => {
    this.opskins.on('offerSent', async(offer) => {
        // withdraw offer
        await this.updateOfferStatus(offer, 4);
    });
    
    this.opskins.on('offerAccepted', async(offer) => {
        await this.updateOfferStatus(offer, 5);
    });
    
    this.opskins.on('offerDeclined', async(offer) => {
        await this.updateOfferStatus(offer, 6);
    });
    
    this.opskins.on('offerCancelled', async(offer) => {
        await this.updateOfferStatus(offer, 6);
    });
    
    this.opskins.on('offerExpired', async(offer) => {
        await this.updateOfferStatus(offer, 6);
    });


}

exports.log = (log) => console.log('[OPSkins VGO] ' + log);