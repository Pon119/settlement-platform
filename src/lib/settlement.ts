export interface Settlement {
  from: number;
  to: number;
  amount: number;
}

export function calculateSettlement(expenses: any[], members: any[]): Settlement[] {
  const rawPairs: { [key: string]: number } = {};

  expenses.forEach(expense => {
    const payerId = expense.payerId;
    const perAmount = expense.perPersonAmount;

    expense.participants.forEach((participantId: number) => {
      if (participantId !== payerId) {
        const key = `${participantId}→${payerId}`;
        rawPairs[key] = (rawPairs[key] || 0) + perAmount;
      }
    });
  });

  const netMap = new Map<string, number>();
  for (const [key, amount] of Object.entries(rawPairs)) {
    const [from, to] = key.split('→').map(id => parseInt(id));
    const sorted = [from, to].sort((a, b) => a - b);
    const normKey = `${sorted[0]}<->${sorted[1]}`;

    const current = netMap.get(normKey) || 0;
    if (from < to) {
      netMap.set(normKey, current + amount);
    } else {
      netMap.set(normKey, current - amount);
    }
  }

  const result: Settlement[] = [];
  for (const [key, value] of netMap.entries()) {
    const [a, b] = key.split('<->').map(id => parseInt(id));
    if (a === b || Math.round(value) === 0) continue;

    if (value > 0) {
      result.push({ from: a, to: b, amount: Math.round(value) });
    } else {
      result.push({ from: b, to: a, amount: Math.round(-value) });
    }
  }

  return result;
}
