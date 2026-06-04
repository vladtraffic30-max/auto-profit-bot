const { getCarTotals, renderCarCard } = require('../services/carService');
const { carCardKeyboard } = require('../bot/keyboards');

function registerExpenseHandlers(bot) {
  bot.action(/^delete_expense:(\d+)$/, async (ctx) => {
    const expenseId = Number(ctx.match[1]);

    await ctx.prisma.expense.delete({
      where: { id: expenseId }
    });

    await ctx.answerCbQuery('Видалено');
    await ctx.reply('🗑 Розхідник видалено');
  });

  bot.action(/^bulk_expense:(\d+)$/, async (ctx) => {
  const carId = Number(ctx.match[1]);

  ctx.session.flow = 'BULK_EXPENSES';
  ctx.session.data = { carId };

  await ctx.answerCbQuery();

  await ctx.reply(
    '⚡ Встав витрати списком:\n\n' +
    'Формат:\n' +
    'Назва - сума - коментар\n\n' +
    'Приклад:\n' +
    'Краска - 100 - білий перламутр\n' +
    'Важель - 140 - ліва сторона\n' +
    'Фара - 650'
  );
});

  bot.action(/^edit_expense:(\d+)$/, async (ctx) => {
    const expenseId = Number(ctx.match[1]);

    const expense = await ctx.prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!expense) {
      await ctx.answerCbQuery();
      return ctx.reply('❌ Витрату не знайдено');
    }

    ctx.session.flow = 'EDIT_EXPENSE_TITLE';
    ctx.session.data = { expenseId };

    await ctx.answerCbQuery();
    await ctx.reply(`✏️ Нова назва витрати?\n\nЗараз: ${expense.title}`);
  });

  bot.action(/^debts:(\d+)$/, async (ctx) => {
  const carId = Number(ctx.match[1]);

  const debts = await ctx.prisma.debt.findMany({
    where: { carId },
    orderBy: { createdAt: 'desc' }
  });

  await ctx.answerCbQuery();

  if (!debts.length) {
    return ctx.reply('💵 Боргів ще немає', {
      reply_markup: {
        inline_keyboard: [[
          { text: '➕ Добавити борг', callback_data: `add_debt:${carId}` }
        ]]
      }
    });
  }

  let text = '💵 Борги по авто:\n\n';

  for (const d of debts) {
    text += `${d.isPaid ? '✅' : '❌'} ${d.title} — $${d.amount}\n`;
    if (d.comment) text += `Коментар: ${d.comment}\n`;
    text += '\n';
  }

  return ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [[
        { text: '➕ Добавити борг', callback_data: `add_debt:${carId}` }
      ]]
    }
  });
});

bot.action(/^add_debt:(\d+)$/, async (ctx) => {
  const carId = Number(ctx.match[1]);

  ctx.session.flow = 'ADD_DEBT_TITLE';
  ctx.session.data = { carId };

  await ctx.answerCbQuery();
  await ctx.reply('💵 Назва боргу?\n\nНаприклад:\n• маляр\n• СТО\n• доставка');
});

  bot.action(/^view_expenses:(\d+)$/, async (ctx) => {
    const carId = Number(ctx.match[1]);

    const expenses = await ctx.prisma.expense.findMany({
      where: { carId },
      orderBy: { createdAt: 'desc' }
    });

    const partsSales = await ctx.prisma.partsSale.findMany({
      where: { carId },
      orderBy: { createdAt: 'desc' }
    });

    await ctx.answerCbQuery();

    if (!expenses.length && !partsSales.length) {
      return ctx.reply('📭 По цьому авто ще немає витрат або продажів деталей.');
    }

    await ctx.reply('👁 Розходи по авто:');

    if (expenses.length) {
      await ctx.reply('💸 Витрати:');

      for (const e of expenses) {
        let expenseText = `• ${e.title} — $${e.amount} / ${e.category || '-'}\n`;

        if (e.comment) {
          expenseText += `Коментар: ${e.comment}`;
        }

        await ctx.reply(expenseText, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✏️ Редагувати',
                  callback_data: `edit_expense:${e.id}`
                },
                {
                  text: '🗑 Видалити',
                  callback_data: `delete_expense:${e.id}`
                }
              ]
            ]
          }
        });
      }
    }

    if (partsSales.length) {
      let salesText = '💰 Продаж деталей:\n';

      for (const p of partsSales) {
        salesText += `• ${p.title} — +$${p.amount}\n`;
        if (p.comment) {
          salesText += `  Коментар: ${p.comment}\n`;
        }
      }

      await ctx.reply(salesText);
    }
  });

  bot.action(/^(expense|repair|part):(\d+)$/, async (ctx) => {
    const type = ctx.match[1];
    const carId = Number(ctx.match[2]);

    ctx.session.flow = 'ADD_EXPENSE_TITLE';
    ctx.session.data = { carId, type };

    await ctx.answerCbQuery();

    const label =
      type === 'repair'
        ? 'ремонту'
        : type === 'part'
        ? 'деталі'
        : 'витрати';

    await ctx.reply(`Введи назву ${label}. Наприклад: фарбування бампера`);
  });

  bot.action(/^partsale:(\d+)$/, async (ctx) => {
    ctx.session.flow = 'ADD_PARTSALE_TITLE';
    ctx.session.data = { carId: Number(ctx.match[1]) };

    await ctx.answerCbQuery();
    await ctx.reply('💸 Що продав? Наприклад: старі фари');
  });

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session.flow;

    if (
      !flow ||
      (
     !flow.startsWith('ADD_EXPENSE') &&
!flow.startsWith('ADD_PARTSALE') &&
!flow.startsWith('EDIT_EXPENSE') &&
!flow.startsWith('ADD_DEBT') &&
!flow.startsWith('BULK_EXPENSES')
      )
    ) {
      return next();
    }

    const text = ctx.message.text.trim();
    const data = ctx.session.data || {};

    if (flow === 'BULK_EXPENSES') {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const created = [];
  const skipped = [];

  for (const line of lines) {
    const parts = line.split('-').map(p => p.trim());

    const title = parts[0];
    const amount = Number((parts[1] || '').replace(',', '.'));
    const comment = parts.slice(2).join(' - ') || null;

    if (!title || !amount) {
      skipped.push(line);
      continue;
    }

    await ctx.prisma.expense.create({
      data: {
        carId: data.carId,
        title,
        amount,
        category: 'OTHER',
        comment
      }
    });

    created.push({ title, amount, comment });
  }

  ctx.session.flow = null;
  ctx.session.data = {};

  const total = created.reduce((sum, e) => sum + e.amount, 0);

  let reply = `✅ Додано витрат: ${created.length}\n`;
  reply += `💰 Разом: $${total}\n\n`;

  for (const e of created) {
    reply += `• ${e.title} — $${e.amount}`;
    if (e.comment) reply += ` / ${e.comment}`;
    reply += '\n';
  }

  if (skipped.length) {
    reply += `\n⚠️ Не додано:\n`;
    for (const s of skipped) {
      reply += `• ${s}\n`;
    }
  }

  const totals = await getCarTotals(ctx.prisma, data.carId);

  return ctx.reply(
    reply + '\n' + renderCarCard(totals),
    carCardKeyboard(data.carId)
  );
}

    if (flow === 'EDIT_EXPENSE_TITLE') {
      data.title = text;
      ctx.session.flow = 'EDIT_EXPENSE_AMOUNT';
      ctx.session.data = data;
      return ctx.reply('Нова сума в USD?');
    }

    if (flow === 'EDIT_EXPENSE_AMOUNT') {
      data.amount = Number(text.replace(',', '.')) || 0;
      ctx.session.flow = 'EDIT_EXPENSE_COMMENT';
      ctx.session.data = data;
      return ctx.reply('Новий коментар? Якщо немає — напиши -');
    }
if (flow === 'ADD_DEBT_TITLE') {
  data.title = text;

  ctx.session.flow = 'ADD_DEBT_AMOUNT';
  ctx.session.data = data;

  return ctx.reply('Сума боргу в USD?');
}

if (flow === 'ADD_DEBT_AMOUNT') {
  data.amount = Number(text.replace(',', '.')) || 0;

  ctx.session.flow = 'ADD_DEBT_COMMENT';
  ctx.session.data = data;

  return ctx.reply('Коментар? Якщо немає — напиши -');
}

if (flow === 'ADD_DEBT_COMMENT') {
  await ctx.prisma.debt.create({
    data: {
      carId: data.carId,
      title: data.title,
      amount: data.amount,
      comment: text === '-' ? null : text
    }
  });

  ctx.session.flow = null;
  ctx.session.data = {};

  return ctx.reply('✅ Борг додано');
}

    if (flow === 'EDIT_EXPENSE_COMMENT') {
      const updated = await ctx.prisma.expense.update({
        where: { id: data.expenseId },
        data: {
          title: data.title,
          amount: data.amount,
          comment: text === '-' ? null : text
        }
      });

      ctx.session.flow = null;
      ctx.session.data = {};

      const totals = await getCarTotals(ctx.prisma, updated.carId);

      return ctx.reply(
        '✅ Витрату оновлено.\n\n' + renderCarCard(totals),
        carCardKeyboard(updated.carId)
      );
    }

    if (flow === 'ADD_EXPENSE_TITLE') {
      data.title = text;
      ctx.session.flow = 'ADD_EXPENSE_AMOUNT';
      ctx.session.data = data;
      return ctx.reply('Сума в USD?');
    }

    if (flow === 'ADD_EXPENSE_AMOUNT') {
      data.amount = Number(text.replace(',', '.')) || 0;
      ctx.session.flow = 'ADD_EXPENSE_COMMENT';
      ctx.session.data = data;
      return ctx.reply('Коментар? Якщо немає — напиши -');
    }

    if (flow === 'ADD_EXPENSE_COMMENT') {
      const category =
        data.type === 'repair'
          ? 'REPAIR'
          : data.type === 'part'
          ? 'PART'
          : 'OTHER';

      await ctx.prisma.expense.create({
        data: {
          carId: data.carId,
          title: data.title,
          amount: data.amount,
          category,
          comment: text === '-' ? null : text
        }
      });

      ctx.session.flow = null;
      ctx.session.data = {};

      const totals = await getCarTotals(ctx.prisma, data.carId);

      return ctx.reply(
        '✅ Витрату додано.\n\n' + renderCarCard(totals),
        carCardKeyboard(data.carId)
      );
    }

    if (flow === 'ADD_PARTSALE_TITLE') {
      data.title = text;
      ctx.session.flow = 'ADD_PARTSALE_AMOUNT';
      ctx.session.data = data;
      return ctx.reply('За скільки продав у USD?');
    }

    if (flow === 'ADD_PARTSALE_AMOUNT') {
      data.amount = Number(text.replace(',', '.')) || 0;
      ctx.session.flow = 'ADD_PARTSALE_COMMENT';
      ctx.session.data = data;
      return ctx.reply('Коментар? Якщо немає — напиши -');
    }

    if (flow === 'ADD_PARTSALE_COMMENT') {
      await ctx.prisma.partsSale.create({
        data: {
          carId: data.carId,
          title: data.title,
          amount: data.amount,
          comment: text === '-' ? null : text
        }
      });

      ctx.session.flow = null;
      ctx.session.data = {};

      const totals = await getCarTotals(ctx.prisma, data.carId);

      return ctx.reply(
        '✅ Продаж деталі додано.\n\n' + renderCarCard(totals),
        carCardKeyboard(data.carId)
      );
    }

    return next();
  });
}

module.exports = { registerExpenseHandlers };