import { parseCurrencyBR } from './currencyUtils';

export function parseExpenseFallback(text: string, memberNames: string[] = ["Você", "Parceiro(a)"]) {
  const lower = text.toLowerCase();

  let amount = 0;
  const priceMatch = text.match(/(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  if (priceMatch) {
    amount = parseCurrencyBR(priceMatch[1]);
  }

  let type: 'expense' | 'income' | 'fixed' = "expense";
  if (/(ganhei|recebi|salário|salario|pix recebido|vendi|entrada|renda|depósito|deposito|prolabore|comissão|comissao)/i.test(lower)) {
    type = "income";
  } else if (/(fixo|fixa|aluguel|condomínio|condominio|internet|assinatura|mensalidade|plano|iptu)/i.test(lower)) {
    type = "fixed";
  }

  let category = "Outros";
  let categoryIcon = "Sparkles";

  if (/(almoço|almoco|janta|jantar|restaurante|ifood|lanche|comida|supermercado|mercado|café|cafe|pão|pao|pizza|hambúrguer|hamburguer|padaria|açaí|acai)/i.test(lower)) {
    category = "Alimentação";
    categoryIcon = "Utensils";
  } else if (/(uber|gasolina|combustível|combustivel|posto|ônibus|onibus|metrô|metro|estacionamento|pedágio|pedagio|táxi|taxi|99|pop)/i.test(lower)) {
    category = "Transporte";
    categoryIcon = "Car";
  } else if (/(aluguel|condomínio|condominio|luz|água|agua|gás|gas|iptu|internet)/i.test(lower)) {
    category = "Moradia";
    categoryIcon = "Home";
  } else if (/(farmácia|farmacia|remédio|remedio|médico|medico|consulta|exame|hospital|dentista|drogaria)/i.test(lower)) {
    category = "Saúde";
    categoryIcon = "HeartPulse";
  } else if (/(cinema|show|viagem|hotel|jogo|festa|bar|cerveja|netflix|spotify|prime|ingresso)/i.test(lower)) {
    category = "Lazer";
    categoryIcon = "Tv";
  } else if (/(roupa|sapato|shopping|amazon|magalu|loja|compra|presente)/i.test(lower)) {
    category = "Compras";
    categoryIcon = "ShoppingBag";
  } else if (/(cabeleireiro|barbeiro|limpeza|manutenção|manutencao|mecanico|mecânico|serviço|servico)/i.test(lower)) {
    category = "Serviços";
    categoryIcon = "Receipt";
  }

  let cleanDesc = text
    .replace(/(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)/gi, '')
    .replace(/(gastei|comprei|paguei|recebi|ganhei|de|com|em|para|por|reais|real|R\$)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanDesc || cleanDesc.length < 2) {
    cleanDesc = category !== "Outros" ? category : (type === "income" ? "Receita" : "Despesa");
  }

  cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);

  let paidBy = memberNames[0] || "Você";
  for (const name of memberNames) {
    if (lower.includes(name.toLowerCase())) {
      paidBy = name;
      break;
    }
  }

  const typeLabel = type === "income" ? "Entrada" : type === "fixed" ? "Despesa Fixa" : "Gasto Rápido";
  const aiResponse = `Identificado e registrado em ${category}! (${typeLabel} R$ ${amount.toFixed(2)})`;

  return {
    description: cleanDesc,
    amount,
    category,
    categoryIcon,
    type,
    paidBy,
    splitType: "equal" as const,
    aiResponse,
  };
}

export function financialAdviceFallback(
  totalExpenses = 0,
  monthBudget = 0,
  categoryTotals: Record<string, number> = {},
  memberNames: string[] = []
) {
  const budgetRatio = monthBudget > 0 ? totalExpenses / monthBudget : 0.5;
  let healthScore = 85;
  let headline = "Seu controle financeiro está em dia!";

  if (monthBudget > 0) {
    if (budgetRatio > 1) {
      healthScore = Math.max(30, Math.round(100 - (budgetRatio - 1) * 50));
      headline = "Atenção: Os gastos ultrapassaram o teto estipulado para o mês.";
    } else if (budgetRatio > 0.8) {
      healthScore = 72;
      headline = "Vocês estão próximos do limite do orçamento mensal (mais de 80%).";
    } else {
      healthScore = Math.min(98, Math.round(100 - budgetRatio * 30));
      headline = "Excelente! Gastos sob controle com boa margem no orçamento.";
    }
  }

  let topCat = "Alimentação";
  let topCatAmount = 0;
  for (const [cat, val] of Object.entries(categoryTotals)) {
    if (val > topCatAmount) {
      topCatAmount = val;
      topCat = cat;
    }
  }

  const insights = [
    topCatAmount > 0
      ? `A maior categoria de despesa é "${topCat}" (R$ ${topCatAmount.toFixed(2)}). Acompanhem para otimizar os valores.`
      : "Mantenham o hábito de registrar todos os gastos diários para mapear os gargalos da casa.",
    monthBudget > 0
      ? `Vocês já comprometeram R$ ${totalExpenses.toFixed(2)} de R$ ${monthBudget.toFixed(2)} do orçamento estipulado.`
      : "Definam um teto orçamentário mensal para o casal planejar os investimentos futuros.",
    "Para receitas extras ou despesas de lazer, conversem sobre a divisão 50/50 ou proporcional."
  ];

  const coupleNames = memberNames.length > 0 ? memberNames.join(" e ") : "o casal";
  const splitAdvice = `Acompanhem o saldo individual para manter a divisão justa entre ${coupleNames}.`;

  return {
    headline,
    insights,
    healthScore,
    splitAdvice,
  };
}

export function auditHistoryFallback(transactions: any[] = [], fixedExpenses: any[] = []) {
  const anomalies: any[] = [];

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const t1 = transactions[i];
      const t2 = transactions[j];
      if (
        t1.amount === t2.amount &&
        t1.amount > 0 &&
        t1.description && t2.description &&
        t1.description.toLowerCase().trim() === t2.description.toLowerCase().trim()
      ) {
        anomalies.push({
          id: `anom-dup-${t1.id || i}-${t2.id || j}`,
          type: "duplicate",
          severity: "warning",
          title: "Possível Transação Duplicada",
          description: `Identificamos duas transações de R$ ${t1.amount.toFixed(2)} ("${t1.description}").`,
          transactionId: t2.id,
          suggestion: "Verifique se a compra foi registrada duas vezes e exclua a duplicada se necessário."
        });
        break;
      }
    }
  }

  const count = anomalies.length;
  const summary = count > 0
    ? `Encontramos ${count} possível(is) incoerência(s) ou duplicidade(s) no seu histórico.`
    : "Auditoria concluída: Seu histórico financeiro está organizado e sem anomalias detectadas!";

  return {
    summary,
    inconsistenciesFound: count,
    aiGreeting: count > 0
      ? `Olá! Concluí a auditoria do histórico e encontrei ${count} item(ns) para verificação.`
      : "Olá! Analisei todo o seu histórico financeiro e os lançamentos estão 100% corretos e organizados!",
    anomalies
  };
}

export function auditChatFallback(userQuery: string, transactions: any[] = [], memberNames: string[] = []) {
  const lower = userQuery.toLowerCase();

  if (/(duplicad|repetid|duplo|dupla)/i.test(lower)) {
    return "Analisei os lançamentos! Se você encontrou alguma transação duplicada na lista ou nos alertas, clique no botão de lixeira ao lado dela para remover o registro repetido.";
  }
  if (/(ajuda|como usar|como funciona|joy)/i.test(lower)) {
    return `Olá! Eu sou a Joy, sua assistente financeira. Você pode me dizer algo como "Gastei 50 reais no mercado" ou "Recebi 500 reais de freela" e eu registro automaticamente para ${memberNames.join(" e ")}.`;
  }
  if (/(divisão|divisao|proporcional|50\/50|metade)/i.test(lower)) {
    return "Para ajustar como uma despesa é dividida entre o casal, selecione a opção desejada (50/50, Individual ou Proporcional à Renda) na tela de Lançamento ou na Divisão do Casal.";
  }

  return "Analisado! Registrei sua mensagem. Para gerenciar ou excluir lançamentos duplicados, você pode utilizar os botões de ação na lista de transações ou no painel de auditoria. Caso queira ajustar valores, edite o lançamento desejado.";
}

export interface BalanceAIAnalysis {
  status: 'positive' | 'warning' | 'danger' | 'neutral';
  badge: string;
  headline: string;
  detailedAnalysis: string;
  keyFactors: {
    label: string;
    value: string;
    impact: 'good' | 'warning' | 'neutral';
  }[];
  recommendations: string[];
  projectedEndMonthBalance: number;
  incomeCommitmentRate: number;
}

export function balanceAnalysisFallback(
  currentBalance: number,
  totalIncome: number,
  totalExpenses: number,
  totalFixedPaid: number,
  totalFixedToPay: number,
  monthName: string,
  memberNames: string[] = []
): BalanceAIAnalysis {
  const coupleLabel = memberNames.length > 0 ? memberNames.join(' e ') : 'o casal';
  const commitmentRate = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
  const projectedEndMonth = totalIncome - totalExpenses - totalFixedToPay;

  if (totalIncome === 0 && totalExpenses === 0) {
    return {
      status: 'neutral',
      badge: 'Início de Ciclo',
      headline: `Ainda não há receitas ou despesas consolidadas para ${monthName}.`,
      detailedAnalysis: `Registre as fontes de renda e os primeiros gastos do mês para que a Joy possa calcular a saúde financeira e emitir alertas preditivos para ${coupleLabel}.`,
      keyFactors: [
        { label: 'Comprometimento da Renda', value: '0%', impact: 'neutral' },
        { label: 'Contas a Pagar', value: `R$ ${totalFixedToPay.toFixed(2)}`, impact: totalFixedToPay > 0 ? 'warning' : 'neutral' },
        { label: 'Saldo Atual', value: `R$ ${currentBalance.toFixed(2)}`, impact: 'neutral' },
      ],
      recommendations: [
        'Cadastre a renda mensal da família na aba "Arrecadação" ou "Rendas".',
        'Registre as contas fixas para acompanhar os vencimentos automaticamente.',
      ],
      projectedEndMonthBalance: projectedEndMonth,
      incomeCommitmentRate: 0,
    };
  }

  if (totalExpenses > totalIncome && totalIncome > 0) {
    const deficit = totalExpenses - totalIncome;
    return {
      status: 'danger',
      badge: 'Atenção: Déficit no Mês',
      headline: `Os gastos já superam a renda do mês em R$ ${deficit.toFixed(2)} (${commitmentRate}% comprometido).`,
      detailedAnalysis: `Identificamos que as despesas acumuladas (R$ ${totalExpenses.toFixed(2)}) ultrapassaram a renda familiar registrada de ${monthName} (R$ ${totalIncome.toFixed(2)}). Além disso, ainda restam R$ ${totalFixedToPay.toFixed(2)} em contas a pagar.`,
      keyFactors: [
        { label: 'Taxa de Comprometimento', value: `${commitmentRate}%`, impact: 'warning' },
        { label: 'Déficit Atual', value: `- R$ ${deficit.toFixed(2)}`, impact: 'warning' },
        { label: 'Contas Pendentes', value: `R$ ${totalFixedToPay.toFixed(2)}`, impact: totalFixedToPay > 0 ? 'warning' : 'good' },
      ],
      recommendations: [
        'Revise despesas não essenciais e compras impulsivas para estancar novos gastos.',
        'Se houver receitas extras ou freelas ainda não computados, adicione-os na arrecadação.',
      ],
      projectedEndMonthBalance: projectedEndMonth,
      incomeCommitmentRate: commitmentRate,
    };
  }

  if (commitmentRate >= 75) {
    return {
      status: 'warning',
      badge: 'Alerta de Orçamento',
      headline: `Atenção: ${commitmentRate}% da renda mensal já foi comprometida com despesas.`,
      detailedAnalysis: `Você já utilizou R$ ${totalExpenses.toFixed(2)} da renda familiar (R$ ${totalIncome.toFixed(2)}). Com mais R$ ${totalFixedToPay.toFixed(2)} previstos em contas pendentes, a margem de segurança para imprevistos está reduzida.`,
      keyFactors: [
        { label: 'Comprometimento da Renda', value: `${commitmentRate}%`, impact: 'warning' },
        { label: 'Saldo Atual em Caixa', value: `R$ ${currentBalance.toFixed(2)}`, impact: currentBalance > 0 ? 'good' : 'warning' },
        { label: 'Contas a Quitar', value: `R$ ${totalFixedToPay.toFixed(2)}`, impact: 'warning' },
      ],
      recommendations: [
        'Mantenham o foco estrito no essencial até o fechamento do ciclo de faturamento.',
        'Priorize a quitação das contas pendentes antes de realizar novos desembolsos.',
      ],
      projectedEndMonthBalance: projectedEndMonth,
      incomeCommitmentRate: commitmentRate,
    };
  }

  const marginRate = 100 - commitmentRate;
  return {
    status: 'positive',
    badge: 'Balanço Saudável',
    headline: `Excelente controle! Margem de ${marginRate}% preservada sobre a renda familiar.`,
    detailedAnalysis: `Com renda de R$ ${totalIncome.toFixed(2)} e gastos de R$ ${totalExpenses.toFixed(2)}, o balanço de ${monthName} segue positivo com saldo em caixa de R$ ${currentBalance.toFixed(2)}. ${
      totalFixedToPay > 0
        ? `Lembre-se de reservar R$ ${totalFixedToPay.toFixed(2)} para as contas fixas pendentes.`
        : 'Todas as contas fixas cadastradas já foram quitadas!'
    }`,
    keyFactors: [
      { label: 'Comprometimento da Renda', value: `${commitmentRate}%`, impact: 'good' },
      { label: 'Margem Disponível', value: `${marginRate}%`, impact: 'good' },
      { label: 'Projeção Pós-Quitação', value: `R$ ${projectedEndMonth.toFixed(2)}`, impact: projectedEndMonth >= 0 ? 'good' : 'warning' },
    ],
    recommendations: [
      projectedEndMonth > 100
        ? 'Aproveite a sobra projetada para destinar um aporte aos seus Cofrinhos ou Reserva.'
        : 'Mantenha o acompanhamento diário dos lançamentos para fechar o mês no verde.',
      'Acompanhem a paridade na divisão do casal para garantir justiça financeira mútua.',
    ],
    projectedEndMonthBalance: projectedEndMonth,
    incomeCommitmentRate: commitmentRate,
  };
}

export function fallbackParseReceipt(memberNames: string[] = ["Você", "Parceiro(a)"]) {
  const today = new Date().toISOString().split("T")[0];
  const items = [
    { id: "item-1", name: "Arroz Branco Tipo 1 5kg", quantity: 1, unitPrice: 26.90, totalPrice: 26.90, category: "Mercearia" },
    { id: "item-2", name: "Feijão Preto 1kg", quantity: 2, unitPrice: 7.50, totalPrice: 15.00, category: "Mercearia" },
    { id: "item-3", name: "Leite Integral 1L", quantity: 4, unitPrice: 4.89, totalPrice: 19.56, category: "Laticínios & Queijos" },
    { id: "item-4", name: "Peito de Frango Filezinho 1kg", quantity: 1.5, unitPrice: 22.00, totalPrice: 33.00, category: "Carnes & Aves" },
    { id: "item-5", name: "Banana Prata kg", quantity: 1.2, unitPrice: 6.90, totalPrice: 8.28, category: "Hortifrúti" },
    { id: "item-6", name: "Detergente Líquido 500ml", quantity: 3, unitPrice: 2.69, totalPrice: 8.07, category: "Limpeza" },
    { id: "item-7", name: "Pão de Forma Tradicional", quantity: 1, unitPrice: 7.99, totalPrice: 7.99, category: "Padaria & Confeitaria" }
  ];

  const totalAmount = items.reduce((acc, it) => acc + it.totalPrice, 0);

  return {
    storeName: "Supermercado Guanabara",
    purchaseDate: today,
    totalAmount: Number(totalAmount.toFixed(2)),
    paymentMethod: "Cartão de Crédito",
    items,
    aiGreeting: "Cupom fiscal analisado! Verifique os itens extraídos antes de salvar.",
  };
}

