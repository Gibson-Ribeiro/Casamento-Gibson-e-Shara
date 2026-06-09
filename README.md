# Convite de casamento online | Gibson & Shara

Sistema de convite online responsivo para GitHub Pages, com links individuais por QR Code, confirmação de presença, escolha segura de presentes e painel administrativo pelo Supabase Auth.

URL base prevista:

```text
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/
```

Link individual de convite:

```text
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/?convite=FAB-BRU-8K29XZ
```

Quando a pessoa abre a URL sem `?convite=...`, o site mostra a tela inicial com:

- login dos noivos;
- campo para inserir manualmente o código do QR Code;
- redirecionamento para o convite quando o código é válido.

Se o QR Code ou link estiver inválido, o site volta para essa tela inicial com aviso e permite digitar o código manualmente.

## Supabase usado no front-end

O arquivo `supabaseClient.js` já está configurado com:

```text
SUPABASE_URL=https://bebneplfctyapydfkvcd.supabase.co
SUPABASE_PUBLIC_KEY=sb_publishable_b6MMdn3Zmi7E5fLv1BMtOA_qOD45DLc
```

Essa é uma chave pública. Nunca coloque a `service_role key` no front-end.

## Configurar redirects do Supabase Auth

No Supabase, vá em `Authentication > URL Configuration`.

Para produção no GitHub Pages, configure:

```text
Site URL:
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/
```

Em `Redirect URLs`, adicione:

```text
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/index.html
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/admin.html
```

Para teste local, você pode manter também a URL que estiver usando no momento:

```text
http://127.0.0.1:8920/index.html
```

O importante: não deixe nenhuma URL local como `Site URL` principal quando for usar o GitHub Pages, senão os e-mails de convite/criação de senha voltam para o lugar errado.

O `index.html` já trata links de criação/recuperação de senha do Supabase. Quando o e-mail abrir o site com token ou `?code=...`, aparece a tela `Criar senha`.

## Estrutura

```text
index.html
admin.html
styles.css
app.js
admin.js
supabaseClient.js
supabase-schema.sql
package.json
.env.example
.gitignore
assets/
qrcodes/
scripts/
  convidados-exemplo.csv
  gerar-qrcodes.mjs
  importar-convidados.mjs
```

## 1. Rodar o SQL no Supabase

1. Abra o projeto no Supabase.
2. Vá em `SQL Editor`.
3. Cole todo o conteúdo de `supabase-schema.sql`.
4. Execute.

O SQL cria:

- `convidados`;
- `presentes`;
- `logs_respostas`;
- `admin_usuarios`;
- funções RPC públicas do convite;
- RPC administrativa protegida por Supabase Auth;
- RPC para cadastrar convidados pelo admin usando apenas nome e quantidade;
- RPC para cadastrar presentes pelo admin com link opcional do item;
- RLS bloqueando acesso direto às tabelas por `anon` e `authenticated`;
- allowlist dos admins:
  - `slade.gibson@gmail.com`;
  - `sharalutke@gmail.com`.

Se você já tinha rodado a versão antiga do SQL, pode rodar este arquivo novamente. Ele remove a função admin antiga com chave simples e cria a nova função com autenticação.

## 2. Criar os usuários admins

No Supabase:

1. Vá em `Authentication > Users`.
2. Crie o usuário `slade.gibson@gmail.com`.
3. Crie o usuário `sharalutke@gmail.com`.
4. Se criar por convite/e-mail, o link deve voltar para o GitHub Pages conforme a configuração de redirects acima.
5. Se preferir, crie o usuário pelo painel e depois use `Receber link para criar ou redefinir senha` na tela inicial do site.
6. Confirme o e-mail no painel, se o Supabase pedir confirmação.

Esses e-mails já estão autorizados na tabela `admin_usuarios`. Qualquer outro e-mail que tente entrar no painel será bloqueado pela RPC `admin_obter_dashboard`.

## 3. Cadastrar convidados e presentes no admin

Depois de criar os usuários admins, abra:

```text
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/
```

Faça login com Gibson ou Shara. No painel:

- em `Novo convidado`, informe somente o nome que aparecerá no convite e a quantidade de pessoas;
- o código do convite é gerado automaticamente;
- a tabela mostra o código e o link do convite;
- em `Novo presente`, informe nome, descrição, valor opcional, link do item opcional, imagem opcional e ordem.

O campo `Link do item` aceita URLs começando com `http://` ou `https://`.

## 4. Cadastrar presentes manualmente no SQL

Se preferir cadastrar presentes direto pelo SQL Editor:

```sql
insert into public.presentes (nome, descricao, valor_referencia, imagem_url, link_url, ordem)
values
  ('Jogo de jantar', 'Uma sugestão para a nova casa.', 280, null, 'https://loja.com/jogo-de-jantar', 10),
  ('Conjunto de taças', 'Para brindar novos começos.', 180, null, 'https://loja.com/tacas', 20),
  ('Cota lua de mel', 'Uma contribuição para a viagem dos noivos.', 250, null, null, 30);
```

A escolha de presente é segura no banco. A função `escolher_presente` só atualiza um presente quando ele ainda está `disponivel`; se duas pessoas clicarem ao mesmo tempo, apenas a primeira consegue.

## 5. Gerar QR Codes

Instale as dependências:

```bash
npm install
```

Use o CSV de exemplo:

```bash
npm run gerar:qrcodes
```

Para usar seu próprio CSV no PowerShell:

```powershell
$env:INPUT_CSV="convidados.csv"
$env:OUTPUT_CSV="convidados-com-links.csv"
npm run gerar:qrcodes
```

Formato:

```csv
nome_exibicao,limite_pessoas
Fabiana e Bruno,2
Paloma e Leandro,2
Familia Ribeiro,4
```

Saída:

```text
convidados-com-links.csv
qrcodes/CODIGO.png
```

## 6. Importar convidados

Crie um `.env` a partir de `.env.example` e preencha somente a `SUPABASE_SERVICE_ROLE_KEY` localmente.

Depois rode:

```bash
npm run importar:convidados
```

O script insere convidados novos e atualiza apenas dados cadastrais. Ele não sobrescreve:

- `status_resposta`;
- `quantidade_confirmada`;
- `mensagem`;
- `presente_escolhido_id`.

## 7. Subir no GitHub Pages

1. Use o repositório `Casamento-Gibson-e-Shara`.
2. Envie todos os arquivos.
3. Vá em `Settings > Pages`.
4. Selecione `Deploy from a branch`.
5. Selecione branch `main` e pasta `/root`.

Depois acesse:

```text
https://gibson-ribeiro.github.io/Casamento-Gibson-e-Shara/
```

## 8. Testar

1. Rode o SQL.
2. Crie os dois usuários admins no Supabase Auth.
3. Abra o link inicial sem código e faça login como admin.
4. Cadastre convidados com nome e quantidade.
5. Cadastre presentes com link do item, se houver.
6. Abra um link com `?convite=CODIGO`.
7. Confirme presença e escolha um presente.
8. Abra outro convite e confira que o presente escolhido não aparece mais.

## Personalização

Textos e dados do evento ficam em `app.js`, no objeto `EVENTO`.

Cores e layout ficam em `styles.css`, no bloco `:root`.

A imagem de fundo fica em:

```text
assets/fine-art-bg.png
```

## Segurança

- O link do convite funciona como chave de acesso.
- Use códigos longos e difíceis de adivinhar.
- A `service_role key` deve ficar apenas no `.env` local.
- O front-end usa somente a public key.
- As tabelas têm RLS ativado.
- O painel admin exige login no Supabase Auth e e-mail cadastrado em `admin_usuarios`.
- A escolha de presente é protegida no Postgres, não só no front-end.
