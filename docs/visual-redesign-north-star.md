# North Star visual — Stock Sur

## Dirección

Stock Sur debe sentirse como una **mesa de operaciones digital moderna**: precisa, enérgica, tecnológica, expresiva y operativa. El dato sigue siendo protagonista, pero la composición, el color dirigido y los detalles gráficos construyen una identidad reconocible sin volver fatigosa una jornada de trabajo.

La experiencia no busca una sobriedad apagada ni el aspecto intercambiable de un SaaS genérico. La personalidad aparece en puntos de alta señal; la lectura cotidiana conserva calma, densidad y previsibilidad.

## Paleta de producto

### Núcleo de identidad

- Ink `#111A2E`: estructura, navegación y contraste profundo.
- Canvas `#F4F6FC`: fondo de temperatura fría y luminosa.
- Cobalt `#3157D5`: foco, acción primaria y vínculo global.
- Indigo `#5A45D9`: identidad y firma comercial.
- Cyan `#08AFC2`: contrapunto tecnológico y visualización.

### Colores funcionales

- Success `#19864F`: resultado confirmado o favorable.
- Warning `#90600A`: atención y estados pendientes.
- Danger `#B4233D`: error, rechazo, anulación o acción destructiva.
- Info `#206BC2`: información y procesos en curso.

Los tonos funcionales de texto deben alcanzar contraste WCAG AA sobre fondos claros. Cada estado conserva texto, icono o forma; el color nunca es su única señal.

### Acentos por dominio

- Inventario: teal técnico.
- Comercial y documentos: indigo/violet.
- Caja: emerald moderno.
- Compras y proveedores: orange/coral.
- Servicios: azure/electric blue.
- Rendiciones: violet/magenta controlado.
- Administración: slate con contrapunto cyan.

El acento de dominio puede aparecer en icon tiles, indicador de navegación, eyebrow, encabezado contextual, selección, foco local y gráficos. Nunca tiñe una pantalla completa ni reemplaza los colores funcionales.

## Tres capas de color

1. **Identidad y dominio:** ubica a la persona dentro del producto.
2. **Estado semántico:** comunica éxito, advertencia, peligro o información.
3. **Jerarquía de acción:** distingue acción primaria, secundaria y destructiva.

Estas capas no se intercambian. Una venta no es verde por pertenecer a Caja; solo usa success cuando su estado o resultado es favorable. Un gasto no es danger por ser un egreso. Editar usa el acento del dominio; anular usa danger.

## Superficies y profundidad

- El canvas tiene una temperatura cromática suave y estable.
- Los encabezados de contexto admiten una tinta de dominio de baja intensidad y una composición asimétrica.
- Las métricas prioritarias pueden tener más contraste, escala y un gradiente de identidad.
- Cards, tablas y formularios base son opacos, con bordes tonales y sin elevación decorativa.
- Hover y selección cambian borde, fondo o indicador; no desplazan físicamente el componente.
- Las sombras se reservan para menús, dialogs y popovers.
- Los radios compartidos son 8 px para controles, 10 px para componentes y 12 px para contenedores.

La profundidad se consigue con contraste tonal, composición, espacio y tipografía. Transparencia, blur y sombras no son la estructura visual del producto.

## Gradientes permitidos

Se permiten como máximo tres familias:

1. **Core:** cobalt → indigo, para identidad global y KPI principal.
2. **Tech:** indigo → cyan, para detalles tecnológicos y visualización.
3. **Domain wash:** acento de dominio → card, de intensidad muy baja, para encabezados y selección especial.

No se aplican a todos los botones, cards o páginas. Una vista debe conservar una superficie dominante calma y usar como máximo uno o dos momentos de gradiente.

## Datos, tablas y gráficos

- Importes a la derecha, números tabulares, formato local y sin truncado.
- Filas de 40–48 px en escritorio y objetivos táctiles de al menos 40 px.
- Tablas neutrales: el color se reserva para dominio seleccionado, estado real y acción explícita.
- Los gráficos usan la paleta de identidad y funcional con patrones, contornos o trazos redundantes.
- Valores exactos permanecen disponibles mediante tooltip y capa accesible de teclado.
- Comparaciones no dependen de distinguir rojo/verde.

### Lenguaje visual aprobado para analítica

- El dashboard puede alternar vistas de Stock, Ventas, Rentabilidad y Cuentas corrientes en un carrusel controlado por la persona usuaria.
- Las visualizaciones principales usan superficies orgánicas, curvas topográficas o flujos tipo Sankey con profundidad 2.5D sutil; el relieve refuerza jerarquía y foco, pero nunca sustituye una escala, proporción o relación de datos.
- Un flujo Sankey sólo se usa cuando el ancho de cada banda representa una magnitud y sus bifurcaciones conservan el total. Una superficie topográfica sólo se usa cuando contornos, zonas y marcadores tienen una leyenda y una métrica comprensible.
- Cada vista incluye título, período, valor principal, comparación, leyenda y acceso al análisis detallado. El movimiento al alternar vistas dura como máximo 220 ms y respeta `prefers-reduced-motion`.
- Se evita el 3D intenso, la perspectiva decorativa y cualquier forma que parezca un gráfico sin codificar datos verificables.

## Interacción y responsive

- Una acción primaria visible por fila; acciones secundarias agrupadas y nombradas de forma accesible.
- Formularios con etiquetas persistentes, errores específicos y acciones previsibles.
- Movimiento funcional: 150 ms para feedback, 180 ms para transiciones y 220 ms para overlays; respetar `prefers-reduced-motion`.
- Responsive por prioridad: una tabla puede convertirse en lista operativa, pero no esconder importes, estados ni la acción principal.
- El foco siempre es visible y usa el color global o el acento local sin perder contraste.

## Permitido

- Un encabezado de Documentos teñido en violet con icon tile y eyebrow contextual.
- Un KPI principal cobalt/indigo rodeado de métricas secundarias más calmas.
- Caja con acento emerald en navegación y contexto, pero warning/danger para estados reales.
- Barras comparables diferenciadas por color, patrón y contorno.
- Un selected state con franja cromática, fondo sutil y texto explícito.

## Anti-patterns

- Blanco, gris y un único azul como sistema completo.
- Color aleatorio por card o componente.
- Pintar toda una pantalla con su color de dominio.
- Verde para cualquier ingreso o rojo para cualquier egreso.
- Gradientes en todos los botones o tarjetas.
- Neon, estética gamer/crypto, glassmorphism dominante o blur ornamental.
- Sombras y animaciones de elevación en toda superficie.
- Píldoras para cualquier control, estado o pestaña.
- Comunicar estado o serie de datos únicamente mediante color.

## Piloto

Esta rama valida la dirección en tres superficies:

1. **Dashboard:** KPI principal con tratamiento core, métricas secundarias semánticas, pendientes antes de analítica y gráficos con codificación redundante.
2. **Documentos:** firma commercial violet en navegación, encabezado y selección; estados y acciones conservan semántica independiente.
3. **Caja:** firma emerald en contexto y resumen; importes, cierres, advertencias y acciones no heredan el color del dominio.

No cambia reglas de negocio, permisos, queries, RLS ni persistencia.

## Secuencia posterior

Cada bloque se entrega en un PR independiente hacia `staging`: navegación global; migración compatible a tema claro/oscuro; inventario; comercial; compras; servicios; administración. Antes de promover cada bloque se revisan 1920 px, 1366 px, móvil y zoom 125 %, incluyendo teclado, foco, overflow, contraste e importes largos.

La reducción de temas mantiene compatibilidad de lectura para empresas con presets históricos antes de retirar sus opciones de edición. La limpieza de componentes, helpers y código muerto se realiza por módulo, con evidencia de referencias y tests de regresión; no se automatiza el borrado a partir de Knip o depcheck sin revisar falsos positivos de rutas, funciones server y código generado.
