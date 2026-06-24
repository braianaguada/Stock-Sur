import { useState } from "react";
import { ArrowRight, Boxes, ChartNoAxesCombined, FileCheck2, ShieldCheck } from "lucide-react";
import { StockSurMark } from "@/components/StockSurMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const benefits = [
  {
    icon: Boxes,
    title: "Stock bajo control",
    description: "Catálogo, movimientos y alertas en un solo lugar.",
  },
  {
    icon: FileCheck2,
    title: "Operación conectada",
    description: "Documentos, servicios, precios y caja trabajando juntos.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Decisiones claras",
    description: "Información comercial lista para actuar.",
  },
];

export default function AuthPage() {
  const { settings } = useCompanyBrand();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    setPassword("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast({ title: "Cuenta creada", description: "Ya podés iniciar sesión." });
        switchMode(true);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute -left-32 top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -bottom-56 right-[-8rem] h-[36rem] w-[36rem] rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1480px] lg:grid-cols-[1.08fr_.92fr]">
        <section className="hidden min-h-screen flex-col justify-between px-12 py-11 text-white lg:flex xl:px-20 xl:py-16">
          <div className="flex items-center gap-3">
            <StockSurMark className="h-11 w-11" />
            <div>
              <p className="font-heading text-lg font-extrabold tracking-tight">Stock Sur</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-200/70">Gestión comercial</p>
            </div>
          </div>

          <div className="max-w-2xl space-y-9">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
                Tu operación, ordenada y disponible
              </div>
              <h1 className="max-w-xl text-5xl font-extrabold leading-[1.05] tracking-[-0.055em] xl:text-6xl">
                El control diario de tu negocio, sin perder tiempo.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-300">
                Stock Sur conecta inventario, ventas, documentos y servicios para que cada movimiento tenga contexto.
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article key={benefit.title} className="rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur-sm">
                    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-blue-200 ring-1 ring-blue-300/15">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold">{benefit.title}</h2>
                    <p className="mt-1.5 text-xs leading-5 text-slate-400">{benefit.description}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500">Stock Sur · Plataforma de gestión comercial y operativa</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:bg-slate-50/[.97] lg:px-12">
          <div className="w-full max-w-[460px] animate-fade-in rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,.28)] sm:p-9 lg:border-slate-200/80 lg:shadow-[0_24px_70px_rgba(15,23,42,.12)]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <StockSurMark className="h-11 w-11" />
              <div>
                <p className="text-base font-extrabold tracking-tight text-slate-950">Stock Sur</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Gestión comercial</p>
              </div>
            </div>

            <div className="mb-7">
              {settings.logo_url ? (
                <div className="mb-6 flex h-12 max-w-[180px] items-center">
                  <img src={settings.logo_url} alt={settings.app_name} className="max-h-full max-w-full object-contain" />
                </div>
              ) : null}
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                {isLogin ? "Bienvenido de nuevo" : "Empezá con Stock Sur"}
              </p>
              <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-slate-950">
                {isLogin ? "Ingresá a tu cuenta" : "Creá tu cuenta"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {isLogin
                  ? "Accedé a la operación de tu empresa."
                  : "Completá tus datos para comenzar a organizar tu gestión."}
              </p>
            </div>

            <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode(true)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${isLogin ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => switchMode(false)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${!isLogin ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Registrarme
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin ? (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <Input
                    id="fullName"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Juan Pérez"
                    required
                    className="h-11 bg-slate-50/70"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="h-11 bg-slate-50/70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="h-11 bg-slate-50/70"
                />
              </div>

              <Button type="submit" className="h-11 w-full gap-2 rounded-xl text-sm font-bold" disabled={loading}>
                {loading ? "Procesando..." : isLogin ? "Ingresar a Stock Sur" : "Crear mi cuenta"}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              Al continuar accedés a un entorno protegido para la gestión de tu empresa.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
