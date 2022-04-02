const DateFormat = require('dateformat');

exports.Today = () => {
    return DateFormat(new Date().getTime(), 'yyyy-mm-dd 00:00:00')
}

exports.Week = () => {
    return DateFormat(new Date().getTime()-(7*24*60*60*1000), 'yyyy-mm-dd 00:00:00')
}

exports.Month = () => {
    return DateFormat(new Date().getTime(), 'yyyy-mm-01 00:00:00')
}

exports.ToNextday = () => {
    return ((23-new Date().getHours()*60*60*1000)+((59-new Date().getMinutes())*60*1000)+((59-new Date().getSeconds())*1000)+(1000-new Date().getMilliseconds()));
}