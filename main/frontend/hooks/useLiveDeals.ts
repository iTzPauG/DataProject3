import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
// Importa `db` desde donde tengas inicializado tu Firebase en el frontend.
// Según tu api.ts, parece que lo tienes junto a él. Ajusta la ruta si es necesario:
import { db } from '../api/supabase'; 

export interface LiveDeal {
  id: string;
  restaurant_id: string;
  price: number;
  cuisine: string;
  available_at: string;
  seats: number;
  description: string;
  created_at: any;
}

export function useLiveDeals() {
  const [deals, setDeals] = useState<LiveDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dealsRef = collection(db, 'deals');
    
    // Obtenemos las 10 ofertas más recientes. 
    // Nota: Para usar orderBy en Firestore podrías necesitar crear un índice la primera vez.
    const q = query(dealsRef, orderBy('created_at', 'desc'), limit(10));

    // onSnapshot abre un WebSocket. Cada vez que el Backend escriba, esto se dispara al instante.
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveDeals = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        } as LiveDeal;
      });

      // Filtramos en el cliente para no mostrar ofertas pasadas o sin plazas
      const validDeals = liveDeals.filter(deal => 
        new Date(deal.available_at) > new Date() && deal.seats > 0
      );

      setDeals(validDeals);
      setLoading(false);
    }, (error) => {
      console.error("[LiveDeals] Error escuchando ofertas en tiempo real:", error);
      setLoading(false);
    });

    // Limpiamos la suscripción al desmontar para no dejar WebSockets fantasmas
    return () => unsubscribe();
  }, []);

  return { deals, loading };
}
