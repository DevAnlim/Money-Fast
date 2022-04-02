const {request} = require('../app/request');

exports.parseSteamUser = (user_id, apikey) => {
    return new Promise(async(res, rej) => {
        let response = await request('http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key='+apikey+'&steamids=' + user_id);
        console.log(response);
        if(!response.success) return response;

        return res({
            success : true,
            result : response
        });
    });
}