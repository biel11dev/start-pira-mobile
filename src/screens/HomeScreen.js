import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Appbar,
  Avatar,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();

  const menuItems = [
    { title: 'CAIXA', icon: 'cash-multiple', screen: 'CashRegister', color: '#2196F3', permission: 'caixa' },
    { title: 'BASE DE CADASTRO', icon: 'clipboard-list', screen: 'ProductList', color: '#2196F3', permission: 'produtos' },
    { title: 'LISTA DE COMPRAS', icon: 'cart', screen: 'ListaCompras', color: '#4CAF50', permission: 'produtos' },
    { title: 'FIADO', icon: 'notebook', screen: 'Fiado', color: '#FF9800', permission: 'fiado' },
    { title: 'DESPESAS', icon: 'receipt', screen: 'Despesa', color: '#F44336', permission: 'despesas' },
    { title: 'PONTO', icon: 'clock-outline', screen: 'Ponto', color: '#FF5722', permission: 'ponto' },
    { title: 'ACESSOS', icon: 'account-multiple', screen: 'Acessos', color: '#9C27B0', permission: 'acessos' },
    { title: 'ESTOQUE', icon: 'package-variant', screen: 'Estoque', color: '#8BC34A', permission: 'base_produto' },
    { title: 'PDV', icon: 'cash-register', screen: 'PDV', color: '#00BCD4', permission: 'pdv' },
    { title: 'PESSOAL', icon: 'wallet', screen: 'Pessoal', color: '#E91E63', permission: 'pessoal' },
    { title: 'AUDITORIA', icon: 'shield-search', screen: 'Auditoria', color: '#607D8B', permission: 'auditoria' },
  ];

  // Filtrar módulos baseado nas permissões do usuário
  const menuItemsFiltered = menuItems.filter(item => 
    !item.permission || user?.permissions?.[item.permission]
  );

  const handleLogout = () => {
    signOut();
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content 
          title="Start Pira" 
          subtitle={user?.name || user?.username}
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action icon="logout" onPress={handleLogout} color="#fff" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <Card style={styles.welcomeCard}>
          <Card.Content style={styles.welcomeContent}>
            <Avatar.Icon size={64} icon="account-circle" style={styles.avatar} />
            <View style={styles.welcomeText}>
              <Text style={styles.welcomeTitle}>
                Bem-vindo, {user?.name || user?.username || 'Usuário'}!
              </Text>
              <Text style={styles.welcomeSubtitle}>
                Selecione um módulo abaixo
              </Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.grid}>
          {menuItemsFiltered.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Card style={[styles.menuCard]}>
                <Card.Content style={styles.menuContent}>
                  <Avatar.Icon
                    size={48}
                    icon={item.icon}
                    style={{ backgroundColor: item.color }}
                  />
                  <Text style={styles.menuTitle}>{item.title}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  welcomeCard: {
    margin: 16,
    elevation: 4,
    backgroundColor: '#1a1a1a',
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#2196F3',
  },
  welcomeText: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#fff',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  grid: {
    padding: 8,
  },
  menuItem: {
    width: '100%',
    padding: 8,
  },
  menuCard: {
    elevation: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  menuContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 16,
    color: '#fff',
  },
});
