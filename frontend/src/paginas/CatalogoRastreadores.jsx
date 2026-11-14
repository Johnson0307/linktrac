import { useId, useState } from 'react';
import catalogo from './catalogoRastreadores.json';
import catalogoCameras from './catalogoCameras.json';
import configuracoes from './configuracoesEquipamentos';

const normalizar = (valor) => (valor || '').normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const rastreadores = catalogo.itens.map(([fabricante, modelo, protocolo, porta]) => ({
  fabricante,
  modelo,
  protocolo,
  porta,
  nome: [fabricante, modelo].filter(Boolean).join(' '),
  busca: normalizar(fabricante + modelo),
}));

const cameras = catalogoCameras.map(([fabricante, modelo, tipo, fonte]) => ({
  fabricante, modelo, tipo, fonte,
  nome: fabricante + ' ' + modelo,
  busca: normalizar(fabricante + modelo + tipo),
}));

const chaveModelo = (fabricante, modelo) => `${normalizar(fabricante)}:${normalizar(modelo)}`;
const guiasPorModelo = new Map(configuracoes.flatMap(guia =>
  guia.modelos.map(modelo => [chaveModelo(guia.fabricante, modelo), guia])
));

export default function CatalogoRastreadores({ fabricante, modelo, selecionar, somenteCameras = false }) {
  const id = useId();
  const [categoria, setCategoria] = useState('rastreadores');
  const exibeCameras = somenteCameras || categoria === 'cameras';
  const registros = exibeCameras ? cameras : rastreadores;
  const [busca, setBusca] = useState('');
  const [escolha, setEscolha] = useState('');
  const termo = normalizar(busca);
  const encontrados = termo ? registros.filter(item => item.busca.includes(termo)) : exibeCameras ? registros : [];
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
    .map(item => `${item.protocolo} · porta padrão ${item.porta}`))];

  const camera = correspondencias.find(item => item.fonte);

  return <div className="central-full">
    <div>
      <details>
        <summary>{somenteCameras ? 'Catálogo e configurações de câmeras' : 'Buscar marca ou modelo no catálogo'}</summary>
        {!somenteCameras && <label>Tipo de equipamento
          <select value={categoria} onChange={e => { setCategoria(e.target.value); setBusca(''); setEscolha(''); }}>
            <option value="rastreadores">Rastreadores GPS</option>
            <option value="cameras">Câmeras veiculares e MDVR</option>
          </select>
        </label>}
        <label htmlFor={id}>Marca ou modelo</label>
        <input id={id} type="search" placeholder={exibeCameras ? 'Ex.: Jimi IoT, JC450 ou MDVR' : 'Ex.: Teltonika, FMB920 ou LV12'}
          value={busca} onChange={e => { setBusca(e.target.value); setEscolha(''); }} />
        <small>{registros.length.toLocaleString('pt-BR')} opções.{selecionar && ' Você também pode preencher marca e modelo manualmente.'}</small>
        {termo && !encontrados.length && <p role="status">Nenhum resultado no catálogo.</p>}
        {encontrados.length > 0 && <>
          <label>Resultados do catálogo
            <select value={escolha} onChange={e => setEscolha(e.target.value)}>
              <option value="">Selecione um resultado</option>
              {encontrados.slice(0, 50).map((item, index) => <option key={index} value={String(index)}>
                {item.nome}{item.protocolo ? ` — ${item.protocolo}, porta ${item.porta}` : item.tipo ? ' — ' + item.tipo : ''}
              </option>)}
            </select>
          </label>
          {encontrados.length > 50 && <small>Exibindo os primeiros 50 de {encontrados.length}. Refine a busca pelo modelo.</small>}
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
          Confirme o protocolo e a porta no gateway em uso.
        </p>}
        {camera && <p>A recepção de eventos e clipes depende de integração com o fornecedor.
          {!guia && <> <a href={camera.fonte} target="_blank" rel="noreferrer">Referência do catálogo</a>.</>}
        </p>}
      </section>}
    </div>
  </div>;
}
