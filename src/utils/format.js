// Utilitários de formatação de moeda (Real - pt-BR).
// Implementação manual para garantir o separador correto (milhar "." e decimal ",")
// em qualquer dispositivo, já que o Intl/toLocaleString do Hermes/Android nem sempre
// respeita o locale 'pt-BR' e acaba usando o padrão en-US ("1,234.56").

/**
 * Formata um número no padrão brasileiro sem o prefixo de moeda.
 * Ex.: 1234.5 -> "1.234,50"
 * @param {number|string} valor
 * @returns {string}
 */
export function formatarValor(valor) {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
  const safe = Number.isFinite(n) ? n : 0;
  const negativo = safe < 0;
  const [inteiro, decimal] = Math.abs(safe).toFixed(2).split('.');
  const inteiroFmt = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}${inteiroFmt},${decimal}`;
}

/**
 * Formata um número no padrão brasileiro com o prefixo "R$ ".
 * Ex.: 1234.5 -> "R$ 1.234,50"
 * @param {number|string} valor
 * @returns {string}
 */
export function formatarMoeda(valor) {
  return `R$ ${formatarValor(valor)}`;
}

/**
 * Converte um texto digitado pelo usuário (que pode usar vírgula ou ponto)
 * para um número JavaScript válido. Retorna 0 se inválido.
 * @param {string|number} texto
 * @returns {number}
 */
export function parseValor(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : 0;
  if (!texto) return 0;
  const n = Number(String(texto).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
