// Funções de data centralizadas — TODOS os controllers usam estas
// Resolve o problema de timezone (UTC vs local) que causava bugs

/**
 * Retorna meia-noite do dia atual no horário local
 * Usado para: buscar vendas/operações do dia, gravar campo 'data'
 */
function inicioDia() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Retorna 23:59:59 do dia atual no horário local
 * Usado para: limite superior de buscas do dia
 */
function fimDia() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Parseia uma string 'YYYY-MM-DD' como meia-noite LOCAL (não UTC)
 * Usado para: filtros de data do histórico
 */
function parseDataLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Parseia uma string 'YYYY-MM-DD' como fim do dia LOCAL
 */
function parseDataLocalFim(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * Retorna o primeiro dia do mês atual
 */
function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Retorna 7 dias atrás
 */
function inicioSemana() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

module.exports = { inicioDia, fimDia, parseDataLocal, parseDataLocalFim, inicioMes, inicioSemana };
