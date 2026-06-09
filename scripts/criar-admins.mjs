import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admins = [
  {
    email: "slade.gibson@gmail.com",
    password: process.env.ADMIN_GIBSON_PASSWORD,
    name: "Gibson",
  },
  {
    email: "sharalutke@gmail.com",
    password: process.env.ADMIN_SHARA_PASSWORD,
    name: "Shara",
  },
];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.");
  process.exit(1);
}

const missingPassword = admins.find((admin) => !admin.password || admin.password.length < 6);

if (missingPassword) {
  console.error(
    `Defina uma senha com pelo menos 6 caracteres para ${missingPassword.email} no .env.`
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function buscarUsuarioPorEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );

    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function criarOuAtualizarAdmin({ email, password, name }) {
  const existente = await buscarUsuarioPorEmail(email);

  if (existente) {
    const { error } = await supabase.auth.admin.updateUserById(existente.id, {
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) throw error;
    return { email, status: "atualizado", id: existente.id };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) throw error;
  return { email, status: "criado", id: data.user.id };
}

async function main() {
  for (const admin of admins) {
    const resultado = await criarOuAtualizarAdmin(admin);
    console.log(`${resultado.status}: ${resultado.email}`);
  }

  console.log("\nAdmins prontos. Agora entre pelo site usando e-mail e senha.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
