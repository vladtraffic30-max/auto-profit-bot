function money(value, currency = 'USD') {
  const n = Number(value || 0);
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₴';
  return `${symbol}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

module.exports = { money, percent };
