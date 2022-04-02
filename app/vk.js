const {request} = require('../app/request');
const {execConfig} = require('../app/database');

exports.isMember = (user_id, access_token) => {
    return new Promise(async(res, rej) => {
        let cfg = await execConfig();
        if(cfg.vkgroup === null) return res({
            success: false,
            result: false
        });
        let response = await request('https://api.vk.com/method/groups.isMember?group_id='+(cfg.vkgroup.split('/')[3] || '')+'&user_id='+user_id+'&access_token='+access_token+'&v=5.92');

        if(!response.success) return res(response);

        return res({
            success : true,
            result : response.result.response
        });
    });
}

exports.isMember2 = (user_id, access_token, group) => {
    return new Promise(async(res, rej) => {
        let response = await request('https://api.vk.com/method/groups.isMember?group_id='+group+'&user_id='+user_id+'&access_token='+access_token+'&v=5.92');

        if(!response.success) return res(response);

        return res({
            success : true,
            result : response.result.response
        });
    });
}

exports.hasRepost = async(user_id, access_token) => {
    return new Promise(async(res, rej) => {
        let cfg = await execConfig();
        if(cfg.vkpost === null) return res({
            success: false,
            result: false
        });
        let response = await request('https://api.vk.com/method/wall.get?owner_id='+user_id+'&access_token='+access_token+'&v=5.92');
        if(!response.success) return response;

        let posts = response.result.response.items;
        for(var i in posts) if(typeof posts[i].copy_history !== 'undefined')
        {
            let postID = posts[i].copy_history[0].owner_id + '_' + posts[i].copy_history[0].id;
            if(postID == (cfg.vkpost.split('wall')[1] || '')) return res({
                success : true,
                result : true
            });
        }

        return res({
            success : true,
            result : false
        });
    });
}

exports.parseVkontakteUser = async(user_id, access_token) => {
    return new Promise(async(res, rej) => {
        let response = await request('https://api.vk.com/method/users.get?user_ids='+user_id+'&fields=photo_100,screen_name&access_token='+access_token+'&v=5.92');
        if(!response.success) return response;

        return res({
            success : true,
            result : response
        });
    });
}