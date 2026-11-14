const desenhos = {
 painel:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 mapa:'M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z M9 3v15 M15 6v15',
 historico:'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2',
 veiculo:'M5 17H3v-6l3-7h12l3 7v6h-2 M3 11h18 M5 17h14 M5 17v3 M19 17v3 M7 14h1 M16 14h1',
 pessoas:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
 ferramenta:'M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3z',
 relatorio:'M4 21V3h12l4 4v14H4z M16 3v5h4 M8 17v-3 M12 17v-6 M16 17v-4',
 carga:'M3 7l9-4 9 4v11l-9 4-9-4V7z M3 7l9 4 9-4 M12 11v11 M7 5l10 4',
 ajustes:'M4 7h16 M7 4v6 M4 17h16 M16 14v6',
 compartilhar:'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M8.5 10.5l7-4 M8.5 13.5l7 4',
 sair:'M9 21H3V3h6 M14 8l5 4-5 4 M8 12h12',menu:'M4 6h16 M4 12h16 M4 18h16',seta:'M5 12h14 M14 7l5 5-5 5'
};
export default function Icone({nome,tamanho=20}){return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={desenhos[nome]||desenhos.painel}/></svg>}
