# POC – Mapa Interactivo de Eventos Comunitarios

Prueba de concepto que demuestra la integración de:

| Tecnología | Para qué se usa |
|---|---|
| **Angular 18** | Aplicación web (formulario, lista de eventos y mapa) |
| **Mapbox GL JS** | Mapa interactivo, marcadores y popups |
| **MongoDB Atlas** | Base de datos en la nube donde se guardan los eventos |
| Node.js + Express | API pequeña que conecta Angular con Atlas |

> **¿Por qué hay un servidor en Node?** Angular corre en el navegador y no debe
> conectarse directo a MongoDB, porque la contraseña de la base quedaría expuesta
> a cualquiera. La API en Express guarda la cadena de conexión de forma privada
> y Angular solo le habla por HTTP.

## Arquitectura

```
[ Navegador: Angular + Mapbox ]  --HTTP /api/events-->  [ API Express ]  --driver-->  [ MongoDB Atlas ]
```

## Qué hace

- Muestra un mapa (centrado en Chihuahua) con todos los eventos guardados en Atlas.
- Al hacer **clic en el mapa** se elige la ubicación de un evento nuevo (el pin rojo se puede arrastrar).
- Formulario con título, descripción, categoría y fecha/hora → **se guarda en MongoDB Atlas** y aparece el marcador al instante.
- Cada categoría tiene su color; al hacer clic en un marcador se ve el detalle.
- La lista lateral permite volar al evento en el mapa o eliminarlo.
- Las ubicaciones se guardan como **GeoJSON** con índice `2dsphere`, listas para consultas tipo "eventos cerca de mí".

## Requisitos

- Node.js 18 o superior
- Cuenta gratuita de [MongoDB Atlas](https://www.mongodb.com/atlas)
- Cuenta gratuita de [Mapbox](https://account.mapbox.com/)

## Paso 1 – Configurar MongoDB Atlas

1. Crea un cluster gratuito (**M0**).
2. En **Database Access** crea un usuario con contraseña.
3. En **Network Access** agrega tu IP (o `0.0.0.0/0` solo para la demo).
4. En **Database → Connect → Drivers → Node.js** copia la cadena de conexión.

## Paso 2 – Levantar la API

```bash
cd server
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env y pega tu cadena en MONGODB_URI
npm start
```

Debe decir: `Conectado a MongoDB Atlas` y `API escuchando en http://localhost:3000`.
La base `mapa_eventos` y la colección `eventos` se crean solas.

## Paso 3 – Levantar Angular

1. Copia tu token público de Mapbox (empieza con `pk.`).
2. Pégalo en `client/src/environments/environment.ts` en `mapboxToken`.

```bash
cd client
npm install
npm start
```

Abre **http://localhost:4200**. El `proxy.conf.json` redirige `/api` hacia el puerto 3000.

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/events` | Lista todos los eventos |
| POST | `/api/events` | Crea un evento `{ titulo, descripcion, categoria, fecha, lat, lng }` |
| DELETE | `/api/events/:id` | Elimina un evento |

## Ejemplo de documento en Atlas

```json
{
  "_id": "6740f1...",
  "titulo": "Limpieza del parque",
  "descripcion": "Traer guantes y bolsas",
  "categoria": "Voluntariado",
  "fecha": "2026-11-23T16:00:00.000Z",
  "ubicacion": { "type": "Point", "coordinates": [-106.0889, 28.6353] },
  "creadoEn": "2026-11-19T22:00:00.000Z"
}
```

## Estructura

```
mapa-eventos-poc/
├── server/                 API Express + driver oficial de MongoDB
│   ├── index.js
│   └── .env.example
└── client/                 Angular 18 (componentes standalone)
    ├── proxy.conf.json
    └── src/
        ├── environments/environment.ts   token de Mapbox
        └── app/
            ├── app.component.*           mapa + formulario + lista
            └── evento.service.ts         llamadas HTTP a la API
```

## Conclusión de la POC

Se comprueba que las tres tecnologías se integran sin problema: Angular consume
la API, Mapbox muestra y captura ubicaciones, y MongoDB Atlas guarda los eventos
con datos geoespaciales. Siguientes pasos para la app real: autenticación de
usuarios, filtros por fecha/categoría, búsqueda por cercanía con `$near` y
despliegue (por ejemplo, la API en Render/Railway y Angular en Vercel/Netlify).
