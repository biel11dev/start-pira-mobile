// Padroniza as entradas enviadas à API: trim em todos os textos e MAIÚSCULAS nos cadastros de
// produtos/catálogo, funcionários e despesas. Mesmas regras de normalizarEntrada.js das APIs.

// Senhas e tokens nunca são alterados.
const CHAVES_SEM_TRIM = /pass|senha|token|secret/i;

export const maiusculo = (valor) => (typeof valor === 'string' ? valor.trim().toUpperCase() : valor);

function ehObjetoSimples(valor) {
  return valor !== null && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype;
}

function trimProfundo(valor, chave) {
  if (typeof valor === 'string') return CHAVES_SEM_TRIM.test(chave || '') ? valor : valor.trim();
  if (Array.isArray(valor)) return valor.map((v) => trimProfundo(v, chave));
  if (ehObjetoSimples(valor)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, trimProfundo(v, k)]));
  }
  return valor;
}

// Caminhos: "name", "items[].unit" (campo de cada item), "pdvHiddenUnits[]" (lista de textos)
// e "unitPrices{}" (chaves do objeto).
function aplicarMaiusculo(obj, caminho) {
  const [segmento, ...resto] = caminho.split('.');
  const lista = segmento.endsWith('[]');
  const mapa = segmento.endsWith('{}');
  const chave = lista || mapa ? segmento.slice(0, -2) : segmento;
  if (!ehObjetoSimples(obj) || !(chave in obj)) return obj;
  const alvo = obj[chave];

  if (resto.length === 0) {
    if (lista) return Array.isArray(alvo) ? { ...obj, [chave]: alvo.map(maiusculo) } : obj;
    if (mapa) {
      return ehObjetoSimples(alvo)
        ? { ...obj, [chave]: Object.fromEntries(Object.entries(alvo).map(([k, v]) => [maiusculo(k), v])) }
        : obj;
    }
    return { ...obj, [chave]: maiusculo(alvo) };
  }
  const restoCaminho = resto.join('.');
  if (lista) {
    return Array.isArray(alvo) ? { ...obj, [chave]: alvo.map((f) => aplicarMaiusculo(f, restoCaminho)) } : obj;
  }
  return { ...obj, [chave]: aplicarMaiusculo(alvo, restoCaminho) };
}

const REGRAS = [
  { rota: /^\/api\/products(\/\d+)?$/, campos: ['name', 'unit', 'baseUnit', 'pdvHiddenUnits[]', 'unitPrices{}'] },
  { rota: /^\/api\/categories(\/\d+)?$/, campos: ['name'] },
  { rota: /^\/api\/unit-equivalences$/, campos: ['unitName'] },
  { rota: /^\/api\/estoque_prod(\/\d+)?$/, campos: ['name', 'unit', 'comboNome'] },
  { rota: /^\/api\/estoque_prod\/\d+\/combo$/, campos: ['comboNome'] },
  { rota: /^\/api\/estoque_prod\/entrada$/, campos: ['unit'] },
  { rota: /^\/api\/estoque_prod\/converter-(reverso|dose)$/, campos: ['targetUnit'] },
  { rota: /^\/api\/composicoes(\/\d+)?$/, campos: ['nome'] },
  { rota: /^\/api\/composicoes\/(\d+\/opcoes|opcoes\/\d+)$/, campos: ['nome'] },
  { rota: /^\/api\/composicoes\/\d+\/opcao-estoque$/, campos: ['nome', 'unit'] },
  { rota: /^\/api\/employees(\/\d+)?$/, campos: ['name'] },
  { rota: /^\/api\/(despesas|cadastrodesp|desp-pessoal)(\/\d+)?$/, campos: ['nomeDespesa'] },
  { rota: /^\/api\/cat-desp-pessoal(\/\d+)?$/, campos: ['nomeCategoria'] },
  { rota: /^\/api\/sales$/, campos: ['items[].name', 'items[].unit'] },
  { rota: /^\/api\/pdv-comandas\/\d+\/items$/, campos: ['items[].name', 'items[].unit'] },
];

const METODOS = ['post', 'put', 'patch'];

// Retorna o corpo normalizado (sem alterar o objeto original).
export function normalizarCorpo(metodo, url, corpo) {
  if (!METODOS.includes(String(metodo || '').toLowerCase()) || !ehObjetoSimples(corpo)) return corpo;

  const caminho = String(url || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0].replace(/\/+$/, '');
  let resultado = trimProfundo(corpo);
  REGRAS.filter((r) => r.rota.test(caminho)).forEach((r) => {
    r.campos.forEach((c) => {
      resultado = aplicarMaiusculo(resultado, c);
    });
  });
  return resultado;
}
