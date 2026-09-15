# 🥩 Açougue SaaS — Sistema Completo

## Estrutura

```
acougue-saas-completo/
├── iniciar.bat              ← Inicia o sistema completo com 1 clique
├── limpar.bat               ← Limpeza profunda de temporários e arquivos desnecessários
├── setup.js                 ← Configura banco e .env automaticamente
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── prisma/schema.prisma
│   └── src/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── services/
└── frontend/
    └── src/
        ├── main.jsx
        ├── components/
        ├── pages/
        └── utils/
```

## Pré-requisitos
- Node.js 18+ (disponível em https://nodejs.org)
- Leitor de Código de Barras USB ou Wireless (Plug & Play, sem necessidade de drivers adicionais)

## Como usar
1. Duplo clique em `iniciar.bat`
2. Aguarde inicializar e abrir o navegador automaticamente
3. Caso queira liberar espaço ou limpar caches e temporários, execute `limpar.bat`

## Entrada de Produtos no Caixa
- **Leitor de Código de Barras:** Suporte total a códigos EAN-13 (unitários) e etiquetas geradas por balanças etiquetadoras (prefixo 2 com código de corte + peso ou valor total embutido).
- **Digitação Rápida:** Caso escaneie um produto em KG sem peso impresso na etiqueta, o sistema abre uma janela instantânea para digitação do peso em kg.

## Rotas da API
| Método | Rota                        | Descrição                  |
|--------|-----------------------------|----------------------------|
| POST   | /auth/login                 | Login com CNPJ + senha     |
| GET    | /admin/clientes             | Lista clientes             |
| POST   | /admin/clientes             | Cadastra cliente           |
| PATCH  | /admin/clientes/:id/status  | Atualiza status pagamento  |
| POST   | /desossa/calcular           | Calcula rendimento         |
| POST   | /gestao/desossa             | Adiciona ao estoque        |
| POST   | /gestao/venda               | Registra venda no caixa    |
| GET    | /gestao/caixa/hoje          | Faturamento do dia         |
| GET    | /gestao/estoque             | Saldo de estoque           |

## Telas
| Rota      | Tela                              |
|-----------|-----------------------------------|
| /         | Login (com bloqueio por status)   |
| /pdv      | Frente de Caixa (Leitor de Código)|
| /desossa  | Painel de desossa / rendimento    |
| /gestao   | Caixa do dia + estoque            |
| /assados  | Módulo de Assados e Encomendas    |
| /admin    | Cadastro e gestão de clientes     |

