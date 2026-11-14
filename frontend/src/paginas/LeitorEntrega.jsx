import { useEffect, useRef, useState } from 'react';

export default function LeitorEntrega({ aoLer, fechar }) {
  const video = useRef(null);
  const callbacks = useRef({ aoLer, fechar });
  const [erro, setErro] = useState('');
  useEffect(() => { callbacks.current = { aoLer, fechar }; }, [aoLer, fechar]);

  useEffect(() => {
    let ativo = true;
    let controles;
    let capturado = false;
    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('A câmera precisa de HTTPS no celular. Você pode digitar o código ou importar o XML.');
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
        if (!ativo) return;
        const leitor = new BrowserMultiFormatReader(new Map([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13, BarcodeFormat.DATA_MATRIX]],
        ]));
        controles = await leitor.decodeFromConstraints({
          video: { facingMode: { ideal: 'environment' } }, audio: false,
        }, video.current, (resultado, _erro, scanner) => {
          if (!ativo || !resultado || capturado) return;
          capturado = true;
          scanner.stop();
          callbacks.current.aoLer(resultado.getText());
          callbacks.current.fechar();
        });
        if (!ativo) controles.stop();
      } catch {
        if (ativo) setErro('Não foi possível abrir a câmera. Confira a permissão do navegador ou digite o código.');
      }
    }
    iniciar();
    return () => { ativo = false; controles?.stop(); };
  }, []);

  return <div>
    {erro && <p role="alert">{erro}</p>}
    <video ref={video} muted playsInline aria-label="Prévia da câmera" style={{ width: '100%', maxHeight: 280 }} />
    <button type="button" onClick={fechar}>Fechar câmera</button>
  </div>;
}
