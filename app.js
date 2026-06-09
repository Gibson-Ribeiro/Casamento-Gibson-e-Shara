import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient.js";

const app = document.querySelector("#app");

const EVENTO = {
  casal: "Gibson & Shara",
  data: "12 de julho",
  horario: "15h",
  local: "Bosque Lutke",
  endereco: "Rua Ipê, 125, bairro Padre Martinho Stein, Timbó",
};

let codigoConvite = lerCodigoDaUrl();
let conviteAtual = null;
let acaoEmAndamento = false;
let supabase = null;

function lerCodigoDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizarCodigo(params.get("convite") || "");
}

function normalizarCodigo(codigo = "") {
  return String(codigo).trim().replace(/\s+/g, "").toUpperCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function definirTela(html) {
  app.innerHTML = html;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function limparUrlInicial() {
  if (window.location.search) {
    window.history.replaceState({}, "", window.location.pathname);
  }
  codigoConvite = "";
}

function mostrarCarregando(texto = "Preparando seu convite...") {
  definirTela(`
    <div class="loading-card">
      <span class="loader" aria-hidden="true"></span>
      <p>${escapeHtml(texto)}</p>
    </div>
  `);
}

function mostrarMensagem({ titulo, texto, detalhe = "", acao = "" }) {
  definirTela(`
    <article class="paper-card paper-card--center fade-in">
      <p class="eyebrow">Gibson & Shara</p>
      <h1>${escapeHtml(titulo)}</h1>
      <p class="lead">${escapeHtml(texto)}</p>
      ${detalhe ? `<p class="muted">${escapeHtml(detalhe)}</p>` : ""}
      ${acao}
    </article>
  `);
}

function renderizarInicio({ aviso = "", detalhe = "" } = {}) {
  limparUrlInicial();

  definirTela(`
    <article class="paper-card home-card fade-in">
      <p class="eyebrow">Gibson & Shara</p>
      <h1>Entrada do casamento</h1>
      <p class="lead">
        Acesse o painel dos noivos ou informe o código impresso no QR Code do convite.
      </p>

      ${
        aviso
          ? `<div class="notice notice--warn">
              <strong>${escapeHtml(aviso)}</strong>
              ${detalhe ? `<span>${escapeHtml(detalhe)}</span>` : ""}
            </div>`
          : ""
      }

      <div class="home-grid">
        <form class="soft-form home-section" data-form="codigo-convite">
          <h2>Acessar convite</h2>
          <p>
            Digite o código do QR Code para abrir o convite personalizado.
          </p>
          <label>
            <span>Código do QR Code</span>
            <input
              name="codigo"
              type="text"
              autocomplete="one-time-code"
              placeholder="FAB-BRU-8K29XZ"
              required
            />
          </label>
          <button class="button button--secondary" type="submit">
            Abrir convite
          </button>
        </form>

        <form class="soft-form home-section" data-form="login-admin">
          <h2>Área dos noivos</h2>
          <p>
            Acesso restrito para Gibson e Shara acompanharem as respostas.
          </p>
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
            Entrar no painel
          </button>
        </form>
      </div>
    </article>
  `);
}

function botaoVoltarConvite() {
  return `
    <button class="button button--ghost" type="button" data-action="voltar-convite">
      Voltar ao convite
    </button>
  `;
}

function renderizarConvite() {
  const nome = conviteAtual?.nome_exibicao || "Convidado especial";
  definirTela(`
    <article class="paper-card invite-card fade-in">
      <p class="eyebrow">Convite de casamento</p>
      <h1>${EVENTO.casal}</h1>
      <p class="subtitle">Celebram o amor, a família e o início de uma nova história.</p>

      <div class="guest-panel">
        <span>Com carinho para</span>
        <strong>${escapeHtml(nome)}</strong>
      </div>

      <p class="lead">
        Será uma alegria compartilhar este momento tão especial com vocês.
      </p>

      <dl class="event-details">
        <div>
          <dt>Data</dt>
          <dd>${EVENTO.data}</dd>
        </div>
        <div>
          <dt>Horário</dt>
          <dd>${EVENTO.horario}</dd>
        </div>
        <div>
          <dt>Local</dt>
          <dd>${EVENTO.local}</dd>
        </div>
        <div class="event-details__wide">
          <dt>Endereço</dt>
          <dd>${EVENTO.endereco}</dd>
        </div>
      </dl>

      <div class="actions">
        <button class="button button--primary" type="button" data-action="abrir-confirmacao">
          Confirmar presença
        </button>
        <button class="button button--secondary" type="button" data-action="abrir-recusa">
          Infelizmente não poderei ir
        </button>
      </div>
    </article>
  `);
}

function renderizarFormularioConfirmacao() {
  const limite = Math.max(Number(conviteAtual?.limite_pessoas || 1), 1);
  const quantidadeAtual = conviteAtual?.quantidade_confirmada || 1;

  definirTela(`
    <article class="paper-card form-card fade-in">
      <p class="eyebrow">Confirmação de presença</p>
      <h1>Que alegria ter vocês conosco.</h1>
      <p class="lead">
        Informe quantas pessoas deste convite poderão participar.
      </p>

      <form class="soft-form" data-form="confirmacao">
        <label>
          <span>Quantidade confirmada</span>
          <input
            name="quantidade"
            type="number"
            min="1"
            max="${limite}"
            value="${Math.min(quantidadeAtual, limite)}"
            inputmode="numeric"
            required
          />
          <small>Este convite permite até ${limite} pessoa${limite > 1 ? "s" : ""}.</small>
        </label>

        <label>
          <span>Mensagem opcional</span>
          <textarea
            name="mensagem"
            maxlength="300"
            rows="3"
            placeholder="Deixe uma mensagem breve, se desejar."
          >${escapeHtml(conviteAtual?.mensagem || "")}</textarea>
        </label>

        <div class="actions">
          <button class="button button--primary" type="submit">
            Continuar para presentes
          </button>
          ${botaoVoltarConvite()}
        </div>
      </form>
    </article>
  `);
}

function renderizarFormularioRecusa() {
  definirTela(`
    <article class="paper-card form-card fade-in">
      <p class="eyebrow">Resposta ao convite</p>
      <h1>Obrigado por nos avisar.</h1>
      <p class="lead">
        Se quiser, deixe uma mensagem breve para os noivos antes de enviar.
      </p>

      <form class="soft-form" data-form="recusa">
        <label>
          <span>Mensagem opcional</span>
          <textarea
            name="mensagem"
            maxlength="300"
            rows="3"
            placeholder="Escreva aqui, se desejar."
          >${escapeHtml(conviteAtual?.mensagem || "")}</textarea>
        </label>

        <div class="actions">
          <button class="button button--secondary" type="submit">
            Enviar resposta
          </button>
          ${botaoVoltarConvite()}
        </div>
      </form>
    </article>
  `);
}

async function renderizarPresentes(mensagem = "") {
  mostrarCarregando("Buscando presentes disponíveis...");

  const { data, error } = await supabase.rpc("listar_presentes_disponiveis", {
    p_codigo: codigoConvite,
  });

  if (error) {
    renderizarInicio({
      aviso: "Não foi possível carregar os presentes.",
      detalhe: error.message,
    });
    return;
  }

  const presentes = data || [];
  const cards = presentes
    .map((presente) => {
      const valor = formatarMoeda(presente.valor_referencia);
      const linkItem = presente.link_url
        ? `<a class="gift-link" href="${escapeHtml(presente.link_url)}" target="_blank" rel="noopener noreferrer">Ver item</a>`
        : "";
      return `
        <article class="gift-card">
          ${
            presente.imagem_url
              ? `<img src="${escapeHtml(presente.imagem_url)}" alt="" loading="lazy" />`
              : `<div class="gift-card__placeholder" aria-hidden="true">G&S</div>`
          }
          <div>
            <h2>${escapeHtml(presente.nome)}</h2>
            ${presente.descricao ? `<p>${escapeHtml(presente.descricao)}</p>` : ""}
            ${valor ? `<span>${valor}</span>` : ""}
            ${linkItem}
          </div>
          <button
            class="button button--primary button--small"
            type="button"
            data-action="escolher-presente"
            data-presente-id="${escapeHtml(presente.id)}"
          >
            Escolher este presente
          </button>
        </article>
      `;
    })
    .join("");

  definirTela(`
    <section class="gifts-view fade-in">
      <div class="gifts-header">
        <p class="eyebrow">Presença confirmada</p>
        <h1>Escolha um presente</h1>
        <p class="lead">
          Preparamos algumas sugestões com carinho. Escolha uma opção que ainda esteja disponível.
        </p>
      </div>
      ${
        mensagem
          ? `<div class="notice notice--warn">${escapeHtml(mensagem)}</div>`
          : ""
      }
      ${
        presentes.length
          ? `<div class="gift-grid">${cards}</div>`
          : `<div class="empty-state">No momento não há presentes disponíveis. Sua presença já foi confirmada com carinho.</div>`
      }
    </section>
  `);
}

function renderizarFinal(presenteNome = "") {
  const detalhe = presenteNome
    ? `Presente escolhido: ${presenteNome}.`
    : "Sua resposta já foi registrada.";

  mostrarMensagem({
    titulo: "Presença confirmada com carinho.",
    texto: "Obrigado por fazer parte da nossa história.",
    detalhe,
  });
}

function renderizarRecusaFinal() {
  mostrarMensagem({
    titulo: "Resposta registrada.",
    texto: "Obrigado por responder ao nosso convite com tanto carinho.",
    detalhe: "Sentiremos sua falta neste dia especial.",
  });
}

async function prepararSupabase() {
  if (!isSupabaseConfigured()) {
    renderizarInicio({
      aviso: "Configuração pendente.",
      detalhe: "Cole a URL e a public key do Supabase no arquivo supabaseClient.js.",
    });
    return null;
  }

  try {
    supabase = supabase || (await getSupabaseClient());
    return supabase;
  } catch (error) {
    renderizarInicio({
      aviso: "Não foi possível carregar a conexão.",
      detalhe: "Verifique sua internet e as chaves do Supabase.",
    });
    return null;
  }
}

async function buscarConvite() {
  if (!codigoConvite) {
    renderizarInicio();
    return;
  }

  mostrarCarregando();
  const client = await prepararSupabase();
  if (!client) return;

  const { data, error } = await client.rpc("buscar_convite_por_codigo", {
    p_codigo: codigoConvite,
  });

  if (error) {
    renderizarInicio({
      aviso: "Não foi possível abrir o convite.",
      detalhe: error.message,
    });
    return;
  }

  if (!data) {
    renderizarInicio({
      aviso: "Convite não encontrado.",
      detalhe: "Verifique o QR Code ou digite o código manualmente.",
    });
    return;
  }

  conviteAtual = data;

  if (conviteAtual.status_resposta === "recusado") {
    renderizarRecusaFinal();
    return;
  }

  if (conviteAtual.status_resposta === "confirmado") {
    if (conviteAtual.presente_escolhido?.nome) {
      renderizarFinal(conviteAtual.presente_escolhido.nome);
      return;
    }

    await renderizarPresentes();
    return;
  }

  renderizarConvite();
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

function abrirConvitePorCodigo(form) {
  const formData = new FormData(form);
  const codigo = normalizarCodigo(formData.get("codigo"));

  if (!codigo) {
    renderizarInicio({
      aviso: "Informe o código do convite.",
      detalhe: "Ele aparece no QR Code ou no link recebido.",
    });
    return;
  }

  const destino = new URL(window.location.href);
  destino.search = "";
  destino.searchParams.set("convite", codigo);
  window.location.href = destino.toString();
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
      renderizarInicio({
        aviso: "Não foi possível entrar no painel.",
        detalhe: error.message,
      });
      return;
    }

    window.location.href = "./admin.html";
  });
}

async function enviarConfirmacao(form, botao) {
  const formData = new FormData(form);
  const quantidade = Number(formData.get("quantidade"));
  const mensagem = String(formData.get("mensagem") || "").trim();

  await executarComBloqueio(botao, async () => {
    const { data, error } = await supabase.rpc("confirmar_presenca", {
      p_codigo: codigoConvite,
      p_quantidade: quantidade,
      p_mensagem: mensagem || null,
    });

    if (error || !data?.success) {
      mostrarMensagem({
        titulo: "Não foi possível confirmar.",
        texto: data?.message || "Revise os dados e tente novamente.",
        detalhe: error?.message || "",
        acao: botaoVoltarConvite(),
      });
      return;
    }

    conviteAtual = {
      ...conviteAtual,
      status_resposta: "confirmado",
      quantidade_confirmada: data.quantidade_confirmada,
      mensagem,
    };
    await renderizarPresentes();
  });
}

async function enviarRecusa(form, botao) {
  const formData = new FormData(form);
  const mensagem = String(formData.get("mensagem") || "").trim();

  await executarComBloqueio(botao, async () => {
    const { data, error } = await supabase.rpc("recusar_presenca", {
      p_codigo: codigoConvite,
      p_mensagem: mensagem || null,
    });

    if (error || !data?.success) {
      mostrarMensagem({
        titulo: "Não foi possível registrar sua resposta.",
        texto: data?.message || "Tente novamente em alguns instantes.",
        detalhe: error?.message || "",
        acao: botaoVoltarConvite(),
      });
      return;
    }

    renderizarRecusaFinal();
  });
}

async function escolherPresente(presenteId, botao) {
  await executarComBloqueio(botao, async () => {
    const { data, error } = await supabase.rpc("escolher_presente", {
      p_codigo: codigoConvite,
      p_presente_id: presenteId,
    });

    if (error) {
      mostrarMensagem({
        titulo: "Não foi possível escolher o presente.",
        texto: "Tente novamente em alguns instantes.",
        detalhe: error.message,
        acao: `<button class="button button--primary" type="button" data-action="recarregar-presentes">Voltar aos presentes</button>`,
      });
      return;
    }

    if (!data?.success) {
      await renderizarPresentes(
        data?.message ||
          "Este presente acabou de ser escolhido por outra pessoa. Escolha outra opção."
      );
      return;
    }

    renderizarFinal(data.presente?.nome || "");
  });
}

app.addEventListener("click", (event) => {
  const botao = event.target.closest("[data-action]");
  if (!botao) return;

  const action = botao.dataset.action;
  if (action === "abrir-confirmacao") renderizarFormularioConfirmacao();
  if (action === "abrir-recusa") renderizarFormularioRecusa();
  if (action === "voltar-convite") renderizarConvite();
  if (action === "recarregar-presentes") renderizarPresentes();
  if (action === "escolher-presente") {
    escolherPresente(botao.dataset.presenteId, botao);
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const botao = form.querySelector('button[type="submit"]');

  if (form.dataset.form === "codigo-convite") abrirConvitePorCodigo(form);
  if (form.dataset.form === "login-admin") entrarAdmin(form, botao);
  if (form.dataset.form === "confirmacao") enviarConfirmacao(form, botao);
  if (form.dataset.form === "recusa") enviarRecusa(form, botao);
});

buscarConvite();
