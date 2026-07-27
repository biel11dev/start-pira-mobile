import React from 'react';
import { StatusBar } from 'react-native';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import Routes from './src/navigation/Routes';

// Tema escuro customizado
const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#2196F3',
    background: '#000000',
    surface: '#1a1a1a',
    surfaceVariant: '#2a2a2a',
    error: '#CF6679',
  },
};

export default function App() {
  return (
    <PaperProvider theme={darkTheme}>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Routes />
      </AuthProvider>
    </PaperProvider>
  );
}
