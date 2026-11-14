"""Gera a base local da Linktrac a partir de um PBF OSM, CSV ANTT e XLSX DNIT."""
import argparse
import csv
import json
import math
import re
from pathlib import Path

import openpyxl
import osmium


def numero(valor):
    try:
        valor = float(str(valor).strip().replace(",", "."))
        return valor if math.isfinite(valor) else None
    except ValueError:
        return None


def limite(valor):
    texto = str(valor).strip()
    if not re.fullmatch(r"\d{1,3}(?:[.,]0+)?(?:\s*km/h)?", texto, re.I):
        return None
    valor = numero(re.sub(r"\s*km/h$", "", texto, flags=re.I))
    return int(valor) if valor and 5 <= valor <= 150 else None


def no_brasil(lat, lng):
    return lat is not None and lng is not None and -35 <= lat <= 6 and -74 <= lng <= -32


class Malha(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.vias = []
        self.radares = {}
        self.vias_por_radar = {}
        self.sentidos_radar = {}
        self.sentidos_via_unica = {}

    def node(self, no):
        if no.tags.get("highway") != "speed_camera" or not no.location.valid():
            return
        lat, lng = round(no.location.lat, 6), round(no.location.lon, 6)
        self.radares[no.id] = {
            "id": f"osm:{no.id}", "fonte": "OpenStreetMap", "latitude": lat, "longitude": lng,
            "nome": no.tags.get("name", "Radar mapeado")[:150], "limite": limite(no.tags.get("maxspeed")),
        }

    def way(self, via):
        tipo = via.tags.get("highway")
        velocidade = limite(via.tags.get("maxspeed"))
        if tipo not in {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
                       "residential", "living_street", "service", "motorway_link", "trunk_link",
                       "primary_link", "secondary_link", "tertiary_link"} or not velocidade:
            return
        if any(tag.k.startswith("maxspeed:") and tag.k not in {"maxspeed:type", "maxspeed:source"} for tag in via.tags):
            return
        if len(via.nodes) < 2 or any(not no.location.valid() for no in via.nodes):
            return
        pontos = [[round(no.location.lon, 6), round(no.location.lat, 6)] for no in via.nodes]
        self.vias.append({"id": str(via.id), "nome": (via.tags.get("name") or via.tags.get("ref") or "Via mapeada")[:150],
                          "limite": velocidade, "pontos": pontos})
        ids = [no.ref for no in via.nodes]
        for radar in set(ids).intersection(self.radares):
            self.vias_por_radar.setdefault(radar, []).append((ids, pontos))
            mao = via.tags.get("oneway")
            if mao not in {"yes", "1", "true", "-1"} or ids.count(radar) != 1:
                continue
            alvo = ids.index(radar)
            anterior = alvo + (1 if mao == "-1" else -1)
            if 0 <= anterior < len(pontos):
                sentido = azimute_entre(pontos[anterior], pontos[alvo])
                if sentido is not None:
                    self.sentidos_via_unica[radar] = sentido

    def relation(self, relacao):
        if (relacao.tags.get("type") != "enforcement" or relacao.tags.get("enforcement") != "maxspeed"
                or any(m.role == "section" for m in relacao.members)):
            return
        dispositivos = [m.ref for m in relacao.members if m.type == "n" and m.role == "device"]
        origens = [m.ref for m in relacao.members if m.type == "n" and m.role == "from"]
        if len(dispositivos) != 1 or len(origens) != 1:
            return
        radar, origem = dispositivos[0], origens[0]
        if radar not in self.radares or radar == origem:
            return
        candidatas = [(ids, pontos) for ids, pontos in self.vias_por_radar.get(radar, [])
                      if ids.count(radar) == 1 and ids.count(origem) == 1]
        if len(candidatas) != 1:
            return
        ids, pontos = candidatas[0]
        alvo = ids.index(radar)
        vizinho = alvo - 1 if ids.index(origem) < alvo else alvo + 1
        azimute = azimute_entre(pontos[vizinho], pontos[alvo])
        if azimute is not None:
            self.sentidos_radar.setdefault(radar, set()).add(azimute)

    def radares_mapeados(self):
        for id_radar, radar in self.radares.items():
            sentidos = self.sentidos_radar.get(id_radar, set())
            if len(sentidos) == 1:
                radar["azimuteTrafego"] = next(iter(sentidos))
            elif not sentidos and len(self.vias_por_radar.get(id_radar, [])) == 1 and id_radar in self.sentidos_via_unica:
                radar["azimuteTrafego"] = self.sentidos_via_unica[id_radar]
            yield radar


def azimute_entre(origem, destino):
    dx = (destino[0] - origem[0]) * math.cos(math.radians(destino[1]))
    dy = destino[1] - origem[1]
    return round(math.degrees(math.atan2(dx, dy))) % 360 if dx or dy else None


def radares_antt(arquivo):
    with arquivo.open(encoding="utf-8-sig", errors="replace", newline="") as csvfile:
        for i, linha in enumerate(csv.DictReader(csvfile, delimiter=";"), 1):
            lat, lng = numero(linha.get("latitude")), numero(linha.get("longitude"))
            if not no_brasil(lat, lng) or (linha.get("situacao") or "").strip().lower() != "ativo":
                continue
            leve, pesado = limite(linha.get("velocidade_leve")), limite(linha.get("velocidade_pesado"))
            tipo = (linha.get("tipo_de_radar") or "Radar").strip()
            trecho = " · ".join(v.strip() for v in [linha.get("rodovia", ""), linha.get("Municipio", ""), linha.get("uf", "")] if v.strip())
            yield {
                "id": f"antt:{i}", "fonte": "ANTT", "latitude": lat, "longitude": lng,
                "nome": f"{tipo} · {trecho}"[:150], "sentido": (linha.get("sentido") or "").strip(),
                "leve": leve, "pesado": pesado, "limite": max(leve, pesado) if leve and pesado else None,
            }


def radares_dnit(arquivo):
    wb = openpyxl.load_workbook(arquivo, read_only=True, data_only=True)
    try:
        for i, linha in enumerate(wb.active.iter_rows(min_row=2, values_only=True), 2):
            codigo, uf, rodovia, km, municipio, _, tipo, _, _, inicio, coordenadas, *_ = linha
            if not codigo or not isinstance(coordenadas, str) or "/" not in coordenadas:
                continue
            lat, lng = (numero(v) for v in coordenadas.split("/", 1))
            if no_brasil(lat, lng):
                yield {
                    "id": f"dnit:{i}", "fonte": "DNIT", "latitude": lat, "longitude": lng,
                    "nome": f"{tipo or 'Equipamento'} · BR-{rodovia} · km {km} · {municipio}/{uf}"[:150],
                    "inicioOperacao": inicio.isoformat() if hasattr(inicio, "isoformat") else None,
                }
    finally:
        wb.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for opcao in ("osm", "antt", "dnit", "saida"):
        parser.add_argument("--" + opcao, required=True, type=Path)
    args = parser.parse_args()
    malha = Malha()
    malha.apply_file(str(args.osm), locations=True)
    radares = [*radares_antt(args.antt), *radares_dnit(args.dnit), *malha.radares_mapeados()]
    base = {"vias": malha.vias, "radares": radares}
    temporario = args.saida.with_suffix(".tmp")
    temporario.write_text(json.dumps(base, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporario.replace(args.saida)
    print(f"{len(malha.vias)} vias com limite e {len(radares)} equipamentos importados.")


if __name__ == "__main__":
    main()
