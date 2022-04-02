const Route = require('express').Router();
const Passport = require('../app/passport');
const {Users, getTransaction} = require('../app/database');
const {CaptchaVerify} = require('../app/captcha');
const {site} = require('../config');


Route.get('/:method/callback', async(req, res, next) => {
    Passport.authenticate(req.params.method, {
        successRedirect : '/auth/clear',
        failureRedirect : '/auth/error'
    }, (err, user, info) => {
        if(err) console.log(err);
        if(err || !user) return res.redirect('/auth/clear');
        req.logIn(user, async(err) => {
            return res.redirect('/auth/clear');
        });
        return next();
    })(req, res, next);
});

Route.get('/:method', async(req, res, next) => {
    if(req.params.method == 'clear') 
    {
        if(req.user)
        {
            let ips = req.user.ips,
                ip = req.headers['x-real-ip'].toString(),
                found = false;
            for(var i in ips) if(ips[i] == ip) found = true;
            if(!found)
            {
                ips.push(ip);
                await Users.update({
                    ips : ips
                }, {
                    where : {
                        id : req.user.id
                    }
                });
            }
        }
        return res.render('clear');
    }
    if(req.params.method == 'logout') {
        req.logout();
        return res.redirect('/');
    }
    Passport.authenticate(req.params.method)(req, res, next);
});

Route.post('/local/auth', CaptchaVerify, (req, res, next) => {
    Passport.authenticate('local')(req, res, next);
}, async(req, res) => {
    console.log('success local auth');
    return res.json({success: true});
});

Route.get('/local', CaptchaVerify, (req, res, next) => {
    if(req.recaptcha.error)
    {
        console.log(req.recaptcha.error);
        return res.send(400, req.recaptcha.error);
    }
    return next();
}, Passport.authenticate('local', { failureRedirect: '/auth/clear', successRedirect:'/auth/clear' }), async(req, res) => {
    return res.send(200, 'ok');
});

Route.post('/local', Passport.authenticate('local'), async(req, res) => {
    if(req.user)
    {
        let ips = req.user.ips,
            ip = req.headers['x-real-ip'].toString(),
            found = false;
        for(var i in ips) if(ips[i] == ip) found = true;
        if(!found)
        {
            ips.push(ip);
            await Users.update({
                ips : ips
            }, {
                where : {
                    id : req.user.id
                }
            });
        }
    }
    return res.json({
        success : true
    });
});

Route.post('/reg', async(req, res) => {
    if(req.body.username.length < 5) return res.json({
        success: false,
        msg: 'Минимальное кол-во символов в логине - 5'
    });

    if(req.body.password.length < 5) return res.json({
        success: false,
        msg: 'Минимальная длина пароля - 5 символов!'
    });

    let user = await Users.findOne({
        where : {
            username : req.body.username.toLowerCase(),
            method : 'local'
        }
    });

    if(user) return res.json({
        success : false,
        msg : 'Такой логин уже занят!',
        msg_en : 'This login is already taken!'
    });
    
    let available = 'abcdefghijklmnopqrstuvwxyz0123456789._';
    for(let i = 0; i < req.body.username.length; i++) 
    {
        let found = false;
        for(let u = 0; u < available.length; u++) if(available[u] == req.body.username[i].toLowerCase()) found = true; 
            
        if(!found) return res.json({
            success : false,
            msg : 'В вашем логине был найден запрещенный символ «'+req.body.username[i]+'»',
            msg_en : 'A forbidden character was found in your login «'+req.body.username[i]+'»'
        });
    }

    let t = await getTransaction();

    try {
        await Users.create({
            second_id : null,
            profile_url : null,
            method : 'local',
            username : req.body.username.toLowerCase(),
            avatar : 'https://pp.userapi.com/c851228/v851228527/52738/pe1IHBUQIBU.jpg',
            password : req.body.password,
            balance : (site.release) ? 0 : 1000,
            is_admin : (site.release) ? 0 : 2
        }, {
            transaction : t
        });

        await t.commit();
    } catch(e) {
        await t.rollback();
        console.log(e);
        return res.json({
            success : false,
            msg : 'Что-то пошло не так',
            msg_en : 'Something went wrong'
        });
    }

    return res.json({
        success : true,
        msg : 'Вы успешно зарегистрировали аккаунт ' + req.body.username,
        msg_en : 'You have successfully registered an account ' + req.body.username
    });
});

Route.post('/check', async(req, res) => {
    return res.json({
        auth : (req.user) ? true : false,
        user : req.user
    });
});

Route.post('/logout', async(req, res) => {
    await req.logout();
    return res.json({
        code : 200
    })
});

module.exports = Route;