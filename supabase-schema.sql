create extension if not exists pgcrypto;

create table if not exists public.convidados (
  id uuid primary key default gen_random_uuid(),
  codigo_convite text unique not null,
  nome_exibicao text not null,
  tipo_convite text,
  limite_pessoas integer not null default 1,
  status_resposta text not null default 'pendente',
  quantidade_confirmada integer,
  presente_escolhido_id uuid,
  mensagem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data_resposta timestamptz
);

create table if not exists public.presentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  valor_referencia numeric,
  imagem_url text,
  status text not null default 'disponivel',
  escolhido_por_convite_id uuid,
  data_escolha timestamptz,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logs_respostas (
  id uuid primary key default gen_random_uuid(),
  convite_id uuid references public.convidados(id) on delete set null,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.convidados
  drop constraint if exists convidados_status_resposta_check,
  add constraint convidados_status_resposta_check
    check (status_resposta in ('pendente', 'confirmado', 'recusado'));

alter table public.convidados
  drop constraint if exists convidados_limite_pessoas_check,
  add constraint convidados_limite_pessoas_check
    check (limite_pessoas >= 1);

alter table public.convidados
  drop constraint if exists convidados_quantidade_confirmada_check,
  add constraint convidados_quantidade_confirmada_check
    check (
      quantidade_confirmada is null
      or (
        quantidade_confirmada >= 1
        and quantidade_confirmada <= limite_pessoas
      )
    );

alter table public.presentes
  drop constraint if exists presentes_status_check,
  add constraint presentes_status_check
    check (status in ('disponivel', 'escolhido'));

alter table public.presentes
  drop constraint if exists presentes_valor_referencia_check,
  add constraint presentes_valor_referencia_check
    check (valor_referencia is null or valor_referencia >= 0);

alter table public.convidados
  drop constraint if exists convidados_presente_escolhido_id_fkey,
  add constraint convidados_presente_escolhido_id_fkey
    foreign key (presente_escolhido_id)
    references public.presentes(id)
    on delete set null;

alter table public.presentes
  drop constraint if exists presentes_escolhido_por_convite_id_fkey,
  add constraint presentes_escolhido_por_convite_id_fkey
    foreign key (escolhido_por_convite_id)
    references public.convidados(id)
    on delete set null;

create unique index if not exists presentes_um_por_convite_idx
  on public.presentes (escolhido_por_convite_id)
  where escolhido_por_convite_id is not null;

create index if not exists convidados_codigo_convite_idx
  on public.convidados (codigo_convite);

create index if not exists convidados_status_resposta_idx
  on public.convidados (status_resposta);

create index if not exists presentes_status_ordem_idx
  on public.presentes (status, ordem, nome);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists convidados_set_updated_at on public.convidados;
create trigger convidados_set_updated_at
before update on public.convidados
for each row execute function public.set_updated_at();

drop trigger if exists presentes_set_updated_at on public.presentes;
create trigger presentes_set_updated_at
before update on public.presentes
for each row execute function public.set_updated_at();

alter table public.convidados enable row level security;
alter table public.presentes enable row level security;
alter table public.logs_respostas enable row level security;

revoke all on public.convidados from anon, authenticated;
revoke all on public.presentes from anon, authenticated;
revoke all on public.logs_respostas from anon, authenticated;

drop policy if exists "Bloqueia acesso direto anon convidados" on public.convidados;
create policy "Bloqueia acesso direto anon convidados"
on public.convidados
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Bloqueia acesso direto anon presentes" on public.presentes;
create policy "Bloqueia acesso direto anon presentes"
on public.presentes
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Bloqueia acesso direto anon logs" on public.logs_respostas;
create policy "Bloqueia acesso direto anon logs"
on public.logs_respostas
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.buscar_convite_por_codigo(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convidado public.convidados%rowtype;
  v_presente jsonb;
begin
  select *
    into v_convidado
  from public.convidados
  where codigo_convite = upper(trim(p_codigo))
  limit 1;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'descricao', p.descricao
  )
    into v_presente
  from public.presentes p
  where p.id = v_convidado.presente_escolhido_id;

  return jsonb_build_object(
    'codigo_convite', v_convidado.codigo_convite,
    'nome_exibicao', v_convidado.nome_exibicao,
    'tipo_convite', v_convidado.tipo_convite,
    'limite_pessoas', v_convidado.limite_pessoas,
    'status_resposta', v_convidado.status_resposta,
    'quantidade_confirmada', v_convidado.quantidade_confirmada,
    'mensagem', v_convidado.mensagem,
    'data_resposta', v_convidado.data_resposta,
    'presente_escolhido', v_presente
  );
end;
$$;

create or replace function public.confirmar_presenca(
  p_codigo text,
  p_quantidade integer,
  p_mensagem text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convidado public.convidados%rowtype;
  v_quantidade integer := coalesce(p_quantidade, 1);
begin
  select *
    into v_convidado
  from public.convidados
  where codigo_convite = upper(trim(p_codigo))
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Convite não encontrado. Verifique se o QR Code foi lido corretamente.'
    );
  end if;

  if v_quantidade < 1 or v_quantidade > v_convidado.limite_pessoas then
    return jsonb_build_object(
      'success', false,
      'message', 'A quantidade informada ultrapassa o limite deste convite.',
      'limite_pessoas', v_convidado.limite_pessoas
    );
  end if;

  update public.convidados
  set
    status_resposta = 'confirmado',
    quantidade_confirmada = v_quantidade,
    mensagem = nullif(trim(coalesce(p_mensagem, '')), ''),
    data_resposta = now()
  where id = v_convidado.id
  returning * into v_convidado;

  insert into public.logs_respostas (convite_id, acao, detalhes)
  values (
    v_convidado.id,
    'confirmar_presenca',
    jsonb_build_object('quantidade', v_quantidade)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Presença confirmada.',
    'quantidade_confirmada', v_convidado.quantidade_confirmada,
    'limite_pessoas', v_convidado.limite_pessoas
  );
end;
$$;

create or replace function public.recusar_presenca(
  p_codigo text,
  p_mensagem text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convidado public.convidados%rowtype;
begin
  select *
    into v_convidado
  from public.convidados
  where codigo_convite = upper(trim(p_codigo))
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Convite não encontrado. Verifique se o QR Code foi lido corretamente.'
    );
  end if;

  if v_convidado.presente_escolhido_id is not null then
    update public.presentes
    set
      status = 'disponivel',
      escolhido_por_convite_id = null,
      data_escolha = null
    where id = v_convidado.presente_escolhido_id
      and escolhido_por_convite_id = v_convidado.id;
  end if;

  update public.convidados
  set
    status_resposta = 'recusado',
    quantidade_confirmada = null,
    presente_escolhido_id = null,
    mensagem = nullif(trim(coalesce(p_mensagem, '')), ''),
    data_resposta = now()
  where id = v_convidado.id
  returning * into v_convidado;

  insert into public.logs_respostas (convite_id, acao, detalhes)
  values (v_convidado.id, 'recusar_presenca', '{}'::jsonb);

  return jsonb_build_object(
    'success', true,
    'message', 'Resposta registrada.'
  );
end;
$$;

create or replace function public.listar_presentes_disponiveis(p_codigo text)
returns table (
  id uuid,
  nome text,
  descricao text,
  valor_referencia numeric,
  imagem_url text,
  ordem integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.convidados c
    where c.codigo_convite = upper(trim(p_codigo))
      and c.status_resposta = 'confirmado'
  ) then
    return;
  end if;

  return query
  select
    p.id,
    p.nome,
    p.descricao,
    p.valor_referencia,
    p.imagem_url,
    p.ordem
  from public.presentes p
  where p.status = 'disponivel'
    and p.escolhido_por_convite_id is null
  order by p.ordem, p.nome;
end;
$$;

create or replace function public.escolher_presente(
  p_codigo text,
  p_presente_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convidado public.convidados%rowtype;
  v_presente public.presentes%rowtype;
begin
  select *
    into v_convidado
  from public.convidados
  where codigo_convite = upper(trim(p_codigo))
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Convite não encontrado. Verifique se o QR Code foi lido corretamente.'
    );
  end if;

  if v_convidado.status_resposta <> 'confirmado' then
    return jsonb_build_object(
      'success', false,
      'message', 'Confirme a presença antes de escolher um presente.'
    );
  end if;

  if v_convidado.presente_escolhido_id is not null then
    return jsonb_build_object(
      'success', false,
      'message', 'Este convite já possui um presente escolhido.'
    );
  end if;

  update public.presentes p
  set
    status = 'escolhido',
    escolhido_por_convite_id = v_convidado.id,
    data_escolha = now()
  where p.id = p_presente_id
    and p.status = 'disponivel'
    and p.escolhido_por_convite_id is null
  returning * into v_presente;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Este presente acabou de ser escolhido por outra pessoa. Escolha outra opção.'
    );
  end if;

  update public.convidados
  set presente_escolhido_id = v_presente.id
  where id = v_convidado.id;

  insert into public.logs_respostas (convite_id, acao, detalhes)
  values (
    v_convidado.id,
    'escolher_presente',
    jsonb_build_object('presente_id', v_presente.id, 'presente_nome', v_presente.nome)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Presente escolhido.',
    'presente', jsonb_build_object(
      'id', v_presente.id,
      'nome', v_presente.nome
    )
  );
end;
$$;

create or replace function public.admin_obter_dashboard(p_admin_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
  v_result jsonb;
begin
  v_expected := nullif(current_setting('app.admin_key', true), '');
  v_expected := coalesce(v_expected, 'TROQUE_ESTA_CHAVE_ADMIN');

  if p_admin_key is null or p_admin_key <> v_expected then
    raise exception 'Chave administrativa inválida.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'total_convidados', count(*),
        'confirmados', count(*) filter (where status_resposta = 'confirmado'),
        'recusados', count(*) filter (where status_resposta = 'recusado'),
        'pendentes', count(*) filter (where status_resposta = 'pendente'),
        'quantidade_total_confirmada',
          coalesce(sum(quantidade_confirmada) filter (where status_resposta = 'confirmado'), 0)
      )
      from public.convidados
    ),
    'presentes', (
      select jsonb_build_object(
        'total', count(*),
        'escolhidos', count(*) filter (where status = 'escolhido'),
        'disponiveis', count(*) filter (where status = 'disponivel')
      )
      from public.presentes
    ),
    'convidados', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'nome_exibicao', c.nome_exibicao,
          'codigo_convite', c.codigo_convite,
          'tipo_convite', c.tipo_convite,
          'limite_pessoas', c.limite_pessoas,
          'status_resposta', c.status_resposta,
          'quantidade_confirmada', c.quantidade_confirmada,
          'presente_nome', p.nome,
          'mensagem', c.mensagem,
          'data_resposta', c.data_resposta
        )
        order by c.nome_exibicao
      )
      from public.convidados c
      left join public.presentes p on p.id = c.presente_escolhido_id
    ), '[]'::jsonb),
    'lista_presentes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'nome', p.nome,
          'status', p.status,
          'escolhido_por', c.nome_exibicao,
          'ordem', p.ordem
        )
        order by p.ordem, p.nome
      )
      from public.presentes p
      left join public.convidados c on c.id = p.escolhido_por_convite_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.buscar_convite_por_codigo(text) from public;
revoke all on function public.confirmar_presenca(text, integer, text) from public;
revoke all on function public.recusar_presenca(text, text) from public;
revoke all on function public.listar_presentes_disponiveis(text) from public;
revoke all on function public.escolher_presente(text, uuid) from public;
revoke all on function public.admin_obter_dashboard(text) from public;

grant execute on function public.buscar_convite_por_codigo(text) to anon, authenticated;
grant execute on function public.confirmar_presenca(text, integer, text) to anon, authenticated;
grant execute on function public.recusar_presenca(text, text) to anon, authenticated;
grant execute on function public.listar_presentes_disponiveis(text) to anon, authenticated;
grant execute on function public.escolher_presente(text, uuid) to anon, authenticated;
grant execute on function public.admin_obter_dashboard(text) to anon, authenticated;

-- Configure uma chave real para o painel admin depois de rodar o schema:
-- alter database postgres set "app.admin_key" = 'SUA_CHAVE_LONGA_E_ALEATORIA';

-- Exemplo opcional de cadastro de presentes:
-- insert into public.presentes (nome, descricao, valor_referencia, ordem)
-- values
--   ('Jogo de jantar', 'Uma sugestão para a nova casa.', 280, 10),
--   ('Conjunto de taças', 'Para brindar novos começos.', 180, 20),
--   ('Cota lua de mel', 'Uma contribuição para a viagem dos noivos.', 250, 30);
