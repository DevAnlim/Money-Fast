const Express = require('./app/express');
const {log} = require('./app/helpers');
const {WSSend} = require('./app/websocket');
const Crash = require('./app/crash');
const Jackpot = require('./app/jackpot');
const FreeKassa = require('./app/freekassa');
const {DiceBots} = require('./app/bots');
const Market = require('./app/market');
const OPSkins = require('./app/opskins');
const {ToNextday} = require('./app/date');
const {unlinkSync, readFileSync} = require('fs');
const {startDatabase} = require('./app/database');
const {site} = require('./config');
const { execute, plus } = require('./app/profit');
const { GiveawayInit } = require('./app/giveaway');

const Server = require('./app/express').listen(3000, () => {

    let info = Server.address();

    console.log('======================================')
    console.log('   ____   _____ ____  _____  ______ ');
    console.log('  / __ \\ / ____/ __ \\|  __ \\|  ____|');
    console.log(' | |  | | |   | |  | | |  | | |__   ');
    console.log(' | |  | | |   | |  | | |  | |  __|  ');
    console.log(' | |__| | |___| |__| | |__| | |____ ');
    console.log(`  \\___\\_\\_____\\____/|_____/|______|`);
    console.log('\n======================================')
    console.log('Port : ' + info.port + ' | Mode : ' + ((site.release) ? 'RELEASE' : 'DEVELOPMENT') + ' | SSL : ' + ((site.enableSSL) ? 'ON' : 'OFF'));
    console.log('======================================');

    checkDatabaseConnection();
});

async function checkDatabaseConnection() {
    let result = await startDatabase();
    if(!result) return setTimeout(checkDatabaseConnection, 1000);
    initApps();
}

async function initApps() {
    GiveawayInit();
    await execute()
    Crash.init();
    Jackpot.init();
    FreeKassa.init();
    DiceBots();
    Market.init();
    OPSkins.init();
    OPSkins.notify();
}