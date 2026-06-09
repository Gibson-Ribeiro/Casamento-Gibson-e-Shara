import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const baseUrl =
  process.env.BASE_URL || "https://gibsonribeiro.github.io/convite-casamento/";
const inputCsv = path.resolve(rootDir, process.env.INPUT_CSV || "scripts/convidados-exemplo.csv");
const outputCsv = path.resolve(rootDir, process.env.OUTPUT_CSV || "convidados-com-links.csv");
const qrDir = path.resolve(rootDir, process.env.QR_OUTPUT_DIR || "qrcodes");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenAleatorio(tamanho = 6) {
  let token = "";
  for (let index = 0; index < tamanho; index += 1) {
    token += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return token;
}

function prefixoDoNome(nome) {
  const ignorar = new Set(["E", "DE", "DA", "DO", "DAS", "DOS"]);
  const palavras = normalizarTexto(nome)
    .toUpperCase()
    .split(" ")
    .filter((palavra) => palavra && !ignorar.has(palavra));

  const partes = palavras.slice(0, 2).map((palavra) => palavra.slice(0, 3));
  if (partes.length === 0) return "CONV";
  if (partes.length === 1) return partes[0].padEnd(3, "X");
  return partes.join("-");
}

function montarLink(codigo) {
  const url = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("convite", codigo);
  return url.toString();
}

async function arquivoExiste(caminho) {
  try {
    await fs.access(caminho);
    return true;
  } catch {
    return false;
  }
}

function gerarCodigo(nome, codigosUsados) {
  let codigo = "";
  do {
    codigo = `${prefixoDoNome(nome)}-${tokenAleatorio()}`;
  } while (codigosUsados.has(codigo));
  codigosUsados.add(codigo);
  return codigo;
}

async function main() {
  if (!(await arquivoExiste(inputCsv))) {
    throw new Error(`CSV de entrada nao encontrado: ${inputCsv}`);
  }

  await fs.mkdir(qrDir, { recursive: true });

  const csv = await fs.readFile(inputCsv, "utf8");
  const registros = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (!registros.length) {
    throw new Error("O CSV de entrada nao possui convidados.");
  }

  const codigosUsados = new Set();
  const linhas = [];

  for (const registro of registros) {
    const nome = registro.nome_exibicao?.trim();
    if (!nome) {
      throw new Error("Existe uma linha sem nome_exibicao.");
    }

    const codigoExistente = registro.codigo_convite?.trim().toUpperCase();
    if (codigoExistente && codigosUsados.has(codigoExistente)) {
      throw new Error(`Codigo duplicado no CSV: ${codigoExistente}`);
    }

    const codigo = codigoExistente || gerarCodigo(nome, codigosUsados);
    codigosUsados.add(codigo);

    const linkConvite = montarLink(codigo);
    const arquivoQr = path.join("qrcodes", `${codigo}.png`).replaceAll("\\", "/");
    const caminhoQr = path.resolve(rootDir, arquivoQr);

    await QRCode.toFile(caminhoQr, linkConvite, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 1200,
      color: {
        dark: "#34302b",
        light: "#fbf7ef",
      },
    });

    linhas.push({
      nome_exibicao: nome,
      limite_pessoas: registro.limite_pessoas || "1",
      codigo_convite: codigo,
      link_convite: linkConvite,
      arquivo_qrcode: arquivoQr,
    });
  }

  const saida = stringify(linhas, {
    header: true,
    columns: [
      "nome_exibicao",
      "limite_pessoas",
      "codigo_convite",
      "link_convite",
      "arquivo_qrcode",
    ],
  });

  await fs.writeFile(outputCsv, `\ufeff${saida}`, "utf8");

  console.log(`QR Codes gerados em: ${qrDir}`);
  console.log(`CSV final gerado em: ${outputCsv}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
