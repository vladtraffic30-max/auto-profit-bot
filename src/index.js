require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const { mainMenu } = require('./bot/keyboards');
const { registerUser } = require('./services/userService');
const { registerCarHandlers } = require('./handlers/carHandlers');
const { registerExpenseHandlers } = require('./handlers/expenseHandlers');
const { registerReportHandlers } = require('./handlers/reportHandlers');
const { registerCalculatorHandlers } = require('./handlers/calculatorHandlers');

if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN is missing. Add it to .env');
  process.exit(1);
}

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.context.prisma = prisma;
bot.use(session({ defaultSession: () => ({ flow: null, data: {} }) }));

bot.start(async (ctx) => {
  const user = await registerUser(ctx);
  await ctx.reply(
    `🚘 Auto Profit Bot\n\nПривіт, ${user.name || 'бро'}!\nЯ допоможу рахувати авто з США: собівартість, ремонт, деталі, продаж і чистий профіт.`,
    mainMenu()
  );
});

bot.command('menu', async (ctx) => ctx.reply('Головне меню:', mainMenu()));

bot.hears('🚘 Мої авто', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/cars'));
bot.hears('➕ Додати авто', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/addcar'));
bot.hears('🧮 Калькулятор', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/calculator'));
bot.hears('📊 Аналітика', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/analytics'));
bot.hears('📅 Звіт за місяць', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/month'));
bot.hears('⚙️ Налаштування', async (ctx) => ctx.reply('⚙️ Налаштування валют скоро будуть в розширеній версії.'));
bot.hears('♻️ Архів авто', async (ctx) =>
  ctx.telegram.sendMessage(ctx.chat.id, '/archive')
);

registerCarHandlers(bot);
registerExpenseHandlers(bot);
registerReportHandlers(bot);
registerCalculatorHandlers(bot);

bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}:`, err);
  ctx.reply('❌ Сталась помилка. Спробуй ще раз або відкрий /menu');
});

bot.launch();
console.log('Auto Profit Bot started');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
