import { useEffect, useMemo, useState } from "react";
import { Car, DollarSign, Wrench, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export default function App() {
  const [cars, setCars] = useState([]);

  useEffect(() => {
    fetch("http://localhost:4000/api/cars")
      .then((res) => res.json())
      .then((data) => setCars(data))
      .catch((err) => console.error(err));
  }, []);

  const stats = useMemo(() => {
    const invested = cars.reduce((s, c) => s + Number(c.cost || 0), 0);
    const revenue = cars.reduce((s, c) => s + Number(c.sell || 0), 0);
    const profit = cars.reduce((s, c) => s + Number(c.profit || 0), 0);
    const roi = invested ? (profit / invested) * 100 : 0;

    return { invested, revenue, profit, roi };
  }, [cars]);

  const chartData = cars.map((c) => ({
    name: c.title,
    profit: Number(c.profit || 0),
  }));

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-5">
        <header>
          <h1 className="text-3xl font-bold">Auto Profit CRM</h1>
          <p className="text-neutral-400">Реальні авто з Telegram-бота</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<Car />} title="Авто" value={cars.length} />
          <Stat icon={<DollarSign />} title="Вкладено" value={`$${stats.invested.toFixed(0)}`} />
          <Stat icon={<TrendingUp />} title="Профіт" value={`$${stats.profit.toFixed(0)}`} />
          <Stat icon={<Wrench />} title="ROI" value={`${stats.roi.toFixed(1)}%`} />
        </div>

        <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
          <h2 className="text-xl font-semibold mb-4">Профіт по авто</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#aaa" />
                <YAxis stroke="#aaa" />
                <Tooltip />
                <Bar dataKey="profit" fill="#22c55e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {cars.map((car) => {
            const cost = Number(car.cost || 0);
            const profit = Number(car.profit || 0);
            const roi = cost ? (profit / cost) * 100 : 0;

            return (
              <div key={car.id} className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800">
                <div className="h-48 bg-neutral-800 flex items-center justify-center text-neutral-500">
                  Фото авто
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">{car.title}</h3>
                      <p className="text-neutral-400">{car.year || "-"} • {car.status}</p>
                      <p className="text-xs text-neutral-500">VIN: {car.vin || "-"}</p>
                    </div>

                    <div className="text-right">
                      <p className={profit >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                        ${profit.toFixed(0)}
                      </p>
                      <p className="text-xs text-neutral-400">profit</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Row label="Купівля" value={`$${Number(car.buy || 0).toFixed(0)}`} />
                    <Row label="Витрати" value={`$${Number(car.expenses || 0).toFixed(0)}`} />
                    <Row label="Продаж деталей" value={`-$${Number(car.partsSales || 0).toFixed(0)}`} />
                    <Row label="Собівартість" value={`$${cost.toFixed(0)}`} />
                    <Row label="Продаж/план" value={`$${Number(car.sell || 0).toFixed(0)}`} />
                    <Row label="ROI" value={`${roi.toFixed(1)}%`} />
                  </div>

                  <button className="w-full bg-white text-black rounded-xl py-3 font-semibold">
                    Відкрити авто
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!cars.length && (
          <div className="bg-neutral-900 rounded-2xl p-6 text-neutral-400 border border-neutral-800">
            Авто ще не підтягнулись. Перевір, чи запущений API: <b>node src/api.js</b>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, title, value }) {
  return (
    <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
      <div className="text-neutral-400 mb-2">{icon}</div>
      <p className="text-sm text-neutral-400">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="bg-neutral-800 rounded-xl p-3">
      <p className="text-neutral-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}