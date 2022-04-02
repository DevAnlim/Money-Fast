const Passport      = require('./passport');
const CookieParser  = require('cookie-parser');
const BodyParser    = require('body-parser');
const Session       = require('express-session');
const path          = require('path');
const Express       = require('express');

const App           = Express();
const Redis         = require('connect-redis')(Session);
const Crypto        = require('crypto');


