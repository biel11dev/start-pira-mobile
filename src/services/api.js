import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/environment';

// Criar instância do axios
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Aumentado para 30 segundos
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor para adicionar token nas requisições
api.interceptors.request.use(
  async (config) => {
    console.log('🌐 [API] Requisição:', {
      method: config.method?.toUpperCase(),
      url: config.baseURL + config.url,
      data: config.data,
    });
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 [API] Token adicionado');
    }
    return config;
  },
  (error) => {
    console.error('❌ [API] Erro na requisição:', error);
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
api.interceptors.response.use(
  (response) => {
    console.log('✅ [API] Resposta recebida:', {
      status: response.status,
      url: response.config.url,
    });
    return response;
  },
  async (error) => {
    console.error('❌ [API] Erro na resposta:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    if (error.response?.status === 401) {
      console.warn('⚠️ [API] Token inválido, limpando dados...');
      // Token expirado ou inválido
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      // Redirecionar para login será feito no contexto
    }
    return Promise.reject(error);
  }
);

export default api;
