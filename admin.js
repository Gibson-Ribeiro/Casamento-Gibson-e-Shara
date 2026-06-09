import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const adminApp = document.querySelector("#adminApp");
let dashboardAtual = null;
let supabase = null;
let usuarioAtual = null;
let acaoEmAndamento = false;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setAdmin(html) {
  adminApp.innerHTML = html;
}

function labelStatus(status) {
  const labels = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    recusado: "Recusado",
    disponivel: "Disponível",
    escolhido: "Escolhido",
  };
  return labels[status] || status || "-";
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function montarLinkConvite(codigo) {
  const base = new URL(window.location.href);
  base.pathname = base.pathname.replace(/admin\.html$/i, "");
  base.search = "";
  base.hash = "";
  base.searchParams.set("convite", codigo);
  return base.toString();
}

function renderLogin(erro = "") {
  setAdmin(`
    <article class="paper-card form-card fade-in">
      <p class="eyebrow">Painel dos noivos</p>
      <h1>Acompanhamento</h1>
      <p class="lead">
        Entre com o e-mail autorizado no Supabase Auth para visualizar as respostas.
      </p>
      ${erro ? `<div class="notice notice--warn">${escapeHtml(erro)}</div>` : ""}
      <form class="soft-form" data-admin-form="login">
        <label>
          <span>E-mail</span>
          <input
            name="email"
            type="email"
            autocomplete="email"
            placeholder="seu@email.com"
            required
          />
        </label>
        <label>
          <span>Senha</span>
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="Senha do Supabase"
            required
          />
        </label>
        <button class="button button--primary" type="submit">
          Entrar
        </button>
        <a class="text-link" href="./index.html">Voltar para a entrada</a>
      </form>
    </article>
  `);
}

function renderConfiguracaoPendente() {
  setAdmin(`
    <article class="paper-card paper-card--center fade-in">
      <p class="eyebrow">Configuração</p>
      <h1>Supabase pendente.</h1>
      <p class="lead">
        Cole a URL e a public key no arquivo supabaseClient.js antes de usar o painel.
      </p>
    </article>
  `);
}

function renderCarregando() {
  setAdmin(`
    <div class="loading-card">
      <span class="loader" aria-hidden="true"></span>
      <p>Atualizando painel...</p>
    </div>
  `);
}

function renderDashboard(dashboard) {
  dashboardAtual = dashboard;
  const totais = dashboard.totais || {};
  const presentes = dashboard.presentes || {};
  const convidados = dashboard.convidados || [];
  const listaPresentes = dashboard.lista_presentes || [];

  const cards = [
    ["Total de convidados", totais.total_convidados || 0],
    ["Confirmados", totais.confirmados || 0],
    ["Recusados", totais.recusados || 0],
    ["Pendentes", totais.pendentes || 0],
    ["Pessoas confirmadas", totais.quantidade_total_confirmada || 0],
    ["Presentes escolhidos", presentes.escolhidos || 0],
    ["Presentes disponíveis", presentes.disponiveis || 0],
  ]
    .map(
      ([label, value]) => `
        <article class="metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");

  const linhasConvidados = convidados
    .map(
      (convidado) => {
        const linkConvite = montarLinkConvite(convidado.codigo_convite);
        return `
        <tr>
          <td>${escapeHtml(convidado.nome_exibicao)}</td>
          <td>${escapeHtml(convidado.codigo_convite)}</td>
          <td><a class="table-link" href="${escapeHtml(linkConvite)}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
          <td><span class="status status--${escapeHtml(convidado.status_resposta)}">${labelStatus(convidado.status_resposta)}</span></td>
          <td>${escapeHtml(convidado.quantidade_confirmada ?? "")}</td>
          <td>${escapeHtml(convidado.presente_nome || "")}</td>
        </tr>
      `;
      }
    )
    .join("");

  const linhasPresentes = listaPresentes
    .map(
      (presente) => `
        <tr>
          <td>${escapeHtml(presente.nome)}</td>
          <td>${escapeHtml(formatarMoeda(presente.valor_referencia))}</td>
          <td>${
            presente.link_url
              ? `<a class="table-link" href="${escapeHtml(presente.link_url)}" target="_blank" rel="noopener noreferrer">Ver item</a>`
              : ""
          }</td>
          <td><span class="status status--${escapeHtml(presente.status)}">${labelStatus(presente.status)}</span></td>
          <td>${escapeHtml(presente.escolhido_por || "")}</td>
        </tr>
      `
    )
    .join("");

  setAdmin(`
    <section class="admin-dashboard fade-in">
      <header class="admin-header">
        <div>
          <p class="eyebrow">Gibson & Shara</p>
          <h1>Painel do casamento</h1>
          <p class="admin-user">${escapeHtml(usuarioAtual?.email || "")}</p>
        </div>
        <div class="admin-actions">
          <button class="button button--secondary" type="button" data-admin-action="exportar">
            Exportar CSV
          </button>
          <button class="button button--ghost" type="button" data-admin-action="atualizar">
            Atualizar
          </button>
          <button class="button button--ghost" type="button" data-admin-action="sair">
            Sair
          </button>
        </div>
      </header>

      <div class="metrics-grid">${cards}</div>

      <div class="notice notice--warn admin-feedback" data-admin-feedback hidden></div>

      <section class="admin-forms-grid">
        <form class="soft-form admin-create-form" data-admin-form="criar-convidado">
          <h2>Novo convidado</h2>
          <p>Informe apenas o nome que aparecerá no convite e a quantidade de pessoas.</p>
          <label>
            <span>Nome do convidado, casal ou família</span>
            <input
              name="nome_exibicao"
              type="text"
              placeholder="Fabiana e Bruno"
              required
            />
          </label>
          <label>
            <span>Quantidade de pessoas</span>
            <input
              name="limite_pessoas"
              type="number"
              min="1"
              value="1"
              inputmode="numeric"
              required
            />
          </label>
          <button class="button button--primary" type="submit">
            Cadastrar convidado
          </button>
        </form>

        <form class="soft-form admin-create-form" data-admin-form="criar-presente">
          <h2>Novo presente</h2>
          <p>O link do item é opcional, mas já fica disponível para o convidado consultar.</p>
          <label>
            <span>Nome do presente</span>
            <input name="nome" type="text" placeholder="Jogo de jantar" required />
          </label>
          <label>
            <span>Descrição curta</span>
            <textarea name="descricao" rows="3" placeholder="Uma sugestão para a nova casa."></textarea>
          </label>
          <label>
            <span>Valor de referência</span>
            <input name="valor_referencia" type="number" min="0" step="0.01" placeholder="280.00" inputmode="decimal" />
          </label>
          <label>
            <span>Link do item</span>
            <input name="link_url" type="url" placeholder="https://loja.com/produto" />
          </label>
          <label>
            <span>Link da imagem</span>
            <input name="imagem_url" type="url" placeholder="https://loja.com/imagem.jpg" />
          </label>
          <label>
            <span>Ordem</span>
            <input name="ordem" type="number" value="0" inputmode="numeric" />
          </label>
          <button class="button button--primary" type="submit">
            Cadastrar presente
          </button>
        </form>
      </section>

      <section class="admin-table-section">
        <h2>Convidados</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Código</th>
                <th>Link</th>
                <th>Status</th>
                <th>Qtd.</th>
                <th>Presente</th>
              </tr>
            </thead>
            <tbody>${linhasConvidados}</tbody>
          </table>
        </div>
      </section>

      <section class="admin-table-section">
        <h2>Presentes</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Presente</th>
                <th>Valor</th>
                <th>Link</th>
                <th>Status</th>
                <th>Escolhido por</th>
              </tr>
            </thead>
            <tbody>${linhasPresentes}</tbody>
          </table>
        </div>
      </section>
    </section>
  `);
}

async function prepararSupabase() {
  if (!isSupabaseConfigured()) {
    renderConfiguracaoPendente();
    return null;
  }

  try {
    supabase = supabase || (await getSupabaseClient());
    return supabase;
  } catch (error) {
    renderLogin(`Não foi possível carregar a conexão com o Supabase: ${error.message}`);
    return null;
  }
}

async function executarComBloqueio(botao, tarefa) {
  if (acaoEmAndamento) return;
  acaoEmAndamento = true;
  const textoOriginal = botao?.textContent;
  if (botao) {
    botao.disabled = true;
    botao.textContent = "Aguarde...";
  }

  try {
    await tarefa();
  } finally {
    acaoEmAndamento = false;
    if (botao && document.body.contains(botao)) {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }
}

async function carregarDashboard() {
  renderCarregando();
  const client = await prepararSupabase();
  if (!client) return;

  const { data: sessionData } = await client.auth.getSession();
  usuarioAtual = sessionData.session?.user || null;

  if (!usuarioAtual) {
    renderLogin();
    return;
  }

  const { data, error } = await client.rpc("admin_obter_dashboard");

  if (error) {
    await client.auth.signOut();
    usuarioAtual = null;
    renderLogin("Acesso não autorizado para este e-mail ou painel indisponível.");
    return;
  }

  renderDashboard(data || {});
}

async function entrarAdmin(form, botao) {
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  await executarComBloqueio(botao, async () => {
    const client = await prepararSupabase();
    if (!client) return;

    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      renderLogin(`Não foi possível entrar: ${error.message}`);
      return;
    }

    await carregarDashboard();
  });
}

function renderAvisoAdmin(titulo, texto) {
  const aviso = document.querySelector("[data-admin-feedback]");
  if (!aviso) return;

  aviso.innerHTML = `
    <strong>${escapeHtml(titulo)}</strong>
    <span>${escapeHtml(texto)}</span>
  `;
  aviso.hidden = false;
  aviso.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function cadastrarConvidado(form, botao) {
  const formData = new FormData(form);
  const nome = String(formData.get("nome_exibicao") || "").trim();
  const limite = Number(formData.get("limite_pessoas") || 1);

  await executarComBloqueio(botao, async () => {
    const client = await prepararSupabase();
    if (!client) return;

    const { data, error } = await client.rpc("admin_criar_convidado", {
      p_nome_exibicao: nome,
      p_limite_pessoas: limite,
    });

    if (error || !data?.success) {
      renderAvisoAdmin(
        "Não foi possível cadastrar o convidado.",
        data?.message || error?.message || "Revise os dados e tente novamente."
      );
      return;
    }

    form.reset();
    await carregarDashboard();
    renderAvisoAdmin(
      "Convidado cadastrado.",
      `Código gerado: ${data.convidado?.codigo_convite || ""}`
    );
  });
}

async function cadastrarPresente(form, botao) {
  const formData = new FormData(form);
  const valor = String(formData.get("valor_referencia") || "").trim();
  const ordem = String(formData.get("ordem") || "").trim();

  await executarComBloqueio(botao, async () => {
    const client = await prepararSupabase();
    if (!client) return;

    const { data, error } = await client.rpc("admin_criar_presente", {
      p_nome: String(formData.get("nome") || "").trim(),
      p_descricao: String(formData.get("descricao") || "").trim() || null,
      p_valor_referencia: valor ? Number(valor) : null,
      p_imagem_url: String(formData.get("imagem_url") || "").trim() || null,
      p_link_url: String(formData.get("link_url") || "").trim() || null,
      p_ordem: ordem ? Number(ordem) : 0,
    });

    if (error || !data?.success) {
      renderAvisoAdmin(
        "Não foi possível cadastrar o presente.",
        data?.message || error?.message || "Revise os dados e tente novamente."
      );
      return;
    }

    form.reset();
    await carregarDashboard();
    renderAvisoAdmin("Presente cadastrado.", data.presente?.nome || "Item salvo na lista.");
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportarCsv() {
  const convidados = dashboardAtual?.convidados || [];
  const linhas = [
    [
      "nome_exibicao",
      "codigo_convite",
      "link_convite",
      "status_resposta",
      "quantidade_confirmada",
      "presente",
      "data_resposta",
    ],
    ...convidados.map((convidado) => [
      convidado.nome_exibicao,
      convidado.codigo_convite,
      montarLinkConvite(convidado.codigo_convite),
      convidado.status_resposta,
      convidado.quantidade_confirmada,
      convidado.presente_nome,
      convidado.data_resposta,
    ]),
  ];

  const csv = linhas.map((linha) => linha.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "respostas-casamento.csv";
  link.click();
  URL.revokeObjectURL(url);
}

adminApp.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const botao = form.querySelector('button[type="submit"]');

  if (form.dataset.adminForm === "login") entrarAdmin(form, botao);
  if (form.dataset.adminForm === "criar-convidado") cadastrarConvidado(form, botao);
  if (form.dataset.adminForm === "criar-presente") cadastrarPresente(form, botao);
});

adminApp.addEventListener("click", async (event) => {
  const botao = event.target.closest("[data-admin-action]");
  if (!botao) return;

  if (botao.dataset.adminAction === "exportar") exportarCsv();
  if (botao.dataset.adminAction === "atualizar") carregarDashboard();
  if (botao.dataset.adminAction === "sair") {
    const client = await prepararSupabase();
    if (client) await client.auth.signOut();
    usuarioAtual = null;
    dashboardAtual = null;
    renderLogin();
  }
});

carregarDashboard();
