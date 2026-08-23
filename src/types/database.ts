export interface Ruta {
  id: string;
  origen: string;
  destino: string;
  duracion_estimada: string | null;
  activa: boolean;
  created_at: string;
}

export interface VehiculoLayoutAsiento {
  n: number;
  pos: string; // 'izq' | 'der' | 'cen'
}

export interface VehiculoLayoutFila {
  fila: number;
  asientos: VehiculoLayoutAsiento[];
  nota?: string;
}

export interface VehiculoLayout {
  filas: VehiculoLayoutFila[];
}

export interface Vehiculo {
  id: string;
  tipo: string; // 'CAMIONETA_4' | 'CAMIONETA_6'
  nombre_display: string;
  total_asientos_pasajero: number;
  layout_json: VehiculoLayout;
  activo: boolean;
}

export type EstadoViaje = 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';

export interface Viaje {
  id: string;
  ruta_id: string;
  vehiculo_id: string;
  fecha_viaje: string;
  hora_viaje: string;
  precio_base: number;
  estado: EstadoViaje;
  created_at: string;
  rutas?: {
    origen: string;
    destino: string;
  };
  vehiculos?: {
    nombre_display: string;
    total_asientos_pasajero: number;
    layout_json?: VehiculoLayout;
  };
}

export type EstadoAsiento = 'BLOQUEADO' | 'PAGADO';

export interface AsientoBloqueo {
  id: string;
  viaje_id: string;
  numero_asiento: number;
  estado: EstadoAsiento;
  expira_at: string;
  sesion_token: string;
  created_at: string;
}

export type TipoDocumento = 'DNI' | 'RUC' | 'CE' | 'PASAPORTE';

export interface Venta {
  id: string;
  viaje_id: string;
  numero_asiento: number;
  tipo_documento: TipoDocumento;
  nro_documento: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  monto_pagado: number;
  culqi_charge_id: string;
  metodo_pago?: string;
  nro_operacion?: string;
  razon_social?: string;
  direccion_fiscal?: string;
  descripcion_opcional?: string;
  comprobante_emitido: boolean;
  comprobante_url: string | null;
  nro_comprobante?: string;
  estado_sunat?: string;
  estado?: string;
  created_at: string;
  viajes?: {
    fecha_viaje: string;
    hora_viaje: string;
    rutas?: {
      origen: string;
      destino: string;
    };
  };
}

export type Rol = 'ADMIN' | 'EMPLEADO' | 'VENDEDOR' | 'CONTADOR';

export interface UserRole {
  id: string;
  user_id: string;
  rol: Rol;
  created_at: string;
}
