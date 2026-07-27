# START PIRA MOBILE

Aplicativo mobile do sistema START PIRA desenvolvido com React Native e Expo.

## 🚀 Como executar

### Pré-requisitos
- Node.js instalado
- npm ou yarn
- Expo Go instalado no celular (Android ou iOS)

### Instalação

1. Instale as dependências:
```bash
npm install
```

2. Inicie o projeto:
```bash
npm start
```

3. Escaneie o QR Code com:
   - **Android**: Expo Go app
   - **iOS**: Câmera do iPhone

## 📱 Funcionalidades Implementadas

✅ **Autenticação**
- Login com email e senha
- Persistência de sessão
- Logout

✅ **Dashboard/Home**
- Menu principal com acesso às funcionalidades
- Informações do usuário logado

✅ **Integração com API**
- Conexão com API existente (https://api-start-pira.vercel.app)
- Interceptors para autenticação automática
- Tratamento de erros

## 🏗️ Estrutura do Projeto

```
START_PIRA_MOBILE/
├── src/
│   ├── screens/          # Telas do aplicativo
│   │   ├── LoginScreen.js
│   │   └── HomeScreen.js
│   ├── components/       # Componentes reutilizáveis
│   ├── context/          # Contextos (Auth, etc)
│   │   └── AuthContext.js
│   ├── services/         # Serviços (API, etc)
│   │   └── api.js
│   └── navigation/       # Configuração de rotas
│       └── Routes.js
├── App.js               # Componente principal
└── package.json
```

## 🔄 Próximas Telas a Implementar

- [x] PDV (Ponto de Venda)
- [x] Caixa
- [x] Fiado
- [x] Despesas Pessoais
- [x] Despesas Gerais
- [ ] Máquinas
- [x] Produtos
- [x] Ponto

## 🛠️ Tecnologias

- React Native
- Expo
- React Navigation
- React Native Paper (UI)
- Axios
- AsyncStorage

## 📝 Notas

- O app está configurado para usar a API de produção
- Para desenvolvimento local, altere a URL em `src/services/api.js`
