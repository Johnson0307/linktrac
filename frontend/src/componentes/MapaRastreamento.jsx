// src/componentes/MapaRastreamento.jsx
import { useEffect, useRef } from 'react';
import { PlusCodeServico } from '../servicos/plusCode';
import { CONFIG } from '../config';

export default function MapaRastreamento({ posicao }) {
  const mapaRef = useRef(null);

  useEffect(() => {
    if (!posicao || !window.google) return;

    const coordenadas = posicao.plusCode
      ? PlusCodeServico.decodificar(posicao.plusCode)
      : { lat: posicao.latitude, lng: posicao.longitude };

    const mapa = new window.google.maps.Map(mapaRef.current, {
      center: coordenadas,
      zoom: 16,
    });

    new window.google.maps.Marker({ position: coordenadas, map: mapa });
  }, [posicao]);

  return <div ref={mapaRef} style={{ width: '100%', height: '400px', marginTop: '1rem' }} />;
}
