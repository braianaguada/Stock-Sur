-- Provide bounded, company-scoped cash time series for dashboard date filters.
-- Empty periods are included so clients can render continuous charts without
-- synthesizing missing buckets.

create or replace function public.get_dashboard_timeseries(
  p_company_id uuid,
  p_granularity text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_granularity text := lower(btrim(coalesce(p_granularity, '')));
  v_step interval;
  v_first_bucket date;
  v_max_days integer;
  v_buckets jsonb;
  v_can_view_cash boolean;
begin
  if p_company_id is null then
    raise exception using
      errcode = '22023',
      message = 'La empresa es obligatoria';
  end if;

  if p_from is null or p_to is null then
    raise exception using
      errcode = '22023',
      message = 'El rango de fechas es obligatorio';
  end if;

  if p_from > p_to then
    raise exception using
      errcode = '22023',
      message = 'La fecha inicial no puede ser posterior a la fecha final';
  end if;

  case v_granularity
    when 'day' then
      v_step := interval '1 day';
      v_first_bucket := p_from;
      v_max_days := 366;
    when 'week' then
      v_step := interval '1 week';
      v_first_bucket := date_trunc('week', p_from)::date;
      v_max_days := 1095;
    when 'month' then
      v_step := interval '1 month';
      v_first_bucket := date_trunc('month', p_from)::date;
      v_max_days := 3653;
    else
      raise exception using
        errcode = '22023',
        message = 'La granularidad debe ser day, week o month';
  end case;

  if (p_to - p_from + 1) > v_max_days then
    raise exception using
      errcode = '22023',
      message = format(
        'El rango máximo para granularidad %s es de %s días',
        v_granularity,
        v_max_days
      );
  end if;

  if v_actor is null
    or not public.is_company_member(v_actor, p_company_id)
  then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso activo a la empresa indicada';
  end if;

  v_can_view_cash := public.has_company_permission(v_actor, p_company_id, 'cash.view');

  with bucket_series as (
    select generated_at::date as period_start
    from generate_series(
      v_first_bucket::timestamp,
      p_to::timestamp,
      v_step
    ) generated_at
  ),
  sales_by_bucket as (
    select
      case v_granularity
        when 'day' then cs.business_date
        when 'week' then date_trunc('week', cs.business_date)::date
        else date_trunc('month', cs.business_date)::date
      end as period_start,
      sum(cs.amount_total)::numeric as total,
      count(*)::integer as sale_count
    from public.cash_sales cs
    where v_can_view_cash
      and cs.company_id = p_company_id
      and cs.business_date between p_from and p_to
      and cs.status <> 'ANULADA'
    group by 1
  ),
  expenses_by_bucket as (
    select
      case v_granularity
        when 'day' then ce.business_date
        when 'week' then date_trunc('week', ce.business_date)::date
        else date_trunc('month', ce.business_date)::date
      end as period_start,
      sum(ce.amount_total)::numeric as total,
      count(*)::integer as expense_count
    from public.cash_expenses ce
    where v_can_view_cash
      and ce.company_id = p_company_id
      and ce.business_date between p_from and p_to
      and ce.cancelled_at is null
    group by 1
  ),
  document_profit_lines as (
    select
      case v_granularity
        when 'day' then d.issue_date
        when 'week' then date_trunc('week', d.issue_date)::date
        else date_trunc('month', d.issue_date)::date
      end as period_start,
      d.id as document_id,
      case when d.doc_type = 'REMITO_DEVOLUCION' then -1 else 1 end::numeric as sign,
      coalesce(dl.line_total, dl.quantity * dl.unit_price, 0)::numeric as gross_line,
      greatest(coalesce(dl.tax_pct, 0), 0)::numeric as tax_pct,
      greatest(coalesce(dl.base_cost_snapshot, 0), 0)::numeric
        * greatest(coalesce(dl.quantity, 0), 0)::numeric as product_cost
    from public.documents d
    join public.document_lines dl on dl.document_id = d.id
    where v_can_view_cash
      and d.company_id = p_company_id
      and d.issue_date between p_from and p_to
      and d.status = 'EMITIDO'
      and d.doc_type in ('REMITO', 'REMITO_DEVOLUCION')
      and coalesce(d.customer_kind, 'GENERAL') <> 'INTERNO'
  ),
  profit_by_bucket as (
    select
      dpl.period_start,
      sum(
        dpl.sign
          * case
              when dpl.tax_pct > 0
                then dpl.gross_line / (1 + dpl.tax_pct / 100)
              else dpl.gross_line
            end
      )::numeric as net_revenue,
      sum(
        dpl.sign
          * (
              case
                when dpl.tax_pct > 0
                  then dpl.gross_line / (1 + dpl.tax_pct / 100)
                else dpl.gross_line
              end
              - dpl.product_cost
            )
      )::numeric as gross_profit,
      count(distinct dpl.document_id)::integer as document_count
    from document_profit_lines dpl
    group by dpl.period_start
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'periodStart', greatest(b.period_start, p_from),
        'periodEnd', least((b.period_start + v_step)::date - 1, p_to),
        'sales', coalesce(s.total, 0),
        'salesCount', coalesce(s.sale_count, 0),
        'expenses', coalesce(e.total, 0),
        'expenseCount', coalesce(e.expense_count, 0),
        'cashNet', coalesce(s.total, 0) - coalesce(e.total, 0),
        'netRevenue', coalesce(p.net_revenue, 0),
        'grossProfit', coalesce(p.gross_profit, 0),
        'documentCount', coalesce(p.document_count, 0)
      )
      order by b.period_start
    ),
    '[]'::jsonb
  )
  into v_buckets
  from bucket_series b
  left join sales_by_bucket s using (period_start)
  left join expenses_by_bucket e using (period_start)
  left join profit_by_bucket p using (period_start);

  return jsonb_build_object(
    'granularity', v_granularity,
    'from', p_from,
    'to', p_to,
    'buckets', v_buckets
  );
end;
$$;

revoke all on function public.get_dashboard_timeseries(uuid, text, date, date) from public;
grant execute on function public.get_dashboard_timeseries(uuid, text, date, date) to authenticated;

notify pgrst, 'reload schema';
