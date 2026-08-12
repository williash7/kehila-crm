export interface Performer {
  id: string;
  name: string;
  rating?: number; // 1-5
  phone?: string;
  address?: string;
  price?: number;
  notes?: string;
}

export function emptyPerformer(): Performer {
  return { id: `perf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` , name: '' };
}
