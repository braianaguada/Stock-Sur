interface CompanyAccessNoticeProps {
  title?: string;
  description?: string;
}

const DEFAULT_TITLE = "Sin empresa asignada";
const DEFAULT_DESCRIPTION = "Tu cuenta todavia no tiene una empresa habilitada. Registrate y despues pedile al superadmin que te asigne una empresa para empezar a operar.";

export function CompanyAccessNotice({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: CompanyAccessNoticeProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-amber-800">{description}</p>
    </div>
  );
}
