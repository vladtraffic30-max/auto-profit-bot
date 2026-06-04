const ExcelJS = require('exceljs');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCurrentUser } = require('../services/userService');
const { getCarTotals } = require('../services/carService');
const { money, percent } = require('../utils/format');

function monthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    monthName: now.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })
  };
}

function registerReportHandlers(bot) {
 bot.action(/^excel:(\d+)$/, async (ctx) => {
  const carId = Number(ctx.match[1]);
  await sendExcelReport(ctx, carId);
});

  bot.command('pdf', async (ctx) => {
    await sendTestPdf(ctx);
  });

  bot.command('dashboard', async (ctx) => {
  await sendDashboard(ctx);
});

  bot.command('analytics', async (ctx) => {
  const user = await getCurrentUser(ctx);

  const cars = await ctx.prisma.car.findMany({
    where: {
      userId: user.id,
      isDeleted: false
    },
    include: {
      expenses: true,
      partsSales: true
    }
  });

  if (!cars.length) {
    return ctx.reply('📭 У тебе ще немає авто.');
  }

  let invested = 0;
  let profit = 0;
  let plannedRevenue = 0;

  let bought = 0;
  let transit = 0;
  let port = 0;
  let repair = 0;
  let ready = 0;
  let sale = 0;
  let sold = 0;

  for (const car of cars) {
    const totals = await getCarTotals(ctx.prisma, car.id);

    invested += totals.fullCost;

    plannedRevenue += Number(
      car.sellPrice || car.plannedSellPrice || 0
    );

    profit += totals.profit;

    switch (car.status) {
      case 'BOUGHT':
        bought++;
        break;

      case 'IN_TRANSIT':
        transit++;
        break;

      case 'PORT':
        port++;
        break;

      case 'IN_REPAIR':
        repair++;
        break;

      case 'READY':
        ready++;
        break;

      case 'ON_SALE':
        sale++;
        break;

      case 'SOLD':
        sold++;
        break;
    }
  }

  const roi = invested > 0
    ? (profit / invested) * 100
    : 0;

  return ctx.reply(
    `📈 Dashboard\n\n` +

    `🚘 Всього авто: ${cars.length}\n\n` +

    `🛒 Куплено: ${bought}\n` +
    `🚢 В дорозі: ${transit}\n` +
    `📦 В порту: ${port}\n` +
    `🔧 На ремонті: ${repair}\n` +
    `✅ Готове: ${ready}\n` +
    `💸 Продається: ${sale}\n` +
    `🏁 Продано: ${sold}\n\n` +

    `💰 Загальна собівартість: ${money(invested)}\n` +
    `📊 План продажу: ${money(plannedRevenue)}\n` +
    `🔥 Потенційний профіт: ${money(profit)}\n` +
    `📈 ROI: ${percent(roi)}`
  );
});

  bot.command('month', async (ctx) => {
    const user = await getCurrentUser(ctx);
    const { start, end, monthName } = monthRange();
    const boughtCars = await ctx.prisma.car.findMany({ where: { userId: user.id, createdAt: { gte: start, lt: end } } });
    const soldCars = await ctx.prisma.car.findMany({ where: { userId: user.id, status: 'SOLD', soldAt: { gte: start, lt: end } } });

    let invested = 0, revenue = 0, profit = 0;
    let best = null, worst = null;
    for (const car of soldCars) {
      const totals = await getCarTotals(ctx.prisma, car.id);
      invested += totals.fullCost;
      revenue += Number(car.sellPrice || 0);
      profit += totals.profit;
      if (!best || totals.profit > best.profit) best = { car, profit: totals.profit };
      if (!worst || totals.profit < worst.profit) worst = { car, profit: totals.profit };
    }
    const avg = soldCars.length ? profit / soldCars.length : 0;

    return ctx.reply(
      `📅 Звіт за ${monthName}\n\n` +
      `Куплено авто: ${boughtCars.length}\n` +
      `Продано авто: ${soldCars.length}\n\n` +
      `Вкладено: ${money(invested)}\n` +
      `Виручка: ${money(revenue)}\n` +
      `Чистий профіт: ${money(profit)}\n\n` +
      `Середній профіт з авто: ${money(avg)}\n` +
      `Найкраще авто: ${best ? `${best.car.brand} ${best.car.model} — ${money(best.profit)}` : 'ще немає'}\n` +
      `Найгірше авто: ${worst ? `${worst.car.brand} ${worst.car.model} — ${money(worst.profit)}` : 'ще немає'}`
    );
  });
}

async function sendTestPdf(ctx) {
  const filePath = './auto-report.pdf';

  const user = await getCurrentUser(ctx);

  const car = await prisma.car.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      expenses: true,
      partsSales: true,
    },
  });

  if (!car) {
    return ctx.reply('У тебе ще немає авто для PDF-звіту.');
  }

  const doc = new PDFDocument({ margin: 40 });
  doc.registerFont('Arial', './assets/fonts/arial.ttf');
doc.font('Arial');
  doc.pipe(fs.createWriteStream(filePath));

  const expensesTotal = car.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const partsSalesTotal = car.partsSales.reduce((sum, p) => sum + Number(p.amount), 0);

  const buyPrice = Number(car.buyPrice || 0);
  const sellPrice = Number(car.sellPrice || 0);

  const totalCost = buyPrice + expensesTotal - partsSalesTotal;
  const profit = sellPrice ? sellPrice - totalCost : 0;

  doc.fontSize(24).text('AUTO PROFIT REPORT', { align: 'center' });
  doc.moveDown();

  doc.fontSize(18).text(`${car.brand} ${car.model} ${car.year}`);
  doc.fontSize(12).text(`VIN: ${car.vin || '-'}`);
  doc.text(`Пробіг: ${car.mileage || '-'} км`);
  doc.text(`Статус: ${car.status || '-'}`);
  doc.moveDown();

  doc.fontSize(16).text('Фінанси');
  doc.moveDown(0.5);

  doc.fontSize(12);
  doc.text(`Покупка авто: $${buyPrice}`);
  doc.text(`Всі витрати: $${expensesTotal}`);
  doc.text(`Продаж деталей: -$${partsSalesTotal}`);
  doc.text(`Повна собівартість: $${totalCost}`);
  doc.text(`Ціна продажу: $${sellPrice || '-'}`);
  doc.text(`Чистий профіт: ${sellPrice ? '$' + profit : 'ще не продано'}`);
  doc.moveDown();

  doc.fontSize(16).text('Таблиця витрат');
  doc.moveDown(0.5);

  doc.fontSize(11);
  doc.text('Назва | Категорія | Сума | Дата');
  doc.text('-----------------------------------------------');

  car.expenses.forEach((e) => {
    doc.text(`${e.title} | ${e.category || '-'} | $${e.amount} | ${e.date ? new Date(e.date).toLocaleDateString() : '-'}`);
  });

  doc.moveDown();

  doc.fontSize(16).text('Продаж старих деталей');
  doc.moveDown(0.5);

  doc.fontSize(11);
  doc.text('Що продано | Сума | Дата');
  doc.text('-----------------------------------------------');

  car.partsSales.forEach((p) => {
    doc.text(`${p.title} | $${p.amount} | ${p.date ? new Date(p.date).toLocaleDateString() : '-'}`);
  });

  doc.moveDown(2);
  doc.fontSize(10).fillColor('gray').text('Generated by Auto Profit Bot');

  doc.end();

  setTimeout(async () => {
    await ctx.replyWithDocument({
      source: filePath,
      filename: `${car.brand}-${car.model}-report.pdf`,
    });
  }, 1000);
}

async function sendExcelReport(ctx, carId) {
  const user = await getCurrentUser(ctx);

 const car = await prisma.car.findUnique({
  where: { id: carId },
  include: {
    expenses: true,
    partsSales: true,
  },
});

  if (!car) {
    return ctx.reply('Немає авто для Excel-звіту.');
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Auto Report');

  sheet.columns = [
    { header: 'Тип', key: 'type', width: 25 },
    { header: 'Назва', key: 'title', width: 35 },
    { header: 'Сума', key: 'amount', width: 15 },
    { header: 'Дата', key: 'date', width: 20 },
  ];

  sheet.addRow({
    type: 'Авто',
    title: `${car.brand} ${car.model} ${car.year}`,
    amount: car.buyPrice || 0,
    date: '',
  });

  car.expenses.forEach((e) => {
    sheet.addRow({
      type: e.category || 'Витрата',
      title: e.title,
      amount: e.amount,
      date: e.date ? new Date(e.date).toLocaleDateString() : '',
    });
  });

  car.partsSales.forEach((p) => {
    sheet.addRow({
      type: 'Продаж деталей',
      title: p.title,
      amount: `-${p.amount}`,
      date: p.date ? new Date(p.date).toLocaleDateString() : '',
    });
  });

  const expensesTotal = car.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const partsSalesTotal = car.partsSales.reduce((sum, p) => sum + Number(p.amount), 0);

  const totalCost = Number(car.buyPrice || 0) + expensesTotal - partsSalesTotal;

  sheet.addRow({});
  sheet.addRow({
    type: 'СОБІВАРТІСТЬ',
    title: '',
    amount: totalCost,
  });

  if (car.sellPrice) {
    sheet.addRow({
      type: 'ПРОДАЖ',
      title: '',
      amount: car.sellPrice,
    });

    sheet.addRow({
      type: 'ПРОФІТ',
      title: '',
      amount: Number(car.sellPrice) - totalCost,
    });
  }

  sheet.getRow(1).font = { bold: true };

  const filePath = `./${car.brand}-${car.model}-report.xlsx`;

  await workbook.xlsx.writeFile(filePath);

  await ctx.replyWithDocument({
    source: filePath,
    filename: `${car.brand}-${car.model}-report.xlsx`,
  });
}

async function sendDashboard(ctx) {
  const user = await getCurrentUser(ctx);

  const cars = await prisma.car.findMany({
    where: { userId: user.id },
    include: {
      expenses: true,
      partsSales: true,
    },
  });

  if (!cars.length) {
    return ctx.reply('Поки немає авто для dashboard.');
  }

  let totalInvested = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let frozenMoney = 0;
  let carsInRepair = 0;
  let soldCars = 0;
  let totalSaleDays = 0;

  cars.forEach((car) => {
    const buyPrice = Number(car.buyPrice || 0);
    const expenses = car.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const partsSales = car.partsSales.reduce((sum, p) => sum + Number(p.amount), 0);

    const cost = buyPrice + expenses - partsSales;
    const sellPrice = Number(car.sellPrice || 0);
    const profit = sellPrice ? sellPrice - cost : 0;

    totalInvested += cost;

    if (car.status === 'на ремонті' || car.status === 'repair') {
      carsInRepair += 1;
      frozenMoney += cost;
    }

    if (sellPrice > 0) {
      soldCars += 1;
      totalRevenue += sellPrice;
      totalProfit += profit;

      if (car.createdAt && car.soldAt) {
        const days = Math.ceil(
          (new Date(car.soldAt) - new Date(car.createdAt)) / (1000 * 60 * 60 * 24)
        );
        totalSaleDays += days;
      }
    } else {
      frozenMoney += cost;
    }
  });

  const roi = totalInvested ? (totalProfit / totalInvested) * 100 : 0;
  const margin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;
  const averageProfit = soldCars ? totalProfit / soldCars : 0;
  const averageSaleTime = soldCars ? totalSaleDays / soldCars : 0;

  const text =
    `📊 ROI DASHBOARD\n\n` +

    `🚘 Всього авто: ${cars.length}\n` +
    `🔧 В ремонті: ${carsInRepair}\n` +
    `✅ Продано: ${soldCars}\n\n` +

    `💰 Вкладено всього: $${totalInvested.toFixed(0)}\n` +
    `💸 Виручка: $${totalRevenue.toFixed(0)}\n` +
    `🧊 Заморожено в авто: $${frozenMoney.toFixed(0)}\n\n` +

    `🔥 Чистий профіт: $${totalProfit.toFixed(0)}\n` +
    `📈 ROI: ${roi.toFixed(1)}%\n` +
    `📊 Margin: ${margin.toFixed(1)}%\n` +
    `💵 Середній профіт з авто: $${averageProfit.toFixed(0)}\n` +
    `⏱ Середній термін продажу: ${averageSaleTime.toFixed(0)} днів`;

  return ctx.reply(text);
}

module.exports = { registerReportHandlers };
