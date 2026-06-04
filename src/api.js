const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/cars', async (req, res) => {
  const cars = await prisma.car.findMany({
    where: { isDeleted: false },
    include: {
      expenses: true,
      partsSales: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const result = cars.map((car) => {
    const expenses = car.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const partsSales = car.partsSales.reduce((s, p) => s + Number(p.amount), 0);
    const cost = Number(car.buyPrice || 0) + expenses - partsSales;
    const sell = Number(car.sellPrice || car.plannedSellPrice || 0);
    const profit = sell - cost;

    return {
      id: car.id,
      title: `${car.brand} ${car.model}`,
      year: car.year,
      status: car.status,
      buy: car.buyPrice || 0,
      expenses,
      partsSales,
      sell,
      cost,
      profit,
      roi: cost ? (profit / cost) * 100 : 0,
      vin: car.vin,
      photo: car.photoFileId || null,
    };
  });

  res.json(result);
});

app.listen(4000, () => {
  console.log('API started on http://localhost:4000');
});