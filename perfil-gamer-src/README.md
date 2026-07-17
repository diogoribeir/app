# Perfil Gamer — fonte de dados

Arquivos-fonte do app publicado em `/perfil-gamer/` (biblioteca de jogos PS4/PS5 do Diogo).

| Arquivo | Papel |
|---|---|
| `biblioteca_jogos.xlsx` (aba `Biblioteca de Jogos`) | **Dados mestres** — schema documentado em `biblioteca_jogos.md` |
| `biblioteca_jogos.md` | Documentação viva (regenerada por `gerar_doc.py`) |
| `gerar_doc.py` | Regenera o `.md` a partir do xlsx |
| `gerar_dados.py` | Regenera `../perfil-gamer/dados.js` (os dados do app) a partir do xlsx |
| `.notas_numericas_backup.json` | Equivalente numérico histórico dos veredictos (só análises internas — **nunca** mostrar números ao usuário) |
| `agente_perfil_gamer.md` | Spec do agente de apoio (instalado em `.claude/agents/perfil-gamer.md`) |

## 🔁 Como os dados funcionam agora
- **O app é EDITÁVEL**: registrar/editar/excluir jogos direto na interface, sincronizado no
  Firebase RTDB (nó `planos/perfil-gamer-dt2026`). **A nuvem é a fonte da verdade do dia a dia.**
- `dados.js` (gerado do xlsx) é só a **carga inicial (seed)**: usado na primeira vez ou se a nuvem
  estiver vazia/inacessível.

## Fluxo de atualização em massa (opcional, via xlsx)
1. Editar `biblioteca_jogos.xlsx` (via agente `perfil-gamer` na conversa).
2. Regenerar:
   ```bash
   cd perfil-gamer-src
   python3 gerar_doc.py      # atualiza biblioteca_jogos.md (subir a VERSAO no script)
   python3 gerar_dados.py    # atualiza ../perfil-gamer/dados.js (o seed)
   ```
3. Para o seed valer na nuvem: apagar `planos/perfil-gamer-dt2026/jogos` no RTDB
   (o app sobe o seed novo na próxima abertura). Depois: commit, PR, merge.

> ⚠️ O `PLANO` (fila 2026) e os `INSIGHTS` do app são mantidos dentro do `gerar_dados.py` —
> ao mudarem, editar lá e regenerar.

## Filosofia (respeitar sempre)
Veredictos categóricos estilo ACG (Masterpiece · Muito Bom · Bom · Medíocre · Ruim · Muito Ruim).
Sem notas numéricas na interface; componentes H/G/D/FF aparecem discretos como "análise interna".
Custo líquido fixo por jogo: **R$90** → custo/hora = 90 ÷ horas.
