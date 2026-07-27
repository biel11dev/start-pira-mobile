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
  FAB,
  Portal,
  Modal,
  Searchbar,
  Chip,
  Menu,
  Divider,
} from 'react-native-paper';
import api from '../services/api';

export default function EstoqueScreen({ navigation }) {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('un');
  const [value, setValue] = useState('');
  const [valueCusto, setValueCusto] = useState('');
  const [categoryId, setCategoryId] = useState(null);

  useEffect(() => {
    carregarProdutos();
    carregarCategorias();
  }, []);

  const carregarProdutos = async () => {
    try {
      console.log('🔵 Carregando estoque...');
      const response = await api.get('/api/products');
      console.log('✅ Estoque carregado:', response.data);
      setProdutos(response.data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar estoque:', error);
      Alert.alert('Erro', 'Não foi possível carregar o estoque');
    }
  };

  const carregarCategorias = async () => {
    try {
      const response = await api.get('/api/categories/all');
      setCategorias(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const adicionarProduto = async () => {
    if (!name || !quantity || !unit || !value || !valueCusto) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/products', {
        name,
        quantity: parseInt(quantity),
        unit,
        value: parseFloat(value),
        valuecusto: parseFloat(valueCusto),
        categoryId: categoryId || null,
      });

      Alert.alert('Sucesso', 'Produto adicionado ao estoque!');
      setModalVisible(false);
      limparForm();
      carregarProdutos();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao adicionar produto');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarProduto = async () => {
    if (!produtoSelecionado) return;

    setLoading(true);
    try {
      await api.put(`/api/products/${produtoSelecionado.id}`, {
        name,
        quantity: parseInt(quantity),
        unit,
        value: parseFloat(value),
        valuecusto: parseFloat(valueCusto),
        categoryId: categoryId || null,
      });

      Alert.alert('Sucesso', 'Produto atualizado!');
      setModalDetalhes(false);
      carregarProdutos();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar produto');
    } finally {
      setLoading(false);
    }
  };

  const excluirProduto = async (id) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Deseja realmente excluir este produto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/products/${id}`);
              Alert.alert('Sucesso', 'Produto excluído!');
              carregarProdutos();
              setModalDetalhes(false);
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir produto');
            }
          },
        },
      ]
    );
  };

  const verDetalhes = (produto) => {
    setProdutoSelecionado(produto);
    setName(produto.name);
    setQuantity(produto.quantity.toString());
    setUnit(produto.unit);
    setValue(produto.value.toString());
    setValueCusto(produto.valuecusto.toString());
    setCategoryId(produto.categoryId);
    setModalDetalhes(true);
  };

  const limparForm = () => {
    setName('');
    setQuantity('');
    setUnit('un');
    setValue('');
    setValueCusto('');
    setCategoryId(null);
  };

  const produtosFiltrados = produtos.filter(
    (p) =>
      p.name?.toLowerCase().includes(busca.toLowerCase()) ||
      p.id?.toString().includes(busca)
  );

  const calcularLucro = (venda, custo) => {
    const lucro = venda - custo;
    const percentual = ((lucro / custo) * 100).toFixed(1);
    return { lucro, percentual };
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Estoque" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Buscar produto"
          onChangeText={setBusca}
          value={busca}
          style={styles.searchBar}
          iconColor="#fff"
          placeholderTextColor="#888"
          theme={{ colors: { text: '#fff' } }}
        />

        <ScrollView style={styles.lista}>
          {produtosFiltrados.length === 0 ? (
            <Text style={styles.semDados}>Nenhum produto no estoque</Text>
          ) : (
            produtosFiltrados.map((produto) => {
              const { lucro, percentual } = calcularLucro(produto.value, produto.valuecusto);
              return (
                <Card
                  key={produto.id}
                  style={styles.produtoCard}
                  onPress={() => verDetalhes(produto)}
                >
                  <Card.Content>
                    <View style={styles.produtoHeader}>
                      <View style={styles.produtoInfo}>
                        <Text style={styles.produtoNome}>{produto.name}</Text>
                        {produto.category && (
                          <Text style={styles.produtoCategoria}>
                            {produto.category.name}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.produtoPrecos}>
                      <View style={styles.precoItem}>
                        <Text style={styles.precoLabel}>Custo:</Text>
                        <Text style={styles.precoCusto}>
                          R$ {produto.valuecusto?.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.precoItem}>
                        <Text style={styles.precoLabel}>Venda:</Text>
                        <Text style={styles.precoVenda}>
                          R$ {produto.value?.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.precoItem}>
                        <Text style={styles.precoLabel}>Lucro:</Text>
                        <Text style={styles.precoLucro}>
                          R$ {lucro.toFixed(2)} ({percentual}%)
                        </Text>
                      </View>
                    </View>

                    <View style={styles.produtoFooter}>
                      <Chip
                        mode="outlined"
                        icon="package-variant"
                        style={[
                          styles.estoqueChip,
                          produto.quantity <= 5 ? styles.estoqueBaixo : {},
                        ]}
                        textStyle={{ color: produto.quantity <= 5 ? '#FF5722' : '#2196F3' }}
                      >
                        Estoque: {produto.quantity} {produto.unit}
                      </Chip>
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => {
          limparForm();
          setModalVisible(true);
        }}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Novo Produto</Text>

            <TextInput
              label="Nome do Produto *"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Quantidade *"
              value={quantity}
              onChangeText={setQuantity}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Unidade *"
              value={unit}
              onChangeText={setUnit}
              mode="outlined"
              placeholder="un, kg, l, etc"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Preço de Custo *"
              value={valueCusto}
              onChangeText={setValueCusto}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Preço de Venda *"
              value={value}
              onChangeText={setValue}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={adicionarProduto}
                loading={loading}
                disabled={loading}
                style={styles.modalButton}
              >
                Adicionar
              </Button>
            </View>
          </ScrollView>
        </Modal>

        <Modal
          visible={modalDetalhes}
          onDismiss={() => setModalDetalhes(false)}
          contentContainerStyle={styles.modal}
        >
          {produtoSelecionado && (
            <ScrollView>
              <Text style={styles.modalTitle}>Editar Produto</Text>

              <TextInput
                label="Nome do Produto *"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                theme={{ colors: { background: '#2a2a2a' } }}
              />

              <TextInput
                label="Quantidade *"
                value={quantity}
                onChangeText={setQuantity}
                mode="outlined"
                keyboardType="number-pad"
                style={styles.input}
                theme={{ colors: { background: '#2a2a2a' } }}
              />

              <TextInput
                label="Unidade *"
                value={unit}
                onChangeText={setUnit}
                mode="outlined"
                style={styles.input}
                theme={{ colors: { background: '#2a2a2a' } }}
              />

              <TextInput
                label="Preço de Custo *"
                value={valueCusto}
                onChangeText={setValueCusto}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.input}
                theme={{ colors: { background: '#2a2a2a' } }}
              />

              <TextInput
                label="Preço de Venda *"
                value={value}
                onChangeText={setValue}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.input}
                theme={{ colors: { background: '#2a2a2a' } }}
              />

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setModalDetalhes(false)}
                  style={styles.modalButton}
                  textColor="#fff"
                >
                  Cancelar
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => excluirProduto(produtoSelecionado.id)}
                  style={[styles.modalButton, styles.deleteButton]}
                  textColor="#FF5722"
                >
                  Excluir
                </Button>
                <Button
                  mode="contained"
                  onPress={atualizarProduto}
                  loading={loading}
                  disabled={loading}
                  style={styles.modalButton}
                >
                  Salvar
                </Button>
              </View>
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
  },
  searchBar: {
    margin: 16,
    backgroundColor: '#1a1a1a',
  },
  lista: {
    flex: 1,
    paddingHorizontal: 16,
  },
  semDados: {
    textAlign: 'center',
    marginTop: 20,
    color: '#aaa',
  },
  produtoCard: {
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
  },
  produtoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  produtoInfo: {
    flex: 1,
  },
  produtoNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  produtoCategoria: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  produtoPrecos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  precoItem: {
    flex: 1,
  },
  precoLabel: {
    fontSize: 10,
    color: '#aaa',
    marginBottom: 2,
  },
  precoCusto: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  precoVenda: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  precoLucro: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  produtoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estoqueChip: {
    backgroundColor: 'transparent',
    borderColor: '#2196F3',
  },
  estoqueBaixo: {
    borderColor: '#FF5722',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#fff',
  },
  input: {
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  deleteButton: {
    borderColor: '#FF5722',
  },
});
