# North Star visual — Stock Sur

## Direccion

Stock Sur debe sentirse como una **mesa de operaciones de precision**: sobria, rapida y confiable. La interfaz prioriza lectura, decision y ejecucion; la decoracion nunca compite con los datos.

## Principios

- Jerarquia por posicion, escala y espacio; no por una acumulacion de tarjetas o colores.
- Densidad controlada: filas de 40–48 px en escritorio y objetivos tactiles de al menos 40 px.
- Superficies planas, bordes discretos y elevacion reservada a overlays.
- Cobalto para foco, seleccion y accion primaria. Verde, ambar y rojo solo comunican estados reales.
- Importes alineados a la derecha, con numeros tabulares, formato local y sin truncar ni cortar linea.
- Una accion primaria visible por fila; acciones secundarias agrupadas y siempre nombradas de forma accesible.
- Formularios con etiquetas persistentes, errores especificos y acciones previsibles.
- Movimiento funcional: 120 ms para feedback, 180 ms para transiciones y 240 ms para overlays; respetar `prefers-reduced-motion`.
- Responsive por prioridad: una tabla puede convertirse en lista operativa, pero no esconder importes, estados ni la accion principal.

## Escalas compartidas

- Espaciado: 4, 8, 12, 16, 24, 32 y 48 px.
- Radios: 6 px para controles, 8 px para componentes y 12 px para contenedores principales.
- Tipografia: pagina 28/34, seccion 18/24 y cuerpo 14/20.
- Iconos Lucide: 16 px en filas y 18 px en controles; sin iconos decorativos redundantes.
- Sombras: ninguna en superficies base; sombra suave solo en menus, dialogs y popovers.

## Piloto

Esta rama valida los fundamentos en tres superficies:

1. Dashboard: tres indicadores decisivos, pendientes antes de analitica y graficos secundarios.
2. Documentos: filtros legibles, importes estables y jerarquia de acciones compacta.
3. Caja: resumen financiero de lectura rapida, navegacion unica y composicion operativa clara.

No cambia reglas de negocio, permisos, queries, RLS ni persistencia.

## Secuencia posterior

Cada bloque se entrega en un PR independiente hacia `staging`:

1. Navegacion global y responsive.
2. Inventario: items, combos, stock y listas de precios.
3. Comercial: clientes, cuenta corriente, presupuestos y facturacion.
4. Compras: proveedores, importaciones y ordenes de compra.
5. Servicios: documentos, trabajos y tecnicos.
6. Administracion: usuarios, configuracion, liquidaciones y totales de caja.

Antes de promover cada bloque se revisan 1920 px, 1366 px, movil y zoom 125 %, incluyendo teclado, foco, overflow e importes largos.
