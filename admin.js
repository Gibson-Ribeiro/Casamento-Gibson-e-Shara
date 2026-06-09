import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const adminApp = document.querySelector("#adminApp");
const storageKey = "casamento_admin_key";
let dashboardAtual = null;
let supabase = null;

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

function renderLogin(erro = "") {
  setAdmin(`
    <article class="paper-card form-card fade-in">
      <p class="eyebrow">Painel dos noivos</p>
      <h1>Acompanhamento</h1>
      <p class="lead">
        Digite a chave administrativa configurada no Supabase para visualizar as respostas.
      </p>
      ${erro ? `<div class="notice notice--warn">${escapeHtml(erro)}</div>` : ""}
      <form class="soft-form" data-admin-form="login">
        <label>
          <span>Chave administrativa</span>
          <input
            name="adminKey"
            type="password"
            autocomplete="current-password"
            placeholder="Digite a chave"
            required
          />
        </label>
        <button class="button button--primary" type="submit">
          Entrar
        </button>
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
        Cole a URL e a anon key no arquivo supabaseClient.js antes de usar o painel.
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
      (convidado) => `
        <tr>
          <td>${escapeHtml(convidado.nome_exibicao)}</td>
          <td>${escapeHtml(convidado.codigo_convite)}</td>
          <td><span class="status status--${escapeHtml(convidado.status_resposta)}">${labelStatus(convidado.status_resposta)}</span></td>
          <td>${escapeHtml(convidado.quantidade_confirmada ?? "")}</td>
          <td>${escapeHtml(convidado.presente_nome || "")}</td>
        </tr>
      `
    )
    .join("");

  const linhasPresentes = listaPresentes
    .map(
      (presente) => `
        <tr>
          <td>${escapeHtml(presente.nome)}</td>
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
        </div>
        <div class="admin-actions">
          <button class="button button--secondary" type="button" data-admin-action="exportar">
            Exportar CSV
          </button>
          <button class="button button--ghost" type="button" data-admin-action="sair">
            Sair
          </button>
        </div>
      </header>

      <div class="metrics-grid">${cards}</div>

      <section class="admin-table-section">
        <h2>Convidados</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Código</th>
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

async function carregarDashboard(adminKey) {
  renderCarregando();
  try {
    supabase = supabase || (await getSupabaseClient());
  } catch (error) {
    renderLogin(`Não foi possível carregar a conexão com o Supabase: ${error.message}`);
    return;
  }

  const { data, error } = await supabase.rpc("admin_obter_dashboard", {
    p_admin_key: adminKey,
  });

  if (error) {
    sessionStorage.removeItem(storageKey);
    renderLogin("Chave inválida ou painel indisponível. Verifique a configuração no Supabase.");
    return;
  }

  sessionStorage.setItem(storageKey, adminKey);
  renderDashboard(data || {});
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
      "status_resposta",
      "quantidade_confirmada",
      "presente",
      "data_resposta",
    ],
    ...convidados.map((convidado) => [
      convidado.nome_exibicao,
      convidado.codigo_convite,
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
  if (form.dataset.adminForm !== "login") return;

  const adminKey = String(new FormData(form).get("adminKey") || "").trim();
  if (!adminKey) return;
  carregarDashboard(adminKey);
});

adminApp.addEventListener("click", (event) => {
  const botao = event.target.closest("[data-admin-action]");
  if (!botao) return;

  if (botao.dataset.adminAction === "exportar") exportarCsv();
  if (botao.dataset.adminAction === "sair") {
    sessionStorage.removeItem(storageKey);
    renderLogin();
  }
});

if (!isSupabaseConfigured()) {
  renderConfiguracaoPendente();
} else {
  const savedKey = sessionStorage.getItem(storageKey);
  if (savedKey) carregarDashboard(savedKey);
  else renderLogin();
}
