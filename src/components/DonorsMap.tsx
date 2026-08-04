import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { geocodeAddress } from '../lib/geocode';
import { getOrg, withCity } from '../lib/orgConfig';

// תיקון סטנדרטי לבעיה ידועה: Leaflet + כלי בנייה כמו Vite לא מוצאים
// אוטומטית את קבצי אייקון הסיכה, כי הנתיבים בקוד המקורי מניחים מבנה תיקיות
// שונה. פותרים על ידי הזרקת הנתיבים המיובאים דרך Vite ישירות.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// מרכז המפה ההתחלתי — המיקום שהוגדר בהגדרות הארגון

interface DonorPin {
  name: string;
  address: string;
}

export function DonorsMap({ donors }: { donors: DonorPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [resolved, setResolved] = useState(0);
  const [notFound, setNotFound] = useState(0);

  // אתחול המפה פעם אחת
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const org = getOrg();
    const map = L.map(containerRef.current).setView([org.lat, org.lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // geocoding + סימון פינים לרשימת התורמים הנוכחית
  useEffect(() => {
    let cancelled = false;
    setResolved(0);
    setNotFound(0);
    markersRef.current?.clearLayers();

    (async () => {
      const points: L.LatLngExpression[] = [];
      for (const d of donors) {
        if (cancelled) return;
        const point = await geocodeAddress(d.address);
        if (cancelled) return;
        if (point) {
          const marker = L.marker([point.lat, point.lon]).bindPopup(
            `<div style="text-align:right;font-family:Heebo,sans-serif;min-width:140px">
              <div style="font-weight:700;margin-bottom:4px">${escapeHtml(d.name)}</div>
              <div style="font-size:12px;color:#555;margin-bottom:6px">${escapeHtml(d.address)}</div>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withCity(d.address))}"
                 target="_blank" rel="noopener noreferrer"
                 style="font-size:12px;color:#2563eb;font-weight:700">נווט בגוגל מפות ←</a>
            </div>`
          );
          markersRef.current?.addLayer(marker);
          points.push([point.lat, point.lon]);
          setResolved(r => r + 1);
        } else {
          setNotFound(n => n + 1);
        }
      }
      if (!cancelled && points.length > 0 && mapRef.current) {
        mapRef.current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
      }
    })();

    return () => { cancelled = true; };
  }, [donors]);

  const total = donors.length;
  const done = resolved + notFound;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#EDE6D6] shadow-sm">
      <div ref={containerRef} className="w-full h-[280px] md:h-[360px]" />
      {done < total && (
        <div className="absolute bottom-2 right-2 left-2 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[11px] text-gray-600 shadow-sm flex items-center justify-between">
          <span>מאתר כתובות על המפה… {done}/{total}</span>
          <span className="text-gray-400">(פעם ראשונה בלבד — נשמר לפעמים הבאות)</span>
        </div>
      )}
      {done === total && notFound > 0 && (
        <div className="absolute bottom-2 right-2 left-2 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[11px] text-amber-700 shadow-sm">
          {notFound} כתובות לא אותרו במפה (אפשר עדיין לנווט אליהן מהרשימה למטה)
        </div>
      )}
    </div>
  );
}

function escapeHtml(str: string) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
