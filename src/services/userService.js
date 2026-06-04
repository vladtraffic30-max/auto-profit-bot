async function registerUser(ctx) {
  const telegramId = String(ctx.from.id);
  return ctx.prisma.user.upsert({
    where: { telegramId },
    update: { name: ctx.from.first_name || ctx.from.username || 'User' },
    create: {
      telegramId,
      name: ctx.from.first_name || ctx.from.username || 'User',
      role: 'ADMIN'
    }
  });
}

async function getCurrentUser(ctx) {
  return registerUser(ctx);
}

module.exports = { registerUser, getCurrentUser };
