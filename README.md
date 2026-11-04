# Hogar 🏠

Una web app para llevar el registro de las necesidades de la casa: **lista de la compra y despensa**, **tareas del hogar** con responsables y **presupuesto/gastos**. Se instala en el iPhone como una app más, funciona sin conexión y **se sincroniza entre los dispositivos de la casa** a través de un repositorio privado de GitHub.

El diseño sigue las Human Interface Guidelines de Apple: títulos grandes, listas agrupadas, hojas modales, barra de pestañas flotante, colores del sistema y modo oscuro automático.

## Qué incluye

| Pestaña | Para qué sirve |
| --- | --- |
| **Inicio** | Resumen: lo que falta por comprar, tareas de hoy, lo que queda del presupuesto del mes y la actividad reciente de la casa. |
| **Compras** | *Lista*: añade cosas escribiendo y márcalas al comprarlas (se suman a la despensa). *Despensa*: cuántas quedan de cada cosa, con − / + y aviso de mínimo (se añade solo a la lista). *Historial*: qué se compró, cuándo y quién. Tras comprar, la app te pregunta cuánto costó para anotarlo como gasto. |
| **Tareas** | Tareas con responsable, fecha y repetición (diaria, semanal, quincenal, mensual). Las que se repiten se reprograman solas y pueden **turnarse** entre los miembros. Filtro por persona. |
| **Finanzas** | Presupuesto mensual por categorías (Supermercado, Facturas…), gastos con quién pagó, cuánto queda en total y por categoría, y navegación por meses. |
| **Ajustes** | Nombre de la casa y moneda, miembros, sincronización, invitar a otros dispositivos, copia de seguridad (exportar/importar). |

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
js/domain.js                              Lógica de compras, tareas y finanzas
js/app.js, js/ui.js, js/overlays.js       Navegación, componentes, hojas y alertas
js/views/*.js                             Pantallas
```

El service worker usa una versión distinta en cada despliegue (`__BUILD__` se sustituye en el workflow), así el iPhone descarga la versión nueva automáticamente.
