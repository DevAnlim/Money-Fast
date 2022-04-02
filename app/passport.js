const Passport = require('passport');
const LocalStrategy     = require('passport-local').Strategy;
const SteamStrategy     = require('passport-steam').Strategy;
const FBStrategy        = require('passport-facebook').Strategy;
const GoogleStrategy    = require('passport-google-oauth20').Strategy;
const VkontakteStrategy = require('passport-vkontakte').Strategy;
const {Users, getTransaction} = require('./database');
const {socialite, site} = require('../config');


Passport.use(new LocalStrategy(async(username, password, done) => {
    let user = await Users.findOne({
        where : {
            username : username.toLowerCase(),
            password : password,
            method : 'local'
        }
    });

    if(!user) return done(null, null);

    return done(null, user);
}));

Passport.use(new VkontakteStrategy({
    clientID : socialite.vkontakte.appID,
    clientSecret : socialite.vkontakte.secret,
    callbackURL : socialite.vkontakte.callbackURL
}, async(accessToken, refreshToken, params, profile, done) => {
    let res = await this.AuthorizeUser(profile, accessToken);
    return done(res.err, res.user);
}));



Passport.use(new FBStrategy({
    clientID: socialite.facebook.appID,
    clientSecret : socialite.facebook.secret,
    callbackURL : socialite.facebook.callbackURL
}, async(accessToken, refreshToken, profile, done) => {
    let res = await this.AuthorizeUser(profile);
    return done(res.err, res.user);
}));

Passport.use(new GoogleStrategy({
    clientID: socialite.google.appID,
    clientSecret : socialite.google.secret,
    callbackURL : socialite.google.callbackURL,
    scope : ['profile', 'email']
}, async(accessToken, refreshToken, profile, done) => {
    let res = await this.AuthorizeUser(profile);
    return done(res.err, res.user);
}));

Passport.use(new SteamStrategy({
    returnURL: socialite.steam.callbackURL,
    realm: site.domain,
    apiKey: socialite.steam.apikey
}, async(identifier, profile, done) => {
    let res = await this.AuthorizeUser(profile);
    return done(res.err, res.user);
}));



Passport.serializeUser(function(user, done) {
    return done(null, user.id);
});

Passport.deserializeUser(async function(id, done) {
    // change it
    let user = await Users.findOne({
        where : {
            id : id
        }
    });
    return done(null, user);
});

exports.AuthorizeUser = async(profile, accessToken) => {
    return new Promise(async(res, rej) => {
        let user = await Users.findOne({
            where : {
                method : profile.provider,
                second_id : profile.id.toString()
            }
        });

        if(user) 
        {
            await Users.update({
                access_token : (profile.provider == 'vkontakte') ? accessToken : ''
            }, {
                where : {
                    id : user.id
                }
            });

            user = await Users.findOne({
                where : {
                    method : profile.provider,
                    second_id : profile.id.toString()
                }
            });

            return res({
                err : null,
                user : user
            });
        }

        let Transaction = await getTransaction();

        try {
            await Users.create({
                second_id : profile.id.toString(),
                profile_url : profile.profileUrl,
                method : profile.provider,
                username : profile.displayName,
                avatar : profile.photos[0].value,
                access_token : (profile.provider == 'vkontakte') ? accessToken : '',
                ref_code : (profile.provider == 'vkontakte') ? profile.id.toString() : 'ref',
                balance : (site.release) ? 0 : 1000,
                is_admin : (site.release) ? 0 : 0
            }, {
                transaction : Transaction
            });

            await Transaction.commit();
        } catch (e) {
            await Transaction.rollback();
            return res({
                err : e,
                user : null
            });
        }

        user = await Users.findOne({
            where : {
                method : profile.provider,
                second_id : profile.id.toString()
            }
        });

        return res({
            err : null,
            user : user
        });
    });
}
module.exports = Passport;