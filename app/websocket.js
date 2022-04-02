const fs = require('fs');
const {site} = require('../config');
const server = require('http' + ((site.enableSSL) ? 's' : '')).createServer((site.enableSSL) ? {
    cert : fs.readFileSync('/var/www/html/certificate/certificate.crt').toString(),
    key : fs.readFileSync('/var/www/html/certificate/key.pem').toString()
} : {});
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const Crypto = require('crypto');

wss.getUniqueID = function() {
    let unique = Crypto.randomBytes(50).toString('hex');
    
    let found = false;
    this.clients.forEach(client => {
        if(client.id == unique) found = true;
    });
    if(found) return this.getUniqueID();
    return unique;
}

wss.notify = [];
wss.checkNotify = function(ws) {
    if(ws.readyState != WebSocket.OPEN) return;
    for(var i = 0; i < this.notify.length; i++) if(this.notify[i] && this.notify[i].id == ws.user.id) 
    {
        ws.send(JSON.stringify(this.notify[i].res));
        delete this.notify[i];
    }
}

const self = this;

wss.getOnline = function() {
    let users = [], connections = 0, ips = [];
    this.clients.forEach(client => {
        if(client.readyState == WebSocket.OPEN) 
        {
            connections++;

            let {isset, key} = 0;
            for(var i = 0; i < users.length; i++) if(client.auth)
            {
                if(users[i].user.id == client.user.id) {
                    isset = 1;
                    key = i;
                }
            }
            
            if(isset && client.auth) users[key].connections.push(client.id);
            if(!isset && client.auth) users.push({
                user : client.user,
                connections : [client.id]
            });

            // обнуляем значения и ищем айпишники
            isset = false;
            for(var i = 0; i < ips.length; i++) if(ips[i] == client.realIP) isset = true;
            if(!isset) ips.push(client.realIP);
        }
    });
    
    self.sendAll({
        type : 'online',
        online : {
            users : users || [],
            connections : connections,
            ips : ips || []
        }
    });
}


// var self = this;
wss.on('connection', function connection(ws, req) {
    ws.id = wss.getUniqueID();
    ws.realIP = (ws._socket.remoteAddress || req.connection.remoteAddress).replace('::ffff:', '');
    ws.is_admin = 0;
    ws.auth = false;
    ws.connect = true;

    wss.getOnline();

    ws.on('message', function incoming(res) {
        res = JSON.parse(res);
        if(res.type == 'auth')
        {
            ws.auth = true;
            ws.user = res.user;
            wss.getOnline();
        }
        if(res.type == 'logout')
        {
            ws.auth = false;
            ws.user = undefined;
            wss.getOnline();
        }
        if(res.type == 'is_admin') ws.is_admin = 1;
        if(res.type == 'online') wss.getOnline();
    });

    ws.on('close', () => {
        ws.connect = false;
        wss.getOnline();
    });
});


exports.sendAll = (res) => {
    wss.clients.forEach(client => {
        if(client.readyState == WebSocket.OPEN) client.send(JSON.stringify(res));
    });
}

exports.sendToAdmin = (res) => {
    wss.clients.forEach(client => {
        if(client.readyState == WebSocket.OPEN && client.is_admin) 
        {
            client.send(JSON.stringify(res));
        }
    });
}

exports.sendToUser = (user_id, res) => {
    let found = false;
    wss.clients.forEach(client => {
        if(client.readyState == WebSocket.OPEN && client.auth && client.user.id == user_id) 
        {
            found = true;
            client.send(JSON.stringify(res));
        }
    });
    if(!found) wss.notify.push({
        id : user_id,
        res : res
    });
}


server.listen(2083);