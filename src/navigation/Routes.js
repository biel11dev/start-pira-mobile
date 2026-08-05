import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import PDVScreen from '../screens/PDVScreen';
import CashRegisterScreen from '../screens/CashRegisterScreen';
import FiadoScreen from '../screens/FiadoScreen';
import PessoalScreen from '../screens/PessoalScreen';
import DespesaScreen from '../screens/DespesaScreen';
import MachineScreen from '../screens/MachineScreen';
import ProductListScreen from '../screens/ProductListScreen';
import PontoScreen from '../screens/PontoScreen';
import AcessosScreen from '../screens/AcessosScreen';
import EstoqueScreen from '../screens/EstoqueScreen';
import ListaComprasScreen from '../screens/ListaComprasScreen';
import AuditoriaScreen from '../screens/AuditoriaScreen';

const Stack = createNativeStackNavigator();

export default function Routes() {
  const { signed, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size='large' color='#1976d2' />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signed ? (
          <>
            <Stack.Screen name='Home' component={HomeScreen} />
            <Stack.Screen name='PDV' component={PDVScreen} />
            <Stack.Screen name='CashRegister' component={CashRegisterScreen} />
            <Stack.Screen name='Fiado' component={FiadoScreen} />
            <Stack.Screen name='Pessoal' component={PessoalScreen} />
            <Stack.Screen name='Despesa' component={DespesaScreen} />
            <Stack.Screen name='Machine' component={MachineScreen} />
            <Stack.Screen name='ProductList' component={ProductListScreen} />
            <Stack.Screen name='Ponto' component={PontoScreen} />
            <Stack.Screen name='Acessos' component={AcessosScreen} />
            <Stack.Screen name='Estoque' component={EstoqueScreen} />
            <Stack.Screen name='ListaCompras' component={ListaComprasScreen} />
            <Stack.Screen name='Auditoria' component={AuditoriaScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name='Login' component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
