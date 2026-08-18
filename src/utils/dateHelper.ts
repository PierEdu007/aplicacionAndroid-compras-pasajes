/**
 * Helper para manejo de fechas en Zona Horaria de Perú (America/Lima / UTC-5)
 */

export function getPeruDate(): Date {
  // Obtener fecha actual en hora de Perú
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  // Peru is UTC-5
  return new Date(utc - 5 * 3600000);
}

export function getPeruTodayString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch (_e) {
    const d = getPeruDate();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

export function getPeruTomorrowString(): string {
  const d = getPeruDate();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatPeruDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
