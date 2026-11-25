# Revisao de seguranca

Data: 2026-11-25

## Vulnerabilidades corrigidas

| # | Severidade | Arquivos | Vulnerabilidade | Confiança |
|---|---|---|---|---|
| 1 | MEDIUM | `game.js`, `index.html`, `.senha-desbloqueio.md` | Senha mestre removida do cliente e do repositório. O desbloqueio por chave fixa foi eliminado. | 10/10 |
| 2 | MEDIUM | `vite.config.js`, `game.js` | Tokens LAN movidos para o cabeçalho `Authorization: Bearer`. Senhas das salas são comparadas por hashes com comparação em tempo constante. | 8/10 |
| 3 | MEDIUM | `story-progression.js` | IDs inválidos em habilidades, vitórias e desbloqueios são filtrados durante a normalização do progresso local. | 10/10 |

## Correcoes adicionais

- Removidos os campos de URL e chave Supabase que não possuíam integração ativa.
- Removidos o campo de senha mestre e as configurações relacionadas.
- Validação básica adicionada ao snapshot publicado pelo anfitrião da sala LAN.
- Adicionada proteção contra IDs desconhecidos em listas persistidas no `localStorage`.

## Limitacoes

- Dados locais continuam modificáveis pelo navegador. Sem servidor ou assinatura, não é possível garantir integridade ou autoria no armazenamento exclusivo do cliente.
- HTTP permanece adequado somente para uma rede local confiável. HTTPS/WSS seria necessário para proteção em redes não confiáveis.
- Os tokens LAN não aparecem mais na URL, mas continuam sendo bearer tokens em memória e precisam ser revogados ao fechar ou expirar a sala.
