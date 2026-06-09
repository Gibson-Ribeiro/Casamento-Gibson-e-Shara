# Convite de casamento online | Gibson & Shara

Sistema de convite online responsivo para GitHub Pages, com links individuais por QR Code e banco de dados no Supabase.

Cada convidado recebe um link neste formato:

```text
https://gibsonribeiro.github.io/convite-casamento/?convite=FAB-BRU-8K29XZ
```

O parâmetro `convite` funciona como a chave de acesso. Use códigos longos e difíceis de adivinhar.

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

## 1. Criar o projeto no Supabase

1. Acesse o Supabase e crie um novo projeto.
2. Abra `SQL Editor`.
3. Copie todo o conteúdo de `supabase-schema.sql`.
4. Execute o SQL.
5. Em `Project Settings > API`, copie:
   - Project URL
   - anon public key
   - service_role key

Nunca coloque a `service_role key` no front-end. Ela só deve ficar no `.env` local.

## 2. Configurar o front-end

Abra `supabaseClient.js` e substitua:

```js
const SUPABASE_URL = "COLE_AQUI_A_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_A_ANON_KEY";
```

Use apenas a `anon public key`.

## 3. Configurar variáveis locais

Crie um arquivo `.env` a partir de `.env.example`:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
BASE_URL=https://gibsonribeiro.github.io/convite-casamento/
```

O `.env` já está no `.gitignore`.

## 4. Configurar chave do admin

O painel `admin.html` usa uma RPC com chave administrativa digitada no navegador. Não é um sistema completo de autenticação, mas evita exposição direta dos dados e serve para acompanhamento inicial.

No SQL Editor do Supabase, rode:

```sql
alter database postgres set "app.admin_key" = 'COLOQUE_UMA_CHAVE_LONGA_E_ALEATORIA_AQUI';
```

Depois, feche e abra novamente o painel admin. Se a configuração não refletir imediatamente, aguarde alguns minutos ou reinicie a conexão no painel do Supabase.

Para segurança real em produção, acompanhe os dados pelo painel do Supabase ou evolua o admin para usar Supabase Auth.

## 5. Cadastrar presentes

No Supabase, insira presentes na tabela `presentes`.

Exemplo:

```sql
insert into public.presentes (nome, descricao, valor_referencia, imagem_url, ordem)
values
  ('Jogo de jantar', 'Uma sugestão para a nova casa.', 280, null, 10),
  ('Conjunto de taças', 'Para brindar novos começos.', 180, null, 20),
  ('Cota lua de mel', 'Uma contribuição para a viagem dos noivos.', 250, null, 30);
```

Quando um convidado escolhe um presente, a função `escolher_presente` atualiza o registro apenas se ele ainda estiver `disponivel`. Se duas pessoas tentarem escolher ao mesmo tempo, só a primeira grava.

## 6. Gerar QR Codes

Instale as dependências:

```bash
npm install
```

Você pode usar o exemplo:

```bash
npm run gerar:qrcodes
```

Por padrão, o script lê:

```text
scripts/convidados-exemplo.csv
```

E gera:

```text
convidados-com-links.csv
qrcodes/CODIGO.png
```

Para usar um CSV próprio:

PowerShell:

```powershell
$env:INPUT_CSV="convidados.csv"
$env:OUTPUT_CSV="convidados-com-links.csv"
npm run gerar:qrcodes
```

macOS/Linux:

```bash
INPUT_CSV=convidados.csv OUTPUT_CSV=convidados-com-links.csv npm run gerar:qrcodes
```

Formato do CSV:

```csv
nome_exibicao,tipo_convite,limite_pessoas
Fabiana e Bruno,casal,2
Paloma e Leandro,casal,2
Magda e Gian,casal,2
Djuly e Matheus,casal,2
Família Ribeiro,familia,4
```

O script gera códigos como:

```text
FAB-BRU-8K29XZ
```

## 7. Importar convidados no Supabase

Depois de gerar `convidados-com-links.csv`, rode:

```bash
npm run importar:convidados
```

Para importar outro arquivo:

```powershell
$env:CSV_FINAL="convidados-com-links.csv"
npm run importar:convidados
```

O script usa `SUPABASE_SERVICE_ROLE_KEY` do `.env`, insere convidados novos e atualiza apenas dados cadastrais de convidados existentes. Ele não altera:

- `status_resposta`
- `quantidade_confirmada`
- `mensagem`
- `presente_escolhido_id`

Assim, respostas já existentes não são sobrescritas.

## 8. Subir no GitHub Pages

1. Crie um repositório chamado `convite-casamento`.
2. Envie os arquivos para o GitHub.
3. No repositório, acesse `Settings > Pages`.
4. Em `Build and deployment`, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Aguarde o GitHub publicar.

URL esperada:

```text
https://gibsonribeiro.github.io/convite-casamento/
```

## 9. Testar o fluxo

1. Cadastre pelo menos um presente.
2. Gere os QR Codes.
3. Importe os convidados.
4. Abra um link do CSV final.
5. Confirme presença.
6. Escolha um presente.
7. Abra outro convite e confirme que o presente escolhido não aparece mais.
8. Acesse `admin.html` e confira os totais.

## 10. Personalizar textos, data, local e cores

Textos e dados do evento ficam em `app.js`, no objeto `EVENTO` e nas funções de renderização.

Cores, espaçamentos e estilo visual ficam em `styles.css`, nos tokens do `:root`.

A imagem de fundo fica em:

```text
assets/fine-art-bg.png
```

## Segurança

- Não use códigos simples.
- Não exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador.
- O front-end usa somente a anon key.
- As tabelas têm RLS ativado e não permitem acesso direto por `anon`.
- As ações públicas passam por RPCs com validação pelo código do convite.
- A escolha de presente é protegida no banco pela função `escolher_presente`.
- O painel admin é um acompanhamento inicial. Para um admin realmente seguro, use Supabase Auth.
