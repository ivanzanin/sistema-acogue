exports.calcularRendimento = (pesoEntrada, custoKg, cortes) => {
  const custoTotal = pesoEntrada * custoKg;
  let vendaEsperada = 0;
  let pesoDesossado = 0;
  const relatorio = cortes.map(c => {
    const custoCorte = c.pesoKg * custoKg;
    const vendaCorte = c.pesoKg * c.precoVendaKg;
    vendaEsperada += vendaCorte;
    pesoDesossado += c.pesoKg;
    return {
      nome: c.nome, peso: c.pesoKg, custoRateado: custoCorte, vendaProjetada: vendaCorte,
      margemPercentual: (((vendaCorte - custoCorte) / vendaCorte) * 100).toFixed(2)
    };
  });
  return {
    custoTotalInicial: custoTotal, vendaEsperada,
    margemGeral: (((vendaEsperada - custoTotal) / vendaEsperada) * 100).toFixed(2),
    quebraPesoKg: (pesoEntrada - pesoDesossado).toFixed(3),
    cortes: relatorio
  };
};
