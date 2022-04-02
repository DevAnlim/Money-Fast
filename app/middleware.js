const {reactPaths} = require('./helpers');
exports.RenderList = async(req, res, next) => {
    if(req.method != 'POST') return res.send('Method not available');
    if(reactPaths.includes(req.body.path)) return next();
    return res.json({
        code : 404,
        error : 'Page not found!'
    });
}

exports.auth = async(req, res, next) => {
    if(req.path == '/') return next();
    if(req.method == 'POST' && !req.user) return res.json({
        success : false,
        msg : 'Вы должны быть авторизованы!'
    });

    if(req.method == 'POST' && req.user && req.user.ban.active && req.user.is_admin < 2) return res.json({
        success : false,
        msg : 'Вы были заблокированы! Причина : ' + req.user.ban.reason
    });

    if(!req.user) return res.redirect('/');
    return next();
}


exports.vip = async(req, res, next) => {
    if(!req.user.vip && req.method == 'GET') return res.send('У вас нет прав вип игрока!');
    if(!req.user.vip) return res.json({
        success : false,
        msg : 'У вас нет прав випа!'
    });
    return next();
}

exports.admin = async(req, res, next) => {
    if(!req.user && req.method == 'GET') return res.redirect('/');
    if(!req.user && req.method == 'POST') return res.send('Access denied!');

    if(req.user.is_admin < 2)
    {
        if(req.method == 'POST') return res.json({
            success : false,
            msg : 'Access denied!'
        });
        return res.send('Access denied!');
    }

    return next();
}

exports.moder = async(req, res, next) => {
    if(req.user.is_admin < 1)
    {
        if(req.method == 'POST') return res.json({
            success : false,
            msg : 'Access denied!'
        });
        return res.send('Access denied!');
    }

    return next();
}