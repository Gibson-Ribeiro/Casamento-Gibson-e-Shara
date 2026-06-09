import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const csvFinal = path.resolve(rootDir, process.env.CSV_FINAL || "convidados-com-links.csv");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function inteiroPositivo(valor, padrao = 1) {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) && numero > 0 ? numero : padrao;
}

async function arquivoExiste(caminho) {
  try {
    await fs.access(caminho);
    return true;
  } catch {
    return false;
  }
}

async function buscarExistente(codigo) {
  const { data, error } = await supabase
    .from("convidados")
    .select("id,status_resposta,presente_escolhido_id")
    .eq("codigo_convite", codigo)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function inserirOuAtualizar(registro) {
  const codigo = registro.codigo_convite?.trim().toUpperCase();
  const nome = registro.nome_exibicao?.trim();

  if (!codigo || !nome) {
    return {
      status: "ignorado",
      detalhe: `Linha sem codigo_convite ou nome_exibicao: ${JSON.stringify(registro)}`,
    };
  }

  const payload = {
    codigo_convite: codigo,
    nome_exibicao: nome,
    tipo_convite: registro.tipo_convite || null,
    limite_pessoas: inteiroPositivo(registro.limite_pessoas, 1),
  };

  const existente = await buscarExistente(codigo);

  if (!existente) {
    const { error } = await supabase.from("convidados").insert(payload);
    if (error) throw error;
    return { status: "inserido", detalhe: codigo };
  }

  const { error } = await supabase
    .from("convidados")
    .update(payload)
    .eq("id", existente.id);

  if (error) throw error;

  const protegido =
    existente.status_resposta !== "pendente" || existente.presente_escolhido_id;

  return {
    status: protegido ? "atualizado_sem_resposta" : "atualizado",
    detalhe: codigo,
  };
}

async function main() {
  if (!(await arquivoExiste(csvFinal))) {
    throw new Error(`CSV final nao encontrado: ${csvFinal}`);
  }

  const csv = await fs.readFile(csvFinal, "utf8");
  const registros = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const resumo = {
    inserido: 0,
    atualizado: 0,
    atualizado_sem_resposta: 0,
    ignorado: 0,
  };

  for (const registro of registros) {
    const resultado = await inserirOuAtualizar(registro);
    resumo[resultado.status] += 1;
    console.log(`${resultado.status}: ${resultado.detalhe}`);
  }

  console.log("\nResumo da importacao:");
  console.table(resumo);
  console.log(
    "Respostas existentes foram preservadas: o script nao altera status_resposta, quantidade_confirmada, mensagem nem presente_escolhido_id."
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
