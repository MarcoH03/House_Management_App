# Hogar 🏠

Una web app para llevar el registro de las necesidades de la casa: **lista de la compra y despensa**, **tareas del hogar** con responsables y **presupuesto/gastos**. Se instala en el iPhone como una app más, funciona sin conexión y **se sincroniza entre los dispositivos de la casa** a través de un repositorio privado de GitHub.

El diseño sigue las Human Interface Guidelines de Apple: títulos grandes, listas agrupadas, hojas modales, barra de pestañas flotante, colores del sistema y modo oscuro automático.

## Qué incluye

| Pestaña | Para qué sirve |
| --- | --- |
| **Inicio** | Resumen: lo que falta por comprar, tareas de hoy, lo que queda del presupuesto del mes y la actividad reciente de la casa. |
| **Compras** | *Lista*: añade cosas escribiendo y márcalas al comprarlas (se suman a la despensa). *Despensa*: cuántas quedan de cada cosa, con − / + y aviso de mínimo (se añade solo a la lista). *Historial*: qué se compró, cuándo y quién. Tras comprar, la app te pregunta cuánto costó para anotarlo como gasto. |
| **Tareas** | Tareas con responsable, fecha y repetición (diaria, semanal, quincenal, mensual). Las que se repiten se reprograman solas y pueden **turnarse** entre los miembros. Filtro por persona. |
| **Finanzas** | **Cuentas** (Casa, Ahorros…) con saldo en varias monedas a la vez (p. ej. 250 CUP y 50 USD). Entradas de dinero, gastos (eligiendo de qué cuenta y en qué moneda se paga), transferencias entre cuentas y cambios de moneda. Todo se resume en **CUP** y, más pequeño, en USD, con las tasas del mercado informal de **elTOque**. Desglose del gasto por **categoría** y, dentro de cada una, por **etiquetas** (porcentaje de cada etiqueta), evolución de los últimos 6 meses, media diaria, previsión del mes y mayor gasto. |
| **Ajustes** | Nombre de la casa, miembros, tasas de cambio, categorías de gasto, etiquetas, sincronización, invitar a otros dispositivos, copia de seguridad (exportar/importar). |

## 1. Publicar la app en GitHub Pages

1. Fusiona esta rama en `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. El workflow `.github/workflows/pages.yml` publica la app en cada push a `main`. La dirección será algo como `https://<tu-usuario>.github.io/House_Management_App/`.

> GitHub Pages en cuentas gratuitas exige que el repositorio de la app sea público. No pasa nada: **el código es público pero los datos de tu casa no están aquí**, sino en otro repositorio privado (paso 3).

## 2. Instalar en el iPhone

1. Abre la dirección de la app en **Safari**.
2. Pulsa **Compartir** → **Añadir a pantalla de inicio** → activa **Abrir como app web** → **Añadir**.
3. Ábrela desde el icono y crea tu casa (nombre, tu nombre y quién vive contigo).

## 3. Sincronizar entre los dispositivos de la casa

Los *GitHub Secrets* solo existen dentro de GitHub Actions y una página web no puede leerlos, así que la sincronización funciona así: los datos se guardan en un archivo `hogar.json` dentro de **un repositorio privado** y cada dispositivo lo lee y escribe con la API de GitHub usando un token limitado a ese repositorio. No hace falta ningún servidor.

1. Crea un repositorio **privado** vacío, por ejemplo `hogar-datos` ([crear](https://github.com/new?name=hogar-datos&visibility=private)). Marca «Add a README» o déjalo vacío, da igual.
2. Crea un token *fine-grained* ([crear](https://github.com/settings/personal-access-tokens/new)):
   - **Repository access** → *Only select repositories* → `hogar-datos`.
   - **Permissions → Repository permissions → Contents** → *Read and write*.
   - Elige la caducidad que prefieras (cuando caduque, crea otro y vuelve a conectar).
3. En la app: **Ajustes → Configurar con GitHub**, escribe tu usuario, el repositorio y el token.
4. **Ajustes → Invitar a la casa** → *Compartir…* y envía el código a las demás personas (por un canal privado: incluye el token).
5. En sus iPhone: instalan la app, eligen **Unirme a una casa existente**, pegan el código y eligen su nombre.

Cómo funciona por dentro:

- Cada cambio se guarda al instante en el dispositivo (la app funciona sin conexión) y se sube a GitHub en un par de segundos. Mientras la app está abierta comprueba cambios de los demás cada 20 s y al volver a ella.
- Si dos personas cambian cosas a la vez, se fusionan registro a registro (gana el cambio más reciente de cada artículo, tarea o gasto). Cada guardado es un commit, así que tienes historial completo en el repositorio privado.
- La app se niega a usar un repositorio público para no exponer tus datos.

## 4. Finanzas y tasas de cambio (elTOque)

- La moneda principal es el **CUP**. Cada cuenta puede tener saldo en las monedas que quieras (CUP, USD, EUR, MLC, USDT…); se añaden desde la propia cuenta.
- **Cambiar moneda**: indicas cuántos USD (u otra moneda) cambias y la app propone los CUP que recibes según la tasa actual. Si te dieron otra cantidad, la corriges y se guarda la tasa real del cambio.
- **Las tasas se congelan en cada movimiento.** Un gasto o una entrada en divisas guarda la tasa de ese momento, así que lo gastado refleja el dinero real empleado y un cambio posterior de la tasa no altera el pasado. Solo el *disponible* en divisas se valora al cambio del día (se indica con «≈»).
- La tasa del dólar aparece arriba en Finanzas (p. ej. **USD 667 CUP**). Tócala para ver o editar las tasas a mano.

### Cómo llegan las tasas automáticamente

El workflow de Pages se ejecuta cada 4 horas, descarga la tasa representativa de elTOque y la publica como `rates.json` junto a la app. Cada dispositivo la lee al abrirse y la aplica si es más reciente que la que tiene.

1. **Recomendado: API oficial de elTOque.** Pide un token gratuito en [tasas.eltoque.com](https://tasas.eltoque.com) y guárdalo en el repositorio de la app como secreto: **Settings → Secrets and variables → Actions → New repository secret**, nombre `ELTOQUE_API_TOKEN`. (Este es el uso correcto de los GitHub Secrets: los lee el Action, nunca la app.)
2. **Sin token**, el Action lee el canal público de Telegram de elTOque (`t.me/s/eltoquecom`) y extrae la «Tasa representativa del mercado informal». Depende de que el canal siga publicándolas; la app muestra siempre la fecha y la fuente de la tasa para que sepas si está desfasada.
3. Si no hay ninguna fuente disponible, sigue funcionando con la última tasa guardada o la que pongas a mano. Con «Actualizar desde elTOque» desactivado, tus tasas manuales nunca se sobrescriben.

> GitHub pausa los workflows programados de repositorios sin actividad durante 60 días. Si las tasas dejan de actualizarse, entra en **Actions** y vuelve a activarlo.

## Desarrollo

Es HTML, CSS y JavaScript sin dependencias ni compilación. Para probarla en local:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

Estructura:

```
index.html, manifest.webmanifest, sw.js   Shell, PWA y caché sin conexión
css/app.css                               Estilos (claro/oscuro)
js/store.js                               Datos locales + fusión por registro
js/sync.js                                Sincronización con GitHub
js/rates.js                               Lectura de las tasas publicadas (rates.json)
.github/scripts/fetch-rates.mjs           Descarga de tasas de elTOque (API o Telegram)
js/domain.js                              Lógica de compras, tareas, cuentas y movimientos
js/app.js, js/ui.js, js/overlays.js       Navegación, componentes, hojas y alertas
js/views/*.js                             Pantallas
```

El service worker usa una versión distinta en cada despliegue (`__BUILD__` se sustituye en el workflow), así el iPhone descarga la versión nueva automáticamente.
