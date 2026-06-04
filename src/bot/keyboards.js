const { Markup } = require('telegraf');

function mainMenu() {
  return Markup.keyboard([
    ['🚘 Мої авто', '➕ Додати авто'],
    ['🧮 Калькулятор', '♻️ Архів авто', '📊 Аналітика'],
    ['📅 Звіт за місяць', '⚙️ Налаштування']
  ]).resize();
}



function carCardKeyboard(carId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👁 Витрати', `view_expenses:${carId}`)],

    [
      Markup.button.callback('➕ Витрата', `expense:${carId}`),
      Markup.button.callback('🔧 Ремонт', `repair:${carId}`)
    ],

    [
  Markup.button.callback('🚦 Статус', `status:${carId}`)
],

[Markup.button.callback('🔔 Нагадування', `reminders:${carId}`)],

[
  Markup.button.callback('⚡ Масові витрати', `bulk_expense:${carId}`)
],

[
  Markup.button.callback('💵 Борги', `debts:${carId}`)
],

    [
      Markup.button.callback('🧩 Деталь', `part:${carId}`),
      Markup.button.callback('💸 Продаж деталі', `partsale:${carId}`)
    ],

    [Markup.button.callback('✅ Продати авто', `sell:${carId}`)],

    [
      Markup.button.callback('📄 PDF-звіт', `pdf:${carId}`),
      Markup.button.callback('📊 Excel', `excel:${carId}`),
      Markup.button.callback('🗑 В архів', `archive_car_${carId}`)
    ]
  ]);
}


module.exports = { mainMenu, carCardKeyboard };
