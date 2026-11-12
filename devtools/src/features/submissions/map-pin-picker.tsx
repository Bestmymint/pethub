'use client';

import { useEffect, useRef, useState } from 'react';

import type { Locale } from '@/lib/i18n';
import { clampPoint, formatCoordinate, isSamePoint, type CoordinatePoint } from './coordinates';

const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
const THAILAND_CENTER: CoordinatePoint = { latitude: 13.7563, longitude: 100.5018 };

/**
 * Pin picker for step 2 of the submission form.
 *
 * MapLibre is imported on demand inside an effect, so the map never runs during
 * SSR and the rest of the form keeps working when the import or the tiles fail
 * (the hint in the form promises exactly that).
 */
export function MapPinPicker({
  locale,
  point,
  onPick,
}: {
  locale: Locale;
  point?: CoordinatePoint;
  onPick: (point: CoordinatePoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | undefined>(undefined);
  const markerRef = useRef<import('maplibre-gl').Marker | undefined>(undefined);
  const onPickRef = useRef(onPick);
  const pointRef = useRef(point);
  const [failed, setFailed] = useState(false);
  const [tileWarning, setTileWarning] = useState(false);
  const [clamped, setClamped] = useState(false);
  const isThai = locale === 'th';

  useEffect(() => {
    onPickRef.current = onPick;
    pointRef.current = point;
  }, [onPick, point]);

  function pick(raw: CoordinatePoint) {
    const next = clampPoint(raw);
    setClamped(
      Math.abs(next.latitude - raw.latitude) > 1e-9 ||
        Math.abs(next.longitude - raw.longitude) > 1e-9,
    );
    onPickRef.current(next);
  }

  useEffect(() => {
    let disposed = false;
    void import('maplibre-gl')
      .then((maplibre) => {
        if (disposed || !container.current) return;
        // Same-origin worker bundle, see src/features/map/osm-scene.ts.
        maplibre.setWorkerUrl('/api/map-assets/maplibre-gl-worker.mjs');
        const start = pointRef.current ?? THAILAND_CENTER;
        const map = new maplibre.Map({
          container: container.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 19,
                attribution: OSM_ATTRIBUTION,
              },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          },
          center: [start.longitude, start.latitude],
          zoom: pointRef.current ? 13 : 6,
          minZoom: 4,
          maxZoom: 18,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        const marker = new maplibre.Marker({ color: '#2d5a43', draggable: true })
          .setLngLat([start.longitude, start.latitude])
          .addTo(map);
        marker.on('dragend', () => {
          const position = marker.getLngLat();
          pick({ latitude: position.lat, longitude: position.lng });
        });
        map.on('click', (event) => {
          marker.setLngLat(event.lngLat);
          pick({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        });
        map.on('error', () => setTileWarning(true));
        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      markerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = undefined;
      mapRef.current = undefined;
    };
  }, []);

  // Typed coordinates and the geocode button move the pin; map picks are already
  // in place, so identical values are skipped to avoid fighting the user.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !point) return;
    const current = marker.getLngLat();
    const next = { latitude: current.lat, longitude: current.lng };
    if (isSamePoint(next, point)) return;
    marker.setLngLat([point.longitude, point.latitude]);
    map.easeTo({
      center: [point.longitude, point.latitude],
      zoom: Math.max(map.getZoom(), 12),
    });
  }, [point]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-bold">
        {isThai ? 'ปักหมุดบนแผนที่' : 'Pin the location on the map'}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {isThai
          ? 'คลิกบนแผนที่หรือลากหมุดเพื่อกำหนดพิกัด ตัวเลขด้านบนจะอัปเดตตาม'
          : 'Click the map or drag the pin to set the coordinates. The fields above follow.'}
      </p>
      {failed ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[var(--terracotta-soft)] p-3 text-sm font-semibold text-[var(--terracotta)]"
        >
          {isThai
            ? 'โหลดแผนที่ไม่ได้ กรุณากรอกพิกัดเองหรือใช้ปุ่มค้นหาจากที่อยู่ ฟอร์มยังใช้งานได้ปกติ'
            : 'The map could not load. Enter the coordinates or use the address search; the form still works.'}
        </p>
      ) : (
        <div
          ref={container}
          className="mt-3 h-72 w-full overflow-hidden rounded-xl border border-[var(--border)]"
          role="application"
          aria-label={isThai ? 'แผนที่ปักหมุดสถานที่' : 'Place pin map'}
        />
      )}
      {point && !failed && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {isThai ? 'หมุดปัจจุบัน' : 'Current pin'}: {formatCoordinate(point.latitude)},{' '}
          {formatCoordinate(point.longitude)}
        </p>
      )}
      {clamped && (
        <p role="status" className="mt-2 text-xs font-semibold text-[var(--terracotta)]">
          {isThai
            ? 'พิกัดที่เลือกอยู่นอกประเทศไทย ระบบปรับให้อยู่ในขอบเขตให้แล้ว'
            : 'That point is outside Thailand, so it was clamped to the allowed range.'}
        </p>
      )}
      {tileWarning && (
        <p role="status" className="mt-2 text-xs text-[var(--text-muted)]">
          {isThai
            ? 'โหลดภาพแผนที่บางส่วนไม่ได้ (ต้องต่ออินเทอร์เน็ต) แต่ยังปักหมุดและกรอกพิกัดได้'
            : 'Some map tiles could not load (internet required), but pinning and typing coordinates still work.'}
        </p>
      )}
    </div>
  );
}
