import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import mapboxgl from 'mapbox-gl';
import { environment } from '../environments/environment';
import { Evento, EventoService } from './evento.service';

const COLORES: Record<string, string> = {
  Cultural: '#8e44ad',
  Deportivo: '#10b981',
  Educativo: '#3b82f6',
  Voluntariado: '#f59e0b',
  Otro: '#6b7280',
};

const FONDOS_CAT: Record<string, string> = {
  Cultural: 'rgba(142, 68, 173, 0.12)',
  Deportivo: 'rgba(16, 185, 129, 0.12)',
  Educativo: 'rgba(59, 130, 246, 0.12)',
  Voluntariado: 'rgba(245, 158, 11, 0.14)',
  Otro: 'rgba(107, 114, 128, 0.12)',
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, DatePipe, UpperCasePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapa', { static: true }) mapaRef!: ElementRef<HTMLDivElement>;

  private servicio = inject(EventoService);
  private zone = inject(NgZone);

  private mapa?: mapboxgl.Map;
  private marcadores = new Map<string, mapboxgl.Marker>();
  private marcadorTemporal?: mapboxgl.Marker;
  private hoverPopup?: mapboxgl.Popup;

  categorias = Object.keys(COLORES);
  colores = COLORES;
  fondosCat = FONDOS_CAT;
  eventos: Evento[] = [];
  guardando = false;
  procesandoImagenes = false;
  mensaje = '';
  error = '';
  tokenFaltante = false;

  modalAbierto = false;
  seleccionandoMapa = false;
  filtroCategoria = 'Todas';
  busqueda = '';
  eventoSeleccionadoId: string | null = null;

  form = this.formVacio();

  get eventosFiltrados(): Evento[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.eventos.filter((ev) => {
      const coincideCat = this.filtroCategoria === 'Todas' || ev.categoria === this.filtroCategoria;
      const coincideTexto =
        !q ||
        ev.titulo.toLowerCase().includes(q) ||
        ev.descripcion.toLowerCase().includes(q) ||
        ev.categoria.toLowerCase().includes(q);
      return coincideCat && coincideTexto;
    });
  }

  private formVacio() {
    return {
      titulo: '',
      descripcion: '',
      categoria: 'Cultural',
      fecha: '',
      imagenes: [] as string[],
      lat: null as number | null,
      lng: null as number | null,
    };
  }

  ngAfterViewInit(): void {
    (mapboxgl as any).workerUrl = '/mapbox-gl-csp-worker.js';
    const usaMapbox = environment.mapboxToken.startsWith('pk.');
    mapboxgl.accessToken = usaMapbox ? environment.mapboxToken : 'osm-free-mode';

    const estiloMapa: mapboxgl.StyleSpecification | string = usaMapbox
      ? 'mapbox://styles/mapbox/streets-v12'
      : {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap Contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        };

    // El mapa corre fuera de Angular para no disparar detección de cambios en cada frame
    this.zone.runOutsideAngular(() => {
      this.mapa = new mapboxgl.Map({
        container: this.mapaRef.nativeElement,
        style: estiloMapa,
        center: environment.centroInicial,
        zoom: environment.zoomInicial,
      });
      this.mapa.addControl(new mapboxgl.NavigationControl(), 'top-right');
      this.mapa.addControl(
        new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
        'top-right'
      );

      // Clic en el mapa = elegir ubicación del nuevo evento
      this.mapa.on('click', (e) => {
        this.zone.run(() => {
          this.elegirUbicacion(e.lngLat.lat, e.lngLat.lng);
          if (this.seleccionandoMapa || !this.modalAbierto) {
            this.seleccionandoMapa = false;
            this.modalAbierto = true;
          }
        });
      });

      this.mapa.on('load', () => this.zone.run(() => this.cargarEventos()));
    });
  }

  ngOnDestroy(): void {
    this.hoverPopup?.remove();
    this.mapa?.remove();
  }

  abrirModal(): void {
    this.error = '';
    this.mensaje = '';
    this.seleccionandoMapa = false;
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.seleccionandoMapa = false;
  }

  activarModoMapa(): void {
    this.modalAbierto = false;
    this.seleccionandoMapa = true;
  }

  async onImagenesSeleccionadas(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    this.procesandoImagenes = true;
    const disponibles = Math.max(0, 6 - this.form.imagenes.length);
    const aProcesar = files.slice(0, disponibles);

    for (const file of aProcesar) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await this.comprimirImagen(file, 900, 0.78);
        this.form.imagenes = [...this.form.imagenes, dataUrl];
      } catch {
        // Ignorar archivos que no se puedan leer como imagen
      }
    }

    input.value = '';
    this.procesandoImagenes = false;
  }

  quitarImagen(indice: number): void {
    this.form.imagenes = this.form.imagenes.filter((_, i) => i !== indice);
  }

  private comprimirImagen(file: File, maxAncho: number, calidad: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject();
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject();
        img.onload = () => {
          const escala = Math.min(1, maxAncho / img.width);
          const ancho = Math.round(img.width * escala);
          const alto = Math.round(img.height * escala);
          const canvas = document.createElement('canvas');
          canvas.width = ancho;
          canvas.height = alto;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject();
          ctx.drawImage(img, 0, 0, ancho, alto);
          resolve(canvas.toDataURL('image/jpeg', calidad));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  cargarEventos(): void {
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.eventos = lista;
        lista.forEach((ev) => this.agregarMarcador(ev));
      },
      error: () => (this.error = 'No se pudo conectar con la API. ¿Está corriendo el servidor?'),
    });
  }

  elegirUbicacion(lat: number, lng: number): void {
    this.form.lat = +lat.toFixed(6);
    this.form.lng = +lng.toFixed(6);
    if (!this.mapa) return;
    if (!this.marcadorTemporal) {
      this.marcadorTemporal = new mapboxgl.Marker({ color: '#e74c3c', draggable: true })
        .setLngLat([lng, lat])
        .addTo(this.mapa);
      this.marcadorTemporal.on('dragend', () => {
        const p = this.marcadorTemporal!.getLngLat();
        this.zone.run(() => {
          this.form.lat = +p.lat.toFixed(6);
          this.form.lng = +p.lng.toFixed(6);
        });
      });
    } else {
      this.marcadorTemporal.setLngLat([lng, lat]);
    }
  }

  guardar(f: NgForm): void {
    this.mensaje = '';
    this.error = '';
    if (f.invalid || this.form.lat === null || this.form.lng === null) {
      this.error = 'Llena el título, la fecha y elige una ubicación en el mapa.';
      return;
    }
    this.guardando = true;
    this.servicio
      .crear({
        titulo: this.form.titulo,
        descripcion: this.form.descripcion,
        categoria: this.form.categoria,
        fecha: new Date(this.form.fecha).toISOString(),
        imagenes: this.form.imagenes,
        lat: this.form.lat,
        lng: this.form.lng,
      })
      .subscribe({
        next: (ev) => {
          this.eventos = [...this.eventos, ev].sort((a, b) => a.fecha.localeCompare(b.fecha));
          this.agregarMarcador(ev);
          this.marcadorTemporal?.remove();
          this.marcadorTemporal = undefined;
          this.form = this.formVacio();
          f.resetForm(this.form);
          this.guardando = false;
          this.modalAbierto = false;
          this.eventoSeleccionadoId = ev.id;
          this.irAEvento(ev);
        },
        error: (e) => {
          this.error = e?.error?.error ?? 'No se pudo guardar el evento.';
          this.guardando = false;
        },
      });
  }

  irAEvento(ev: Evento): void {
    this.eventoSeleccionadoId = ev.id;
    this.hoverPopup?.remove();
    this.mapa?.flyTo({ center: [ev.lng, ev.lat], zoom: 15, essential: true });
    this.marcadores.get(ev.id)?.togglePopup();
  }

  eliminar(ev: Evento, clic: MouseEvent): void {
    clic.stopPropagation();
    if (!confirm(`¿Eliminar "${ev.titulo}"?`)) return;
    this.servicio.eliminar(ev.id).subscribe({
      next: () => {
        this.eventos = this.eventos.filter((x) => x.id !== ev.id);
        this.marcadores.get(ev.id)?.remove();
        this.marcadores.delete(ev.id);
        this.hoverPopup?.remove();
        if (this.eventoSeleccionadoId === ev.id) {
          this.eventoSeleccionadoId = null;
        }
      },
      error: () => (this.error = 'No se pudo eliminar el evento.'),
    });
  }

  private crearGaleriaDom(imagenes: string[] | undefined): HTMLElement | null {
    if (!imagenes?.length) return null;
    const galeria = document.createElement('div');
    if (imagenes.length === 1) {
      galeria.style.cssText = 'margin-bottom:8px;border-radius:8px;overflow:hidden;';
      const img = document.createElement('img');
      img.src = imagenes[0];
      img.alt = 'Flyer del evento';
      img.style.cssText = 'display:block;width:100%;max-height:130px;object-fit:cover;';
      galeria.append(img);
    } else {
      galeria.style.cssText =
        'display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-bottom:8px;border-radius:8px;overflow:hidden;';
      imagenes.slice(0, 4).forEach((src) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Foto del evento';
        img.style.cssText = 'display:block;width:100%;height:74px;object-fit:cover;';
        galeria.append(img);
      });
    }
    return galeria;
  }

  private crearContenidoHover(ev: Evento): HTMLElement {
    const cont = document.createElement('div');
    const galeria = this.crearGaleriaDom(ev.imagenes);
    if (galeria) cont.append(galeria);

    const titulo = document.createElement('div');
    titulo.style.cssText = 'font-size:14px;font-weight:700;color:#131517;line-height:1.25;margin-bottom:3px';
    titulo.textContent = ev.titulo;

    const fecha = document.createElement('div');
    fecha.style.cssText = 'font-size:12px;font-weight:500;color:#686d73';
    fecha.textContent = new Date(ev.fecha).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    cont.append(titulo, fecha);
    return cont;
  }

  private agregarMarcador(ev: Evento): void {
    if (!this.mapa) return;

    const cont = document.createElement('div');
    const galeria = this.crearGaleriaDom(ev.imagenes);
    if (galeria) cont.append(galeria);

    const badge = document.createElement('span');
    badge.textContent = ev.categoria;
    badge.style.cssText = `display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;margin-bottom:6px;color:${COLORES[ev.categoria] ?? COLORES['Otro']};background:${FONDOS_CAT[ev.categoria] ?? FONDOS_CAT['Otro']}`;

    const h = document.createElement('div');
    h.style.cssText = 'font-size:15px;font-weight:700;color:#131517;margin-bottom:2px';
    h.textContent = ev.titulo;

    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:12px;color:#686d73;margin-bottom:6px';
    meta.textContent = new Date(ev.fecha).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    cont.append(badge, h, meta);

    if (ev.descripcion) {
      const p = document.createElement('p');
      p.style.cssText = 'margin:0;font-size:13px;color:#3b3f45;line-height:1.4';
      p.textContent = ev.descripcion;
      cont.append(p);
    }

    const marcador = new mapboxgl.Marker({ color: COLORES[ev.categoria] ?? COLORES['Otro'] })
      .setLngLat([ev.lng, ev.lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(cont))
      .addTo(this.mapa);

    const el = marcador.getElement();
    el.style.cursor = 'pointer';

    el.addEventListener('mouseenter', () => {
      if (!this.mapa || marcador.getPopup()?.isOpen()) return;
      this.hoverPopup?.remove();
      this.hoverPopup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
        className: 'hover-popup',
      })
        .setLngLat([ev.lng, ev.lat])
        .setDOMContent(this.crearContenidoHover(ev))
        .addTo(this.mapa);
    });

    el.addEventListener('mouseleave', () => {
      this.hoverPopup?.remove();
      this.hoverPopup = undefined;
    });

    this.marcadores.set(ev.id, marcador);
  }
}
