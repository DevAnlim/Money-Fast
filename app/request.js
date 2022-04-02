const {get, post} = require('requestify');
exports.request = (path, sys, method) => {
    return new Promise((res,rej) => {
        let req = (method == 'post') ? post(path) : get(path);
        req.then((r) => {
            // success data
            r = JSON.parse(r.body);
            if(sys == 'market')
            {
                if(typeof r.error != 'undefined') return res({
                    success : false,
                    msg : r.error
                });
            }
            return res({
                success : true,
                result : r
            });
        }, (r) => {
            // another redirects to vkontakte/steam api
            if(method != 'post' && sys != 'steamapi') return res({
                success : false,
                msg : 'Что-то пошло не так!'
            });

            // get redirect to steamapis.com
            r = JSON.parse(r.body);
            return res({
                success : false,
                result : r
            });
        });
    });
}