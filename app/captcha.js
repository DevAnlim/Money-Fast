const {reCaptcha} = require('../config');
const Recaptcha = require('express-recaptcha').Recaptcha;
const Captcha = new Recaptcha(reCaptcha.site, reCaptcha.secret);

exports.CaptchaRender = (lang) => {
    return Captcha.renderWith({'hl':lang})
};

exports.CaptchaVerify = (req, res, next) => {
    console.log('CaptchaVerify');
    Captcha.verify(req, (error, data) => {
        if(error)
        {
            console.log(error, data);
            return res.json({
                success : false,
                msg : 'Что-то не так с капчей!',
                msg_en : 'Something went wrong with captcha!'
            });
        } else {
            return next();
        }
    });
}
