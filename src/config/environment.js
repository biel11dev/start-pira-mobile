// Configuração de ambiente
// Para desenvolvimento local, descomente e configure o IP da sua máquina

const ENV = {
  // Produção (API online)
  production: {
    apiUrl: 'https://api-start-pira.vercel.app',
  },

  // QA (API de homologação)
  qa: {
    apiUrl: 'https://api-start-pira-qa.vercel.app',
  },
  
  // Desenvolvimento (servidor local)
  // Substitua pelo IP da sua máquina na rede local
  // Para descobrir seu IP:
  // - Windows: execute 'ipconfig' no terminal e procure por 'IPv4'
  // - Mac/Linux: execute 'ifconfig' e procure por 'inet'
  development: {
    apiUrl: 'http://192.168.1.100:3000', // Exemplo: ajuste para seu IP
  },
};

// Altere entre 'production' e 'development' conforme necessário
const currentEnv = 'qa';

export const API_URL = ENV[currentEnv].apiUrl;

export default ENV;
