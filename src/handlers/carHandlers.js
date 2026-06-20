const { getCurrentUser } = require('../services/userService');
const { carCardKeyboard } = require('../bot/keyboards');
const { getCarTotals, renderCarCard } = require('../services/carService');
const { decodeVin } = require('../services/vinService');

function registerCarHandlers(bot) {
  bot.action(/^status:(\d+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);

    await ctx.answerCbQuery();

    return ctx.reply('🚦 Вибери статус:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Куплено', callback_data: `setstatus:${carId}:BOUGHT` }],
          [{ text: '🚢 В дорозі', callback_data: `setstatus:${carId}:IN_TRANSIT` }],
          [{ text: '📦 В порту', callback_data: `setstatus:${carId}:PORT` }],
          [{ text: '🔧 На ремонті', callback_data: `setstatus:${carId}:IN_REPAIR` }],
          [{ text: '✅ Готове', callback_data: `setstatus:${carId}:READY` }],
          [{ text: '💸 Продається', callback_data: `setstatus:${carId}:ON_SALE` }],
          [{ text: '🏁 Продано', callback_data: `setstatus:${carId}:SOLD` }]
        ]
      }
    });
  });

  bot.action(/^setstatus:(\d+):(.+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);
    const status = ctx.match[2];

    await ctx.prisma.car.update({
      where: { id: carId },
      data: { status }
    });

    await ctx.answerCbQuery('Статус оновлено');

    const totals = await getCarTotals(ctx.prisma, carId);

    return ctx.reply(
      '✅ Статус авто оновлено\n\n' + renderCarCard(totals),
      carCardKeyboard(carId)
    );
  });

  bot.action(/^open_car:(\d+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);

    const totals = await getCarTotals(ctx.prisma, carId);

    await ctx.answerCbQuery();

    return ctx.reply(
      renderCarCard(totals),
      carCardKeyboard(carId)
    );
  });

  bot.action(/^reminders:(\d+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);

    const car = await ctx.prisma.car.findUnique({
      where: { id: carId },
      include: { reminders: true }
    });

    await ctx.answerCbQuery();

    if (!car) {
      return ctx.reply('Авто не знайдено.');
    }

    const active = car.reminders.filter((r) => r.status === 'active');

    let text = `🔔 Нагадування\n\n`;
    text += `🚘 ${car.brand} ${car.model} ${car.year || ''}\n\n`;

    if (!active.length) {
      text += `Активних нагадувань немає.\n\n`;
    } else {
      active.forEach((r, i) => {
        text += `${i + 1}. ${r.title}\n`;
        text += `ID: ${r.id}\n\n`;
      });
    }

    text += `➕ Додати:\n`;
    text += `/remind ${carId} забрати тачку\n\n`;
    text += `✅ Закрити:\n`;
    text += `/done ID`;

    return ctx.reply(text);
  });

  bot.command('vin', async (ctx) => {
    const vin = ctx.message.text.split(' ')[1];

    if (!vin) {
      return ctx.reply('Введи VIN так:\n/vin WBAxxxxxxxxxxxxxx');
    }

    try {
      const car = await decodeVin(vin);

      return ctx.reply(
        `🚘 VIN Decoder\n\n` +
        `VIN: ${car.vin}\n` +
        `Марка: ${car.brand || '-'}\n` +
        `Модель: ${car.model || '-'}\n` +
        `Рік: ${car.year || '-'}\n` +
        `Кузов: ${car.bodyClass || '-'}\n` +
        `Мотор: ${car.engine || '-'}\n` +
        `Обʼєм: ${car.displacement ? car.displacement + 'L' : '-'}\n` +
        `Циліндри: ${car.engineCylinders || '-'}\n` +
        `Паливо: ${car.fuelType || '-'}\n` +
        `Привід: ${car.driveType || '-'}\n` +
        `Коробка: ${car.transmission || '-'}`
      );
    } catch (error) {
      console.error(error);
      return ctx.reply('Не вийшло розшифрувати VIN. Перевір VIN і спробуй ще раз.');
    }
  });

  bot.command('remind', async (ctx) => {
    const text = ctx.message.text.replace('/remind', '').trim();
    const [carIdRaw, ...titleParts] = text.split(' ');
    const carId = Number(carIdRaw);
    const title = titleParts.join(' ');

    if (!carId || !title) {
      return ctx.reply('Формат:\n/remind 1 забрати тачку');
    }

    await ctx.prisma.reminder.create({
      data: {
        carId,
        title
      }
    });

    return ctx.reply(`🔔 Нагадування додано:\n${title}`);
  });

  bot.command('done', async (ctx) => {
    const reminderId = Number(ctx.message.text.split(' ')[1]);

    if (!reminderId) {
      return ctx.reply('Формат:\n/done ID');
    }

    await ctx.prisma.reminder.update({
      where: { id: reminderId },
      data: { status: 'done' }
    });

    return ctx.reply('✅ Нагадування закрито.');
  });

  bot.command('addcar', async (ctx) => {
    ctx.session.flow = 'ADD_CAR_BRAND';
    ctx.session.data = {};
    return ctx.reply('➕ Додаємо авто. Введи марку, наприклад BMW:');
  });

  bot.command('cars', async (ctx) => {
    const user = await getCurrentUser(ctx);

    const cars = await ctx.prisma.car.findMany({
      where: {
        userId: user.id,
        isDeleted: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!cars.length) {
      return ctx.reply('Поки авто немає. Натисни ➕ Додати авто або /addcar');
    }

    return ctx.reply('🚘 Вибери авто:', {
      reply_markup: {
        inline_keyboard: cars.map((car) => [
          {
            text: `${car.brand} ${car.model} ${car.year || ''}`,
            callback_data: `open_car:${car.id}`
          }
        ])
      }
    });
  });

  bot.command('archive', async (ctx) => {
    const user = await getCurrentUser(ctx);

    const cars = await ctx.prisma.car.findMany({
      where: {
        userId: user.id,
        isDeleted: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!cars.length) {
      return ctx.reply('📂 Архів пустий');
    }

    await ctx.reply('♻️ Архів авто:');

    for (const car of cars) {
      await ctx.reply(
        `♻️ ${car.brand} ${car.model} ${car.year || ''}\nVIN: ${car.vin || '-'}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Відновити',
                  callback_data: `restore_car_${car.id}`
                }
              ]
            ]
          }
        }
      );
    }
  });

  bot.action(/^archive_car_(\d+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);

    await ctx.prisma.car.update({
      where: { id: carId },
      data: { isDeleted: true }
    });

    await ctx.answerCbQuery('Авто перенесено в архів');
    return ctx.reply('🗑 Авто перенесено в архів. Його можна відновити через /archive');
  });

  bot.action(/^restore_car_(\d+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);

    await ctx.prisma.car.update({
      where: { id: carId },
      data: { isDeleted: false }
    });

    await ctx.answerCbQuery('Авто відновлено');
    return ctx.reply('✅ Авто відновлено. Воно знову буде в “Мої авто”.');
  });

  bot.action(/^sell:(\d+)$/, async (ctx) => {
  const carId = Number(ctx.match[1]);

  await ctx.answerCbQuery();

  ctx.session.flow = 'SELL_CAR_PRICE';
  ctx.session.data = { carId };

  return ctx.reply('💰 Введи ціну продажу авто, наприклад 14500:');
});

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session.flow;
    const data = ctx.session.data || {};
    const text = ctx.message.text.trim();

   if (!flow) {
    return next();
}

if (flow === 'SELL_CAR_PRICE') {
  const carId = data.carId;
  const sellPrice = Number(text.replace(',', '.')) || 0;

  const car = await ctx.prisma.car.update({
    where: { id: carId },
    data: {
      sellPrice,
      soldAt: new Date(),
      status: 'SOLD'
    }
  });

  ctx.session.flow = null;
  ctx.session.data = {};

  const totals = await getCarTotals(ctx.prisma, car.id);

   return ctx.reply(
    `✅ Авто продано!\n\n${renderCarCard(totals)}`,
    carCardKeyboard(car.id)
  );
}



if (flow === 'ADD_CAR_BRAND') {
      data.brand = text;
      ctx.session.flow = 'ADD_CAR_MODEL';
      ctx.session.data = data;
      return ctx.reply('Введи модель, наприклад G20 330i:');
    }

    if (flow === 'ADD_CAR_MODEL') {
      data.model = text;
      ctx.session.flow = 'ADD_CAR_YEAR';
      ctx.session.data = data;
      return ctx.reply('Введи рік авто, наприклад 2021:');
    }

    if (flow === 'ADD_CAR_YEAR') {
      data.year = Number(text) || null;
      ctx.session.flow = 'ADD_CAR_VIN';
      ctx.session.data = data;
      return ctx.reply('Введи VIN або напиши "-":');
    }

    if (flow === 'ADD_CAR_VIN') {
      data.vin = text === '-' ? null : text;
      ctx.session.flow = 'ADD_CAR_BUY_PRICE';
      ctx.session.data = data;
      return ctx.reply('Введи ціну покупки, наприклад 5190:');
    }

    if (flow === 'ADD_CAR_BUY_PRICE') {
      data.buyPrice = Number(text.replace(',', '.')) || 0;
      ctx.session.flow = 'ADD_CAR_PLANNED_SELL';
      ctx.session.data = data;
      return ctx.reply('Введи планову ціну продажу, наприклад 28000:');
    }

    if (flow === 'ADD_CAR_PLANNED_SELL') {
      const user = await getCurrentUser(ctx);

      data.plannedSellPrice = Number(text.replace(',', '.')) || 0;

      const car = await ctx.prisma.car.create({
        data: {
          userId: user.id,
          brand: data.brand,
          model: data.model,
          year: data.year,
          vin: data.vin,
          buyPrice: data.buyPrice,
          plannedSellPrice: data.plannedSellPrice,
          isDeleted: false
        }
      });

      ctx.session.flow = null;
      ctx.session.data = {};

      const totals = await getCarTotals(ctx.prisma, car.id);

      return ctx.reply(
        `✅ Авто додано!\n\n${renderCarCard(totals)}`,
        carCardKeyboard(car.id)
      );
    }

    return next();
  });
}

module.exports = { registerCarHandlers };