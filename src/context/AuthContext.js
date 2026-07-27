import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      const storedToken = await AsyncStorage.getItem('userToken');

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, senha) => {
    console.log('🔵 [AUTH] Iniciando login...', { username: email });
    try {
      console.log('🔵 [AUTH] Enviando requisição para API...');
      // A API espera 'username' e 'password'
      const response = await api.post('/api/login', { 
        username: email, 
        password: senha 
      });
      console.log('✅ [AUTH] Resposta recebida:', response.status);
      console.log('✅ [AUTH] Dados:', JSON.stringify(response.data, null, 2));
      
      const { token, username, name, permissions } = response.data;
      
      // Montar objeto do usuário
      const user = {
        username,
        name,
        permissions
      };

      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));

      console.log('✅ [AUTH] Login realizado com sucesso!');
      setUser(user);
      return { success: true };
    } catch (error) {
      console.error('❌ [AUTH] Erro ao fazer login:', error);
      console.error('❌ [AUTH] Detalhes do erro:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
      });
      
      // Erro de rede
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        return {
          success: false,
          message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e se o servidor está acessível.',
        };
      }
      
      // Timeout
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Tempo de conexão esgotado. Verifique sua conexão com a internet.',
        };
      }
      
      // Erro 504 Gateway Timeout
      if (error.response?.status === 504) {
        return {
          success: false,
          message: 'O servidor está demorando muito para responder. Tente novamente em alguns instantes.',
        };
      }
      
      // Erro do servidor - garantir que seja sempre string
      let errorMessage = 'Erro ao fazer login. Tente novamente.';
      
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (typeof data.message === 'string') {
          errorMessage = data.message;
        } else if (typeof data === 'string') {
          errorMessage = data;
        } else {
          errorMessage = `Erro ${error.response.status}: ${error.response.statusText || 'Erro desconhecido'}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setUser(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        signed: !!user,
        user,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export default AuthContext;
