const { money, percent } = require('../utils/format');

function registerCalculatorHandlers(bot) {
  bot.command('calculator', async (ctx) => {
    ctx.session.flow = 'CALC_BUY';
    ctx.session.data = {};
    await ctx.reply('🧮 Калькулятор авто\n\nВведи ціну покупки авто в USD:');
  });

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session.flow;
    if (!flow || !flow.startsWith('CALC')) return next();
    const value = Number(ctx.message.text.trim().replace(',', '.')) || 0;
    const data = ctx.session.data || {};

    if (flow === 'CALC_BUY') {
      data.buy = value;
      ctx.session.flow = 'CALC_DELIVERY';
      ctx.session.data = data;
      return ctx.reply('Доставка + Америка + море в USD:');
    }
    if (flow === 'CALC_DELIVERY') {
      data.delivery = value;
      ctx.session.flow = 'CALC_CUSTOMS';
      ctx.session.data = data;
      return ctx.reply('Розмитнення / сертифікація / облік в USD:');
    }
    if (flow === 'CALC_CUSTOMS') {
      data.customs = value;
      ctx.session.flow = 'CALC_REPAIR';
      ctx.session.data = data;
      return ctx.reply('Ремонт + деталі в USD:');
    }
    if (flow === 'CALC_REPAIR') {
      data.repair = value;
      ctx.session.flow = 'CALC_SELL';
      ctx.session.data = data;
      return ctx.reply('Планова ціна продажу в USD:');
    }
    if (flow === 'CALC_SELL') {
      data.sell = value;
      const cost = data.buy + data.delivery + data.customs + data.repair;
      const profit = data.sell - cost;
      const margin = data.sell > 0 ? (profit / data.sell) * 100 : 0;
      const roi = cost > 0 ? (profit / cost) * 100 : 0;
      ctx.session.flow = null;
      ctx.session.data = {};
      return ctx.reply(
        `🧮 Розрахунок авто\n\n` +
        `Собівартість: ${money(cost)}\n` +
        `План продажу: ${money(data.sell)}\n` +
        `Потенційний профіт: ${money(profit)}\n` +
        `Маржа: ${percent(margin)}\n` +
        `ROI: ${percent(roi)}`
      );
    }
  });
}

module.exports = { registerCalculatorHandlers };
