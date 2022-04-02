const {GiveawayHour, User, Sequelize, Op, Users, Chat} = require('./database');
const {sendAll, sendToUser} = require('./websocket');

exports.cvars = {
  time: 0,
  timer_interval: false,
  interval: false
}
exports.GiveawayInit = async() => {
  let game = await GiveawayHour.findOne({
    where: {
      status: 0
    }
  });
  if(!game) return this.newGame();
  this.log('Раздача #' + game.id + ' началась!');

  this.cvars.time = 3600;
  this.cvars.timer_interval = setInterval(() => {
    this.cvars.time--;
    sendAll({
      type: 'giveaway_timer',
      time: this.format(this.cvars.time)
    });
    if(this.cvars.time <= 0) 
    {
      clearInterval(this.cvars.timer_interval);
      return this.getWinners();
    }
  }, 1000);
}

exports.getWinners = async() => {
  let game = await GiveawayHour.findOne({
    where: {
      status: 0
    }
  });

  if(!game) 
  {
    this.log('Не удалось найти последнюю игру в базе данных!');
    return this.newGame();
  }

  let used = [], users = [], i = 0, finaly = (game.users.length > 5) ? 5 : game.users.length;
  while(i < finaly)
  {
    let key = Math.floor(Math.random()*game.users.length);
    let found = false;
    for(let u in used) if(used[u] == key) found = true;
    if(!found)
    {
      users.push(game.users[key].id);
      used.push(key);
      i++;
    }
  }
  
  await GiveawayHour.update({
    winners: users,
    status: 1
  }, {
    where: {
      id: game.id
    }
  });

  let usersMsg = '';

  for(let i in users)
  {
    let user = await Users.findOne({
      where: {
        id: users[i]
      }
    });
    

    if(user)
    {
      usersMsg += '- ' + user.username + '<br>';

      await Users.update({
        balance: Sequelize.literal('"balance"+5')
      }, {
        where: {
          id: user.id
        }
      });

      sendToUser(user.id, {
        type: 'message',
        user: user.id,
        msg: {
          success: true,
          msg: 'Вы выиграли 5 рублей!',
          msg_en: 'Вы выиграли 5 рублей!'
        }
      });

      sendToUser(user.id, {
        type : 'balance',
        user : user.id,
        balance : user.balance+5
      });
    }
  }

  if(usersMsg.length > 0)
  {
    let chatMsg = await Chat.create({
      user_id : 0,
      user : {
          username : 'Раздача',
          avatar : 'https://pp.userapi.com/c851228/v851228527/52738/pe1IHBUQIBU.jpg',
          id : 0,
          is_admin : 0,
          vip : false,
          youtube : {
              active: false,
              href: ''
          },
          lvl : 0
      },
      message : 'Победители раздачи: <br>' + usersMsg,
      lang : 'ru'
    });

    chatMsg = await Chat.create({
        user_id : 0,
        user : {
            username : 'Giveaway',
            avatar : 'https://pp.userapi.com/c851228/v851228527/52738/pe1IHBUQIBU.jpg',
            id : 0,
            is_admin : 0,
            vip : false,
            youtube : {
                active: false,
                href: ''
            },
            lvl : 0
        },
        message : 'Giveaway winners: <br>' + usersMsg,
        lang : 'en'
    });

    sendAll({
        type : 'chat_new',
        msg : await Chat.findAll({
          order : [['id', 'desc']],
          limit : 20
      })
    });
  }

  return this.newGame();
  
}

exports.newGame = async() => {
  let game = await GiveawayHour.findOne({
    where: {
      status: 0
    }
  });

  if(!game)
  {
    game = await GiveawayHour.create({
      users: [],
      winners: [],
      status: 0
    });

    game = await game.get({plain:true});


    await GiveawayHour.destroy({
      where: {
        id: {
          [Op.lt]: game.id-10
        }
      }
    });

    this.log('Новая раздача #' + game.id + ' началась!');

    return this.GiveawayInit();
  }
}

exports.format = (time) => {
  let min = Math.floor(time/60),
      sec = time-(min*60);

  return ((min < 10) ? '0' + min : min)+':'+((sec < 10) ? '0' + sec : sec);
}

exports.log = log => console.log('[Giveaway] ' + log);