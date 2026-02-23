const MissingEnvScreen = ({ missingVars }: { missingVars: string[] }) => {
  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Configurar .env</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Faltan variables de entorno necesarias para iniciar la aplicación.
        </p>

        <div className="mt-5 rounded-md bg-muted p-4">
          <p className="text-sm font-medium">Variables faltantes:</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
            {missingVars.map((variable) => (
              <li key={variable}>{variable}</li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Creá un archivo <code className="rounded bg-muted px-1 py-0.5">.env</code> basado en <code className="rounded bg-muted px-1 py-0.5">.env.example</code> y reiniciá el servidor.
        </p>
      </div>
    </main>
  );
};

export default MissingEnvScreen;
