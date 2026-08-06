import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Appbar,
  Card,
  Button,
  Text,
  Chip,
  SegmentedButtons,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import api from '../services/api';

export default function ListaComprasScreen({ navigation }) {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('PENDENTE'); // 'PENDENTE' | 'CONCLUIDO' | 'TODOS'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarLista();
  }, []);

  const carregarLista = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/api/lista-compras');
      setLista(resp.data || []);
    } catch (error) {
      console.error('Erro ao carregar lista de compras:', error);
    } finally {
      setLoading(false);
    }
  };

  const concluirItem = async (id) => {
    try {
      await api.put(`/api/lista-compras/${id}/concluir`);
      carregarLista();
    } catch (error) {
      console.error('Erro ao concluir item:', error);
    }
  };

  const reabrirItem = async (id) => {
    try {
      await api.put(`/api/lista-compras/${id}/reabrir`);
      carregarLista();
    } catch (error) {
      console.error('Erro ao reabrir item:', error);
    }
  };

  const listaFiltrada = lista.filter((item) =>
    filtro === 'TODOS' ? true : item.status === filtro
  );

  const totalPendentes = lista.filter((i) => i.status === 'PENDENTE').length;

  const formatarDataHora = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Agrupar por categoria (pai › sub, igual ao web)
  const grupos = {};
  listaFiltrada.forEach((item) => {
    const cat = item.estoque?.category?.parent
      ? `${item.estoque.category.parent.name} › ${item.estoque.category.name}`
      : item.estoque?.category?.name || 'Sem categoria';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(item);
  });

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Lista de Compras" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <View style={styles.content}>
        <View style={styles.resumoRow}>
          <Chip icon="cart-alert" style={styles.resumoChip} textStyle={{ color: '#fff' }}>
            {totalPendentes} pendente{totalPendentes === 1 ? '' : 's'}
          </Chip>
        </View>

        <SegmentedButtons
          value={filtro}
          onValueChange={setFiltro}
          style={styles.segmented}
          buttons={[
            { value: 'PENDENTE', label: 'Pendentes' },
            { value: 'CONCLUIDO', label: 'Comprados' },
            { value: 'TODOS', label: 'Todos' },
          ]}
        />

        <ScrollView
          style={styles.lista}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={carregarLista} tintColor="#2196F3" />
          }
        >
          {loading && lista.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#2196F3" />
          ) : listaFiltrada.length === 0 ? (
            <Text style={styles.semDados}>Nenhum item nesta lista</Text>
          ) : (
            Object.keys(grupos).map((cat) => (
              <View key={cat}>
                <Text style={styles.grupoTitulo}>{cat}</Text>
                {grupos[cat].map((item) => (
                  <Card key={item.id} style={styles.itemCard}>
                    <Card.Content>
                      <View style={styles.itemHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemNome}>
                            {item.nomeProduto || item.estoque?.name}
                          </Text>
                          <Text style={styles.itemInfo}>
                            Atual: {item.quantidadeAtual ?? item.estoque?.quantity ?? 0}
                            {item.estoque?.unit ? ` ${item.estoque.unit}` : ''} · Mínimo:{' '}
                            {item.quantidadeMinima ?? 0}
                            {item.estoque?.unit ? ` ${item.estoque.unit}` : ''}
                          </Text>
                          {item.status === 'CONCLUIDO' && item.concluidoEm ? (
                            <Text style={styles.itemData}>
                              Comprado em {formatarDataHora(item.concluidoEm)}
                            </Text>
                          ) : item.createdAt ? (
                            <Text style={styles.itemData}>
                              Registrado em {formatarDataHora(item.createdAt)}
                            </Text>
                          ) : null}
                        </View>
                        <Chip
                          style={
                            item.status === 'PENDENTE'
                              ? styles.chipPendente
                              : styles.chipConcluido
                          }
                          textStyle={{ color: '#fff', fontSize: 11 }}
                        >
                          {item.status === 'PENDENTE' ? 'Pendente' : 'Comprado'}
                        </Chip>
                      </View>

                      <Divider style={styles.divider} />

                      {item.status === 'PENDENTE' ? (
                        <Button
                          mode="contained"
                          icon="check"
                          onPress={() => concluirItem(item.id)}
                          style={styles.botaoConcluir}
                        >
                          Marcar como comprado
                        </Button>
                      ) : (
                        <Button
                          mode="outlined"
                          icon="undo"
                          textColor="#FF9800"
                          onPress={() => reabrirItem(item.id)}
                        >
                          Reabrir
                        </Button>
                      )}
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resumoRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  resumoChip: {
    backgroundColor: '#FF5722',
  },
  segmented: {
    marginVertical: 12,
  },
  lista: {
    flex: 1,
  },
  semDados: {
    textAlign: 'center',
    marginTop: 24,
    color: '#aaa',
  },
  grupoTitulo: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  itemCard: {
    marginBottom: 10,
    backgroundColor: '#1a1a1a',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemNome: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemInfo: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  itemData: {
    color: '#777',
    fontSize: 11,
    marginTop: 3,
    fontStyle: 'italic',
  },
  chipPendente: {
    backgroundColor: '#FF9800',
  },
  chipConcluido: {
    backgroundColor: '#4CAF50',
  },
  divider: {
    marginVertical: 10,
    backgroundColor: '#333',
  },
  botaoConcluir: {
    backgroundColor: '#4CAF50',
  },
});
