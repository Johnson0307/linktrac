import axios from 'axios';

// Um fallback mínimo para testes caso a execução em Vitest não tenha DOM/localStorage.
export default axios.create({ baseURL: '', headers: { 'Content-Type': 'application/json' } });
