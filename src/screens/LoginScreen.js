import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { API_URL } from '../config/environment';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn } = useAuth();

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/health');
      Alert.alert(
        'Conexão OK', 
        `Servidor conectado com sucesso!\n\nURL: ${API_URL}\nStatus: ${response.status}`
      );
    } catch (error) {
      let errorMsg = `URL: ${API_URL}\n\n`;
      
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        errorMsg += 'Erro de Rede: Não foi possível conectar ao servidor.\n\n';
        errorMsg += 'Verifique:\n';
        errorMsg += '• Conexão com internet\n';
        errorMsg += '• Se o servidor está rodando\n';
        errorMsg += '• Se a URL está correta\n';
        errorMsg += '• Se você está na mesma rede (para desenvolvimento local)';
      } else if (error.code === 'ECONNABORTED') {
        errorMsg += 'Timeout: Servidor demorou muito para responder';
      } else {
        errorMsg += `Erro: ${error.message}`;
      }
      
      Alert.alert('Erro de Conexão', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    const result = await signIn(email, senha);
    setLoading(false);

    if (!result.success) {
      // Garante que a mensagem seja sempre uma string
      const errorMessage = typeof result.message === 'string' 
        ? result.message 
        : JSON.stringify(result.message) || 'Erro ao fazer login. Tente novamente.';
      
      Alert.alert('Erro', errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps='handled'
      >
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.logoContainer}>
              <Text style={styles.title}>START PIRA</Text>
              <Text style={styles.subtitle}>Sistema de Gestão</Text>
            </View>

            <TextInput
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              autoCapitalize="none"
              style={styles.input}
              disabled={loading}
            />

            <TextInput
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
              disabled={loading}
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              style={styles.button}
              disabled={loading}
              loading={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            {/* <Button
              mode="outlined"
              onPress={testConnection}
              style={styles.testButton}
              disabled={loading}
              icon="wifi"
            >
              Testar Conexão
            </Button> */}

            <Button
              mode="text"
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotButton}
              disabled={loading}
            >
              Esqueci minha senha
            </Button>


          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    elevation: 4,
    backgroundColor: '#1a1a1a',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 10,
    paddingVertical: 6,
    backgroundColor: '#2196F3',
  },
  testButton: {
    marginTop: 10,
    borderColor: '#2196F3',
  },
  forgotButton: {
    marginTop: 10,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
});
