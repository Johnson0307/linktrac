import { useId, useState } from 'react';
import catalogo from './catalogoRastreadores.json';
import catalogoCameras from './catalogoCameras.json';
import configuracoes from './configuracoesEquipamentos';

const normalizar = (valor) => (valor || '').normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const chaveModelo = (fabricante, modelo) => {
  const marca = normalizar(fabricante);
  const nome = normalizar(modelo);
  return marca === 'rst' || marca === 'multiportal'
    ? `multiportal:${nome.replace(/^rst/, '')}`
    : `${marca}:${nome}`;
};
const guiasPorModelo = new Map(configuracoes.flatMap(guia =>
  guia.modelos.map(modelo => [chaveModelo(guia.fabricante, modelo), guia])
));

const rastreadores = catalogo.itens.map(([marca, referencia, protocolo, porta, situacao]) => {
  const fabricante = marca === 'RST' ? 'MultiPortal' : marca;
  const modelo = marca === 'RST' ? 'RST ' + referencia : referencia;
  const guia = guiasPorModelo.get(chaveModelo(fabricante, modelo));
  const termos = marca === 'Traccar' && modelo === 'Client' ? 'smartphone aplicativo SDK' : guia?.termos;
  return {
    fabricante, modelo, protocolo, porta, situacao,
    nome: [fabricante, modelo].filter(Boolean).join(' '),
    busca: normalizar([fabricante, modelo, protocolo, termos].join(' ')),
  };
});
const protocolosCatalogo = [...new Set(rastreadores.map(item => item.protocolo).filter(Boolean))].sort();
const LIMITE_RESULTADOS = 50;

const cameras = catalogoCameras.map(([fabricante, modelo, tipo, fonte]) => ({
  fabricante, modelo, tipo, fonte,
  nome: fabricante + ' ' + modelo,
  busca: normalizar(fabricante + modelo + tipo),
}));

export default function CatalogoRastreadores({ fabricante, modelo, selecionar, somenteCameras = false }) {
  const id = useId();
  const [categoria, setCategoria] = useState('rastreadores');
  const exibeCameras = somenteCameras || categoria === 'cameras';
  const registros = exibeCameras ? cameras : rastreadores;
  const [busca, setBusca] = useState('');
  const [escolha, setEscolha] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [limite, setLimite] = useState(LIMITE_RESULTADOS);
  const termos = busca.split(/\s+/).map(normalizar).filter(Boolean);
  const encontrados = registros.filter(item =>
    (exibeCameras || !protocolo || item.protocolo === protocolo) &&
    termos.every(termo => item.busca.includes(termo))
  );
  const escolhido = escolha === '' ? null : encontrados[Number(escolha)];
  const marcaExibida = escolhido?.fabricante ?? fabricante;
  const modeloExibido = escolhido?.modelo ?? modelo;
  const chave = chaveModelo(marcaExibida, modeloExibido);
  const guia = guiasPorModelo.get(chave);
  const correspondencias = modeloExibido ? [...rastreadores, ...cameras].filter(item =>
    chaveModelo(item.fabricante, item.modelo) === chave
  ) : [];
  const protocolos = [...new Set(correspondencias
    .filter(item => item.porta)
    .map(item => {
      const nota = { confirmar: ' (protocolo a confirmar)', familia: ' (referência da família)' }[item.situacao] || '';
      return `${item.protocolo} · porta padrão ${item.porta}${nota}`;
    }))];

  const camera = correspondencias.find(item => item.fonte);

  function limparSelecao() {
    setEscolha('');
    setLimite(LIMITE_RESULTADOS);
  }

  return <div className="central-full">
    <div>
      <details>
        <summary>{somenteCameras ? 'Catálogo e configurações de câmeras' : 'Biblioteca de protocolos e modelos'}</summary>
        {!somenteCameras && <label>Tipo de equipamento
          <select value={categoria} onChange={e => { setCategoria(e.target.value); setBusca(''); setProtocolo(''); limparSelecao(); }}>
            <option value="rastreadores">Rastreadores GPS</option>
            <option value="cameras">Câmeras veiculares e MDVR</option>
          </select>
        </label>}
        {!exibeCameras && <label>Protocolo Traccar
          <select value={protocolo} onChange={e => { setProtocolo(e.target.value); limparSelecao(); }}>
            <option value="">Todos os protocolos</option>
            {protocolosCatalogo.map(valor => <option key={valor} value={valor}>{valor}</option>)}
          </select>
        </label>}
        <label htmlFor={id}>Marca ou modelo</label>
        <input id={id} type="search" placeholder={exibeCameras ? 'Ex.: Jimi IoT, JC450 ou MDVR' : 'Ex.: Teltonika, FMB920 ou LV12'}
          value={busca} onChange={e => { setBusca(e.target.value); limparSelecao(); }} />
        <small>{registros.length.toLocaleString('pt-BR')} opções.{selecionar && ' Você também pode preencher marca e modelo manualmente.'}</small>
        {!encontrados.length && <p role="status">Nenhum resultado no catálogo.</p>}
        {encontrados.length > 0 && <>
          <label>Resultados do catálogo
            <select value={escolha} onChange={e => setEscolha(e.target.value)}>
              <option value="">Selecione um resultado</option>
              {encontrados.slice(0, limite).map((item, index) => <option key={index} value={String(index)}>
                {item.nome}{item.protocolo ? ` — ${item.protocolo}, porta ${item.porta}` : item.tipo ? ' — ' + item.tipo : ''}
              </option>)}
            </select>
          </label>
          {encontrados.length > limite && <button type="button" onClick={() => setLimite(atual => atual + LIMITE_RESULTADOS)}>
            Mostrar mais resultados ({limite} de {encontrados.length})
          </button>}
          {selecionar && <button type="button" disabled={!escolhido} onClick={() => { selecionar(escolhido); setEscolha(''); }}>
            Usar este modelo
          </button>}
        </>}
        {!exibeCameras && <p><a href={catalogo.fonte} target="_blank" rel="noreferrer">Lista oficial do Traccar</a> · consultada em {catalogo.consultadoEm.split('-').reverse().join('/')}.</p>}
      </details>
      {modeloExibido && <section aria-label="Configurações do equipamento">
        <h4>Configurações disponíveis para {marcaExibida} {modeloExibido}</h4>
        {guia ? <>
          <dl>{guia.parametros.map(([campo, descricao, exemplo]) => <div key={campo}>
            <dt><strong>{campo}</strong></dt>
            <dd>{descricao}{exemplo && <div><code>{exemplo}</code></div>}</dd>
          </div>)}</dl>
          <ul>{guia.fontes.map(([titulo, url]) => <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">{titulo}</a>
          </li>)}</ul>
          <p>Aplique os parâmetros pelo método indicado no manual do aparelho. Confirme a revisão e o firmware.</p>
        </> : <p>Este modelo ainda está sem guia de configuração verificado na Linktrac.</p>}
        {protocolos.length > 0 && <p>
          <strong>Referência do Traccar</strong> {protocolos.join(' / ')}.
          O recebimento na Linktrac depende da ativação do protocolo e da porta no gateway em uso.
        </p>}
        {camera && <p>A recepção de eventos e clipes depende de integração com o fornecedor.
          {!guia && <> <a href={camera.fonte} target="_blank" rel="noreferrer">Referência do catálogo</a>.</>}
        </p>}
      </section>}
    </div>
  </div>;
}
