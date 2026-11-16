import { useEffect, useState } from 'react';
import { consultarCadastroInicial } from '../api/auth';

export default function useCadastroInicial() {
  const [modo, definirModo] = useState('carregando');
  const [consulta, definirConsulta] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    consultarCadastroInicial(controller.signal)
      .then((resultado) => {
        if (!controller.signal.aborted) definirModo(resultado);
      })
      .catch(() => {
        if (!controller.signal.aborted) definirModo('indisponivel');
      });
    return () => controller.abort();
  }, [consulta]);

  function consultarNovamente() {
    definirModo('carregando');
    definirConsulta((anterior) => anterior + 1);
  }

  return { modo, consultarNovamente };
}
