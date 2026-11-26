// API REST mínima para la POC: guarda y lee eventos en MongoDB Atlas.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';

const { MONGODB_URI, DB_NAME = 'mapa_eventos', PORT = 3000 } = process.env;

if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI en el archivo .env');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
let eventos; // colección

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Convierte el documento de Mongo al formato que usa el frontend
function aDto(doc) {
  return {
    id: doc._id.toString(),
    titulo: doc.titulo,
    descripcion: doc.descripcion,
    categoria: doc.categoria,
    fecha: doc.fecha,
    imagenes: Array.isArray(doc.imagenes) ? doc.imagenes : [],
    lng: doc.ubicacion.coordinates[0],
    lat: doc.ubicacion.coordinates[1],
    creadoEn: doc.creadoEn,
  };
}

// GET /api/events -> todos los eventos
app.get('/api/events', async (_req, res) => {
  try {
    const docs = await eventos.find().sort({ fecha: 1 }).toArray();
    res.json(docs.map(aDto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron leer los eventos' });
  }
});

// POST /api/events -> crea un evento
app.post('/api/events', async (req, res) => {
  const { titulo, descripcion = '', categoria = 'Otro', fecha, lat, lng, imagenes = [] } = req.body ?? {};

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const errores = [];
  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) errores.push('El título es obligatorio');
  if (!fecha || isNaN(Date.parse(fecha))) errores.push('La fecha no es válida');
  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) errores.push('Latitud inválida');
  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) errores.push('Longitud inválida');
  if (errores.length) return res.status(400).json({ error: errores.join('. ') });

  const imagenesLimpias = Array.isArray(imagenes)
    ? imagenes
        .filter((img) => typeof img === 'string' && (img.startsWith('data:image/') || img.startsWith('http')))
        .slice(0, 6)
    : [];

  const doc = {
    titulo: titulo.trim().slice(0, 120),
    descripcion: String(descripcion).trim().slice(0, 1000),
    categoria: String(categoria).slice(0, 40),
    fecha: new Date(fecha).toISOString(),
    imagenes: imagenesLimpias,
    // GeoJSON: el orden es [longitud, latitud]
    ubicacion: { type: 'Point', coordinates: [lngNum, latNum] },
    creadoEn: new Date().toISOString(),
  };

  try {
    const { insertedId } = await eventos.insertOne(doc);
    res.status(201).json(aDto({ ...doc, _id: insertedId }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar el evento' });
  }
});

// DELETE /api/events/:id -> borra un evento (útil para la demo)
app.delete('/api/events/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
  const r = await eventos.deleteOne({ _id: new ObjectId(req.params.id) });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });
  res.status(204).end();
});

async function iniciar() {
  await client.connect();
  const db = client.db(DB_NAME);
  eventos = db.collection('eventos');
  // Índice geoespacial: permite consultas tipo "eventos cerca de mí" más adelante
  await eventos.createIndex({ ubicacion: '2dsphere' });
  console.log(`Conectado a MongoDB Atlas (base: ${DB_NAME})`);

  app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
}

iniciar().catch((err) => {
  console.error('Error al conectar con MongoDB Atlas:', err.message);
  process.exit(1);
});
