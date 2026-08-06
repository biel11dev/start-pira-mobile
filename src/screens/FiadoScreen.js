import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Appbar,
  Card,
  TextInput,
  Button,
  Text,
  Chip,
  FAB,
  Portal,
  Modal,
  Searchbar,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';
import { formatarValor } from '../utils/format';

export default function FiadoScreen({ navigation }) {
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [modalAddCliente, setModalAddCliente] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [compras, setCompras] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);

  // Form fields - Novo Cliente
  const [nomeCliente, setNomeCliente] = useState('');

  // Form fields - Nova Compra
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0]);

  // Form fields - Novo Pagamento
  const [valorPagamento, setValorPagamento] = useState('');

  useEffect(() => {
    carregarClientes();
    carregarProdutos();
  }, []);

  const carregarClientes = async () => {
    try {
      const response = await api.get('/api/clients');
      setClientes(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const carregarProdutos = async () => {
    try {
      const response = await api.get('/api/products');
      setProdutos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const carregarDetalhesCliente = async (clienteId) => {
    try {
      const response = await api.get(`/api/clients/${clienteId}`);
      const cliente = response.data;
      setClienteSelecionado(cliente);
      setCompras(cliente.Purchase || []);
      setPagamentos(cliente.Payment || []);
      setModalDetalhes(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes do cliente:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do cliente');
    }
  };

  const adicionarCliente = async () => {
    if (!nomeCliente) {
      Alert.alert('Atenção', 'Digite o nome do cliente');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/clients', {
        name: nomeCliente,
      });

      Alert.alert('Sucesso', 'Cliente cadastrado!');
      setModalAddCliente(false);
      setNomeCliente('');
      carregarClientes();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao cadastrar cliente');
    } finally {
      setLoading(false);
    }
  };

  const excluirCliente = (cliente) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o cliente "${cliente.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/clients/${cliente.id}`);
              carregarClientes();
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir cliente');
            }
          },
        },
      ]
    );
  };

  const adicionarCompra = async () => {
    if (!produtoSelecionado || !quantidade) {
      Alert.alert('Atenção', 'Selecione um produto e digite a quantidade');
      return;
    }

    setLoading(true);
    try {
      const produto = produtos.find(p => p.id === parseInt(produtoSelecionado));
      const qtd = parseInt(quantidade);
      const total = produto.value * qtd;

      await api.post('/api/purchases', {
        product: produto.name,
        quantity: qtd,
        total: total,
        date: new Date(dataCompra).toISOString(),
        clientId: clienteSelecionado.id,
      });

      await api.put(`/api/clients/${clienteSelecionado.id}`, {
        totalDebt: (clienteSelecionado.totalDebt || 0) + total,
      });

      Alert.alert('Sucesso', 'Compra adicionada!');
      setProdutoSelecionado('');
      setQuantidade('');
      carregarDetalhesCliente(clienteSelecionado.id);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao adicionar compra');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const registrarPagamento = async () => {
    if (!valorPagamento || parseFloat(valorPagamento) <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/payments', {
        amount: parseFloat(valorPagamento),
        date: new Date().toISOString(),
        clientId: clienteSelecionado.id,
      });

      await api.put(`/api/clients/${clienteSelecionado.id}`, {
        totalDebt: (clienteSelecionado.totalDebt || 0) - parseFloat(valorPagamento),
      });

      Alert.alert('Sucesso', 'Pagamento registrado!');
      setValorPagamento('');
      carregarDetalhesCliente(clienteSelecionado.id);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao registrar pagamento');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const excluirCompra = async (compraId) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Deseja excluir esta compra?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const compra = compras.find((c) => c.id === compraId);
              await api.delete(`/api/purchases/${compraId}`);
              if (compra) {
                await api.put(`/api/clients/${clienteSelecionado.id}`, {
                  totalDebt: (clienteSelecionado.totalDebt || 0) - (compra.total || 0),
                });
              }
              Alert.alert('Sucesso', 'Compra excluída!');
              carregarDetalhesCliente(clienteSelecionado.id);
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir compra');
            }
          }
        }
      ]
    );
  };

  const excluirPagamento = async (pagamentoId) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Deseja excluir este pagamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const pagamento = pagamentos.find((p) => p.id === pagamentoId);
              await api.delete(`/api/payments/${pagamentoId}`);
              if (pagamento) {
                await api.put(`/api/clients/${clienteSelecionado.id}`, {
                  totalDebt: (clienteSelecionado.totalDebt || 0) + (pagamento.amount || 0),
                });
              }
              Alert.alert('Sucesso', 'Pagamento excluído!');
              carregarDetalhesCliente(clienteSelecionado.id);
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir pagamento');
            }
          }
        }
      ]
    );
  };

  const calcularValorDevedor = () => {
    const totalCompras = compras.reduce((acc, c) => acc + (c.total || 0), 0);
    const totalPagamentos = pagamentos.reduce((acc, p) => acc + (p.amount || 0), 0);
    return totalCompras - totalPagamentos;
  };

  const clientesFiltrados = clientes.filter(
    (c) => c.name?.toLowerCase().includes(busca.toLowerCase())
  );

  const formatarData = (data) => {
    if (!data) return '';
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
  };



  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Cadastro de Clientes" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Buscar cliente"
          onChangeText={setBusca}
          value={busca}
          style={styles.searchBar}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Carregando clientes...</Text>
          </View>
        ) : (
          <ScrollView style={styles.lista}>
            {clientesFiltrados.length === 0 ? (
              <Text style={styles.semDados}>Nenhum cliente cadastrado</Text>
            ) : (
              clientesFiltrados.map((cliente) => (
                <Card
                  key={cliente.id}
                  style={styles.clienteCard}
                  onPress={() => carregarDetalhesCliente(cliente.id)}
                >
                  <Card.Content>
                    <View style={styles.clienteHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clienteNome}>{cliente.name}</Text>
                        <Text style={styles.clienteDebt}>
                          Devedor: R$ {formatarValor(cliente.totalDebt || 0)}
                        </Text>
                      </View>
                      <IconButton
                        icon="delete"
                        size={22}
                        iconColor="#F44336"
                        onPress={() => excluirCliente(cliente)}
                      />
                      <IconButton
                        icon="chevron-right"
                        size={24}
                        iconColor="#fff"
                        onPress={() => carregarDetalhesCliente(cliente.id)}
                      />
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setModalAddCliente(true)}
        label="Adicionar Cliente"
      />

      {/* Modal Adicionar Cliente */}
      <Portal>
        <Modal
          visible={modalAddCliente}
          onDismiss={() => setModalAddCliente(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Novo Cliente</Text>

          <TextInput
            label="Nome do cliente"
            value={nomeCliente}
            onChangeText={setNomeCliente}
            mode="outlined"
            style={styles.input}
            theme={{ colors: { background: '#1a1a1a' } }}
          />

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setModalAddCliente(false)}
              style={styles.modalButton}
              textColor="#fff"
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={adicionarCliente}
              loading={loading}
              disabled={loading}
              style={styles.modalButton}
            >
              Adicionar Cliente
            </Button>
          </View>
        </Modal>

        {/* Modal Detalhes do Cliente */}
        <Modal
          visible={modalDetalhes}
          onDismiss={() => setModalDetalhes(false)}
          contentContainerStyle={styles.modalLarge}
        >
          {clienteSelecionado && (
            <ScrollView>
              <Text style={styles.modalTitle}>
                Detalhes do Cliente: {clienteSelecionado.name}
              </Text>

              {/* Formulário Adicionar Compra */}
              <Card style={styles.formCard}>
                <Card.Title title="Adicionar Compra" titleStyle={styles.cardTitle} />
                <Card.Content>
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Selecione um produto</Text>
                    <Picker
                      selectedValue={produtoSelecionado}
                      onValueChange={setProdutoSelecionado}
                      style={styles.picker}
                      dropdownIconColor="#fff"
                    >
                      <Picker.Item label="Selecione um produto" value="" />
                      {produtos.map((produto) => (
                        <Picker.Item
                          key={produto.id}
                          label={`${produto.name} - R$ ${formatarValor(produto.value)}`}
                          value={produto.id.toString()}
                        />
                      ))}
                    </Picker>
                  </View>

                  <TextInput
                    label="Quantidade"
                    value={quantidade}
                    onChangeText={setQuantidade}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.input}
                    theme={{ colors: { background: '#1a1a1a' } }}
                  />

                  <TextInput
                    label="Data"
                    value={dataCompra}
                    onChangeText={setDataCompra}
                    mode="outlined"
                    style={styles.input}
                    theme={{ colors: { background: '#1a1a1a' } }}
                  />

                  <Button
                    mode="contained"
                    onPress={adicionarCompra}
                    loading={loading}
                    disabled={loading}
                    style={styles.addButton}
                  >
                    Adicionar Compra
                  </Button>
                </Card.Content>
              </Card>

              {/* Lista de Compras */}
              <Card style={styles.sectionCard}>
                <Card.Title title="Compras" titleStyle={styles.cardTitle} />
                <Card.Content>
                  {compras.length === 0 ? (
                    <Text style={styles.semItens}>Nenhuma compra registrada</Text>
                  ) : (
                    compras.map((compra) => (
                      <Card key={compra.id} style={styles.itemCard}>
                        <Card.Content>
                          <View style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemNome}>
                                {compra.product} {compra.quantity}
                              </Text>
                              <Text style={[styles.itemValor, { color: '#F44336' }]}>
                                -R$ {formatarValor(compra.total)}
                              </Text>
                              <Text style={styles.itemData}>{formatarData(compra.date)}</Text>
                            </View>
                            <IconButton
                              icon="delete"
                              iconColor="#F44336"
                              onPress={() => excluirCompra(compra.id)}
                            />
                          </View>
                        </Card.Content>
                      </Card>
                    ))
                  )}
                </Card.Content>
              </Card>

              {/* Formulário Registrar Pagamento */}
              <Card style={styles.formCard}>
                <Card.Title title="Registrar Pagamento" titleStyle={styles.cardTitle} />
                <Card.Content>
                  <TextInput
                    label="Valor Pago"
                    value={valorPagamento}
                    onChangeText={setValorPagamento}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={styles.input}
                    theme={{ colors: { background: '#1a1a1a' } }}
                  />

                  <Button
                    mode="contained"
                    onPress={registrarPagamento}
                    loading={loading}
                    disabled={loading}
                    style={styles.addButton}
                  >
                    Registrar Pagamento
                  </Button>
                </Card.Content>
              </Card>

              {/* Lista de Pagamentos */}
              <Card style={styles.sectionCard}>
                <Card.Title title="Pagamentos" titleStyle={styles.cardTitle} />
                <Card.Content>
                  {pagamentos.length === 0 ? (
                    <Text style={styles.semItens}>Nenhum pagamento registrado</Text>
                  ) : (
                    pagamentos.map((pagamento) => (
                      <Card key={pagamento.id} style={styles.itemCard}>
                        <Card.Content>
                          <View style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                              <Text style={[styles.itemValor, { color: '#4CAF50' }]}>
                                R$ {formatarValor(pagamento.amount)}
                              </Text>
                              <Text style={styles.itemData}>{formatarData(pagamento.date)}</Text>
                            </View>
                            <IconButton
                              icon="delete"
                              iconColor="#F44336"
                              onPress={() => excluirPagamento(pagamento.id)}
                            />
                          </View>
                        </Card.Content>
                      </Card>
                    ))
                  )}
                </Card.Content>
              </Card>

              {/* Valor Devedor */}
              <Card style={styles.totalCard}>
                <Card.Content>
                  <Text style={styles.totalLabel}>Valor Devedor:</Text>
                  <Text style={styles.totalValor}>R$ {formatarValor(calcularValorDevedor())}</Text>
                </Card.Content>
              </Card>

              <Button
                mode="outlined"
                onPress={() => setModalDetalhes(false)}
                style={styles.closeButton}
                textColor="#fff"
              >
                Fechar
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>
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
    padding: 16,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  lista: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    color: '#999',
    marginTop: 16,
    fontSize: 16,
  },
  semDados: {
    textAlign: 'center',
    padding: 40,
    color: '#999',
    fontSize: 16,
  },
  clienteCard: {
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
  },
  clienteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clienteNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  clienteDebt: {
    fontSize: 13,
    color: '#ff6b6b',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2196F3',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalLarge: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#fff',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  picker: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  modalButton: {
    flex: 1,
  },
  formCard: {
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
  },
  sectionCard: {
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
  },
  cardTitle: {
    color: '#fff',
  },
  addButton: {
    marginTop: 8,
    backgroundColor: '#2196F3',
  },
  semItens: {
    textAlign: 'center',
    padding: 16,
    color: '#999',
  },
  itemCard: {
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  itemValor: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemData: {
    fontSize: 12,
    color: '#999',
  },
  totalCard: {
    marginBottom: 16,
    backgroundColor: '#F44336',
  },
  totalLabel: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  totalValor: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },
  closeButton: {
    marginTop: 16,
    borderColor: '#fff',
  },
});
