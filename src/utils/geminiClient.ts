import { GoogleGenAI } from '@google/genai';
import {
  parseExpenseFallback,
  financialAdviceFallback,
  auditHistoryFallback,
  auditChatFallback,
  balanceAnalysisFallback,
  BalanceAIAnalysis,
} from './aiFallback';

export type { BalanceAIAnalysis };

const CLIENT_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-2.5-pro'];

export function getGeminiApiKey(): string | null {
  const localKey = localStorage.getItem('wepay_gemini_api_key');
  if (localKey && localKey.trim()) {
    return localKey.trim();
  }
  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv.VITE_GEMINI_API_KEY) {
    return metaEnv.VITE_GEMINI_API_KEY;
  }
  return null;
}

export function setGeminiApiKey(key: string) {
  if (key.trim()) {
    localStorage.setItem('wepay_gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('wepay_gemini_api_key');
  }
}

async function executeGeminiWithFallback(apiKey: string, generateParams: { contents: any; config?: any }) {
  const ai = new GoogleGenAI({ apiKey });
  let lastErr: any = null;

  for (const model of CLIENT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: generateParams.contents,
        config: generateParams.config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || JSON.stringify(err);
      console.warn(`[WePay Client AI] Modelo ${model} indisponível ou em alta demanda:`, errMsg);
      // If 503 high demand or 429 rate limit, short delay before trying the next model
      if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429')) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  throw lastErr || new Error('Não foi possível processar a requisição de IA.');
}

export async function parseExpenseWithGemini(text: string, memberNames: string[]) {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const prompt = `Você é a Joy, assistente financeira inteligente do aplicativo WePay para casais e famílias.
Sua missão é extrair os dados do lançamento financeiro a partir da frase do usuário.
Retorne ESTRITAMENTE um JSON sem marcações de código markdown extras, com o formato:

{
  "description": "descrição limpa e objetiva",
  "amount": número_float_positivo,
  "category": "Alimentação" | "Transporte" | "Moradia" | "Saúde" | "Lazer" | "Compras" | "Serviços" | "Outros",
  "categoryIcon": "Utensils" | "Car" | "Home" | "HeartPulse" | "Tv" | "ShoppingBag" | "Receipt" | "Sparkles",
  "type": "expense" | "income" | "fixed",
  "paidBy": "nome do membro que pagou/recebeu (dentre: ${memberNames.join(', ')})",
  "splitType": "equal" | "individual" | "proportional",
  "aiResponse": "frase amigável de confirmação da Joy em português"
}

Frase do usuário: "${text}"
Membros cadastrados: ${memberNames.join(', ')}`;

      const response = await executeGeminiWithFallback(apiKey, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.amount !== undefined) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gemini Client Direct Call error, using fallback:', err);
    }
  }

  // Fallback to local Portuguese parser engine
  return parseExpenseFallback(text, memberNames);
}

export async function getFinancialAdviceWithGemini(
  totalExpenses: number,
  monthBudget: number,
  categoryTotals: Record<string, number>,
  memberNames: string[]
) {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const prompt = `Você é a Joy, consultora financeira inteligente do casal (${memberNames.join(' e ')}).
Gere uma análise financeira curta, motivadora e acionável em JSON com a estrutura:
{
  "headline": "frase principal do estado financeiro atual",
  "insights": ["dica 1 útil de economia ou divisão", "dica 2 sobre a maior categoria de gasto", "dica 3 sobre o orçamento"],
  "healthScore": número_inteiro_0_a_100,
  "splitAdvice": "conselho de divisão justa do casal"
}

Dados atuais:
- Total gasto no mês: R$ ${totalExpenses.toFixed(2)}
- Teto orçamentário definido: R$ ${monthBudget.toFixed(2)}
- Gastos por categoria: ${JSON.stringify(categoryTotals)}
- Integrantes: ${memberNames.join(', ')}`;

      const response = await executeGeminiWithFallback(apiKey, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
      }
    } catch (err) {
      console.warn('Gemini advice fallback:', err);
    }
  }

  return financialAdviceFallback(totalExpenses, monthBudget, categoryTotals, memberNames);
}

export async function chatAuditWithGemini(
  userQuery: string,
  transactions: any[],
  memberNames: string[]
) {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const prompt = `Você é a Joy, assistente de finanças pessoais do casal (${memberNames.join(' e ')}).
Responda a dúvida do usuário de forma amigável, clara e útil em português em no máximo 3 frases.

Histórico resumido (${transactions.length} transações):
${JSON.stringify(transactions.slice(0, 10))}

Dúvida do usuário: "${userQuery}"`;

      const response = await executeGeminiWithFallback(apiKey, {
        contents: prompt,
      });

      if (response && response.text) {
        return response.text.trim();
      }
    } catch (err) {
      console.warn('Gemini chat fallback:', err);
    }
  }

  return auditChatFallback(userQuery, transactions, memberNames);
}

export async function getBalanceAIAnalysisWithGemini(
  currentBalance: number,
  totalIncome: number,
  totalExpenses: number,
  totalFixedPaid: number,
  totalFixedToPay: number,
  monthName: string,
  memberNames: string[] = []
): Promise<BalanceAIAnalysis> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const prompt = `Você é a Joy, inteligência artificial financeira do aplicativo WePay para famílias e casais.
Analise os números do Balanço Geral do mês de ${monthName} para ${memberNames.join(' e ')} e gere um aviso/diagnóstico financeiro executivo de alto impacto.

Dados do Balanço Geral:
- Saldo Atual em Caixa: R$ ${currentBalance.toFixed(2)}
- Renda Familiar Total Recebida: R$ ${totalIncome.toFixed(2)}
- Gastos Totais do Mês: R$ ${totalExpenses.toFixed(2)}
- Contas Fixas Pagas: R$ ${totalFixedPaid.toFixed(2)}
- Contas Fixas Pendentes: R$ ${totalFixedToPay.toFixed(2)}

Retorne ESTRITAMENTE um JSON no seguinte formato (sem markdown codeblocks):
{
  "status": "positive" | "warning" | "danger" | "neutral",
  "badge": "texto curto (ex: Equilíbrio Seguro, Alerta de Orçamento, Balanço Saudável, Déficit no Mês)",
  "headline": "frase executiva de 1 linha resumindo a saúde do balanço e o principal ponto de atenção",
  "detailedAnalysis": "parágrafo claro de 2 a 3 frases explicando o equilíbrio entre renda, gastos e contas pendentes",
  "keyFactors": [
    { "label": "Comprometimento da Renda", "value": "XX%", "impact": "good" | "warning" | "neutral" },
    { "label": "Margem de Segurança", "value": "R$ XX,XX", "impact": "good" | "warning" | "neutral" },
    { "label": "Previsão Pós-Quitação", "value": "R$ XX,XX", "impact": "good" | "warning" | "neutral" }
  ],
  "recommendations": [
    "recomendação prática 1 acionável para o casal neste mês",
    "recomendação prática 2 focada em reservas, corte de gastos ou divisão justa"
  ],
  "projectedEndMonthBalance": número_float_estimado,
  "incomeCommitmentRate": número_inteiro_porcentagem
}`;

      const response = await executeGeminiWithFallback(apiKey, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed && parsed.headline && parsed.detailedAnalysis) {
          return parsed as BalanceAIAnalysis;
        }
      }
    } catch (err) {
      console.warn('Gemini balance analysis fallback:', err);
    }
  }

  return balanceAnalysisFallback(
    currentBalance,
    totalIncome,
    totalExpenses,
    totalFixedPaid,
    totalFixedToPay,
    monthName,
    memberNames
  );
}

