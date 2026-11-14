import { useId } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { manuais, podeVerCadastro, secaoPorRota } from '../ajuda/manuais';
import './ManualUso.css';

export function ConteudoManual({ secao, usuario }) {
  const id = useId();
  const manual = manuais[secao];
  if (!manual) return null;
  const empresa = podeVerCadastro(usuario, secao);
  return <details className="manual-uso" key={`${secao}:${empresa}`}>
    <summary>
      <span>Manual de uso — {manual.titulo}</span>
      <span className="manual-uso-perfil">{empresa ? 'Guia da empresa' : 'Guia do usuário'}</span>
    </summary>
    <div className="manual-uso-conteudo" aria-labelledby={id}>
      <h2 id={id}>Como usar {manual.titulo}</h2>
      <p>{manual.objetivo}</p>
      <h3>Passo a passo de uso</h3>
      <ol>{manual.uso.map((texto) => <li key={texto}>{texto}</li>)}</ol>
      {manual.limites && <aside className="manual-uso-limites" aria-label="Disponibilidade e limites">
        <h3>O que está disponível nesta versão</h3>
        <ul>{manual.limites.map((texto) => <li key={texto}>{texto}</li>)}</ul>
      </aside>}
      {empresa && manual.empresa && <section className="manual-uso-empresa" aria-label="Orientações de cadastro e gestão">
        <h3>Cadastro e gestão pela empresa</h3>
        {manual.empresa.passos && <ol>{manual.empresa.passos.map((texto) => <li key={texto}>{texto}</li>)}</ol>}
        {manual.empresa.campos && <div className="manual-uso-tabela"><table>
          <caption>Como preencher cada campo</caption>
          <thead><tr><th scope="col">Campo</th><th scope="col">O que informar</th></tr></thead>
          <tbody>{manual.empresa.campos.map(([campo, descricao]) => <tr key={campo}><th scope="row">{campo}</th><td>{descricao}</td></tr>)}</tbody>
        </table></div>}
        {manual.empresa.observacoes && <ul>{manual.empresa.observacoes.map((texto) => <li key={texto}>{texto}</li>)}</ul>}
      </section>}
      <h3>Se precisar de ajuda</h3>
      <p>{empresa ? 'Confira os campos e a mensagem exibida pela tela. Se o problema continuar, procure o suporte da sua instalação, informando a aba e a mensagem, sem enviar senhas ou tokens.' : 'Procure a administração da sua empresa e informe a aba e a mensagem exibida. Não envie sua senha.'}</p>
    </div>
  </details>;
}

export default function ManualUso({ secao }) {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const destino = secao || secaoPorRota[pathname];
  if (loading || (!user && !['/login', '/register'].includes(pathname))) return null;
  return <ConteudoManual secao={destino} usuario={user} />;
}
