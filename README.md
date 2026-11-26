# Eventos Carnet UACH – Mapa Interactivo

Aplicación web para descubrir y publicar eventos del Carnet Universitario UACH sobre un mapa interactivo.

| Tecnología | Para qué se usa |
|---|---|
| **Angular 18** | Aplicación web (cartelera, buscador, filtros, modal de creación y mapa) |
| **Mapbox GL JS + OpenStreetMap** | Mapa interactivo gratuito (sin token obligatorio), marcadores, hover cards y popups |
| **MongoDB Atlas** | Base de datos en la nube donde se guardan los eventos, flyers y coordenadas |
| **Node.js + Express** | API REST que conecta Angular con MongoDB Atlas de forma segura |

> **¿Por qué hay un servidor en Node?** Angular corre en el navegador y no debe
> conectarse directo a MongoDB, porque la cadena de conexión quedaría expuesta.
> La API en Express guarda `MONGODB_URI` de forma privada y Angular se comunica por HTTP.

## Arquitectura

```
[ Navegador: Angular + OpenStreetMap ]  --HTTP /api/events-->  [ API Express ]  --driver-->  [ MongoDB Atlas ]
```

## Qué hace

- **Mapa interactivo gratuito**: Centrado en Chihuahua (`[-106.0889, 28.6353]`) usando mosaicos de OpenStreetMap (no requiere token de Mapbox; si se agrega uno en `environment.ts`, lo usa automáticamente).
- **Publicación con clic en el mapa**: Haz clic en cualquier punto del mapa o presiona **+ Crear evento** para abrir el modal y fijar la ubicación (el pin rojo se puede arrastrar).
- **Fotos y flyers**: Permite adjuntar hasta 6 imágenes o flyers por evento (se comprimen automáticamente en el navegador antes de guardarse en MongoDB Atlas).
- **Hover card en el mapa**: Al pasar el cursor sobre un pin del mapa aparece un recuadro flotante con las fotos/flyers, el nombre del evento y su fecha. Al hacer clic se abre el detalle completo con descripción.
- **Cartelera con filtros y búsqueda**: Barra superior de búsqueda instantánea, filtros por categoría (`Cultural`, `Deportivo`, `Educativo`, `Voluntariado`, `Otro`), tarjetas con miniatura y opción para volar al evento o eliminarlo.
- **Datos geoespaciales**: Las ubicaciones se almacenan como **GeoJSON** (`Point`) con índice `2dsphere`.

## Requisitos

- Node.js 18 o superior
- Cuenta gratuita de [MongoDB Atlas](https://www.mongodb.com/atlas)

## Paso 1 – Configurar MongoDB Atlas

1. Crea un cluster gratuito (**M0**).
2. En **Database Access** crea un usuario con contraseña.
3. En **Network Access** agrega tu IP (o `0.0.0.0/0` para desarrollo).
4. En **Database → Connect → Drivers → Node.js** copia la cadena de conexión.

## Paso 2 – Levantar la API

```bash
cd server
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env y pega tu cadena en MONGODB_URI
npm start
```

Debe mostrar: `Conectado a MongoDB Atlas (base: mapa_eventos)` y `API escuchando en http://localhost:3000`.

## Paso 3 – Levantar Angular

```bash
cd client
npm install
npm start
```

Abre **http://localhost:4200**. El archivo `proxy.conf.json` redirige `/api` hacia el puerto `3000`.

*(Opcional: si deseas usar estilos de Mapbox en lugar de OpenStreetMap gratuito, pega tu token `pk.` en `client/src/environments/environment.ts` en `mapboxToken`).*

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/events` | Lista todos los eventos ordenados por fecha |
| POST | `/api/events` | Crea un evento `{ titulo, descripcion, categoria, fecha, imagenes, lat, lng }` |
| DELETE | `/api/events/:id` | Elimina un evento por ID |

## Ejemplo de documento en Atlas

```json
{
  "_id": "6740f1...",
  "titulo": "Congreso de Ingeniería",
  "descripcion": "Auditorio principal, entrada con carnet",
  "categoria": "Educativo",
  "fecha": "2026-11-28T16:00:00.000Z",
  "imagenes": ["data:image/jpeg;base64,..."],
  "ubicacion": { "type": "Point", "coordinates": [-106.0889, 28.6353] },
  "creadoEn": "2026-11-26T20:00:00.000Z"
}
```

## Estructura

```
UX/
├── .gitignore                Excluye node_modules, .env, dist y caché
├── server/                   API Express + driver oficial de MongoDB
│   ├── index.js              Endpoints y conexión a MongoDB Atlas (límite JSON 10MB)
│   └── .env.example          Plantilla de variables de entorno
└── client/                   Angular 18 (componentes standalone)
    ├── angular.json          Configuración de estilos y worker de Mapbox GL
    ├── proxy.conf.json       Proxy /api -> http://localhost:3000
    └── src/
        ├── environments/environment.ts   Centro inicial y token opcional
        └── app/
            ├── app.component.*           Cartelera, modal con flyers, mapa y hover cards
            └── evento.service.ts         Llamadas HTTP a la API
```
