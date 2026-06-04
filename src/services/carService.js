const { money, percent } = require('../utils/format');

async function getCarTotals(prisma, carId) {
  const car = await prisma.car.findUnique({
    where: { id: Number(carId) },
    include: { expenses: true, partsSales: true }
  });
  if (!car) return null;

  const expensesTotal = car.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const partsSalesTotal = car.partsSales.reduce((sum, p) => sum + Number(p.amount), 0);
  const fullCost = Number(car.buyPrice || 0) + expensesTotal - partsSalesTotal;
  const actualSell = Number(car.sellPrice || 0);
  const plannedSell = Number(car.plannedSellPrice || 0);
  const profit = actualSell ? actualSell - fullCost : plannedSell - fullCost;
  const roi = fullCost > 0 ? (profit / fullCost) * 100 : 0;

  return { car, expensesTotal, partsSalesTotal, fullCost, profit, roi };
}

function renderCarCard(totals) {
  const { car, expensesTotal, partsSalesTotal, fullCost, profit, roi } = totals;
  const statusMap = {
  BOUGHT: '🛒 куплено',
  IN_TRANSIT: '🚢 в дорозі',
  PORT: '📦 в порту',
  IN_REPAIR: '🔧 на ремонті',
  READY: '✅ готове',
  ON_SALE: '💸 продається',
  SOLD: '🏁 продано'
};

  return `🚘 ${car.brand} ${car.model} ${car.year || ''}\n` +
    `VIN: ${car.vin || 'не вказано'}\n` +
    `Статус: ${statusMap[car.status] || car.status}\n\n` +
    `Купівля: ${money(car.buyPrice)}\n` +
    `Витрати: ${money(expensesTotal)}\n` +
    `Продаж деталей: -${money(partsSalesTotal)}\n\n` +
    `Повна собівартість: ${money(fullCost)}\n` +
    `План продажу: ${money(car.plannedSellPrice)}\n` +
    (car.sellPrice ? `Факт продажу: ${money(car.sellPrice)}\n` : '') +
    `\nПрофіт: ${money(profit)}\n` +
    `ROI: ${percent(roi)}`;
}

module.exports = { getCarTotals, renderCarCard };
