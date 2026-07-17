function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted/70 ${className}`} />;
}

export function DashboardLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando indicadores del negocio">
      <div className="space-y-3">
        <Block className="h-4 w-32" />
        <Block className="h-9 w-72 max-w-full" />
        <Block className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <Block className="h-[430px] xl:col-span-8" />
        <Block className="h-[430px] xl:col-span-4" />
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <Block className="h-[360px] xl:col-span-8" />
        <Block className="h-[360px] xl:col-span-4" />
      </div>
      <span className="sr-only">Cargando datos reales, por favor esperá.</span>
    </div>
  );
}
