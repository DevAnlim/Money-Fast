const { ProfitLine, getTransaction, Sequelize } = require('./database');
const { Today } = require('./date');

exports.types = ['crash', 'dice', 'jackpot', 'send'];

exports.execute = (value) => {
    return new Promise((res, rej) => {
        this.types.forEach(async type => {
            let TypeExist = await ProfitLine.findOne({
                where: {
                    type: type,
                    date: Today()
                }
            });

            if(!TypeExist)
            {
                this.log('Не удалось найти тип ' + type);
                await ProfitLine.create({
                    value: 0,
                    type: type,
                    date: Today()
                });
                this.log('Тип ' + type + ' успешно создан!');
            }
        });
        return res(true);
    });
}

exports.plus = (value, type) => {
    return new Promise(async(res, rej) => {
        await this.execute();

        let AwailableType = false;
        for(let i in this.types) if(this.types[i] == type) AwailableType = true;
        if(!AwailableType)
        {
            this.log('Недопустимый тип данных! Отмена..');
            return res(false);
        }

        let t = await getTransaction();
        try {
            await ProfitLine.update({
                value: Sequelize.literal('"value"+'+value)
            }, {
                where: {
                    type: type,
                    date: Today()
                },
                transaction: t
            });
            await t.commit();
        } catch(e) {
            this.log('Ошибка при добавлении профита!');
            console.log(e);
            await t.rollback();
            return;
        }

        let newline = await ProfitLine.findOne({
            where: {
                type: type,
                date: Today()
            }
        });

        this.log(Today() + ' ' + type + ' profit: ' + newline.value);

        return res(true);
    });
}

exports.log = (log) => console.log('[PROFIT] ' + log);