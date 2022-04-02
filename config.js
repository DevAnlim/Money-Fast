// Настройки сайта
exports.site = {
    domain : '',
    release : false,
    enableSSL : true
}

// Настройки подключения к базе данных
exports.database = {
    hostname : '',
    database : '',
    username : '',
    password : ''
}

// Данные OPSkins
exports.opskins = {
    apikey : '',
    twofactorsecret : ''
}

// Данные market.csgo.net
exports.market = {
    apikey : ''
}

// Данные от социальных сетей
exports.socialite = {
    vkontakte : {
        appID : '',
        secret : '',
        callbackURL : this.site.domain + 'auth/vkontakte/callback'
    },
    facebook : {
        appID : '',
        secret : '',
        callbackURL : this.site.domain + 'auth/facebook/callback'
    },
    google : {
        appID : '',
        secret : '',
        callbackURL : this.site.domain + 'auth/google/callback'
    },
    steam : {
        apikey : '',
        callbackURL : this.site.domain + 'auth/steam/callback'
    }
}

exports.reCaptcha = {
    site : '',
    secret : ''
}