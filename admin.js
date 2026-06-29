import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const adminApp = document.querySelector("#adminApp");
let dashboardAtual = null;
let supabase = null;
let usuarioAtual = null;
let acaoEmAndamento = false;
let edicaoAtual = null;

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

function mensagemErroSupabase(error) {
  const texto = error?.message || String(error || "");
  const normalizado = texto.toLowerCase();

  if (
    normalizado.includes("failed to fetch") ||
    normalizado.includes("fetch failed") ||
    normalizado.includes("networkerror") ||
    normalizado.includes("network request failed") ||
    normalizado.includes("load failed")
  ) {
    return "Nao foi possivel conectar ao Supabase. Verifique se o projeto esta ativo no painel do Supabase, se a URL e a chave publica continuam corretas, e tente novamente.";
  }

  return texto;
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

function valorCampo(value = "") {
  return escapeHtml(value ?? "");
}

function tipoPresenteLabel(tipo = "item") {
  return tipo === "pix" ? "PIX" : "Item";
}

function renderTipoPresenteCampos(presente = {}) {
  const tipo = presente.tipo_presente === "pix" ? "pix" : "item";
  return `
    <fieldset class="segmented-field" data-gift-type-control>
      <legend>Tipo</legend>
      <label>
        <input type="radio" name="tipo_presente" value="item" ${tipo === "item" ? "checked" : ""} />
        <span>Item</span>
      </label>
      <label>
        <input type="radio" name="tipo_presente" value="pix" ${tipo === "pix" ? "checked" : ""} />
        <span>PIX</span>
      </label>
    </fieldset>
    <label data-gift-field="link">
      <span>Link do item</span>
      <input name="link_url" type="url" placeholder="https://loja.com/produto" value="${valorCampo(presente.link_url)}" />
    </label>
    <label data-gift-field="pix">
      <span>Chave PIX aleatoria</span>
      <input name="chave_pix" type="text" placeholder="Cole a chave PIX aqui" value="${valorCampo(presente.chave_pix)}" />
    </label>
  `;
}

function atualizarCamposTipoPresente(form) {
  const tipo = new FormData(form).get("tipo_presente") || "item";
  const campoLink = form.querySelector('[data-gift-field="link"]');
  const campoPix = form.querySelector('[data-gift-field="pix"]');
  const inputPix = form.querySelector('[name="chave_pix"]');
  const inputLink = form.querySelector('[name="link_url"]');

  if (campoLink) campoLink.hidden = tipo === "pix";
  if (campoPix) campoPix.hidden = tipo !== "pix";
  if (inputPix) inputPix.required = tipo === "pix";
  if (inputLink) inputLink.required = false;
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

function renderEditor(convidados, listaPresentes) {
  if (!edicaoAtual) return "";

  if (edicaoAtual.tipo === "convidado") {
    const convidado = convidados.find((item) => item.id === edicaoAtual.id);
    if (!convidado) return "";

    return `
      <section class="admin-edit-panel" data-edit-panel>
        <form class="soft-form admin-create-form" data-admin-form="editar-convidado">
          <h2>Editar convidado</h2>
          <input type="hidden" name="id" value="${escapeHtml(convidado.id)}" />
          <label>
            <span>Nome do convidado, casal ou familia</span>
            <input name="nome_exibicao" type="text" value="${valorCampo(convidado.nome_exibicao)}" required />
          </label>
          <label>
            <span>Quantidade de pessoas</span>
            <input name="limite_pessoas" type="number" min="1" value="${valorCampo(convidado.limite_pessoas || 1)}" inputmode="numeric" required />
          </label>
          <div class="actions">
            <button class="button button--primary" type="submit">Salvar convidado</button>
            <button class="button button--ghost" type="button" data-admin-action="cancelar-edicao">Cancelar</button>
          </div>
        </form>
      </section>
    `;
  }

  if (edicaoAtual.tipo === "presente") {
    const presente = listaPresentes.find((item) => item.id === edicaoAtual.id);
    if (!presente) return "";

    return `
      <section class="admin-edit-panel" data-edit-panel>
        <form class="soft-form admin-create-form" data-admin-form="editar-presente">
          <h2>Editar presente</h2>
          <input type="hidden" name="id" value="${escapeHtml(presente.id)}" />
          <label>
            <span>Nome</span>
            <input name="nome" type="text" value="${valorCampo(presente.nome)}" required />
          </label>
          <label>
            <span>Descricao curta</span>
            <textarea name="descricao" rows="3">${escapeHtml(presente.descricao || "")}</textarea>
          </label>
          <label>
            <span>Valor de referencia</span>
            <input name="valor_referencia" type="number" min="0" step="0.01" value="${valorCampo(presente.valor_referencia ?? "")}" inputmode="decimal" />
          </label>
          ${renderTipoPresenteCampos(presente)}
          <label>
            <span>Link da imagem</span>
            <input name="imagem_url" type="url" value="${valorCampo(presente.imagem_url)}" />
          </label>
          <label>
            <span>Ordem</span>
            <input name="ordem" type="number" value="${valorCampo(presente.ordem || 0)}" inputmode="numeric" />
          </label>
          <div class="actions">
            <button class="button button--primary" type="submit">Salvar presente</button>
            <button class="button button--ghost" type="button" data-admin-action="cancelar-edicao">Cancelar</button>
          </div>
        </form>
      </section>
    `;
  }

  return "";
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
    ["PIX cadastrados", presentes.pix || 0],
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
          <td class="table-actions">
            <button class="table-action" type="button" data-admin-action="editar-convidado" data-id="${escapeHtml(convidado.id)}">Editar</button>
            <button class="table-action table-action--danger" type="button" data-admin-action="excluir-convidado" data-id="${escapeHtml(convidado.id)}">Excluir</button>
          </td>
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
          <td>${escapeHtml(tipoPresenteLabel(presente.tipo_presente))}</td>
          <td>${escapeHtml(formatarMoeda(presente.valor_referencia))}</td>
          <td>${
            presente.tipo_presente === "pix"
              ? escapeHtml(presente.chave_pix || "")
              : presente.link_url
              ? `<a class="table-link" href="${escapeHtml(presente.link_url)}" target="_blank" rel="noopener noreferrer">Ver item</a>`
              : ""
          }</td>
          <td><span class="status status--${escapeHtml(presente.status)}">${labelStatus(presente.status)}</span></td>
          <td>${escapeHtml(presente.tipo_presente === "pix" ? presente.escolhas || 0 : presente.escolhido_por || "")}</td>
          <td class="table-actions">
            <button class="table-action" type="button" data-admin-action="editar-presente" data-id="${escapeHtml(presente.id)}">Editar</button>
            <button class="table-action table-action--danger" type="button" data-admin-action="excluir-presente" data-id="${escapeHtml(presente.id)}">Excluir</button>
          </td>
        </tr>
      `
    )
    .join("");

  const editor = renderEditor(convidados, listaPresentes);

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
            <input name="nome" type="text" placeholder="PIX dos noivos" required />
          </label>
          <label>
            <span>Descrição curta</span>
            <textarea name="descricao" rows="3" placeholder="Uma sugestão para a nova casa."></textarea>
          </label>
          <label>
            <span>Valor de referência</span>
            <input name="valor_referencia" type="number" min="0" step="0.01" placeholder="280.00" inputmode="decimal" />
          </label>
          ${renderTipoPresenteCampos()}
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

      ${editor}

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
                <th>Acoes</th>
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
                <th>Tipo</th>
                <th>Valor</th>
                <th>Link / PIX</th>
                <th>Status</th>
                <th>Escolhas</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>${linhasPresentes}</tbody>
          </table>
        </div>
      </section>
    </section>
  `);

  adminApp
    .querySelectorAll('[data-admin-form="criar-presente"], [data-admin-form="editar-presente"]')
    .forEach(atualizarCamposTipoPresente);
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
    renderLogin(`Não foi possível carregar a conexão com o Supabase: ${mensagemErroSupabase(error)}`);
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
      renderLogin(`Não foi possível entrar: ${mensagemErroSupabase(error)}`);
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

    const { data, error } = await client.rpc("admin_salvar_presente", {
      p_presente_id: null,
      p_nome: String(formData.get("nome") || "").trim(),
      p_descricao: String(formData.get("descricao") || "").trim() || null,
      p_valor_referencia: valor ? Number(valor) : null,
      p_imagem_url: String(formData.get("imagem_url") || "").trim() || null,
      p_link_url: String(formData.get("link_url") || "").trim() || null,
      p_tipo_presente: String(formData.get("tipo_presente") || "item"),
      p_chave_pix: String(formData.get("chave_pix") || "").trim() || null,
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
    atualizarCamposTipoPresente(form);
    await carregarDashboard();
    renderAvisoAdmin("Presente cadastrado.", data.presente?.nome || "Item salvo na lista.");
  });
}

async function editarConvidado(form, botao) {
  const formData = new FormData(form);

  await executarComBloqueio(botao, async () => {
    const client = await prepararSupabase();
    if (!client) return;

    const { data, error } = await client.rpc("admin_atualizar_convidado", {
      p_convidado_id: String(formData.get("id") || ""),
      p_nome_exibicao: String(formData.get("nome_exibicao") || "").trim(),
      p_limite_pessoas: Number(formData.get("limite_pessoas") || 1),
    });

    if (error || !data?.success) {
      renderAvisoAdmin(
        "Nao foi possivel atualizar o convidado.",
        data?.message || error?.message || "Revise os dados e tente novamente."
      );
      return;
    }

    edicaoAtual = null;
    await carregarDashboard();
    renderAvisoAdmin("Convidado atualizado.", data.convidado?.nome_exibicao || "Alteracao salva.");
  });
}

async function editarPresente(form, botao) {
  const formData = new FormData(form);
  const valor = String(formData.get("valor_referencia") || "").trim();
  const ordem = String(formData.get("ordem") || "").trim();

  await executarComBloqueio(botao, async () => {
    const client = await prepararSupabase();
    if (!client) return;

    const { data, error } = await client.rpc("admin_salvar_presente", {
      p_presente_id: String(formData.get("id") || ""),
      p_nome: String(formData.get("nome") || "").trim(),
      p_descricao: String(formData.get("descricao") || "").trim() || null,
      p_valor_referencia: valor ? Number(valor) : null,
      p_imagem_url: String(formData.get("imagem_url") || "").trim() || null,
      p_link_url: String(formData.get("link_url") || "").trim() || null,
      p_tipo_presente: String(formData.get("tipo_presente") || "item"),
      p_chave_pix: String(formData.get("chave_pix") || "").trim() || null,
      p_ordem: ordem ? Number(ordem) : 0,
    });

    if (error || !data?.success) {
      renderAvisoAdmin(
        "Nao foi possivel atualizar o presente.",
        data?.message || error?.message || "Revise os dados e tente novamente."
      );
      return;
    }

    edicaoAtual = null;
    await carregarDashboard();
    renderAvisoAdmin("Presente atualizado.", data.presente?.nome || "Alteracao salva.");
  });
}

async function excluirConvidado(id) {
  if (!window.confirm("Excluir este convidado? Esta acao nao pode ser desfeita.")) return;

  const client = await prepararSupabase();
  if (!client) return;

  const { data, error } = await client.rpc("admin_excluir_convidado", {
    p_convidado_id: id,
  });

  if (error || !data?.success) {
    renderAvisoAdmin(
      "Nao foi possivel excluir o convidado.",
      data?.message || error?.message || "Tente novamente."
    );
    return;
  }

  edicaoAtual = null;
  await carregarDashboard();
  renderAvisoAdmin("Convidado excluido.", "A lista foi atualizada.");
}

async function excluirPresente(id) {
  if (!window.confirm("Excluir este presente? Convites que escolheram este item ficarao sem presente escolhido.")) return;

  const client = await prepararSupabase();
  if (!client) return;

  const { data, error } = await client.rpc("admin_excluir_presente", {
    p_presente_id: id,
  });

  if (error || !data?.success) {
    renderAvisoAdmin(
      "Nao foi possivel excluir o presente.",
      data?.message || error?.message || "Tente novamente."
    );
    return;
  }

  edicaoAtual = null;
  await carregarDashboard();
  renderAvisoAdmin("Presente excluido.", "A lista foi atualizada.");
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
  if (form.dataset.adminForm === "editar-convidado") editarConvidado(form, botao);
  if (form.dataset.adminForm === "editar-presente") editarPresente(form, botao);
});

adminApp.addEventListener("click", async (event) => {
  const botao = event.target.closest("[data-admin-action]");
  if (!botao) return;

  if (botao.dataset.adminAction === "exportar") exportarCsv();
  if (botao.dataset.adminAction === "atualizar") carregarDashboard();
  if (botao.dataset.adminAction === "cancelar-edicao") {
    edicaoAtual = null;
    renderDashboard(dashboardAtual || {});
  }
  if (botao.dataset.adminAction === "editar-convidado") {
    edicaoAtual = { tipo: "convidado", id: botao.dataset.id };
    renderDashboard(dashboardAtual || {});
    document.querySelector("[data-edit-panel]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (botao.dataset.adminAction === "editar-presente") {
    edicaoAtual = { tipo: "presente", id: botao.dataset.id };
    renderDashboard(dashboardAtual || {});
    document.querySelector("[data-edit-panel]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (botao.dataset.adminAction === "excluir-convidado") excluirConvidado(botao.dataset.id);
  if (botao.dataset.adminAction === "excluir-presente") excluirPresente(botao.dataset.id);
  if (botao.dataset.adminAction === "sair") {
    const client = await prepararSupabase();
    if (client) await client.auth.signOut();
    usuarioAtual = null;
    dashboardAtual = null;
    renderLogin();
  }
});

adminApp.addEventListener("change", (event) => {
  if (event.target.name !== "tipo_presente") return;
  const form = event.target.closest("form");
  if (form) atualizarCamposTipoPresente(form);
});

carregarDashboard();
