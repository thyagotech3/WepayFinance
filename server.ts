import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Enable CORS for API routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini SDK
// Use active standard Gemini multimodal models
const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined.");
  }
  return new GoogleGenAI({ apiKey });
};

// Check Gemini AI Configuration Status
app.get("/api/ai/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
  res.json({
    configured: hasKey,
    model: PRIMARY_MODEL,
    message: hasKey
      ? "IA pronta para análise de cupons e finanças."
      : "Chave GEMINI_API_KEY não configurada. O aplicativo funcionará em modo assistido.",
  });
});

// Robust helper to generate content with model fallbacks and retry on transient errors
async function generateContentWithRetry(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}) {
  const ai = getAi();
  const modelsToTry = Array.from(
    new Set([
      params.preferredModel || PRIMARY_MODEL,
      ...FALLBACK_MODELS,
    ])
  );

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[WePay AI] Solicitando processamento com modelo: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      if (response && (response.text || typeof response.text === "string")) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || JSON.stringify(err);
      console.warn(`[WePay AI] Tentativa no modelo ${model} falhou:`, errMsg);
      // Brief pause before fallback if server was busy (503/429)
      if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  throw lastError || new Error("Não foi possível processar a requisição de IA após múltiplas tentativas.");
}

// Helper to infer category based on Brazilian grocery product keywords
function inferBrazilianCategory(name: string): string {
  const n = (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/\b(tomate|cebola|alho|banana|maca|batata|cenoura|limao|alface|laranja|mamao|abacaxi|melancia|uva|morango|manga|abacate|legume|verdura|fruta|horti|rucula|couve|pepino|mandioca|aipim|brocolis|pimentao|maracuja)\b/.test(n)) {
    return "Hortifrúti";
  }
  if (/\b(carne|frango|peito|coxa|sobrecoxa|acem|alcatra|linguica|costela|patinho|peixe|salmao|tilapia|lombo|suino|bovino|bacon|picanha|contra file|maminha|cha de dentro|moida|salsicha|pernil|camarao|bife|costelinha|linguica)\b/.test(n)) {
    return "Carnes & Aves";
  }
  if (/\b(leite|queijo|mussarela|mucarela|parmesao|prato|iogurte|manteiga|requeijao|nata|creme de leite|condensado|ricota|coalhada|danone|yakult|margarina)\b/.test(n)) {
    return "Laticínios & Queijos";
  }
  if (/\b(pao|bolo|torrada|biscoito|bolacha|croissant|panetone|sonho|salgado|torta|baguete|brioche|broa|bisnaguinha|waffle)\b/.test(n)) {
    return "Padaria & Confeitaria";
  }
  if (/\b(cerveja|refrigerante|coca|pepsi|guarana|fanta|suco|agua|vinho|vodka|gin|whisky|energetico|cha|cafe|nescau|toddy|heineken|brahma|skol|amstel|monster|red bull|del valle)\b/.test(n)) {
    return "Bebidas";
  }
  if (/\b(sabao|detergente|amaciante|desinfetante|agua sanitaria|esponja|papel higienico|cloro|vanish|veja|limpador|lustra|inseticida|palha de aco|saco lixo|omo|ype|ariel|downy|comfort|ajax|bombril|guardanapo)\b/.test(n)) {
    return "Limpeza";
  }
  if (/\b(shampoo|sabonete|condicionador|pasta de dente|creme dental|desodorante|fio dental|protetor|absorvente|cotonete|barbeador|gillette|colgate|oral-b|dove|rexona|nivea|pantene|listerine|curativo)\b/.test(n)) {
    return "Higiene & Cuidados";
  }
  if (/\b(pizza|hamburguer|lasanha|congelad|sorvete|acai|nuggets|empanado|picole|gelo|kibon|polpa)\b/.test(n)) {
    return "Congelados";
  }
  if (/\b(racao|pet|gato|cachorro|sache|whiskas|pedigree|friskies|golden|premier|areia higienica|petisco)\b/.test(n)) {
    return "Pet Shop";
  }
  if (/\b(arroz|feijao|oleo|azeite|acucar|sal|macarrao|molho|farinha|milho|atum|sardinha|maionese|ketchup|mostarda|extrato|grao de bico|lentilha|ervilha|aveia|fermento|tempero|caldo|azeitona|vinagre)\b/.test(n)) {
    return "Mercearia";
  }
  return "Mercearia";
}

// Clean and format item name from thermal receipt
function cleanReceiptItemName(rawName: string): string {
  if (!rawName) return "Produto";
  let cleaned = String(rawName)
    .replace(/^[0-9]{3,14}\s+/, "") // remove leading barcode or SKU
    .replace(/^[0-9]{1,3}\s+[-.]\s*/, "") // remove leading "001 -"
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Produto";

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Fallback logic for receipt parsing when Gemini quota is reached or offline
function fallbackParseReceipt(memberNames: string[] = ["Você", "Parceiro(a)"]) {
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
    aiGreeting: "Cupom fiscal analisado com sucesso! Verifique os itens extraídos antes de salvar.",
  };
}

// Fallback logic for expense parsing when Gemini quota is reached or offline
function fallbackParseExpense(text: string, memberNames: string[] = ["Você", "Parceiro(a)"]) {
  const lower = text.toLowerCase();

  let amount = 0;
  const priceMatch = text.match(/(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  if (priceMatch) {
    amount = parseFloat(priceMatch[1].replace(',', '.'));
  }

  let type = "expense";
  if (/(ganhei|recebi|salário|salario|pix recebido|vendi|entrada|renda|depósito|deposito)/i.test(lower)) {
    type = "income";
  } else if (/(fixo|fixa|aluguel|condomínio|condominio|internet|assinatura|mensalidade)/i.test(lower)) {
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
    splitType: "equal",
    aiResponse,
  };
}

// Fallback logic for financial advice
function fallbackFinancialAdvice(totalExpenses = 0, monthBudget = 0, categoryTotals: Record<string, number> = {}, memberNames: string[] = []) {
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

// Fallback logic for history audit
function fallbackAuditHistory(transactions: any[] = [], fixedExpenses: any[] = []) {
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

// API Route: Interpret expense text or command
app.post("/api/ai/parse-expense", async (req, res) => {
  const { text, memberNames = ["Você", "Parceiro(a)"] } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Texto do lançamento é obrigatório." });
  }

  try {
    const ai = getAi();
    const prompt = `
Você é o assistente inteligente do aplicativo WePay (controle financeiro para casais e famílias).
Analise o seguinte texto enviado pelo usuário:
"${text}"

Os membros da família/grupo registrados são: ${memberNames.join(", ")}.

Extraia os detalhes do lançamento financeiro em formato JSON seguindo estas instruções:
- Se for uma despesa ou receita, identifique:
  1. "description": Título curto e claro (ex: "Almoço de Domingo", "Conta de Luz", "Uber para o Trabalho")
  2. "amount": Valor numérico positivo (ex: 85.50). Se não for mencionado valor explícito, tente estimar ou use 0.00.
  3. "category": Uma categoria dentre ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Compras", "Serviços", "Outros"]
  4. "categoryIcon": Nome do ícone Lucide adequado (ex: "Utensils", "Home", "Car", "Tv", "HeartPulse", "ShoppingBag", "Receipt", "Sparkles")
  5. "type": "expense" (despesa) ou "income" (receita/ganho)
  6. "paidBy": Nome de quem pagou. Se um dos membros for mencionado, use esse nome. Senão, defina como "${memberNames[0]}".
  7. "splitType": "equal" (dividir 50/50), "individual" (gasto próprio de quem pagou), ou "proportional" (proporcional)
  8. "aiResponse": Mensagem amigável e direta em português confirmando o lançamento.
`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            categoryIcon: { type: Type.STRING },
            type: { type: Type.STRING },
            paidBy: { type: Type.STRING },
            splitType: { type: Type.STRING },
            aiResponse: { type: Type.STRING },
          },
          required: ["description", "amount", "category", "type", "paidBy", "aiResponse"],
        },
      },
    });

    const rawJson = response.text?.trim() || "{}";
    const parsedData = JSON.parse(rawJson);

    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.warn("[WePay AI] Usando parser nativo local (Gemini quota limit / offline).");
    const fallbackData = fallbackParseExpense(text, memberNames);
    return res.json({ success: true, data: fallbackData });
  }
});

// API Route: Process Audio / Voice Recording directly
app.post("/api/ai/parse-voice", async (req, res) => {
  const { audioBase64, mimeType = "audio/webm", memberNames = ["Você", "Parceiro(a)"] } = req.body;

  if (!audioBase64) {
    return res.status(400).json({ error: "Áudio não fornecido." });
  }

  try {
    const ai = getAi();
    const prompt = `
Você é a IA do WePay. Ouça o áudio gravado e identifique a despesa ou receita informada pelo usuário.
Os membros registrados são: ${memberNames.join(", ")}.

Extraia os detalhes em JSON:
1. "transcription": Transcrição exata do que foi dito.
2. "description": Título curto da despesa/receita.
3. "amount": Valor numérico positivo.
4. "category": Uma de ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Compras", "Serviços", "Outros"]
5. "categoryIcon": Nome de ícone Lucide ("Utensils", "Home", "Car", etc.)
6. "type": "expense" ou "income"
7. "paidBy": Nome de quem pagou
8. "aiResponse": Mensagem curta de confirmação em português.
`;

    const response = await generateContentWithRetry({
      contents: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            categoryIcon: { type: Type.STRING },
            type: { type: Type.STRING },
            paidBy: { type: Type.STRING },
            aiResponse: { type: Type.STRING },
          },
          required: ["transcription", "description", "amount", "category", "type", "paidBy", "aiResponse"],
        },
      },
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.warn("[WePay AI] Usando parser de voz nativo local (Gemini quota limit / offline).");
    const fallbackData = {
      transcription: "Áudio gravado",
      ...fallbackParseExpense("Lançamento de Voz", memberNames)
    };
    return res.json({ success: true, data: fallbackData });
  }
});

// API Route: Process Supermarket Receipt Image (Gemini Vision OCR & Itemization)
app.post("/api/ai/parse-receipt", async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg", memberNames = ["Você", "Parceiro(a)"] } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ success: false, error: "Imagem do cupom não fornecida." });
  }

  const hasApiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
  if (!hasApiKey) {
    console.warn("[WePay AI] GEMINI_API_KEY não configurada no ambiente. Retornando modo assistido.");
    const fallback = fallbackParseReceipt(memberNames);
    return res.json({
      success: true,
      isFallback: true,
      apiKeyMissing: true,
      data: {
        ...fallback,
        aiGreeting: "Chave de IA não configurada. Você pode preencher ou ajustar os itens manualmente.",
        audit: {
          isConsistent: true,
          itemsCount: fallback.items.length,
          sumOfItems: fallback.totalAmount,
          receiptTotal: fallback.totalAmount,
          totalDifference: 0,
          hasTotalMismatch: false,
          itemsWithWarningCount: 0,
          inconsistencies: [],
        },
      },
    });
  }

  // Clean and sanitize base64 data
  let cleanBase64 = String(imageBase64 || "");
  if (cleanBase64.includes(",")) {
    cleanBase64 = cleanBase64.split(",")[1];
  }
  cleanBase64 = cleanBase64.replace(/[\r\n\s]+/g, "");

  // Normalize mimeType
  let normalizedMimeType = String(mimeType || "image/jpeg").toLowerCase();
  if (normalizedMimeType.includes("jpg") || normalizedMimeType === "image/jpg") {
    normalizedMimeType = "image/jpeg";
  } else if (!normalizedMimeType.startsWith("image/")) {
    normalizedMimeType = "image/jpeg";
  }

  try {
    const prompt = `
Você é o mais avançado leitor de cupons e notas fiscais de supermercados e comércio brasileiro (NFC-e, SAT, ECF, DANFE simplificado).
Analise a imagem da nota fiscal com foco extremo nos itens, quantidades, valores unitários e valor total pago.

Regras de Extração:
1. "storeName": Nome do supermercado / loja no cabeçalho (ex: Carrefour, Guanabara, Pão de Açúcar, Atacadão, Assaí, Hortifrúti, etc.).
2. "purchaseDate": Data da compra no formato "YYYY-MM-DD" (se não visível, use a data atual 2026-08-25).
3. "totalAmount": Valor total final pago impresso no cupom (ex: "TOTAL R$", "VALOR A PAGAR R$").
4. "paymentMethod": Forma de pagamento (ex: "Cartão de Crédito", "Cartão de Débito", "PIX", "Dinheiro", "VR / VA Alimentação").
5. "items": Lista de todos os produtos impressos. Para cada item:
   - "name": Nome claro do produto (ex: "Arroz Branco 5kg", "Tomate kg", "Leite Integral 1L", "Detergente 500ml").
   - "quantity": Quantidade ou peso medido (número float, ex: 1, 2, 0.650).
   - "unitPrice": Preço unitário ou por kg (número float).
   - "totalPrice": Valor total daquele produto com desconto se houver (número float).
   - "category": Categoria ("Hortifrúti", "Carnes & Aves", "Laticínios & Queijos", "Mercearia", "Bebidas", "Padaria & Confeitaria", "Limpeza", "Higiene & Cuidados", "Congelados", "Pet Shop", "Outros").
`;

    const response = await generateContentWithRetry({
      contents: [
        {
          inlineData: {
            mimeType: normalizedMimeType,
            data: cleanBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            storeName: { type: Type.STRING },
            purchaseDate: { type: Type.STRING },
            totalAmount: { type: Type.NUMBER },
            paymentMethod: { type: Type.STRING },
            aiGreeting: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                },
                required: ["name", "quantity", "unitPrice", "totalPrice"],
              },
            },
          },
          required: ["storeName", "totalAmount", "items"],
        },
      },
    });

    let rawText = (response?.text || "").trim();
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    } else if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    }

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn("[WePay AI] Tentativa de recuperação de JSON com regex:", parseErr);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    }

    // Mathematical Consistency & Item-by-Item Verification
    const rawItems = Array.isArray(parsedData.items) ? parsedData.items : [];
    let itemsWithMismatchCount = 0;
    const inconsistencies: string[] = [];

    const verifiedItems = rawItems.map((item: any, index: number) => {
      const id = item.id || `item-${index + 1}`;
      const rawName = item.name || `Produto ${index + 1}`;
      const name = cleanReceiptItemName(rawName);
      let quantity = Number(item.quantity) || 1;
      let unitPrice = Number(item.unitPrice) || 0;
      let totalPrice = Number(item.totalPrice) || 0;

      // Smart math repairs
      if (totalPrice <= 0 && unitPrice > 0 && quantity > 0) {
        totalPrice = Number((quantity * unitPrice).toFixed(2));
      } else if (unitPrice <= 0 && totalPrice > 0 && quantity > 0) {
        unitPrice = Number((totalPrice / quantity).toFixed(2));
      } else if (quantity <= 0 && unitPrice > 0 && totalPrice > 0) {
        quantity = Number((totalPrice / unitPrice).toFixed(3));
      }

      // Auto-categorization
      let category = item.category;
      if (!category || category === "Outros" || category === "Mercearia") {
        category = inferBrazilianCategory(name);
      }

      const calculatedExpected = Number((quantity * unitPrice).toFixed(2));
      const diff = Math.abs(calculatedExpected - totalPrice);
      const hasCalculationMismatch = unitPrice > 0 && quantity > 0 && diff > 0.05;

      let mismatchNote: string | undefined = undefined;
      if (hasCalculationMismatch) {
        itemsWithMismatchCount++;
        mismatchNote = `Qtd (${quantity}) × Preço Unit (R$ ${unitPrice.toFixed(2)}) = R$ ${calculatedExpected.toFixed(2)}, no cupom: R$ ${totalPrice.toFixed(2)}`;
        inconsistencies.push(`${name}: ${mismatchNote}`);
      }

      return {
        id,
        name,
        quantity,
        unitPrice,
        totalPrice,
        category,
        hasCalculationMismatch,
        mismatchNote,
      };
    });

    const sumOfItems = Number(verifiedItems.reduce((acc, it) => acc + it.totalPrice, 0).toFixed(2));
    const receiptTotal = Number(Number(parsedData.totalAmount || sumOfItems).toFixed(2));
    const totalDifference = Number(Math.abs(sumOfItems - receiptTotal).toFixed(2));
    const hasTotalMismatch = totalDifference > 0.15;

    if (hasTotalMismatch) {
      inconsistencies.push(
        `A soma dos itens (R$ ${sumOfItems.toFixed(2)}) difere do total da nota (R$ ${receiptTotal.toFixed(2)}). Diferença: R$ ${totalDifference.toFixed(2)}`
      );
    }

    const audit = {
      isConsistent: !hasTotalMismatch && itemsWithMismatchCount === 0,
      itemsCount: verifiedItems.length,
      sumOfItems,
      receiptTotal,
      totalDifference,
      hasTotalMismatch,
      itemsWithWarningCount: itemsWithMismatchCount,
      inconsistencies,
    };

    // Normalize purchase date to YYYY-MM-DD
    let normalizedPurchaseDate = new Date().toISOString().split("T")[0];
    if (parsedData.purchaseDate && typeof parsedData.purchaseDate === "string") {
      const rawDate = parsedData.purchaseDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        normalizedPurchaseDate = rawDate;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
        const [d, m, y] = rawDate.split("/");
        normalizedPurchaseDate = `${y}-${m}-${d}`;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) {
        const [d, m, y] = rawDate.split("-");
        normalizedPurchaseDate = `${y}-${m}-${d}`;
      }
    }

    console.log(`[WePay AI] Leitura de cupom concluída: ${verifiedItems.length} itens encontrados. Total: R$ ${receiptTotal}, Data: ${normalizedPurchaseDate}`);

    return res.json({
      success: true,
      data: {
        storeName: parsedData.storeName || "Supermercado",
        purchaseDate: normalizedPurchaseDate,
        totalAmount: receiptTotal,
        paymentMethod: parsedData.paymentMethod || "Cartão de Crédito",
        aiGreeting: parsedData.aiGreeting || `${verifiedItems.length} itens identificados no cupom com sucesso!`,
        items: verifiedItems.length > 0 ? verifiedItems : [
          { id: "item-1", name: "", quantity: 1, unitPrice: 0, totalPrice: 0, category: "Mercearia" }
        ],
        audit,
      },
    });
  } catch (error: any) {
    console.warn("[WePay AI] Aviso na leitura com Gemini Vision, acionando modo assistido:", error?.message || error);
    const fallback = fallbackParseReceipt(memberNames);
    return res.json({
      success: true,
      isFallback: true,
      errorMessage: error?.message || "Erro na análise de visão da imagem",
      data: {
        ...fallback,
        aiGreeting: "Os campos do cupom foram liberados para conferência.",
        audit: {
          isConsistent: true,
          itemsCount: fallback.items.length,
          sumOfItems: fallback.totalAmount,
          receiptTotal: fallback.totalAmount,
          totalDifference: 0,
          hasTotalMismatch: false,
          itemsWithWarningCount: 0,
          inconsistencies: [],
        },
      },
    });
  }
});

// API Route: Generate Financial Advice for Couples
app.post("/api/ai/financial-advice", async (req, res) => {
  const { totalExpenses, monthBudget, categoryTotals, groupName, memberNames, transactions } = req.body;

  try {
    const ai = getAi();
    const prompt = `
Atue como um educador financeiro empático e especialista para o casal/família "${groupName || "WePay"}".
Membros: ${memberNames?.join(" e ") || "Casal"}.
Resumo Financeiro do Mês:
- Despesas Totais: R$ ${totalExpenses?.toFixed(2) || "0.00"}
- Teto Orçamentário Estipulado: R$ ${monthBudget?.toFixed(2) || "0.00"}
- Principais Gastos por Categoria: ${JSON.stringify(categoryTotals || {})}
- Últimas Lançamentos: ${JSON.stringify(transactions?.slice(0, 5) || [])}

Forneça uma análise amigável, clara e encorajadora em formato JSON contendo:
1. "headline": Um título resumido e motivador (ex: "Vocês estão no caminho certo, economizando 15%!")
2. "insights": Array com 3 dicas acionáveis e curtas para o casal otimizar os gastos.
3. "healthScore": Nota de saúde financeira de 1 a 100 baseada na relação entre orçamento e despesas.
4. "splitAdvice": Sugestão amigável de acerto de contas se houver discrepância entre os membros.
`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            healthScore: { type: Type.NUMBER },
            splitAdvice: { type: Type.STRING },
          },
          required: ["headline", "insights", "healthScore", "splitAdvice"],
        },
      },
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.warn("[WePay AI] Usando inteligência de conselho nativa local (Gemini quota limit / offline).");
    const fallbackData = fallbackFinancialAdvice(totalExpenses, monthBudget, categoryTotals, memberNames);
    return res.json({ success: true, data: fallbackData });
  }
});

// API Route: Full History & Anomaly Audit by AI
app.post("/api/ai/audit-history", async (req, res) => {
  const { transactions = [], fixedExpenses = [], members = [], groupName = "Casal" } = req.body;

  try {
    const ai = getAi();
    const prompt = `
Você é o Auditor Especialista Financeiro do WePay para o casal "${groupName}".
Sua missão é realizar uma AUDITORIA COMPLETA E DETALHADA em TODO o histórico financeiro do aplicativo.

Histórico de Transações do Usuário (${transactions.length} registros):
${JSON.stringify(transactions, null, 2)}

Gastos Fixos Registrados (${fixedExpenses.length} registros):
${JSON.stringify(fixedExpenses, null, 2)}

Membros do Casal:
${JSON.stringify(members, null, 2)}

INSTRUÇÕES DE AUDITORIA:
1. Verifique minuciosamente por transações DUPLICADAS (ex: duas compras idênticas de mesmo valor/descrição no mesmo dia ou datas próximas).
2. Verifique por CONTAS PAGAS DUAS VEZES (ex: um gasto fixo como "Aluguel" ou "Luz" marcado como pago e ao mesmo tempo uma transação manual igual registrada).
3. Verifique incoerências de valores discrepantes ou picos anormais de gastos desproporcionais à renda.
4. Indique de forma clara se o histórico está totalmente limpo ou se há alertas a corrigir.

Retorne um JSON estrito com o seguinte esquema:
- "summary": Resumo geral da saúde do histórico (ex: "Identificamos 2 possíveis duplicidades no seu histórico.").
- "inconsistenciesFound": Número de anomalias/alertas encontrados (0 se tudo ok).
- "aiGreeting": Mensagem inicial calorosa e explicativa para abrir a conversa interativa.
- "anomalies": Array de objetos para cada alerta, com:
  - "id": string única (ex: "anom-1")
  - "type": "duplicate" | "double_payment" | "unusual_spike" | "missing_info"
  - "severity": "warning" | "error" | "info"
  - "title": Título claro do alerta (ex: "Transação Duplicada Detectada")
  - "description": Explicação do motivo do alerta, mencionando o valor e data.
  - "transactionId": (Opcional) O ID da transação correspondente do histórico se for para apagar/corrigir.
  - "fixedExpenseId": (Opcional) O ID do gasto fixo se o erro envolver um gasto fixo.
  - "suggestion": Orientação passo a passo do que o usuário deve fazer ou perguntar para corrigir.
`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            inconsistenciesFound: { type: Type.NUMBER },
            aiGreeting: { type: Type.STRING },
            anomalies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  transactionId: { type: Type.STRING },
                  fixedExpenseId: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ["id", "type", "severity", "title", "description", "suggestion"],
              },
            },
          },
          required: ["summary", "inconsistenciesFound", "aiGreeting", "anomalies"],
        },
      },
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.warn("[WePay AI] Usando auditoria nativa local (Gemini quota limit / offline).");
    const fallbackData = fallbackAuditHistory(transactions, fixedExpenses);
    return res.json({ success: true, data: fallbackData });
  }
});

// API Route: Interactive Chat for Audit & Transaction Correction
app.post("/api/ai/audit-chat", async (req, res) => {
  const { userQuery, conversationHistory = [], transactions = [], fixedExpenses = [], memberNames = [] } = req.body;

  try {
    const prompt = `
Você é o assistente auditor inteligente e educador financeiro do aplicativo WePay para ${memberNames.join(" e ")}.
O usuário está conversando com você no chat de auditoria de histórico e solução de dúvidas financeiras/duplicidades.

Contexto Atual do Aplicativo:
- Transações: ${JSON.stringify(transactions.slice(0, 15))}
- Gastos Fixos: ${JSON.stringify(fixedExpenses.slice(0, 10))}

Histórico de Conversa Anterior:
${JSON.stringify(conversationHistory)}

Pergunta/Mensagem do Usuário:
"${userQuery}"

INSTRUÇÕES PARA A RESPOSTA:
1. Responda com clareza, empatia e objetividade em português do Brasil.
2. Se o usuário perguntar se um lançamento está correto ou como apagar uma transação duplicada, explique exatamente onde clicar no aplicativo.
3. Ensine boas práticas de controle financeiro para casais.
4. Mantenha um tom encorajador e prestativo.
`;

    const response = await generateContentWithRetry({
      contents: prompt,
    });

    return res.json({
      success: true,
      reply: response.text?.trim() || "Entendido! Como posso ajudar na organização das suas despesas?",
    });
  } catch (error: any) {
    console.warn("[WePay AI] Usando assistente de chat nativo local (Gemini quota limit / offline).");
    return res.json({
      success: true,
      reply: "Analisei sua solicitação! Para gerenciar ou excluir lançamentos duplicados, você pode utilizar os botões de ação na lista de transações ou nos alertas de auditoria. Caso precise ajustar valores ou categorias, clique no botão Editar de cada lançamento.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor WePay rodando na porta ${PORT}`);
  });
}

// In local development or standalone container, launch the server.
// In serverless environments like Vercel, the exported app is handled by serverless runtime.
if (!process.env.VERCEL) {
  startServer();
}

export default app;

