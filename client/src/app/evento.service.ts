import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  fecha: string; // ISO
  imagenes?: string[];
  lat: number;
  lng: number;
  creadoEn?: string;
}

export type NuevoEvento = Omit<Evento, 'id' | 'creadoEn'>;

@Injectable({ providedIn: 'root' })
export class EventoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/events`;

  listar(): Observable<Evento[]> {
    return this.http.get<Evento[]>(this.url);
  }

  crear(evento: NuevoEvento): Observable<Evento> {
    return this.http.post<Evento>(this.url, evento);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
