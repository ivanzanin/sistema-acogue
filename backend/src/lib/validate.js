/**
 * Valida e converte para float, retorna null se inválido
 */
function toFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/**
 * Valida e converte para int, retorna null se inválido
 */
function toInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

/**
 * Extrai tenantId do request com validação
 */
function getTenantId(req) {
  const id = req.user?.id;
  if (!id) throw new Error('Tenant nao identificado. Faca login novamente.');
  return id;
}

module.exports = { toFloat, toInt, getTenantId };
